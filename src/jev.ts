/**
 * Provider-neutral client for TypeSafe System One ("Jev") models.
 *
 * Jev is not a chat model: it takes one `state` plus a map of typed questions and
 * returns one typed answer per question. It never generates prose, holds no
 * conversation, and does not stream. Every question in a request is evaluated in
 * parallel against the same state, which is why LumiWorld batches a whole phase
 * into a single round trip.
 *
 * The verified wire contract (identical for TypeSafe and OpenRouter apart from
 * the base URL, route, and model naming):
 *
 *   POST {base}/v1/systemone            (TypeSafe)
 *   POST {base}/alpha/decisions         (OpenRouter)
 *   Authorization: Bearer <key>
 *   { "model": "...", "state": <string|object|array>, "questions": { id: Question } }
 *
 * Answers come back under the caller's question ids:
 *   noul   -> { type: "noul",   noul: 0..1 }                       (no confidence field)
 *   choice -> { type: "choice", choice, probabilities, confidence }
 *   score  -> { type: "score",  score, legend, probabilities, confidence }
 */

import {
  DEFAULT_JEV_TIMEOUT_MS,
  DEFAULT_JEV_STATE_CHARS,
  JEV_MAX_STATE_TOKENS,
  MAX_JEV_HISTORY_MESSAGES,
  resolveJevBaseUrl,
  resolveJevModel,
  resolveJevProvider,
  serializeMessageContent,
  type JevPrimitive,
  type JevSettings,
  type LlmMessageLike,
} from "./shared";

export class JevError extends Error {
  constructor(message: string, readonly status: number | null = null, readonly retryAfterMs: number | null = null) {
    super(message);
    this.name = "JevError";
  }
}

export class JevTimeoutError extends Error {
  constructor(timeoutMs: number) {
    super(`Jev did not answer within ${Math.round(timeoutMs / 1000)}s.`);
    this.name = "JevTimeoutError";
  }
}

export class JevProtocolError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "JevProtocolError";
  }
}

export interface JevQuestion {
  type: JevPrimitive;
  instructions: string;
  criteria?: unknown;
}

export type JevQuestions = Record<string, JevQuestion>;

export interface JevRequest {
  url: string;
  headers: Record<string, string>;
  body: string;
  model: string;
}

export interface JevNoulAnswer {
  type: "noul";
  noul: number;
}

export interface JevChoiceAnswer {
  type: "choice";
  choice: string;
  probabilities: Record<string, number>;
  confidence: number | null;
}

export interface JevScoreAnswer {
  type: "score";
  score: number;
  legend: Record<string, string>;
  probabilities: Record<string, number>;
  confidence: number | null;
}

export type JevAnswer = JevNoulAnswer | JevChoiceAnswer | JevScoreAnswer;

export interface JevUsage {
  inputTokens: number | null;
  outputTokens: number | null;
  costUsd: number | null;
}

export interface JevResponse {
  /** Versioned model id the provider reported as the actual responder. */
  model: string | null;
  usage: JevUsage;
  answers: Record<string, JevAnswer>;
}

/* ------------------------------------------------------------------ *
 * CORS proxy response handling
 * ------------------------------------------------------------------ */

export interface JevCorsResult {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  body: string;
}

/**
 * `spindle.cors` is typed as `Promise<unknown>` because the host may return text
 * or a transparent binary envelope. Jev is always JSON text, so narrow once here.
 */
export function readCorsResult(raw: unknown): JevCorsResult {
  if (raw == null) throw new JevProtocolError("Jev request returned no response.");
  if (typeof raw === "string") return { status: 200, statusText: "OK", headers: {}, body: raw };
  if (typeof raw !== "object") throw new JevProtocolError("Jev request returned an unrecognized response.");
  const obj = raw as Record<string, unknown>;
  const body = typeof obj.body === "string" ? obj.body : typeof obj.text === "string" ? obj.text : "";
  const status = typeof obj.status === "number" && Number.isFinite(obj.status) ? obj.status : 200;
  const statusText = typeof obj.statusText === "string" ? obj.statusText : "";
  const headers = obj.headers && typeof obj.headers === "object" && !Array.isArray(obj.headers)
    ? (obj.headers as Record<string, string>)
    : {};
  return { status, statusText, headers, body };
}

function parseRetryAfterMs(headers: Record<string, string>): number | null {
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() !== "retry-after") continue;
    const seconds = Number(value);
    if (Number.isFinite(seconds) && seconds >= 0) return Math.min(30_000, seconds * 1000);
    const date = Date.parse(value);
    if (Number.isFinite(date)) return Math.min(30_000, Math.max(0, date - Date.now()));
  }
  return null;
}

function describeHttpFailure(result: JevCorsResult): string {
  const detail = result.body.replace(/\s+/g, " ").trim().slice(0, 240);
  const label = `HTTP ${result.status}${result.statusText ? ` ${result.statusText}` : ""}`;
  return detail ? `Jev request failed (${label}): ${detail}` : `Jev request failed (${label}).`;
}

/* ------------------------------------------------------------------ *
 * Request building
 * ------------------------------------------------------------------ */

export interface JevCallConfig extends JevSettings {
  apiKey: string;
}

export function jevEndpoint(settings: Pick<JevSettings, "provider" | "baseUrlOverride" | "model">): string {
  const provider = resolveJevProvider(settings);
  return `${resolveJevBaseUrl(settings)}${provider.path}`;
}

export function buildJevRequest(
  settings: Pick<JevSettings, "provider" | "baseUrlOverride" | "model"> & { apiKey: string },
  state: unknown,
  questions: JevQuestions,
): JevRequest {
  const model = resolveJevModel(settings);
  return {
    url: jevEndpoint(settings),
    headers: {
      Authorization: `Bearer ${settings.apiKey}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ model, state, questions }),
    model,
  };
}

/* ------------------------------------------------------------------ *
 * Response normalization
 * ------------------------------------------------------------------ */

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function readProbability(value: unknown): number | null {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.min(1, Math.max(0, n));
}

function readProbabilityMap(value: unknown): Record<string, number> {
  const obj = asRecord(value);
  const out: Record<string, number> = {};
  for (const [key, raw] of Object.entries(obj)) {
    const probability = readProbability(raw);
    if (probability !== null) out[key] = probability;
  }
  return out;
}

function readStringMap(value: unknown): Record<string, string> {
  const obj = asRecord(value);
  const out: Record<string, string> = {};
  for (const [key, raw] of Object.entries(obj)) {
    if (typeof raw === "string" && raw.trim()) out[key] = raw;
  }
  return out;
}

function normalizeAnswer(value: unknown): JevAnswer | null {
  const obj = asRecord(value);
  const type = typeof obj.type === "string" ? obj.type : "";

  if (type === "noul") {
    const noul = readProbability(obj.noul);
    return noul === null ? null : { type: "noul", noul };
  }
  if (type === "choice") {
    const choice = typeof obj.choice === "string" ? obj.choice : "";
    if (!choice.trim()) return null;
    return {
      type: "choice",
      choice: choice.trim(),
      probabilities: readProbabilityMap(obj.probabilities),
      confidence: readProbability(obj.confidence),
    };
  }
  if (type === "score") {
    const score = typeof obj.score === "number" ? obj.score : Number(obj.score);
    if (!Number.isFinite(score)) return null;
    return {
      type: "score",
      score,
      legend: readStringMap(obj.legend),
      probabilities: readProbabilityMap(obj.probabilities),
      confidence: readProbability(obj.confidence),
    };
  }
  return null;
}

/**
 * Normalizes the provider envelope. Individual malformed answers are dropped
 * rather than failing the whole turn: the gate that owned the answer falls back.
 */
export function normalizeJevResponse(raw: unknown): JevResponse {
  const envelope = asRecord(raw);
  if (Object.keys(envelope).length === 0) {
    throw new JevProtocolError("Jev returned a response that was not a JSON object.");
  }
  if (envelope.error) {
    const message = typeof envelope.error === "string" ? envelope.error : JSON.stringify(envelope.error);
    throw new JevProtocolError(`Jev reported an error: ${message.slice(0, 240)}`);
  }

  const answersRecord = asRecord(envelope.answers);
  if (Object.keys(answersRecord).length === 0) {
    throw new JevProtocolError("Jev returned no answers.");
  }

  const answers: Record<string, JevAnswer> = {};
  for (const [id, value] of Object.entries(answersRecord)) {
    const answer = normalizeAnswer(value);
    if (answer) answers[id] = answer;
  }

  const usage = asRecord(envelope.usage);
  const nullableNumber = (value: unknown): number | null => {
    const n = typeof value === "number" ? value : Number(value);
    return Number.isFinite(n) ? n : null;
  };

  return {
    model: typeof envelope.model === "string" && envelope.model.trim() ? envelope.model.trim() : null,
    usage: {
      inputTokens: nullableNumber(usage.input_tokens ?? usage.inputTokens),
      outputTokens: nullableNumber(usage.output_tokens ?? usage.outputTokens),
      costUsd: nullableNumber(usage.cost ?? usage.cost_usd ?? usage.costUsd),
    },
    answers,
  };
}

export function parseJevBody(body: string): unknown {
  const text = body.trim();
  if (!text) throw new JevProtocolError("Jev returned an empty response body.");
  try {
    return JSON.parse(text);
  } catch {
    throw new JevProtocolError("Jev returned a response body that was not valid JSON.");
  }
}

/* ------------------------------------------------------------------ *
 * Transport
 * ------------------------------------------------------------------ */

export type CorsFetch = (url: string, options?: unknown) => Promise<unknown>;

export interface CallJevOptions {
  config: JevCallConfig;
  state: unknown;
  questions: JevQuestions;
  /** Called when Jev answers at least one question. */
  cors: CorsFetch;
  signal?: AbortSignal;
  /** Total wall clock available for this phase, including retries. */
  budgetMs?: number;
  timeoutMs?: number;
  retryOnRateLimit?: boolean;
}

export interface CallJevResult {
  ok: boolean;
  response: JevResponse | null;
  error: string | null;
  timedOut: boolean;
  requests: number;
  durationMs: number;
  request: JevRequest | null;
}

function remainingBudgetMs(startedAt: number, budgetMs: number | undefined): number {
  if (budgetMs === undefined) return Number.POSITIVE_INFINITY;
  return budgetMs - (Date.now() - startedAt);
}

/**
 * Makes one Jev call, retrying once on a rate limit or transient server error.
 *
 * Jev has no streaming mode, so this awaits the single response. Failures are
 * returned rather than thrown: every caller degrades to Director-only behavior.
 */
export async function callJev(options: CallJevOptions): Promise<CallJevResult> {
  const startedAt = Date.now();
  const timeoutMs = options.timeoutMs ?? options.config.timeoutMs ?? DEFAULT_JEV_TIMEOUT_MS;
  const request = buildJevRequest(options.config, options.state, options.questions);
  let requests = 0;

  const attempt = async (): Promise<{ response: JevResponse } | { retryAfterMs: number | null; error: JevError }> => {
    requests += 1;
    const local = new AbortController();
    let timedOut = false;
    const onAbort = () => local.abort();
    options.signal?.addEventListener("abort", onAbort, { once: true });
    const budget = remainingBudgetMs(startedAt, options.budgetMs);
    const effective = Math.max(250, Math.min(timeoutMs, Number.isFinite(budget) ? budget : timeoutMs));
    const timer = setTimeout(() => {
      timedOut = true;
      local.abort();
    }, effective);

    try {
      const raw = await options.cors(request.url, {
        method: "POST",
        headers: request.headers,
        body: request.body,
        signal: local.signal,
      });
      const result = readCorsResult(raw);
      if (result.status === 429 || result.status >= 500) {
        return {
          retryAfterMs: parseRetryAfterMs(result.headers),
          error: new JevError(describeHttpFailure(result), result.status, parseRetryAfterMs(result.headers)),
        };
      }
      if (result.status < 200 || result.status >= 300) {
        throw new JevError(describeHttpFailure(result), result.status);
      }
      return { response: normalizeJevResponse(parseJevBody(result.body)) };
    } catch (error) {
      if (error instanceof JevError) throw error;
      if (timedOut || (error instanceof Error && error.name === "AbortError")) {
        throw new JevTimeoutError(effective);
      }
      throw new JevError(error instanceof Error ? error.message : String(error));
    } finally {
      clearTimeout(timer);
      options.signal?.removeEventListener("abort", onAbort);
    }
  };

  const retryable = options.retryOnRateLimit ?? options.config.retryOnRateLimit ?? true;
  try {
    let outcome: { response: JevResponse } | { retryAfterMs: number | null; error: JevError };
    try {
      outcome = await attempt();
    } catch (error) {
      return {
        ok: false,
        response: null,
        error: error instanceof Error ? error.message : String(error),
        timedOut: error instanceof JevTimeoutError,
        requests,
        durationMs: Date.now() - startedAt,
        request,
      };
    }

    if ("error" in outcome) {
      const waitMs = outcome.retryAfterMs ?? 750;
      const budgetLeft = remainingBudgetMs(startedAt, options.budgetMs);
      const canRetry = retryable && waitMs + 250 < budgetLeft && waitMs + 250 < timeoutMs * 2;
      if (!canRetry) {
        return {
          ok: false,
          response: null,
          error: outcome.error.message,
          timedOut: false,
          requests,
          durationMs: Date.now() - startedAt,
          request,
        };
      }
      await new Promise((resolve) => setTimeout(resolve, waitMs));
      try {
        const retry = await attempt();
        if ("error" in retry) {
          return {
            ok: false,
            response: null,
            error: retry.error.message,
            timedOut: false,
            requests,
            durationMs: Date.now() - startedAt,
            request,
          };
        }
        return { ok: true, response: retry.response, error: null, timedOut: false, requests, durationMs: Date.now() - startedAt, request };
      } catch (error) {
        return {
          ok: false,
          response: null,
          error: error instanceof Error ? error.message : String(error),
          timedOut: error instanceof JevTimeoutError,
          requests,
          durationMs: Date.now() - startedAt,
          request,
        };
      }
    }

    return { ok: true, response: outcome.response, error: null, timedOut: false, requests, durationMs: Date.now() - startedAt, request };
  } catch (error) {
    return {
      ok: false,
      response: null,
      error: error instanceof Error ? error.message : String(error),
      timedOut: error instanceof JevTimeoutError,
      requests,
      durationMs: Date.now() - startedAt,
      request,
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
  personaSummary?: string | null;
  characterSummary?: string | null;
  worldInfoSummary?: string | null;
  directorNotes?: string | null;
  worldState?: unknown;
  /** Draft directive, only for the verification phase. */
  draftDirective?: string | null;
}

export interface JevStateProjection {
  state: unknown;
  chars: number;
  compacted: boolean;
}

function truncate(value: string, budget: number): string {
  const text = value.trim();
  if (budget <= 0) return "";
  if (text.length <= budget) return text;
  return `${text.slice(0, Math.max(0, budget - 24)).trimEnd()}\n[... truncated ...]`;
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
    if (used + line.length > budget && kept.length > 0) break;
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
export function buildJevState(context: JevStateContext, worldStateContext?: string | null): JevStateProjection {
  const cap = Math.max(500, context.settings.maxStateChars || DEFAULT_JEV_STATE_CHARS);
  const historyLimit = Math.max(0, Math.min(context.settings.historyMessageLimit, MAX_JEV_HISTORY_MESSAGES));

  const fixed: Record<string, unknown> = {
    generation_type: context.generationType || "normal",
  };
  const structured: Record<string, unknown> = {};
  const addStructured = (key: string, value: string | null | undefined, budget: number): void => {
    const text = typeof value === "string" ? value.trim() : "";
    if (!text) return;
    structured[key] = truncate(text, budget);
  };

  addStructured("character", context.characterSummary, 4000);
  addStructured("user_persona", context.personaSummary, 2000);
  addStructured("world_info", context.worldInfoSummary, 6000);
  addStructured("director_notes", context.directorNotes, 1200);
  addStructured("scene_state", typeof worldStateContext === "string" ? worldStateContext : undefined, 3000);
  addStructured("draft_directive", context.draftDirective, 2500);

  let state: Record<string, unknown> = { ...fixed, ...structured };
  let history = renderHistory(context.history, historyLimit, Math.max(1000, Math.floor(cap * 0.5)));
  if (history.length) state.chat_history = history;

  let chars = JSON.stringify(state).length;
  let compacted = false;

  // Compact oldest context first: history budget, then the long summaries.
  while (chars > cap && (history.length > 1 || structured.world_info || structured.character)) {
    compacted = true;
    if (history.length > 1) {
      history = history.slice(Math.ceil(history.length / 4));
      state.chat_history = history;
    } else if (structured.world_info) {
      delete structured.world_info;
    } else if (structured.character) {
      delete structured.character;
    } else {
      break;
    }
    state = { ...fixed, ...structured };
    if (history.length) state.chat_history = history;
    chars = JSON.stringify(state).length;
  }

  if (chars > cap) {
    compacted = true;
    // Last resort: hard-truncate the serialized history, the largest remaining field.
    if (history.length) {
      state.chat_history = renderHistory(context.history, 2, Math.max(500, Math.floor(cap * 0.3)));
    }
    chars = JSON.stringify(state).length;
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

/** Minimal smoke question used by the drawer's "Test Jev" action. */
export function buildJevSmokeRequest(
  settings: Pick<JevSettings, "provider" | "baseUrlOverride" | "model"> & { apiKey: string },
): { request: JevRequest; questions: JevQuestions } {
  const questions: JevQuestions = {
    connectivity: {
      type: "noul",
      instructions: "Does this statement describe a storm?",
      criteria: {
        true: "The statement mentions a storm, tempest, thunder, or violent weather",
        false: "The statement mentions anything else",
      },
    },
  };
  return { request: buildJevRequest(settings, "A storm rolls in over the harbour.", questions), questions };
}
