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
}

export interface PromptSnapshot {
  prompt: string;
  truncated: boolean;
  originalChars: number;
  includedChars: number;
  messageCount: number;
}

export interface ControllerTemplateContext {
  prompt: string;
  generationType: string;
  chatId: string;
  connectionId: string;
  timestamp: string;
  maxDirectiveChars: string;
  additionalNotes: string;
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

export const DEFAULT_USER_TEMPLATE = [
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

export const DEFAULT_SETTINGS: LumiWorldSettings = {
  enabled: false,
  connectionId: null,
  modelOverride: "",
  temperature: 0.35,
  maxTokens: 420,
  timeoutMs: 45000,
  maxInputChars: 60000,
  historyMessageLimit: DEFAULT_HISTORY_MESSAGE_LIMIT,
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
    storedUserTemplate === PREVIOUS_DEFAULT_USER_TEMPLATE
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

export function selectChatHistoryMessagesForController(messages: LlmMessageLike[], limit: number): LlmMessageLike[] {
  const cappedLimit = Math.max(0, Math.floor(Number.isFinite(limit) ? limit : DEFAULT_SETTINGS.historyMessageLimit));
  if (cappedLimit <= 0) return [];
  return messages.filter(isChatHistoryMessage).slice(-cappedLimit);
}

function formatMessageBlock(message: LlmMessageLike, index: number): string {
  const name = message.name ? ` name=${message.name}` : "";
  const content = serializeMessageContent(message.content).trim() || "[empty]";
  return `### Chat Message ${index + 1} (${message.role}${name})\n${content}`;
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

  const omission = "\n\n[... middle of chat history omitted to fit LumiWorld context cap ...]\n\n";
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
  context: Omit<ControllerTemplateContext, "prompt" | "maxDirectiveChars" | "timestamp" | "additionalNotes"> & Partial<Pick<ControllerTemplateContext, "timestamp">>,
): LlmMessageLike[] {
  const additionalNotes = settings.additionalNotes.trim();
  const vars: ControllerTemplateContext = {
    prompt: snapshot.prompt,
    generationType: context.generationType,
    chatId: context.chatId,
    connectionId: context.connectionId,
    timestamp: context.timestamp || new Date().toISOString(),
    maxDirectiveChars: String(MAX_DIRECTIVE_CHARS),
    // Notes are sent as their own controller-only message; keep the legacy token empty to avoid duplication.
    additionalNotes: "",
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
