// @bun
// src/shared.ts
var BREAKDOWN_NAME = "LumiWorld Director";
var WORLD_AGENT_BREAKDOWN_NAME = "LumiWorld World Agent";
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
var DEFAULT_WORLD_AGENT_HOUR_DURATION_MS = 5 * 60 * 1000;
var WORLD_AGENT_HISTORY_LIMIT = 24;
var CONTROLLER_CONTEXT_LABEL_KEY = "__lumiWorldContextLabel";
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
var PREVIOUS_DEFAULT_WORLD_AGENT_SCHEDULE_TEMPLATE = [
  "You are LumiWorld's private World Agent for an interactive Lumiverse chat.",
  "Create the current day's background schedule for {{char}}.",
  "",
  "Use the active character and persona context, the current chat state, and any provided notes.",
  "The schedule is private simulation scaffolding. Do not write visible roleplay prose.",
  "",
  "Return compact JSON only:",
  '{"schedule":[{"hour":0,"location":"...","activity":"...","mood":"...","goal":"..."}]}',
  "",
  "Cover the full day when possible. Keep entries short, playable, and flexible enough for the chat to override."
].join(`
`);
var PREVIOUS_BLOCK_WORLD_AGENT_SCHEDULE_TEMPLATE = [
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
  '{"schedule":[{"hour":0,"location":"...","activity":"..."},{"hour":7,"location":"...","activity":"..."},{"hour":12,"location":"...","activity":"..."},{"hour":18,"location":"...","activity":"..."}]}'
].join(`
`);
var DEFAULT_WORLD_AGENT_SCHEDULE_TEMPLATE = [
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
  '{"schedule":[{"hour":0,"location":"...","activity":"..."},{"hour":1,"location":"...","activity":"..."},{"hour":2,"location":"...","activity":"..."},{"hour":3,"location":"...","activity":"..."}]}'
].join(`
`);
var PREVIOUS_FULL_DAY_WORLD_AGENT_SCHEDULE_TEMPLATE = [
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
  '{"schedule":[{"hour":0,"location":"...","activity":"...","mood":"...","goal":"..."},{"hour":7,"location":"...","activity":"...","mood":"...","goal":"..."},{"hour":12,"location":"...","activity":"...","mood":"...","goal":"..."},{"hour":18,"location":"...","activity":"...","mood":"...","goal":"..."}]}'
].join(`
`);
var DEFAULT_WORLD_AGENT_UPDATE_TEMPLATE = [
  "You are LumiWorld's private World Agent for an interactive Lumiverse chat.",
  "Advance {{char}}'s private world state by one simulated hour.",
  "",
  "Use the schedule as a rough location/activity plan, plus current state, active character/persona context, and recent chat context.",
  "Track what changes in location, mood, activity, current thought, and immediate goal.",
  "Do not write the visible assistant reply. Do not mention LumiWorld or this control step.",
  "",
  "Return compact JSON only:",
  '{"location":"...","mood":"...","activity":"...","thought":"...","goal":"..."}'
].join(`
`);
var DEFAULT_WORLD_AGENT_SETTINGS = {
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
  updateTemplate: DEFAULT_WORLD_AGENT_UPDATE_TEMPLATE
};
var DEFAULT_SETTINGS = {
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
  worldAgent: DEFAULT_WORLD_AGENT_SETTINGS
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
function normalizeWorldAgentSettings(value) {
  const obj = asRecord(value);
  const storedScheduleTemplate = cleanString(obj.scheduleTemplate, DEFAULT_WORLD_AGENT_SCHEDULE_TEMPLATE);
  const storedUpdateTemplate = cleanString(obj.updateTemplate, DEFAULT_WORLD_AGENT_UPDATE_TEMPLATE);
  const scheduleTemplate = !storedScheduleTemplate || storedScheduleTemplate === PREVIOUS_DEFAULT_WORLD_AGENT_SCHEDULE_TEMPLATE || storedScheduleTemplate === PREVIOUS_FULL_DAY_WORLD_AGENT_SCHEDULE_TEMPLATE || storedScheduleTemplate === PREVIOUS_BLOCK_WORLD_AGENT_SCHEDULE_TEMPLATE ? DEFAULT_WORLD_AGENT_SCHEDULE_TEMPLATE : storedScheduleTemplate;
  return {
    enabled: typeof obj.enabled === "boolean" ? obj.enabled : DEFAULT_WORLD_AGENT_SETTINGS.enabled,
    connectionId: cleanNullableString(obj.connectionId),
    modelOverride: cleanString(obj.modelOverride),
    temperature: numberInRange(obj.temperature, DEFAULT_WORLD_AGENT_SETTINGS.temperature, 0, 2),
    maxTokens: integerInRange(obj.maxTokens, DEFAULT_WORLD_AGENT_SETTINGS.maxTokens, 64, MAX_CONTROLLER_OUTPUT_TOKENS),
    timeoutMs: integerInRange(obj.timeoutMs, DEFAULT_WORLD_AGENT_SETTINGS.timeoutMs, 1000, MAX_CONTROLLER_TIMEOUT_MS),
    hourDurationMs: integerInRange(obj.hourDurationMs, DEFAULT_WORLD_AGENT_SETTINGS.hourDurationMs, 1000, 365 * 24 * 60 * 60 * 1000),
    injectState: typeof obj.injectState === "boolean" ? obj.injectState : DEFAULT_WORLD_AGENT_SETTINGS.injectState,
    autoTickVisibleOnly: typeof obj.autoTickVisibleOnly === "boolean" ? obj.autoTickVisibleOnly : DEFAULT_WORLD_AGENT_SETTINGS.autoTickVisibleOnly,
    scheduleTemplate,
    updateTemplate: storedUpdateTemplate || DEFAULT_WORLD_AGENT_UPDATE_TEMPLATE
  };
}
function normalizeSettings(value) {
  const obj = asRecord(value);
  const storedSystemTemplate = cleanString(obj.systemTemplate, DEFAULT_SYSTEM_TEMPLATE);
  const storedUserTemplate = cleanString(obj.userTemplate, DEFAULT_USER_TEMPLATE);
  const systemTemplate = !storedSystemTemplate || storedSystemTemplate === LEGACY_DEFAULT_SYSTEM_TEMPLATE || storedSystemTemplate === PREVIOUS_DEFAULT_SYSTEM_TEMPLATE || storedSystemTemplate === PRE_REBRAND_DEFAULT_SYSTEM_TEMPLATE ? DEFAULT_SYSTEM_TEMPLATE : storedSystemTemplate;
  const userTemplate = !storedUserTemplate || storedUserTemplate === LEGACY_DEFAULT_USER_TEMPLATE || storedUserTemplate === PREVIOUS_DEFAULT_USER_TEMPLATE || storedUserTemplate === PRE_CONTEXT_DEFAULT_USER_TEMPLATE ? DEFAULT_USER_TEMPLATE : storedUserTemplate;
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
    worldAgent: normalizeWorldAgentSettings(obj.worldAgent)
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
      connectionId: cleanNullableString(obj.connectionId),
      connectionName: cleanNullableString(obj.connectionName),
      model: cleanNullableString(obj.model),
      directivePreview: cleanNullableString(obj.directivePreview),
      error: cleanNullableString(obj.error),
      worldAgentDay: obj.worldAgentDay == null ? null : integerInRange(obj.worldAgentDay, 1, 1, Number.MAX_SAFE_INTEGER),
      worldAgentHour: obj.worldAgentHour == null ? null : integerInRange(obj.worldAgentHour, 0, 0, 23),
      worldAgentScheduleCount: obj.worldAgentScheduleCount == null ? null : integerInRange(obj.worldAgentScheduleCount, 0, 0, Number.MAX_SAFE_INTEGER),
      worldInfoActivatedCount: obj.worldInfoActivatedCount == null ? null : integerInRange(obj.worldInfoActivatedCount, 0, 0, Number.MAX_SAFE_INTEGER),
      worldInfoFetchedCount: obj.worldInfoFetchedCount == null ? null : integerInRange(obj.worldInfoFetchedCount, 0, 0, Number.MAX_SAFE_INTEGER),
      worldInfoFallbackTaggedCount: obj.worldInfoFallbackTaggedCount == null ? null : integerInRange(obj.worldInfoFallbackTaggedCount, 0, 0, Number.MAX_SAFE_INTEGER),
      worldInfoFetchError: cleanNullableString(obj.worldInfoFetchError)
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
function resolveWorldAgentTarget(settings, connection) {
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
    maxDirectiveChars: String(MAX_DIRECTIVE_CHARS),
    additionalNotes: "",
    user: identity.userName,
    char: identity.characterName
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
function describeEmptyWorldAgentResponse(response) {
  const reasoning = extractControllerReasoningText(response);
  const reasoningTokens = readNumberAtPath(response, ["usage", "completion_tokens_details", "reasoning_tokens"]);
  const finishReason = readStringAtPath(response, ["finish_reason"]) ?? readStringAtPath(response, ["choices", 0, "finish_reason"]);
  const suffix = [
    reasoningTokens != null ? `${Math.round(reasoningTokens)} reasoning tokens` : null,
    finishReason ? `finish_reason=${finishReason}` : null
  ].filter(Boolean).join(", ");
  if (reasoning) {
    return [
      `LumiWorld World Agent returned reasoning-only output${suffix ? ` (${suffix})` : ""}.`,
      "No schedule or state update was applied because LumiWorld only uses final response content."
    ].join(" ");
  }
  return [
    `LumiWorld World Agent returned no final schedule or state update${suffix ? ` (${suffix})` : ""}.`,
    "No schedule or state update was applied."
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
function normalizeWorldAgentState(value, chatId, patch = {}) {
  const obj = asRecord(value);
  const now = Date.now();
  const rawHistory = Array.isArray(obj.history) ? obj.history : [];
  const history = rawHistory.map((item) => {
    const record = asRecord(item);
    const timestamp = numberInRange(record.timestamp, 0, 0, Number.MAX_SAFE_INTEGER);
    const action = cleanString(record.action);
    if (!timestamp || !action)
      return null;
    return {
      id: cleanString(record.id) || `${timestamp}-${action}`,
      timestamp,
      day: integerInRange(record.day, 1, 1, Number.MAX_SAFE_INTEGER),
      hour: integerInRange(record.hour, 0, 0, 23),
      action,
      preview: cleanNullableString(record.preview),
      error: cleanNullableString(record.error)
    };
  }).filter((item) => !!item).sort((left, right) => right.timestamp - left.timestamp).slice(0, WORLD_AGENT_HISTORY_LIMIT);
  const state = {
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
    history
  };
  return {
    ...state,
    ...patch,
    chatId,
    day: integerInRange(patch.day, state.day, 1, Number.MAX_SAFE_INTEGER),
    hour: integerInRange(patch.hour, state.hour, 0, 23),
    schedule: patch.schedule ? normalizeWorldAgentSchedule(patch.schedule) : state.schedule,
    history: patch.history ? normalizeWorldAgentState({ ...state, history: patch.history }, chatId).history : state.history
  };
}
function makeDefaultWorldAgentState(chatId, identity) {
  const now = Date.now();
  return normalizeWorldAgentState({
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
    history: []
  }, chatId);
}
function parseJsonishValue(value) {
  if (typeof value !== "string")
    return value ?? null;
  const stripped = stripCodeFence(value);
  try {
    return JSON.parse(stripped);
  } catch {
    const arrayMatch = stripped.match(/\[[\s\S]*\]/);
    if (arrayMatch) {
      try {
        return JSON.parse(arrayMatch[0]);
      } catch {}
    }
    return findJsonObject(stripped);
  }
}
function normalizeScheduleHour(value, fallback) {
  if (typeof value === "string") {
    const match = value.match(/\d{1,2}/);
    if (match)
      return integerInRange(Number(match[0]), fallback, 0, 23);
  }
  return integerInRange(value, fallback, 0, 23);
}
function parseLooseJsonObjectFragment(value) {
  const repaired = value.replace(/,\s*}/g, "}").replace(/([{,]\s*)([A-Za-z_][\w-]*)(\s*:)/g, '$1"$2"$3');
  try {
    return JSON.parse(repaired);
  } catch {
    return null;
  }
}
function extractLooseScheduleRecords(value) {
  const stripped = stripCodeFence(value);
  const matches = stripped.match(/\{[^{}]*\b(?:hour|time|start_hour|startHour)\b[^{}]*\}/gi) ?? [];
  return matches.map(parseLooseJsonObjectFragment).filter((item) => !!item && typeof item === "object" && !Array.isArray(item));
}
function scheduleItemFromRecord(value, index) {
  if (typeof value === "string") {
    const activity2 = normalizeDirectiveText(value, 600);
    return activity2 ? { hour: index % 24, activity: activity2 } : null;
  }
  const obj = asRecord(value);
  const activity = cleanString(obj.activity ?? obj.event ?? obj.task ?? obj.summary ?? obj.description ?? obj.note ?? obj.plan);
  const location = cleanString(obj.location ?? obj.place ?? obj.where);
  const label = cleanString(obj.label ?? obj.title ?? obj.time);
  if (!activity && !location)
    return null;
  return {
    hour: normalizeScheduleHour(obj.hour ?? obj.time ?? obj.start_hour ?? obj.startHour, index % 24),
    label: label || undefined,
    location: location || undefined,
    activity: activity || (location ? `At ${location}` : "Unspecified activity")
  };
}
function expandScheduleToEveryHour(items) {
  if (!items.length)
    return [];
  const byHour = new Map;
  for (const item of items) {
    if (!byHour.has(item.hour))
      byHour.set(item.hour, item);
  }
  const anchors = [...byHour.values()].sort((left, right) => left.hour - right.hour);
  return Array.from({ length: 24 }, (_, hour) => {
    const anchor = [...anchors].reverse().find((item) => item.hour <= hour) ?? anchors[anchors.length - 1];
    return {
      ...anchor,
      hour
    };
  });
}
function normalizeWorldAgentSchedule(value) {
  const raw = Array.isArray(value) ? value : [];
  const expanded = raw.flatMap((item) => {
    const record = asRecord(item);
    const text = typeof item === "string" ? item : cleanString(record.activity ?? record.description ?? record.note ?? record.plan);
    if (!text)
      return [item];
    const looseRecords = extractLooseScheduleRecords(text);
    return looseRecords.length > 1 ? looseRecords : [item];
  });
  const seen = new Set;
  const items = [];
  for (let index = 0;index < expanded.length; index += 1) {
    const item = scheduleItemFromRecord(expanded[index], index);
    if (!item)
      continue;
    const key = `${item.hour}|${item.location || ""}|${item.activity}`;
    if (seen.has(key))
      continue;
    seen.add(key);
    items.push(item);
  }
  return expandScheduleToEveryHour(items.sort((left, right) => left.hour - right.hour));
}
function parseWorldAgentSchedule(raw) {
  const parsed = parseJsonishValue(raw);
  const obj = asRecord(parsed);
  const scheduleValue = obj.schedule ?? obj.dailySchedule ?? obj.daily_schedule ?? obj.plan;
  const candidate = Array.isArray(parsed) ? parsed : Array.isArray(scheduleValue) ? scheduleValue : scheduleValue && typeof scheduleValue === "object" ? [scheduleValue] : [];
  const normalized = normalizeWorldAgentSchedule(candidate);
  if (normalized.length > 0)
    return normalized;
  if (typeof raw === "string") {
    const loose = normalizeWorldAgentSchedule(extractLooseScheduleRecords(raw));
    if (loose.length > 0)
      return loose;
    const fallback = normalizeDirectiveText(raw, 900);
    return fallback ? normalizeWorldAgentSchedule([{ hour: 0, activity: fallback }]) : [];
  }
  return [];
}
function parseWorldAgentUpdate(raw) {
  const parsed = parseJsonishValue(raw);
  const obj = asRecord(parsed);
  const update = {
    location: cleanString(obj.location ?? obj.place ?? obj.where) || undefined,
    mood: cleanString(obj.mood ?? obj.emotion ?? obj.affect) || undefined,
    activity: cleanString(obj.activity ?? obj.action ?? obj.current_activity ?? obj.currentActivity) || undefined,
    thought: cleanString(obj.thought ?? obj.current_thought ?? obj.currentThought ?? obj.inner_monologue) || undefined,
    goal: cleanString(obj.goal ?? obj.intent ?? obj.objective ?? obj.current_goal ?? obj.currentGoal) || undefined
  };
  if (Object.values(update).some(Boolean))
    return update;
  if (typeof raw === "string") {
    const fallback = normalizeDirectiveText(raw, 900);
    if (fallback)
      return { thought: fallback };
  }
  return {};
}
function appendWorldAgentHistory(state, action, preview, error, timestamp = Date.now()) {
  const entry = {
    id: typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${timestamp}-${Math.random()}`,
    timestamp,
    day: state.day,
    hour: state.hour,
    action,
    preview: makeDirectivePreview(preview, 240),
    error: makeDirectivePreview(error, 240)
  };
  return {
    ...state,
    updatedAt: timestamp,
    history: [entry, ...state.history].slice(0, WORLD_AGENT_HISTORY_LIMIT)
  };
}
function advanceWorldAgentHour(state, timestamp = Date.now()) {
  const nextHour = (state.hour + 1) % 24;
  const nextDay = nextHour === 0 ? state.day + 1 : state.day;
  return {
    ...state,
    day: nextDay,
    hour: nextHour,
    lastTickAt: timestamp,
    scheduleDay: nextDay !== state.day ? null : state.scheduleDay,
    schedule: nextDay !== state.day ? [] : state.schedule,
    updatedAt: timestamp
  };
}
function isWorldAgentHourDue(state, settings, now = Date.now(), visible = true) {
  if (!settings.enabled)
    return { due: false, shouldResetLastTick: false, reason: "disabled" };
  if (!state.running)
    return { due: false, shouldResetLastTick: false, reason: "paused" };
  if (settings.autoTickVisibleOnly && !visible) {
    return { due: false, shouldResetLastTick: state.lastTickAt != null, reason: "hidden" };
  }
  if (state.lastTickAt == null)
    return { due: false, shouldResetLastTick: true, reason: "initialized" };
  return {
    due: now - state.lastTickAt >= settings.hourDurationMs,
    shouldResetLastTick: false
  };
}
function applyWorldAgentUpdate(state, update, timestamp = Date.now()) {
  return {
    ...state,
    location: cleanString(update.location, state.location),
    mood: cleanString(update.mood, state.mood),
    activity: cleanString(update.activity, state.activity),
    thought: cleanString(update.thought, state.thought),
    goal: cleanString(update.goal, state.goal),
    updatedAt: timestamp
  };
}
function formatWorldAgentClock(day, hour) {
  return `Day ${Math.max(1, Math.round(day))}, ${String(Math.max(0, Math.min(23, Math.round(hour)))).padStart(2, "0")}:00`;
}
function formatWorldAgentHourLabel(hour) {
  const normalized = Math.max(0, Math.min(23, Math.round(hour)));
  const period = normalized < 12 ? "am" : "pm";
  const displayHour = normalized % 12 || 12;
  return `${displayHour}:00${period}`;
}
function currentScheduleItems(state) {
  return state.schedule.filter((item) => item.hour === state.hour);
}
function formatWorldAgentSchedule(schedule) {
  if (!schedule.length)
    return "No schedule generated.";
  return schedule.map((item) => {
    const pieces = [
      formatWorldAgentHourLabel(item.hour),
      item.location ? `Location: ${item.location}` : null,
      `Activity: ${item.activity}`
    ].filter(Boolean);
    return `- ${pieces.join(" | ")}`;
  }).join(`
`);
}
function formatWorldAgentStateForPrompt(state) {
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
    formatWorldAgentSchedule(state.schedule)
  ].filter((line) => line !== null).join(`
`);
}
function buildWorldAgentStateInjection(state) {
  return [
    "[LumiWorld World Agent]",
    "Use this private simulation state to keep the next visible reply aligned with the ongoing world clock. Do not mention LumiWorld, the World Agent, the clock system, or this note.",
    "",
    formatWorldAgentStateForPrompt(state)
  ].join(`
`);
}
function makeWorldAgentPreview(state) {
  return [
    formatWorldAgentClock(state.day, state.hour),
    state.location ? `at ${state.location}` : null,
    state.activity ? `doing ${state.activity}` : null,
    state.mood ? `mood ${state.mood}` : null
  ].filter(Boolean).join(" / ");
}

// src/backend.ts
var SETTINGS_PATH = "global/settings.json";
var RUNS_PATH = "global/runs.json";
var WORLD_AGENT_DIR = "world-agent/chats";
var INTERCEPTOR_PRIORITY = 150;
var WORLD_AGENT_TICK_INTERVAL_MS = 15000;
var lastFrontendUserId = null;
var chatUserIds = new Map;
var activeChats = new Map;
var worldAgentBusy = new Set;
var interceptorRegistered = false;
var controllerBusy = false;

class ControllerTimeoutError extends Error {
  constructor(timeoutMs) {
    super(`LumiWorld controller timed out after ${Math.round(timeoutMs / 1000)}s.`);
    this.name = "ControllerTimeoutError";
  }
}

class WorldAgentTimeoutError extends Error {
  constructor(timeoutMs) {
    super(`LumiWorld World Agent timed out after ${Math.round(timeoutMs / 1000)}s.`);
    this.name = "WorldAgentTimeoutError";
  }
}

class EmptyControllerDirectiveError extends Error {
  constructor(response) {
    super(describeEmptyControllerResponse(response));
    this.name = "EmptyControllerDirectiveError";
  }
}

class EmptyWorldAgentContentError extends Error {
  constructor(response) {
    super(describeEmptyWorldAgentResponse(response));
    this.name = "EmptyWorldAgentContentError";
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
function usersApi() {
  return spindle.users;
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
  worldBooks: "world_books"
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
    worldBooks: permissionHas("worldBooks")
  };
}
function rememberChatUser(chatId, userId) {
  if (!chatId || !userId)
    return;
  chatUserIds.set(chatId, userId);
}
function rememberActiveChat(chatId, userId, characterId) {
  if (!chatId || !userId)
    return;
  rememberChatUser(chatId, userId);
  activeChats.set(userId, {
    chatId,
    characterId: characterId && characterId.trim() ? characterId.trim() : activeChats.get(userId)?.characterId ?? null,
    lastSeenAt: Date.now()
  });
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
function readChatIdFromMessage(message) {
  return "chatId" in message && typeof message.chatId === "string" && message.chatId.trim() ? message.chatId : null;
}
function readCharacterIdFromMessage(message) {
  return "characterId" in message && typeof message.characterId === "string" && message.characterId.trim() ? message.characterId : null;
}
function sanitizeStorageSegment(value) {
  return value.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 160) || "unknown";
}
function worldAgentStatePath(chatId) {
  return `${WORLD_AGENT_DIR}/${sanitizeStorageSegment(chatId)}.json`;
}
function worldAgentBusyKey(userId, chatId) {
  return `${userId || "user"}:${chatId}`;
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
  await storageApi().mkdir("world-agent", userId ?? undefined).catch(() => {});
  await storageApi().mkdir(WORLD_AGENT_DIR, userId ?? undefined).catch(() => {});
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
  const next = normalizeSettings({
    ...current,
    ...patch,
    worldAgent: normalizeWorldAgentSettings({
      ...current.worldAgent,
      ...patch.worldAgent ?? {}
    })
  });
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
async function resolveActiveChatId(userId, explicitChatId) {
  if (explicitChatId && explicitChatId.trim())
    return explicitChatId.trim();
  const remembered = userId ? activeChats.get(userId)?.chatId : null;
  if (remembered)
    return remembered;
  if (!permissionHas("chats"))
    return null;
  try {
    const chat = await chatsApi().getActive(userId ?? undefined);
    return typeof chat?.id === "string" && chat.id.trim() ? chat.id.trim() : null;
  } catch {
    return null;
  }
}
async function loadWorldAgentState(chatId, userId, identity) {
  if (!chatId)
    return null;
  try {
    const stored = await storageApi().getJson(worldAgentStatePath(chatId), {
      fallback: makeDefaultWorldAgentState(chatId, identity),
      userId: userId ?? undefined
    });
    return normalizeWorldAgentState(stored, chatId, {
      activeCharacterId: identity?.characterId ?? normalizeWorldAgentState(stored, chatId).activeCharacterId,
      activePersonaId: identity?.personaId ?? normalizeWorldAgentState(stored, chatId).activePersonaId
    });
  } catch {
    return makeDefaultWorldAgentState(chatId, identity);
  }
}
async function loadExistingWorldAgentState(chatId, userId, identity) {
  if (!chatId)
    return null;
  try {
    const stored = await storageApi().getJson(worldAgentStatePath(chatId), {
      fallback: null,
      userId: userId ?? undefined
    });
    return stored ? normalizeWorldAgentState(stored, chatId, {
      activeCharacterId: identity?.characterId ?? normalizeWorldAgentState(stored, chatId).activeCharacterId,
      activePersonaId: identity?.personaId ?? normalizeWorldAgentState(stored, chatId).activePersonaId
    }) : null;
  } catch {
    return null;
  }
}
async function saveWorldAgentState(state, userId) {
  await ensureFolders(userId);
  const normalized = normalizeWorldAgentState(state, state.chatId);
  await storageApi().setJson(worldAgentStatePath(normalized.chatId), normalized, { indent: 2, userId: userId ?? undefined });
  send({ type: "world_state", state: normalized }, userId ?? undefined);
  return normalized;
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
    section("Personality", identityText(character.personality, identity)),
    section("Scenario", identityText(character.scenario, identity)),
    section("Creator notes", identityText(character.creator_notes, identity)),
    section("System prompt", identityText(character.system_prompt, identity)),
    section("Post-history instructions", identityText(character.post_history_instructions, identity)),
    section("Example messages", identityText(character.mes_example, identity)),
    section("Opening message", identityText(character.first_mes, identity))
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
async function resolveControllerContextMessages(settings, context, chatId, userId) {
  const [persona, character] = await Promise.all([
    resolvePersona(context, userId),
    resolveCharacter(context, chatId, userId)
  ]);
  const identity = makeIdentity(persona, character);
  const messages = [
    settings.includeUserPersona && persona ? makeControllerContextMessage("User Persona", formatPersonaContext(persona, identity)) : null,
    settings.includeCharacter && character ? makeControllerContextMessage("Character", formatCharacterContext(character, identity)) : null
  ].filter((message) => !!message);
  return { messages, identity, characterId: character?.id ?? null, personaId: persona?.id ?? null };
}
async function buildState(userId, chatId, characterId) {
  const settings = await loadSettings(userId);
  const resolvedChatId = await resolveActiveChatId(userId, chatId);
  const [connectionState, runs, worldState] = await Promise.all([
    listConnections(userId),
    loadRuns(userId, settings.runLogLimit),
    loadWorldAgentState(resolvedChatId, userId, { characterId })
  ]);
  return {
    settings,
    connections: connectionState.connections,
    connectionError: connectionState.error,
    runs,
    permissions: currentPermissions(),
    worldState
  };
}
async function pushState(userId, chatId, characterId) {
  send({ type: "state", state: await buildState(userId, chatId, characterId) }, userId ?? undefined);
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
function buildWorldAgentTemplateVars(state, identity, extra = {}) {
  return {
    chatId: state.chatId,
    user: identity.userName || "User",
    char: identity.characterName || "Character",
    day: String(state.day),
    hour: String(state.hour),
    time: `${String(state.hour).padStart(2, "0")}:00`,
    timestamp: new Date().toISOString(),
    state: formatWorldAgentStateForPrompt(state),
    schedule: formatWorldAgentSchedule(state.schedule),
    ...extra
  };
}
function buildWorldAgentMessages(options) {
  const vars = buildWorldAgentTemplateVars(options.state, options.identity);
  const systemTemplate = options.mode === "schedule" ? options.settings.scheduleTemplate : options.settings.updateTemplate;
  const system = renderTemplate(systemTemplate, vars);
  const action = options.mode === "schedule" ? "Generate today's full private schedule as exactly 24 hourly entries, one for every hour 0 through 23. Repeat location/activity across consecutive hours when needed. Only include hour, location, and activity; do not assign mood, thoughts, or current goals." : "Advance the private state by one simulated hour.";
  return [
    { role: "system", content: system },
    ...options.contextMessages,
    {
      role: "user",
      content: [
        action,
        "",
        `Chat ID: ${vars.chatId}`,
        `Current time: Day ${vars.day}, ${vars.time}`,
        "",
        "Current World Agent state:",
        "<world_state>",
        vars.state,
        "</world_state>"
      ].join(`
`)
    }
  ];
}
async function callWorldAgentModel(userId, settings, target, messages) {
  if (!userId) {
    throw new Error("LumiWorld could not resolve the active Lumiverse user for the World Agent call.");
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
    const text = extractControllerResponseText(response);
    if (!text) {
      throw new EmptyWorldAgentContentError(response);
    }
    return { text, durationMs: Date.now() - startedAt };
  } catch (error) {
    if (timedOut || error instanceof Error && error.name === "AbortError") {
      throw new WorldAgentTimeoutError(settings.timeoutMs);
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}
async function resolveWorldAgentContext(settings, chatId, userId, characterId) {
  const context = { chatId, characterId: characterId || undefined };
  const resolved = await resolveControllerContextMessages(settings, context, chatId, userId);
  return {
    contextMessages: resolved.messages,
    identity: resolved.identity,
    stateIdentity: { characterId: resolved.characterId, personaId: resolved.personaId }
  };
}
async function ensureWorldAgentSchedule(options) {
  const worldSettings = options.settings.worldAgent;
  if (!worldSettings.enabled)
    return options.state;
  if (!options.force && options.state.scheduleDay === options.state.day && options.state.schedule.length > 0)
    return options.state;
  if (!permissionHas("generation")) {
    return appendWorldAgentHistory(options.state, "schedule_error", null, "Generation permission is not granted.");
  }
  const startedAt = Date.now();
  const connection = await getConnection(worldSettings.connectionId, options.userId);
  const target = resolveWorldAgentTarget(worldSettings, connection);
  if (!target.ok) {
    const next = appendWorldAgentHistory(options.state, "schedule_error", null, target.reason);
    await recordRun(makeRunBase("skipped", startedAt, {
      channel: "world_agent",
      action: "schedule",
      connectionId: worldSettings.connectionId,
      error: target.reason,
      worldAgentDay: next.day,
      worldAgentHour: next.hour
    }), options.userId, options.settings);
    return next;
  }
  try {
    const messages = buildWorldAgentMessages({
      settings: worldSettings,
      state: options.state,
      identity: options.identity,
      contextMessages: options.contextMessages,
      mode: "schedule"
    });
    const { text, durationMs } = await callWorldAgentModel(options.userId, worldSettings, target, messages);
    const schedule = parseWorldAgentSchedule(text);
    const next = appendWorldAgentHistory({
      ...options.state,
      schedule,
      scheduleDay: options.state.day,
      updatedAt: Date.now()
    }, "schedule", schedule.length ? `${schedule.length} schedule entries generated.` : "No schedule entries generated.");
    await recordRun(makeRunBase(schedule.length ? "success" : "skipped", startedAt, {
      channel: "world_agent",
      action: "schedule",
      durationMs,
      connectionId: target.connectionId,
      connectionName: target.connectionName,
      model: target.model,
      directivePreview: `${schedule.length} schedule entries generated.`,
      worldAgentDay: next.day,
      worldAgentHour: next.hour,
      worldAgentScheduleCount: schedule.length
    }), options.userId, options.settings);
    return next;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const next = appendWorldAgentHistory(options.state, "schedule_error", null, message);
    await recordRun(makeRunBase(error instanceof WorldAgentTimeoutError ? "timeout" : "error", startedAt, {
      channel: "world_agent",
      action: "schedule",
      connectionId: target.connectionId,
      connectionName: target.connectionName,
      model: target.model,
      error: message,
      worldAgentDay: next.day,
      worldAgentHour: next.hour
    }), options.userId, options.settings);
    spindle.log.warn(`LumiWorld World Agent schedule skipped: ${message}`);
    return next;
  }
}
async function runWorldAgentHourUpdate(options) {
  const worldSettings = options.settings.worldAgent;
  let nextState = advanceWorldAgentHour(options.state);
  nextState = await ensureWorldAgentSchedule({
    userId: options.userId,
    settings: options.settings,
    state: nextState,
    contextMessages: options.contextMessages,
    identity: options.identity
  });
  if (!worldSettings.enabled)
    return nextState;
  if (!permissionHas("generation")) {
    return appendWorldAgentHistory(nextState, `${options.action}_error`, null, "Generation permission is not granted.");
  }
  const startedAt = Date.now();
  const connection = await getConnection(worldSettings.connectionId, options.userId);
  const target = resolveWorldAgentTarget(worldSettings, connection);
  if (!target.ok) {
    const skipped = appendWorldAgentHistory(nextState, `${options.action}_error`, null, target.reason);
    await recordRun(makeRunBase("skipped", startedAt, {
      channel: "world_agent",
      action: options.action,
      connectionId: worldSettings.connectionId,
      error: target.reason,
      worldAgentDay: skipped.day,
      worldAgentHour: skipped.hour
    }), options.userId, options.settings);
    return skipped;
  }
  try {
    const messages = buildWorldAgentMessages({
      settings: worldSettings,
      state: nextState,
      identity: options.identity,
      contextMessages: options.contextMessages,
      mode: "update"
    });
    const { text, durationMs } = await callWorldAgentModel(options.userId, worldSettings, target, messages);
    const parsed = parseWorldAgentUpdate(text);
    const updatedState = applyWorldAgentUpdate(nextState, parsed);
    nextState = appendWorldAgentHistory(updatedState, options.action, makeWorldAgentPreview(updatedState));
    await recordRun(makeRunBase("success", startedAt, {
      channel: "world_agent",
      action: options.action,
      durationMs,
      connectionId: target.connectionId,
      connectionName: target.connectionName,
      model: target.model,
      directivePreview: makeWorldAgentPreview(nextState),
      worldAgentDay: nextState.day,
      worldAgentHour: nextState.hour,
      worldAgentScheduleCount: nextState.schedule.length
    }), options.userId, options.settings);
    return nextState;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const failed = appendWorldAgentHistory(nextState, `${options.action}_error`, null, message);
    await recordRun(makeRunBase(error instanceof WorldAgentTimeoutError ? "timeout" : "error", startedAt, {
      channel: "world_agent",
      action: options.action,
      connectionId: target.connectionId,
      connectionName: target.connectionName,
      model: target.model,
      error: message,
      worldAgentDay: failed.day,
      worldAgentHour: failed.hour
    }), options.userId, options.settings);
    spindle.log.warn(`LumiWorld World Agent update skipped: ${message}`);
    return failed;
  }
}
async function injectWorldAgentOnly(messages, chatId, userId, characterId) {
  const state = await loadExistingWorldAgentState(chatId, userId, { characterId });
  if (!state)
    return messages;
  return {
    messages: [
      {
        role: "system",
        content: buildWorldAgentStateInjection(state)
      },
      ...messages
    ],
    breakdown: [{ messageIndex: 0, name: WORLD_AGENT_BREAKDOWN_NAME }]
  };
}
async function isUserVisible(userId) {
  try {
    return usersApi()?.isVisible ? !!await usersApi().isVisible(userId ?? undefined) : true;
  } catch {
    return true;
  }
}
async function loadWorldAgentBundle(userId, chatId, characterId) {
  const settings = await loadSettings(userId);
  const context = await resolveWorldAgentContext(settings, chatId, userId, characterId);
  const state = await loadWorldAgentState(chatId, userId, context.stateIdentity) ?? makeDefaultWorldAgentState(chatId, context.stateIdentity);
  return { settings, state, contextMessages: context.contextMessages, identity: context.identity };
}
async function tickWorldAgentChat(userId, chatId, characterId, manualAction = "hourly_update") {
  const busyKey = worldAgentBusyKey(userId, chatId);
  if (worldAgentBusy.has(busyKey))
    return null;
  worldAgentBusy.add(busyKey);
  try {
    const { settings, state, contextMessages, identity } = await loadWorldAgentBundle(userId, chatId, characterId);
    const next = await runWorldAgentHourUpdate({
      userId,
      settings,
      state,
      contextMessages,
      identity,
      action: manualAction
    });
    return await saveWorldAgentState(next, userId);
  } finally {
    worldAgentBusy.delete(busyKey);
  }
}
async function checkWorldAgentTimers() {
  for (const [userId, active] of activeChats.entries()) {
    const busyKey = worldAgentBusyKey(userId, active.chatId);
    if (worldAgentBusy.has(busyKey))
      continue;
    try {
      const settings = await loadSettings(userId);
      if (!settings.worldAgent.enabled)
        continue;
      const state = await loadExistingWorldAgentState(active.chatId, userId, { characterId: active.characterId });
      if (!state?.running)
        continue;
      const visible = await isUserVisible(userId);
      const due = isWorldAgentHourDue(state, settings.worldAgent, Date.now(), visible);
      if (due.shouldResetLastTick) {
        await saveWorldAgentState({ ...state, lastTickAt: Date.now(), updatedAt: Date.now() }, userId);
        continue;
      }
      if (!due.due)
        continue;
      await tickWorldAgentChat(userId, active.chatId, active.characterId, "hourly_update");
    } catch (error) {
      spindle.log.warn(`LumiWorld World Agent timer skipped: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}
async function refreshWorldStateForMessage(message, userId) {
  const chatId = await resolveActiveChatId(userId, readChatIdFromMessage(message));
  if (!chatId)
    return null;
  const characterId = readCharacterIdFromMessage(message);
  rememberActiveChat(chatId, userId, characterId);
  const existing = await loadExistingWorldAgentState(chatId, userId, { characterId });
  const state = existing?.running ? await saveWorldAgentState({ ...existing, lastTickAt: Date.now(), updatedAt: Date.now() }, userId) : await loadWorldAgentState(chatId, userId, { characterId });
  send({ type: "world_state", state }, userId);
  return state;
}
async function resumeWorldAgentClockWithoutCatchup(chatId, userId, characterId) {
  if (!chatId)
    return;
  const existing = await loadExistingWorldAgentState(chatId, userId, { characterId });
  if (!existing?.running)
    return;
  await saveWorldAgentState({ ...existing, lastTickAt: Date.now(), updatedAt: Date.now() }, userId);
}
async function handleInterceptor(messages, context) {
  const chatId = extractChatId(context);
  const contextCharacterId = extractCharacterId(context);
  const userId = resolveUserId(chatId);
  const generationType = extractGenerationType(context);
  const startedAt = Date.now();
  rememberActiveChat(chatId, userId, contextCharacterId);
  const settings = await loadSettings(userId);
  const directorDecision = shouldInterceptGeneration(settings, generationType);
  const visibleGeneration = VISIBLE_GENERATION_TYPES.includes(generationType);
  const shouldInjectWorldAgent = visibleGeneration && settings.worldAgent.enabled && settings.worldAgent.injectState && !!chatId;
  if (!directorDecision.intercept && !shouldInjectWorldAgent)
    return messages;
  if (!permissionHas("generation")) {
    if (directorDecision.intercept) {
      await recordRun(makeRunBase("skipped", startedAt, {
        channel: "director",
        generationType,
        error: "Generation permission is not granted."
      }), userId, settings);
    }
    return shouldInjectWorldAgent ? await injectWorldAgentOnly(messages, chatId, userId, contextCharacterId) : messages;
  }
  const injectedMessages = [];
  const breakdown = [];
  const promptMessages = messages;
  const controllerContext = await resolveControllerContextMessages(settings, context, chatId, userId);
  const worldAgentState = shouldInjectWorldAgent ? await loadExistingWorldAgentState(chatId, userId, {
    characterId: controllerContext.characterId ?? contextCharacterId,
    personaId: controllerContext.personaId
  }) : null;
  if (worldAgentState) {
    injectedMessages.push({
      role: "system",
      content: buildWorldAgentStateInjection(worldAgentState)
    });
    breakdown.push({ messageIndex: injectedMessages.length - 1, name: WORLD_AGENT_BREAKDOWN_NAME });
  }
  if (!directorDecision.intercept) {
    return injectedMessages.length ? { messages: [...injectedMessages, ...messages], breakdown } : messages;
  }
  if (controllerBusy) {
    await recordRun(makeRunBase("skipped", startedAt, {
      channel: "director",
      generationType,
      error: "Another LumiWorld controller call is already running."
    }), userId, settings);
    return messages;
  }
  const connection = await getConnection(settings.connectionId, userId);
  const target = resolveControllerTarget(settings, connection);
  if (!target.ok) {
    await recordRun(makeRunBase("skipped", startedAt, {
      channel: "director",
      generationType,
      connectionId: settings.connectionId,
      error: target.reason
    }), userId, settings);
    return messages;
  }
  controllerBusy = true;
  let worldInfoDiagnostics = {
    activatedEntryCount: 0,
    fetchedEntryCount: 0,
    fallbackTaggedEntryCount: 0,
    fetchError: null
  };
  try {
    const worldBooks = worldBooksApi();
    const worldInfoContext = await resolveWorldInfoContextMessages({
      messages: promptMessages,
      settings,
      context,
      canFetchWorldBooks: permissionHas("worldBooks") && !!worldBooks,
      fetchActivated: chatId && typeof worldBooks?.getActivated === "function" ? () => worldBooks.getActivated(chatId, userId ?? undefined) : undefined,
      fetchEntry: typeof worldBooks?.entries?.get === "function" ? (entryId) => worldBooks.entries.get(entryId, userId ?? undefined) : undefined,
      identity: controllerContext.identity
    });
    worldInfoDiagnostics = worldInfoContext.diagnostics;
    const worldAgentContextMessage = worldAgentState ? makeControllerContextMessage("World Agent State", formatWorldAgentStateForPrompt(worldAgentState)) : null;
    const controllerContextMessages = selectControllerMessagesForController(promptMessages, settings, [
      ...controllerContext.messages,
      ...worldInfoContext.messages,
      ...worldAgentContextMessage ? [worldAgentContextMessage] : []
    ]);
    const promptSnapshot = formatPromptForController(controllerContextMessages, settings.maxInputChars);
    const controllerMessages = buildControllerMessages(settings, promptSnapshot, {
      generationType,
      chatId: chatId || "",
      connectionId: extractConnectionId(context),
      user: controllerContext.identity.userName || "User",
      char: controllerContext.identity.characterName || "Character"
    });
    const { directive, durationMs } = await callController(userId, settings, target, controllerMessages);
    const injected = {
      role: "system",
      content: buildInjectedDirective(directive)
    };
    injectedMessages.push(injected);
    breakdown.push({ messageIndex: injectedMessages.length - 1, name: BREAKDOWN_NAME });
    await recordRun(makeRunBase("success", startedAt, {
      channel: "director",
      generationType,
      durationMs,
      connectionId: target.connectionId,
      connectionName: target.connectionName,
      model: target.model,
      directivePreview: makeDirectivePreview(directive),
      ...runLogWorldInfoPatch(worldInfoDiagnostics)
    }), userId, settings);
    return {
      messages: [...injectedMessages, ...messages],
      breakdown
    };
  } catch (error) {
    const isTimeout = error instanceof ControllerTimeoutError;
    const isEmptyDirective = error instanceof EmptyControllerDirectiveError;
    const message = error instanceof Error ? error.message : String(error);
    await recordRun(makeRunBase(isTimeout ? "timeout" : isEmptyDirective ? "skipped" : "error", startedAt, {
      channel: "director",
      generationType,
      connectionId: target.connectionId,
      connectionName: target.connectionName,
      model: target.model,
      error: message,
      ...runLogWorldInfoPatch(worldInfoDiagnostics)
    }), userId, settings);
    spindle.log.warn(`LumiWorld interceptor skipped injection: ${message}`);
    return injectedMessages.length ? { messages: [...injectedMessages, ...messages], breakdown } : messages;
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
setInterval(() => {
  checkWorldAgentTimers();
}, WORLD_AGENT_TICK_INTERVAL_MS);
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
  rememberActiveChat(readChatIdFromMessage(message), userId, readCharacterIdFromMessage(message));
  try {
    await ensureFolders(userId);
    switch (message.type) {
      case "ready":
        await resumeWorldAgentClockWithoutCatchup(readChatIdFromMessage(message), userId, readCharacterIdFromMessage(message));
        await pushState(userId, readChatIdFromMessage(message), readCharacterIdFromMessage(message));
        break;
      case "refresh_state":
        await pushState(userId, readChatIdFromMessage(message), readCharacterIdFromMessage(message));
        break;
      case "refresh_world_state":
        await refreshWorldStateForMessage(message, userId);
        break;
      case "save_settings": {
        const settings = await saveSettings(message.settings, userId);
        send({ type: "settings_saved", settings }, userId);
        await pushState(userId, readChatIdFromMessage(message), readCharacterIdFromMessage(message));
        break;
      }
      case "save_world_settings": {
        const settings = await saveSettings({ worldAgent: message.settings }, userId);
        send({ type: "settings_saved", settings }, userId);
        await pushState(userId, readChatIdFromMessage(message), readCharacterIdFromMessage(message));
        break;
      }
      case "test_controller":
        await runControllerTest(userId, message.settings);
        await pushState(userId, readChatIdFromMessage(message), readCharacterIdFromMessage(message));
        break;
      case "clear_runs":
        await saveRuns([], userId);
        await pushState(userId, readChatIdFromMessage(message), readCharacterIdFromMessage(message));
        break;
      case "world_agent_start": {
        const chatId = await resolveActiveChatId(userId, readChatIdFromMessage(message));
        if (!chatId) {
          send({ type: "world_agent_result", ok: false, error: "No active chat is available for the World Agent." }, userId);
          break;
        }
        rememberActiveChat(chatId, userId, readCharacterIdFromMessage(message));
        const bundle = await loadWorldAgentBundle(userId, chatId, readCharacterIdFromMessage(message));
        let state = {
          ...bundle.state,
          running: true,
          lastTickAt: Date.now(),
          activeCharacterId: bundle.state.activeCharacterId ?? readCharacterIdFromMessage(message),
          updatedAt: Date.now()
        };
        state = await ensureWorldAgentSchedule({
          userId,
          settings: bundle.settings,
          state,
          contextMessages: bundle.contextMessages,
          identity: bundle.identity
        });
        state = appendWorldAgentHistory(state, "start", "Clock started.");
        const saved = await saveWorldAgentState(state, userId);
        send({ type: "world_agent_result", ok: true, message: "World Agent clock started.", state: saved }, userId);
        await pushState(userId, chatId, readCharacterIdFromMessage(message));
        break;
      }
      case "world_agent_pause": {
        const chatId = await resolveActiveChatId(userId, readChatIdFromMessage(message));
        if (!chatId) {
          send({ type: "world_agent_result", ok: false, error: "No active chat is available for the World Agent." }, userId);
          break;
        }
        const state = await loadWorldAgentState(chatId, userId, { characterId: readCharacterIdFromMessage(message) });
        if (!state) {
          send({ type: "world_agent_result", ok: false, error: "No World Agent state exists for this chat." }, userId);
          break;
        }
        const saved = await saveWorldAgentState(appendWorldAgentHistory({ ...state, running: false, updatedAt: Date.now() }, "pause", "Clock paused."), userId);
        send({ type: "world_agent_result", ok: true, message: "World Agent clock paused.", state: saved }, userId);
        await pushState(userId, chatId, readCharacterIdFromMessage(message));
        break;
      }
      case "world_agent_advance_hour": {
        const chatId = await resolveActiveChatId(userId, readChatIdFromMessage(message));
        if (!chatId) {
          send({ type: "world_agent_result", ok: false, error: "No active chat is available for the World Agent." }, userId);
          break;
        }
        const state = await tickWorldAgentChat(userId, chatId, readCharacterIdFromMessage(message), "manual_advance");
        if (!state) {
          send({ type: "world_agent_result", ok: false, error: "World Agent is already running an update for this chat." }, userId);
          break;
        }
        send({ type: "world_agent_result", ok: true, message: "Advanced one simulated hour.", state }, userId);
        await pushState(userId, chatId, readCharacterIdFromMessage(message));
        break;
      }
      case "world_agent_regenerate_schedule": {
        const chatId = await resolveActiveChatId(userId, readChatIdFromMessage(message));
        if (!chatId) {
          send({ type: "world_agent_result", ok: false, error: "No active chat is available for the World Agent." }, userId);
          break;
        }
        const bundle = await loadWorldAgentBundle(userId, chatId, readCharacterIdFromMessage(message));
        const state = await ensureWorldAgentSchedule({
          userId,
          settings: bundle.settings,
          state: { ...bundle.state, schedule: [], scheduleDay: null, updatedAt: Date.now() },
          contextMessages: bundle.contextMessages,
          identity: bundle.identity,
          force: true
        });
        const saved = await saveWorldAgentState(state, userId);
        send({ type: "world_agent_result", ok: true, message: "Regenerated the daily schedule.", state: saved }, userId);
        await pushState(userId, chatId, readCharacterIdFromMessage(message));
        break;
      }
      case "world_agent_reset": {
        const chatId = await resolveActiveChatId(userId, readChatIdFromMessage(message));
        if (!chatId) {
          send({ type: "world_agent_result", ok: false, error: "No active chat is available for the World Agent." }, userId);
          break;
        }
        const bundle = await loadWorldAgentBundle(userId, chatId, readCharacterIdFromMessage(message));
        const state = appendWorldAgentHistory(makeDefaultWorldAgentState(chatId, bundle.state.activeCharacterId || readCharacterIdFromMessage(message) ? {
          characterId: bundle.state.activeCharacterId || readCharacterIdFromMessage(message),
          personaId: bundle.state.activePersonaId
        } : undefined), "reset", "State reset.");
        const saved = await saveWorldAgentState(state, userId);
        send({ type: "world_agent_result", ok: true, message: "World Agent state reset.", state: saved }, userId);
        await pushState(userId, chatId, readCharacterIdFromMessage(message));
        break;
      }
      case "world_agent_set_time": {
        const chatId = await resolveActiveChatId(userId, readChatIdFromMessage(message));
        if (!chatId) {
          send({ type: "world_agent_result", ok: false, error: "No active chat is available for the World Agent." }, userId);
          break;
        }
        const state = await loadWorldAgentState(chatId, userId, { characterId: readCharacterIdFromMessage(message) });
        if (!state) {
          send({ type: "world_agent_result", ok: false, error: "No World Agent state exists for this chat." }, userId);
          break;
        }
        const nextDay = typeof message.day === "number" && Number.isFinite(message.day) ? Math.max(1, Math.round(message.day)) : state.day;
        const nextHour = Math.max(0, Math.min(23, Math.round(Number(message.hour))));
        const saved = await saveWorldAgentState(appendWorldAgentHistory({
          ...state,
          day: nextDay,
          hour: nextHour,
          lastTickAt: Date.now(),
          schedule: nextDay === state.day ? state.schedule : [],
          scheduleDay: nextDay === state.day ? state.scheduleDay : null,
          updatedAt: Date.now()
        }, "set_time", `Set to Day ${nextDay}, ${String(nextHour).padStart(2, "0")}:00.`), userId);
        send({ type: "world_agent_result", ok: true, message: "World Agent time updated.", state: saved }, userId);
        await pushState(userId, chatId, readCharacterIdFromMessage(message));
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
