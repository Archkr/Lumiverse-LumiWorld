declare const spindle: import("lumiverse-spindle-types").SpindleAPI;

import type { ConnectionProfileDTO, InterceptorResultDTO, LlmMessageDTO } from "lumiverse-spindle-types";
import {
  BREAKDOWN_NAME,
  DEFAULT_SETTINGS,
  appendRunLog,
  buildControllerMessages,
  buildInjectedDirective,
  formatPromptForController,
  makeDirectivePreview,
  normalizeRunLog,
  normalizeSettings,
  parseControllerDirective,
  resolveControllerTarget,
  shouldInterceptGeneration,
  type AgentWorldSettings,
  type ConnectionLike,
  type ConnectionOption,
  type ControllerTarget,
  type LlmMessageLike,
  type RunLogEntry,
} from "./shared";
import type { BackendToFrontend, FrontendState, FrontendToBackend, PermissionState } from "./types";

const SETTINGS_PATH = "global/settings.json";
const RUNS_PATH = "global/runs.json";
const INTERCEPTOR_PRIORITY = 150;

let lastFrontendUserId: string | null = null;
// Routing metadata from free frontend events plus read-only interceptor context.
// This is not a chat API read and does not require `chats` or `chat_mutation`.
const chatUserIds = new Map<string, string>();
let interceptorRegistered = false;
let controllerBusy = false;

class ControllerTimeoutError extends Error {
  constructor(timeoutMs: number) {
    super(`AgentWorld controller timed out after ${Math.round(timeoutMs / 1000)}s.`);
    this.name = "ControllerTimeoutError";
  }
}

function storageApi(): any {
  return (spindle as any).userStorage;
}

function connectionsApi(): any {
  return (spindle as any).connections;
}

function permissionsApi(): any {
  return (spindle as any).permissions;
}

function send(message: BackendToFrontend, userId = lastFrontendUserId ?? undefined): void {
  (spindle.sendToFrontend as unknown as (payload: unknown, targetUserId?: string) => void)(message, userId);
}

function permissionHas(permission: keyof PermissionState): boolean {
  const permissions = permissionsApi();
  if (!permissions || typeof permissions.has !== "function") return true;
  try {
    return !!permissions.has(permission);
  } catch {
    return false;
  }
}

function currentPermissions(): PermissionState {
  return {
    interceptor: permissionHas("interceptor"),
    generation: permissionHas("generation"),
  };
}

function rememberChatUser(chatId: string | null | undefined, userId: string | null | undefined): void {
  if (!chatId || !userId) return;
  chatUserIds.set(chatId, userId);
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

function readChatIdFromMessage(message: FrontendToBackend): string | null {
  return "chatId" in message && typeof message.chatId === "string" && message.chatId.trim() ? message.chatId : null;
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
}

async function loadSettings(userId?: string | null): Promise<AgentWorldSettings> {
  try {
    const stored = await storageApi().getJson(SETTINGS_PATH, {
      fallback: DEFAULT_SETTINGS,
      userId: userId ?? undefined,
    }) as Partial<AgentWorldSettings>;
    return normalizeSettings(stored);
  } catch {
    return DEFAULT_SETTINGS;
  }
}

async function saveSettings(patch: Partial<AgentWorldSettings>, userId?: string | null): Promise<AgentWorldSettings> {
  await ensureFolders(userId);
  const current = await loadSettings(userId);
  const next = normalizeSettings({ ...current, ...patch });
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

async function recordRun(entry: RunLogEntry, userId?: string | null, settings?: AgentWorldSettings): Promise<void> {
  try {
    const resolvedSettings = settings ?? (await loadSettings(userId));
    const existing = await loadRuns(userId, resolvedSettings.runLogLimit);
    const next = appendRunLog(existing, entry, resolvedSettings.runLogLimit);
    await saveRuns(next, userId);
    send({ type: "run_logged", run: entry }, userId ?? undefined);
  } catch (error) {
    spindle.log.warn(`AgentWorld could not record run: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function listConnections(userId?: string | null): Promise<{ connections: ConnectionOption[]; error: string | null }> {
  if (!permissionHas("generation")) {
    return {
      connections: [],
      error: "Generation permission is not granted, so AgentWorld cannot list LLM connection profiles.",
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
    spindle.log.warn(`AgentWorld could not list connection profiles: ${description}`);
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

async function buildState(userId?: string | null): Promise<FrontendState> {
  const settings = await loadSettings(userId);
  const [connectionState, runs] = await Promise.all([
    listConnections(userId),
    loadRuns(userId, settings.runLogLimit),
  ]);
  return {
    settings,
    connections: connectionState.connections,
    connectionError: connectionState.error,
    runs,
    permissions: currentPermissions(),
  };
}

async function pushState(userId?: string | null): Promise<void> {
  send({ type: "state", state: await buildState(userId) }, userId ?? undefined);
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

async function callController(
  userId: string | null,
  settings: AgentWorldSettings,
  target: ControllerTarget,
  messages: LlmMessageLike[],
): Promise<{ directive: string; durationMs: number }> {
  if (!userId) {
    throw new Error("AgentWorld could not resolve the active Lumiverse user for the controller call.");
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
      signal: controller.signal,
    });
    const directive = parseControllerDirective(response?.content);
    if (!directive) {
      throw new Error("AgentWorld controller returned an empty directive.");
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

async function handleInterceptor(
  messages: LlmMessageDTO[],
  context: unknown,
): Promise<LlmMessageDTO[] | InterceptorResultDTO> {
  const chatId = extractChatId(context);
  const userId = resolveUserId(chatId);
  const generationType = extractGenerationType(context);
  const startedAt = Date.now();

  const settings = await loadSettings(userId);
  const decision = shouldInterceptGeneration(settings, generationType);
  if (!decision.intercept) return messages;

  if (!permissionHas("generation")) {
    await recordRun(
      makeRunBase("skipped", startedAt, {
        generationType,
        error: "Generation permission is not granted.",
      }),
      userId,
      settings,
    );
    return messages;
  }

  if (controllerBusy) {
    await recordRun(
      makeRunBase("skipped", startedAt, {
        generationType,
        error: "Another AgentWorld controller call is already running.",
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
  try {
    const promptSnapshot = formatPromptForController(messages as LlmMessageLike[], settings.maxInputChars);
    const controllerMessages = buildControllerMessages(settings, promptSnapshot, {
      generationType,
      chatId: chatId || "",
      connectionId: extractConnectionId(context),
    });
    const { directive, durationMs } = await callController(userId, settings, target, controllerMessages);
    const injected: LlmMessageDTO = {
      role: "system",
      content: buildInjectedDirective(directive),
    };

    await recordRun(
      makeRunBase("success", startedAt, {
        generationType,
        durationMs,
        connectionId: target.connectionId,
        connectionName: target.connectionName,
        model: target.model,
        directivePreview: makeDirectivePreview(directive),
      }),
      userId,
      settings,
    );

    return {
      messages: [injected, ...messages],
      breakdown: [{ messageIndex: 0, name: BREAKDOWN_NAME }],
    };
  } catch (error) {
    const isTimeout = error instanceof ControllerTimeoutError;
    const message = error instanceof Error ? error.message : String(error);
    await recordRun(
      makeRunBase(isTimeout ? "timeout" : "error", startedAt, {
        generationType,
        connectionId: target.connectionId,
        connectionName: target.connectionName,
        model: target.model,
        error: message,
      }),
      userId,
      settings,
    );
    spindle.log.warn(`AgentWorld interceptor skipped injection: ${message}`);
    return messages;
  } finally {
    controllerBusy = false;
  }
}

function tryRegisterInterceptor(): void {
  if (interceptorRegistered) return;
  if (!permissionHas("interceptor")) return;
  spindle.registerInterceptor(handleInterceptor, INTERCEPTOR_PRIORITY);
  interceptorRegistered = true;
  spindle.log.info("AgentWorld interceptor registered.");
}

async function runControllerTest(userId: string | null, patch?: Partial<AgentWorldSettings>): Promise<void> {
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
        { role: "system", content: "You are running a short AgentWorld controller smoke test." },
        { role: "user", content: "The player opens an ancient observatory door during a storm. Decide how the world reacts." },
      ],
      settings.maxInputChars,
    );
    const controllerMessages = buildControllerMessages(settings, snapshot, {
      generationType: "normal",
      chatId: "agentworld-test",
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

permissionsApi()?.onChanged?.(({ permission, granted }: { permission: string; granted: boolean }) => {
  if (permission === "interceptor" && granted) tryRegisterInterceptor();
  void pushState();
});

permissionsApi()?.onDenied?.(({ permission, operation }: { permission: string; operation: string }) => {
  spindle.log.warn(`AgentWorld permission denied for ${operation}: ${permission}`);
});

spindle.onFrontendMessage(async (raw, userId) => {
  lastFrontendUserId = userId;
  const message = raw as FrontendToBackend;
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
