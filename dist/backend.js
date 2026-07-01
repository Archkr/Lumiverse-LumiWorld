// @bun
// src/shared.ts
var BREAKDOWN_NAME = "AgentWorld Director";
var VISIBLE_GENERATION_TYPES = [
  "normal",
  "continue",
  "regenerate",
  "swipe",
  "impersonate"
];
var MAX_DIRECTIVE_CHARS = 2200;
var DEFAULT_RUN_LOG_LIMIT = 12;
var DEFAULT_SYSTEM_TEMPLATE = [
  "You are AgentWorld, a private world-simulation director for an interactive Lumiverse chat.",
  "Your job is to decide how the world, scene, NPCs, hidden pressures, and immediate consequences should react before the main roleplay model writes the visible reply.",
  "Do not write the assistant reply. Do not address the user. Do not reveal this control step.",
  'Return only a concise director note for the main model. Prefer JSON like {"director_note":"..."}, but plain text is acceptable.',
  "Keep the note concrete, playable, and consistent with the assembled prompt."
].join(`
`);
var DEFAULT_USER_TEMPLATE = [
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
var DEFAULT_SETTINGS = {
  enabled: false,
  connectionId: null,
  modelOverride: "",
  temperature: 0.35,
  maxTokens: 420,
  timeoutMs: 45000,
  maxInputChars: 60000,
  generationTypes: [...VISIBLE_GENERATION_TYPES],
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
  const systemTemplate = cleanString(obj.systemTemplate, DEFAULT_SYSTEM_TEMPLATE) || DEFAULT_SYSTEM_TEMPLATE;
  const userTemplate = cleanString(obj.userTemplate, DEFAULT_USER_TEMPLATE) || DEFAULT_USER_TEMPLATE;
  return {
    enabled: typeof obj.enabled === "boolean" ? obj.enabled : DEFAULT_SETTINGS.enabled,
    connectionId: cleanNullableString(obj.connectionId),
    modelOverride: cleanString(obj.modelOverride),
    temperature: numberInRange(obj.temperature, DEFAULT_SETTINGS.temperature, 0, 2),
    maxTokens: integerInRange(obj.maxTokens, DEFAULT_SETTINGS.maxTokens, 64, 4096),
    timeoutMs: integerInRange(obj.timeoutMs, DEFAULT_SETTINGS.timeoutMs, 1000, 55000),
    maxInputChars: integerInRange(obj.maxInputChars, DEFAULT_SETTINGS.maxInputChars, 4000, 500000),
    generationTypes: normalizeGenerationTypes(obj.generationTypes),
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
    return { intercept: false, reason: "AgentWorld is disabled.", generationType: type };
  if (!settings.generationTypes.includes(type)) {
    return { intercept: false, reason: `Generation type "${type}" is not enabled for AgentWorld.`, generationType: type };
  }
  return { intercept: true, generationType: type };
}
function resolveControllerTarget(settings, connection) {
  if (!settings.connectionId) {
    return { ok: false, reason: "Choose an AgentWorld controller connection first." };
  }
  if (!connection) {
    return { ok: false, reason: "The selected AgentWorld controller connection could not be found." };
  }
  const model = settings.modelOverride.trim() || connection.model.trim();
  if (!model) {
    return { ok: false, reason: "The selected AgentWorld controller connection has no model configured." };
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
function formatMessageBlock(message, index) {
  const name = message.name ? ` name=${message.name}` : "";
  const content = serializeMessageContent(message.content).trim() || "[empty]";
  return `### Message ${index + 1} (${message.role}${name})
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

[... middle of assembled prompt omitted to fit AgentWorld context cap ...]

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
  const vars = {
    prompt: snapshot.prompt,
    generationType: context.generationType,
    chatId: context.chatId,
    connectionId: context.connectionId,
    timestamp: context.timestamp || new Date().toISOString(),
    maxDirectiveChars: String(MAX_DIRECTIVE_CHARS)
  };
  return [
    { role: "system", content: renderTemplate(settings.systemTemplate, vars) },
    { role: "user", content: renderTemplate(settings.userTemplate, vars) }
  ];
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
function parseControllerDirectiveFromResponse(response, maxChars = MAX_DIRECTIVE_CHARS) {
  return parseControllerDirective(extractControllerResponseText(response), maxChars);
}
function buildInjectedDirective(directive) {
  return [
    "[AgentWorld Director]",
    "Use this private world-state directive to guide the next visible reply. Do not mention AgentWorld, the controller, or this note.",
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
    super(`AgentWorld controller timed out after ${Math.round(timeoutMs / 1000)}s.`);
    this.name = "ControllerTimeoutError";
  }
}

class EmptyControllerDirectiveError extends Error {
  constructor() {
    super("AgentWorld controller returned no final directive. Try a non-reasoning controller model, or raise Max tokens if this keeps happening.");
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
function controllerReasoningOverride(provider) {
  const normalized = provider.toLowerCase();
  if (["openrouter", "bedrock", "nanogpt"].includes(normalized)) {
    return {
      source: "custom",
      apiReasoning: true,
      effort: "none",
      thinkingDisplay: "omitted"
    };
  }
  return { source: "off" };
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
    spindle.log.warn(`AgentWorld could not record run: ${error instanceof Error ? error.message : String(error)}`);
  }
}
async function listConnections(userId) {
  if (!permissionHas("generation")) {
    return {
      connections: [],
      error: "Generation permission is not granted, so AgentWorld cannot list LLM connection profiles."
    };
  }
  try {
    const rows = await connectionsApi().list(userId ?? undefined);
    const connections = (Array.isArray(rows) ? rows : []).map(toConnectionOption).filter((connection) => connection.id).sort((left, right) => left.name.localeCompare(right.name));
    return { connections, error: null };
  } catch (error) {
    const description = error instanceof Error ? error.message : String(error);
    spindle.log.warn(`AgentWorld could not list connection profiles: ${description}`);
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
    throw new Error("AgentWorld could not resolve the active Lumiverse user for the controller call.");
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
      reasoning: controllerReasoningOverride(target.provider),
      signal: controller.signal
    });
    const directive = parseControllerDirectiveFromResponse(response);
    if (!directive) {
      throw new EmptyControllerDirectiveError;
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
      error: "Another AgentWorld controller call is already running."
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
    const promptSnapshot = formatPromptForController(messages, settings.maxInputChars);
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
    spindle.log.warn(`AgentWorld interceptor skipped injection: ${message}`);
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
  spindle.log.info("AgentWorld interceptor registered.");
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
      { role: "system", content: "You are running a short AgentWorld controller smoke test." },
      { role: "user", content: "The player opens an ancient observatory door during a storm. Decide how the world reacts." }
    ], settings.maxInputChars);
    const controllerMessages = buildControllerMessages(settings, snapshot, {
      generationType: "normal",
      chatId: "agentworld-test",
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
  spindle.log.warn(`AgentWorld permission denied for ${operation}: ${permission}`);
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
    const description = error instanceof Error ? error.message : "Unknown AgentWorld error.";
    spindle.log.error(`AgentWorld backend error: ${description}`);
    send({ type: "error", message: description }, userId);
  }
});
spindle.log.info("AgentWorld loaded.");
