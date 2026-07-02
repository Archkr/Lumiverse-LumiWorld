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
var MAX_DIRECTIVE_CHARS = 2200;
var MAX_CONTROLLER_OUTPUT_TOKENS = Number.MAX_SAFE_INTEGER;
var MAX_CONTROLLER_TIMEOUT_MS = 2147483647;
var MAX_CHAT_HISTORY_MESSAGES = Number.MAX_SAFE_INTEGER;
var DEFAULT_RUN_LOG_LIMIT = 12;
var DEFAULT_HISTORY_MESSAGE_LIMIT = 12;
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
var DEFAULT_SYSTEM_TEMPLATE = [
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
  '{"director_note":"..."}',
  "",
  "Plain text is acceptable if needed. Keep it under {{maxDirectiveChars}} characters."
].join(`
`);
var DEFAULT_USER_TEMPLATE = [
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
var DEFAULT_SETTINGS = {
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
  runLogLimit: DEFAULT_RUN_LOG_LIMIT
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
  return normalized.length ? [...new Set(normalized)] : [...DEFAULT_SETTINGS.generationTypes];
}
function normalizeSettings(value) {
  const obj = asRecord(value);
  const storedSystemTemplate = cleanString(obj.systemTemplate, DEFAULT_SYSTEM_TEMPLATE);
  const storedUserTemplate = cleanString(obj.userTemplate, DEFAULT_USER_TEMPLATE);
  const systemTemplate = !storedSystemTemplate || storedSystemTemplate === LEGACY_DEFAULT_SYSTEM_TEMPLATE || storedSystemTemplate === PREVIOUS_DEFAULT_SYSTEM_TEMPLATE || storedSystemTemplate === PRE_REBRAND_DEFAULT_SYSTEM_TEMPLATE ? DEFAULT_SYSTEM_TEMPLATE : storedSystemTemplate;
  const userTemplate = !storedUserTemplate || storedUserTemplate === LEGACY_DEFAULT_USER_TEMPLATE || storedUserTemplate === PREVIOUS_DEFAULT_USER_TEMPLATE ? DEFAULT_USER_TEMPLATE : storedUserTemplate;
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
    runLogLimit: integerInRange(obj.runLogLimit, DEFAULT_SETTINGS.runLogLimit, 0, 50)
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
      error: cleanNullableString(obj.error)
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
function selectChatHistoryMessagesForController(messages, limit) {
  const cappedLimit = Math.max(0, Math.floor(Number.isFinite(limit) ? limit : DEFAULT_SETTINGS.historyMessageLimit));
  if (cappedLimit <= 0)
    return [];
  return messages.filter(isChatHistoryMessage).slice(-cappedLimit);
}
function formatMessageBlock(message, index) {
  const name = message.name ? ` name=${message.name}` : "";
  const content = serializeMessageContent(message.content).trim() || "[empty]";
  return `### Chat Message ${index + 1} (${message.role}${name})
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

[... middle of chat history omitted to fit LumiWorld context cap ...]

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
  const additionalNotes = settings.additionalNotes.trim();
  const vars = {
    prompt: snapshot.prompt,
    generationType: context.generationType,
    chatId: context.chatId,
    connectionId: context.connectionId,
    timestamp: context.timestamp || new Date().toISOString(),
    maxDirectiveChars: String(MAX_DIRECTIVE_CHARS),
    additionalNotes: ""
  };
  const renderedSystem = renderTemplate(settings.systemTemplate, vars);
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
function normalizeDirectiveText(value, maxChars) {
  const normalized = value.replace(/\r/g, "").replace(/\n{3,}/g, `

`).trim();
  if (!normalized)
    return null;
  if (normalized.length <= maxChars)
    return normalized;
  return `${normalized.slice(0, Math.max(0, maxChars - 1)).trimEnd()}...`;
}
function parseControllerDirective(raw, maxChars = MAX_DIRECTIVE_CHARS) {
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
        return normalizeDirectiveText(obj[key], maxChars);
    }
    const firstString = Object.values(obj).find((value) => typeof value === "string" && value.trim().length > 0);
    if (firstString)
      return normalizeDirectiveText(firstString, maxChars);
  }
  return normalizeDirectiveText(stripped, maxChars);
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
function parseControllerDirectiveFromResponse(response, maxChars = MAX_DIRECTIVE_CHARS) {
  return parseControllerDirective(extractControllerResponseText(response), maxChars);
}
function buildInjectedDirective(directive) {
  return [
    "[LumiWorld Director]",
    "Use this private world-state directive to guide the next visible reply. Do not mention LumiWorld, the controller, or this note.",
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

// src/backend.ts
var SETTINGS_PATH = "global/settings.json";
var RUNS_PATH = "global/runs.json";
var INTERCEPTOR_PRIORITY = 150;
var lastFrontendUserId = null;
var chatUserIds = new Map;
var interceptorRegistered = false;
var controllerBusy = false;

class ControllerTimeoutError extends Error {
  constructor(timeoutMs) {
    super(`LumiWorld controller timed out after ${Math.round(timeoutMs / 1000)}s.`);
    this.name = "ControllerTimeoutError";
  }
}

class EmptyControllerDirectiveError extends Error {
  constructor(response) {
    super(describeEmptyControllerResponse(response));
    this.name = "EmptyControllerDirectiveError";
  }
}
function storageApi() {
  return spindle.userStorage;
}
function connectionsApi() {
  return spindle.connections;
}
function permissionsApi() {
  return spindle.permissions;
}
function send(message, userId = lastFrontendUserId ?? undefined) {
  spindle.sendToFrontend(message, userId);
}
function permissionHas(permission) {
  const permissions = permissionsApi();
  if (!permissions || typeof permissions.has !== "function")
    return true;
  try {
    return !!permissions.has(permission);
  } catch {
    return false;
  }
}
function currentPermissions() {
  return {
    interceptor: permissionHas("interceptor"),
    generation: permissionHas("generation")
  };
}
function rememberChatUser(chatId, userId) {
  if (!chatId || !userId)
    return;
  chatUserIds.set(chatId, userId);
}
function resolveUserId(chatId) {
  if (chatId) {
    const mapped = chatUserIds.get(chatId);
    if (mapped)
      return mapped;
  }
  return lastFrontendUserId;
}
function extractChatId(value) {
  if (!value || typeof value !== "object")
    return null;
  const raw = value.chatId ?? value.chat_id;
  return typeof raw === "string" && raw.trim() ? raw : null;
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
function readChatIdFromMessage(message) {
  return "chatId" in message && typeof message.chatId === "string" && message.chatId.trim() ? message.chatId : null;
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
  const current = await loadSettings(userId);
  const next = normalizeSettings({ ...current, ...patch });
  await storageApi().setJson(SETTINGS_PATH, next, { indent: 2, userId: userId ?? undefined });
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
async function saveRuns(runs, userId) {
  await ensureFolders(userId);
  await storageApi().setJson(RUNS_PATH, runs, { indent: 2, userId: userId ?? undefined });
}
async function recordRun(entry, userId, settings) {
  try {
    const resolvedSettings = settings ?? await loadSettings(userId);
    const existing = await loadRuns(userId, resolvedSettings.runLogLimit);
    const next = appendRunLog(existing, entry, resolvedSettings.runLogLimit);
    await saveRuns(next, userId);
    send({ type: "run_logged", run: entry }, userId ?? undefined);
  } catch (error) {
    spindle.log.warn(`LumiWorld could not record run: ${error instanceof Error ? error.message : String(error)}`);
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
async function buildState(userId) {
  const settings = await loadSettings(userId);
  const [connectionState, runs] = await Promise.all([
    listConnections(userId),
    loadRuns(userId, settings.runLogLimit)
  ]);
  return {
    settings,
    connections: connectionState.connections,
    connectionError: connectionState.error,
    runs,
    permissions: currentPermissions()
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
        temperature: settings.temperature,
        max_tokens: settings.maxTokens
      },
      reasoning: { source: "off" },
      signal: controller.signal
    });
    const directive = parseControllerDirectiveFromResponse(response);
    if (!directive) {
      throw new EmptyControllerDirectiveError(response);
    }
    return { directive, durationMs: Date.now() - startedAt };
  } catch (error) {
    if (timedOut || error instanceof Error && error.name === "AbortError") {
      throw new ControllerTimeoutError(settings.timeoutMs);
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}
async function handleInterceptor(messages, context) {
  const chatId = extractChatId(context);
  const userId = resolveUserId(chatId);
  const generationType = extractGenerationType(context);
  const startedAt = Date.now();
  const settings = await loadSettings(userId);
  const decision = shouldInterceptGeneration(settings, generationType);
  if (!decision.intercept)
    return messages;
  if (!permissionHas("generation")) {
    await recordRun(makeRunBase("skipped", startedAt, {
      generationType,
      error: "Generation permission is not granted."
    }), userId, settings);
    return messages;
  }
  if (controllerBusy) {
    await recordRun(makeRunBase("skipped", startedAt, {
      generationType,
      error: "Another LumiWorld controller call is already running."
    }), userId, settings);
    return messages;
  }
  const connection = await getConnection(settings.connectionId, userId);
  const target = resolveControllerTarget(settings, connection);
  if (!target.ok) {
    await recordRun(makeRunBase("skipped", startedAt, {
      generationType,
      connectionId: settings.connectionId,
      error: target.reason
    }), userId, settings);
    return messages;
  }
  controllerBusy = true;
  try {
    const controllerContextMessages = selectChatHistoryMessagesForController(messages, settings.historyMessageLimit);
    const promptSnapshot = formatPromptForController(controllerContextMessages, settings.maxInputChars);
    const controllerMessages = buildControllerMessages(settings, promptSnapshot, {
      generationType,
      chatId: chatId || "",
      connectionId: extractConnectionId(context)
    });
    const { directive, durationMs } = await callController(userId, settings, target, controllerMessages);
    const injected = {
      role: "system",
      content: buildInjectedDirective(directive)
    };
    await recordRun(makeRunBase("success", startedAt, {
      generationType,
      durationMs,
      connectionId: target.connectionId,
      connectionName: target.connectionName,
      model: target.model,
      directivePreview: makeDirectivePreview(directive)
    }), userId, settings);
    return {
      messages: [injected, ...messages],
      breakdown: [{ messageIndex: 0, name: BREAKDOWN_NAME }]
    };
  } catch (error) {
    const isTimeout = error instanceof ControllerTimeoutError;
    const isEmptyDirective = error instanceof EmptyControllerDirectiveError;
    const message = error instanceof Error ? error.message : String(error);
    await recordRun(makeRunBase(isTimeout ? "timeout" : isEmptyDirective ? "skipped" : "error", startedAt, {
      generationType,
      connectionId: target.connectionId,
      connectionName: target.connectionName,
      model: target.model,
      error: message
    }), userId, settings);
    spindle.log.warn(`LumiWorld interceptor skipped injection: ${message}`);
    return messages;
  } finally {
    controllerBusy = false;
  }
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
    await recordRun(makeRunBase("test_error", startedAt, { error }), userId, settings);
    send({ type: "test_result", ok: false, error }, userId ?? undefined);
    return;
  }
  const connection = await getConnection(settings.connectionId, userId);
  const target = resolveControllerTarget(settings, connection);
  if (!target.ok) {
    await recordRun(makeRunBase("test_error", startedAt, { connectionId: settings.connectionId, error: target.reason }), userId, settings);
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
  pushState();
});
permissionsApi()?.onDenied?.(({ permission, operation }) => {
  spindle.log.warn(`LumiWorld permission denied for ${operation}: ${permission}`);
});
spindle.onFrontendMessage(async (raw, userId) => {
  lastFrontendUserId = userId;
  const message = raw;
  rememberChatUser(readChatIdFromMessage(message), userId);
  try {
    await ensureFolders(userId);
    switch (message.type) {
      case "ready":
      case "refresh_state":
        await pushState(userId);
        break;
      case "save_settings": {
        const settings = await saveSettings(message.settings, userId);
        send({ type: "settings_saved", settings }, userId);
        await pushState(userId);
        break;
      }
      case "test_controller":
        await runControllerTest(userId, message.settings);
        await pushState(userId);
        break;
      case "clear_runs":
        await saveRuns([], userId);
        await pushState(userId);
        break;
    }
  } catch (error) {
    const description = error instanceof Error ? error.message : "Unknown LumiWorld error.";
    spindle.log.error(`LumiWorld backend error: ${description}`);
    send({ type: "error", message: description }, userId);
  }
});
spindle.log.info("LumiWorld loaded.");
