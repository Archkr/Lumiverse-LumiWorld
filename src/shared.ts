export const EXTENSION_ID = "agent_world";
export const EXTENSION_NAME = "LumiWorld";
export const BREAKDOWN_NAME = "LumiWorld Director";
export const WORLD_AGENT_BREAKDOWN_NAME = "LumiWorld World Agent";

export const VISIBLE_GENERATION_TYPES = [
  "normal",
  "continue",
  "regenerate",
  "swipe",
  "impersonate",
] as const;

export type LumiWorldGenerationType = (typeof VISIBLE_GENERATION_TYPES)[number];
export type MessageRole = "system" | "user" | "assistant";
export type LumiWorldChannel = "director" | "world_agent";

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
  worldAgent: WorldAgentSettings;
}

export interface WorldAgentSettings {
  enabled: boolean;
  connectionId: string | null;
  modelOverride: string;
  temperature: number;
  maxTokens: number;
  timeoutMs: number;
  hourDurationMs: number;
  injectState: boolean;
  autoTickVisibleOnly: boolean;
  scheduleTemplate: string;
  updateTemplate: string;
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
  channel?: LumiWorldChannel | null;
  action?: string | null;
  generationType?: string | null;
  durationMs?: number | null;
  connectionId?: string | null;
  connectionName?: string | null;
  model?: string | null;
  directivePreview?: string | null;
  error?: string | null;
  worldAgentDay?: number | null;
  worldAgentHour?: number | null;
  worldAgentScheduleCount?: number | null;
  worldInfoActivatedCount?: number | null;
  worldInfoFetchedCount?: number | null;
  worldInfoFallbackTaggedCount?: number | null;
  worldInfoFetchError?: string | null;
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

export interface WorldAgentScheduleItem {
  hour: number;
  label?: string;
  location?: string;
  activity: string;
}

export interface WorldAgentUpdate {
  location?: string;
  mood?: string;
  activity?: string;
  thought?: string;
  goal?: string;
}

export interface WorldAgentHistoryEntry {
  id: string;
  timestamp: number;
  day: number;
  hour: number;
  action: string;
  preview?: string | null;
  error?: string | null;
}

export interface WorldAgentState {
  chatId: string;
  day: number;
  hour: number;
  running: boolean;
  lastTickAt: number | null;
  activeCharacterId: string | null;
  activePersonaId: string | null;
  scheduleDay: number | null;
  schedule: WorldAgentScheduleItem[];
  location: string;
  mood: string;
  activity: string;
  thought: string;
  goal: string;
  updatedAt: number;
  history: WorldAgentHistoryEntry[];
}

export const MAX_DIRECTIVE_CHARS = 2200;
export const MAX_CONTROLLER_OUTPUT_TOKENS = Number.MAX_SAFE_INTEGER;
export const MAX_CONTROLLER_TIMEOUT_MS = 2_147_483_647;
export const MAX_CHAT_HISTORY_MESSAGES = Number.MAX_SAFE_INTEGER;
export const DEFAULT_RUN_LOG_LIMIT = 12;
export const DEFAULT_HISTORY_MESSAGE_LIMIT = 12;
export const DEFAULT_WORLD_AGENT_HOUR_DURATION_MS = 5 * 60 * 1000;
export const WORLD_AGENT_HISTORY_LIMIT = 24;
export const CONTROLLER_CONTEXT_LABEL_KEY = "__lumiWorldContextLabel";

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

export const PREVIOUS_DEFAULT_WORLD_AGENT_SCHEDULE_TEMPLATE = [
  "You are LumiWorld's private World Agent for an interactive Lumiverse chat.",
  "Create the current day's background schedule for {{char}}.",
  "",
  "Use the active character and persona context, the current chat state, and any provided notes.",
  "The schedule is private simulation scaffolding. Do not write visible roleplay prose.",
  "",
  "Return compact JSON only:",
  "{\"schedule\":[{\"hour\":0,\"location\":\"...\",\"activity\":\"...\",\"mood\":\"...\",\"goal\":\"...\"}]}",
  "",
  "Cover the full day when possible. Keep entries short, playable, and flexible enough for the chat to override.",
].join("\n");

export const PREVIOUS_BLOCK_WORLD_AGENT_SCHEDULE_TEMPLATE = [
  "You are LumiWorld's private World Agent for an interactive Lumiverse chat.",
  "Create {{char}}'s private background schedule for the entire current day.",
  "",
  "Plan the full 24-hour day as start-hour blocks, not a single current activity.",
  "Each entry's hour is the hour when that block begins. Use 0-23 hour values.",
  "Include overnight/rest time, morning, midday, afternoon, evening, and late-night blocks when they make sense.",
  "Aim for 8-14 concise entries unless the character's day truly needs fewer.",
  "Only plan where {{char}} is and what {{char}} is doing.",
  "Do not decide mood, thoughts, emotions, reactions, or current goals in the schedule.",
  "Those belong to the hourly update step.",
  "",
  "Use the active character and persona context, the current chat state, and any provided notes.",
  "The schedule is private simulation scaffolding. Do not write visible roleplay prose.",
  "Keep entries flexible enough for the chat to override.",
  "",
  "Return compact JSON only in this shape:",
  "{\"schedule\":[{\"hour\":0,\"location\":\"...\",\"activity\":\"...\"},{\"hour\":7,\"location\":\"...\",\"activity\":\"...\"},{\"hour\":12,\"location\":\"...\",\"activity\":\"...\"},{\"hour\":18,\"location\":\"...\",\"activity\":\"...\"}]}",
].join("\n");

export const DEFAULT_WORLD_AGENT_SCHEDULE_TEMPLATE = [
  "You are LumiWorld's private World Agent for an interactive Lumiverse chat.",
  "Create {{char}}'s private background schedule for the entire current day.",
  "",
  "Plan exactly 24 hourly entries, one entry for every hour from 0 through 23.",
  "Each entry's hour is the exact hour it describes. Use 0-23 hour values.",
  "If {{char}} keeps doing the same thing for several hours, repeat the same location and activity for each hour.",
  "For example, sleeping from midnight to 6am still needs separate 0, 1, 2, 3, 4, 5, and 6 entries.",
  "Only plan where {{char}} is and what {{char}} is doing.",
  "Do not decide mood, thoughts, emotions, reactions, or current goals in the schedule.",
  "Those belong to the hourly update step.",
  "",
  "Use the active character and persona context, the current chat state, and any provided notes.",
  "The schedule is private simulation scaffolding. Do not write visible roleplay prose.",
  "Keep entries flexible enough for the chat to override.",
  "",
  "Return compact JSON only in this shape:",
  "{\"schedule\":[{\"hour\":0,\"location\":\"...\",\"activity\":\"...\"},{\"hour\":1,\"location\":\"...\",\"activity\":\"...\"},{\"hour\":2,\"location\":\"...\",\"activity\":\"...\"},{\"hour\":3,\"location\":\"...\",\"activity\":\"...\"}]}",
].join("\n");

export const PREVIOUS_FULL_DAY_WORLD_AGENT_SCHEDULE_TEMPLATE = [
  "You are LumiWorld's private World Agent for an interactive Lumiverse chat.",
  "Create {{char}}'s private background schedule for the entire current day.",
  "",
  "Plan the full 24-hour day as start-hour blocks, not a single current activity.",
  "Each entry's hour is the hour when that block begins. Use 0-23 hour values.",
  "Include overnight/rest time, morning, midday, afternoon, evening, and late-night blocks when they make sense.",
  "Aim for 8-14 concise entries unless the character's day truly needs fewer.",
  "",
  "Use the active character and persona context, the current chat state, and any provided notes.",
  "The schedule is private simulation scaffolding. Do not write visible roleplay prose.",
  "Keep entries flexible enough for the chat to override.",
  "",
  "Return compact JSON only in this shape:",
  "{\"schedule\":[{\"hour\":0,\"location\":\"...\",\"activity\":\"...\",\"mood\":\"...\",\"goal\":\"...\"},{\"hour\":7,\"location\":\"...\",\"activity\":\"...\",\"mood\":\"...\",\"goal\":\"...\"},{\"hour\":12,\"location\":\"...\",\"activity\":\"...\",\"mood\":\"...\",\"goal\":\"...\"},{\"hour\":18,\"location\":\"...\",\"activity\":\"...\",\"mood\":\"...\",\"goal\":\"...\"}]}",
].join("\n");

export const PREVIOUS_DEFAULT_WORLD_AGENT_UPDATE_TEMPLATE = [
  "You are LumiWorld's private World Agent for an interactive Lumiverse chat.",
  "Advance {{char}}'s private world state by one simulated hour.",
  "",
  "Use the schedule as a rough location/activity plan, plus current state, active character/persona context, and recent chat context.",
  "Track what changes in location, mood, activity, current thought, and immediate goal.",
  "Do not write the visible assistant reply. Do not mention LumiWorld or this control step.",
  "",
  "Return compact JSON only:",
  "{\"location\":\"...\",\"mood\":\"...\",\"activity\":\"...\",\"thought\":\"...\",\"goal\":\"...\"}",
].join("\n");

export const DEFAULT_WORLD_AGENT_UPDATE_TEMPLATE = [
  "You are LumiWorld's private World Agent for an interactive Lumiverse chat.",
  "Advance {{char}}'s private world state by one simulated hour.",
  "",
  "Use the schedule as a rough location/activity plan, plus current state, active character/persona context, and recent chat context.",
  "Track what changes in location, activity, current thought, and immediate goal.",
  "Do not write the visible assistant reply. Do not mention LumiWorld or this control step.",
  "",
  "Return compact JSON only:",
  "{\"location\":\"...\",\"activity\":\"...\",\"thought\":\"...\",\"goal\":\"...\"}",
].join("\n");

export const DEFAULT_WORLD_AGENT_SETTINGS: WorldAgentSettings = {
  enabled: false,
  connectionId: null,
  modelOverride: "",
  temperature: 0.45,
  maxTokens: 700,
  timeoutMs: 60000,
  hourDurationMs: DEFAULT_WORLD_AGENT_HOUR_DURATION_MS,
  injectState: true,
  autoTickVisibleOnly: true,
  scheduleTemplate: DEFAULT_WORLD_AGENT_SCHEDULE_TEMPLATE,
  updateTemplate: DEFAULT_WORLD_AGENT_UPDATE_TEMPLATE,
};

export const DEFAULT_SETTINGS: LumiWorldSettings = {
  enabled: false,
  connectionId: null,
  modelOverride: "",
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
  worldAgent: DEFAULT_WORLD_AGENT_SETTINGS,
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
  return normalized.length ? [...new Set(normalized)] : [...DEFAULT_SETTINGS.generationTypes];
}

export function normalizeWorldAgentSettings(value: unknown): WorldAgentSettings {
  const obj = asRecord(value);
  const storedScheduleTemplate = cleanString(obj.scheduleTemplate, DEFAULT_WORLD_AGENT_SCHEDULE_TEMPLATE);
  const storedUpdateTemplate = cleanString(obj.updateTemplate, DEFAULT_WORLD_AGENT_UPDATE_TEMPLATE);
  const scheduleTemplate =
    !storedScheduleTemplate ||
    storedScheduleTemplate === PREVIOUS_DEFAULT_WORLD_AGENT_SCHEDULE_TEMPLATE ||
    storedScheduleTemplate === PREVIOUS_FULL_DAY_WORLD_AGENT_SCHEDULE_TEMPLATE ||
    storedScheduleTemplate === PREVIOUS_BLOCK_WORLD_AGENT_SCHEDULE_TEMPLATE
      ? DEFAULT_WORLD_AGENT_SCHEDULE_TEMPLATE
      : storedScheduleTemplate;
  const updateTemplate =
    !storedUpdateTemplate || storedUpdateTemplate === PREVIOUS_DEFAULT_WORLD_AGENT_UPDATE_TEMPLATE
      ? DEFAULT_WORLD_AGENT_UPDATE_TEMPLATE
      : storedUpdateTemplate;
  return {
    enabled: typeof obj.enabled === "boolean" ? obj.enabled : DEFAULT_WORLD_AGENT_SETTINGS.enabled,
    connectionId: cleanNullableString(obj.connectionId),
    modelOverride: cleanString(obj.modelOverride),
    temperature: numberInRange(obj.temperature, DEFAULT_WORLD_AGENT_SETTINGS.temperature, 0, 2),
    maxTokens: integerInRange(obj.maxTokens, DEFAULT_WORLD_AGENT_SETTINGS.maxTokens, 64, MAX_CONTROLLER_OUTPUT_TOKENS),
    timeoutMs: integerInRange(obj.timeoutMs, DEFAULT_WORLD_AGENT_SETTINGS.timeoutMs, 1000, MAX_CONTROLLER_TIMEOUT_MS),
    hourDurationMs: integerInRange(obj.hourDurationMs, DEFAULT_WORLD_AGENT_SETTINGS.hourDurationMs, 1000, 365 * 24 * 60 * 60 * 1000),
    injectState: typeof obj.injectState === "boolean" ? obj.injectState : DEFAULT_WORLD_AGENT_SETTINGS.injectState,
    autoTickVisibleOnly: typeof obj.autoTickVisibleOnly === "boolean"
      ? obj.autoTickVisibleOnly
      : DEFAULT_WORLD_AGENT_SETTINGS.autoTickVisibleOnly,
    scheduleTemplate,
    updateTemplate,
  };
}

export function normalizeSettings(value: unknown): LumiWorldSettings {
  const obj = asRecord(value);
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
    temperature: numberInRange(obj.temperature, DEFAULT_SETTINGS.temperature, 0, 2),
    maxTokens: integerInRange(obj.maxTokens, DEFAULT_SETTINGS.maxTokens, 64, MAX_CONTROLLER_OUTPUT_TOKENS),
    timeoutMs: integerInRange(obj.timeoutMs, DEFAULT_SETTINGS.timeoutMs, 1000, MAX_CONTROLLER_TIMEOUT_MS),
    maxInputChars: integerInRange(obj.maxInputChars, DEFAULT_SETTINGS.maxInputChars, 4000, 500000),
    historyMessageLimit: integerInRange(obj.historyMessageLimit, DEFAULT_SETTINGS.historyMessageLimit, 0, MAX_CHAT_HISTORY_MESSAGES),
    includeWorldInfoEntries: typeof obj.includeWorldInfoEntries === "boolean" ? obj.includeWorldInfoEntries : DEFAULT_SETTINGS.includeWorldInfoEntries,
    includeUserPersona: typeof obj.includeUserPersona === "boolean" ? obj.includeUserPersona : DEFAULT_SETTINGS.includeUserPersona,
    includeCharacter: typeof obj.includeCharacter === "boolean" ? obj.includeCharacter : DEFAULT_SETTINGS.includeCharacter,
    generationTypes: normalizeGenerationTypes(obj.generationTypes),
    additionalNotes: cleanString(obj.additionalNotes),
    systemTemplate,
    userTemplate,
    runLogLimit: integerInRange(obj.runLogLimit, DEFAULT_SETTINGS.runLogLimit, 0, 50),
    worldAgent: normalizeWorldAgentSettings(obj.worldAgent),
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
        worldAgentDay: obj.worldAgentDay == null ? null : integerInRange(obj.worldAgentDay, 1, 1, Number.MAX_SAFE_INTEGER),
        worldAgentHour: obj.worldAgentHour == null ? null : integerInRange(obj.worldAgentHour, 0, 0, 23),
        worldAgentScheduleCount: obj.worldAgentScheduleCount == null
          ? null
          : integerInRange(obj.worldAgentScheduleCount, 0, 0, Number.MAX_SAFE_INTEGER),
        worldInfoActivatedCount: obj.worldInfoActivatedCount == null ? null : integerInRange(obj.worldInfoActivatedCount, 0, 0, Number.MAX_SAFE_INTEGER),
        worldInfoFetchedCount: obj.worldInfoFetchedCount == null ? null : integerInRange(obj.worldInfoFetchedCount, 0, 0, Number.MAX_SAFE_INTEGER),
        worldInfoFallbackTaggedCount: obj.worldInfoFallbackTaggedCount == null ? null : integerInRange(obj.worldInfoFallbackTaggedCount, 0, 0, Number.MAX_SAFE_INTEGER),
        worldInfoFetchError: cleanNullableString(obj.worldInfoFetchError),
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

export function resolveWorldAgentTarget(settings: WorldAgentSettings, connection: ConnectionLike | null | undefined): ControllerTargetResult {
  if (!settings.connectionId) {
    return { ok: false, reason: "Choose a LumiWorld World Agent connection first." };
  }
  if (!connection) {
    return { ok: false, reason: "The selected LumiWorld World Agent connection could not be found." };
  }
  const model = settings.modelOverride.trim() || connection.model.trim();
  if (!model) {
    return { ok: false, reason: "The selected LumiWorld World Agent connection has no model configured." };
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

function looksLikeStructuredScheduleText(value: string): boolean {
  const stripped = stripCodeFence(value);
  if (!stripped) return false;
  if (/^\s*[\[{]/.test(stripped)) return true;
  return /"schedule"\s*:|["']hour["']\s*:|```(?:json|text)?/i.test(value);
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

export function describeEmptyWorldAgentResponse(response: unknown): string {
  const reasoning = extractControllerReasoningText(response);
  const reasoningTokens = readNumberAtPath(response, ["usage", "completion_tokens_details", "reasoning_tokens"]);
  const finishReason = readStringAtPath(response, ["finish_reason"]) ?? readStringAtPath(response, ["choices", 0, "finish_reason"]);
  const suffix = [
    reasoningTokens != null ? `${Math.round(reasoningTokens)} reasoning tokens` : null,
    finishReason ? `finish_reason=${finishReason}` : null,
  ].filter(Boolean).join(", ");

  if (reasoning) {
    return [
      `LumiWorld World Agent returned reasoning-only output${suffix ? ` (${suffix})` : ""}.`,
      "No schedule or state update was applied because LumiWorld only uses final response content.",
    ].join(" ");
  }

  return [
    `LumiWorld World Agent returned no final schedule or state update${suffix ? ` (${suffix})` : ""}.`,
    "No schedule or state update was applied.",
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

export function normalizeWorldAgentState(value: unknown, chatId: string, patch: Partial<WorldAgentState> = {}): WorldAgentState {
  const obj = asRecord(value);
  const now = Date.now();
  const rawHistory = Array.isArray(obj.history) ? obj.history : [];
  const history = rawHistory
    .map((item): WorldAgentHistoryEntry | null => {
      const record = asRecord(item);
      const timestamp = numberInRange(record.timestamp, 0, 0, Number.MAX_SAFE_INTEGER);
      const action = cleanString(record.action);
      if (!timestamp || !action) return null;
      return {
        id: cleanString(record.id) || `${timestamp}-${action}`,
        timestamp,
        day: integerInRange(record.day, 1, 1, Number.MAX_SAFE_INTEGER),
        hour: integerInRange(record.hour, 0, 0, 23),
        action,
        preview: cleanNullableString(record.preview),
        error: cleanNullableString(record.error),
      };
    })
    .filter((item): item is WorldAgentHistoryEntry => !!item)
    .sort((left, right) => right.timestamp - left.timestamp)
    .slice(0, WORLD_AGENT_HISTORY_LIMIT);

  const state: WorldAgentState = {
    chatId: cleanString(obj.chatId, chatId) || chatId,
    day: integerInRange(obj.day, 1, 1, Number.MAX_SAFE_INTEGER),
    hour: integerInRange(obj.hour, 8, 0, 23),
    running: typeof obj.running === "boolean" ? obj.running : false,
    lastTickAt: obj.lastTickAt == null ? null : numberInRange(obj.lastTickAt, now, 0, Number.MAX_SAFE_INTEGER),
    activeCharacterId: cleanNullableString(obj.activeCharacterId),
    activePersonaId: cleanNullableString(obj.activePersonaId),
    scheduleDay: obj.scheduleDay == null ? null : integerInRange(obj.scheduleDay, 1, 1, Number.MAX_SAFE_INTEGER),
    schedule: normalizeWorldAgentSchedule(obj.schedule),
    location: cleanString(obj.location, "Unspecified"),
    mood: cleanString(obj.mood, "Neutral"),
    activity: cleanString(obj.activity, "Idle"),
    thought: cleanString(obj.thought),
    goal: cleanString(obj.goal),
    updatedAt: numberInRange(obj.updatedAt, now, 0, Number.MAX_SAFE_INTEGER),
    history,
  };

  return {
    ...state,
    ...patch,
    chatId,
    day: integerInRange(patch.day, state.day, 1, Number.MAX_SAFE_INTEGER),
    hour: integerInRange(patch.hour, state.hour, 0, 23),
    schedule: patch.schedule ? normalizeWorldAgentSchedule(patch.schedule) : state.schedule,
    history: patch.history ? normalizeWorldAgentState({ ...state, history: patch.history }, chatId).history : state.history,
  };
}

export function makeDefaultWorldAgentState(chatId: string, identity?: { characterId?: string | null; personaId?: string | null }): WorldAgentState {
  const now = Date.now();
  return normalizeWorldAgentState(
    {
      chatId,
      day: 1,
      hour: 8,
      running: false,
      lastTickAt: null,
      activeCharacterId: identity?.characterId ?? null,
      activePersonaId: identity?.personaId ?? null,
      scheduleDay: null,
      schedule: [],
      location: "Unspecified",
      mood: "Neutral",
      activity: "Idle",
      thought: "",
      goal: "",
      updatedAt: now,
      history: [],
    },
    chatId,
  );
}

function parseJsonishValue(value: unknown): unknown | null {
  if (typeof value !== "string") return value ?? null;
  const stripped = stripCodeFence(value);
  try {
    return JSON.parse(stripped);
  } catch {
    const fenced = extractFirstCodeFence(value);
    if (fenced && fenced !== stripped) {
      try {
        return JSON.parse(fenced);
      } catch {
        // fall through to loose extraction
      }
    }
    const arrayMatch = stripped.match(/\[[\s\S]*\]/);
    if (arrayMatch) {
      try {
        return JSON.parse(arrayMatch[0]);
      } catch {
        // fall through to object extraction
      }
    }
    return findJsonObject(stripped);
  }
}

function normalizeScheduleHour(value: unknown, fallback: number): number {
  if (typeof value === "string") {
    const match = value.match(/\d{1,2}/);
    if (match) return integerInRange(Number(match[0]), fallback, 0, 23);
  }
  return integerInRange(value, fallback, 0, 23);
}

function parseLooseJsonObjectFragment(value: string): unknown | null {
  const repaired = value
    .replace(/,\s*}/g, "}")
    .replace(/([{,]\s*)([A-Za-z_][\w-]*)(\s*:)/g, '$1"$2"$3');
  try {
    return JSON.parse(repaired);
  } catch {
    return null;
  }
}

function extractLooseScheduleRecords(value: string): unknown[] {
  const stripped = stripCodeFence(value);
  const matches = stripped.match(/\{[^{}]*\b(?:hour|time|start_hour|startHour)\b[^{}]*\}/gi) ?? [];
  return matches
    .map(parseLooseJsonObjectFragment)
    .filter((item): item is Record<string, unknown> => !!item && typeof item === "object" && !Array.isArray(item));
}

function scheduleItemFromRecord(value: unknown, index: number): WorldAgentScheduleItem | null {
  if (typeof value === "string") {
    if (looksLikeStructuredScheduleText(value)) return null;
    const activity = normalizeDirectiveText(value, 600);
    return activity ? { hour: index % 24, activity } : null;
  }
  const obj = asRecord(value);
  const activity = cleanString(
    obj.activity ?? obj.event ?? obj.task ?? obj.summary ?? obj.description ?? obj.note ?? obj.plan,
  );
  const location = cleanString(obj.location ?? obj.place ?? obj.where);
  const label = cleanString(obj.label ?? obj.title ?? obj.time);
  if (activity && looksLikeStructuredScheduleText(activity) && !location) return null;
  if (!activity && !location) return null;
  return {
    hour: normalizeScheduleHour(obj.hour ?? obj.time ?? obj.start_hour ?? obj.startHour, index % 24),
    label: label || undefined,
    location: location || undefined,
    activity: activity || (location ? `At ${location}` : "Unspecified activity"),
  };
}

function expandScheduleToEveryHour(items: WorldAgentScheduleItem[]): WorldAgentScheduleItem[] {
  if (!items.length) return [];
  const byHour = new Map<number, WorldAgentScheduleItem>();
  for (const item of items) {
    if (!byHour.has(item.hour)) byHour.set(item.hour, item);
  }
  const anchors = [...byHour.values()].sort((left, right) => left.hour - right.hour);
  return Array.from({ length: 24 }, (_, hour) => {
    const anchor = [...anchors].reverse().find((item) => item.hour <= hour) ?? anchors[anchors.length - 1];
    return {
      ...anchor,
      hour,
    };
  });
}

export function normalizeWorldAgentSchedule(value: unknown): WorldAgentScheduleItem[] {
  const raw = Array.isArray(value) ? value : [];
  const expanded = raw.flatMap((item) => {
    const record = asRecord(item);
    const text = typeof item === "string" ? item : cleanString(record.activity ?? record.description ?? record.note ?? record.plan);
    if (!text) return [item];
    const looseRecords = extractLooseScheduleRecords(text);
    return looseRecords.length > 0 ? looseRecords : [item];
  });
  const seen = new Set<string>();
  const items: WorldAgentScheduleItem[] = [];
  for (let index = 0; index < expanded.length; index += 1) {
    const item = scheduleItemFromRecord(expanded[index], index);
    if (!item) continue;
    const key = `${item.hour}|${item.location || ""}|${item.activity}`;
    if (seen.has(key)) continue;
    seen.add(key);
    items.push(item);
  }
  return expandScheduleToEveryHour(items.sort((left, right) => left.hour - right.hour));
}

export function parseWorldAgentSchedule(raw: unknown): WorldAgentScheduleItem[] {
  const parsed = parseJsonishValue(raw);
  const obj = asRecord(parsed);
  const scheduleValue = obj.schedule ?? obj.dailySchedule ?? obj.daily_schedule ?? obj.plan;
  const candidate =
    Array.isArray(parsed) ? parsed
      : Array.isArray(scheduleValue) ? scheduleValue
        : scheduleValue && typeof scheduleValue === "object" ? [scheduleValue]
              : [];
  const normalized = normalizeWorldAgentSchedule(candidate);
  if (normalized.length > 0) return normalized;
  if (typeof raw === "string") {
    const loose = normalizeWorldAgentSchedule(extractLooseScheduleRecords(raw));
    if (loose.length > 0) return loose;
    if (looksLikeStructuredScheduleText(raw)) return [];
    const fallback = normalizeDirectiveText(raw, 900);
    return fallback ? normalizeWorldAgentSchedule([{ hour: 0, activity: fallback }]) : [];
  }
  return [];
}

export function parseWorldAgentUpdate(raw: unknown): WorldAgentUpdate {
  const parsed = parseJsonishValue(raw);
  const obj = asRecord(parsed);
  const update: WorldAgentUpdate = {
    location: cleanString(obj.location ?? obj.place ?? obj.where) || undefined,
    mood: cleanString(obj.mood ?? obj.emotion ?? obj.affect) || undefined,
    activity: cleanString(obj.activity ?? obj.action ?? obj.current_activity ?? obj.currentActivity) || undefined,
    thought: cleanString(obj.thought ?? obj.current_thought ?? obj.currentThought ?? obj.inner_monologue) || undefined,
    goal: cleanString(obj.goal ?? obj.intent ?? obj.objective ?? obj.current_goal ?? obj.currentGoal) || undefined,
  };
  if (Object.values(update).some(Boolean)) return update;
  if (typeof raw === "string") {
    const fallback = normalizeDirectiveText(raw, 900);
    if (fallback) return { thought: fallback };
  }
  return {};
}

export function appendWorldAgentHistory(
  state: WorldAgentState,
  action: string,
  preview?: string | null,
  error?: string | null,
  timestamp = Date.now(),
): WorldAgentState {
  const entry: WorldAgentHistoryEntry = {
    id: typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${timestamp}-${Math.random()}`,
    timestamp,
    day: state.day,
    hour: state.hour,
    action,
    preview: makeDirectivePreview(preview, 240),
    error: makeDirectivePreview(error, 240),
  };
  return {
    ...state,
    updatedAt: timestamp,
    history: [entry, ...state.history].slice(0, WORLD_AGENT_HISTORY_LIMIT),
  };
}

export function advanceWorldAgentHour(state: WorldAgentState, timestamp = Date.now()): WorldAgentState {
  const nextHour = (state.hour + 1) % 24;
  const nextDay = nextHour === 0 ? state.day + 1 : state.day;
  return {
    ...state,
    day: nextDay,
    hour: nextHour,
    lastTickAt: timestamp,
    scheduleDay: nextDay !== state.day ? null : state.scheduleDay,
    schedule: nextDay !== state.day ? [] : state.schedule,
    updatedAt: timestamp,
  };
}

export function isWorldAgentHourDue(
  state: WorldAgentState,
  settings: WorldAgentSettings,
  now = Date.now(),
  visible = true,
): { due: boolean; shouldResetLastTick: boolean; reason?: string } {
  if (!settings.enabled) return { due: false, shouldResetLastTick: false, reason: "disabled" };
  if (!state.running) return { due: false, shouldResetLastTick: false, reason: "paused" };
  if (settings.autoTickVisibleOnly && !visible) {
    return { due: false, shouldResetLastTick: state.lastTickAt != null, reason: "hidden" };
  }
  if (state.lastTickAt == null) return { due: false, shouldResetLastTick: true, reason: "initialized" };
  return {
    due: now - state.lastTickAt >= settings.hourDurationMs,
    shouldResetLastTick: false,
  };
}

export function applyWorldAgentUpdate(state: WorldAgentState, update: WorldAgentUpdate, timestamp = Date.now()): WorldAgentState {
  return {
    ...state,
    location: cleanString(update.location, state.location),
    mood: cleanString(update.mood, state.mood),
    activity: cleanString(update.activity, state.activity),
    thought: cleanString(update.thought, state.thought),
    goal: cleanString(update.goal, state.goal),
    updatedAt: timestamp,
  };
}

export function formatWorldAgentClock(day: number, hour: number): string {
  return `Day ${Math.max(1, Math.round(day))}, ${String(Math.max(0, Math.min(23, Math.round(hour)))).padStart(2, "0")}:00`;
}

export function formatWorldAgentHourLabel(hour: number): string {
  const normalized = Math.max(0, Math.min(23, Math.round(hour)));
  const period = normalized < 12 ? "am" : "pm";
  const displayHour = normalized % 12 || 12;
  return `${displayHour}:00${period}`;
}

export function currentScheduleItems(state: WorldAgentState): WorldAgentScheduleItem[] {
  return state.schedule.filter((item) => item.hour === state.hour);
}

export function formatWorldAgentSchedule(schedule: WorldAgentScheduleItem[]): string {
  if (!schedule.length) return "No schedule generated.";
  return schedule
    .map((item) => {
      const pieces = [
        formatWorldAgentHourLabel(item.hour),
        item.location ? `Location: ${item.location}` : null,
        `Activity: ${item.activity}`,
      ].filter(Boolean);
      return `- ${pieces.join(" | ")}`;
    })
    .join("\n");
}

export function formatWorldAgentStateForPrompt(state: WorldAgentState): string {
  const currentSchedule = currentScheduleItems(state);
  return [
    formatWorldAgentClock(state.day, state.hour),
    `Running: ${state.running ? "yes" : "paused"}`,
    `Location: ${state.location || "Unspecified"}`,
    `Mood: ${state.mood || "Neutral"}`,
    `Activity: ${state.activity || "Idle"}`,
    state.thought ? `Current thought: ${state.thought}` : null,
    state.goal ? `Goal: ${state.goal}` : null,
    "",
    "Current schedule slot:",
    currentSchedule.length ? formatWorldAgentSchedule(currentSchedule) : "No matching schedule slot.",
    "",
    "Daily schedule:",
    formatWorldAgentSchedule(state.schedule),
  ].filter((line) => line !== null).join("\n");
}

export function buildWorldAgentStateInjection(state: WorldAgentState): string {
  return [
    "[LumiWorld World Agent]",
    "Use this private simulation state to keep the next visible reply aligned with the ongoing world clock. Do not mention LumiWorld, the World Agent, the clock system, or this note.",
    "",
    formatWorldAgentStateForPrompt(state),
  ].join("\n");
}

export function makeWorldAgentPreview(state: WorldAgentState): string {
  return [
    formatWorldAgentClock(state.day, state.hour),
    state.location ? `at ${state.location}` : null,
    state.activity ? `doing ${state.activity}` : null,
    state.mood ? `mood ${state.mood}` : null,
  ].filter(Boolean).join(" / ");
}
