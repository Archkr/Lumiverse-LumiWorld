export const EXTENSION_ID = "agent_world";
export const EXTENSION_NAME = "LumiWorld";
export const BREAKDOWN_NAME = "LumiWorld Director";
export const VISIBLE_GENERATION_TYPES = [
  "normal",
  "continue",
  "regenerate",
  "swipe",
  "impersonate",
] as const;

export type LumiWorldGenerationType = (typeof VISIBLE_GENERATION_TYPES)[number];
export type MessageRole = "system" | "user" | "assistant";

export type LlmMessagePartLike =
  | { type: "text"; text: string }
  | { type: "image"; data?: string; mime_type?: string }
  | { type: "audio"; data?: string; mime_type?: string }
  | { type: "tool_use"; id?: string; name?: string; input?: Record<string, unknown> }
  | { type: "tool_result"; tool_use_id?: string; content?: string; is_error?: boolean };

export interface LlmMessageLike {
  role: MessageRole;
  content: string | LlmMessagePartLike[];
  name?: string;
  [key: string]: unknown;
}

export interface LumiWorldSettings {
  enabled: boolean;
  connectionId: string | null;
  modelOverride: string;
  /**
   * Optional escalation target used when Jev's `model_route` gate asks for a
   * stronger Director. Both blank/empty keeps the normal target, which makes the
   * gate degrade safely on a fresh install.
   */
  strongConnectionId: string | null;
  strongModelOverride: string;
  temperature: number;
  maxTokens: number;
  timeoutMs: number;
  maxInputChars: number;
  historyMessageLimit: number;
  includeWorldInfoEntries: boolean;
  includeUserPersona: boolean;
  includeCharacter: boolean;
  generationTypes: LumiWorldGenerationType[];
  additionalNotes: string;
  systemTemplate: string;
  userTemplate: string;
  runLogLimit: number;
  jev: JevSettings;
}

/* ------------------------------------------------------------------ *
 * Jev (TypeSafe System One) integration
 * ------------------------------------------------------------------ */

export type JevProvider = "typesafe" | "openrouter";

export interface JevProviderInfo {
  id: JevProvider;
  label: string;
  baseUrl: string;
  path: string;
  defaultModel: string;
  keyUrl: string;
}

/**
 * The Jev wire contract is identical for both providers except for the base
 * URL, the route, and the model naming convention.
 */
export const JEV_PROVIDERS: Record<JevProvider, JevProviderInfo> = {
  typesafe: {
    id: "typesafe",
    label: "TypeSafe",
    baseUrl: "https://api.typesafe.ai",
    path: "/v1/systemone",
    defaultModel: "jev-latest",
    keyUrl: "https://console.typesafe.ai/keys",
  },
  openrouter: {
    id: "openrouter",
    label: "OpenRouter",
    baseUrl: "https://openrouter.ai/api",
    path: "/alpha/decisions",
    defaultModel: "typesafe/jev-1.13",
    keyUrl: "https://openrouter.ai/settings/keys",
  },
};

export const JEV_PROVIDER_IDS = ["typesafe", "openrouter"] as const;

/**
 * Enclave is per-user AES-256-GCM at-rest secret storage. One slot per provider
 * so switching providers never destroys the other credential.
 */
export const JEV_SECRET_KEY_PREFIX = "jev-api-key";

/**
 * The host rejects any enclave key outside this set, so a separator like `:` is
 * refused outright. Kept here rather than in the backend so the constraint is
 * testable without a host. Mirror of `ENCLAVE_KEY_PATTERN` in Lumiverse.
 */
export const ENCLAVE_KEY_PATTERN = /^[a-zA-Z0-9_.-]{1,128}$/;

export function jevSecretKey(provider: JevProvider): string {
  const key = `${JEV_SECRET_KEY_PREFIX}.${provider}`;
  // A key the host will reject would fail every read and write silently, so this
  // is asserted at construction rather than discovered at runtime.
  if (!ENCLAVE_KEY_PATTERN.test(key)) {
    throw new Error(`Jev enclave key "${key}" is not a valid enclave key.`);
  }
  return key;
}

/** Jev reports 64k tokens per request, of which the `state` may use 32k. */
export const JEV_MAX_STATE_TOKENS = 32_000;
export const DEFAULT_JEV_STATE_CHARS = 30_000;
export const MIN_JEV_STATE_CHARS = 2_000;
export const MAX_JEV_STATE_CHARS = 32_000;
export const DEFAULT_JEV_TIMEOUT_MS = 8_000;
export const MIN_JEV_TIMEOUT_MS = 1_000;
export const MAX_JEV_TIMEOUT_MS = 60_000;
export const MAX_JEV_HISTORY_MESSAGES = 24;
export const DEFAULT_JEV_MIN_CONFIDENCE = 0.55;

export interface JevSettings {
  enabled: boolean;
  provider: JevProvider;
  /** Context sent to Jev, independently of the Director's context switches. */
  includeCharacter: boolean;
  includeUserPersona: boolean;
  includeWorldInfoEntries: boolean;
  /** Blank means "use the provider default model". */
  model: string;
  /** Blank means "use the provider default base URL". */
  baseUrlOverride: string;
  timeoutMs: number;
  maxStateChars: number;
  historyMessageLimit: number;
  /** Decisions below this confidence are escalated (flag + gate fallback). */
  minConfidence: number;
  retryOnRateLimit: boolean;
  /** Opt-in persistence of the derived scene state between turns. */
  worldStateEnabled: boolean;
  /** Per-gate enable / threshold / fallback overrides, keyed by gate id. */
  gatePolicy: Record<string, GatePolicy>;
}

export const DEFAULT_JEV_SETTINGS: JevSettings = {
  enabled: false,
  provider: "typesafe",
  includeCharacter: true,
  includeUserPersona: true,
  includeWorldInfoEntries: false,
  model: "",
  baseUrlOverride: "",
  timeoutMs: DEFAULT_JEV_TIMEOUT_MS,
  maxStateChars: DEFAULT_JEV_STATE_CHARS,
  historyMessageLimit: 10,
  minConfidence: DEFAULT_JEV_MIN_CONFIDENCE,
  retryOnRateLimit: true,
  worldStateEnabled: true,
  gatePolicy: {},
};

export function resolveJevProvider(settings: { provider?: unknown }): JevProviderInfo {
  const provider = settings.provider === "openrouter" ? "openrouter" : "typesafe";
  return JEV_PROVIDERS[provider];
}

export function resolveJevModel(settings: { provider?: unknown; model?: unknown }): string {
  const model = typeof settings.model === "string" ? settings.model.trim() : "";
  return model || resolveJevProvider(settings).defaultModel;
}

export function resolveJevBaseUrl(settings: { provider?: unknown; baseUrlOverride?: unknown }): string {
  const override = typeof settings.baseUrlOverride === "string" ? settings.baseUrlOverride.trim().replace(/\/+$/, "") : "";
  return override || resolveJevProvider(settings).baseUrl;
}

/* ------------------------------------------------------------------ *
 * Gate catalog types
 * ------------------------------------------------------------------ */

export type JevPrimitive = "noul" | "choice" | "score";

/** Which Jev round-trip a gate belongs to. Each phase is one batched request. */
export type GatePhase = "gate" | "verify";

export type GateCategory = "director_control" | "guardrails" | "state_accuracy" | "narrative" | "world";

export type GateFallback =
  | "run"
  | "skip"
  | "accept"
  | "retry"
  | "patch"
  | "soften"
  | "drop"
  | "hold"
  | "none"
  | "ignore";

export type GateValue = string | number | boolean;

export interface GatePolicyOverride {
  enabled?: boolean;
  threshold?: number;
  fallback?: GateFallback;
}

export type GatePolicy = GatePolicyOverride;

export type GateCriteria = Record<string, string> | string[] | { true: string; false: string };

export interface GateDefinition {
  /** Doubles as the Jev question id: answers return under this exact key. */
  id: string;
  label: string;
  /** Shape of the question sent to Jev and the shape of the answer returned. */
  primitive: JevPrimitive;
  phase: GatePhase;
  category: GateCategory;
  primitiveLabel: string;
  /** Options for Choice, ordered levels for Score, true/false wording for Noul. */
  criteria?: GateCriteria;
  instructions: string;
  /**
   * What the gate asks for in plain language. Jev returns only a typed value and
   * probabilities, never prose, so there is no model-authored rationale to store.
   */
  rationale: string;
  enabledByDefault: boolean;
  threshold: number;
  fallback: GateFallback;
  /** Value that means "the Director should run" for this gate. */
  safeValue: GateValue;
  /** Value that means "the Director should not run" for this gate. */
  blockValue: GateValue;
  /** Gate only applies when this condition holds for the current turn. */
  appliesWhen?: string;
  /** Evaluated in code from thresholds and request state, not sent to Jev. */
  codeOnly?: boolean;
}

/** A gate policy with every field filled in, ready to be applied. */
export interface ResolvedGatePolicy extends GatePolicy {
  enabled: boolean;
  threshold: number;
  fallback: GateFallback;
  definition: GateDefinition;
}

export interface JevGateRecord {
  gateId: string;
  label: string;
  primitive: JevPrimitive;
  phase: GatePhase;
  /** Raw typed answer from Jev, or null when the gate had no answer. */
  value: GateValue | null;
  probability: number | null;
  /** Choice/Score report confidence; Noul confidence is derived from p and flagged. */
  confidence: number | null;
  confidenceDerived: boolean;
  threshold: number;
  escalated: boolean;
  usedFallback: boolean;
  fallback: GateFallback;
  /** Full reported distribution, kept for the diagnostics view. */
  probabilities?: Record<string, number>;
  note?: string;
}

export interface JevTurnDiagnostics {
  /** Whether Jev was consulted at all this turn. */
  used: boolean;
  enabled: boolean;
  provider: JevProvider | null;
  model: string | null;
  /** Model id the provider reported as the actual responder. */
  resolvedModel: string | null;
  /** "ok" when every phase answered, otherwise the degradation reason. */
  status: "ok" | "degraded" | "skipped";
  error: string | null;
  requestCount: number;
  inputTokens: number | null;
  outputTokens: number | null;
  costUsd: number | null;
  gatePhaseMs: number | null;
  verifyPhaseMs: number | null;
  gateCount: number;
  fallbackCount: number;
  escalatedCount: number;
  stateChars: number;
  /** True when the state had to be compacted to fit the configured cap. */
  stateCompacted: boolean;
  gates: JevGateRecord[];
}

export interface ConnectionOption {
  id: string;
  name: string;
  provider: string;
  model: string;
  isDefault: boolean;
  hasApiKey: boolean;
}

export interface ConnectionLike extends ConnectionOption {
  api_url?: string;
}

export type RunLogStatus = "success" | "error" | "timeout" | "skipped" | "test_success" | "test_error";

export interface RunLogEntry {
  id: string;
  timestamp: number;
  status: RunLogStatus;
  channel?: "director" | "world_agent" | null;
  action?: string | null;
  generationType?: string | null;
  durationMs?: number | null;
  connectionId?: string | null;
  connectionName?: string | null;
  model?: string | null;
  directivePreview?: string | null;
  error?: string | null;
  worldInfoActivatedCount?: number | null;
  worldInfoFetchedCount?: number | null;
  worldInfoFallbackTaggedCount?: number | null;
  worldInfoFetchError?: string | null;
  /** Jev gate diagnostics for this turn. Absent when Jev was not consulted. */
  jev?: JevTurnDiagnostics | null;
}

export interface PromptSnapshot {
  prompt: string;
  truncated: boolean;
  originalChars: number;
  includedChars: number;
  messageCount: number;
}

export interface ActivatedWorldInfoLike {
  id: string;
  comment?: string;
  keys?: string[];
  source?: string;
  score?: number;
  bookId?: string;
  bookSource?: string;
}

export interface WorldInfoEntryLike {
  id: string;
  content: string;
  comment?: string;
  role?: string | null;
  key?: string[];
  world_book_id?: string;
}

export interface WorldInfoContextDiagnostics {
  activatedEntryCount: number;
  fetchedEntryCount: number;
  fallbackTaggedEntryCount: number;
  fetchError: string | null;
}

export interface WorldInfoContextResult {
  messages: LlmMessageLike[];
  diagnostics: WorldInfoContextDiagnostics;
}

export interface ControllerTemplateContext {
  prompt: string;
  generationType: string;
  chatId: string;
  connectionId: string;
  timestamp: string;
  maxDirectiveChars: string;
  additionalNotes: string;
  user: string;
  char: string;
}

export interface IdentityMacroValues {
  userName?: string | null;
  characterName?: string | null;
}

export interface NormalizedIdentityMacroValues {
  userName: string;
  characterName: string;
}

export interface ControllerTarget {
  ok: true;
  connectionId: string;
  connectionName: string;
  provider: string;
  model: string;
}

export interface ControllerTargetError {
  ok: false;
  reason: string;
}

export type ControllerTargetResult = ControllerTarget | ControllerTargetError;

export const MAX_DIRECTIVE_CHARS = 2200;
export const MAX_CONTROLLER_OUTPUT_TOKENS = Number.MAX_SAFE_INTEGER;
// Lumiverse clamps prompt interceptor work to five minutes.
export const MAX_DIRECTOR_TIMEOUT_MS = 300_000;
export const MAX_CONTROLLER_TIMEOUT_MS = 2_147_483_647;
export const MAX_CHAT_HISTORY_MESSAGES = Number.MAX_SAFE_INTEGER;
export const DEFAULT_RUN_LOG_LIMIT = 12;
export const DEFAULT_HISTORY_MESSAGE_LIMIT = 12;
export const CONTROLLER_CONTEXT_LABEL_KEY = "__lumiWorldContextLabel";

export class KeyedOperationLock {
  private readonly keys = new Set<string>();

  acquire(key: string): boolean {
    if (this.keys.has(key)) return false;
    this.keys.add(key);
    return true;
  }

  release(key: string): void {
    this.keys.delete(key);
  }

  has(key: string): boolean {
    return this.keys.has(key);
  }
}

export const LEGACY_DEFAULT_SYSTEM_TEMPLATE = [
  "You are AgentWorld, a private world-simulation director for an interactive Lumiverse chat.",
  "Your job is to decide how the world, scene, NPCs, hidden pressures, and immediate consequences should react before the main roleplay model writes the visible reply.",
  "Do not write the assistant reply. Do not address the user. Do not reveal this control step.",
  "Return only a concise director note for the main model. Prefer JSON like {\"director_note\":\"...\"}, but plain text is acceptable.",
  "Keep the note concrete, playable, and consistent with the assembled prompt.",
].join("\n");

export const LEGACY_DEFAULT_USER_TEMPLATE = [
  "Generation type: {{generationType}}",
  "Chat ID: {{chatId}}",
  "",
  "Final assembled prompt that will be sent to the main model:",
  "<assembled_prompt>",
  "{{prompt}}",
  "</assembled_prompt>",
  "",
  "Decide how the world should react now. Focus on state changes, environmental pressure, NPC intent, consequences, and what the main model should respect next.",
  "Return one private director note under {{maxDirectiveChars}} characters.",
].join("\n");

export const PREVIOUS_DEFAULT_SYSTEM_TEMPLATE = [
  "You are AgentWorld, a private world-simulation director for an interactive Lumiverse chat.",
  "Your job is to decide how the world, scene, NPCs, hidden pressures, and immediate consequences should react before the main roleplay model writes the visible reply.",
  "Do not write the assistant reply. Do not address the user. Do not reveal this control step.",
  "Return only a concise director note for the main model. Prefer JSON like {\"director_note\":\"...\"}, but plain text is acceptable.",
  "Keep the note concrete, playable, and consistent with the recent chat history and any additional notes.",
].join("\n");

export const PREVIOUS_DEFAULT_USER_TEMPLATE = [
  "Generation type: {{generationType}}",
  "Chat ID: {{chatId}}",
  "",
  "Recent chat history available to the controller:",
  "<chat_history>",
  "{{prompt}}",
  "</chat_history>",
  "",
  "Decide how the world should react now. Focus on state changes, environmental pressure, NPC intent, consequences, and what the main model should respect next.",
  "Return one private director note under {{maxDirectiveChars}} characters.",
].join("\n");

export const PRE_REBRAND_DEFAULT_SYSTEM_TEMPLATE = [
  "You are AgentWorld, a private world-state director for an interactive Lumiverse chat.",
  "",
  "Your job is to advance the world behind the next visible reply.",
  "",
  "Do not recap what already happened. Do not restate recent dialogue. Do not explain lore. Do not open with character names or summaries.",
  "",
  "Write only the next world-state directive:",
  "- what changes in the environment, situation, systems, factions, observers, or hidden risk",
  "- how that pressure forces NPCs to act now",
  "- what the main model should show in the next reply",
  "- what must remain unresolved or unrevealed",
  "",
  "Use imperative language. Start with a verb such as \"Make\", \"Let\", \"Have\", \"Keep\", \"Escalate\", \"Pressure\", or \"Treat\".",
  "",
  "The directive should feel like the world moving forward, not a recap of the scene.",
  "",
  "Return only one private directive for the next visible reply. Do not write the visible assistant reply. Do not address the user. Do not mention AgentWorld, the controller, this prompt, or the directive.",
  "",
  "Prefer JSON exactly like:",
  "{\"director_note\":\"...\"}",
  "",
  "Plain text is acceptable if needed. Keep it under {{maxDirectiveChars}} characters.",
].join("\n");

export const DEFAULT_SYSTEM_TEMPLATE = [
  "You are LumiWorld, a private world-state director for an interactive Lumiverse chat.",
  "",
  "Your job is to advance the world behind the next visible reply.",
  "",
  "Do not recap what already happened. Do not restate recent dialogue. Do not explain lore. Do not open with character names or summaries.",
  "",
  "Write only the next world-state directive:",
  "- what changes in the environment, situation, systems, factions, observers, or hidden risk",
  "- how that pressure forces NPCs to act now",
  "- what the main model should show in the next reply",
  "- what must remain unresolved or unrevealed",
  "",
  "Use imperative language. Start with a verb such as \"Make\", \"Let\", \"Have\", \"Keep\", \"Escalate\", \"Pressure\", or \"Treat\".",
  "",
  "The directive should feel like the world moving forward, not a recap of the scene.",
  "",
  "Return only one private directive for the next visible reply. Do not write the visible assistant reply. Do not address the user. Do not mention LumiWorld, the controller, this prompt, or the directive.",
  "",
  "Prefer JSON exactly like:",
  "{\"director_note\":\"...\"}",
  "",
  "Plain text is acceptable if needed. Keep it under {{maxDirectiveChars}} characters.",
].join("\n");

export const PRE_CONTEXT_DEFAULT_USER_TEMPLATE = [
  "Generation type: {{generationType}}",
  "",
  "Recent chat history:",
  "<chat_history>",
  "{{prompt}}",
  "</chat_history>",
  "",
  "Write the next world-state directive now.",
  "",
  "Start with a verb. No recap. No review. No explanation. No \"has just\" framing.",
].join("\n");

export const DEFAULT_USER_TEMPLATE = [
  "Generation type: {{generationType}}",
  "",
  "Controller context:",
  "<controller_context>",
  "{{prompt}}",
  "</controller_context>",
  "",
  "Write the next world-state directive now.",
  "",
  "Start with a verb. No recap. No review. No explanation. No \"has just\" framing.",
].join("\n");

export const DEFAULT_SETTINGS: LumiWorldSettings = {
  enabled: false,
  connectionId: null,
  modelOverride: "",
  strongConnectionId: null,
  strongModelOverride: "",
  temperature: 0.35,
  maxTokens: 420,
  timeoutMs: 45000,
  maxInputChars: 60000,
  historyMessageLimit: DEFAULT_HISTORY_MESSAGE_LIMIT,
  includeWorldInfoEntries: false,
  includeUserPersona: true,
  includeCharacter: true,
  generationTypes: [...VISIBLE_GENERATION_TYPES],
  additionalNotes: "",
  systemTemplate: DEFAULT_SYSTEM_TEMPLATE,
  userTemplate: DEFAULT_USER_TEMPLATE,
  runLogLimit: DEFAULT_RUN_LOG_LIMIT,
  jev: { ...DEFAULT_JEV_SETTINGS },
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function cleanString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value.trim() : fallback;
}

function cleanNullableString(value: unknown): string | null {
  const text = cleanString(value);
  return text ? text : null;
}

function numberInRange(value: unknown, fallback: number, min: number, max: number): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function integerInRange(value: unknown, fallback: number, min: number, max: number): number {
  return Math.round(numberInRange(value, fallback, min, max));
}

export function normalizeGenerationTypes(value: unknown): LumiWorldGenerationType[] {
  const incoming = Array.isArray(value) ? value : DEFAULT_SETTINGS.generationTypes;
  const allowed = new Set<string>(VISIBLE_GENERATION_TYPES);
  const normalized = incoming.filter((item): item is LumiWorldGenerationType => typeof item === "string" && allowed.has(item));
  return Array.isArray(value) ? [...new Set(normalized)] : [...DEFAULT_SETTINGS.generationTypes];
}

const GATE_FALLBACKS: readonly GateFallback[] = [
  "run", "skip", "accept", "retry", "patch", "soften", "drop", "hold", "none", "ignore",
];

function normalizeProbability(value: unknown): number | undefined {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return undefined;
  return Math.min(1, Math.max(0, n));
}

/**
 * Gate policy overrides are sparse: an unknown or malformed entry is dropped so a
 * corrupted settings file cannot disable a guardrail by accident.
 */
export function normalizeGatePolicy(value: unknown): Record<string, GatePolicy> {
  const obj = asRecord(value);
  const normalized: Record<string, GatePolicy> = {};
  for (const [gateId, raw] of Object.entries(obj)) {
    const id = gateId.trim();
    if (!id) continue;
    const entry = asRecord(raw);
    const policy: GatePolicy = {};
    if (typeof entry.enabled === "boolean") policy.enabled = entry.enabled;
    const threshold = normalizeProbability(entry.threshold);
    if (threshold !== undefined) policy.threshold = threshold;
    const fallback = cleanString(entry.fallback) as GateFallback;
    if (GATE_FALLBACKS.includes(fallback)) policy.fallback = fallback;
    if (Object.keys(policy).length > 0) normalized[id] = policy;
  }
  return normalized;
}

export function normalizeJevSettings(
  value: unknown,
  legacyContext: Pick<LumiWorldSettings, "includeCharacter" | "includeUserPersona" | "includeWorldInfoEntries"> = DEFAULT_SETTINGS,
): JevSettings {
  const obj = asRecord(value);
  const provider = cleanString(obj.provider) === "openrouter" ? "openrouter" : "typesafe";
  return {
    enabled: typeof obj.enabled === "boolean" ? obj.enabled : DEFAULT_JEV_SETTINGS.enabled,
    provider,
    includeCharacter: typeof obj.includeCharacter === "boolean" ? obj.includeCharacter : legacyContext.includeCharacter,
    includeUserPersona: typeof obj.includeUserPersona === "boolean" ? obj.includeUserPersona : legacyContext.includeUserPersona,
    includeWorldInfoEntries: typeof obj.includeWorldInfoEntries === "boolean" ? obj.includeWorldInfoEntries : legacyContext.includeWorldInfoEntries,
    model: cleanString(obj.model),
    baseUrlOverride: cleanString(obj.baseUrlOverride).replace(/\/+$/, ""),
    timeoutMs: integerInRange(obj.timeoutMs, DEFAULT_JEV_SETTINGS.timeoutMs, MIN_JEV_TIMEOUT_MS, MAX_JEV_TIMEOUT_MS),
    maxStateChars: integerInRange(obj.maxStateChars, DEFAULT_JEV_SETTINGS.maxStateChars, MIN_JEV_STATE_CHARS, MAX_JEV_STATE_CHARS),
    historyMessageLimit: integerInRange(obj.historyMessageLimit, DEFAULT_JEV_SETTINGS.historyMessageLimit, 0, MAX_JEV_HISTORY_MESSAGES),
    minConfidence: numberInRange(obj.minConfidence, DEFAULT_JEV_SETTINGS.minConfidence, 0, 1),
    retryOnRateLimit: typeof obj.retryOnRateLimit === "boolean" ? obj.retryOnRateLimit : DEFAULT_JEV_SETTINGS.retryOnRateLimit,
    worldStateEnabled: typeof obj.worldStateEnabled === "boolean" ? obj.worldStateEnabled : DEFAULT_JEV_SETTINGS.worldStateEnabled,
    gatePolicy: normalizeGatePolicy(obj.gatePolicy),
  };
}

const JEV_STATUSES: readonly JevTurnDiagnostics["status"][] = ["ok", "degraded", "skipped"];
const JEV_PRIMITIVES: readonly JevPrimitive[] = ["noul", "choice", "score"];
const JEV_PHASES: readonly GatePhase[] = ["gate", "verify"];

function normalizeGateValue(value: unknown): GateValue | null {
  if (typeof value === "string") return value.trim() || null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "boolean") return value;
  return null;
}

function normalizeProbabilityMap(value: unknown): Record<string, number> | undefined {
  const obj = asRecord(value);
  const entries = Object.entries(obj)
    .map(([key, raw]): [string, number] | null => {
      const probability = normalizeProbability(raw);
      return probability === undefined ? null : [key, probability];
    })
    .filter((entry): entry is [string, number] => entry !== null);
  return entries.length ? Object.fromEntries(entries) : undefined;
}

export function normalizeJevGateRecord(value: unknown): JevGateRecord | null {
  const obj = asRecord(value);
  const gateId = cleanString(obj.gateId);
  const primitive = cleanString(obj.primitive) as JevPrimitive;
  const phase = cleanString(obj.phase) as GatePhase;
  if (!gateId || !JEV_PRIMITIVES.includes(primitive) || !JEV_PHASES.includes(phase)) return null;
  const fallback = cleanString(obj.fallback) as GateFallback;
  const rawConfidence = normalizeProbability(obj.confidence);
  return {
    gateId,
    label: cleanString(obj.label) || gateId,
    primitive,
    phase,
    value: normalizeGateValue(obj.value),
    probability: normalizeProbability(obj.probability) ?? null,
    confidence: rawConfidence ?? null,
    confidenceDerived: obj.confidenceDerived === true,
    threshold: numberInRange(obj.threshold, 0, 0, 1),
    escalated: obj.escalated === true,
    usedFallback: obj.usedFallback === true,
    fallback: GATE_FALLBACKS.includes(fallback) ? fallback : "none",
    probabilities: normalizeProbabilityMap(obj.probabilities),
    note: cleanNullableString(obj.note) ?? undefined,
  };
}

export function normalizeJevTurnDiagnostics(value: unknown): JevTurnDiagnostics | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const obj = asRecord(value);
  const provider = cleanString(obj.provider);
  const status = cleanString(obj.status) as JevTurnDiagnostics["status"];
  // Non-numeric or negative counts are treated as absent rather than as zero.
  const nullableInt = (raw: unknown): number | null => {
    if (raw == null) return null;
    const n = typeof raw === "number" ? raw : Number(raw);
    if (!Number.isFinite(n) || n < 0) return null;
    return Math.min(Number.MAX_SAFE_INTEGER, Math.round(n));
  };
  const gates = (Array.isArray(obj.gates) ? obj.gates : [])
    .map(normalizeJevGateRecord)
    .filter((gate): gate is JevGateRecord => gate !== null);
  return {
    used: obj.used === true,
    enabled: obj.enabled === true,
    provider: provider === "typesafe" || provider === "openrouter" ? provider : null,
    model: cleanNullableString(obj.model),
    resolvedModel: cleanNullableString(obj.resolvedModel),
    status: JEV_STATUSES.includes(status) ? status : "skipped",
    error: cleanNullableString(obj.error),
    requestCount: integerInRange(obj.requestCount, gates.length > 0 ? 1 : 0, 0, 16),
    inputTokens: nullableInt(obj.inputTokens),
    outputTokens: nullableInt(obj.outputTokens),
    costUsd: typeof obj.costUsd === "number" && Number.isFinite(obj.costUsd) ? obj.costUsd : null,
    gatePhaseMs: nullableInt(obj.gatePhaseMs),
    verifyPhaseMs: nullableInt(obj.verifyPhaseMs),
    gateCount: integerInRange(obj.gateCount, gates.length, 0, Number.MAX_SAFE_INTEGER),
    fallbackCount: integerInRange(obj.fallbackCount, gates.filter((gate) => gate.usedFallback).length, 0, Number.MAX_SAFE_INTEGER),
    escalatedCount: integerInRange(obj.escalatedCount, gates.filter((gate) => gate.escalated).length, 0, Number.MAX_SAFE_INTEGER),
    stateChars: integerInRange(obj.stateChars, 0, 0, Number.MAX_SAFE_INTEGER),
    stateCompacted: obj.stateCompacted === true,
    gates,
  };
}

export function makeJevDiagnostics(patch: Partial<JevTurnDiagnostics> = {}): JevTurnDiagnostics {
  return {
    used: false,
    enabled: false,
    provider: null,
    model: null,
    resolvedModel: null,
    status: "skipped",
    error: null,
    requestCount: 0,
    inputTokens: null,
    outputTokens: null,
    costUsd: null,
    gatePhaseMs: null,
    verifyPhaseMs: null,
    gateCount: 0,
    fallbackCount: 0,
    escalatedCount: 0,
    stateChars: 0,
    stateCompacted: false,
    gates: [],
    ...patch,
  };
}

export function summarizeJevDiagnostics(diagnostics: JevTurnDiagnostics | null | undefined): string | null {
  if (!diagnostics || !diagnostics.used) return null;
  const parts = [
    `${diagnostics.gateCount} gate${diagnostics.gateCount === 1 ? "" : "s"}`,
    diagnostics.requestCount ? `${diagnostics.requestCount} Jev request${diagnostics.requestCount === 1 ? "" : "s"}` : null,
    diagnostics.fallbackCount ? `${diagnostics.fallbackCount} fallback${diagnostics.fallbackCount === 1 ? "" : "s"}` : null,
    diagnostics.escalatedCount ? `${diagnostics.escalatedCount} escalated` : null,
    diagnostics.status === "degraded" ? "degraded" : null,
  ].filter(Boolean);
  return parts.length ? parts.join(" · ") : null;
}

export function normalizeSettings(value: unknown): LumiWorldSettings {
  const obj = asRecord(value);
  const includeWorldInfoEntries = typeof obj.includeWorldInfoEntries === "boolean" ? obj.includeWorldInfoEntries : DEFAULT_SETTINGS.includeWorldInfoEntries;
  const includeUserPersona = typeof obj.includeUserPersona === "boolean" ? obj.includeUserPersona : DEFAULT_SETTINGS.includeUserPersona;
  const includeCharacter = typeof obj.includeCharacter === "boolean" ? obj.includeCharacter : DEFAULT_SETTINGS.includeCharacter;
  const storedSystemTemplate = cleanString(obj.systemTemplate, DEFAULT_SYSTEM_TEMPLATE);
  const storedUserTemplate = cleanString(obj.userTemplate, DEFAULT_USER_TEMPLATE);
  const systemTemplate =
    !storedSystemTemplate ||
    storedSystemTemplate === LEGACY_DEFAULT_SYSTEM_TEMPLATE ||
    storedSystemTemplate === PREVIOUS_DEFAULT_SYSTEM_TEMPLATE ||
    storedSystemTemplate === PRE_REBRAND_DEFAULT_SYSTEM_TEMPLATE
      ? DEFAULT_SYSTEM_TEMPLATE
      : storedSystemTemplate;
  const userTemplate =
    !storedUserTemplate ||
    storedUserTemplate === LEGACY_DEFAULT_USER_TEMPLATE ||
    storedUserTemplate === PREVIOUS_DEFAULT_USER_TEMPLATE ||
    storedUserTemplate === PRE_CONTEXT_DEFAULT_USER_TEMPLATE
      ? DEFAULT_USER_TEMPLATE
      : storedUserTemplate;

  return {
    enabled: typeof obj.enabled === "boolean" ? obj.enabled : DEFAULT_SETTINGS.enabled,
    connectionId: cleanNullableString(obj.connectionId),
    modelOverride: cleanString(obj.modelOverride),
    strongConnectionId: cleanNullableString(obj.strongConnectionId),
    strongModelOverride: cleanString(obj.strongModelOverride),
    temperature: numberInRange(obj.temperature, DEFAULT_SETTINGS.temperature, 0, 2),
    maxTokens: integerInRange(obj.maxTokens, DEFAULT_SETTINGS.maxTokens, 64, MAX_CONTROLLER_OUTPUT_TOKENS),
    timeoutMs: integerInRange(obj.timeoutMs, DEFAULT_SETTINGS.timeoutMs, 1000, MAX_DIRECTOR_TIMEOUT_MS),
    maxInputChars: integerInRange(obj.maxInputChars, DEFAULT_SETTINGS.maxInputChars, 4000, 500000),
    historyMessageLimit: integerInRange(obj.historyMessageLimit, DEFAULT_SETTINGS.historyMessageLimit, 0, MAX_CHAT_HISTORY_MESSAGES),
    includeWorldInfoEntries,
    includeUserPersona,
    includeCharacter,
    generationTypes: normalizeGenerationTypes(obj.generationTypes),
    additionalNotes: cleanString(obj.additionalNotes),
    systemTemplate,
    userTemplate,
    runLogLimit: integerInRange(obj.runLogLimit, DEFAULT_SETTINGS.runLogLimit, 0, 50),
    jev: normalizeJevSettings(obj.jev, obj.jev && typeof obj.jev === "object"
      ? { includeWorldInfoEntries, includeUserPersona, includeCharacter }
      : DEFAULT_SETTINGS),
  };
}

export function normalizeRunLog(value: unknown, limit = DEFAULT_RUN_LOG_LIMIT): RunLogEntry[] {
  if (!Array.isArray(value)) return [];
  const normalized = value
    .map((item): RunLogEntry | null => {
      const obj = asRecord(item);
      const id = cleanString(obj.id);
      const timestamp = numberInRange(obj.timestamp, 0, 0, Number.MAX_SAFE_INTEGER);
      const status = cleanString(obj.status) as RunLogStatus;
      if (!id || !timestamp || !["success", "error", "timeout", "skipped", "test_success", "test_error"].includes(status)) return null;
      const channel = cleanString(obj.channel);
      return {
        id,
        timestamp,
        status,
        channel: channel === "director" || channel === "world_agent" ? channel : null,
        action: cleanNullableString(obj.action),
        generationType: cleanNullableString(obj.generationType),
        durationMs: obj.durationMs == null ? null : numberInRange(obj.durationMs, 0, 0, Number.MAX_SAFE_INTEGER),
        connectionId: cleanNullableString(obj.connectionId),
        connectionName: cleanNullableString(obj.connectionName),
        model: cleanNullableString(obj.model),
        directivePreview: cleanNullableString(obj.directivePreview),
        error: cleanNullableString(obj.error),
        worldInfoActivatedCount: obj.worldInfoActivatedCount == null ? null : integerInRange(obj.worldInfoActivatedCount, 0, 0, Number.MAX_SAFE_INTEGER),
        worldInfoFetchedCount: obj.worldInfoFetchedCount == null ? null : integerInRange(obj.worldInfoFetchedCount, 0, 0, Number.MAX_SAFE_INTEGER),
        worldInfoFallbackTaggedCount: obj.worldInfoFallbackTaggedCount == null ? null : integerInRange(obj.worldInfoFallbackTaggedCount, 0, 0, Number.MAX_SAFE_INTEGER),
        worldInfoFetchError: cleanNullableString(obj.worldInfoFetchError),
        jev: normalizeJevTurnDiagnostics(obj.jev),
      };
    })
    .filter((item): item is RunLogEntry => !!item)
    .sort((left, right) => right.timestamp - left.timestamp);
  return normalized.slice(0, Math.max(0, limit));
}

export function appendRunLog(existing: RunLogEntry[], entry: RunLogEntry, limit: number): RunLogEntry[] {
  if (limit <= 0) return [];
  return [entry, ...existing].slice(0, limit);
}

export function shouldInterceptGeneration(
  settings: LumiWorldSettings,
  generationType: unknown,
): { intercept: boolean; reason?: string; generationType: string } {
  const type = typeof generationType === "string" && generationType.trim() ? generationType.trim() : "normal";
  if (!settings.enabled) return { intercept: false, reason: "LumiWorld is disabled.", generationType: type };
  if (!settings.generationTypes.includes(type as LumiWorldGenerationType)) {
    return { intercept: false, reason: `Generation type "${type}" is not enabled for LumiWorld.`, generationType: type };
  }
  return { intercept: true, generationType: type };
}

export function resolveControllerTarget(settings: LumiWorldSettings, connection: ConnectionLike | null | undefined): ControllerTargetResult {
  if (!settings.connectionId) {
    return { ok: false, reason: "Choose a LumiWorld controller connection first." };
  }
  if (!connection) {
    return { ok: false, reason: "The selected LumiWorld controller connection could not be found." };
  }
  const model = settings.modelOverride.trim() || connection.model.trim();
  if (!model) {
    return { ok: false, reason: "The selected LumiWorld controller connection has no model configured." };
  }
  return {
    ok: true,
    connectionId: connection.id,
    connectionName: connection.name,
    provider: connection.provider,
    model,
  };
}

function safeJson(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

export function serializeMessageContent(content: LlmMessageLike["content"]): string {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content
    .map((part) => {
      switch (part.type) {
        case "text":
          return part.text;
        case "image":
          return `[image:${part.mime_type || "unknown"}]`;
        case "audio":
          return `[audio:${part.mime_type || "unknown"}]`;
        case "tool_use":
          return `[tool_use:${part.name || "tool"} ${safeJson(part.input || {})}]`;
        case "tool_result":
          return `[tool_result:${part.tool_use_id || "tool"}${part.is_error ? " error" : ""}] ${part.content || ""}`;
        default:
          return "";
      }
    })
    .filter(Boolean)
    .join("\n");
}

export function isChatHistoryMessage(message: LlmMessageLike): boolean {
  return message.__isChatHistory === true ||
    typeof message.sourceMessageId === "string" ||
    typeof message.sourceIndexInChat === "number";
}

export function isWorldInfoEntryMessage(message: LlmMessageLike): boolean {
  return message.__isWorldInfoEntry === true;
}

function cleanStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => cleanString(item))
    .filter(Boolean);
}

function normalizeRole(value: unknown): MessageRole {
  return value === "user" || value === "assistant" || value === "system" ? value : "system";
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function identityValue(value: string | null | undefined, fallback: string): string {
  const cleaned = typeof value === "string" ? value.trim() : "";
  return cleaned || fallback;
}

export function normalizeIdentityMacros(identity?: IdentityMacroValues | null): NormalizedIdentityMacroValues {
  return {
    userName: identityValue(identity?.userName, "User"),
    characterName: identityValue(identity?.characterName, "Character"),
  };
}

export function resolveIdentityMacros(text: string, identity?: IdentityMacroValues | null): string {
  if (!text) return text;
  const normalized = normalizeIdentityMacros(identity);
  const replacements: Record<string, string> = {
    user: normalized.userName,
    char: normalized.characterName,
  };
  return text.replace(/\{\{\s*(user|char)\s*\}\}/gi, (_match, key: string) => replacements[key.toLowerCase()] ?? _match);
}

export function normalizeActivatedWorldInfoEntries(value: unknown): ActivatedWorldInfoLike[] {
  const raw = Array.isArray(value) ? value : asRecord(value).activatedWorldInfo;
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const normalized: ActivatedWorldInfoLike[] = [];
  for (const item of raw) {
    const obj = asRecord(item);
    const id = cleanString(obj.id);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    normalized.push({
      id,
      comment: cleanString(obj.comment),
      keys: cleanStringArray(obj.keys),
      source: cleanString(obj.source),
      score: typeof obj.score === "number" && Number.isFinite(obj.score) ? obj.score : undefined,
      bookId: cleanString(obj.bookId),
      bookSource: cleanString(obj.bookSource),
    });
  }
  return normalized;
}

export function extractActivatedWorldInfoEntries(context: unknown): ActivatedWorldInfoLike[] {
  return normalizeActivatedWorldInfoEntries(asRecord(context).activatedWorldInfo);
}

export function makeControllerContextMessage(label: string, content: string, role: MessageRole = "system"): LlmMessageLike | null {
  const text = content.trim();
  if (!label.trim() || !text) return null;
  return {
    role,
    content: text,
    [CONTROLLER_CONTEXT_LABEL_KEY]: label.trim(),
  };
}

function makeWorldInfoLabel(entry: WorldInfoEntryLike, activated: ActivatedWorldInfoLike | undefined, index: number): string {
  const comment = cleanString(entry.comment) || cleanString(activated?.comment);
  return comment ? `World Info: ${comment}` : `World Info Entry ${index + 1}`;
}

function messageContentKey(message: LlmMessageLike): string {
  return serializeMessageContent(message.content).trim();
}

function fallbackWorldInfoMessages(
  messages: LlmMessageLike[],
  seenContent = new Set<string>(),
  identity?: IdentityMacroValues | null,
): LlmMessageLike[] {
  const selected: LlmMessageLike[] = [];
  for (const message of messages.filter(isWorldInfoEntryMessage)) {
    const content = typeof message.content === "string" ? resolveIdentityMacros(message.content, identity) : message.content;
    const contentKey = typeof content === "string" ? content.trim() : messageContentKey({ ...message, content });
    if (!contentKey || seenContent.has(contentKey)) continue;
    seenContent.add(contentKey);
    selected.push({
      role: normalizeRole(message.role),
      content,
      name: message.name,
      [CONTROLLER_CONTEXT_LABEL_KEY]: `World Info Entry ${selected.length + 1}`,
    });
  }
  return selected;
}

export async function resolveWorldInfoContextMessages(options: {
  messages: LlmMessageLike[];
  settings: Pick<LumiWorldSettings, "includeWorldInfoEntries">;
  context?: unknown;
  canFetchWorldBooks: boolean;
  fetchActivated?: () => Promise<unknown>;
  fetchEntry?: (entryId: string) => Promise<WorldInfoEntryLike | null | undefined>;
  identity?: IdentityMacroValues | null;
}): Promise<WorldInfoContextResult> {
  const diagnostics: WorldInfoContextDiagnostics = {
    activatedEntryCount: 0,
    fetchedEntryCount: 0,
    fallbackTaggedEntryCount: 0,
    fetchError: null,
  };

  if (!options.settings.includeWorldInfoEntries) {
    return { messages: [], diagnostics };
  }

  let activated = extractActivatedWorldInfoEntries(options.context);
  const fetchErrors: string[] = [];

  if (options.canFetchWorldBooks && activated.length === 0 && options.fetchActivated) {
    try {
      activated = normalizeActivatedWorldInfoEntries(await options.fetchActivated());
    } catch (error) {
      fetchErrors.push(errorMessage(error));
    }
  }

  diagnostics.activatedEntryCount = activated.length;

  const fetchedMessages: LlmMessageLike[] = [];
  const seenContent = new Set<string>();
  if (options.canFetchWorldBooks && options.fetchEntry && activated.length > 0) {
    for (const entrySummary of activated) {
      try {
        const entry = await options.fetchEntry(entrySummary.id);
        const content = typeof entry?.content === "string" ? resolveIdentityMacros(entry.content, options.identity).trim() : "";
        if (!entry || !content || seenContent.has(content)) continue;
        seenContent.add(content);
        const message = makeControllerContextMessage(
          makeWorldInfoLabel(entry, entrySummary, fetchedMessages.length),
          content,
          normalizeRole(entry.role),
        );
        if (message) fetchedMessages.push(message);
      } catch (error) {
        fetchErrors.push(errorMessage(error));
      }
    }
  }

  diagnostics.fetchedEntryCount = fetchedMessages.length;
  if (fetchErrors.length > 0) {
    diagnostics.fetchError = [...new Set(fetchErrors)].join("; ");
  }

  if (fetchedMessages.length > 0) {
    return { messages: fetchedMessages, diagnostics };
  }

  const fallback = fallbackWorldInfoMessages(options.messages, seenContent, options.identity);
  diagnostics.fallbackTaggedEntryCount = fallback.length;
  return { messages: fallback, diagnostics };
}

export function selectChatHistoryMessagesForController(messages: LlmMessageLike[], limit: number): LlmMessageLike[] {
  const cappedLimit = Math.max(0, Math.floor(Number.isFinite(limit) ? limit : DEFAULT_SETTINGS.historyMessageLimit));
  if (cappedLimit <= 0) return [];
  return messages.filter(isChatHistoryMessage).slice(-cappedLimit);
}

export function selectControllerMessagesForController(
  messages: LlmMessageLike[],
  settings: LumiWorldSettings,
  contextMessages: LlmMessageLike[] = [],
): LlmMessageLike[] {
  const selected = [...contextMessages];
  selected.push(...selectChatHistoryMessagesForController(messages, settings.historyMessageLimit));
  return selected;
}

function formatMessageBlock(message: LlmMessageLike, index: number): string {
  const name = message.name ? ` name=${message.name}` : "";
  const content = serializeMessageContent(message.content).trim() || "[empty]";
  const label = typeof message[CONTROLLER_CONTEXT_LABEL_KEY] === "string" && message[CONTROLLER_CONTEXT_LABEL_KEY].trim()
    ? message[CONTROLLER_CONTEXT_LABEL_KEY].trim()
    : `Chat Message ${index + 1}`;
  return `### ${label} (${message.role}${name})\n${content}`;
}

function takeStart(value: string, budget: number): string {
  if (budget <= 0) return "";
  if (value.length <= budget) return value;
  const notice = "\n[... front context truncated ...]";
  return `${value.slice(0, Math.max(0, budget - notice.length)).trimEnd()}${notice}`;
}

function takeEnd(value: string, budget: number): string {
  if (budget <= 0) return "";
  if (value.length <= budget) return value;
  const notice = "[... older prompt content omitted ...]\n";
  return `${notice}${value.slice(Math.max(0, value.length - budget + notice.length)).trimStart()}`;
}

export function formatPromptForController(messages: LlmMessageLike[], maxChars: number): PromptSnapshot {
  const blocks = messages.map(formatMessageBlock);
  const fullPrompt = blocks.join("\n\n");
  const limit = Math.max(1000, Math.floor(maxChars));
  if (fullPrompt.length <= limit) {
    return {
      prompt: fullPrompt,
      truncated: false,
      originalChars: fullPrompt.length,
      includedChars: fullPrompt.length,
      messageCount: messages.length,
    };
  }

  let leadingSystemCount = 0;
  while (leadingSystemCount < messages.length && messages[leadingSystemCount]?.role === "system") {
    leadingSystemCount += 1;
  }

  const omission = "\n\n[... middle of controller context omitted to fit LumiWorld context cap ...]\n\n";
  const frontRaw = blocks.slice(0, leadingSystemCount).join("\n\n");
  const tailRaw = blocks.slice(leadingSystemCount).join("\n\n") || fullPrompt;
  const frontBudget = frontRaw ? Math.min(Math.floor(limit * 0.35), frontRaw.length) : 0;
  const tailBudget = Math.max(0, limit - frontBudget - omission.length);
  const front = takeStart(frontRaw, frontBudget);
  const tail = takeEnd(tailRaw, tailBudget);
  const prompt = `${front}${front ? omission : ""}${tail}`.slice(0, limit);

  return {
    prompt,
    truncated: true,
    originalChars: fullPrompt.length,
    includedChars: prompt.length,
    messageCount: messages.length,
  };
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function renderTemplate(template: string, vars: ControllerTemplateContext | Record<string, string>): string {
  let rendered = template;
  for (const [key, value] of Object.entries(vars)) {
    rendered = rendered.replace(new RegExp(`{{\\s*${escapeRegex(key)}\\s*}}`, "g"), value);
  }
  return rendered;
}

export function buildControllerMessages(
  settings: LumiWorldSettings,
  snapshot: PromptSnapshot,
  context: Omit<ControllerTemplateContext, "prompt" | "maxDirectiveChars" | "timestamp" | "additionalNotes" | "user" | "char"> &
    Partial<Pick<ControllerTemplateContext, "timestamp" | "user" | "char">>,
): LlmMessageLike[] {
  const identity = normalizeIdentityMacros({
    userName: context.user,
    characterName: context.char,
  });
  const additionalNotes = resolveIdentityMacros(settings.additionalNotes, identity).trim();
  const vars: ControllerTemplateContext = {
    prompt: snapshot.prompt,
    generationType: context.generationType,
    chatId: context.chatId,
    connectionId: context.connectionId,
    timestamp: context.timestamp || new Date().toISOString(),
    maxDirectiveChars: String(MAX_DIRECTIVE_CHARS),
    // Notes are sent as their own controller-only message; keep the legacy token empty to avoid duplication.
    additionalNotes: "",
    user: identity.userName,
    char: identity.characterName,
  };
  const renderedSystem = renderTemplate(settings.systemTemplate, vars);
  const renderedUser = renderTemplate(settings.userTemplate, vars);
  const messages: LlmMessageLike[] = [{ role: "system", content: renderedSystem }];
  if (additionalNotes) {
    messages.push({
      role: "system",
      content: ["Additional LumiWorld controller notes:", additionalNotes].join("\n"),
    });
  }
  messages.push({ role: "user", content: renderedUser });
  return messages;
}

function stripCodeFence(value: string): string {
  const trimmed = value.trim();
  const match = trimmed.match(/^```(?:json|text)?\s*([\s\S]*?)\s*```$/i);
  return (match ? match[1] : trimmed).trim();
}

function extractFirstCodeFence(value: string): string | null {
  const match = value.match(/```(?:json|text)?\s*([\s\S]*?)\s*```/i);
  return match ? match[1].trim() : null;
}

function findJsonObject(value: string): unknown | null {
  const stripped = stripCodeFence(value);
  try {
    return JSON.parse(stripped);
  } catch {
    const match = stripped.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]);
    } catch {
      return null;
    }
  }
}

function normalizeDirectiveText(value: string, maxChars: number): string | null {
  const normalized = value
    .replace(/\r/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  if (!normalized) return null;
  if (normalized.length <= maxChars) return normalized;
  return `${normalized.slice(0, Math.max(0, maxChars - 1)).trimEnd()}...`;
}

export function parseControllerDirective(raw: unknown, maxChars = MAX_DIRECTIVE_CHARS): string | null {
  if (typeof raw !== "string") return null;
  const stripped = stripCodeFence(raw);
  const parsed = findJsonObject(stripped);
  if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
    const obj = parsed as Record<string, unknown>;
    const keys = [
      "director_note",
      "directorNote",
      "directive",
      "world_directive",
      "worldDirective",
      "note",
      "reaction",
      "instruction",
      "summary",
      "content",
    ];
    for (const key of keys) {
      if (typeof obj[key] === "string") return normalizeDirectiveText(obj[key] as string, maxChars);
    }
    const firstString = Object.values(obj).find((value): value is string => typeof value === "string" && value.trim().length > 0);
    if (firstString) return normalizeDirectiveText(firstString, maxChars);
  }
  return normalizeDirectiveText(stripped, maxChars);
}

function readStringAtPath(value: unknown, path: Array<string | number>): string | null {
  let current = value;
  for (const key of path) {
    if (current == null || typeof current !== "object") return null;
    if (Array.isArray(current)) {
      if (typeof key !== "number") return null;
      current = current[key];
    } else {
      if (typeof key !== "string") return null;
      current = (current as Record<string, unknown>)[key];
    }
  }
  return typeof current === "string" && current.trim() ? current : null;
}

function readNumberAtPath(value: unknown, path: Array<string | number>): number | null {
  let current = value;
  for (const key of path) {
    if (current == null || typeof current !== "object") return null;
    if (Array.isArray(current)) {
      if (typeof key !== "number") return null;
      current = current[key];
    } else {
      if (typeof key !== "string") return null;
      current = (current as Record<string, unknown>)[key];
    }
  }
  return typeof current === "number" && Number.isFinite(current) ? current : null;
}

function extractTextFromContentParts(value: unknown): string | null {
  if (!Array.isArray(value)) return null;
  const parts = value
    .map((part) => {
      if (typeof part === "string") return part;
      if (!part || typeof part !== "object") return "";
      const obj = part as Record<string, unknown>;
      const text = obj.text ?? obj.content ?? obj.value;
      if (typeof text === "string") return text;
      if (Array.isArray(obj.content)) return extractTextFromContentParts(obj.content) ?? "";
      return "";
    })
    .filter((part) => part.trim().length > 0);
  return parts.length ? parts.join("\n") : null;
}

export function extractControllerResponseText(response: unknown): string | null {
  if (typeof response === "string") return response.trim() || null;
  if (!response || typeof response !== "object") return null;

  const directPaths: Array<Array<string | number>> = [
    ["content"],
    ["text"],
    ["output_text"],
    ["message", "content"],
    ["message", "text"],
    ["choices", 0, "message", "content"],
    ["choices", 0, "message", "text"],
    ["choices", 0, "text"],
    ["choices", 0, "delta", "content"],
    ["choices", 0, "delta", "text"],
    ["output", 0, "content", 0, "text"],
    ["output", 0, "content", 0, "content"],
  ];
  for (const path of directPaths) {
    const text = readStringAtPath(response, path);
    if (text) return text.trim();
  }

  const contentLike = [
    (response as Record<string, unknown>).content,
    readStringAtPath(response, ["message", "content"]),
    readStringAtPath(response, ["choices", 0, "message", "content"]),
    (response as Record<string, unknown>).output,
  ];
  for (const value of contentLike) {
    const text = extractTextFromContentParts(value);
    if (text) return text.trim();
  }

  return null;
}

export function extractControllerReasoningText(response: unknown): string | null {
  const paths: Array<Array<string | number>> = [
    ["reasoning"],
    ["reasoning_content"],
    ["message", "reasoning"],
    ["message", "reasoning_content"],
    ["choices", 0, "message", "reasoning"],
    ["choices", 0, "message", "reasoning_content"],
  ];
  for (const path of paths) {
    const text = readStringAtPath(response, path);
    if (text) return text.trim();
  }
  return null;
}

export function describeEmptyControllerResponse(response: unknown): string {
  const reasoning = extractControllerReasoningText(response);
  const reasoningTokens = readNumberAtPath(response, ["usage", "completion_tokens_details", "reasoning_tokens"]);
  const finishReason = readStringAtPath(response, ["finish_reason"]) ?? readStringAtPath(response, ["choices", 0, "finish_reason"]);
  const suffix = [
    reasoningTokens != null ? `${Math.round(reasoningTokens)} reasoning tokens` : null,
    finishReason ? `finish_reason=${finishReason}` : null,
  ].filter(Boolean).join(", ");

  if (reasoning) {
    return [
      `LumiWorld controller returned reasoning-only output${suffix ? ` (${suffix})` : ""}.`,
      "No director note was injected because LumiWorld only uses final controller content.",
    ].join(" ");
  }

  return [
    `LumiWorld controller returned no final directive${suffix ? ` (${suffix})` : ""}.`,
    "No director note was injected.",
  ].join(" ");
}

export function parseControllerDirectiveFromResponse(response: unknown, maxChars = MAX_DIRECTIVE_CHARS): string | null {
  return parseControllerDirective(extractControllerResponseText(response), maxChars);
}

export function buildInjectedDirective(directive: string): string {
  return [
    "[LumiWorld Director]",
    "Use this private world-state directive to guide the next visible reply. Do not mention LumiWorld, the controller, or this note.",
    "",
    directive.trim(),
  ].join("\n");
}

export function makeDirectivePreview(directive: string | null | undefined, maxChars = 360): string | null {
  if (!directive) return null;
  const singleLine = directive.replace(/\s+/g, " ").trim();
  if (!singleLine) return null;
  return singleLine.length <= maxChars ? singleLine : `${singleLine.slice(0, maxChars - 1).trimEnd()}...`;
}
