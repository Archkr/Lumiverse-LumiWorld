declare const spindle: import("lumiverse-spindle-types").SpindleAPI;

import type { CharacterDTO, ConnectionProfileDTO, InterceptorResultDTO, LlmMessageDTO, PersonaDTO } from "lumiverse-spindle-types";
import {
  BREAKDOWN_NAME,
  DEFAULT_SETTINGS,
  VISIBLE_GENERATION_TYPES,
  WORLD_AGENT_BREAKDOWN_NAME,
  advanceWorldAgentHour,
  appendRunLog,
  applyWorldAgentUpdate,
  buildControllerMessages,
  buildInjectedDirective,
  buildWorldAgentStateInjection,
  describeEmptyControllerResponse,
  describeEmptyWorldAgentResponse,
  extractControllerResponseText,
  formatPromptForController,
  formatWorldAgentSchedule,
  formatWorldAgentStateForPrompt,
  isWorldAgentHourDue,
  makeDefaultWorldAgentState,
  makeDirectivePreview,
  makeWorldAgentPreview,
  makeControllerContextMessage,
  normalizeRunLog,
  normalizeSettings,
  normalizeWorldAgentSettings,
  normalizeWorldAgentState,
  appendWorldAgentHistory,
  parseControllerDirectiveFromResponse,
  parseWorldAgentSchedule,
  parseWorldAgentUpdate,
  renderTemplate,
  resolveControllerTarget,
  resolveIdentityMacros,
  resolveWorldAgentTarget,
  resolveWorldInfoContextMessages,
  selectChatHistoryMessagesForController,
  selectChatMutationMessagesForController,
  selectControllerMessagesForController,
  shouldInterceptGeneration,
  type IdentityMacroValues,
  type LumiWorldSettings,
  type WorldAgentSettings,
  type WorldAgentState,
  type ConnectionLike,
  type ConnectionOption,
  type ControllerTarget,
  type LlmMessageLike,
  type RunLogEntry,
  type WorldInfoContextDiagnostics,
} from "./shared";
import type { BackendToFrontend, FrontendState, FrontendToBackend, PermissionState } from "./types";

const SETTINGS_PATH = "global/settings.json";
const RUNS_PATH = "global/runs.json";
const WORLD_AGENT_DIR = "world-agent/chats";
const INTERCEPTOR_PRIORITY = 150;
const WORLD_AGENT_TICK_INTERVAL_MS = 1000;

let lastFrontendUserId: string | null = null;
// Routing metadata from free frontend events plus read-only interceptor context.
// Chat reads are used only when the character context source is enabled.
const chatUserIds = new Map<string, string>();
const activeChats = new Map<string, { chatId: string; characterId: string | null; lastSeenAt: number }>();
const worldAgentHistoryCache = new Map<string, LlmMessageLike[]>();
const worldAgentBusy = new Set<string>();
let interceptorRegistered = false;
let controllerBusy = false;

class ControllerTimeoutError extends Error {
  constructor(timeoutMs: number) {
    super(`LumiWorld controller timed out after ${Math.round(timeoutMs / 1000)}s.`);
    this.name = "ControllerTimeoutError";
  }
}

class WorldAgentTimeoutError extends Error {
  constructor(timeoutMs: number) {
    super(`LumiWorld World Agent timed out after ${Math.round(timeoutMs / 1000)}s.`);
    this.name = "WorldAgentTimeoutError";
  }
}

class EmptyControllerDirectiveError extends Error {
  constructor(response: unknown) {
    super(describeEmptyControllerResponse(response));
    this.name = "EmptyControllerDirectiveError";
  }
}

class EmptyWorldAgentContentError extends Error {
  constructor(response: unknown) {
    super(describeEmptyWorldAgentResponse(response));
    this.name = "EmptyWorldAgentContentError";
  }
}

function storageApi(): any {
  return (spindle as any).userStorage;
}

function connectionsApi(): any {
  return (spindle as any).connections;
}

function chatsApi(): any {
  return (spindle as any).chats;
}

function chatApi(): any {
  return (spindle as any).chat;
}

function charactersApi(): any {
  return (spindle as any).characters;
}

function personasApi(): any {
  return (spindle as any).personas;
}

function worldBooksApi(): any {
  return (spindle as any).world_books;
}

function usersApi(): any {
  return (spindle as any).users;
}

function permissionsApi(): any {
  return (spindle as any).permissions;
}

const PERMISSION_IDS: Record<keyof PermissionState, string> = {
  interceptor: "interceptor",
  generation: "generation",
  chats: "chats",
  chatMutation: "chat_mutation",
  characters: "characters",
  personas: "personas",
  worldBooks: "world_books",
};

function send(message: BackendToFrontend, userId = lastFrontendUserId ?? undefined): void {
  (spindle.sendToFrontend as unknown as (payload: unknown, targetUserId?: string) => void)(message, userId);
}

function stringifyForCopy(value: unknown): string {
  if (typeof value === "string") return value;
  const seen = new WeakSet<object>();
  try {
    return JSON.stringify(value, (_key, nested) => {
      if (nested && typeof nested === "object") {
        if (seen.has(nested)) return "[Circular]";
        seen.add(nested);
      }
      return nested;
    }, 2);
  } catch {
    return String(value);
  }
}

function makeGenerationOutputForCopy(response: unknown, finalText: string | null): string {
  const text = finalText?.trim();
  if (text) return text;
  return stringifyForCopy(response).trim();
}

function permissionHas(permission: keyof PermissionState): boolean {
  const permissions = permissionsApi();
  if (!permissions || typeof permissions.has !== "function") return true;
  try {
    return !!permissions.has(PERMISSION_IDS[permission]);
  } catch {
    return false;
  }
}

function currentPermissions(): PermissionState {
  return {
    interceptor: permissionHas("interceptor"),
    generation: permissionHas("generation"),
    chats: permissionHas("chats"),
    chatMutation: permissionHas("chatMutation"),
    characters: permissionHas("characters"),
    personas: permissionHas("personas"),
    worldBooks: permissionHas("worldBooks"),
  };
}

function rememberChatUser(chatId: string | null | undefined, userId: string | null | undefined): void {
  if (!chatId || !userId) return;
  chatUserIds.set(chatId, userId);
}

function rememberActiveChat(chatId: string | null | undefined, userId: string | null | undefined, characterId?: string | null): void {
  if (!chatId || !userId) return;
  rememberChatUser(chatId, userId);
  activeChats.set(userId, {
    chatId,
    characterId: characterId && characterId.trim() ? characterId.trim() : activeChats.get(userId)?.characterId ?? null,
    lastSeenAt: Date.now(),
  });
}

function resolveUserId(chatId?: string | null): string | null {
  if (chatId) {
    const mapped = chatUserIds.get(chatId);
    if (mapped) return mapped;
  }
  return lastFrontendUserId;
}

function extractChatId(value: unknown): string | null {
  if (!value || typeof value !== "object") return null;
  const raw = (value as { chatId?: unknown; chat_id?: unknown }).chatId ?? (value as { chat_id?: unknown }).chat_id;
  return typeof raw === "string" && raw.trim() ? raw : null;
}

function extractGenerationType(value: unknown): string {
  if (!value || typeof value !== "object") return "normal";
  const raw = (value as { generationType?: unknown; generation_type?: unknown }).generationType ??
    (value as { generation_type?: unknown }).generation_type;
  return typeof raw === "string" && raw.trim() ? raw : "normal";
}

function extractConnectionId(value: unknown): string {
  if (!value || typeof value !== "object") return "";
  const raw = (value as { connectionId?: unknown; connection_id?: unknown }).connectionId ??
    (value as { connection_id?: unknown }).connection_id;
  return typeof raw === "string" ? raw : "";
}

function readContextString(value: unknown, keys: string[]): string | null {
  if (!value || typeof value !== "object") return null;
  const obj = value as Record<string, unknown>;
  for (const key of keys) {
    const raw = obj[key];
    if (typeof raw === "string" && raw.trim()) return raw.trim();
  }
  return null;
}

function extractPersonaId(value: unknown): string | null {
  return readContextString(value, ["personaId", "persona_id"]);
}

function extractCharacterId(value: unknown): string | null {
  return readContextString(value, ["characterId", "character_id", "targetCharacterId", "target_character_id"]);
}

function readChatIdFromMessage(message: FrontendToBackend): string | null {
  return "chatId" in message && typeof message.chatId === "string" && message.chatId.trim() ? message.chatId : null;
}

function readCharacterIdFromMessage(message: FrontendToBackend): string | null {
  return "characterId" in message && typeof message.characterId === "string" && message.characterId.trim() ? message.characterId : null;
}

function sanitizeStorageSegment(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 160) || "unknown";
}

function worldAgentStatePath(chatId: string): string {
  return `${WORLD_AGENT_DIR}/${sanitizeStorageSegment(chatId)}.json`;
}

function worldAgentBusyKey(userId: string | null | undefined, chatId: string): string {
  return `${userId || "user"}:${chatId}`;
}

function cacheWorldAgentChatHistory(
  userId: string | null | undefined,
  chatId: string | null | undefined,
  messages: LlmMessageLike[],
  limit: number,
): void {
  if (!chatId) return;
  const selected = selectChatHistoryMessagesForController(messages, limit);
  if (selected.length > 0) {
    worldAgentHistoryCache.set(worldAgentBusyKey(userId, chatId), selected);
  }
}

function getCachedWorldAgentChatHistory(
  userId: string | null | undefined,
  chatId: string,
  limit: number,
): LlmMessageLike[] {
  return selectChatHistoryMessagesForController(worldAgentHistoryCache.get(worldAgentBusyKey(userId, chatId)) ?? [], limit);
}

async function readWorldAgentChatHistory(
  userId: string | null | undefined,
  chatId: string,
  limit: number,
): Promise<LlmMessageLike[]> {
  if (limit <= 0) return [];
  if (permissionHas("chatMutation") && typeof chatApi()?.getMessages === "function") {
    try {
      const messages = await chatApi().getMessages(chatId);
      return selectChatMutationMessagesForController(Array.isArray(messages) ? messages : [], limit);
    } catch (error) {
      spindle.log.warn(`LumiWorld could not read chat history for World Agent: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  return getCachedWorldAgentChatHistory(userId, chatId, limit);
}

function toConnectionOption(connection: ConnectionProfileDTO | any): ConnectionOption {
  return {
    id: String(connection.id || ""),
    name: String(connection.name || "Unnamed connection"),
    provider: String(connection.provider || ""),
    model: String(connection.model || ""),
    isDefault: !!(connection.is_default ?? connection.isDefault),
    hasApiKey: !!(connection.has_api_key ?? connection.hasApiKey),
  };
}

function toConnectionLike(connection: ConnectionProfileDTO | any): ConnectionLike {
  return {
    ...toConnectionOption(connection),
    api_url: typeof connection.api_url === "string" ? connection.api_url : "",
  };
}

async function ensureFolders(userId?: string | null): Promise<void> {
  await storageApi().mkdir("global", userId ?? undefined).catch(() => {});
  await storageApi().mkdir("world-agent", userId ?? undefined).catch(() => {});
  await storageApi().mkdir(WORLD_AGENT_DIR, userId ?? undefined).catch(() => {});
}

async function loadSettings(userId?: string | null): Promise<LumiWorldSettings> {
  try {
    const stored = await storageApi().getJson(SETTINGS_PATH, {
      fallback: DEFAULT_SETTINGS,
      userId: userId ?? undefined,
    }) as Partial<LumiWorldSettings>;
    return normalizeSettings(stored);
  } catch {
    return DEFAULT_SETTINGS;
  }
}

async function saveSettings(patch: Partial<LumiWorldSettings>, userId?: string | null): Promise<LumiWorldSettings> {
  await ensureFolders(userId);
  const current = await loadSettings(userId);
  const next = normalizeSettings({
    ...current,
    ...patch,
    worldAgent: normalizeWorldAgentSettings({
      ...current.worldAgent,
      ...(patch.worldAgent ?? {}),
    }),
  });
  await storageApi().setJson(SETTINGS_PATH, next, { indent: 2, userId: userId ?? undefined });
  return next;
}

async function loadRuns(userId?: string | null, limit = DEFAULT_SETTINGS.runLogLimit): Promise<RunLogEntry[]> {
  try {
    const stored = await storageApi().getJson(RUNS_PATH, {
      fallback: [],
      userId: userId ?? undefined,
    }) as unknown;
    return normalizeRunLog(stored, limit);
  } catch {
    return [];
  }
}

async function saveRuns(runs: RunLogEntry[], userId?: string | null): Promise<void> {
  await ensureFolders(userId);
  await storageApi().setJson(RUNS_PATH, runs, { indent: 2, userId: userId ?? undefined });
}

async function resolveActiveChatId(userId?: string | null, explicitChatId?: string | null): Promise<string | null> {
  if (explicitChatId && explicitChatId.trim()) return explicitChatId.trim();
  const remembered = userId ? activeChats.get(userId)?.chatId : null;
  if (remembered) return remembered;
  if (!permissionHas("chats")) return null;
  try {
    const chat = await chatsApi().getActive(userId ?? undefined);
    return typeof chat?.id === "string" && chat.id.trim() ? chat.id.trim() : null;
  } catch {
    return null;
  }
}

async function loadWorldAgentState(
  chatId: string | null | undefined,
  userId?: string | null,
  identity?: { characterId?: string | null; personaId?: string | null },
): Promise<WorldAgentState | null> {
  if (!chatId) return null;
  try {
    const stored = await storageApi().getJson(worldAgentStatePath(chatId), {
      fallback: makeDefaultWorldAgentState(chatId, identity),
      userId: userId ?? undefined,
    });
    return normalizeWorldAgentState(stored, chatId, {
      activeCharacterId: identity?.characterId ?? normalizeWorldAgentState(stored, chatId).activeCharacterId,
      activePersonaId: identity?.personaId ?? normalizeWorldAgentState(stored, chatId).activePersonaId,
    });
  } catch {
    return makeDefaultWorldAgentState(chatId, identity);
  }
}

async function loadExistingWorldAgentState(
  chatId: string | null | undefined,
  userId?: string | null,
  identity?: { characterId?: string | null; personaId?: string | null },
): Promise<WorldAgentState | null> {
  if (!chatId) return null;
  try {
    const stored = await storageApi().getJson(worldAgentStatePath(chatId), {
      fallback: null,
      userId: userId ?? undefined,
    });
    return stored ? normalizeWorldAgentState(stored, chatId, {
      activeCharacterId: identity?.characterId ?? normalizeWorldAgentState(stored, chatId).activeCharacterId,
      activePersonaId: identity?.personaId ?? normalizeWorldAgentState(stored, chatId).activePersonaId,
    }) : null;
  } catch {
    return null;
  }
}

async function saveWorldAgentState(state: WorldAgentState, userId?: string | null): Promise<WorldAgentState> {
  await ensureFolders(userId);
  const normalized = normalizeWorldAgentState(state, state.chatId);
  await storageApi().setJson(worldAgentStatePath(normalized.chatId), normalized, { indent: 2, userId: userId ?? undefined });
  send({ type: "world_state", state: normalized }, userId ?? undefined);
  return normalized;
}

async function recordRun(entry: RunLogEntry, userId?: string | null, settings?: LumiWorldSettings): Promise<void> {
  try {
    const resolvedSettings = settings ?? (await loadSettings(userId));
    const existing = await loadRuns(userId, resolvedSettings.runLogLimit);
    const next = appendRunLog(existing, entry, resolvedSettings.runLogLimit);
    await saveRuns(next, userId);
    send({ type: "run_logged", run: entry }, userId ?? undefined);
  } catch (error) {
    spindle.log.warn(`LumiWorld could not record run: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function listConnections(userId?: string | null): Promise<{ connections: ConnectionOption[]; error: string | null }> {
  if (!permissionHas("generation")) {
    return {
      connections: [],
      error: "Generation permission is not granted, so LumiWorld cannot list LLM connection profiles.",
    };
  }

  try {
    const rows = await connectionsApi().list(userId ?? undefined);
    const connections = (Array.isArray(rows) ? rows : [])
      .map(toConnectionOption)
      .filter((connection) => connection.id)
      .sort((left, right) => left.name.localeCompare(right.name));
    return { connections, error: null };
  } catch (error) {
    const description = error instanceof Error ? error.message : String(error);
    spindle.log.warn(`LumiWorld could not list connection profiles: ${description}`);
    return {
      connections: [],
      error: `Could not list LLM connection profiles: ${description}`,
    };
  }
}

async function getConnection(connectionId: string | null, userId?: string | null): Promise<ConnectionLike | null> {
  if (!connectionId || !permissionHas("generation")) return null;
  try {
    const connection = await connectionsApi().get(connectionId, userId ?? undefined);
    return connection ? toConnectionLike(connection) : null;
  } catch {
    return null;
  }
}

function section(label: string, value: unknown): string | null {
  const text = typeof value === "string" ? value.trim() : "";
  return text ? `${label}:\n${text}` : null;
}

function personaName(persona: PersonaDTO | null | undefined): string {
  return typeof persona?.name === "string" && persona.name.trim() ? persona.name.trim() : "User";
}

function characterName(character: CharacterDTO | null | undefined): string {
  return typeof character?.name === "string" && character.name.trim() ? character.name.trim() : "Character";
}

function makeIdentity(persona: PersonaDTO | null, character: CharacterDTO | null): IdentityMacroValues {
  return {
    userName: personaName(persona),
    characterName: characterName(character),
  };
}

function identityText(value: unknown, identity: IdentityMacroValues): string | null {
  return typeof value === "string" ? resolveIdentityMacros(value, identity) : null;
}

function formatPersonaContext(persona: PersonaDTO, identity: IdentityMacroValues): string {
  return [
    `Name: ${persona.name}`,
    section("Title", identityText(persona.title, identity)),
    section("Description", identityText(persona.description, identity)),
    persona.is_default ? "Default persona: yes" : null,
    (persona as any).is_narrator === true ? "Narrator persona: yes" : null,
  ].filter(Boolean).join("\n\n");
}

function formatCharacterContext(character: CharacterDTO, identity: IdentityMacroValues): string {
  return [
    `Name: ${character.name}`,
    section("Description", identityText(character.description, identity)),
    section("Personality", identityText(character.personality, identity)),
    section("Scenario", identityText(character.scenario, identity)),
    section("Creator notes", identityText(character.creator_notes, identity)),
    section("System prompt", identityText(character.system_prompt, identity)),
    section("Post-history instructions", identityText(character.post_history_instructions, identity)),
    section("Example messages", identityText(character.mes_example, identity)),
    section("Opening message", identityText(character.first_mes, identity)),
  ].filter(Boolean).join("\n\n");
}

async function resolvePersona(context: unknown, userId?: string | null): Promise<PersonaDTO | null> {
  if (!permissionHas("personas")) return null;
  try {
    const personaId = extractPersonaId(context);
    return personaId
      ? await personasApi().get(personaId, userId ?? undefined)
      : await personasApi().getActive(userId ?? undefined);
  } catch (error) {
    spindle.log.warn(`LumiWorld could not resolve active user persona: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
}

async function resolveCharacter(
  context: unknown,
  chatId?: string | null,
  userId?: string | null,
): Promise<CharacterDTO | null> {
  if (!permissionHas("characters")) return null;
  try {
    let characterId = extractCharacterId(context);
    if (!characterId && chatId && permissionHas("chats")) {
      const chat = await chatsApi().get(chatId, userId ?? undefined);
      characterId = typeof chat?.character_id === "string" && chat.character_id.trim() ? chat.character_id.trim() : null;
    }
    if (!characterId) return null;
    return await charactersApi().get(characterId, userId ?? undefined);
  } catch (error) {
    spindle.log.warn(`LumiWorld could not resolve active character: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
}

async function resolveControllerContextMessages(
  settings: LumiWorldSettings,
  context: unknown,
  chatId?: string | null,
  userId?: string | null,
): Promise<{ messages: LlmMessageLike[]; identity: IdentityMacroValues; characterId: string | null; personaId: string | null }> {
  const [persona, character] = await Promise.all([
    resolvePersona(context, userId),
    resolveCharacter(context, chatId, userId),
  ]);
  const identity = makeIdentity(persona, character);
  const messages = [
    settings.includeUserPersona && persona ? makeControllerContextMessage("User Persona", formatPersonaContext(persona, identity)) : null,
    settings.includeCharacter && character ? makeControllerContextMessage("Character", formatCharacterContext(character, identity)) : null,
  ].filter((message): message is LlmMessageLike => !!message);
  return { messages, identity, characterId: character?.id ?? null, personaId: persona?.id ?? null };
}

async function buildState(userId?: string | null, chatId?: string | null, characterId?: string | null): Promise<FrontendState> {
  const settings = await loadSettings(userId);
  const resolvedChatId = await resolveActiveChatId(userId, chatId);
  const [connectionState, runs, worldState] = await Promise.all([
    listConnections(userId),
    loadRuns(userId, settings.runLogLimit),
    loadWorldAgentState(resolvedChatId, userId, { characterId }),
  ]);
  return {
    settings,
    connections: connectionState.connections,
    connectionError: connectionState.error,
    runs,
    permissions: currentPermissions(),
    worldState,
  };
}

async function pushState(userId?: string | null, chatId?: string | null, characterId?: string | null): Promise<void> {
  send({ type: "state", state: await buildState(userId, chatId, characterId) }, userId ?? undefined);
}

function makeRunBase(status: RunLogEntry["status"], startedAt: number, patch: Partial<RunLogEntry> = {}): RunLogEntry {
  return {
    id: crypto.randomUUID(),
    timestamp: Date.now(),
    status,
    durationMs: Date.now() - startedAt,
    ...patch,
  };
}

function runLogWorldInfoPatch(diagnostics: WorldInfoContextDiagnostics): Partial<RunLogEntry> {
  return {
    worldInfoActivatedCount: diagnostics.activatedEntryCount,
    worldInfoFetchedCount: diagnostics.fetchedEntryCount,
    worldInfoFallbackTaggedCount: diagnostics.fallbackTaggedEntryCount,
    worldInfoFetchError: diagnostics.fetchError,
  };
}

async function callController(
  userId: string | null,
  settings: LumiWorldSettings,
  target: ControllerTarget,
  messages: LlmMessageLike[],
): Promise<{ directive: string; durationMs: number }> {
  if (!userId) {
    throw new Error("LumiWorld could not resolve the active Lumiverse user for the controller call.");
  }

  const startedAt = Date.now();
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, settings.timeoutMs);

  try {
    const response = await (spindle.generate.raw as unknown as (input: unknown) => Promise<any>)({
      provider: target.provider,
      model: target.model,
      connection_id: target.connectionId,
      userId,
      messages,
      parameters: {
        temperature: settings.temperature,
        max_tokens: settings.maxTokens,
      },
      reasoning: { source: "off" },
      signal: controller.signal,
    });
    const directive = parseControllerDirectiveFromResponse(response);
    if (!directive) {
      throw new EmptyControllerDirectiveError(response);
    }
    return { directive, durationMs: Date.now() - startedAt };
  } catch (error) {
    if (timedOut || (error instanceof Error && error.name === "AbortError")) {
      throw new ControllerTimeoutError(settings.timeoutMs);
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

function buildWorldAgentTemplateVars(
  state: WorldAgentState,
  identity: IdentityMacroValues,
  extra: Record<string, string> = {},
): Record<string, string> {
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
    ...extra,
  };
}

function buildWorldAgentMessages(options: {
  settings: WorldAgentSettings;
  state: WorldAgentState;
  identity: IdentityMacroValues;
  contextMessages: LlmMessageLike[];
  mode: "schedule" | "update";
}): LlmMessageLike[] {
  const vars = buildWorldAgentTemplateVars(options.state, options.identity);
  const systemTemplate = options.mode === "schedule" ? options.settings.scheduleTemplate : options.settings.updateTemplate;
  const system = renderTemplate(systemTemplate, vars);
  const action = options.mode === "schedule"
    ? "Generate today's full private schedule as exactly 24 hourly entries, one for every hour 0 through 23. Repeat location/activity across consecutive hours when needed. Only include hour, location, and activity; do not assign mood, thoughts, or current goals."
    : "Advance the private state by one simulated hour.";
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
        "</world_state>",
      ].join("\n"),
    },
  ];
}

async function callWorldAgentModel(
  userId: string | null,
  settings: WorldAgentSettings,
  target: ControllerTarget,
  messages: LlmMessageLike[],
  onRawOutput?: (output: string) => void,
): Promise<{ text: string; durationMs: number }> {
  if (!userId) {
    throw new Error("LumiWorld could not resolve the active Lumiverse user for the World Agent call.");
  }

  const startedAt = Date.now();
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, settings.timeoutMs);

  try {
    const response = await (spindle.generate.raw as unknown as (input: unknown) => Promise<any>)({
      provider: target.provider,
      model: target.model,
      connection_id: target.connectionId,
      userId,
      messages,
      parameters: {
        temperature: settings.temperature,
        max_tokens: settings.maxTokens,
      },
      reasoning: { source: "off" },
      signal: controller.signal,
    });
    const text = extractControllerResponseText(response);
    const rawOutput = makeGenerationOutputForCopy(response, text);
    if (rawOutput) {
      try {
        onRawOutput?.(rawOutput);
      } catch {
        // Copy diagnostics are UI-only and should not affect generation.
      }
    }
    if (!text) {
      throw new EmptyWorldAgentContentError(response);
    }
    return { text, durationMs: Date.now() - startedAt };
  } catch (error) {
    if (timedOut || (error instanceof Error && error.name === "AbortError")) {
      throw new WorldAgentTimeoutError(settings.timeoutMs);
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

async function resolveWorldAgentContext(
  settings: LumiWorldSettings,
  chatId: string,
  userId: string | null,
  characterId?: string | null,
): Promise<{ contextMessages: LlmMessageLike[]; identity: IdentityMacroValues; stateIdentity: { characterId: string | null; personaId: string | null } }> {
  const context = { chatId, characterId: characterId || undefined };
  const resolved = await resolveControllerContextMessages(
    {
      ...settings,
      includeUserPersona: settings.worldAgent.includeUserPersona,
      includeCharacter: settings.worldAgent.includeCharacter,
    },
    context,
    chatId,
    userId,
  );
  const historyMessages = await readWorldAgentChatHistory(userId, chatId, settings.worldAgent.historyMessageLimit);
  return {
    contextMessages: [...resolved.messages, ...historyMessages],
    identity: resolved.identity,
    stateIdentity: { characterId: resolved.characterId, personaId: resolved.personaId },
  };
}

async function ensureWorldAgentSchedule(options: {
  userId: string | null;
  settings: LumiWorldSettings;
  state: WorldAgentState;
  contextMessages: LlmMessageLike[];
  identity: IdentityMacroValues;
  force?: boolean;
  onRawOutput?: (output: string) => void;
}): Promise<WorldAgentState> {
  const worldSettings = options.settings.worldAgent;
  if (!worldSettings.enabled) return options.state;
  if (!options.force && options.state.scheduleDay === options.state.day && options.state.schedule.length > 0) return options.state;
  if (!permissionHas("generation")) {
    return appendWorldAgentHistory(options.state, "schedule_error", null, "Generation permission is not granted.");
  }
  const startedAt = Date.now();
  const connection = await getConnection(worldSettings.connectionId, options.userId);
  const target = resolveWorldAgentTarget(worldSettings, connection);
  if (!target.ok) {
    const next = appendWorldAgentHistory(options.state, "schedule_error", null, target.reason);
    await recordRun(
      makeRunBase("skipped", startedAt, {
        channel: "world_agent",
        action: "schedule",
        connectionId: worldSettings.connectionId,
        error: target.reason,
        worldAgentDay: next.day,
        worldAgentHour: next.hour,
      }),
      options.userId,
      options.settings,
    );
    return next;
  }

  try {
    const messages = buildWorldAgentMessages({
      settings: worldSettings,
      state: options.state,
      identity: options.identity,
      contextMessages: options.contextMessages,
      mode: "schedule",
    });
    const { text, durationMs } = await callWorldAgentModel(options.userId, worldSettings, target, messages, options.onRawOutput);
    const schedule = parseWorldAgentSchedule(text);
    const next = appendWorldAgentHistory(
      {
        ...options.state,
        schedule,
        scheduleDay: options.state.day,
        updatedAt: Date.now(),
      },
      "schedule",
      schedule.length ? `${schedule.length} schedule entries generated.` : "No schedule entries generated.",
    );
    await recordRun(
      makeRunBase(schedule.length ? "success" : "skipped", startedAt, {
        channel: "world_agent",
        action: "schedule",
        durationMs,
        connectionId: target.connectionId,
        connectionName: target.connectionName,
        model: target.model,
        directivePreview: `${schedule.length} schedule entries generated.`,
        worldAgentDay: next.day,
        worldAgentHour: next.hour,
        worldAgentScheduleCount: schedule.length,
      }),
      options.userId,
      options.settings,
    );
    return next;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const next = appendWorldAgentHistory(options.state, "schedule_error", null, message);
    await recordRun(
      makeRunBase(error instanceof WorldAgentTimeoutError ? "timeout" : "error", startedAt, {
        channel: "world_agent",
        action: "schedule",
        connectionId: target.connectionId,
        connectionName: target.connectionName,
        model: target.model,
        error: message,
        worldAgentDay: next.day,
        worldAgentHour: next.hour,
      }),
      options.userId,
      options.settings,
    );
    spindle.log.warn(`LumiWorld World Agent schedule skipped: ${message}`);
    return next;
  }
}

async function runWorldAgentHourUpdate(options: {
  userId: string | null;
  settings: LumiWorldSettings;
  state: WorldAgentState;
  contextMessages: LlmMessageLike[];
  identity: IdentityMacroValues;
  action: string;
}): Promise<WorldAgentState> {
  const worldSettings = options.settings.worldAgent;
  let nextState = advanceWorldAgentHour(options.state);
  nextState = await ensureWorldAgentSchedule({
    userId: options.userId,
    settings: options.settings,
    state: nextState,
    contextMessages: options.contextMessages,
    identity: options.identity,
  });

  if (!worldSettings.enabled) return nextState;
  if (!permissionHas("generation")) {
    return appendWorldAgentHistory(nextState, `${options.action}_error`, null, "Generation permission is not granted.");
  }
  const startedAt = Date.now();
  const connection = await getConnection(worldSettings.connectionId, options.userId);
  const target = resolveWorldAgentTarget(worldSettings, connection);
  if (!target.ok) {
    const skipped = appendWorldAgentHistory(nextState, `${options.action}_error`, null, target.reason);
    await recordRun(
      makeRunBase("skipped", startedAt, {
        channel: "world_agent",
        action: options.action,
        connectionId: worldSettings.connectionId,
        error: target.reason,
        worldAgentDay: skipped.day,
        worldAgentHour: skipped.hour,
      }),
      options.userId,
      options.settings,
    );
    return skipped;
  }

  try {
    const messages = buildWorldAgentMessages({
      settings: worldSettings,
      state: nextState,
      identity: options.identity,
      contextMessages: options.contextMessages,
      mode: "update",
    });
    const { text, durationMs } = await callWorldAgentModel(options.userId, worldSettings, target, messages);
    const parsed = parseWorldAgentUpdate(text);
    const updatedState = applyWorldAgentUpdate(nextState, parsed);
    nextState = appendWorldAgentHistory(
      updatedState,
      options.action,
      makeWorldAgentPreview(updatedState),
    );
    await recordRun(
      makeRunBase("success", startedAt, {
        channel: "world_agent",
        action: options.action,
        durationMs,
        connectionId: target.connectionId,
        connectionName: target.connectionName,
        model: target.model,
        directivePreview: makeWorldAgentPreview(nextState),
        worldAgentDay: nextState.day,
        worldAgentHour: nextState.hour,
        worldAgentScheduleCount: nextState.schedule.length,
      }),
      options.userId,
      options.settings,
    );
    return nextState;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const failed = appendWorldAgentHistory(nextState, `${options.action}_error`, null, message);
    await recordRun(
      makeRunBase(error instanceof WorldAgentTimeoutError ? "timeout" : "error", startedAt, {
        channel: "world_agent",
        action: options.action,
        connectionId: target.connectionId,
        connectionName: target.connectionName,
        model: target.model,
        error: message,
        worldAgentDay: failed.day,
        worldAgentHour: failed.hour,
      }),
      options.userId,
      options.settings,
    );
    spindle.log.warn(`LumiWorld World Agent update skipped: ${message}`);
    return failed;
  }
}

async function injectWorldAgentOnly(
  messages: LlmMessageDTO[],
  chatId: string,
  userId: string | null,
  characterId?: string | null,
): Promise<LlmMessageDTO[] | InterceptorResultDTO> {
  const state = await loadExistingWorldAgentState(chatId, userId, { characterId });
  if (!state) return messages;
  return {
    messages: [
      {
        role: "system",
        content: buildWorldAgentStateInjection(state),
      },
      ...messages,
    ],
    breakdown: [{ messageIndex: 0, name: WORLD_AGENT_BREAKDOWN_NAME }],
  };
}

async function isUserVisible(userId?: string | null): Promise<boolean> {
  try {
    return usersApi()?.isVisible ? !!(await usersApi().isVisible(userId ?? undefined)) : true;
  } catch {
    return true;
  }
}

async function loadWorldAgentBundle(
  userId: string | null,
  chatId: string,
  characterId?: string | null,
): Promise<{ settings: LumiWorldSettings; state: WorldAgentState; contextMessages: LlmMessageLike[]; identity: IdentityMacroValues }> {
  const settings = await loadSettings(userId);
  const context = await resolveWorldAgentContext(settings, chatId, userId, characterId);
  const state = await loadWorldAgentState(chatId, userId, context.stateIdentity) ?? makeDefaultWorldAgentState(chatId, context.stateIdentity);
  return { settings, state, contextMessages: context.contextMessages, identity: context.identity };
}

async function tickWorldAgentChat(
  userId: string | null,
  chatId: string,
  characterId?: string | null,
  manualAction: "hourly_update" | "manual_advance" = "hourly_update",
): Promise<WorldAgentState | null> {
  const busyKey = worldAgentBusyKey(userId, chatId);
  if (worldAgentBusy.has(busyKey)) return null;
  worldAgentBusy.add(busyKey);
  try {
    const { settings, state, contextMessages, identity } = await loadWorldAgentBundle(userId, chatId, characterId);
    const next = await runWorldAgentHourUpdate({
      userId,
      settings,
      state,
      contextMessages,
      identity,
      action: manualAction,
    });
    return await saveWorldAgentState(next, userId);
  } finally {
    worldAgentBusy.delete(busyKey);
  }
}

async function checkWorldAgentTimers(): Promise<void> {
  for (const [userId, active] of activeChats.entries()) {
    const busyKey = worldAgentBusyKey(userId, active.chatId);
    if (worldAgentBusy.has(busyKey)) continue;
    try {
      const settings = await loadSettings(userId);
      if (!settings.worldAgent.enabled) continue;
      const state = await loadExistingWorldAgentState(active.chatId, userId, { characterId: active.characterId });
      if (!state?.running) continue;
      const visible = await isUserVisible(userId);
      const due = isWorldAgentHourDue(state, settings.worldAgent, Date.now(), visible);
      if (due.shouldResetLastTick) {
        await saveWorldAgentState({ ...state, lastTickAt: Date.now(), updatedAt: Date.now() }, userId);
        continue;
      }
      if (!due.due) continue;
      const updated = await tickWorldAgentChat(userId, active.chatId, active.characterId, "hourly_update");
      if (updated) {
        send({ type: "world_state", state: updated }, userId);
      }
    } catch (error) {
      spindle.log.warn(`LumiWorld World Agent timer skipped: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

async function refreshWorldStateForMessage(message: FrontendToBackend, userId: string): Promise<WorldAgentState | null> {
  const chatId = await resolveActiveChatId(userId, readChatIdFromMessage(message));
  if (!chatId) return null;
  const characterId = readCharacterIdFromMessage(message);
  rememberActiveChat(chatId, userId, characterId);
  const existing = await loadExistingWorldAgentState(chatId, userId, { characterId });
  const state = existing?.running
    ? await saveWorldAgentState({ ...existing, lastTickAt: Date.now(), updatedAt: Date.now() }, userId)
    : await loadWorldAgentState(chatId, userId, { characterId });
  send({ type: "world_state", state }, userId);
  return state;
}

async function resumeWorldAgentClockWithoutCatchup(chatId: string | null, userId: string, characterId?: string | null): Promise<void> {
  if (!chatId) return;
  const existing = await loadExistingWorldAgentState(chatId, userId, { characterId });
  if (!existing?.running) return;
  await saveWorldAgentState({ ...existing, lastTickAt: Date.now(), updatedAt: Date.now() }, userId);
}

async function handleInterceptor(
  messages: LlmMessageDTO[],
  context: unknown,
): Promise<LlmMessageDTO[] | InterceptorResultDTO> {
  const chatId = extractChatId(context);
  const contextCharacterId = extractCharacterId(context);
  const userId = resolveUserId(chatId);
  const generationType = extractGenerationType(context);
  const startedAt = Date.now();
  rememberActiveChat(chatId, userId, contextCharacterId);

  const settings = await loadSettings(userId);
  const directorDecision = shouldInterceptGeneration(settings, generationType);
  const visibleGeneration = VISIBLE_GENERATION_TYPES.includes(generationType as any);
  const promptMessages = messages as LlmMessageLike[];
  if (visibleGeneration && settings.worldAgent.enabled && chatId) {
    cacheWorldAgentChatHistory(userId, chatId, promptMessages, settings.worldAgent.historyMessageLimit);
  }
  const shouldInjectWorldAgent = visibleGeneration && settings.worldAgent.enabled && settings.worldAgent.injectState && !!chatId;
  if (!directorDecision.intercept && !shouldInjectWorldAgent) return messages;

  if (!permissionHas("generation")) {
    if (directorDecision.intercept) {
      await recordRun(
        makeRunBase("skipped", startedAt, {
          channel: "director",
          generationType,
          error: "Generation permission is not granted.",
        }),
        userId,
        settings,
      );
    }
    return shouldInjectWorldAgent ? await injectWorldAgentOnly(messages, chatId, userId, contextCharacterId) : messages;
  }

  const injectedMessages: LlmMessageDTO[] = [];
  const breakdown: InterceptorResultDTO["breakdown"] = [];
  const controllerContext = await resolveControllerContextMessages(settings, context, chatId, userId);
  const worldAgentState = shouldInjectWorldAgent
    ? await loadExistingWorldAgentState(chatId, userId, {
      characterId: controllerContext.characterId ?? contextCharacterId,
      personaId: controllerContext.personaId,
    })
    : null;

  if (worldAgentState) {
    injectedMessages.push({
      role: "system",
      content: buildWorldAgentStateInjection(worldAgentState),
    });
    breakdown.push({ messageIndex: injectedMessages.length - 1, name: WORLD_AGENT_BREAKDOWN_NAME });
  }

  if (!directorDecision.intercept) {
    return injectedMessages.length
      ? { messages: [...injectedMessages, ...messages], breakdown }
      : messages;
  }

  if (controllerBusy) {
    await recordRun(
      makeRunBase("skipped", startedAt, {
        channel: "director",
        generationType,
        error: "Another LumiWorld controller call is already running.",
      }),
      userId,
      settings,
    );
    return messages;
  }

  const connection = await getConnection(settings.connectionId, userId);
  const target = resolveControllerTarget(settings, connection);
  if (!target.ok) {
    await recordRun(
      makeRunBase("skipped", startedAt, {
        channel: "director",
        generationType,
        connectionId: settings.connectionId,
        error: target.reason,
      }),
      userId,
      settings,
    );
    return messages;
  }

  controllerBusy = true;
  let worldInfoDiagnostics: WorldInfoContextDiagnostics = {
    activatedEntryCount: 0,
    fetchedEntryCount: 0,
    fallbackTaggedEntryCount: 0,
    fetchError: null,
  };
  try {
    const worldBooks = worldBooksApi();
    const worldInfoContext = await resolveWorldInfoContextMessages({
      messages: promptMessages,
      settings,
      context,
      canFetchWorldBooks: permissionHas("worldBooks") && !!worldBooks,
      fetchActivated: chatId && typeof worldBooks?.getActivated === "function"
        ? () => worldBooks.getActivated(chatId, userId ?? undefined)
        : undefined,
      fetchEntry: typeof worldBooks?.entries?.get === "function"
        ? (entryId: string) => worldBooks.entries.get(entryId, userId ?? undefined)
        : undefined,
      identity: controllerContext.identity,
    });
    worldInfoDiagnostics = worldInfoContext.diagnostics;
    const worldAgentContextMessage = worldAgentState
      ? makeControllerContextMessage("World Agent State", formatWorldAgentStateForPrompt(worldAgentState))
      : null;
    const controllerContextMessages = selectControllerMessagesForController(
      promptMessages,
      settings,
      [
        ...controllerContext.messages,
        ...worldInfoContext.messages,
        ...(worldAgentContextMessage ? [worldAgentContextMessage] : []),
      ],
    );
    const promptSnapshot = formatPromptForController(controllerContextMessages, settings.maxInputChars);
    const controllerMessages = buildControllerMessages(settings, promptSnapshot, {
      generationType,
      chatId: chatId || "",
      connectionId: extractConnectionId(context),
      user: controllerContext.identity.userName || "User",
      char: controllerContext.identity.characterName || "Character",
    });
    const { directive, durationMs } = await callController(userId, settings, target, controllerMessages);
    const injected: LlmMessageDTO = {
      role: "system",
      content: buildInjectedDirective(directive),
    };
    injectedMessages.push(injected);
    breakdown.push({ messageIndex: injectedMessages.length - 1, name: BREAKDOWN_NAME });

    await recordRun(
      makeRunBase("success", startedAt, {
        channel: "director",
        generationType,
        durationMs,
        connectionId: target.connectionId,
        connectionName: target.connectionName,
        model: target.model,
        directivePreview: makeDirectivePreview(directive),
        ...runLogWorldInfoPatch(worldInfoDiagnostics),
      }),
      userId,
      settings,
    );

    return {
      messages: [...injectedMessages, ...messages],
      breakdown,
    };
  } catch (error) {
    const isTimeout = error instanceof ControllerTimeoutError;
    const isEmptyDirective = error instanceof EmptyControllerDirectiveError;
    const message = error instanceof Error ? error.message : String(error);
    await recordRun(
      makeRunBase(isTimeout ? "timeout" : isEmptyDirective ? "skipped" : "error", startedAt, {
        channel: "director",
        generationType,
        connectionId: target.connectionId,
        connectionName: target.connectionName,
        model: target.model,
        error: message,
        ...runLogWorldInfoPatch(worldInfoDiagnostics),
      }),
      userId,
      settings,
    );
    spindle.log.warn(`LumiWorld interceptor skipped injection: ${message}`);
    return injectedMessages.length
      ? { messages: [...injectedMessages, ...messages], breakdown }
      : messages;
  } finally {
    controllerBusy = false;
  }
}

function tryRegisterInterceptor(): void {
  if (interceptorRegistered) return;
  if (!permissionHas("interceptor")) return;
  spindle.registerInterceptor(handleInterceptor, INTERCEPTOR_PRIORITY);
  interceptorRegistered = true;
  spindle.log.info("LumiWorld interceptor registered.");
}

async function runControllerTest(userId: string | null, patch?: Partial<LumiWorldSettings>): Promise<void> {
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
    const snapshot = formatPromptForController(
      [
        { role: "system", content: "You are running a short LumiWorld controller smoke test." },
        { role: "user", content: "The player opens an ancient observatory door during a storm. Decide how the world reacts." },
      ],
      settings.maxInputChars,
    );
    const controllerMessages = buildControllerMessages(settings, snapshot, {
      generationType: "normal",
      chatId: "lumiworld-test",
      connectionId: target.connectionId,
    });
    const { directive, durationMs } = await callController(userId, settings, target, controllerMessages);
    await recordRun(
      makeRunBase("test_success", startedAt, {
        durationMs,
        connectionId: target.connectionId,
        connectionName: target.connectionName,
        model: target.model,
        directivePreview: makeDirectivePreview(directive),
      }),
      userId,
      settings,
    );
    send({
      type: "test_result",
      ok: true,
      directive,
      durationMs,
      model: target.model,
      connectionName: target.connectionName,
    }, userId ?? undefined);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await recordRun(
      makeRunBase(error instanceof ControllerTimeoutError ? "timeout" : "test_error", startedAt, {
        connectionId: target.connectionId,
        connectionName: target.connectionName,
        model: target.model,
        error: message,
      }),
      userId,
      settings,
    );
    send({ type: "test_result", ok: false, error: message }, userId ?? undefined);
  }
}

tryRegisterInterceptor();

setInterval(() => {
  void checkWorldAgentTimers();
}, WORLD_AGENT_TICK_INTERVAL_MS);

permissionsApi()?.onChanged?.(({ permission, granted }: { permission: string; granted: boolean }) => {
  if (permission === "interceptor" && granted) tryRegisterInterceptor();
  void pushState();
});

permissionsApi()?.onDenied?.(({ permission, operation }: { permission: string; operation: string }) => {
  spindle.log.warn(`LumiWorld permission denied for ${operation}: ${permission}`);
});

spindle.onFrontendMessage(async (raw, userId) => {
  lastFrontendUserId = userId;
  const message = raw as FrontendToBackend;
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
        const settings = await saveSettings({ worldAgent: message.settings as WorldAgentSettings }, userId);
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
        let state: WorldAgentState = {
          ...bundle.state,
          running: true,
          lastTickAt: Date.now(),
          activeCharacterId: bundle.state.activeCharacterId ?? readCharacterIdFromMessage(message),
          updatedAt: Date.now(),
        };
        state = await ensureWorldAgentSchedule({
          userId,
          settings: bundle.settings,
          state,
          contextMessages: bundle.contextMessages,
          identity: bundle.identity,
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
        let rawOutput: string | null = null;
        const state = await ensureWorldAgentSchedule({
          userId,
          settings: bundle.settings,
          state: { ...bundle.state, schedule: [], scheduleDay: null, updatedAt: Date.now() },
          contextMessages: bundle.contextMessages,
          identity: bundle.identity,
          force: true,
          onRawOutput(output) {
            rawOutput = output;
          },
        });
        const saved = await saveWorldAgentState(state, userId);
        send({ type: "world_agent_result", ok: true, message: "Regenerated the daily schedule.", state: saved, rawOutput }, userId);
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
        const state = appendWorldAgentHistory(
          makeDefaultWorldAgentState(chatId, bundle.state.activeCharacterId || readCharacterIdFromMessage(message) ? {
            characterId: bundle.state.activeCharacterId || readCharacterIdFromMessage(message),
            personaId: bundle.state.activePersonaId,
          } : undefined),
          "reset",
          "State reset.",
        );
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
        const saved = await saveWorldAgentState(
          appendWorldAgentHistory(
            {
              ...state,
              day: nextDay,
              hour: nextHour,
              lastTickAt: Date.now(),
              schedule: nextDay === state.day ? state.schedule : [],
              scheduleDay: nextDay === state.day ? state.scheduleDay : null,
              updatedAt: Date.now(),
            },
            "set_time",
            `Set to Day ${nextDay}, ${String(nextHour).padStart(2, "0")}:00.`,
          ),
          userId,
        );
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
