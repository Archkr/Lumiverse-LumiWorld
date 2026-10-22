/**
 * LumiWorld's adapter for the host's native Decision model API.
 *
 * The host resolves saved connections, owns credentials and provider transport,
 * and validates typed answers. LumiWorld supplies the projected scene and named
 * questions, then adapts the native result for its existing gate resolver.
 */

import type {
  DecisionAnswer,
  DecisionEvaluationInput,
  DecisionJsonValue,
  DecisionQuestion,
  DecisionResult,
  DecisionState,
} from "lumiverse-spindle-types";
import {
  DEFAULT_JEV_TIMEOUT_MS,
  DEFAULT_JEV_STATE_CHARS,
  JEV_MAX_STATE_TOKENS,
  MAX_JEV_HISTORY_MESSAGES,
  serializeMessageContent,
  type JevSettings,
  type LlmMessageLike,
} from "./shared";

const MAX_DECISION_TIMEOUT_MS = 30_000;

export class JevTimeoutError extends Error {
  constructor(timeoutMs: number) {
    super(`Decision model did not answer within ${Math.round(timeoutMs / 1000)}s.`);
    this.name = "JevTimeoutError";
  }
}

export type JevQuestion = DecisionQuestion;
export type JevQuestions = Record<string, JevQuestion>;
export type JevNoulAnswer = Extract<DecisionAnswer, { type: "noul" }>;
export type JevChoiceAnswer = Extract<DecisionAnswer, { type: "choice" }>;
export type JevScoreAnswer = Extract<DecisionAnswer, { type: "score" }>;
export type JevAnswer = DecisionAnswer;

/** Safe diagnostics: native inputs contain no credentials or provider URLs. */
export interface JevRequest {
  body: string;
  model: string | null;
}

export interface JevUsage {
  inputTokens: number | null;
  outputTokens: number | null;
  costUsd: number | null;
}

export interface JevResponse {
  /** The resolved serving model reported by the host. */
  model: string;
  usage: JevUsage;
  answers: Record<string, JevAnswer>;
}

export type JevCallConfig = Pick<JevSettings, "connectionId" | "model" | "timeoutMs">;

function buildDecisionInput(
  settings: Pick<JevSettings, "connectionId" | "model">,
  state: DecisionState,
  questions: JevQuestions,
  userId?: string,
): DecisionEvaluationInput {
  const input: DecisionEvaluationInput = { state, questions };
  // An explicit ID must reach the host unchanged: invalid IDs must fail instead
  // of silently falling back to another saved connection.
  if (settings.connectionId !== null && settings.connectionId !== "") input.connection_id = settings.connectionId;
  const model = settings.model.trim();
  if (model) input.model = model;
  if (userId !== undefined) input.userId = userId;
  return input;
}

export function buildJevRequest(
  settings: Pick<JevSettings, "connectionId" | "model">,
  state: DecisionState,
  questions: JevQuestions,
  userId?: string,
): JevRequest {
  const input = buildDecisionInput(settings, state, questions, userId);
  return { body: JSON.stringify(input), model: input.model ?? null };
}

/** Adapts validated native answers without rounding or coercing their values. */
export function normalizeJevResponse(result: DecisionResult): JevResponse {
  return {
    model: result.model,
    usage: {
      inputTokens: result.usage?.input_tokens ?? null,
      outputTokens: result.usage?.output_tokens ?? null,
      costUsd: result.usage?.cost ?? null,
    },
    answers: result.answers,
  };
}

export type DecisionEvaluate = (
  input: DecisionEvaluationInput,
  options?: { signal?: AbortSignal },
) => Promise<DecisionResult>;

export interface CallJevOptions {
  config: JevCallConfig;
  state: DecisionState;
  questions: JevQuestions;
  evaluate: DecisionEvaluate;
  /** Required by the host for an operator extension acting for a user. */
  userId?: string;
  /** Total wall clock remaining for this phase. */
  budgetMs?: number;
  timeoutMs?: number;
}

export interface CallJevResult {
  ok: boolean;
  response: JevResponse | null;
  error: string | null;
  timedOut: boolean;
  requests: number;
  durationMs: number;
  request: JevRequest | null;
  /** Native result or error for the single evaluation; there are no HTTP retries. */
  attempts: Array<{ status: number | null; body: string | null; error: string | null; durationMs: number }>;
}

/** The deadline cancels provider work as well as bounding the caller's wait. */
function evaluateWithDeadline(
  evaluate: DecisionEvaluate,
  input: DecisionEvaluationInput,
  timeoutMs: number,
): Promise<DecisionResult> {
  const controller = new AbortController();
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      const error = new JevTimeoutError(timeoutMs);
      controller.abort(error);
      reject(error);
    }, Math.max(1, Math.ceil(timeoutMs)));
    // Catch synchronous callback errors too, and handle late settlements after
    // cancellation so they cannot become unhandled rejections or late results.
    Promise.resolve().then(() => evaluate(input, { signal: controller.signal })).then(
      (result) => { clearTimeout(timer); resolve(result); },
      (error) => { clearTimeout(timer); reject(error); },
    );
  });
}

/** Each phase makes one native evaluation; failures follow the gate fallback. */
export async function callJev(options: CallJevOptions): Promise<CallJevResult> {
  const startedAt = Date.now();
  const attempts: CallJevResult["attempts"] = [];
  let request: JevRequest | null = null;
  let requests = 0;
  try {
    const input = buildDecisionInput(options.config, options.state, options.questions, options.userId);
    request = { body: JSON.stringify(input), model: input.model ?? null };
    const configuredTimeout = options.timeoutMs ?? options.config.timeoutMs ?? DEFAULT_JEV_TIMEOUT_MS;
    const timeoutMs = Number.isNaN(configuredTimeout) ? DEFAULT_JEV_TIMEOUT_MS : configuredTimeout;
    const remainingBudget = options.budgetMs === undefined || Number.isNaN(options.budgetMs)
      ? Number.POSITIVE_INFINITY
      : options.budgetMs - (Date.now() - startedAt);
    const effectiveTimeout = Math.min(MAX_DECISION_TIMEOUT_MS, timeoutMs, remainingBudget);
    if (effectiveTimeout <= 0) throw new JevTimeoutError(0);

    requests = 1;
    const attemptStartedAt = Date.now();
    try {
      const result = await evaluateWithDeadline(options.evaluate, input, effectiveTimeout);
      const response = normalizeJevResponse(result);
      attempts.push({ status: null, body: JSON.stringify(result), error: null, durationMs: Date.now() - attemptStartedAt });
      return { ok: true, response, error: null, timedOut: false, requests, durationMs: Date.now() - startedAt, request, attempts };
    } catch (error) {
      attempts.push({ status: null, body: null, error: error instanceof Error ? error.message : String(error), durationMs: Date.now() - attemptStartedAt });
      throw error;
    }
  } catch (error) {
    return {
      ok: false,
      response: null,
      error: error instanceof Error ? error.message : String(error),
      timedOut: error instanceof JevTimeoutError,
      requests,
      durationMs: Date.now() - startedAt,
      request,
      attempts,
    };
  }
}

/* ------------------------------------------------------------------ *
 * Turn state projection
 * ------------------------------------------------------------------ */

/** Context required to build the state Jev evaluates. */
export interface JevStateContext {
  settings: Pick<JevSettings, "historyMessageLimit" | "maxStateChars">;
  generationType: string;
  chatId: string;
  history: LlmMessageLike[];
  latestPlayerAction?: string | null;
  personaSummary?: string | null;
  characterSummary?: string | null;
  worldInfoSummary?: string | null;
  directorNotes?: string | null;
  worldState?: unknown;
  /** Draft directive, only for the verification phase. */
  draftDirective?: string | null;
}

export interface JevStateProjection {
  state: DecisionState;
  chars: number;
  compacted: boolean;
}

/** Truncates to the budget, including the notice, so the result never exceeds it. */
function truncate(value: string, budget: number): string {
  const text = value.trim();
  if (budget <= 0) return "";
  if (text.length <= budget) return text;
  const notice = "\n[... truncated ...]";
  return `${text.slice(0, Math.max(0, budget - notice.length)).trimEnd()}${notice}`;
}

function renderHistory(history: LlmMessageLike[], limit: number, budget: number): string[] {
  if (limit <= 0 || budget <= 0) return [];
  const selected = history.slice(-Math.min(limit, MAX_JEV_HISTORY_MESSAGES));
  const lines = selected.map((message) => {
    const content = serializeMessageContent(message.content).replace(/\s+/g, " ").trim();
    const name = message.name ? ` (${message.name})` : "";
    return `${message.role}${name}: ${content || "[empty]"}`;
  });
  // Keep the most recent turns; drop the oldest when the history budget is tight.
  const kept: string[] = [];
  let used = 0;
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    const line = lines[index]!;
    const room = budget - used;
    if (room <= 0) break;
    // A single turn larger than the whole budget is truncated rather than kept
    // whole, which is what previously let one message blow past the cap.
    if (line.length > room) {
      if (line.length < 40) break;
      kept.unshift(`${line.slice(0, Math.max(0, room - 16)).trimEnd()}
[... cut ...]`);
      break;
    }
    kept.unshift(line);
    used += line.length + 1;
  }
  return kept;
}

/**
 * Builds the state object Jev evaluates. `state` is a structured object so gate
 * instructions can point at named fields, and every textual field is truncated to
 * respect the provider's 32k-token `state` allowance and the user's character cap.
 */
/**
 * Share of the state cap each optional field may use.
 *
 * Allocating up front is what makes the cap enforceable: dropping fields when the
 * budget runs out leaves no single field able to blow past it. History takes
 * whatever remains.
 */
const STATE_FIELD_SHARES: ReadonlyArray<{ key: string; share: number; min: number }> = [
  { key: "latest_player_action", share: 0.12, min: 120 },
  { key: "character", share: 0.18, min: 200 },
  { key: "world_info", share: 0.20, min: 200 },
  { key: "user_persona", share: 0.08, min: 120 },
  { key: "scene_state", share: 0.12, min: 120 },
  { key: "director_notes", share: 0.06, min: 80 },
  { key: "draft_directive", share: 0.12, min: 120 },
];

/** Models the serialized cost of one field: `"key":"value"` plus a comma. */
function fieldCost(key: string, value: string): number {
  return JSON.stringify(key).length + 2 + JSON.stringify(value).length + 1;
}

/**
 * Builds the state object Jev evaluates.
 *
 * `state` is a structured object so decision instructions can point at named
 * fields. The result is guaranteed to serialize within `maxStateChars`: optional
 * fields are filled from a per-field allocation, history takes the remainder, and
 * if the assembled object still overshoots (key overhead, escaping) it is trimmed
 * progressively until it fits.
 */
export function buildJevState(context: JevStateContext, worldStateContext?: string | null): JevStateProjection {
  const cap = Math.max(500, context.settings.maxStateChars || DEFAULT_JEV_STATE_CHARS);
  const historyLimit = Math.max(0, Math.min(context.settings.historyMessageLimit, MAX_JEV_HISTORY_MESSAGES));

  const optional: Record<string, string> = {};
  const addOptional = (key: string, value: string | null | undefined): void => {
    const text = typeof value === "string" ? value.trim() : "";
    if (text) optional[key] = text;
  };
  addOptional("character", context.characterSummary);
  addOptional("latest_player_action", context.latestPlayerAction);
  addOptional("world_info", context.worldInfoSummary);
  addOptional("user_persona", context.personaSummary);
  addOptional("scene_state", typeof worldStateContext === "string" ? worldStateContext : undefined);
  addOptional("director_notes", context.directorNotes);
  addOptional("draft_directive", context.draftDirective);

  let compacted = false;

  const build = (shrink: number): Record<string, DecisionJsonValue> => {
    const state: Record<string, DecisionJsonValue> = { generation_type: context.generationType || "normal" };
    let used = JSON.stringify(state).length;
    let truncatedAny = false;

    for (const { key, share, min } of STATE_FIELD_SHARES) {
      const text = optional[key];
      if (!text) continue;
      const allowance = Math.min(Math.max(min, Math.floor(cap * share * shrink)), Math.max(min, cap - 200));
      const trimmed = truncate(text, allowance);
      if (trimmed.length < text.length) truncatedAny = true;
      const cost = fieldCost(key, trimmed);
      // A field that cannot fit its own keys is dropped rather than left to push
      // the object past the cap.
      if (used + cost > cap) {
        truncatedAny = true;
        continue;
      }
      state[key] = trimmed;
      used += cost;
    }

    if (historyLimit > 0 && context.history.length > 0) {
      // Reserve the bytes `"chat_history":[]` itself costs.
      const available = Math.max(0, cap - used - 18);
      const lines = renderHistory(context.history, historyLimit, available);
      // Losing a turn to the budget counts as compaction too.
      if (lines.length < Math.min(context.history.length, historyLimit)) truncatedAny = true;
      if (lines.length) state.chat_history = lines;
    }
    if (truncatedAny) compacted = true;
    return state;
  };

  let shrink = 1;
  let state = build(shrink);
  let chars = JSON.stringify(state).length;

  // Escaping and key overhead can still push a few characters over. Shrink the
  // optional allowances, then drop them entirely, before touching history.
  while (chars > cap && shrink > 0.05) {
    shrink = shrink > 0.5 ? 0.35 : shrink > 0.15 ? 0.1 : 0.02;
    state = build(shrink);
    chars = JSON.stringify(state).length;
  }
  if (chars > cap) {
    for (const key of ["director_notes", "scene_state", "user_persona", "world_info", "character", "draft_directive", "latest_player_action"]) {
      if (chars <= cap) break;
      if (!(key in state)) continue;
      delete state[key];
      chars = JSON.stringify(state).length;
    }
  }

  return { state, chars, compacted };
}

/** Rough guard so a batch can never exceed the provider's per-request allowance. */
export function estimateJevTokens(state: unknown, questions: JevQuestions): number {
  const payload = JSON.stringify({ state, questions });
  // ~4 characters per token is the conventional English estimate.
  return Math.ceil(payload.length / 4);
}

export function exceedsJevTokenBudget(state: unknown, questions: JevQuestions): boolean {
  return estimateJevTokens(state, questions) > JEV_MAX_STATE_TOKENS;
}

/** Minimal smoke input used by the drawer's connection test; contains no chat. */
export function buildJevSmokeRequest(): { state: DecisionState; questions: JevQuestions } {
  return {
    state: "A storm rolls in over the harbour.",
    questions: {
      connectivity: {
        type: "noul",
        instructions: "Does this statement describe a storm?",
        criteria: {
          true: "The statement mentions a storm, tempest, thunder, or violent weather",
          false: "The statement mentions anything else",
        },
      },
    },
  };
}
