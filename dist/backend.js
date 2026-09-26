// @bun
// src/shared.ts
var BREAKDOWN_NAME = "LumiWorld Director";
var VISIBLE_GENERATION_TYPES = [
  "normal",
  "continue",
  "regenerate",
  "swipe",
  "impersonate"
];
var JEV_PROVIDERS = {
  typesafe: {
    id: "typesafe",
    label: "TypeSafe",
    baseUrl: "https://api.typesafe.ai",
    path: "/v1/systemone",
    defaultModel: "jev-latest",
    keyUrl: "https://console.typesafe.ai/keys"
  },
  openrouter: {
    id: "openrouter",
    label: "OpenRouter",
    baseUrl: "https://openrouter.ai/api",
    path: "/alpha/decisions",
    defaultModel: "typesafe/jev-1.13",
    keyUrl: "https://openrouter.ai/settings/keys"
  }
};
var JEV_SECRET_KEY_PREFIX = "jev-api-key";
var ENCLAVE_KEY_PATTERN = /^[a-zA-Z0-9_.-]{1,128}$/;
function jevSecretKey(provider) {
  const key = `${JEV_SECRET_KEY_PREFIX}.${provider}`;
  if (!ENCLAVE_KEY_PATTERN.test(key)) {
    throw new Error(`Jev enclave key "${key}" is not a valid enclave key.`);
  }
  return key;
}
var JEV_MAX_STATE_TOKENS = 32000;
var DEFAULT_JEV_STATE_CHARS = 30000;
var MIN_JEV_STATE_CHARS = 2000;
var MAX_JEV_STATE_CHARS = 32000;
var DEFAULT_JEV_TIMEOUT_MS = 8000;
var MIN_JEV_TIMEOUT_MS = 1000;
var MAX_JEV_TIMEOUT_MS = 60000;
var MAX_JEV_HISTORY_MESSAGES = 24;
var DEFAULT_JEV_MIN_CONFIDENCE = 0.55;
var DEFAULT_JEV_SETTINGS = {
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
  gatePolicy: {}
};
function resolveJevProvider(settings) {
  const provider = settings.provider === "openrouter" ? "openrouter" : "typesafe";
  return JEV_PROVIDERS[provider];
}
function resolveJevModel(settings) {
  const model = typeof settings.model === "string" ? settings.model.trim() : "";
  return model || resolveJevProvider(settings).defaultModel;
}
function resolveJevBaseUrl(settings) {
  const override = typeof settings.baseUrlOverride === "string" ? settings.baseUrlOverride.trim().replace(/\/+$/, "") : "";
  return override || resolveJevProvider(settings).baseUrl;
}
var MAX_DIRECTOR_TIMEOUT_MS = 300000;
var MAX_CHAT_HISTORY_MESSAGES = Number.MAX_SAFE_INTEGER;
var DEFAULT_RUN_LOG_LIMIT = 12;
var DEFAULT_HISTORY_MESSAGE_LIMIT = 12;
var CONTROLLER_CONTEXT_LABEL_KEY = "__lumiWorldContextLabel";

class KeyedOperationLock {
  keys = new Set;
  acquire(key) {
    if (this.keys.has(key))
      return false;
    this.keys.add(key);
    return true;
  }
  release(key) {
    this.keys.delete(key);
  }
  has(key) {
    return this.keys.has(key);
  }
}
var LEGACY_DEFAULT_SYSTEM_TEMPLATE = [
  "You are AgentWorld, a private world-simulation director for an interactive Lumiverse chat.",
  "Your job is to decide how the world, scene, NPCs, hidden pressures, and immediate consequences should react before the main roleplay model writes the visible reply.",
  "Do not write the assistant reply. Do not address the user. Do not reveal this control step.",
  'Return only a concise director note for the main model. Prefer JSON like {"director_note":"..."}, but plain text is acceptable.',
  "Keep the note concrete, playable, and consistent with the assembled prompt."
].join(`
`);
var LEGACY_DEFAULT_USER_TEMPLATE = [
  "Generation type: {{generationType}}",
  "Chat ID: {{chatId}}",
  "",
  "Final assembled prompt that will be sent to the main model:",
  "<assembled_prompt>",
  "{{prompt}}",
  "</assembled_prompt>",
  "",
  "Decide how the world should react now. Focus on state changes, environmental pressure, NPC intent, consequences, and what the main model should respect next.",
  "Return one private director note under {{maxDirectiveChars}} characters."
].join(`
`);
var PREVIOUS_DEFAULT_SYSTEM_TEMPLATE = [
  "You are AgentWorld, a private world-simulation director for an interactive Lumiverse chat.",
  "Your job is to decide how the world, scene, NPCs, hidden pressures, and immediate consequences should react before the main roleplay model writes the visible reply.",
  "Do not write the assistant reply. Do not address the user. Do not reveal this control step.",
  'Return only a concise director note for the main model. Prefer JSON like {"director_note":"..."}, but plain text is acceptable.',
  "Keep the note concrete, playable, and consistent with the recent chat history and any additional notes."
].join(`
`);
var PREVIOUS_DEFAULT_USER_TEMPLATE = [
  "Generation type: {{generationType}}",
  "Chat ID: {{chatId}}",
  "",
  "Recent chat history available to the controller:",
  "<chat_history>",
  "{{prompt}}",
  "</chat_history>",
  "",
  "Decide how the world should react now. Focus on state changes, environmental pressure, NPC intent, consequences, and what the main model should respect next.",
  "Return one private director note under {{maxDirectiveChars}} characters."
].join(`
`);
var PRE_REBRAND_DEFAULT_SYSTEM_TEMPLATE = [
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
  'Use imperative language. Start with a verb such as "Make", "Let", "Have", "Keep", "Escalate", "Pressure", or "Treat".',
  "",
  "The directive should feel like the world moving forward, not a recap of the scene.",
  "",
  "Return only one private directive for the next visible reply. Do not write the visible assistant reply. Do not address the user. Do not mention AgentWorld, the controller, this prompt, or the directive.",
  "",
  "Prefer JSON exactly like:",
  '{"director_note":"..."}',
  "",
  "Plain text is acceptable if needed. Keep it under {{maxDirectiveChars}} characters."
].join(`
`);
var PRE_OUTPUT_CAP_DEFAULT_SYSTEM_TEMPLATE = [
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
  'Use imperative language. Start with a verb such as "Make", "Let", "Have", "Keep", "Escalate", "Pressure", or "Treat".',
  "",
  "The directive should feel like the world moving forward, not a recap of the scene.",
  "",
  "Return only one private directive for the next visible reply. Do not write the visible assistant reply. Do not address the user. Do not mention LumiWorld, the controller, this prompt, or the directive.",
  "",
  "Prefer JSON exactly like:",
  '{"director_note":"...","thread_label":"optional short name of the specific story thread developed"}',
  "",
  "Omit thread_label when no specific thread can be named. Plain text is acceptable if needed. Keep the note under {{maxDirectiveChars}} characters."
].join(`
`);
var DEFAULT_SYSTEM_TEMPLATE = PRE_OUTPUT_CAP_DEFAULT_SYSTEM_TEMPLATE.replace("Omit thread_label when no specific thread can be named. Plain text is acceptable if needed. Keep the note under {{maxDirectiveChars}} characters.", "Omit thread_label when no specific thread can be named. Plain text is acceptable if needed.");
var PRE_THREAD_LABEL_DEFAULT_SYSTEM_TEMPLATE = PRE_OUTPUT_CAP_DEFAULT_SYSTEM_TEMPLATE.replace('{"director_note":"...","thread_label":"optional short name of the specific story thread developed"}', '{"director_note":"..."}').replace("Omit thread_label when no specific thread can be named. Plain text is acceptable if needed. Keep the note under {{maxDirectiveChars}} characters.", "Plain text is acceptable if needed. Keep it under {{maxDirectiveChars}} characters.");
var PRE_CONTEXT_DEFAULT_USER_TEMPLATE = [
  "Generation type: {{generationType}}",
  "",
  "Recent chat history:",
  "<chat_history>",
  "{{prompt}}",
  "</chat_history>",
  "",
  "Write the next world-state directive now.",
  "",
  'Start with a verb. No recap. No review. No explanation. No "has just" framing.'
].join(`
`);
var DEFAULT_USER_TEMPLATE = [
  "Generation type: {{generationType}}",
  "",
  "Controller context:",
  "<controller_context>",
  "{{prompt}}",
  "</controller_context>",
  "",
  "Write the next world-state directive now.",
  "",
  'Start with a verb. No recap. No review. No explanation. No "has just" framing.'
].join(`
`);
var BUILTIN_PROMPT_PRESET_ID = "builtin";
var DEFAULT_SETTINGS = {
  enabled: false,
  connectionId: null,
  modelOverride: "",
  strongConnectionId: null,
  strongModelOverride: "",
  temperature: 0.35,
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
  activePromptPresetId: BUILTIN_PROMPT_PRESET_ID,
  promptPresets: [],
  runLogLimit: DEFAULT_RUN_LOG_LIMIT,
  jev: { ...DEFAULT_JEV_SETTINGS }
};
function asRecord(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}
function cleanString(value, fallback = "") {
  return typeof value === "string" ? value.trim() : fallback;
}
function cleanNullableString(value) {
  const text = cleanString(value);
  return text ? text : null;
}
function numberInRange(value, fallback, min, max) {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n))
    return fallback;
  return Math.min(max, Math.max(min, n));
}
function integerInRange(value, fallback, min, max) {
  return Math.round(numberInRange(value, fallback, min, max));
}
function normalizeGenerationTypes(value) {
  const incoming = Array.isArray(value) ? value : DEFAULT_SETTINGS.generationTypes;
  const allowed = new Set(VISIBLE_GENERATION_TYPES);
  const normalized = incoming.filter((item) => typeof item === "string" && allowed.has(item));
  return Array.isArray(value) ? [...new Set(normalized)] : [...DEFAULT_SETTINGS.generationTypes];
}
var GATE_FALLBACKS = [
  "run",
  "skip",
  "accept",
  "retry",
  "patch",
  "soften",
  "drop",
  "hold",
  "none",
  "ignore"
];
function normalizeProbability(value) {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n))
    return;
  return Math.min(1, Math.max(0, n));
}
function normalizeGatePolicy(value) {
  const obj = asRecord(value);
  const normalized = {};
  for (const [gateId, raw] of Object.entries(obj)) {
    const id = gateId.trim();
    if (!id)
      continue;
    const entry = asRecord(raw);
    const policy = {};
    if (typeof entry.enabled === "boolean")
      policy.enabled = entry.enabled;
    const threshold = normalizeProbability(entry.threshold);
    if (threshold !== undefined)
      policy.threshold = threshold;
    const fallback = cleanString(entry.fallback);
    if (GATE_FALLBACKS.includes(fallback))
      policy.fallback = fallback;
    if (Object.keys(policy).length > 0)
      normalized[id] = policy;
  }
  return normalized;
}
function normalizeJevSettings(value, legacyContext = DEFAULT_SETTINGS) {
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
    gatePolicy: normalizeGatePolicy(obj.gatePolicy)
  };
}
var JEV_STATUSES = ["ok", "degraded", "skipped"];
var JEV_PRIMITIVES = ["noul", "choice", "score"];
var JEV_PHASES = ["gate", "verify"];
function normalizeGateValue(value) {
  if (typeof value === "string")
    return value.trim() || null;
  if (typeof value === "number")
    return Number.isFinite(value) ? value : null;
  if (typeof value === "boolean")
    return value;
  return null;
}
function normalizeProbabilityMap(value) {
  const obj = asRecord(value);
  const entries = Object.entries(obj).map(([key, raw]) => {
    const probability = normalizeProbability(raw);
    return probability === undefined ? null : [key, probability];
  }).filter((entry) => entry !== null);
  return entries.length ? Object.fromEntries(entries) : undefined;
}
function normalizeJevGateRecord(value) {
  const obj = asRecord(value);
  const gateId = cleanString(obj.gateId);
  const primitive = cleanString(obj.primitive);
  const phase = cleanString(obj.phase);
  if (!gateId || !JEV_PRIMITIVES.includes(primitive) || !JEV_PHASES.includes(phase))
    return null;
  const fallback = cleanString(obj.fallback);
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
    note: cleanNullableString(obj.note) ?? undefined
  };
}
function normalizeJevPhaseTrace(value) {
  const obj = asRecord(value);
  const stage = cleanString(obj.stage);
  if (stage !== "before_director" && stage !== "verify_draft" && stage !== "verify_revision")
    return null;
  return {
    stage,
    questionCount: integerInRange(obj.questionCount, 0, 0, Number.MAX_SAFE_INTEGER),
    requestCount: integerInRange(obj.requestCount, 0, 0, 16),
    durationMs: integerInRange(obj.durationMs, 0, 0, Number.MAX_SAFE_INTEGER),
    inputTokens: obj.inputTokens == null ? null : integerInRange(obj.inputTokens, 0, 0, Number.MAX_SAFE_INTEGER),
    outputTokens: obj.outputTokens == null ? null : integerInRange(obj.outputTokens, 0, 0, Number.MAX_SAFE_INTEGER),
    costUsd: typeof obj.costUsd === "number" && Number.isFinite(obj.costUsd) ? obj.costUsd : null,
    resolvedModel: cleanNullableString(obj.resolvedModel),
    stateChars: integerInRange(obj.stateChars, 0, 0, Number.MAX_SAFE_INTEGER),
    stateCompacted: obj.stateCompacted === true,
    error: cleanNullableString(obj.error),
    gates: (Array.isArray(obj.gates) ? obj.gates : []).map(normalizeJevGateRecord).filter((gate) => gate !== null),
    requestJson: typeof obj.requestJson === "string" ? obj.requestJson : null,
    responseJson: typeof obj.responseJson === "string" ? obj.responseJson : null
  };
}
function normalizeJevRevisionTrace(value) {
  if (!value || typeof value !== "object" || Array.isArray(value))
    return null;
  const obj = asRecord(value);
  const status = cleanString(obj.status);
  if (status !== "revised" && status !== "failed")
    return null;
  return {
    action: cleanString(obj.action),
    reason: cleanString(obj.reason),
    status,
    durationMs: integerInRange(obj.durationMs, 0, 0, Number.MAX_SAFE_INTEGER),
    error: cleanNullableString(obj.error),
    initialDirectivePreview: cleanString(obj.initialDirectivePreview),
    revisedDirectivePreview: cleanNullableString(obj.revisedDirectivePreview),
    unresolved: obj.unresolved === true,
    promptJson: typeof obj.promptJson === "string" ? obj.promptJson : null,
    revisedDirective: typeof obj.revisedDirective === "string" ? obj.revisedDirective : null,
    responseJson: typeof obj.responseJson === "string" ? obj.responseJson : null
  };
}
function normalizeTurnTrace(value) {
  if (!value || typeof value !== "object" || Array.isArray(value))
    return null;
  const obj = asRecord(value);
  return {
    chatId: cleanNullableString(obj.chatId),
    generationId: cleanNullableString(obj.generationId),
    dryRun: obj.dryRun === true,
    generationOutcome: ["preview", "pending", "completed", "failed", "stopped", "superseded", "unknown"].includes(cleanString(obj.generationOutcome)) ? cleanString(obj.generationOutcome) : "unknown",
    generationError: cleanNullableString(obj.generationError),
    messageId: cleanNullableString(obj.messageId),
    finalReply: typeof obj.finalReply === "string" ? obj.finalReply : null,
    directiveDisposition: ["injected", "withheld"].includes(cleanString(obj.directiveDisposition)) ? cleanString(obj.directiveDisposition) : null,
    verificationVerdict: ["clean", "inconclusive", "violation", "unverified"].includes(cleanString(obj.verificationVerdict)) ? cleanString(obj.verificationVerdict) : null,
    verificationReason: cleanNullableString(obj.verificationReason),
    worldStateOutcome: ["not_used", "pending", "saved", "discarded", "save_failed"].includes(cleanString(obj.worldStateOutcome)) ? cleanString(obj.worldStateOutcome) : "not_used",
    worldStateBeforeJson: typeof obj.worldStateBeforeJson === "string" ? obj.worldStateBeforeJson : null,
    worldStateAfterJson: typeof obj.worldStateAfterJson === "string" ? obj.worldStateAfterJson : null,
    settingsJson: typeof obj.settingsJson === "string" ? obj.settingsJson : null,
    incomingMessagesJson: typeof obj.incomingMessagesJson === "string" ? obj.incomingMessagesJson : null,
    directorMessagesJson: typeof obj.directorMessagesJson === "string" ? obj.directorMessagesJson : null,
    initialDirective: typeof obj.initialDirective === "string" ? obj.initialDirective : null,
    finalDirective: typeof obj.finalDirective === "string" ? obj.finalDirective : null,
    initialResponseJson: typeof obj.initialResponseJson === "string" ? obj.initialResponseJson : null
  };
}
function normalizeJevTurnDiagnostics(value) {
  if (!value || typeof value !== "object" || Array.isArray(value))
    return null;
  const obj = asRecord(value);
  const provider = cleanString(obj.provider);
  const status = cleanString(obj.status);
  const nullableInt = (raw) => {
    if (raw == null)
      return null;
    const n = typeof raw === "number" ? raw : Number(raw);
    if (!Number.isFinite(n) || n < 0)
      return null;
    return Math.min(Number.MAX_SAFE_INTEGER, Math.round(n));
  };
  const gates = (Array.isArray(obj.gates) ? obj.gates : []).map(normalizeJevGateRecord).filter((gate) => gate !== null);
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
    phases: (Array.isArray(obj.phases) ? obj.phases : []).map(normalizeJevPhaseTrace).filter((phase) => phase !== null),
    revision: normalizeJevRevisionTrace(obj.revision)
  };
}
function makeJevDiagnostics(patch = {}) {
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
    phases: [],
    revision: null,
    ...patch
  };
}
function normalizeSettings(value) {
  const obj = asRecord(value);
  const includeWorldInfoEntries = typeof obj.includeWorldInfoEntries === "boolean" ? obj.includeWorldInfoEntries : DEFAULT_SETTINGS.includeWorldInfoEntries;
  const includeUserPersona = typeof obj.includeUserPersona === "boolean" ? obj.includeUserPersona : DEFAULT_SETTINGS.includeUserPersona;
  const includeCharacter = typeof obj.includeCharacter === "boolean" ? obj.includeCharacter : DEFAULT_SETTINGS.includeCharacter;
  const storedSystemTemplate = cleanString(obj.systemTemplate, DEFAULT_SYSTEM_TEMPLATE);
  const storedUserTemplate = cleanString(obj.userTemplate, DEFAULT_USER_TEMPLATE);
  const legacySystemTemplate = !storedSystemTemplate || storedSystemTemplate === LEGACY_DEFAULT_SYSTEM_TEMPLATE || storedSystemTemplate === PREVIOUS_DEFAULT_SYSTEM_TEMPLATE || storedSystemTemplate === PRE_REBRAND_DEFAULT_SYSTEM_TEMPLATE || storedSystemTemplate === PRE_OUTPUT_CAP_DEFAULT_SYSTEM_TEMPLATE || storedSystemTemplate === PRE_THREAD_LABEL_DEFAULT_SYSTEM_TEMPLATE ? DEFAULT_SYSTEM_TEMPLATE : storedSystemTemplate;
  const legacyUserTemplate = !storedUserTemplate || storedUserTemplate === LEGACY_DEFAULT_USER_TEMPLATE || storedUserTemplate === PREVIOUS_DEFAULT_USER_TEMPLATE || storedUserTemplate === PRE_CONTEXT_DEFAULT_USER_TEMPLATE ? DEFAULT_USER_TEMPLATE : storedUserTemplate;
  const promptPresets = [];
  const seenPresetIds = new Set;
  if (Array.isArray(obj.promptPresets)) {
    for (const value of obj.promptPresets) {
      if (promptPresets.length >= 20)
        break;
      const preset = asRecord(value);
      const id = cleanString(preset.id);
      const name = cleanString(preset.name);
      const system = cleanString(preset.systemTemplate) || DEFAULT_SYSTEM_TEMPLATE;
      const user = cleanString(preset.userTemplate) || DEFAULT_USER_TEMPLATE;
      if (!id || id === BUILTIN_PROMPT_PRESET_ID || id.length > 80 || seenPresetIds.has(id) || !name || name.length > 80)
        continue;
      promptPresets.push({ id, name, systemTemplate: system, userTemplate: user });
      seenPresetIds.add(id);
    }
  }
  const requestedPresetId = cleanString(obj.activePromptPresetId);
  let activePromptPresetId = seenPresetIds.has(requestedPresetId) ? requestedPresetId : BUILTIN_PROMPT_PRESET_ID;
  if (!requestedPresetId && !Array.isArray(obj.promptPresets) && (legacySystemTemplate !== DEFAULT_SYSTEM_TEMPLATE || legacyUserTemplate !== DEFAULT_USER_TEMPLATE)) {
    promptPresets.push({
      id: "imported",
      name: "Previous custom prompt",
      systemTemplate: legacySystemTemplate,
      userTemplate: legacyUserTemplate
    });
    activePromptPresetId = "imported";
  }
  const selectedPreset = promptPresets.find((preset) => preset.id === activePromptPresetId);
  const systemTemplate = selectedPreset?.systemTemplate ?? DEFAULT_SYSTEM_TEMPLATE;
  const userTemplate = selectedPreset?.userTemplate ?? DEFAULT_USER_TEMPLATE;
  return {
    enabled: typeof obj.enabled === "boolean" ? obj.enabled : DEFAULT_SETTINGS.enabled,
    connectionId: cleanNullableString(obj.connectionId),
    modelOverride: cleanString(obj.modelOverride),
    strongConnectionId: cleanNullableString(obj.strongConnectionId),
    strongModelOverride: cleanString(obj.strongModelOverride),
    temperature: numberInRange(obj.temperature, DEFAULT_SETTINGS.temperature, 0, 2),
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
    activePromptPresetId,
    promptPresets,
    runLogLimit: integerInRange(obj.runLogLimit, DEFAULT_SETTINGS.runLogLimit, 0, 50),
    jev: normalizeJevSettings(obj.jev, obj.jev && typeof obj.jev === "object" ? { includeWorldInfoEntries, includeUserPersona, includeCharacter } : DEFAULT_SETTINGS)
  };
}
function normalizeRunLog(value, limit = DEFAULT_RUN_LOG_LIMIT) {
  if (!Array.isArray(value))
    return [];
  const normalized = value.map((item) => {
    const obj = asRecord(item);
    const id = cleanString(obj.id);
    const timestamp = numberInRange(obj.timestamp, 0, 0, Number.MAX_SAFE_INTEGER);
    const status = cleanString(obj.status);
    if (!id || !timestamp || !["success", "error", "timeout", "skipped", "test_success", "test_error"].includes(status))
      return null;
    const channel = cleanString(obj.channel);
    return {
      id,
      timestamp,
      status,
      channel: channel === "director" || channel === "world_agent" ? channel : null,
      action: cleanNullableString(obj.action),
      generationType: cleanNullableString(obj.generationType),
      durationMs: obj.durationMs == null ? null : numberInRange(obj.durationMs, 0, 0, Number.MAX_SAFE_INTEGER),
      directorDurationMs: obj.directorDurationMs == null ? null : numberInRange(obj.directorDurationMs, 0, 0, Number.MAX_SAFE_INTEGER),
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
      trace: normalizeTurnTrace(obj.trace)
    };
  }).filter((item) => !!item).sort((left, right) => right.timestamp - left.timestamp);
  return normalized.slice(0, Math.max(0, limit));
}
function appendRunLog(existing, entry, limit) {
  if (limit <= 0)
    return [];
  return [entry, ...existing].slice(0, limit);
}
function shouldInterceptGeneration(settings, generationType) {
  const type = typeof generationType === "string" && generationType.trim() ? generationType.trim() : "normal";
  if (!settings.enabled)
    return { intercept: false, reason: "LumiWorld is disabled.", generationType: type };
  if (!settings.generationTypes.includes(type)) {
    return { intercept: false, reason: `Generation type "${type}" is not enabled for LumiWorld.`, generationType: type };
  }
  return { intercept: true, generationType: type };
}
function resolveControllerTarget(settings, connection) {
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
    model
  };
}
function safeJson(value) {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}
function serializeMessageContent(content) {
  if (typeof content === "string")
    return content;
  if (!Array.isArray(content))
    return "";
  return content.map((part) => {
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
  }).filter(Boolean).join(`
`);
}
function isChatHistoryMessage(message) {
  return message.__isChatHistory === true || typeof message.sourceMessageId === "string" || typeof message.sourceIndexInChat === "number";
}
function isWorldInfoEntryMessage(message) {
  return message.__isWorldInfoEntry === true;
}
function cleanStringArray(value) {
  if (!Array.isArray(value))
    return [];
  return value.map((item) => cleanString(item)).filter(Boolean);
}
function normalizeRole(value) {
  return value === "user" || value === "assistant" || value === "system" ? value : "system";
}
function errorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}
function identityValue(value, fallback) {
  const cleaned = typeof value === "string" ? value.trim() : "";
  return cleaned || fallback;
}
function normalizeIdentityMacros(identity) {
  return {
    userName: identityValue(identity?.userName, "User"),
    characterName: identityValue(identity?.characterName, "Character")
  };
}
function resolveIdentityMacros(text, identity) {
  if (!text)
    return text;
  const normalized = normalizeIdentityMacros(identity);
  const replacements = {
    user: normalized.userName,
    char: normalized.characterName
  };
  return text.replace(/\{\{\s*(user|char)\s*\}\}/gi, (_match, key) => replacements[key.toLowerCase()] ?? _match);
}
function normalizeActivatedWorldInfoEntries(value) {
  const raw = Array.isArray(value) ? value : asRecord(value).activatedWorldInfo;
  if (!Array.isArray(raw))
    return [];
  const seen = new Set;
  const normalized = [];
  for (const item of raw) {
    const obj = asRecord(item);
    const id = cleanString(obj.id);
    if (!id || seen.has(id))
      continue;
    seen.add(id);
    normalized.push({
      id,
      comment: cleanString(obj.comment),
      keys: cleanStringArray(obj.keys),
      source: cleanString(obj.source),
      score: typeof obj.score === "number" && Number.isFinite(obj.score) ? obj.score : undefined,
      bookId: cleanString(obj.bookId),
      bookSource: cleanString(obj.bookSource)
    });
  }
  return normalized;
}
function extractActivatedWorldInfoEntries(context) {
  return normalizeActivatedWorldInfoEntries(asRecord(context).activatedWorldInfo);
}
function makeControllerContextMessage(label, content, role = "system") {
  const text = content.trim();
  if (!label.trim() || !text)
    return null;
  return {
    role,
    content: text,
    [CONTROLLER_CONTEXT_LABEL_KEY]: label.trim()
  };
}
function makeWorldInfoLabel(entry, activated, index) {
  const comment = cleanString(entry.comment) || cleanString(activated?.comment);
  return comment ? `World Info: ${comment}` : `World Info Entry ${index + 1}`;
}
function messageContentKey(message) {
  return serializeMessageContent(message.content).trim();
}
function fallbackWorldInfoMessages(messages, seenContent = new Set, identity) {
  const selected = [];
  for (const message of messages.filter(isWorldInfoEntryMessage)) {
    const content = typeof message.content === "string" ? resolveIdentityMacros(message.content, identity) : message.content;
    const contentKey = typeof content === "string" ? content.trim() : messageContentKey({ ...message, content });
    if (!contentKey || seenContent.has(contentKey))
      continue;
    seenContent.add(contentKey);
    selected.push({
      role: normalizeRole(message.role),
      content,
      name: message.name,
      [CONTROLLER_CONTEXT_LABEL_KEY]: `World Info Entry ${selected.length + 1}`
    });
  }
  return selected;
}
async function resolveWorldInfoContextMessages(options) {
  const diagnostics = {
    activatedEntryCount: 0,
    fetchedEntryCount: 0,
    fallbackTaggedEntryCount: 0,
    fetchError: null
  };
  if (!options.settings.includeWorldInfoEntries) {
    return { messages: [], diagnostics };
  }
  let activated = extractActivatedWorldInfoEntries(options.context);
  const fetchErrors = [];
  if (options.canFetchWorldBooks && activated.length === 0 && options.fetchActivated) {
    try {
      activated = normalizeActivatedWorldInfoEntries(await options.fetchActivated());
    } catch (error) {
      fetchErrors.push(errorMessage(error));
    }
  }
  diagnostics.activatedEntryCount = activated.length;
  const fetchedMessages = [];
  const seenContent = new Set;
  if (options.canFetchWorldBooks && options.fetchEntry && activated.length > 0) {
    for (const entrySummary of activated) {
      try {
        const entry = await options.fetchEntry(entrySummary.id);
        const content = typeof entry?.content === "string" ? resolveIdentityMacros(entry.content, options.identity).trim() : "";
        if (!entry || !content || seenContent.has(content))
          continue;
        seenContent.add(content);
        const message = makeControllerContextMessage(makeWorldInfoLabel(entry, entrySummary, fetchedMessages.length), content, normalizeRole(entry.role));
        if (message)
          fetchedMessages.push(message);
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
function selectChatHistoryMessagesForController(messages, limit) {
  const cappedLimit = Math.max(0, Math.floor(Number.isFinite(limit) ? limit : DEFAULT_SETTINGS.historyMessageLimit));
  if (cappedLimit <= 0)
    return [];
  return messages.filter(isChatHistoryMessage).slice(-cappedLimit);
}
function latestPlayerChatMessage(messages) {
  return messages.filter((message) => message.role === "user" && isChatHistoryMessage(message)).at(-1) ?? null;
}
function currentUserContextMessages(messages, maxChars) {
  const latest = latestPlayerChatMessage(messages);
  const actionCap = Math.max(500, Math.min(40000, Math.floor(maxChars * 0.35)));
  const lastAction = latest ? serializeMessageContent(latest.content).trim() : "";
  const out = [];
  if (lastAction) {
    const marker = `
[... middle of long player message omitted ...]
`;
    const action = lastAction.length <= actionCap ? lastAction : `${lastAction.slice(0, Math.floor((actionCap - marker.length) * 0.6))}${marker}${lastAction.slice(-Math.floor((actionCap - marker.length) * 0.4))}`;
    out.push({ role: "user", content: `Latest completed player chat action (preserve its actor, target, and events exactly):
${action}` });
  }
  return out;
}
function selectControllerMessagesForController(messages, settings, contextMessages = []) {
  const selected = [...contextMessages];
  selected.push(...selectChatHistoryMessagesForController(messages, settings.historyMessageLimit));
  return selected;
}
function formatMessageBlock(message, index) {
  const name = message.name ? ` name=${message.name}` : "";
  const content = serializeMessageContent(message.content).trim() || "[empty]";
  const label = typeof message[CONTROLLER_CONTEXT_LABEL_KEY] === "string" && message[CONTROLLER_CONTEXT_LABEL_KEY].trim() ? message[CONTROLLER_CONTEXT_LABEL_KEY].trim() : `Chat Message ${index + 1}`;
  return `### ${label} (${message.role}${name})
${content}`;
}
function takeStart(value, budget) {
  if (budget <= 0)
    return "";
  if (value.length <= budget)
    return value;
  const notice = `
[... front context truncated ...]`;
  return `${value.slice(0, Math.max(0, budget - notice.length)).trimEnd()}${notice}`;
}
function takeEnd(value, budget) {
  if (budget <= 0)
    return "";
  if (value.length <= budget)
    return value;
  const notice = `[... older prompt content omitted ...]
`;
  return `${notice}${value.slice(Math.max(0, value.length - budget + notice.length)).trimStart()}`;
}
function formatPromptForController(messages, maxChars) {
  const blocks = messages.map(formatMessageBlock);
  const fullPrompt = blocks.join(`

`);
  const limit = Math.max(1000, Math.floor(maxChars));
  if (fullPrompt.length <= limit) {
    return {
      prompt: fullPrompt,
      truncated: false,
      originalChars: fullPrompt.length,
      includedChars: fullPrompt.length,
      messageCount: messages.length
    };
  }
  let leadingSystemCount = 0;
  while (leadingSystemCount < messages.length && messages[leadingSystemCount]?.role === "system") {
    leadingSystemCount += 1;
  }
  const omission = `

[... middle of controller context omitted to fit LumiWorld context cap ...]

`;
  const frontRaw = blocks.slice(0, leadingSystemCount).join(`

`);
  const tailRaw = blocks.slice(leadingSystemCount).join(`

`) || fullPrompt;
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
    messageCount: messages.length
  };
}
function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
function renderTemplate(template, vars) {
  let rendered = template;
  for (const [key, value] of Object.entries(vars)) {
    rendered = rendered.replace(new RegExp(`{{\\s*${escapeRegex(key)}\\s*}}`, "g"), value);
  }
  return rendered;
}
function buildControllerMessages(settings, snapshot, context) {
  const identity = normalizeIdentityMacros({
    userName: context.user,
    characterName: context.char
  });
  const additionalNotes = resolveIdentityMacros(settings.additionalNotes, identity).trim();
  const vars = {
    prompt: snapshot.prompt,
    generationType: context.generationType,
    chatId: context.chatId,
    connectionId: context.connectionId,
    timestamp: context.timestamp || new Date().toISOString(),
    maxDirectiveChars: "no fixed limit",
    additionalNotes: "",
    user: identity.userName,
    char: identity.characterName
  };
  const renderedSystem = [
    renderTemplate(settings.systemTemplate, vars),
    "Current-scene authority: Only marked chat history establishes what has happened, where the scene is, and who is present. Character, persona, and World Info context are background reference, not a record of current events. Derived scene state is advisory and must yield to the chat if stale. The latest completed player chat action already happened exactly as written: preserve its actor, target, objects, and outcome. Start after that action; never rewind it, redirect it to another target, or give its objects to another character without a new on-scene event. If other context conflicts with chat, follow the chat."
  ].join(`

`);
  const renderedUser = renderTemplate(settings.userTemplate, vars);
  const messages = [{ role: "system", content: renderedSystem }];
  if (additionalNotes) {
    messages.push({
      role: "system",
      content: ["Additional LumiWorld controller notes:", additionalNotes].join(`
`)
    });
  }
  messages.push({ role: "user", content: renderedUser });
  return messages;
}
function stripCodeFence(value) {
  const trimmed = value.trim();
  const match = trimmed.match(/^```(?:json|text)?\s*([\s\S]*?)\s*```$/i);
  return (match ? match[1] : trimmed).trim();
}
function findJsonObject(value) {
  const stripped = stripCodeFence(value);
  try {
    return JSON.parse(stripped);
  } catch {
    const match = stripped.match(/\{[\s\S]*\}/);
    if (!match)
      return null;
    try {
      return JSON.parse(match[0]);
    } catch {
      return null;
    }
  }
}
function normalizeDirectiveText(value) {
  const normalized = value.replace(/\r/g, "").replace(/\n{3,}/g, `

`).trim();
  if (!normalized)
    return null;
  return normalized;
}
function parseControllerDirective(raw) {
  if (typeof raw !== "string")
    return null;
  const stripped = stripCodeFence(raw);
  const parsed = findJsonObject(stripped);
  if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
    const obj = parsed;
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
      "content"
    ];
    for (const key of keys) {
      if (typeof obj[key] === "string")
        return normalizeDirectiveText(obj[key]);
    }
    if ("thread_label" in obj)
      return null;
    const firstString = Object.values(obj).find((value) => typeof value === "string" && value.trim().length > 0);
    if (firstString)
      return normalizeDirectiveText(firstString);
  }
  return normalizeDirectiveText(stripped);
}
function readStringAtPath(value, path) {
  let current = value;
  for (const key of path) {
    if (current == null || typeof current !== "object")
      return null;
    if (Array.isArray(current)) {
      if (typeof key !== "number")
        return null;
      current = current[key];
    } else {
      if (typeof key !== "string")
        return null;
      current = current[key];
    }
  }
  return typeof current === "string" && current.trim() ? current : null;
}
function readNumberAtPath(value, path) {
  let current = value;
  for (const key of path) {
    if (current == null || typeof current !== "object")
      return null;
    if (Array.isArray(current)) {
      if (typeof key !== "number")
        return null;
      current = current[key];
    } else {
      if (typeof key !== "string")
        return null;
      current = current[key];
    }
  }
  return typeof current === "number" && Number.isFinite(current) ? current : null;
}
function extractTextFromContentParts(value) {
  if (!Array.isArray(value))
    return null;
  const parts = value.map((part) => {
    if (typeof part === "string")
      return part;
    if (!part || typeof part !== "object")
      return "";
    const obj = part;
    const text = obj.text ?? obj.content ?? obj.value;
    if (typeof text === "string")
      return text;
    if (Array.isArray(obj.content))
      return extractTextFromContentParts(obj.content) ?? "";
    return "";
  }).filter((part) => part.trim().length > 0);
  return parts.length ? parts.join(`
`) : null;
}
function extractControllerResponseText(response) {
  if (typeof response === "string")
    return response.trim() || null;
  if (!response || typeof response !== "object")
    return null;
  const directPaths = [
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
    ["output", 0, "content", 0, "content"]
  ];
  for (const path of directPaths) {
    const text = readStringAtPath(response, path);
    if (text)
      return text.trim();
  }
  const contentLike = [
    response.content,
    readStringAtPath(response, ["message", "content"]),
    readStringAtPath(response, ["choices", 0, "message", "content"]),
    response.output
  ];
  for (const value of contentLike) {
    const text = extractTextFromContentParts(value);
    if (text)
      return text.trim();
  }
  return null;
}
function extractControllerReasoningText(response) {
  const paths = [
    ["reasoning"],
    ["reasoning_content"],
    ["message", "reasoning"],
    ["message", "reasoning_content"],
    ["choices", 0, "message", "reasoning"],
    ["choices", 0, "message", "reasoning_content"]
  ];
  for (const path of paths) {
    const text = readStringAtPath(response, path);
    if (text)
      return text.trim();
  }
  return null;
}
function describeEmptyControllerResponse(response) {
  const reasoning = extractControllerReasoningText(response);
  const reasoningTokens = readNumberAtPath(response, ["usage", "completion_tokens_details", "reasoning_tokens"]);
  const finishReason = readStringAtPath(response, ["finish_reason"]) ?? readStringAtPath(response, ["choices", 0, "finish_reason"]);
  const suffix = [
    reasoningTokens != null ? `${Math.round(reasoningTokens)} reasoning tokens` : null,
    finishReason ? `finish_reason=${finishReason}` : null
  ].filter(Boolean).join(", ");
  if (reasoning) {
    return [
      `LumiWorld controller returned reasoning-only output${suffix ? ` (${suffix})` : ""}.`,
      "No director note was injected because LumiWorld only uses final controller content."
    ].join(" ");
  }
  return [
    `LumiWorld controller returned no final directive${suffix ? ` (${suffix})` : ""}.`,
    "No director note was injected."
  ].join(" ");
}
function parseControllerDirectiveFromResponse(response) {
  return parseControllerDirective(extractControllerResponseText(response));
}
function parseControllerThreadLabelFromResponse(response) {
  const raw = extractControllerResponseText(response);
  if (!raw)
    return null;
  const parsed = findJsonObject(raw);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
    return null;
  const label = parsed.thread_label;
  return typeof label === "string" ? label : null;
}
function buildInjectedDirective(directive) {
  return [
    "[LumiWorld Director]",
    "Use this private world-state directive to guide the next visible reply. Do not mention LumiWorld, the controller, or this note.",
    "The saved chat history is authoritative for the current scene and completed player actions. Treat this note as a suggestion only where it agrees with that history. Do not change the player's actor, target, objects, or completed outcome, and do not import a different scene from character background or an opening message.",
    "",
    directive.trim()
  ].join(`
`);
}
function makeDirectivePreview(directive, maxChars = 360) {
  if (!directive)
    return null;
  const singleLine = directive.replace(/\s+/g, " ").trim();
  if (!singleLine)
    return null;
  return singleLine.length <= maxChars ? singleLine : `${singleLine.slice(0, maxChars - 1).trimEnd()}...`;
}

// src/gates.ts
var REPORTED_CONFIDENCE = 1;
function noul(id, label, category, phase, instructions, rationale, criteria, fallback) {
  return {
    id,
    label,
    primitive: "noul",
    primitiveLabel: "Yes / No",
    phase,
    category,
    instructions,
    rationale,
    criteria,
    enabledByDefault: false,
    threshold: 0.6,
    fallback,
    safeValue: true,
    blockValue: false
  };
}
function choice(id, label, category, phase, instructions, rationale, criteria, fallback, safeValue, blockValue) {
  return {
    id,
    label,
    primitive: "choice",
    primitiveLabel: "Choice",
    phase,
    category,
    instructions,
    rationale,
    criteria,
    enabledByDefault: false,
    threshold: 0.5,
    fallback,
    safeValue,
    blockValue
  };
}
function score(id, label, category, phase, instructions, rationale, criteria, fallback, safeValue, blockValue) {
  return {
    id,
    label,
    primitive: "score",
    primitiveLabel: "Score",
    phase,
    category,
    instructions,
    rationale,
    criteria,
    enabledByDefault: false,
    threshold: 0.5,
    fallback,
    safeValue,
    blockValue
  };
}
var CORE_GATES = new Set([
  "smart_trigger",
  "context_filter",
  "model_route",
  "director_verification",
  "player_agency",
  "duplicate_suppression",
  "continuity_guard",
  "intensity_boundary",
  "confidence_escalation",
  "budget_degradation",
  "scene_state_tracking"
]);
function withCore(gates) {
  return gates.map((gate) => ({
    ...gate,
    enabledByDefault: CORE_GATES.has(gate.id),
    threshold: gate.id === "continuity_guard" || gate.id === "duplicate_suppression" ? 0.7 : gate.threshold
  }));
}
var GATE_CATALOG = withCore([
  noul("smart_trigger", "Smart Director triggering", "director_control", "gate", "Given `chat_history`, `scene_state`, `director_notes`, and the latest player message, is there anything in this turn that a private world director should intervene in before the visible reply is written? Judge only whether intervention would add something the main model would otherwise miss.", "Decides whether the Director runs at all, so a quiet or purely conversational turn costs one cheap Jev call instead of a full Director generation.", {
    true: "The turn creates or changes world pressure, NPC intent, an offscreen consequence, a reveal, or a development the main model would plausibly miss",
    false: "The turn is a direct continuation of the immediately preceding exchange and needs no new world development"
  }, "run"),
  choice("context_filter", "Context filtering", "director_control", "gate", "Which parts of the assembled context are actually relevant to directing this turn? Choose the smallest set that still covers what the Director needs.", "Drops irrelevant lore and context before the Director sees it, which cuts prompt tokens and reduces distraction.", {
    all: "Every available context source is relevant",
    history_and_character: "Recent chat history and the active character matter; detailed lore does not",
    world_info_only: "The activated lore matters more than the recent small talk",
    history_only: "Only the recent exchange matters; drop character sheets and lore"
  }, "run", "all", "history_only"),
  choice("model_route", "Model routing", "director_control", "gate", "How difficult is this turn to direct? Judge the complexity of the world development needed, not the length of the chat.", "Selects a cheap or strong Director model per turn instead of paying for the strongest model on every reply.", {
    cheap: "A small, local development is enough; no deep reasoning required",
    strong: "A consequential, multi-thread, or continuity-sensitive development is needed"
  }, "run", "cheap", "strong"),
  choice("pacing_control", "Pacing control", "director_control", "gate", "How should the scene's pacing be handled in the next development?", "Translates stagnation, tension, and urgency into a pacing instruction for the Director.", {
    hold: "Let the current beat breathe; do not accelerate",
    tighten: "Increase pressure and shorten the scene's patience",
    slow: "Give the scene a slower, quieter treatment",
    turn: "Introduce a reversal that changes the direction of the scene"
  }, "run", "hold", "slow"),
  choice("npc_autonomy", "NPC autonomy", "director_control", "gate", "Which category of action should a non-player character take next, if any?", "Picks who acts and the kind of action, after which the Director writes the specific, natural action.", {
    none: "No NPC needs to act in this turn",
    confront: "An NPC directly challenges, blocks, or pushes back",
    withdraw: "An NPC pulls away, goes quiet, or leaves the exchange",
    reveal_intent: "An NPC shows their true motive or loyalty",
    assist: "An NPC helps, concedes, or offers something",
    conspire: "An NPC acts behind the scenes or coordinates with another"
  }, "run", "none", "withdraw"),
  noul("world_movement", "World movement", "director_control", "gate", "Should offscreen factions, organisations, or background events advance during this turn?", "Keeps the world moving without the visible cast, and prevents the world from freezing around the player.", {
    true: "Something offscreen would plausibly progress now and its consequence could reach the scene",
    false: "Nothing offscreen would meaningfully change in the span of this turn"
  }, "run"),
  noul("reveal_control", "Reveal control", "director_control", "gate", "Is now a good moment for a previously withheld secret or reveal to begin landing? Judge readiness, not whether the secret exists.", "Stops the Director from either hoarding a reveal forever or spending it too early.", {
    true: "Enough has been established that landing part of this reveal now would read as earned",
    false: "The reveal has not been set up enough, or the scene has no room for it now"
  }, "run"),
  choice("conflict_escalation", "Conflict escalation", "director_control", "gate", "What should happen to the current conflict?", "Chooses the conflict beat so the Director constructs an event in the right register.", {
    hold: "Leave the conflict at its current level",
    escalate: "Raise the stakes, cost, or hostility",
    interrupt: "Cut the conflict short with an outside event",
    resolve: "Bring this conflict to a genuine conclusion",
    redirect: "Move the conflict somewhere else or onto a different target"
  }, "run", "hold", "resolve"),
  choice("story_thread", "Story-thread management", "director_control", "gate", "Which unresolved story thread most deserves movement in this turn? Use `scene_state` for open threads only when they still fit `chat_history`; a saved thread contradicted by the latest chat is stale.", "Picks the thread to advance so the Director does not drift onto uninteresting tangents.", {
    none: "No open thread needs movement right now",
    primary: "The main unresolved thread",
    secondary: "A background or supporting thread",
    newest: "The thread introduced most recently",
    neglected: "The thread that has been untouched longest"
  }, "run", "none", "primary"),
  choice("arc_position", "Arc position", "director_control", "gate", "Where does this scene currently sit in its dramatic arc?", "Anchors the Director's development to the scene's dramatic position instead of an arbitrary beat.", {
    setup: "Establishing characters, place, and stakes",
    rising: "Pressure and complications building",
    turn: "A reversal or reframing has just occurred",
    climax: "The decisive confrontation or peak",
    release: "Aftermath and decompression"
  }, "run", "setup", "release"),
  choice("development_shape", "Development shape", "director_control", "gate", "What form should the next development take?", "Decides the shape of the beat so the Director realises that form rather than defaulting to a description of the environment.", {
    npc_action: "A character does something with visible consequence",
    dialogue: "A line of dialogue reframes the situation",
    environmental: "The environment or setting itself changes",
    revelation: "Information is disclosed",
    time_skip: "Time passes and the situation has moved on",
    offscreen_cut: "The scene cuts to something happening elsewhere"
  }, "run", "environmental", "offscreen_cut"),
  choice("focus_selection", "Focus selection", "director_control", "gate", "Which element should this development centre on?", "Focuses the beat so it lands rather than diffusing across the whole cast.", {
    player: "The player's character and their immediate situation",
    active_npc: "The character currently most engaged with the player",
    absent_npc: "A character who is not in the scene right now",
    location: "The place itself and what it is doing",
    faction: "An organisation or group acting in the background"
  }, "run", "player", "faction"),
  choice("time_clock", "Time and clock control", "world", "gate", "Should in-world time advance during this turn, and roughly how far?", "Controls the story clock so the Director does not narrate irrelevant passage of time.", {
    none: "Time does not meaningfully advance",
    minutes: "A few minutes pass",
    hours: "Some hours pass",
    day: "A day or more passes"
  }, "run", "none", "day"),
  choice("environment_conditions", "Environment and conditions", "world", "gate", "Should the environment change during this turn \u2014 weather, light, temperature, or the condition of the location?", "Lets the world react physically without the Director decorating every reply with weather.", {
    unchanged: "Leave conditions as they are",
    weather: "Weather shifts",
    light: "Light or time-of-day shifts",
    location_state: "The location itself is altered or damaged",
    worsening: "Conditions deteriorate in a way that presses on the scene"
  }, "run", "unchanged", "worsening"),
  choice("npc_entry_exit", "NPC entry and exit", "world", "gate", "Should any non-player character enter or leave the scene during this turn?", "Stages arrivals and departures deliberately instead of leaving the cast static.", {
    none: "The current cast stays as it is",
    enter_known: "A character already established elsewhere arrives",
    enter_new: "A new character appears",
    exit: "A present character leaves"
  }, "run", "none", "exit"),
  choice("consequence_propagation", "Consequence propagation", "world", "gate", "Should the most recent committed development ripple outward into factions, threads, or relationships offscreen?", "Propagates consequences so the world remembers what happened even when the scene moves on.", {
    contained: "The development stays local to the scene",
    faction: "An organisation reacts",
    relationship: "A relationship changes because of it",
    thread: "Another thread is affected by it",
    broad: "Several of the above react at once"
  }, "run", "contained", "broad"),
  choice("director_verification", "Director verification", "guardrails", "verify", "Treat `latest_player_action` and `chat_history` as the only record of current events; `character` and `world_info` are background lore, and `scene_state` is derived and may be stale. Read `draft_directive` against the most recent marked chat. Does it move the scene to a different setting or participants, change the actor, target, object, or outcome of a completed player action, replay that action, contradict a committed event, or prematurely resolve an open thread? A conflict with the chat is a violation even if other context describes the other scene.", "Checks the directive before it is injected, so a bad note costs one retry instead of a bad reply.", {
    clean: "The directive preserves the chat's current scene and every completed player action, with no contradiction, repetition, or premature resolution",
    violation: "The directive changes the scene or a completed action's actor, target, object, or outcome, repeats an action, or resolves an open thread too early",
    uncertain: "Something looks off, but it is not clear enough to call a violation"
  }, "accept", "clean", "violation"),
  noul("player_agency", "Player agency guard", "guardrails", "verify", "Does `draft_directive` decide what the player's character thinks, feels, says, or does? Judge only the player's character, not NPCs and not the world.", "Catches the most damaging Director failure: a private note that hijacks the player's character.", {
    true: "The directive dictates the player's character's decision, dialogue, thoughts, or movement",
    false: "The directive leaves the player's character's choices open"
  }, "patch"),
  choice("user_intent_arbitration", "User-intent arbitration", "guardrails", "verify", "The player's explicit out-of-character instruction, if any, is in `director_notes`. Does `draft_directive` follow that instruction, follow the world's momentum, or blend them?", "Reconciles an explicit player instruction with the world's own momentum instead of silently overriding the player.", {
    follows_instruction: "The directive honours the explicit instruction",
    follows_world: "The directive follows world momentum and sets the instruction aside",
    blends: "The directive satisfies both, weighting the instruction",
    not_applicable: "There is no explicit out-of-character instruction to reconcile"
  }, "accept", "not_applicable", "follows_world"),
  choice("duplicate_suppression", "Duplicate suppression", "guardrails", "verify", "Compare `draft_directive` with `latest_player_action` and `chat_history`. Does it ask the next reply to replay, prevent, or change the outcome of a completed player action or an already committed development? A camera flash, movement, or spoken line described as completed has already happened. NPC reactions afterward are new; rewriting the action is not.", "Stops the Director from re-running a beat that has already happened, which reads to the player as the story stalling.", {
    new: "The directive begins after completed actions and develops something new",
    repeats: "The directive asks the next reply to perform a completed action again",
    near_duplicate: "The directive prevents, redirects, or changes the outcome of a completed action, or thinly repeats it"
  }, "retry", "new", "repeats"),
  choice("continuity_guard", "Continuity guard", "guardrails", "verify", "Use `latest_player_action` and `chat_history` as the authority for the current scene; `character` and `world_info` are background, and `scene_state` may be stale. Does `draft_directive` move to a different setting or group of participants, or change the actor, target, object, or completed outcome of the player's action? Check exactly who or what was acted on. A draft that imports a scene from other context instead of continuing the chat is a violation.", "Prevents the Director from breaking facts the story has already committed to.", {
    consistent: "The directive continues the marked chat scene and preserves the completed action's actor, target, objects, and outcome",
    violation: "The directive changes the chat's location or participants, or changes a completed action's actor, target, objects, or outcome",
    uncertain: "The directive may contradict an established fact, but it is not clear"
  }, "soften", "consistent", "violation"),
  choice("intensity_boundary", "Intensity and boundary gating", "guardrails", "verify", "Weigh `draft_directive` against `director_notes` and the scene's established intensity. Does it stay inside the range the player has signalled?", "Keeps the Director inside the intensity band the player actually asked for, rather than escalating past it.", {
    within_range: "The directive stays inside the established range",
    borderline: "The directive sits at the edge of the range",
    out_of_range: "The directive exceeds the established range or crosses a stated boundary"
  }, "soften", "within_range", "out_of_range"),
  noul("claim_extraction", "Claim extraction", "state_accuracy", "verify", "Does `draft_directive` assert a concrete fact, action, or state change that should be recorded as committed?", "Flags directives that introduce committable facts, so only validated claims reach the world state.", {
    true: "The directive asserts at least one concrete fact, action, or state change",
    false: "The directive is purely atmospheric and commits nothing"
  }, "none"),
  noul("contradiction_localization", "Contradiction localization", "state_accuracy", "verify", "If `draft_directive` conflicts with committed facts, is the conflict confined to a single element rather than the whole directive?", "Tells the repair path whether a targeted patch is viable or the whole directive must be regenerated.", {
    true: "The conflict is confined to one element that could be replaced on its own",
    false: "The conflict affects the directive as a whole, or there is no conflict"
  }, "patch"),
  choice("repair_strategy", "Repair strategy", "state_accuracy", "verify", "Given the checks recorded in `scene_state` and the draft in `draft_directive`, which repair fits best if a repair is needed?", "Chooses the cheapest repair that resolves the problem instead of always regenerating.", {
    accept: "No repair needed",
    full_retry: "Regenerate the directive from scratch",
    patch: "Replace only the offending element",
    soften: "Keep the directive but reduce its force",
    drop_claim: "Drop the offending claim and keep the rest"
  }, "accept", "accept", "soften"),
  noul("scene_state_tracking", "Scene state tracking", "state_accuracy", "verify", "Does the draft directive change the scene's location, danger level, tension, active characters, or unresolved hooks in a way worth persisting for the next turn?", "Decides whether the derived scene state needs updating, so later turns inherit an accurate world model.", {
    true: "The directive changes at least one tracked scene state field",
    false: "The scene state is unchanged by this directive"
  }, "none"),
  score("scene_state_diff", "Scene state diff", "state_accuracy", "verify", "How much did this directive move the scene's tension?", "Supplies the per-turn tension delta that the persisted scene state advances by.", [
    "Tension fell sharply; the scene decompressed",
    "Tension eased slightly",
    "Tension is unchanged",
    "Tension rose slightly",
    "Tension rose sharply; the scene is now wound much tighter"
  ], "none", 2, 2),
  score("relationship_deltas", "Relationship deltas", "state_accuracy", "verify", "In this directive, how did the most affected character's stance toward the player change?", "Records the per-character shift in stance so later dialogue and action reflect the new relationship.", [
    "Markedly more hostile or distrustful",
    "Slightly cooler or more guarded",
    "Unchanged",
    "Slightly warmer or more trusting",
    "Markedly more trusting, indebted, or attached"
  ], "none", 2, 2),
  choice("thread_lifecycle", "Thread lifecycle", "state_accuracy", "verify", "What is the state of the story thread this directive develops?", "Closes or parks threads deliberately so the open-thread list stays meaningful.", {
    continue: "Still open and worth developing further",
    resolve: "Brought to a genuine conclusion by this directive",
    dormant: "Parked for now, still open but not active",
    abandoned: "Dropped; this thread is no longer part of the story"
  }, "none", "continue", "abandoned"),
  score("emotional_release", "Emotional release", "narrative", "gate", "Given `chat_history` and `scene_state`, how much does the accumulated tension in this scene need a release right now?", "Stops the Director from holding tension forever, which is the usual way a slow scene becomes tiring.", [
    "Hold the tension; a release now would deflate the scene",
    "Ease the tension very slightly",
    "Neutral; no release is needed either way",
    "A short release would help the scene breathe",
    "The scene urgently needs a release, comic beat, or quiet moment"
  ], "run", 2, 2),
  noul("foreshadowing", "Foreshadowing", "narrative", "gate", "Should this turn plant a small seed for a future development without paying it off now?", "Encourages deliberate setup so later revelations feel earned rather than abrupt.", {
    true: "A detail could be planted now that would pay off later without drawing attention",
    false: "A planted detail would read as conspicuous, or there is nothing worth setting up"
  }, "run"),
  noul("callback", "Callback", "narrative", "gate", "Does `chat_history` contain an earlier established detail that would land well if it were echoed in this turn?", "Reuses what the story has already built instead of introducing new material by default.", {
    true: "There is an earlier detail whose return would feel meaningful now",
    false: "No earlier detail would land naturally in this turn"
  }, "run"),
  score("hook_prioritization", "Hook prioritization", "narrative", "gate", "Judging by stakes and readiness, how strong is the case for advancing the most promising unresolved hook this turn?", "Ranks open hooks so the Director advances the one that most deserves movement.", [
    "Advance no hook this turn",
    "Weak case; the hooks can wait",
    "Moderate case for advancing the top hook",
    "Strong case; this hook is ready and matters",
    "Advance the top hook now; further delay would deflate it"
  ], "run", 2, 2),
  noul("context_compaction", "Context compaction", "narrative", "gate", "Is `chat_history` long or repetitive enough that older context should be summarised to protect the context window?", "Decides when the Director should spend tokens summarising rather than re-reading old context.", {
    true: "Older context has become long or repetitive enough to be worth summarising",
    false: "The current context is compact enough to keep as it is"
  }, "run"),
  {
    id: "confidence_escalation",
    label: "Confidence escalation",
    primitive: "noul",
    primitiveLabel: "Computed",
    phase: "verify",
    category: "guardrails",
    instructions: "",
    rationale: "Flags every gate answer whose confidence falls below the configured floor so only the uncertain decisions are escalated and logged for the diagnostics view.",
    enabledByDefault: false,
    threshold: 0.55,
    fallback: "none",
    safeValue: true,
    blockValue: false,
    codeOnly: true,
    appliesWhen: "A decision answered below the confidence floor."
  },
  {
    id: "budget_degradation",
    label: "Graceful degradation",
    primitive: "noul",
    primitiveLabel: "Computed",
    phase: "gate",
    category: "guardrails",
    instructions: "",
    rationale: "Detects unavailability, timeout, token-budget exhaustion, and rate limiting, then selects the declared fallback so LumiWorld still runs Director-only.",
    enabledByDefault: false,
    threshold: 0.5,
    fallback: "run",
    safeValue: true,
    blockValue: false,
    codeOnly: true,
    appliesWhen: "Jev was unavailable, timed out, or exceeded the remaining budget."
  }
]);
var GATE_BY_ID = new Map(GATE_CATALOG.map((gate) => [gate.id, gate]));
function directorGuidanceFromGates(records) {
  const lines = [];
  for (const record of records) {
    const definition = GATE_BY_ID.get(record.gateId);
    if (!definition || definition.phase !== "gate" || definition.category === "director_control" && ["smart_trigger", "context_filter", "model_route"].includes(definition.id) || definition.codeOnly || record.usedFallback || record.value === null)
      continue;
    const criteria = definition.criteria;
    let meaning;
    if (definition.primitive === "score" && Array.isArray(criteria) && typeof record.value === "number") {
      meaning = criteria[Math.max(0, Math.min(criteria.length - 1, Math.round(record.value)))];
    } else if (definition.primitive === "noul" && typeof record.value === "boolean" && criteria && !Array.isArray(criteria)) {
      meaning = criteria[String(record.value)];
    } else if (definition.primitive === "choice" && typeof record.value === "string" && criteria && !Array.isArray(criteria)) {
      meaning = criteria[record.value];
    }
    if (meaning)
      lines.push(`- ${definition.label}: ${meaning}.`);
  }
  return lines.length ? `Jev's accepted decisions for this turn. Use these as direction when writing the private note; keep continuity and the player's agency intact.
${lines.join(`
`)}` : null;
}
function resolveGatePolicy(definition, settings) {
  const override = settings.gatePolicy[definition.id];
  const enabled = override?.enabled ?? definition.enabledByDefault;
  const threshold = override?.threshold ?? (definition.id === "confidence_escalation" ? settings.minConfidence : definition.threshold);
  const fallback = override?.fallback ?? definition.fallback;
  return { definition, enabled, threshold, fallback };
}
function resolveAllGatePolicies(settings) {
  return new Map(GATE_CATALOG.map((definition) => [definition.id, resolveGatePolicy(definition, settings)]));
}
function dynamicCriteria(id, context, base) {
  if (id !== "context_filter")
    return base.criteria;
  const options = {
    all: "Every available context source is relevant"
  };
  if (context.hasHistory) {
    options.history_only = "Only the recent exchange matters; drop character sheets and lore";
    options.history_and_character = "Recent chat history and the active character matter; detailed lore does not";
  }
  if (context.hasWorldInfo)
    options.world_info_only = "The activated lore matters more than the recent small talk";
  if (!context.hasCharacter && !context.hasPersona) {
    delete options.history_and_character;
  }
  if (!context.hasWorldInfo)
    delete options.world_info_only;
  return options;
}
function gateApplies(definition, context) {
  switch (definition.id) {
    case "smart_trigger":
      return true;
    case "context_filter":
      return context.hasHistory || context.hasCharacter || context.hasPersona || context.hasWorldInfo;
    case "pacing_control":
    case "story_thread":
    case "arc_position":
    case "focus_selection":
    case "emotional_release":
    case "hook_prioritization":
    case "context_compaction":
    case "callback":
      return context.hasHistory;
    case "foreshadowing":
      return context.hasHistory || (context.jevHasWorldInfo ?? context.hasWorldInfo);
    case "reveal_control":
      return context.hasHistory || (context.jevHasWorldInfo ?? context.hasWorldInfo);
    case "world_movement":
    case "consequence_propagation":
      return context.hasHistory || (context.jevHasWorldInfo ?? context.hasWorldInfo);
    case "scene_state_tracking":
    case "scene_state_diff":
      return context.worldStateEnabled;
    case "relationship_deltas":
    case "thread_lifecycle":
      return context.worldStateEnabled || context.hasHistory;
    default:
      return true;
  }
}
function planGates(phase, settings, context, overrides = {}) {
  const policies = resolveAllGatePolicies(settings);
  const selected = [];
  const skipped = [];
  for (const definition of GATE_CATALOG) {
    if (definition.phase !== phase)
      continue;
    if (definition.codeOnly)
      continue;
    const policy = policies.get(definition.id);
    const forced = overrides[definition.id];
    const enabled = forced !== undefined ? true : policy.enabled;
    if (!enabled) {
      skipped.push(definition.id);
      continue;
    }
    if (!gateApplies(definition, context)) {
      skipped.push(definition.id);
      continue;
    }
    selected.push({
      policy,
      question: {
        type: definition.primitive,
        instructions: definition.instructions,
        ...definition.criteria ? { criteria: dynamicCriteria(definition.id, context, definition) } : {}
      }
    });
  }
  return { gates: selected, skipped };
}
function questionsFromPlan(plan) {
  const questions = {};
  for (const entry of plan.gates)
    questions[entry.policy.definition.id] = entry.question;
  return questions;
}
function matches(value, expected) {
  if (typeof value === "number" && typeof expected === "number")
    return Math.abs(value - expected) < 0.000000001;
  return value === expected;
}
function resolveGateAnswer(policy, rawAnswer, resolveContext) {
  const { definition } = policy;
  const base = {
    gateId: definition.id,
    label: definition.label,
    primitive: definition.primitive,
    phase: definition.phase,
    value: null,
    probability: null,
    confidence: null,
    confidenceDerived: false,
    threshold: policy.threshold,
    escalated: false,
    usedFallback: false,
    fallback: policy.fallback
  };
  if (!rawAnswer) {
    return {
      ...base,
      usedFallback: true,
      note: "Jev returned no answer for this gate, so its fallback applied."
    };
  }
  let value;
  let confidence;
  let probability;
  let confidenceDerived = false;
  let probabilities;
  if (rawAnswer.type === "noul") {
    value = rawAnswer.noul >= 0.5;
    probability = rawAnswer.noul;
    confidence = rawAnswer.noul >= 0.5 ? rawAnswer.noul : 1 - rawAnswer.noul;
    confidenceDerived = true;
  } else if (rawAnswer.type === "choice") {
    value = rawAnswer.choice;
    probabilities = rawAnswer.probabilities;
    probability = rawAnswer.probabilities[rawAnswer.choice] ?? null;
    confidence = rawAnswer.confidence ?? REPORTED_CONFIDENCE;
  } else {
    value = rawAnswer.score;
    probabilities = rawAnswer.probabilities;
    probability = rawAnswer.probabilities[String(Math.round(rawAnswer.score))] ?? null;
    confidence = rawAnswer.confidence ?? REPORTED_CONFIDENCE;
  }
  const escalated = confidence !== null && confidence < Math.max(policy.threshold, resolveContext.minConfidence);
  const escalatedNote = escalated ? `Confidence ${confidence !== null ? confidence.toFixed(2) : "unknown"} is below the ${Math.max(policy.threshold, resolveContext.minConfidence).toFixed(2)} floor, so the fallback applied.` : undefined;
  return {
    ...base,
    value,
    probability,
    confidence,
    confidenceDerived,
    escalated,
    usedFallback: escalated,
    probabilities,
    note: escalatedNote ?? (confidenceDerived ? "Noul answers carry no confidence; this value is derived from the probability." : undefined)
  };
}
function resolveGateAnswers(plan, answers, minConfidence) {
  return plan.gates.map((entry) => resolveGateAnswer(entry.policy, answers[entry.policy.definition.id], { minConfidence }));
}
function gateRecordById(records, gateId) {
  return records.find((record) => record.gateId === gateId);
}
function shouldRunDirector(records) {
  const trigger = gateRecordById(records, "smart_trigger");
  if (!trigger)
    return { run: true, reason: null };
  if (trigger.usedFallback || trigger.value === null)
    return { run: true, reason: null };
  if (matches(trigger.value, true))
    return { run: true, reason: null };
  return { run: false, reason: "Jev judged that this turn does not need Director intervention." };
}
function contextFilterDecision(records) {
  const record = gateRecordById(records, "context_filter");
  if (!record || record.usedFallback || typeof record.value !== "string")
    return null;
  switch (record.value) {
    case "all":
      return { keepHistory: true, keepCharacter: true, keepPersona: true, keepWorldInfo: true };
    case "history_and_character":
      return { keepHistory: true, keepCharacter: true, keepPersona: false, keepWorldInfo: false };
    case "world_info_only":
      return { keepHistory: false, keepCharacter: false, keepPersona: false, keepWorldInfo: true };
    case "history_only":
      return { keepHistory: true, keepCharacter: false, keepPersona: false, keepWorldInfo: false };
    default:
      return null;
  }
}
function wantsStrongDirectorModel(records) {
  const record = gateRecordById(records, "model_route");
  if (!record || record.usedFallback)
    return false;
  return record.value === "strong";
}
function decideRepair(records) {
  const strategy = gateRecordById(records, "repair_strategy");
  const chosen = typeof strategy?.value === "string" && !strategy.usedFallback ? strategy.value : null;
  const violation = (gateId, blockingValue) => {
    const record = gateRecordById(records, gateId);
    if (!record || record.usedFallback || record.value === null)
      return;
    return matches(record.value, blockingValue) ? record : undefined;
  };
  if (violation("player_agency", true)) {
    return { action: chosen && chosen !== "accept" ? chosen : "patch", reason: "The draft directive decided something for the player's character." };
  }
  const duplicate = violation("duplicate_suppression", "repeats") ?? violation("duplicate_suppression", "near_duplicate");
  if (duplicate) {
    return { action: chosen && chosen !== "accept" ? chosen : "full_retry", reason: "The draft directive repeats a development that already happened." };
  }
  if (violation("continuity_guard", "violation")) {
    return { action: chosen && chosen !== "accept" ? chosen : "soften", reason: "The draft directive contradicts an established fact." };
  }
  if (violation("intensity_boundary", "out_of_range")) {
    return { action: chosen && chosen !== "accept" ? chosen : "soften", reason: "The draft directive exceeds the established intensity range." };
  }
  if (violation("director_verification", "violation")) {
    return { action: chosen && chosen !== "accept" ? chosen : "full_retry", reason: "Jev's overall verification flagged the draft directive." };
  }
  return null;
}
function assessVerification(records, phaseError = null) {
  if (phaseError)
    return { verdict: "unverified", reason: phaseError, repair: null };
  const checks = [
    { id: "player_agency", clean: false, blocking: [true], action: "patch" },
    { id: "continuity_guard", clean: "consistent", blocking: ["violation"], action: "soften" },
    { id: "duplicate_suppression", clean: "new", blocking: ["repeats", "near_duplicate"], action: "full_retry" },
    { id: "intensity_boundary", clean: "within_range", blocking: ["out_of_range"], action: "soften" }
  ];
  let firstInconclusive = null;
  let found = false;
  for (const check of checks) {
    const record = gateRecordById(records, check.id);
    if (!record)
      continue;
    found = true;
    if (record.usedFallback || record.value === null || record.value !== check.clean && !check.blocking.includes(record.value)) {
      firstInconclusive ??= { reason: `${record.label} was inconclusive.`, action: check.action };
    } else if (check.blocking.includes(record.value)) {
      const reason = `${record.label} found a problem${record.usedFallback ? " with low confidence" : ""}.`;
      if (record.usedFallback)
        firstInconclusive ??= { reason, action: check.action };
      else
        return { verdict: "violation", reason, repair: decideRepair(records) ?? { action: check.action, reason } };
    }
  }
  const overall = gateRecordById(records, "director_verification");
  if (overall?.value === "violation" && !overall.usedFallback) {
    const reason = "Overall Director verification found a problem.";
    return { verdict: "violation", reason, repair: decideRepair(records) ?? { action: "full_retry", reason } };
  }
  if (firstInconclusive)
    return {
      verdict: "inconclusive",
      reason: firstInconclusive.reason,
      repair: { action: firstInconclusive.action, reason: firstInconclusive.reason }
    };
  return { verdict: found ? "clean" : "unverified", reason: found ? null : "No key verification checks ran.", repair: null };
}
function countJevFlags(records) {
  return {
    fallback: records.filter((record) => record.usedFallback).length,
    escalated: records.filter((record) => record.escalated).length
  };
}
function withDegradationGate(records, diagnostics) {
  const definition = GATE_BY_ID.get("budget_degradation");
  const degraded = diagnostics.status !== "ok";
  const record = {
    gateId: definition.id,
    label: definition.label,
    primitive: definition.primitive,
    phase: definition.phase,
    value: degraded,
    probability: null,
    confidence: null,
    confidenceDerived: false,
    threshold: definition.threshold,
    escalated: degraded,
    usedFallback: degraded,
    fallback: definition.fallback,
    note: degraded ? `Jev was unavailable, so LumiWorld ran the Director ungated. ${diagnostics.error ?? diagnostics.reason ?? ""}`.trim() : "Jev answered every gate for this turn."
  };
  return [...records, record];
}
function withConfidenceGate(records, floor) {
  const escalated = records.filter((record) => record.escalated);
  const record = {
    gateId: "confidence_escalation",
    label: "Confidence escalation",
    primitive: "noul",
    phase: "verify",
    value: escalated.length > 0,
    probability: null,
    confidence: null,
    confidenceDerived: false,
    threshold: floor,
    escalated: escalated.length > 0,
    usedFallback: false,
    fallback: "none",
    note: escalated.length ? `Escalated: ${escalated.map((entry) => entry.gateId).join(", ")}.` : "No gate answer fell below the confidence floor."
  };
  return [...records, record];
}

// src/jev.ts
class JevError extends Error {
  status;
  retryAfterMs;
  constructor(message, status = null, retryAfterMs = null) {
    super(message);
    this.status = status;
    this.retryAfterMs = retryAfterMs;
    this.name = "JevError";
  }
}

class JevTimeoutError extends Error {
  constructor(timeoutMs) {
    super(`Jev did not answer within ${Math.round(timeoutMs / 1000)}s.`);
    this.name = "JevTimeoutError";
  }
}

class JevProtocolError extends Error {
  constructor(message) {
    super(message);
    this.name = "JevProtocolError";
  }
}
function readCorsResult(raw) {
  if (raw == null)
    throw new JevProtocolError("Jev request returned no response.");
  if (typeof raw === "string")
    return { status: 200, statusText: "OK", headers: {}, body: raw };
  if (typeof raw !== "object")
    throw new JevProtocolError("Jev request returned an unrecognized response.");
  const obj = raw;
  const body = typeof obj.body === "string" ? obj.body : typeof obj.text === "string" ? obj.text : "";
  const status = typeof obj.status === "number" && Number.isFinite(obj.status) ? obj.status : 200;
  const statusText = typeof obj.statusText === "string" ? obj.statusText : "";
  const headers = obj.headers && typeof obj.headers === "object" && !Array.isArray(obj.headers) ? obj.headers : {};
  return { status, statusText, headers, body };
}
function parseRetryAfterMs(headers) {
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() !== "retry-after")
      continue;
    const seconds = Number(value);
    if (Number.isFinite(seconds) && seconds >= 0)
      return Math.min(30000, seconds * 1000);
    const date = Date.parse(value);
    if (Number.isFinite(date))
      return Math.min(30000, Math.max(0, date - Date.now()));
  }
  return null;
}
function describeHttpFailure(result) {
  const detail = result.body.replace(/\s+/g, " ").trim().slice(0, 240);
  const label = `HTTP ${result.status}${result.statusText ? ` ${result.statusText}` : ""}`;
  return detail ? `Jev request failed (${label}): ${detail}` : `Jev request failed (${label}).`;
}
function jevEndpoint(settings) {
  const provider = resolveJevProvider(settings);
  return `${resolveJevBaseUrl(settings)}${provider.path}`;
}
function buildJevRequest(settings, state, questions) {
  const model = resolveJevModel(settings);
  return {
    url: jevEndpoint(settings),
    headers: {
      Authorization: `Bearer ${settings.apiKey}`,
      "Content-Type": "application/json",
      Accept: "application/json"
    },
    body: JSON.stringify({ model, state, questions }),
    model
  };
}
function asRecord2(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}
function readProbability(value) {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n))
    return null;
  return Math.min(1, Math.max(0, n));
}
function readProbabilityMap(value) {
  const obj = asRecord2(value);
  const out = {};
  for (const [key, raw] of Object.entries(obj)) {
    const probability = readProbability(raw);
    if (probability !== null)
      out[key] = probability;
  }
  return out;
}
function readStringMap(value) {
  const obj = asRecord2(value);
  const out = {};
  for (const [key, raw] of Object.entries(obj)) {
    if (typeof raw === "string" && raw.trim())
      out[key] = raw;
  }
  return out;
}
function normalizeAnswer(value) {
  const obj = asRecord2(value);
  const type = typeof obj.type === "string" ? obj.type : "";
  if (type === "noul") {
    const noul = readProbability(obj.noul);
    return noul === null ? null : { type: "noul", noul };
  }
  if (type === "choice") {
    const choice = typeof obj.choice === "string" ? obj.choice : "";
    if (!choice.trim())
      return null;
    return {
      type: "choice",
      choice: choice.trim(),
      probabilities: readProbabilityMap(obj.probabilities),
      confidence: readProbability(obj.confidence)
    };
  }
  if (type === "score") {
    const score = typeof obj.score === "number" ? obj.score : Number(obj.score);
    if (!Number.isFinite(score))
      return null;
    return {
      type: "score",
      score,
      legend: readStringMap(obj.legend),
      probabilities: readProbabilityMap(obj.probabilities),
      confidence: readProbability(obj.confidence)
    };
  }
  return null;
}
function normalizeJevResponse(raw) {
  const envelope = asRecord2(raw);
  if (Object.keys(envelope).length === 0) {
    throw new JevProtocolError("Jev returned a response that was not a JSON object.");
  }
  if (envelope.error) {
    const message = typeof envelope.error === "string" ? envelope.error : JSON.stringify(envelope.error);
    throw new JevProtocolError(`Jev reported an error: ${message.slice(0, 240)}`);
  }
  const answersRecord = asRecord2(envelope.answers);
  if (Object.keys(answersRecord).length === 0) {
    throw new JevProtocolError("Jev returned no answers.");
  }
  const answers = {};
  for (const [id, value] of Object.entries(answersRecord)) {
    const answer = normalizeAnswer(value);
    if (answer)
      answers[id] = answer;
  }
  const usage = asRecord2(envelope.usage);
  const nullableNumber = (value) => {
    const n = typeof value === "number" ? value : Number(value);
    return Number.isFinite(n) ? n : null;
  };
  return {
    model: typeof envelope.model === "string" && envelope.model.trim() ? envelope.model.trim() : null,
    usage: {
      inputTokens: nullableNumber(usage.input_tokens ?? usage.inputTokens),
      outputTokens: nullableNumber(usage.output_tokens ?? usage.outputTokens),
      costUsd: nullableNumber(usage.cost ?? usage.cost_usd ?? usage.costUsd)
    },
    answers
  };
}
function parseJevBody(body) {
  const text = body.trim();
  if (!text)
    throw new JevProtocolError("Jev returned an empty response body.");
  try {
    return JSON.parse(text);
  } catch {
    throw new JevProtocolError("Jev returned a response body that was not valid JSON.");
  }
}
function withDeadline(work, timeoutMs, onTimeout) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(onTimeout()), Math.max(1, timeoutMs));
    work.then((value) => {
      clearTimeout(timer);
      resolve(value);
    }, (error) => {
      clearTimeout(timer);
      reject(error);
    });
    work.catch(() => {});
  });
}
function remainingBudgetMs(startedAt, budgetMs) {
  if (budgetMs === undefined)
    return Number.POSITIVE_INFINITY;
  return budgetMs - (Date.now() - startedAt);
}
async function callJev(options) {
  const startedAt = Date.now();
  const timeoutMs = options.timeoutMs ?? options.config.timeoutMs ?? DEFAULT_JEV_TIMEOUT_MS;
  const request = buildJevRequest(options.config, options.state, options.questions);
  let requests = 0;
  const attempts = [];
  const attempt = async () => {
    requests += 1;
    const attemptStartedAt = Date.now();
    let recordedResponse = false;
    const budget = remainingBudgetMs(startedAt, options.budgetMs);
    const effective = Math.max(250, Math.min(timeoutMs, Number.isFinite(budget) ? budget : timeoutMs));
    try {
      const raw = await withDeadline(options.cors(request.url, {
        method: "POST",
        headers: request.headers,
        body: request.body
      }), effective, () => new JevTimeoutError(effective));
      const result = readCorsResult(raw);
      attempts.push({ status: result.status, body: result.body, error: null, durationMs: Date.now() - attemptStartedAt });
      recordedResponse = true;
      if (result.status === 429 || result.status >= 500) {
        return {
          retryAfterMs: parseRetryAfterMs(result.headers),
          error: new JevError(describeHttpFailure(result), result.status, parseRetryAfterMs(result.headers))
        };
      }
      if (result.status < 200 || result.status >= 300) {
        throw new JevError(describeHttpFailure(result), result.status);
      }
      return { response: normalizeJevResponse(parseJevBody(result.body)) };
    } catch (error) {
      if (!recordedResponse)
        attempts.push({
          status: null,
          body: null,
          error: error instanceof Error ? error.message : String(error),
          durationMs: Date.now() - attemptStartedAt
        });
      if (error instanceof JevError || error instanceof JevTimeoutError)
        throw error;
      if (error instanceof Error && error.name === "AbortError") {
        throw new JevTimeoutError(effective);
      }
      throw new JevError(error instanceof Error ? error.message : String(error));
    }
  };
  const retryable = options.retryOnRateLimit ?? options.config.retryOnRateLimit ?? true;
  try {
    let outcome;
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
        attempts
      };
    }
    if ("error" in outcome) {
      const waitMs = outcome.retryAfterMs ?? 750;
      const budgetLeft = remainingBudgetMs(startedAt, options.budgetMs);
      const deadlineLeft = timeoutMs - (Date.now() - startedAt);
      const canRetry = retryable && waitMs + 250 < budgetLeft && waitMs + 250 < deadlineLeft;
      if (!canRetry) {
        return {
          ok: false,
          response: null,
          error: outcome.error.message,
          timedOut: false,
          requests,
          durationMs: Date.now() - startedAt,
          request,
          attempts
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
            attempts
          };
        }
        return { ok: true, response: retry.response, error: null, timedOut: false, requests, durationMs: Date.now() - startedAt, request, attempts };
      } catch (error) {
        return {
          ok: false,
          response: null,
          error: error instanceof Error ? error.message : String(error),
          timedOut: error instanceof JevTimeoutError,
          requests,
          durationMs: Date.now() - startedAt,
          request,
          attempts
        };
      }
    }
    return { ok: true, response: outcome.response, error: null, timedOut: false, requests, durationMs: Date.now() - startedAt, request, attempts };
  } catch (error) {
    return {
      ok: false,
      response: null,
      error: error instanceof Error ? error.message : String(error),
      timedOut: error instanceof JevTimeoutError,
      requests,
      durationMs: Date.now() - startedAt,
      request,
      attempts
    };
  }
}
function truncate(value, budget) {
  const text = value.trim();
  if (budget <= 0)
    return "";
  if (text.length <= budget)
    return text;
  const notice = `
[... truncated ...]`;
  return `${text.slice(0, Math.max(0, budget - notice.length)).trimEnd()}${notice}`;
}
function renderHistory(history, limit, budget) {
  if (limit <= 0 || budget <= 0)
    return [];
  const selected = history.slice(-Math.min(limit, MAX_JEV_HISTORY_MESSAGES));
  const lines = selected.map((message) => {
    const content = serializeMessageContent(message.content).replace(/\s+/g, " ").trim();
    const name = message.name ? ` (${message.name})` : "";
    return `${message.role}${name}: ${content || "[empty]"}`;
  });
  const kept = [];
  let used = 0;
  for (let index = lines.length - 1;index >= 0; index -= 1) {
    const line = lines[index];
    const room = budget - used;
    if (room <= 0)
      break;
    if (line.length > room) {
      if (line.length < 40)
        break;
      kept.unshift(`${line.slice(0, Math.max(0, room - 16)).trimEnd()}
[... cut ...]`);
      break;
    }
    kept.unshift(line);
    used += line.length + 1;
  }
  return kept;
}
var STATE_FIELD_SHARES = [
  { key: "latest_player_action", share: 0.12, min: 120 },
  { key: "character", share: 0.18, min: 200 },
  { key: "world_info", share: 0.2, min: 200 },
  { key: "user_persona", share: 0.08, min: 120 },
  { key: "scene_state", share: 0.12, min: 120 },
  { key: "director_notes", share: 0.06, min: 80 },
  { key: "draft_directive", share: 0.12, min: 120 }
];
function fieldCost(key, value) {
  return JSON.stringify(key).length + 2 + JSON.stringify(value).length + 1;
}
function buildJevState(context, worldStateContext) {
  const cap = Math.max(500, context.settings.maxStateChars || DEFAULT_JEV_STATE_CHARS);
  const historyLimit = Math.max(0, Math.min(context.settings.historyMessageLimit, MAX_JEV_HISTORY_MESSAGES));
  const optional = {};
  const addOptional = (key, value) => {
    const text = typeof value === "string" ? value.trim() : "";
    if (text)
      optional[key] = text;
  };
  addOptional("character", context.characterSummary);
  addOptional("latest_player_action", context.latestPlayerAction);
  addOptional("world_info", context.worldInfoSummary);
  addOptional("user_persona", context.personaSummary);
  addOptional("scene_state", typeof worldStateContext === "string" ? worldStateContext : undefined);
  addOptional("director_notes", context.directorNotes);
  addOptional("draft_directive", context.draftDirective);
  let compacted = false;
  const build = (shrink) => {
    const state = { generation_type: context.generationType || "normal" };
    let used = JSON.stringify(state).length;
    let truncatedAny = false;
    for (const { key, share, min } of STATE_FIELD_SHARES) {
      const text = optional[key];
      if (!text)
        continue;
      const allowance = Math.min(Math.max(min, Math.floor(cap * share * shrink)), Math.max(min, cap - 200));
      const trimmed = truncate(text, allowance);
      if (trimmed.length < text.length)
        truncatedAny = true;
      const cost = fieldCost(key, trimmed);
      if (used + cost > cap) {
        truncatedAny = true;
        continue;
      }
      state[key] = trimmed;
      used += cost;
    }
    if (historyLimit > 0 && context.history.length > 0) {
      const available = Math.max(0, cap - used - 18);
      const lines = renderHistory(context.history, historyLimit, available);
      if (lines.length < Math.min(context.history.length, historyLimit))
        truncatedAny = true;
      if (lines.length)
        state.chat_history = lines;
    }
    if (truncatedAny)
      compacted = true;
    return state;
  };
  let shrink = 1;
  let state = build(shrink);
  let chars = JSON.stringify(state).length;
  while (chars > cap && shrink > 0.05) {
    shrink = shrink > 0.5 ? 0.35 : shrink > 0.15 ? 0.1 : 0.02;
    state = build(shrink);
    chars = JSON.stringify(state).length;
  }
  if (chars > cap) {
    for (const key of ["director_notes", "scene_state", "user_persona", "world_info", "character", "draft_directive", "latest_player_action"]) {
      if (chars <= cap)
        break;
      if (!(key in state))
        continue;
      delete state[key];
      chars = JSON.stringify(state).length;
    }
  }
  return { state, chars, compacted };
}
function estimateJevTokens(state, questions) {
  const payload = JSON.stringify({ state, questions });
  return Math.ceil(payload.length / 4);
}
function exceedsJevTokenBudget(state, questions) {
  return estimateJevTokens(state, questions) > JEV_MAX_STATE_TOKENS;
}
function buildJevSmokeRequest(settings) {
  const questions = {
    connectivity: {
      type: "noul",
      instructions: "Does this statement describe a storm?",
      criteria: {
        true: "The statement mentions a storm, tempest, thunder, or violent weather",
        false: "The statement mentions anything else"
      }
    }
  };
  return { request: buildJevRequest(settings, "A storm rolls in over the harbour.", questions), questions };
}

// src/world-state.ts
var WORLD_STATE_VERSION = 1;
var MAX_HOOKS = 12;
var MAX_THREADS = 12;
var MAX_CHARACTERS = 16;
var MAX_RELATIONSHIPS = 16;
var MAX_LABEL_CHARS = 160;
function defaultWorldState() {
  return {
    version: WORLD_STATE_VERSION,
    turn: 0,
    location: null,
    danger: 0,
    tension: 0,
    characters: [],
    hooks: [],
    threads: [],
    relationships: [],
    clockMinutes: 0,
    updatedAt: 0
  };
}
function asRecord3(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}
function clampLevel(value, fallback) {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n))
    return fallback;
  return Math.min(5, Math.max(0, n));
}
function cleanLabel(value) {
  if (typeof value !== "string")
    return "";
  return value.replace(/\s+/g, " ").trim().slice(0, MAX_LABEL_CHARS);
}
var DIRECTIVE_PREFIX = /^(?:Have|Let|Keep|Make|Cut|Plant|Pressure|Treat|Escalate|Move|Give|Show|Leave|Withhold)\b/i;
function looksLikeDirectiveProse(label) {
  return label.length >= 50 && DIRECTIVE_PREFIX.test(label) && /[.,;:]/.test(label);
}
function validateThreadLabel(value) {
  if (typeof value !== "string")
    return null;
  const label = value.replace(/\s+/g, " ").trim();
  if (label.length < 3 || label.length > 80 || /[.!?;\n]/.test(label) || DIRECTIVE_PREFIX.test(label))
    return null;
  return label;
}
function normalizeStringList(value, limit) {
  if (!Array.isArray(value))
    return [];
  const seen = new Set;
  const out = [];
  for (const item of value) {
    const label = cleanLabel(item);
    if (!label || seen.has(label.toLowerCase()))
      continue;
    seen.add(label.toLowerCase());
    out.push(label);
    if (out.length >= limit)
      break;
  }
  return out;
}
function normalizeHooks(value) {
  if (!Array.isArray(value))
    return [];
  const out = [];
  for (const item of value) {
    const obj = asRecord3(item);
    const label = cleanLabel(obj.label);
    if (!label)
      continue;
    out.push({
      id: cleanLabel(obj.id) || `hook-${out.length + 1}`,
      label,
      lastAdvanced: Number.isFinite(Number(obj.lastAdvanced)) ? Number(obj.lastAdvanced) : 0,
      stale: obj.stale === true
    });
    if (out.length >= MAX_HOOKS)
      break;
  }
  return out;
}
function normalizeThreads(value) {
  if (!Array.isArray(value))
    return [];
  const statuses = new Set(["open", "resolved", "dormant", "abandoned"]);
  const out = [];
  for (const item of value) {
    const obj = asRecord3(item);
    const label = cleanLabel(obj.label);
    if (!label || looksLikeDirectiveProse(label))
      continue;
    const status = cleanLabel(obj.status);
    out.push({
      id: cleanLabel(obj.id) || `thread-${out.length + 1}`,
      label,
      status: statuses.has(status) ? status : "open",
      lastAdvanced: Number.isFinite(Number(obj.lastAdvanced)) ? Number(obj.lastAdvanced) : 0
    });
    if (out.length >= MAX_THREADS)
      break;
  }
  return out;
}
function normalizeRelationships(value) {
  if (!Array.isArray(value))
    return [];
  const out = [];
  for (const item of value) {
    const obj = asRecord3(item);
    const character = cleanLabel(obj.character);
    if (!character)
      continue;
    const stance = Number(obj.stance);
    out.push({
      character,
      stance: Number.isFinite(stance) ? Math.min(10, Math.max(-10, stance)) : 0,
      updatedTurn: Number.isFinite(Number(obj.updatedTurn)) ? Number(obj.updatedTurn) : 0
    });
    if (out.length >= MAX_RELATIONSHIPS)
      break;
  }
  return out;
}
function normalizeWorldState(value) {
  const obj = asRecord3(value);
  if (Object.keys(obj).length === 0)
    return defaultWorldState();
  const location = cleanLabel(obj.location);
  return {
    version: WORLD_STATE_VERSION,
    turn: Number.isFinite(Number(obj.turn)) ? Math.max(0, Math.floor(Number(obj.turn))) : 0,
    location: location || null,
    danger: clampLevel(obj.danger, 0),
    tension: clampLevel(obj.tension, 0),
    characters: normalizeStringList(obj.characters, MAX_CHARACTERS),
    hooks: normalizeHooks(obj.hooks),
    threads: normalizeThreads(obj.threads),
    relationships: normalizeRelationships(obj.relationships),
    clockMinutes: Number.isFinite(Number(obj.clockMinutes)) ? Math.max(0, Math.floor(Number(obj.clockMinutes))) : 0,
    updatedAt: Number.isFinite(Number(obj.updatedAt)) ? Number(obj.updatedAt) : 0
  };
}
function upsertByLabel(list, entry, limit) {
  const index = list.findIndex((item) => item.label.toLowerCase() === entry.label.toLowerCase());
  if (index === -1)
    return [...list, entry].slice(-limit);
  const next = [...list];
  next[index] = entry;
  return next;
}
function applyWorldStatePatch(state, patch, turn) {
  const next = { ...state, turn, updatedAt: Date.now() };
  if (patch.location !== undefined)
    next.location = cleanLabel(patch.location) || null;
  if (patch.danger !== undefined)
    next.danger = clampLevel(patch.danger, next.danger);
  if (patch.tension !== undefined)
    next.tension = clampLevel(patch.tension, next.tension);
  if (patch.characters !== undefined)
    next.characters = normalizeStringList(patch.characters, MAX_CHARACTERS);
  if (patch.clockAdvanceMinutes)
    next.clockMinutes = Math.max(0, next.clockMinutes + Math.floor(patch.clockAdvanceMinutes));
  if (patch.hook) {
    const label = cleanLabel(patch.hook.label);
    if (label) {
      next.hooks = upsertByLabel(next.hooks, {
        id: `hook-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40)}`,
        label,
        lastAdvanced: turn,
        stale: patch.hook.stale === true
      }, MAX_HOOKS);
    }
  }
  if (patch.thread) {
    const label = cleanLabel(patch.thread.label);
    if (label) {
      next.threads = upsertByLabel(next.threads, {
        id: `thread-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40)}`,
        label,
        status: patch.thread.status,
        lastAdvanced: turn
      }, MAX_THREADS);
    }
  }
  if (patch.relationship) {
    const character = cleanLabel(patch.relationship.character);
    if (character) {
      const index = next.relationships.findIndex((item) => item.character.toLowerCase() === character.toLowerCase());
      const existing = index === -1 ? { character, stance: 0, updatedTurn: turn } : next.relationships[index];
      const updated = {
        character,
        stance: Math.min(10, Math.max(-10, existing.stance + patch.relationship.stance)),
        updatedTurn: turn
      };
      const list = [...next.relationships];
      if (index === -1)
        list.push(updated);
      else
        list[index] = updated;
      next.relationships = list.slice(-MAX_RELATIONSHIPS);
    }
  }
  return next;
}
function readChoice(records, gateId) {
  const record = records.find((entry) => entry.gateId === gateId);
  if (!record || record.usedFallback || typeof record.value !== "string")
    return null;
  return record.value;
}
function readNumber(records, gateId) {
  const record = records.find((entry) => entry.gateId === gateId);
  if (!record || record.usedFallback || typeof record.value !== "number")
    return null;
  return record.value;
}
var CLOCK_MINUTES = { none: 0, minutes: 5, hours: 120, day: 1440 };
var THREAD_STATUS = {
  continue: "open",
  resolve: "resolved",
  dormant: "dormant",
  abandoned: "abandoned"
};
function commitWorldState(state, records, threadLabel) {
  const turn = state.turn + 1;
  const patch = {};
  const sceneChanged = records.find((record) => record.gateId === "scene_state_tracking");
  const tensionDelta = readNumber(records, "scene_state_diff");
  const relationshipDelta = readNumber(records, "relationship_deltas");
  const shouldUpdate = sceneChanged ? sceneChanged.value === true && !sceneChanged.usedFallback : tensionDelta !== null || relationshipDelta !== null;
  if (shouldUpdate) {
    if (tensionDelta !== null)
      patch.tension = tensionDelta;
    if (relationshipDelta !== null)
      patch.relationship = { character: "scene", stance: Math.round(relationshipDelta - 2) };
    const clock = readChoice(records, "time_clock");
    if (clock)
      patch.clockAdvanceMinutes = CLOCK_MINUTES[clock] ?? 0;
    const entry = readChoice(records, "npc_entry_exit");
    if (entry === "enter_new")
      patch.hook = { label: "A new character has entered the scene", stale: false };
    const lifecycle = readChoice(records, "thread_lifecycle");
    const status = lifecycle ? THREAD_STATUS[lifecycle] : undefined;
    const label = validateThreadLabel(threadLabel);
    if (status && label && (status === "open" || state.threads.some((thread) => thread.label.toLowerCase() === label.toLowerCase()))) {
      patch.thread = { label, status };
    }
  }
  if (Object.keys(patch).length === 0) {
    return { ...state, turn, updatedAt: Date.now() };
  }
  return applyWorldStatePatch(state, patch, turn);
}
function projectWorldState(state) {
  const lines = [];
  if (state.location)
    lines.push(`Location: ${state.location}`);
  lines.push(`Danger: ${state.danger}/5, Tension: ${state.tension}/5`);
  if (state.characters.length)
    lines.push(`Present: ${state.characters.join(", ")}`);
  const openThreads = state.threads.filter((thread) => thread.status === "open" || thread.status === "dormant");
  if (openThreads.length) {
    lines.push(`Open threads: ${openThreads.map((thread) => `${thread.label} (${thread.status})`).join("; ")}`);
  }
  const activeHooks = state.hooks.filter((hook) => !hook.stale);
  if (activeHooks.length)
    lines.push(`Open hooks: ${activeHooks.map((hook) => hook.label).join("; ")}`);
  if (state.clockMinutes > 0)
    lines.push(`In-world clock: +${state.clockMinutes} minutes since the scene began`);
  if (state.relationships.length) {
    const notable = state.relationships.filter((relationship) => relationship.character !== "scene" && relationship.stance !== 0);
    if (notable.length) {
      lines.push(`Relationship shifts: ${notable.map((relationship) => `${relationship.character} ${relationship.stance > 0 ? "+" : ""}${relationship.stance}`).join(", ")}`);
    }
  }
  return lines.join(`
`);
}
function worldStatePath(chatId) {
  const safe = chatId.replace(/[^A-Za-z0-9._-]/g, "_").slice(0, 120) || "unscoped";
  return `chats/${safe}/world.json`;
}
async function loadWorldState(storage, chatId, userId, enabled = DEFAULT_JEV_SETTINGS.worldStateEnabled) {
  if (!enabled || !chatId || !storage?.getJson)
    return defaultWorldState();
  try {
    const stored = await storage.getJson(worldStatePath(chatId), { fallback: {}, userId: userId ?? undefined });
    return normalizeWorldState(stored);
  } catch {
    return defaultWorldState();
  }
}
async function saveWorldState(storage, chatId, state, userId) {
  if (!chatId || !storage?.setJson)
    return;
  try {
    await storage.setJson(worldStatePath(chatId), state, { indent: 2, userId: userId ?? undefined });
  } catch {}
}

// src/backend.ts
var SETTINGS_PATH = "global/settings.json";
var RUNS_PATH = "global/runs.json";
var INTERCEPTOR_PRIORITY = 150;
var INTERCEPTOR_BUDGET_MS = 300000;
var MAX_JEV_PHASE_MS = 15000;
var DIRECTOR_RESERVE_MS = 20000;
var lastFrontendUserId = null;
var chatUserIds = new Map;
var directorBusy = new KeyedOperationLock;
var runLogWrites = new Map;
var interceptorRegistered = false;
var activeGenerationIds = new Map;
var pendingCommits = new Map;
var generationRunIds = new Map;
function generationChatKey(userId, chatId) {
  return JSON.stringify([userId, chatId]);
}
function generationCommitKey(userId, chatId, generationId) {
  return JSON.stringify([userId, chatId, generationId]);
}

class ControllerTimeoutError extends Error {
  constructor(timeoutMs) {
    super(`LumiWorld controller timed out after ${Math.round(timeoutMs / 1000)}s.`);
    this.name = "ControllerTimeoutError";
  }
}

class EmptyControllerDirectiveError extends Error {
  responseJson;
  constructor(response) {
    super(describeEmptyControllerResponse(response));
    this.name = "EmptyControllerDirectiveError";
    this.responseJson = jsonText(response);
  }
}
function storageApi() {
  return spindle.userStorage;
}
function connectionsApi() {
  return spindle.connections;
}
function chatsApi() {
  return spindle.chats;
}
function charactersApi() {
  return spindle.characters;
}
function personasApi() {
  return spindle.personas;
}
function worldBooksApi() {
  return spindle.world_books;
}
function enclaveApi() {
  return spindle.enclave;
}
function corsApi() {
  const cors = spindle?.cors;
  return typeof cors === "function" ? (url, options) => cors.call(spindle, url, options) : null;
}
function permissionsApi() {
  return spindle.permissions;
}
var PERMISSION_IDS = {
  interceptor: "interceptor",
  generation: "generation",
  chats: "chats",
  characters: "characters",
  personas: "personas",
  worldBooks: "world_books",
  corsProxy: "cors_proxy"
};
function send(message, userId = lastFrontendUserId ?? undefined) {
  spindle.sendToFrontend(message, userId);
}
function permissionHas(permission) {
  const permissions = permissionsApi();
  if (!permissions || typeof permissions.has !== "function")
    return true;
  try {
    return !!permissions.has(PERMISSION_IDS[permission]);
  } catch {
    return false;
  }
}
function currentPermissions() {
  return {
    interceptor: permissionHas("interceptor"),
    generation: permissionHas("generation"),
    chats: permissionHas("chats"),
    characters: permissionHas("characters"),
    personas: permissionHas("personas"),
    worldBooks: permissionHas("worldBooks"),
    corsProxy: permissionHas("corsProxy")
  };
}
function rememberChatUser(chatId, userId) {
  if (!chatId || !userId)
    return;
  chatUserIds.set(chatId, userId);
}
function resolveUserId(chatId, contextUserId) {
  if (typeof contextUserId === "string" && contextUserId.trim())
    return contextUserId.trim();
  if (chatId) {
    const mapped = chatUserIds.get(chatId);
    if (mapped)
      return mapped;
  }
  return lastFrontendUserId;
}
function extractContextUserId(value) {
  if (!value || typeof value !== "object")
    return null;
  const raw = value.userId ?? value.user_id;
  return typeof raw === "string" && raw.trim() ? raw.trim() : null;
}
function extractDryRun(value) {
  if (!value || typeof value !== "object")
    return false;
  const raw = value.dryRun ?? value.dry_run;
  return raw === true;
}
function extractChatId(value) {
  if (!value || typeof value !== "object")
    return null;
  const raw = value.chatId ?? value.chat_id;
  return typeof raw === "string" && raw.trim() ? raw : null;
}
function extractGenerationId(value) {
  if (!value || typeof value !== "object")
    return null;
  const raw = value.generationId ?? value.generation_id;
  return typeof raw === "string" && raw.trim() ? raw.trim() : null;
}
function extractGenerationType(value) {
  if (!value || typeof value !== "object")
    return "normal";
  const raw = value.generationType ?? value.generation_type;
  return typeof raw === "string" && raw.trim() ? raw : "normal";
}
function extractConnectionId(value) {
  if (!value || typeof value !== "object")
    return "";
  const raw = value.connectionId ?? value.connection_id;
  return typeof raw === "string" ? raw : "";
}
function readContextString(value, keys) {
  if (!value || typeof value !== "object")
    return null;
  const obj = value;
  for (const key of keys) {
    const raw = obj[key];
    if (typeof raw === "string" && raw.trim())
      return raw.trim();
  }
  return null;
}
function extractPersonaId(value) {
  return readContextString(value, ["personaId", "persona_id"]);
}
function extractCharacterId(value) {
  return readContextString(value, ["characterId", "character_id", "targetCharacterId", "target_character_id"]);
}
function directorBusyKey(userId, chatId) {
  return `${userId || "user"}:${chatId || "no-chat"}`;
}
function toConnectionOption(connection) {
  return {
    id: String(connection.id || ""),
    name: String(connection.name || "Unnamed connection"),
    provider: String(connection.provider || ""),
    model: String(connection.model || ""),
    isDefault: !!(connection.is_default ?? connection.isDefault),
    hasApiKey: !!(connection.has_api_key ?? connection.hasApiKey)
  };
}
function toConnectionLike(connection) {
  return {
    ...toConnectionOption(connection),
    api_url: typeof connection.api_url === "string" ? connection.api_url : ""
  };
}
async function ensureFolders(userId) {
  await storageApi().mkdir("global", userId ?? undefined).catch(() => {});
}
async function loadSettings(userId) {
  try {
    const stored = await storageApi().getJson(SETTINGS_PATH, {
      fallback: DEFAULT_SETTINGS,
      userId: userId ?? undefined
    });
    return normalizeSettings(stored);
  } catch {
    return DEFAULT_SETTINGS;
  }
}
async function saveSettings(patch, userId) {
  await ensureFolders(userId);
  const stored = await storageApi().getJson(SETTINGS_PATH, { fallback: {}, userId: userId ?? undefined });
  const legacy = stored && typeof stored === "object" && !Array.isArray(stored) ? stored : {};
  const next = normalizeSettings({ ...legacy, ...patch });
  await storageApi().setJson(SETTINGS_PATH, { ...legacy, ...next }, { indent: 2, userId: userId ?? undefined });
  return next;
}
async function loadRuns(userId, limit = DEFAULT_SETTINGS.runLogLimit) {
  try {
    const stored = await storageApi().getJson(RUNS_PATH, {
      fallback: [],
      userId: userId ?? undefined
    });
    return normalizeRunLog(stored, limit);
  } catch {
    return [];
  }
}
async function recordRun(entry, userId, settings) {
  const key = userId ?? "global";
  const previous = runLogWrites.get(key) ?? Promise.resolve();
  const write = previous.catch(() => {}).then(async () => {
    try {
      const resolvedSettings = settings ?? await loadSettings(userId);
      const stored = await storageApi().getJson(RUNS_PATH, { fallback: [], userId: userId ?? undefined });
      const raw = Array.isArray(stored) ? stored : [];
      const existing = normalizeRunLog(raw, Number.MAX_SAFE_INTEGER);
      const legacy = raw.filter((run) => !!run && typeof run === "object" && !Array.isArray(run) && run.channel === "world_agent");
      const priorDirector = existing.filter((run) => run.channel !== "world_agent");
      const director = appendRunLog(entry.status.startsWith("test_") || entry.generationType === "test" ? priorDirector : priorDirector.map(stripFullTurnText), entry, resolvedSettings.runLogLimit);
      const next = [...director, ...legacy].sort((a, b) => Number(b.timestamp) - Number(a.timestamp));
      await storageApi().setJson(RUNS_PATH, next, { indent: 2, userId: userId ?? undefined });
      send({ type: "run_logged", run: entry }, userId ?? undefined);
    } catch (error) {
      spindle.log.warn(`LumiWorld could not record run: ${error instanceof Error ? error.message : String(error)}`);
    }
  });
  runLogWrites.set(key, write);
  await write;
  if (runLogWrites.get(key) === write)
    runLogWrites.delete(key);
}
async function recordTurnRun(entry, userId, settings) {
  const trace = entry.trace;
  if (userId && trace?.generationOutcome === "pending" && trace.chatId && trace.generationId && activeGenerationIds.get(generationChatKey(userId, trace.chatId)) !== trace.generationId) {
    trace.generationOutcome = "unknown";
    if (trace.worldStateOutcome === "pending")
      trace.worldStateOutcome = "discarded";
  }
  await recordRun(entry, userId, settings);
  if (userId && trace?.generationOutcome === "pending" && trace.chatId && trace.generationId) {
    generationRunIds.set(generationCommitKey(userId, trace.chatId, trace.generationId), entry.id);
  }
}
async function patchRunTrace(userId, runId, patch) {
  const previous = runLogWrites.get(userId) ?? Promise.resolve();
  const write = previous.catch(() => {}).then(async () => {
    try {
      const stored = await storageApi().getJson(RUNS_PATH, { fallback: [], userId });
      if (!Array.isArray(stored))
        return;
      const index = stored.findIndex((value) => value && typeof value === "object" && value.id === runId);
      if (index < 0)
        return;
      const current = stored[index];
      if (!current.trace)
        return;
      const updated = { ...current, trace: { ...current.trace, ...patch } };
      const next = [...stored];
      next[index] = updated;
      await storageApi().setJson(RUNS_PATH, next, { indent: 2, userId });
      send({ type: "run_logged", run: updated }, userId);
    } catch (error) {
      spindle.log.warn(`LumiWorld could not update turn trace: ${error instanceof Error ? error.message : String(error)}`);
    }
  });
  runLogWrites.set(userId, write);
  await write;
  if (runLogWrites.get(userId) === write)
    runLogWrites.delete(userId);
}
function stripFullTurnText(run) {
  if (!run.trace && !run.jev?.phases?.length && !run.jev?.revision)
    return run;
  return {
    ...run,
    trace: null,
    jev: run.jev ? {
      ...run.jev,
      phases: run.jev.phases.map((phase) => ({ ...phase, requestJson: null, responseJson: null })),
      revision: run.jev.revision ? { ...run.jev.revision, promptJson: null, revisedDirective: null, responseJson: null } : null
    } : null
  };
}
function jsonText(value) {
  try {
    return JSON.stringify(value);
  } catch {
    return null;
  }
}
async function listConnections(userId) {
  if (!permissionHas("generation")) {
    return {
      connections: [],
      error: "Generation permission is not granted, so LumiWorld cannot list LLM connection profiles."
    };
  }
  try {
    const rows = await connectionsApi().list(userId ?? undefined);
    const connections = (Array.isArray(rows) ? rows : []).map(toConnectionOption).filter((connection) => connection.id).sort((left, right) => left.name.localeCompare(right.name));
    return { connections, error: null };
  } catch (error) {
    const description = error instanceof Error ? error.message : String(error);
    spindle.log.warn(`LumiWorld could not list connection profiles: ${description}`);
    return {
      connections: [],
      error: `Could not list LLM connection profiles: ${description}`
    };
  }
}
async function getConnection(connectionId, userId) {
  if (!connectionId || !permissionHas("generation"))
    return null;
  try {
    const connection = await connectionsApi().get(connectionId, userId ?? undefined);
    return connection ? toConnectionLike(connection) : null;
  } catch {
    return null;
  }
}
function section(label, value) {
  const text = typeof value === "string" ? value.trim() : "";
  return text ? `${label}:
${text}` : null;
}
function personaName(persona) {
  return typeof persona?.name === "string" && persona.name.trim() ? persona.name.trim() : "User";
}
function characterName(character) {
  return typeof character?.name === "string" && character.name.trim() ? character.name.trim() : "Character";
}
function makeIdentity(persona, character) {
  return {
    userName: personaName(persona),
    characterName: characterName(character)
  };
}
function identityText(value, identity) {
  return typeof value === "string" ? resolveIdentityMacros(value, identity) : null;
}
function formatPersonaContext(persona, identity) {
  return [
    `Name: ${persona.name}`,
    section("Title", identityText(persona.title, identity)),
    section("Description", identityText(persona.description, identity)),
    persona.is_default ? "Default persona: yes" : null,
    persona.is_narrator === true ? "Narrator persona: yes" : null
  ].filter(Boolean).join(`

`);
}
function formatCharacterContext(character, identity) {
  return [
    `Name: ${character.name}`,
    section("Description", identityText(character.description, identity)),
    section("Personality", identityText(character.personality, identity))
  ].filter(Boolean).join(`

`);
}
async function resolvePersona(context, userId) {
  if (!permissionHas("personas"))
    return null;
  try {
    const personaId = extractPersonaId(context);
    return personaId ? await personasApi().get(personaId, userId ?? undefined) : await personasApi().getActive(userId ?? undefined);
  } catch (error) {
    spindle.log.warn(`LumiWorld could not resolve active user persona: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
}
async function resolveCharacter(context, chatId, userId) {
  if (!permissionHas("characters"))
    return null;
  try {
    let characterId = extractCharacterId(context);
    if (!characterId && chatId && permissionHas("chats")) {
      const chat = await chatsApi().get(chatId, userId ?? undefined);
      characterId = typeof chat?.character_id === "string" && chat.character_id.trim() ? chat.character_id.trim() : null;
    }
    if (!characterId)
      return null;
    return await charactersApi().get(characterId, userId ?? undefined);
  } catch (error) {
    spindle.log.warn(`LumiWorld could not resolve active character: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
}
async function readJevKey(provider, userId) {
  const enclave = enclaveApi();
  if (!enclave || typeof enclave.get !== "function")
    return null;
  try {
    const value = await enclave.get(jevSecretKey(provider), userId ?? undefined);
    return typeof value === "string" && value.trim() ? value.trim() : null;
  } catch {
    return null;
  }
}
async function storeJevKey(provider, key, userId) {
  const enclave = enclaveApi();
  if (!enclave || typeof enclave.put !== "function") {
    throw new Error("This Lumiverse host does not expose encrypted secret storage.");
  }
  const value = key.trim();
  if (!value)
    return;
  await enclave.put(jevSecretKey(provider), value, userId ?? undefined);
}
async function clearJevKey(provider, userId) {
  const enclave = enclaveApi();
  if (!enclave || typeof enclave.delete !== "function")
    return;
  try {
    await enclave.delete(jevSecretKey(provider), userId ?? undefined);
  } catch (error) {
    spindle.log.warn(`LumiWorld could not clear the Jev key: ${error instanceof Error ? error.message : String(error)}`);
  }
}
function jevPhaseBudgetMs(settings) {
  const elapsed = 0;
  const available = INTERCEPTOR_BUDGET_MS - DIRECTOR_RESERVE_MS - elapsed;
  return Math.max(1000, Math.min(settings.jev.timeoutMs, MAX_JEV_PHASE_MS, available));
}
async function prepareJev(settings, userId) {
  const jev = settings.jev;
  if (!jev.enabled)
    return { enabled: false, config: null, cors: null, error: null };
  if (!permissionHas("corsProxy")) {
    return { enabled: false, config: null, cors: null, error: "The cors_proxy permission is not granted, so Jev cannot be reached." };
  }
  const cors = corsApi();
  if (!cors)
    return { enabled: false, config: null, cors: null, error: "This Lumiverse host does not expose the CORS proxy." };
  const apiKey = await readJevKey(jev.provider, userId);
  if (!apiKey) {
    return {
      enabled: false,
      config: null,
      cors,
      error: `No Jev API key is stored for ${resolveJevProvider(jev).label}. Add one in the LumiWorld drawer.`
    };
  }
  return { enabled: true, config: { ...jev, apiKey }, cors, error: null };
}
function recoverAnswers(answers) {
  const recovered = { ...answers };
  const source = answers;
  const nested = source.answers ?? readObjectPath(source, ["data", "answers"]) ?? readObjectPath(source, ["result", "answers"]);
  if (nested && typeof nested === "object" && !Array.isArray(nested)) {
    try {
      const normalized = normalizeJevResponse({ answers: nested });
      for (const [id, answer] of Object.entries(normalized.answers)) {
        if (!(id in recovered))
          recovered[id] = answer;
      }
    } catch {}
  }
  return recovered;
}
function readObjectPath(value, path) {
  let current = value;
  for (const key of path) {
    if (!current || typeof current !== "object")
      return null;
    current = current[key];
  }
  return current ?? null;
}
async function runGatePhase(phase, options) {
  const { jevRun, settings } = options;
  const plan = planGates(phase, settings.jev, options.turnContext, options.questionOverrides ?? {});
  const projection = buildJevState({ ...options.stateContext, draftDirective: options.directive ?? options.stateContext.draftDirective }, options.worldStateContext);
  const questions = questionsFromPlan(plan);
  const requestJson = jsonText({ state: projection.state, questions });
  const empty = (error) => ({
    plan,
    records: resolveGateAnswers(plan, {}, settings.jev.minConfidence),
    state: projection.state,
    stateChars: projection.chars,
    stateCompacted: projection.compacted,
    inputTokens: null,
    outputTokens: null,
    costUsd: null,
    resolvedModel: null,
    requests: 0,
    durationMs: 0,
    error,
    requestJson,
    responseJson: null
  });
  if (plan.gates.length === 0)
    return empty(null);
  if (!jevRun.enabled || !jevRun.config || !jevRun.cors)
    return empty(jevRun.error);
  if (exceedsJevTokenBudget(projection.state, questions)) {
    return empty("The assembled Jev state exceeds the model's 32k token allowance.");
  }
  const outcome = await callJev({
    config: jevRun.config,
    state: projection.state,
    questions,
    cors: jevRun.cors,
    timeoutMs: settings.jev.timeoutMs,
    budgetMs: jevPhaseBudgetMs(settings),
    retryOnRateLimit: settings.jev.retryOnRateLimit
  });
  if (!outcome.ok || !outcome.response) {
    return {
      ...empty(outcome.error ?? "Jev request failed."),
      requests: outcome.requests,
      durationMs: outcome.durationMs,
      requestJson: outcome.request?.body ?? requestJson,
      responseJson: jsonText(outcome.attempts)
    };
  }
  const answers = recoverAnswers(outcome.response.answers);
  return {
    plan,
    records: resolveGateAnswers(plan, answers, settings.jev.minConfidence),
    state: projection.state,
    stateChars: projection.chars,
    stateCompacted: projection.compacted,
    inputTokens: outcome.response.usage.inputTokens,
    outputTokens: outcome.response.usage.outputTokens,
    costUsd: outcome.response.usage.costUsd,
    resolvedModel: outcome.response.model,
    requests: outcome.requests,
    durationMs: outcome.durationMs,
    error: null,
    requestJson: outcome.request?.body ?? requestJson,
    responseJson: jsonText(outcome.attempts)
  };
}
function summaryOfMessages(messages, maxChars) {
  if (messages.length === 0)
    return null;
  const prompt = formatPromptForController(messages, maxChars);
  return prompt.prompt.trim() || null;
}
function contextMessageSummary(messages, label) {
  const message = messages.find((entry) => entry[CONTROLLER_CONTEXT_LABEL_KEY] === label);
  if (!message)
    return null;
  const text = serializeContent(message.content).trim();
  return text || null;
}
function serializeContent(content) {
  if (typeof content === "string")
    return content;
  if (!Array.isArray(content))
    return "";
  return content.map((part) => part.type === "text" ? part.text : "").filter(Boolean).join(`
`);
}
function mergeJevDiagnostics(current, phase, stage) {
  const flags = countJevFlags(phase.records);
  const phaseFailed = !!phase.error;
  const status = current.error || phaseFailed ? "degraded" : current.status === "degraded" ? "degraded" : "ok";
  return {
    ...current,
    status,
    error: current.error ?? phase.error,
    requestCount: current.requestCount + phase.requests,
    inputTokens: sumNullable(current.inputTokens, phase.inputTokens),
    outputTokens: sumNullable(current.outputTokens, phase.outputTokens),
    costUsd: sumNullable(current.costUsd, phase.costUsd),
    gatePhaseMs: stage === "before_director" ? phase.durationMs : current.gatePhaseMs,
    verifyPhaseMs: stage !== "before_director" ? (current.verifyPhaseMs ?? 0) + phase.durationMs : current.verifyPhaseMs,
    resolvedModel: phase.resolvedModel ?? current.resolvedModel,
    gateCount: current.gateCount + phase.records.length,
    fallbackCount: current.fallbackCount + flags.fallback,
    escalatedCount: current.escalatedCount + flags.escalated,
    stateChars: phase.stateChars || current.stateChars,
    stateCompacted: phase.stateCompacted || current.stateCompacted,
    phases: [...current.phases, {
      stage,
      questionCount: phase.plan.gates.length,
      requestCount: phase.requests,
      durationMs: phase.durationMs,
      inputTokens: phase.inputTokens,
      outputTokens: phase.outputTokens,
      costUsd: phase.costUsd,
      resolvedModel: phase.resolvedModel,
      stateChars: phase.stateChars,
      stateCompacted: phase.stateCompacted,
      error: phase.error,
      gates: phase.records,
      requestJson: phase.requestJson,
      responseJson: phase.responseJson
    }]
  };
}
function sumNullable(left, right) {
  if (left === null)
    return right;
  if (right === null)
    return left;
  return left + right;
}
async function prepareController(settings, messages, context, chatId, userId, generationType, preserveWorldInfo = true) {
  const identityPromise = Promise.all([
    resolvePersona(context, userId),
    resolveCharacter(context, chatId, userId)
  ]);
  const worldState = await loadWorldState(storageApi(), chatId ?? "", userId, settings.jev.enabled && settings.jev.worldStateEnabled);
  const [persona, character] = await identityPromise;
  const identity = makeIdentity(persona, character);
  const includesCharacter = settings.includeCharacter && !!character;
  const includesPersona = settings.includeUserPersona && !!persona;
  const jevIncludesCharacter = settings.jev.includeCharacter && !!character;
  const jevIncludesPersona = settings.jev.includeUserPersona && !!persona;
  const contextMessages = [
    includesPersona && persona ? makeControllerContextMessage("User Persona", formatPersonaContext(persona, identity)) : null,
    includesCharacter && character ? makeControllerContextMessage("Character", formatCharacterContext(character, identity)) : null
  ].filter((message) => !!message);
  const jevContextMessages = [
    jevIncludesPersona && persona ? makeControllerContextMessage("User Persona", formatPersonaContext(persona, identity)) : null,
    jevIncludesCharacter && character ? makeControllerContextMessage("Character", formatCharacterContext(character, identity)) : null
  ].filter((message) => !!message);
  const worldBooks = worldBooksApi();
  const includeDirectorWorldInfo = preserveWorldInfo && settings.includeWorldInfoEntries;
  const includeJevWorldInfo = preserveWorldInfo && settings.jev.enabled && settings.jev.includeWorldInfoEntries;
  const worldInfoContext = await resolveWorldInfoContextMessages({
    messages,
    settings: { ...settings, includeWorldInfoEntries: includeDirectorWorldInfo || includeJevWorldInfo },
    context,
    canFetchWorldBooks: permissionHas("worldBooks") && !!worldBooks,
    fetchActivated: chatId && typeof worldBooks?.getActivated === "function" ? () => worldBooks.getActivated(chatId, userId ?? undefined) : undefined,
    fetchEntry: typeof worldBooks?.entries?.get === "function" ? (entryId) => worldBooks.entries.get(entryId, userId ?? undefined) : undefined,
    identity
  });
  const selected = selectControllerMessagesForController(messages, settings, [...contextMessages, ...includeDirectorWorldInfo ? worldInfoContext.messages : []]);
  const currentUserMessages = currentUserContextMessages(messages, settings.maxInputChars);
  const currentChars = currentUserMessages.reduce((sum, message) => sum + serializeContent(message.content).length, 0);
  const promptSnapshot = formatPromptForController(selected, Math.max(1000, settings.maxInputChars - currentChars));
  const controllerMessages = buildControllerMessages(settings, promptSnapshot, {
    generationType,
    chatId: chatId || "",
    connectionId: extractConnectionId(context),
    user: identity.userName || "User",
    char: identity.characterName || "Character"
  });
  controllerMessages.splice(-1, 0, ...currentUserMessages);
  const latestPlayerAction = latestPlayerChatMessage(messages);
  const worldStateText = projectWorldState(worldState);
  const jevHistory = selectChatHistoryMessagesForController(messages, settings.jev.historyMessageLimit);
  return {
    controllerMessages,
    currentUserMessages,
    promptSnapshot,
    contextMessages: [...contextMessages, ...includeDirectorWorldInfo ? worldInfoContext.messages : []],
    worldState,
    worldInfoDiagnostics: worldInfoContext.diagnostics,
    turnContext: {
      hasHistory: jevHistory.length > 0,
      hasCharacter: includesCharacter && jevIncludesCharacter,
      hasPersona: includesPersona && jevIncludesPersona,
      hasWorldInfo: includeDirectorWorldInfo && includeJevWorldInfo && worldInfoContext.messages.length > 0,
      jevHasWorldInfo: includeJevWorldInfo && worldInfoContext.messages.length > 0,
      hasDirectorNotes: !!settings.additionalNotes.trim(),
      worldStateEnabled: settings.jev.worldStateEnabled,
      generationType
    },
    stateContext: {
      settings: { historyMessageLimit: settings.jev.historyMessageLimit, maxStateChars: settings.jev.maxStateChars },
      generationType,
      chatId: chatId ?? "",
      history: jevHistory,
      latestPlayerAction: latestPlayerAction ? serializeContent(latestPlayerAction.content).trim() : null,
      personaSummary: contextMessageSummary(jevContextMessages, "User Persona"),
      characterSummary: contextMessageSummary(jevContextMessages, "Character"),
      worldInfoSummary: includeJevWorldInfo ? summaryOfMessages(worldInfoContext.messages, 6000) : null,
      directorNotes: resolveIdentityMacros(settings.additionalNotes, identity).trim() || null,
      worldState: worldState.turn > 0 ? worldStateText : null
    }
  };
}
function applyContextFilter(base, settings, messages, context, generationType, decision) {
  if (!decision)
    return base;
  const keepLabel = {
    "User Persona": decision.keepPersona,
    Character: decision.keepCharacter
  };
  const contextMessages = base.contextMessages.filter((message) => {
    const label = typeof message[CONTROLLER_CONTEXT_LABEL_KEY] === "string" ? message[CONTROLLER_CONTEXT_LABEL_KEY] : "";
    if (label in keepLabel)
      return keepLabel[label];
    return decision.keepWorldInfo;
  });
  const history = decision.keepHistory ? selectChatHistoryMessagesForController(messages, settings.historyMessageLimit) : [];
  const currentChars = base.currentUserMessages.reduce((sum, message) => sum + serializeContent(message.content).length, 0);
  const promptSnapshot = formatPromptForController([...contextMessages, ...history], Math.max(1000, settings.maxInputChars - currentChars));
  const controllerMessages = buildControllerMessages(settings, promptSnapshot, {
    generationType,
    chatId: base.stateContext.chatId,
    connectionId: extractConnectionId(context)
  });
  controllerMessages.splice(-1, 0, ...base.currentUserMessages);
  return {
    ...base,
    controllerMessages,
    promptSnapshot,
    turnContext: {
      ...base.turnContext,
      hasHistory: decision.keepHistory && base.turnContext.hasHistory,
      hasCharacter: decision.keepCharacter && base.turnContext.hasCharacter,
      hasPersona: decision.keepPersona && base.turnContext.hasPersona,
      hasWorldInfo: decision.keepWorldInfo && base.turnContext.hasWorldInfo
    }
  };
}
async function buildState(userId) {
  const settings = await loadSettings(userId);
  const [connectionState, runs, hasJevKey] = await Promise.all([
    listConnections(userId),
    loadRuns(userId, Number.MAX_SAFE_INTEGER),
    readJevKey(settings.jev.provider, userId).then((key) => !!key).catch(() => false)
  ]);
  const providerInfo = resolveJevProvider(settings.jev);
  return {
    settings,
    connections: connectionState.connections,
    connectionError: connectionState.error,
    runs: runs.filter((run) => run.channel !== "world_agent").slice(0, settings.runLogLimit),
    permissions: currentPermissions(),
    hasJevKey,
    jevProviderInfo: providerInfo,
    jevEndpoint: jevEndpoint(settings.jev),
    activeGateCount: settings.jev.enabled ? Object.values(settings.jev.gatePolicy).filter((policy) => policy.enabled === true).length : 0
  };
}
async function pushState(userId) {
  send({ type: "state", state: await buildState(userId) }, userId ?? undefined);
}
function makeRunBase(status, startedAt, patch = {}) {
  return {
    id: crypto.randomUUID(),
    timestamp: Date.now(),
    status,
    durationMs: Date.now() - startedAt,
    ...patch
  };
}
function runLogWorldInfoPatch(diagnostics) {
  return {
    worldInfoActivatedCount: diagnostics.activatedEntryCount,
    worldInfoFetchedCount: diagnostics.fetchedEntryCount,
    worldInfoFallbackTaggedCount: diagnostics.fallbackTaggedEntryCount,
    worldInfoFetchError: diagnostics.fetchError
  };
}
async function callController(userId, settings, target, messages) {
  if (!userId) {
    throw new Error("LumiWorld could not resolve the active Lumiverse user for the controller call.");
  }
  const startedAt = Date.now();
  const controller = new AbortController;
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, settings.timeoutMs);
  try {
    const response = await spindle.generate.raw({
      provider: target.provider,
      model: target.model,
      connection_id: target.connectionId,
      userId,
      messages,
      parameters: {
        temperature: settings.temperature
      },
      reasoning: { source: "off" },
      signal: controller.signal
    });
    const directive = parseControllerDirectiveFromResponse(response);
    if (!directive) {
      throw new EmptyControllerDirectiveError(response);
    }
    return { directive, threadLabel: parseControllerThreadLabelFromResponse(response), durationMs: Date.now() - startedAt, responseJson: jsonText(response) };
  } catch (error) {
    if (timedOut || error instanceof Error && error.name === "AbortError") {
      throw new ControllerTimeoutError(settings.timeoutMs);
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}
async function resolveTurnTarget(settings, records, userId) {
  const base = resolveControllerTarget(settings, await getConnection(settings.connectionId, userId));
  if (!wantsStrongDirectorModel(records))
    return base.ok ? base : null;
  if (settings.strongConnectionId) {
    const strong = await getConnection(settings.strongConnectionId, userId);
    if (strong) {
      const resolved = resolveControllerTarget({ ...settings, connectionId: settings.strongConnectionId, modelOverride: settings.strongModelOverride }, strong);
      if (resolved.ok)
        return resolved;
    }
  }
  if (settings.strongModelOverride.trim() && base.ok) {
    return { ...base, model: settings.strongModelOverride.trim() };
  }
  return base.ok ? base : null;
}
async function handleInterceptor(messages, context) {
  const chatId = extractChatId(context);
  const userId = resolveUserId(chatId, extractContextUserId(context));
  const generationId = chatId && userId ? activeGenerationIds.get(generationChatKey(userId, chatId)) : undefined;
  const generationType = extractGenerationType(context);
  const dryRun = extractDryRun(context);
  const startedAt = Date.now();
  rememberChatUser(chatId, userId);
  const settings = await loadSettings(userId);
  if (!shouldInterceptGeneration(settings, generationType).intercept)
    return messages;
  const turnTrace = {
    chatId,
    generationId: generationId ?? null,
    dryRun,
    settingsJson: jsonText(settings),
    generationOutcome: dryRun ? "preview" : userId && chatId && generationId && activeGenerationIds.get(generationChatKey(userId, chatId)) === generationId ? "pending" : "unknown",
    generationError: null,
    messageId: null,
    finalReply: null,
    worldStateOutcome: "not_used",
    directiveDisposition: null,
    verificationVerdict: null,
    verificationReason: null,
    worldStateBeforeJson: null,
    worldStateAfterJson: null,
    incomingMessagesJson: jsonText(messages),
    directorMessagesJson: null,
    initialDirective: null,
    finalDirective: null,
    initialResponseJson: null
  };
  if (!permissionHas("generation")) {
    await recordTurnRun(makeRunBase("skipped", startedAt, {
      channel: "director",
      generationType,
      error: "Generation permission is not granted.",
      trace: turnTrace
    }), userId, settings);
    return messages;
  }
  const busyKey = directorBusyKey(userId, chatId);
  if (!directorBusy.acquire(busyKey)) {
    await recordTurnRun(makeRunBase("skipped", startedAt, {
      channel: "director",
      generationType,
      error: "Another LumiWorld controller call is already running.",
      trace: turnTrace
    }), userId, settings);
    return messages;
  }
  let target = null;
  let worldState = defaultWorldState();
  let worldInfoDiagnostics = {
    activatedEntryCount: 0,
    fetchedEntryCount: 0,
    fallbackTaggedEntryCount: 0,
    fetchError: null
  };
  let prepared = null;
  const jevDiagnostics = makeJevDiagnostics({ enabled: settings.jev.enabled, provider: settings.jev.provider });
  let gateRecords = [];
  let verifyRecords = [];
  try {
    const jevRun = await prepareJev(settings, userId);
    prepared = await prepareController(settings, messages, context, chatId, userId, generationType, jevRun.enabled && settings.jev.includeWorldInfoEntries);
    worldState = prepared.worldState;
    turnTrace.worldStateBeforeJson = jsonText(worldState);
    worldInfoDiagnostics = prepared.worldInfoDiagnostics;
    if (jevRun.enabled) {
      jevDiagnostics.used = true;
      jevDiagnostics.model = resolveJevModelForDiagnostics(settings);
      const phase = await runGatePhase("gate", {
        jevRun,
        settings,
        stateContext: prepared.stateContext,
        worldStateContext: worldState.turn > 0 ? projectWorldState(worldState) : null,
        turnContext: prepared.turnContext,
        diagnostics: jevDiagnostics
      });
      Object.assign(jevDiagnostics, mergeJevDiagnostics(jevDiagnostics, phase, "before_director"));
      gateRecords = phase.records;
      const decision = shouldRunDirector(gateRecords);
      if (!decision.run) {
        const skipped = { ...jevDiagnostics, status: "skipped", used: true };
        const records = withConfidenceGate(withDegradationGate(gateRecords, { status: "ok", error: null }), settings.jev.minConfidence);
        await recordTurnRun(makeRunBase("skipped", startedAt, {
          channel: "director",
          generationType,
          error: decision.reason ?? "Jev skipped this turn.",
          ...runLogWorldInfoPatch(worldInfoDiagnostics),
          jev: { ...skipped, gates: records, gateCount: records.length },
          trace: turnTrace
        }), userId, settings);
        return messages;
      }
    } else {
      jevDiagnostics.status = "degraded";
      jevDiagnostics.error = jevRun.error;
    }
    const proposedFilter = contextFilterDecision(gateRecords);
    const filterDecision = proposedFilter && {
      ...proposedFilter,
      keepHistory: proposedFilter.keepHistory || settings.jev.historyMessageLimit === 0,
      keepCharacter: proposedFilter.keepCharacter || settings.includeCharacter && !settings.jev.includeCharacter,
      keepPersona: proposedFilter.keepPersona || settings.includeUserPersona && !settings.jev.includeUserPersona,
      keepWorldInfo: proposedFilter.keepWorldInfo || settings.includeWorldInfoEntries && !settings.jev.includeWorldInfoEntries
    };
    const keepWorldInfo = settings.includeWorldInfoEntries && (!filterDecision || filterDecision.keepWorldInfo);
    if (keepWorldInfo && !(jevRun.enabled && settings.jev.includeWorldInfoEntries)) {
      const withWorldInfo = await prepareController(settings, messages, context, chatId, userId, generationType, true);
      worldInfoDiagnostics = withWorldInfo.worldInfoDiagnostics;
      prepared = withWorldInfo;
    }
    prepared = applyContextFilter(prepared, settings, messages, context, generationType, filterDecision);
    const gateGuidance = directorGuidanceFromGates(gateRecords);
    if (gateGuidance)
      prepared.controllerMessages.splice(1, 0, { role: "system", content: gateGuidance });
    turnTrace.directorMessagesJson = jsonText(prepared.controllerMessages);
    target = await resolveTurnTarget(settings, gateRecords, userId);
    if (!target) {
      await recordTurnRun(makeRunBase("skipped", startedAt, {
        channel: "director",
        generationType,
        connectionId: settings.connectionId,
        error: "Choose a LumiWorld controller connection first.",
        ...runLogWorldInfoPatch(worldInfoDiagnostics),
        jev: jevDiagnostics.used ? { ...jevDiagnostics, gates: gateRecords } : null,
        trace: turnTrace
      }), userId, settings);
      return messages;
    }
    const first = await callController(userId, settings, target, prepared.controllerMessages);
    let directive = first.directive;
    let threadLabel = first.threadLabel;
    let withheldReason = null;
    turnTrace.initialDirective = directive;
    turnTrace.initialResponseJson = first.responseJson;
    if (jevRun.enabled) {
      const phase = await runGatePhase("verify", {
        jevRun,
        settings,
        stateContext: prepared.stateContext,
        worldStateContext: projectWorldState(worldState),
        turnContext: prepared.turnContext,
        directive,
        diagnostics: jevDiagnostics
      });
      Object.assign(jevDiagnostics, mergeJevDiagnostics(jevDiagnostics, phase, "verify_draft"));
      verifyRecords = phase.records;
      let assessment = assessVerification(verifyRecords, phase.error);
      turnTrace.verificationVerdict = assessment.verdict;
      turnTrace.verificationReason = assessment.reason;
      if (assessment.repair) {
        const repaired = await regenerateDirective(userId, settings, target, prepared, directive, assessment.repair, verifyRecords);
        jevDiagnostics.revision = {
          action: assessment.repair.action,
          reason: assessment.repair.reason,
          status: repaired.directive ? "revised" : "failed",
          durationMs: repaired.durationMs,
          error: repaired.error,
          initialDirectivePreview: makeDirectivePreview(directive) ?? "",
          revisedDirectivePreview: makeDirectivePreview(repaired.directive),
          unresolved: true,
          promptJson: repaired.promptJson,
          revisedDirective: repaired.directive,
          responseJson: repaired.responseJson
        };
        if (repaired.directive) {
          directive = repaired.directive;
          threadLabel = repaired.threadLabel;
          const recheck = await runGatePhase("verify", {
            jevRun,
            settings,
            stateContext: prepared.stateContext,
            worldStateContext: projectWorldState(worldState),
            turnContext: prepared.turnContext,
            directive,
            diagnostics: jevDiagnostics
          });
          Object.assign(jevDiagnostics, mergeJevDiagnostics(jevDiagnostics, recheck, "verify_revision"));
          verifyRecords = recheck.records;
          assessment = assessVerification(verifyRecords, recheck.error);
          turnTrace.verificationVerdict = assessment.verdict;
          turnTrace.verificationReason = assessment.reason;
          jevDiagnostics.revision.unresolved = assessment.verdict !== "clean";
          if (assessment.verdict !== "clean")
            withheldReason = assessment.reason ?? "The revised note could not be verified.";
        } else {
          withheldReason = repaired.error ?? "The Director could not repair the note.";
          turnTrace.verificationVerdict = "inconclusive";
          turnTrace.verificationReason = withheldReason;
        }
      }
    } else {
      turnTrace.verificationVerdict = "unverified";
      turnTrace.verificationReason = jevRun.error ?? "Jev was disabled for this turn.";
    }
    if (withheldReason) {
      turnTrace.directiveDisposition = "withheld";
      turnTrace.finalDirective = null;
      const allRecords = withConfidenceGate(withDegradationGate(jevDiagnostics.phases.flatMap((phase) => phase.gates), { status: jevDiagnostics.status, error: jevDiagnostics.error }), settings.jev.minConfidence);
      await recordTurnRun(makeRunBase("skipped", startedAt, {
        channel: "director",
        generationType,
        directorDurationMs: first.durationMs,
        connectionId: target.connectionId,
        connectionName: target.connectionName,
        model: target.model,
        error: `Director note withheld: ${withheldReason}`,
        ...runLogWorldInfoPatch(worldInfoDiagnostics),
        jev: { ...jevDiagnostics, gates: allRecords, gateCount: allRecords.length },
        trace: turnTrace
      }), userId, settings);
      return messages;
    }
    if (settings.jev.enabled && settings.jev.worldStateEnabled && turnTrace.verificationVerdict === "clean" && chatId && !dryRun) {
      const committed = commitWorldState(worldState, verifyRecords, threadLabel);
      worldState = committed;
      turnTrace.worldStateAfterJson = jsonText(committed);
      if (userId && generationId && activeGenerationIds.get(generationChatKey(userId, chatId)) === generationId) {
        pendingCommits.set(generationCommitKey(userId, chatId, generationId), { userId, chatId, state: committed });
        turnTrace.worldStateOutcome = "pending";
      } else {
        spindle.log.warn("LumiWorld skipped a scene-state commit because its generation could not be matched.");
        turnTrace.worldStateOutcome = "discarded";
      }
    }
    const allRecords = withConfidenceGate(withDegradationGate(jevDiagnostics.phases.flatMap((phase) => phase.gates), { status: jevDiagnostics.status, error: jevDiagnostics.error }), settings.jev.minConfidence);
    turnTrace.finalDirective = directive;
    turnTrace.directiveDisposition = "injected";
    const injected = { role: "system", content: buildInjectedDirective(directive) };
    await recordTurnRun(makeRunBase("success", startedAt, {
      channel: "director",
      generationType,
      directorDurationMs: first.durationMs,
      connectionId: target.connectionId,
      connectionName: target.connectionName,
      model: target.model,
      directivePreview: makeDirectivePreview(directive),
      ...runLogWorldInfoPatch(worldInfoDiagnostics),
      jev: settings.jev.enabled || jevDiagnostics.used ? { ...jevDiagnostics, gates: allRecords, gateCount: allRecords.length } : null,
      trace: turnTrace
    }), userId, settings);
    return { messages: [injected, ...messages], breakdown: [{ messageIndex: 0, name: BREAKDOWN_NAME }] };
  } catch (error) {
    const isTimeout = error instanceof ControllerTimeoutError;
    const isEmptyDirective = error instanceof EmptyControllerDirectiveError;
    const message = error instanceof Error ? error.message : String(error);
    if (error instanceof EmptyControllerDirectiveError)
      turnTrace.initialResponseJson = error.responseJson;
    const recordedGates = jevDiagnostics.used ? withConfidenceGate(withDegradationGate(jevDiagnostics.phases.flatMap((phase) => phase.gates), {
      status: jevDiagnostics.status,
      error: jevDiagnostics.error
    }), settings.jev.minConfidence) : [];
    await recordTurnRun(makeRunBase(isTimeout ? "timeout" : isEmptyDirective ? "skipped" : "error", startedAt, {
      channel: "director",
      generationType,
      connectionId: target?.connectionId ?? settings.connectionId,
      connectionName: target?.connectionName,
      model: target?.model,
      error: message,
      ...runLogWorldInfoPatch(worldInfoDiagnostics),
      jev: jevDiagnostics.used ? { ...jevDiagnostics, gates: recordedGates, gateCount: recordedGates.length } : null,
      trace: turnTrace
    }), userId, settings);
    spindle.log.warn(`LumiWorld interceptor skipped injection: ${message}`);
    return messages;
  } finally {
    directorBusy.release(busyKey);
  }
}
function resolveJevModelForDiagnostics(settings) {
  const provider = resolveJevProvider(settings.jev);
  return settings.jev.model.trim() || provider.defaultModel;
}
async function regenerateDirective(userId, settings, target, prepared, originalDirective, repair, records) {
  const violated = records.filter((record) => ["player_agency", "continuity_guard", "duplicate_suppression", "intensity_boundary", "director_verification"].includes(record.gateId) && (record.usedFallback || ["violation", "repeats", "near_duplicate", "out_of_range", true].includes(record.value))).map((record) => `- ${record.label}: ${String(record.value)}${record.usedFallback ? " (inconclusive)" : ""}`).join(`
`);
  const repairMessages = [
    ...prepared.controllerMessages,
    { role: "assistant", content: originalDirective },
    {
      role: "system",
      content: [
        `LumiWorld verification found a problem with the draft directive above. Repair it with this action: ${repair.action}.`,
        repair.reason,
        violated ? `Blocking or inconclusive checks:
${violated}` : "",
        "Preserve unaffected beats. Preserve the actor, target, objects, and completed outcome in the latest player chat action exactly. Do not redirect a finished action or decide the player's next action.",
        "Return a corrected directive only. Keep the same format and length limits. Include an optional thread_label only if it names a specific story thread."
      ].filter(Boolean).join(`
`)
    }
  ];
  const promptJson = jsonText(repairMessages);
  const startedAt = Date.now();
  try {
    const repaired = await callController(userId, settings, target, repairMessages);
    return { directive: repaired.directive, threadLabel: repaired.threadLabel, durationMs: repaired.durationMs, error: null, promptJson, responseJson: repaired.responseJson };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    spindle.log.warn(`LumiWorld repair attempt failed: ${message}`);
    return {
      directive: null,
      threadLabel: null,
      durationMs: Date.now() - startedAt,
      error: message,
      promptJson,
      responseJson: error instanceof EmptyControllerDirectiveError ? error.responseJson : null
    };
  }
}
async function runJevTest(userId, patch, draftKey) {
  const baseSettings = await loadSettings(userId);
  const settings = normalizeSettings({ ...baseSettings, ...patch });
  const startedAt = Date.now();
  const jevRun = await prepareJev(settings, userId);
  const draft = typeof draftKey === "string" ? draftKey.trim() : "";
  const apiKey = draft || await readJevKey(settings.jev.provider, userId);
  if (!apiKey) {
    const error = jevRun.error ?? `No Jev API key is stored for ${resolveJevProvider(settings.jev).label}.`;
    send({ type: "jev_test_result", ok: false, error }, userId ?? undefined);
    return;
  }
  const cors = jevRun.cors ?? corsApi();
  if (!cors) {
    send({ type: "jev_test_result", ok: false, error: "This Lumiverse host does not expose the CORS proxy." }, userId ?? undefined);
    return;
  }
  const smoke = buildJevSmokeRequest({ ...settings.jev, apiKey });
  const outcome = await callJev({
    config: { ...settings.jev, apiKey },
    state: "A storm rolls in over the harbour.",
    questions: smoke.questions,
    cors,
    timeoutMs: settings.jev.timeoutMs,
    budgetMs: MAX_JEV_PHASE_MS,
    retryOnRateLimit: settings.jev.retryOnRateLimit
  });
  if (!outcome.ok || !outcome.response) {
    send({ type: "jev_test_result", ok: false, error: outcome.error ?? "Jev did not answer." }, userId ?? undefined);
    return;
  }
  const answer = outcome.response.answers.connectivity;
  const confidence = answer && answer.type === "noul" ? Math.max(answer.noul, 1 - answer.noul) : null;
  const label = answer && answer.type === "noul" ? answer.noul >= 0.5 ? "yes" : "no" : "unknown";
  if (draft) {
    try {
      await storeJevKey(settings.jev.provider, draft, userId);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      spindle.log.warn(`LumiWorld could not store the Jev key: ${message}`);
      send({
        type: "jev_test_result",
        ok: false,
        error: `Jev answered, but the key could not be saved: ${message}`
      }, userId ?? undefined);
      return;
    }
  }
  send({
    type: "jev_test_result",
    ok: true,
    latencyMs: Date.now() - startedAt,
    model: outcome.response.model ?? resolveJevModelForDiagnostics(settings),
    provider: resolveJevProvider(settings.jev).label,
    answer: label,
    confidence
  }, userId ?? undefined);
}
function tryRegisterInterceptor() {
  if (interceptorRegistered)
    return;
  if (!permissionHas("interceptor"))
    return;
  spindle.registerInterceptor(handleInterceptor, INTERCEPTOR_PRIORITY);
  interceptorRegistered = true;
  spindle.log.info("LumiWorld interceptor registered.");
}
async function runControllerTest(userId, patch) {
  const baseSettings = await loadSettings(userId);
  const settings = normalizeSettings({ ...baseSettings, ...patch });
  const startedAt = Date.now();
  if (!permissionHas("generation")) {
    const error = "Generation permission is not granted.";
    await recordRun(makeRunBase("test_error", startedAt, { channel: "director", generationType: "test", error }), userId, settings);
    send({ type: "test_result", ok: false, error }, userId ?? undefined);
    return;
  }
  const connection = await getConnection(settings.connectionId, userId);
  const target = resolveControllerTarget(settings, connection);
  if (!target.ok) {
    await recordRun(makeRunBase("test_error", startedAt, { channel: "director", generationType: "test", connectionId: settings.connectionId, error: target.reason }), userId, settings);
    send({ type: "test_result", ok: false, error: target.reason }, userId ?? undefined);
    return;
  }
  try {
    const snapshot = formatPromptForController([
      { role: "system", content: "You are running a short LumiWorld controller smoke test." },
      { role: "user", content: "The player opens an ancient observatory door during a storm. Decide how the world reacts." }
    ], settings.maxInputChars);
    const controllerMessages = buildControllerMessages(settings, snapshot, {
      generationType: "normal",
      chatId: "lumiworld-test",
      connectionId: target.connectionId
    });
    const { directive, durationMs } = await callController(userId, settings, target, controllerMessages);
    await recordRun(makeRunBase("test_success", startedAt, {
      channel: "director",
      generationType: "test",
      durationMs,
      connectionId: target.connectionId,
      connectionName: target.connectionName,
      model: target.model,
      directivePreview: makeDirectivePreview(directive)
    }), userId, settings);
    send({
      type: "test_result",
      ok: true,
      directive,
      durationMs,
      model: target.model,
      connectionName: target.connectionName
    }, userId ?? undefined);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await recordRun(makeRunBase(error instanceof ControllerTimeoutError ? "timeout" : "test_error", startedAt, {
      channel: "director",
      generationType: "test",
      connectionId: target.connectionId,
      connectionName: target.connectionName,
      model: target.model,
      error: message
    }), userId, settings);
    send({ type: "test_result", ok: false, error: message }, userId ?? undefined);
  }
}
tryRegisterInterceptor();
permissionsApi()?.onChanged?.(({ permission, granted }) => {
  if (permission === "interceptor" && granted)
    tryRegisterInterceptor();
  pushState(lastFrontendUserId);
});
spindle.on?.("GENERATION_STARTED", (payload, eventUserId) => {
  const chatId = extractChatId(payload);
  const generationId = extractGenerationId(payload);
  if (!chatId || !generationId || !eventUserId)
    return;
  const chatKey = generationChatKey(eventUserId, chatId);
  const previous = activeGenerationIds.get(chatKey);
  if (previous && previous !== generationId) {
    const previousKey = generationCommitKey(eventUserId, chatId, previous);
    const hadPendingState = pendingCommits.delete(previousKey);
    const previousRunId = generationRunIds.get(previousKey);
    generationRunIds.delete(previousKey);
    if (previousRunId)
      patchRunTrace(eventUserId, previousRunId, {
        generationOutcome: "superseded",
        worldStateOutcome: hadPendingState ? "discarded" : "not_used"
      });
  }
  activeGenerationIds.set(chatKey, generationId);
});
spindle.on?.("GENERATION_ENDED", (payload, eventUserId) => {
  const chatId = extractChatId(payload);
  const generationId = extractGenerationId(payload);
  if (!chatId || !generationId || !eventUserId)
    return;
  const chatKey = generationChatKey(eventUserId, chatId);
  if (activeGenerationIds.get(chatKey) === generationId)
    activeGenerationIds.delete(chatKey);
  const commitKey = generationCommitKey(eventUserId, chatId, generationId);
  const pending = pendingCommits.get(commitKey);
  pendingCommits.delete(commitKey);
  const runId = generationRunIds.get(commitKey);
  generationRunIds.delete(commitKey);
  const event = payload;
  const failed = !!event.error;
  const patch = {
    generationOutcome: failed ? "failed" : "completed",
    generationError: failed ? String(event.error) : null,
    finalReply: typeof event.content === "string" ? event.content : null,
    messageId: typeof event.messageId === "string" ? event.messageId : null,
    worldStateOutcome: pending ? failed ? "discarded" : "saved" : "not_used"
  };
  if (failed || !pending) {
    if (runId)
      patchRunTrace(eventUserId, runId, patch);
    return;
  }
  saveWorldState(storageApi(), pending.chatId, pending.state, pending.userId).then(() => {
    if (runId)
      return patchRunTrace(eventUserId, runId, patch);
  }).catch((error) => {
    spindle.log.warn(`LumiWorld could not save scene state: ${error instanceof Error ? error.message : String(error)}`);
    if (runId)
      patchRunTrace(eventUserId, runId, { ...patch, worldStateOutcome: "save_failed" });
  });
});
spindle.on?.("GENERATION_STOPPED", (payload, eventUserId) => {
  const chatId = extractChatId(payload);
  const generationId = extractGenerationId(payload);
  if (!chatId || !generationId || !eventUserId)
    return;
  const chatKey = generationChatKey(eventUserId, chatId);
  if (activeGenerationIds.get(chatKey) === generationId)
    activeGenerationIds.delete(chatKey);
  const commitKey = generationCommitKey(eventUserId, chatId, generationId);
  const hadPendingState = pendingCommits.delete(commitKey);
  const runId = generationRunIds.get(commitKey);
  generationRunIds.delete(commitKey);
  if (runId)
    patchRunTrace(eventUserId, runId, {
      generationOutcome: "stopped",
      finalReply: typeof payload.content === "string" ? payload.content : null,
      worldStateOutcome: hadPendingState ? "discarded" : "not_used"
    });
});
spindle.on?.("CHAT_SWITCHED", (payload, eventUserId) => {
  const userId = eventUserId || lastFrontendUserId;
  if (!userId)
    return;
  rememberChatUser(extractChatId(payload), userId);
  pushState(userId);
});
permissionsApi()?.onDenied?.(({ permission, operation }) => {
  spindle.log.warn(`LumiWorld permission denied for ${operation}: ${permission}`);
});
spindle.onFrontendMessage(async (raw, userId) => {
  lastFrontendUserId = userId;
  const message = raw;
  if ("chatId" in message)
    rememberChatUser(message.chatId, userId);
  try {
    await ensureFolders(userId);
    switch (message.type) {
      case "ready":
      case "refresh_state":
        await pushState(userId);
        break;
      case "save_settings":
        try {
          const settings = await saveSettings(message.settings, userId);
          send({ type: "settings_saved", revision: message.revision, settings }, userId);
          await pushState(userId);
        } catch (error) {
          send({
            type: "settings_save_error",
            revision: message.revision,
            message: error instanceof Error ? error.message : String(error)
          }, userId);
        }
        break;
      case "test_controller":
        await runControllerTest(userId, message.settings);
        await pushState(userId);
        break;
      case "test_jev":
        await runJevTest(userId, message.settings, message.apiKey);
        await pushState(userId);
        break;
      case "clear_jev_key": {
        const provider = message.provider === "openrouter" ? "openrouter" : undefined;
        const target = provider ?? (await loadSettings(userId)).jev.provider;
        await clearJevKey(target, userId);
        await pushState(userId);
        break;
      }
    }
  } catch (error) {
    const description = error instanceof Error ? error.message : "Unknown LumiWorld error.";
    spindle.log.error(`LumiWorld backend error: ${description}`);
    send({ type: "error", message: description }, userId);
  }
});
spindle.log.info("LumiWorld loaded.");
