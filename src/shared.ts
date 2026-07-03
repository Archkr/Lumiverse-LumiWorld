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
export const MAX_CONTROLLER_TIMEOUT_MS = 2_147_483_647;
export const MAX_CHAT_HISTORY_MESSAGES = Number.MAX_SAFE_INTEGER;
export const DEFAULT_RUN_LOG_LIMIT = 12;
export const DEFAULT_HISTORY_MESSAGE_LIMIT = 12;
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
      return {
        id,
        timestamp,
        status,
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

export function renderTemplate(template: string, vars: ControllerTemplateContext): string {
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
