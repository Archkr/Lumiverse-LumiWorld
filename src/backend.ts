declare const spindle: import("lumiverse-spindle-types").SpindleAPI;

import type { CharacterDTO, ConnectionProfileDTO, InterceptorResultDTO, LlmMessageDTO, PersonaDTO } from "lumiverse-spindle-types";
import {
  BREAKDOWN_NAME, CONTROLLER_CONTEXT_LABEL_KEY, KeyedOperationLock, DEFAULT_SETTINGS, appendRunLog,
  buildControllerMessages, buildInjectedDirective, describeEmptyControllerResponse,
  currentUserContextMessages, formatPromptForController, latestPlayerChatMessage, makeDirectivePreview, makeControllerContextMessage,
  makeJevDiagnostics, normalizeRunLog, normalizeSettings, parseControllerDirectiveFromResponse, parseControllerThreadLabelFromResponse,
  resolveControllerTarget, resolveIdentityMacros, resolveJevProvider, resolveWorldInfoContextMessages,
  selectChatHistoryMessagesForController, selectControllerMessagesForController, shouldInterceptGeneration,
  jevSecretKey,
  type IdentityMacroValues, type JevGateRecord, type JevPhaseTrace, type JevSettings, type JevTurnDiagnostics,
  type LumiWorldSettings, type ConnectionLike,
  type ConnectionOption, type ControllerTarget, type LlmMessageLike,
  type RunLogEntry, type TurnTrace, type WorldInfoContextDiagnostics,
} from "./shared";
import {
  assessVerification, countJevFlags, contextFilterDecision, directorGuidanceFromGates, planGates, questionsFromPlan,
  resolveGateAnswers, shouldRunDirector, wantsStrongDirectorModel, withConfidenceGate, withDegradationGate,
} from "./gates";
import { buildJevState, buildJevSmokeRequest, callJev, exceedsJevTokenBudget, jevEndpoint, normalizeJevResponse, parseJevBody, readCorsResult, type JevAnswer, type JevQuestions } from "./jev";
import {
  commitWorldState, defaultWorldState, loadWorldState, projectWorldState, saveWorldState, type WorldState,
} from "./world-state";
import type { BackendToFrontend, FrontendState, FrontendToBackend, PermissionState } from "./types";

const SETTINGS_PATH = "global/settings.json";
const RUNS_PATH = "global/runs.json";
const INTERCEPTOR_PRIORITY = 150;
/** Lumiverse clamps prompt interceptor work to five minutes. */
const INTERCEPTOR_BUDGET_MS = 300_000;
/** Hard ceiling on Jev wall clock, per phase, independent of the configured timeout. */
const MAX_JEV_PHASE_MS = 15_000;
/** Wall clock reserved for the Director call and for returning the result. */
const DIRECTOR_RESERVE_MS = 20_000;

let lastFrontendUserId: string | null = null;
const chatUserIds = new Map<string, string>();
const directorBusy = new KeyedOperationLock();
const runLogWrites = new Map<string, Promise<void>>();
let interceptorRegistered = false;
/** GENERATION_STARTED arrives before prompt assembly and supplies the ID absent from interceptor context. */
const activeGenerationIds = new Map<string, string>();
const pendingCommits = new Map<string, { userId: string; chatId: string; state: WorldState }>();
const generationRunIds = new Map<string, string>();

function generationChatKey(userId: string, chatId: string): string {
  return JSON.stringify([userId, chatId]);
}

function generationCommitKey(userId: string, chatId: string, generationId: string): string {
  return JSON.stringify([userId, chatId, generationId]);
}

class ControllerTimeoutError extends Error {
  constructor(timeoutMs: number) {
    super(`LumiWorld controller timed out after ${Math.round(timeoutMs / 1000)}s.`);
    this.name = "ControllerTimeoutError";
  }
}

class EmptyControllerDirectiveError extends Error {
  readonly responseJson: string | null;
  constructor(response: unknown) {
    super(describeEmptyControllerResponse(response));
    this.name = "EmptyControllerDirectiveError";
    this.responseJson = jsonText(response);
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

function charactersApi(): any {
  return (spindle as any).characters;
}

function personasApi(): any {
  return (spindle as any).personas;
}

function worldBooksApi(): any {
  return (spindle as any).world_books;
}

function enclaveApi(): any {
  return (spindle as any).enclave;
}

/** The CORS proxy is the only network egress the extension needs. */
function corsApi(): ((url: string, options?: unknown) => Promise<unknown>) | null {
  const cors = (spindle as any)?.cors;
  return typeof cors === "function" ? (url, options) => cors.call(spindle, url, options) : null;
}

function permissionsApi(): any {
  return (spindle as any).permissions;
}

const PERMISSION_IDS: Record<keyof PermissionState, string> = {
  interceptor: "interceptor",
  generation: "generation",
  chats: "chats",
  characters: "characters",
  personas: "personas",
  worldBooks: "world_books",
  corsProxy: "cors_proxy",
};

function send(message: BackendToFrontend, userId = lastFrontendUserId ?? undefined): void {
  (spindle.sendToFrontend as unknown as (payload: unknown, targetUserId?: string) => void)(message, userId);
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
    characters: permissionHas("characters"),
    personas: permissionHas("personas"),
    worldBooks: permissionHas("worldBooks"),
    corsProxy: permissionHas("corsProxy"),
  };
}

function rememberChatUser(chatId: string | null | undefined, userId: string | null | undefined): void {
  if (!chatId || !userId) return;
  chatUserIds.set(chatId, userId);
}

/**
 * Resolves the user a generation belongs to.
 *
 * The host supplies `context.userId` per generation and it is authoritative: for a
 * globally installed extension, falling back to the most recent frontend user
 * would let a generation run against another user's settings and Jev key.
 */
function resolveUserId(chatId?: string | null, contextUserId?: string | null): string | null {
  if (typeof contextUserId === "string" && contextUserId.trim()) return contextUserId.trim();
  if (chatId) {
    const mapped = chatUserIds.get(chatId);
    if (mapped) return mapped;
  }
  return lastFrontendUserId;
}

function extractContextUserId(value: unknown): string | null {
  if (!value || typeof value !== "object") return null;
  const raw = (value as { userId?: unknown; user_id?: unknown }).userId ?? (value as { user_id?: unknown }).user_id;
  return typeof raw === "string" && raw.trim() ? raw.trim() : null;
}

/** The host marks prompt previews and tokenize-only assemblies as dry runs. */
function extractDryRun(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  const raw = (value as { dryRun?: unknown; dry_run?: unknown }).dryRun ?? (value as { dry_run?: unknown }).dry_run;
  return raw === true;
}

function extractChatId(value: unknown): string | null {
  if (!value || typeof value !== "object") return null;
  const raw = (value as { chatId?: unknown; chat_id?: unknown }).chatId ?? (value as { chat_id?: unknown }).chat_id;
  return typeof raw === "string" && raw.trim() ? raw : null;
}

function extractGenerationId(value: unknown): string | null {
  if (!value || typeof value !== "object") return null;
  const raw = (value as { generationId?: unknown; generation_id?: unknown }).generationId ??
    (value as { generation_id?: unknown }).generation_id;
  return typeof raw === "string" && raw.trim() ? raw.trim() : null;
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

function directorBusyKey(userId: string | null | undefined, chatId: string | null | undefined): string {
  return `${userId || "user"}:${chatId || "no-chat"}`;
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
  const stored = await storageApi().getJson(SETTINGS_PATH, { fallback: {}, userId: userId ?? undefined });
  // Keep legacy World Agent settings on disk so an older installation can recover them.
  const legacy = stored && typeof stored === "object" && !Array.isArray(stored) ? stored as Record<string, unknown> : {};
  const next = normalizeSettings({ ...legacy, ...patch });
  await storageApi().setJson(SETTINGS_PATH, { ...legacy, ...next }, { indent: 2, userId: userId ?? undefined });
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

async function recordRun(entry: RunLogEntry, userId?: string | null, settings?: LumiWorldSettings): Promise<void> {
  const key = userId ?? "global";
  const previous = runLogWrites.get(key) ?? Promise.resolve();
  const write = previous.catch(() => {}).then(async () => {
    try {
      const resolvedSettings = settings ?? (await loadSettings(userId));
      const stored = await storageApi().getJson(RUNS_PATH, { fallback: [], userId: userId ?? undefined });
      const raw = Array.isArray(stored) ? stored : [];
      const existing = normalizeRunLog(raw, Number.MAX_SAFE_INTEGER);
      // Preserve historical World Agent run records without rewriting their fields.
      const legacy = raw.filter((run): run is Record<string, unknown> =>
        !!run && typeof run === "object" && !Array.isArray(run) && run.channel === "world_agent");
      const priorDirector = existing.filter((run) => run.channel !== "world_agent");
      const director = appendRunLog(
        entry.status.startsWith("test_") || entry.generationType === "test" ? priorDirector : priorDirector.map(stripFullTurnText),
        entry, resolvedSettings.runLogLimit,
      );
      const next = [...director, ...legacy].sort((a, b) => Number(b.timestamp) - Number(a.timestamp));
      await storageApi().setJson(RUNS_PATH, next, { indent: 2, userId: userId ?? undefined });
      send({ type: "run_logged", run: entry }, userId ?? undefined);
    } catch (error) {
      spindle.log.warn(`LumiWorld could not record run: ${error instanceof Error ? error.message : String(error)}`);
    }
  });
  runLogWrites.set(key, write);
  await write;
  if (runLogWrites.get(key) === write) runLogWrites.delete(key);
}

async function recordTurnRun(entry: RunLogEntry, userId: string | null, settings: LumiWorldSettings): Promise<void> {
  const trace = entry.trace;
  if (userId && trace?.generationOutcome === "pending" && trace.chatId && trace.generationId
    && activeGenerationIds.get(generationChatKey(userId, trace.chatId)) !== trace.generationId) {
    trace.generationOutcome = "unknown";
    if (trace.worldStateOutcome === "pending") trace.worldStateOutcome = "discarded";
  }
  await recordRun(entry, userId, settings);
  if (userId && trace?.generationOutcome === "pending" && trace.chatId && trace.generationId) {
    generationRunIds.set(generationCommitKey(userId, trace.chatId, trace.generationId), entry.id);
  }
}

async function patchRunTrace(userId: string, runId: string, patch: Partial<TurnTrace>): Promise<void> {
  const previous = runLogWrites.get(userId) ?? Promise.resolve();
  const write = previous.catch(() => {}).then(async () => {
    try {
      const stored = await storageApi().getJson(RUNS_PATH, { fallback: [], userId });
      if (!Array.isArray(stored)) return;
      const index = stored.findIndex((value) => value && typeof value === "object" && (value as { id?: unknown }).id === runId);
      if (index < 0) return;
      const current = stored[index] as RunLogEntry;
      // A later turn strips full text from older records. Do not recreate it when
      // a late generation event arrives for one of those records.
      if (!current.trace) return;
      const updated = { ...current, trace: { ...current.trace, ...patch } };
      const next = [...stored]; next[index] = updated;
      await storageApi().setJson(RUNS_PATH, next, { indent: 2, userId });
      send({ type: "run_logged", run: updated }, userId);
    } catch (error) {
      spindle.log.warn(`LumiWorld could not update turn trace: ${error instanceof Error ? error.message : String(error)}`);
    }
  });
  runLogWrites.set(userId, write);
  await write;
  if (runLogWrites.get(userId) === write) runLogWrites.delete(userId);
}

function stripFullTurnText(run: RunLogEntry): RunLogEntry {
  if (!run.trace && !run.jev?.phases?.length && !run.jev?.revision) return run;
  return {
    ...run,
    trace: null,
    jev: run.jev ? {
      ...run.jev,
      phases: run.jev.phases.map((phase) => ({ ...phase, requestJson: null, responseJson: null })),
      revision: run.jev.revision
        ? { ...run.jev.revision, promptJson: null, revisedDirective: null, responseJson: null }
        : null,
    } : null,
  };
}

function jsonText(value: unknown): string | null {
  try { return JSON.stringify(value); }
  catch { return null; }
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
  // These fields describe the character across scenes. The card's scenario,
  // examples, and opening message can depict a different point in the story;
  // the marked chat history is the only source for the current scene.
  return [
    `Name: ${character.name}`,
    section("Description", identityText(character.description, identity)),
    section("Personality", identityText(character.personality, identity)),
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
  includeCharacter = settings.includeCharacter,
  includePersona = settings.includeUserPersona,
): Promise<{ messages: LlmMessageLike[]; identity: IdentityMacroValues }> {
  const [persona, character] = await Promise.all([
    includePersona ? resolvePersona(context, userId) : Promise.resolve(null),
    includeCharacter ? resolveCharacter(context, chatId, userId) : Promise.resolve(null),
  ]);
  const identity = makeIdentity(persona, character);
  const messages = [
    persona ? makeControllerContextMessage("User Persona", formatPersonaContext(persona, identity)) : null,
    character ? makeControllerContextMessage("Character", formatCharacterContext(character, identity)) : null,
  ].filter((message): message is LlmMessageLike => !!message);
  return { messages, identity };
}

/* ------------------------------------------------------------------ *
 * Jev integration
 * ------------------------------------------------------------------ */

/** The Jev key lives in the encrypted per-user enclave, never in settings JSON. */
async function readJevKey(provider: JevSettings["provider"], userId?: string | null): Promise<string | null> {
  const enclave = enclaveApi();
  if (!enclave || typeof enclave.get !== "function") return null;
  try {
    const value = await enclave.get(jevSecretKey(provider), userId ?? undefined);
    return typeof value === "string" && value.trim() ? value.trim() : null;
  } catch {
    return null;
  }
}

/**
 * Stores the key, throwing if the enclave refuses it.
 *
 * A swallowed failure here is invisible: the drawer would claim the key was
 * stored while every later read returned null, so the caller must report it.
 */
async function storeJevKey(provider: JevSettings["provider"], key: string, userId?: string | null): Promise<void> {
  const enclave = enclaveApi();
  if (!enclave || typeof enclave.put !== "function") {
    throw new Error("This Lumiverse host does not expose encrypted secret storage.");
  }
  const value = key.trim();
  if (!value) return;
  await enclave.put(jevSecretKey(provider), value, userId ?? undefined);
}

async function clearJevKey(provider: JevSettings["provider"], userId?: string | null): Promise<void> {
  const enclave = enclaveApi();
  if (!enclave || typeof enclave.delete !== "function") return;
  try {
    await enclave.delete(jevSecretKey(provider), userId ?? undefined);
  } catch (error) {
    // Clearing a key that is already gone is not an error, but anything else is
    // worth a warning rather than silence.
    spindle.log.warn(`LumiWorld could not clear the Jev key: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/** Whole-minute ceiling on Jev work, leaving the Director its reserved budget. */
function jevPhaseBudgetMs(settings: LumiWorldSettings): number {
  const elapsed = 0;
  const available = INTERCEPTOR_BUDGET_MS - DIRECTOR_RESERVE_MS - elapsed;
  return Math.max(1_000, Math.min(settings.jev.timeoutMs, MAX_JEV_PHASE_MS, available));
}

interface JevRun {
  enabled: boolean;
  config: ({ provider: JevSettings["provider"] } & JevSettings & { apiKey: string }) | null;
  cors: ((url: string, options?: unknown) => Promise<unknown>) | null;
  error: string | null;
}

async function prepareJev(settings: LumiWorldSettings, userId: string | null): Promise<JevRun> {
  const jev = settings.jev;
  if (!jev.enabled) return { enabled: false, config: null, cors: null, error: null };
  if (!permissionHas("corsProxy")) {
    return { enabled: false, config: null, cors: null, error: "The cors_proxy permission is not granted, so Jev cannot be reached." };
  }
  const cors = corsApi();
  if (!cors) return { enabled: false, config: null, cors: null, error: "This Lumiverse host does not expose the CORS proxy." };
  const apiKey = await readJevKey(jev.provider, userId);
  if (!apiKey) {
    return {
      enabled: false, config: null, cors,
      error: `No Jev API key is stored for ${resolveJevProvider(jev).label}. Add one in the LumiWorld drawer.`,
    };
  }
  return { enabled: true, config: { ...jev, apiKey }, cors, error: null };
}

/**
 * Normalizes answers that arrived with a different shape than expected, and
 * recovers answers when the provider wrapped them in its own envelope.
 */
function recoverAnswers(answers: Record<string, JevAnswer>): Record<string, JevAnswer> {
  const recovered: Record<string, JevAnswer> = { ...answers };
  const source = answers as unknown as Record<string, unknown>;
  const nested = source.answers ?? readObjectPath(source, ["data", "answers"]) ?? readObjectPath(source, ["result", "answers"]);
  if (nested && typeof nested === "object" && !Array.isArray(nested)) {
    try {
      const normalized = normalizeJevResponse({ answers: nested });
      for (const [id, answer] of Object.entries(normalized.answers)) {
        if (!(id in recovered)) recovered[id] = answer;
      }
    } catch {
      // A nested envelope that will not normalize is simply ignored.
    }
  }
  return recovered;
}

function readObjectPath(value: unknown, path: string[]): unknown {
  let current: unknown = value;
  for (const key of path) {
    if (!current || typeof current !== "object") return null;
    current = (current as Record<string, unknown>)[key];
  }
  return current ?? null;
}

interface GatePhaseOutcome {
  plan: ReturnType<typeof planGates>;
  records: JevGateRecord[];
  state: unknown;
  stateChars: number;
  stateCompacted: boolean;
  inputTokens: number | null;
  outputTokens: number | null;
  costUsd: number | null;
  resolvedModel: string | null;
  requests: number;
  durationMs: number;
  error: string | null;
  requestJson: string | null;
  responseJson: string | null;
}

interface GatePhaseOptions {
  jevRun: JevRun;
  settings: LumiWorldSettings;
  stateContext: Parameters<typeof import("./jev").buildJevState>[0];
  worldStateContext: string | null;
  turnContext: Parameters<typeof planGates>[2];
  questionOverrides?: Parameters<typeof planGates>[3];
  directive?: string | null;
  diagnostics: JevTurnDiagnostics;
}

/**
 * Runs one batched gate phase.
 *
 * A phase is always exactly one `questions` map, so adding gates never adds a
 * round trip. Failures are returned as data so the caller can degrade to
 * Director-only behavior rather than aborting the generation.
 */
async function runGatePhase(phase: "gate" | "verify", options: GatePhaseOptions): Promise<GatePhaseOutcome> {
  const { jevRun, settings } = options;
  const plan = planGates(phase, settings.jev, options.turnContext, options.questionOverrides ?? {});
  const projection = buildJevState(
    { ...options.stateContext, draftDirective: options.directive ?? options.stateContext.draftDirective },
    options.worldStateContext,
  );
  const questions: JevQuestions = questionsFromPlan(plan) as JevQuestions;
  const requestJson = jsonText({ state: projection.state, questions });
  const empty = (error: string | null): GatePhaseOutcome => ({
    plan, records: resolveGateAnswers(plan, {}, settings.jev.minConfidence), state: projection.state,
    stateChars: projection.chars, stateCompacted: projection.compacted,
    inputTokens: null, outputTokens: null, costUsd: null, resolvedModel: null,
    requests: 0, durationMs: 0, error, requestJson, responseJson: null,
  });

  if (plan.gates.length === 0) return empty(null);
  if (!jevRun.enabled || !jevRun.config || !jevRun.cors) return empty(jevRun.error);

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
    retryOnRateLimit: settings.jev.retryOnRateLimit,
  });

  if (!outcome.ok || !outcome.response) {
    return {
      ...empty(outcome.error ?? "Jev request failed."),
      requests: outcome.requests,
      durationMs: outcome.durationMs,
      requestJson: outcome.request?.body ?? requestJson,
      responseJson: jsonText(outcome.attempts),
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
    responseJson: jsonText(outcome.attempts),
  };
}

function summaryOfMessages(messages: LlmMessageLike[], maxChars: number): string | null {
  if (messages.length === 0) return null;
  const prompt = formatPromptForController(messages, maxChars);
  return prompt.prompt.trim() || null;
}

function contextMessageSummary(messages: LlmMessageLike[], label: string): string | null {
  const message = messages.find((entry) => entry[CONTROLLER_CONTEXT_LABEL_KEY] === label);
  if (!message) return null;
  const text = serializeContent(message.content).trim();
  return text || null;
}

function serializeContent(content: LlmMessageLike["content"]): string {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content.map((part) => (part.type === "text" ? part.text : "")).filter(Boolean).join("\n");
}

/**
 * Merges one phase's outcome into the turn diagnostics.
 *
 * Counts come from the phase's own resolved gate records, so the synthetic
 * cross-cutting records added afterwards cannot inflate them.
 */
function mergeJevDiagnostics(
  current: JevTurnDiagnostics,
  phase: GatePhaseOutcome,
  stage: JevPhaseTrace["stage"],
): JevTurnDiagnostics {
  const flags = countJevFlags(phase.records);
  // A phase that answered cleanly settles the turn to "ok" unless a previous phase
  // already degraded it. A phase that answered nothing keeps the turn degraded.
  const phaseFailed = !!phase.error;
  const status: JevTurnDiagnostics["status"] = current.error || phaseFailed
    ? "degraded"
    : current.status === "degraded" ? "degraded" : "ok";
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
      stage, questionCount: phase.plan.gates.length, requestCount: phase.requests,
      durationMs: phase.durationMs, inputTokens: phase.inputTokens, outputTokens: phase.outputTokens,
      costUsd: phase.costUsd, resolvedModel: phase.resolvedModel,
      stateChars: phase.stateChars, stateCompacted: phase.stateCompacted,
      error: phase.error, gates: phase.records,
      requestJson: phase.requestJson, responseJson: phase.responseJson,
    }],
  };
}

function sumNullable(left: number | null, right: number | null): number | null {
  if (left === null) return right;
  if (right === null) return left;
  return left + right;
}

const CONTROLLER_CONTEXT_LABEL = CONTROLLER_CONTEXT_LABEL_KEY;

/* ------------------------------------------------------------------ *
 * Controller preparation and the Director call
 * ------------------------------------------------------------------ */

interface PreparedController {
  controllerMessages: LlmMessageLike[];
  currentUserMessages: LlmMessageLike[];
  promptSnapshot: ReturnType<typeof formatPromptForController>;
  /** Persona, character, and World Info messages resolved for this turn. */
  contextMessages: LlmMessageLike[];
  worldState: WorldState;
  worldInfoDiagnostics: WorldInfoContextDiagnostics;
  turnContext: Parameters<typeof planGates>[2];
  stateContext: Parameters<typeof import("./jev").buildJevState>[0];
}

async function prepareController(
  settings: LumiWorldSettings,
  messages: LlmMessageDTO[],
  context: unknown,
  chatId: string | null,
  userId: string | null,
  generationType: string,
  /** False for the gate phase: the assembled prompt is not needed yet, and the
   *  World Info lookup is the most expensive part of preparation. */
  preserveWorldInfo = true,
): Promise<PreparedController> {
  const identityPromise = Promise.all([
    resolvePersona(context, userId),
    resolveCharacter(context, chatId, userId),
  ]);
  const worldState = await loadWorldState(
    storageApi(), chatId ?? "", userId, settings.jev.enabled && settings.jev.worldStateEnabled,
  );
  const [persona, character] = await identityPromise;
  const identity = makeIdentity(persona, character);
  const includesCharacter = settings.includeCharacter && !!character;
  const includesPersona = settings.includeUserPersona && !!persona;
  const jevIncludesCharacter = settings.jev.includeCharacter && !!character;
  const jevIncludesPersona = settings.jev.includeUserPersona && !!persona;

  const contextMessages = [
    includesPersona && persona ? makeControllerContextMessage("User Persona", formatPersonaContext(persona, identity)) : null,
    includesCharacter && character ? makeControllerContextMessage("Character", formatCharacterContext(character, identity)) : null,
  ].filter((message): message is LlmMessageLike => !!message);
  const jevContextMessages = [
    jevIncludesPersona && persona ? makeControllerContextMessage("User Persona", formatPersonaContext(persona, identity)) : null,
    jevIncludesCharacter && character ? makeControllerContextMessage("Character", formatCharacterContext(character, identity)) : null,
  ].filter((message): message is LlmMessageLike => !!message);

  const worldBooks = worldBooksApi();
  const includeDirectorWorldInfo = preserveWorldInfo && settings.includeWorldInfoEntries;
  const includeJevWorldInfo = preserveWorldInfo && settings.jev.enabled && settings.jev.includeWorldInfoEntries;
  const worldInfoContext = await resolveWorldInfoContextMessages({
    // Fetch only when Jev or the Director has opted into activated lore.
    messages: messages as LlmMessageLike[],
    settings: { ...settings, includeWorldInfoEntries: includeDirectorWorldInfo || includeJevWorldInfo },
    context,
    canFetchWorldBooks: permissionHas("worldBooks") && !!worldBooks,
    fetchActivated: chatId && typeof worldBooks?.getActivated === "function"
      ? () => worldBooks.getActivated(chatId, userId ?? undefined) : undefined,
    fetchEntry: typeof worldBooks?.entries?.get === "function"
      ? (entryId: string) => worldBooks.entries.get(entryId, userId ?? undefined) : undefined,
    identity,
  });

  const selected = selectControllerMessagesForController(
    messages as LlmMessageLike[], settings,
    [...contextMessages, ...(includeDirectorWorldInfo ? worldInfoContext.messages : [])],
  );
  const currentUserMessages = currentUserContextMessages(messages as LlmMessageLike[], settings.maxInputChars);
  const currentChars = currentUserMessages.reduce((sum, message) => sum + serializeContent(message.content).length, 0);
  const promptSnapshot = formatPromptForController(selected, Math.max(1000, settings.maxInputChars - currentChars));
  const controllerMessages = buildControllerMessages(settings, promptSnapshot, {
    generationType, chatId: chatId || "", connectionId: extractConnectionId(context),
    user: identity.userName || "User",
    char: identity.characterName || "Character",
  });
  controllerMessages.splice(-1, 0, ...currentUserMessages);
  const latestPlayerAction = latestPlayerChatMessage(messages as LlmMessageLike[]);

  const worldStateText = projectWorldState(worldState);
  const jevHistory = selectChatHistoryMessagesForController(messages as LlmMessageLike[], settings.jev.historyMessageLimit);
  return {
    controllerMessages,
    currentUserMessages,
    promptSnapshot,
    contextMessages: [...contextMessages, ...(includeDirectorWorldInfo ? worldInfoContext.messages : [])],
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
      generationType,
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
      worldState: worldState.turn > 0 ? worldStateText : null,
    },
  };
}

/**
 * Applies the phase-A context filter to the already-prepared context.
 *
 * The base preparation supplies the identity, the Jev state projection, and the
 * scene state, so nothing is looked up twice.
 */
function applyContextFilter(
  base: PreparedController,
  settings: LumiWorldSettings,
  messages: LlmMessageDTO[],
  context: unknown,
  generationType: string,
  decision: ReturnType<typeof contextFilterDecision>,
): PreparedController {
  if (!decision) return base;

  // Rebuild from the already-resolved context messages so a kept source cannot be
  // dropped. Reconstructing from the summaries instead would silently discard
  // World Info, whose entries are not recoverable from a summary string.
  const keepLabel: Record<string, boolean> = {
    "User Persona": decision.keepPersona,
    "Character": decision.keepCharacter,
  };
  const contextMessages = base.contextMessages.filter((message) => {
    const label = typeof message[CONTROLLER_CONTEXT_LABEL_KEY] === "string"
      ? message[CONTROLLER_CONTEXT_LABEL_KEY] as string
      : "";
    if (label in keepLabel) return keepLabel[label]!;
    // Everything else in the context set is World Info.
    return decision.keepWorldInfo;
  });

  const history = decision.keepHistory
    ? selectChatHistoryMessagesForController(messages as LlmMessageLike[], settings.historyMessageLimit)
    : [];
  const currentChars = base.currentUserMessages.reduce((sum, message) => sum + serializeContent(message.content).length, 0);
  const promptSnapshot = formatPromptForController([...contextMessages, ...history], Math.max(1000, settings.maxInputChars - currentChars));
  const controllerMessages = buildControllerMessages(settings, promptSnapshot, {
    generationType, chatId: base.stateContext.chatId, connectionId: extractConnectionId(context),
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
      hasWorldInfo: decision.keepWorldInfo && base.turnContext.hasWorldInfo,
    },
  };
}

async function buildState(userId?: string | null): Promise<FrontendState> {
  const settings = await loadSettings(userId);
  const [connectionState, runs, hasJevKey] = await Promise.all([
    listConnections(userId), loadRuns(userId, Number.MAX_SAFE_INTEGER),
    readJevKey(settings.jev.provider, userId).then((key) => !!key).catch(() => false),
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
    jevEndpoint: jevEndpoint(settings.jev),    activeGateCount: settings.jev.enabled
      ? Object.values(settings.jev.gatePolicy).filter((policy) => policy.enabled === true).length
      : 0,
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
): Promise<{ directive: string; threadLabel: string | null; durationMs: number; responseJson: string | null }> {
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
      },
      reasoning: { source: "off" },
      signal: controller.signal,
    });
    const directive = parseControllerDirectiveFromResponse(response);
    if (!directive) {
      throw new EmptyControllerDirectiveError(response);
    }
    return { directive, threadLabel: parseControllerThreadLabelFromResponse(response), durationMs: Date.now() - startedAt, responseJson: jsonText(response) };
  } catch (error) {
    if (timedOut || (error instanceof Error && error.name === "AbortError")) {
      throw new ControllerTimeoutError(settings.timeoutMs);
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Chooses the Director target for this turn.
 *
 * `model_route` may promote the turn to an explicitly configured "strong"
 * connection or model; when none is configured the normal target is kept, so the
 * gate degrades safely on a fresh install.
 */
async function resolveTurnTarget(
  settings: LumiWorldSettings,
  records: JevGateRecord[],
  userId: string | null,
): Promise<ControllerTarget | null> {
  const base = resolveControllerTarget(settings, await getConnection(settings.connectionId, userId));
  if (!wantsStrongDirectorModel(records)) return base.ok ? base : null;

  if (settings.strongConnectionId) {
    const strong = await getConnection(settings.strongConnectionId, userId);
    if (strong) {
      const resolved = resolveControllerTarget(
        { ...settings, connectionId: settings.strongConnectionId, modelOverride: settings.strongModelOverride },
        strong,
      );
      if (resolved.ok) return resolved;
    }
  }
  if (settings.strongModelOverride.trim() && base.ok) {
    return { ...base, model: settings.strongModelOverride.trim() };
  }
  return base.ok ? base : null;
}

async function handleInterceptor(
  messages: LlmMessageDTO[], context: unknown,
): Promise<LlmMessageDTO[] | InterceptorResultDTO> {
  const chatId = extractChatId(context);
  const userId = resolveUserId(chatId, extractContextUserId(context));
  const generationId = chatId && userId ? activeGenerationIds.get(generationChatKey(userId, chatId)) : undefined;
  const generationType = extractGenerationType(context);
  // A dry run is a preview: it must be side-effect free.
  const dryRun = extractDryRun(context);
  const startedAt = Date.now();
  rememberChatUser(chatId, userId);
  const settings = await loadSettings(userId);
  if (!shouldInterceptGeneration(settings, generationType).intercept) return messages;
  const turnTrace: TurnTrace = {
    chatId, generationId: generationId ?? null, dryRun, settingsJson: jsonText(settings),
    generationOutcome: dryRun ? "preview" : userId && chatId && generationId
      && activeGenerationIds.get(generationChatKey(userId, chatId)) === generationId ? "pending" : "unknown",
    generationError: null, messageId: null, finalReply: null, worldStateOutcome: "not_used",
    directiveDisposition: null, verificationVerdict: null, verificationReason: null,
    worldStateBeforeJson: null, worldStateAfterJson: null,
    incomingMessagesJson: jsonText(messages), directorMessagesJson: null,
    initialDirective: null, finalDirective: null, initialResponseJson: null,
  };

  if (!permissionHas("generation")) {
    await recordTurnRun(makeRunBase("skipped", startedAt, {
      channel: "director", generationType, error: "Generation permission is not granted.", trace: turnTrace,
    }), userId, settings);
    return messages;
  }

  const busyKey = directorBusyKey(userId, chatId);
  if (!directorBusy.acquire(busyKey)) {
    await recordTurnRun(makeRunBase("skipped", startedAt, {
      channel: "director", generationType, error: "Another LumiWorld controller call is already running.", trace: turnTrace,
    }), userId, settings);
    return messages;
  }

  let target: ControllerTarget | null = null;
  let worldState: WorldState = defaultWorldState();
  let worldInfoDiagnostics: WorldInfoContextDiagnostics = {
    activatedEntryCount: 0, fetchedEntryCount: 0,
    fallbackTaggedEntryCount: 0, fetchError: null,
  };
  let prepared: PreparedController | null = null;
  const jevDiagnostics = makeJevDiagnostics({ enabled: settings.jev.enabled, provider: settings.jev.provider });
  let gateRecords: JevGateRecord[] = [];
  let verifyRecords: JevGateRecord[] = [];

  try {
    const jevRun = await prepareJev(settings, userId);

    /* ---------------- Phase A: one batched gate request ---------------- */
    // Fetch lore in phase A only when Jev's own switch includes it. Otherwise
    // the Director fetch can wait until after Jev has chosen its context filter.
    prepared = await prepareController(settings, messages, context, chatId, userId, generationType, jevRun.enabled && settings.jev.includeWorldInfoEntries);
    worldState = prepared.worldState;
    turnTrace.worldStateBeforeJson = jsonText(worldState);
    worldInfoDiagnostics = prepared.worldInfoDiagnostics;
    if (jevRun.enabled) {
      jevDiagnostics.used = true;
      jevDiagnostics.model = resolveJevModelForDiagnostics(settings);
      const phase = await runGatePhase("gate", {
        jevRun, settings,
        stateContext: prepared.stateContext,
        worldStateContext: worldState.turn > 0 ? projectWorldState(worldState) : null,
        turnContext: prepared.turnContext,
        diagnostics: jevDiagnostics,
      });
      Object.assign(jevDiagnostics, mergeJevDiagnostics(jevDiagnostics, phase, "before_director"));
      gateRecords = phase.records;

      const decision = shouldRunDirector(gateRecords);
      if (!decision.run) {
        // Jev answered cleanly and told us to hold: that is a deliberate skip,
        // not a degradation, so the recorded status stays "skipped".
        const skipped = { ...jevDiagnostics, status: "skipped" as const, used: true };
        const records = withConfidenceGate(withDegradationGate(gateRecords, { status: "ok", error: null }), settings.jev.minConfidence);
        await recordTurnRun(makeRunBase("skipped", startedAt, {
          channel: "director", generationType,
          error: decision.reason ?? "Jev skipped this turn.",
          ...runLogWorldInfoPatch(worldInfoDiagnostics),
          jev: { ...skipped, gates: records, gateCount: records.length }, trace: turnTrace,
        }), userId, settings);
        return messages;
      }
    } else {
      // Fail open: without a usable Jev connection the Director runs exactly as it
      // did before v0.5, and the reason is recorded for the diagnostics view.
      jevDiagnostics.status = "degraded";
      jevDiagnostics.error = jevRun.error;
    }

    /* ---------------- Director call ---------------- */
    const proposedFilter = contextFilterDecision(gateRecords);
    // Jev may only discard a Director source it actually saw. Its context
    // switches are independent, so preserve every source hidden from Jev.
    const filterDecision = proposedFilter && {
      ...proposedFilter,
      keepHistory: proposedFilter.keepHistory || settings.jev.historyMessageLimit === 0,
      keepCharacter: proposedFilter.keepCharacter || settings.includeCharacter && !settings.jev.includeCharacter,
      keepPersona: proposedFilter.keepPersona || settings.includeUserPersona && !settings.jev.includeUserPersona,
      keepWorldInfo: proposedFilter.keepWorldInfo || settings.includeWorldInfoEntries && !settings.jev.includeWorldInfoEntries,
    };
    const keepWorldInfo = settings.includeWorldInfoEntries && (!filterDecision || filterDecision.keepWorldInfo);

    // Resolve Director-only lore after filtering; reuse phase-A lore when Jev
    // already fetched the same activated entries.
    if (keepWorldInfo && !(jevRun.enabled && settings.jev.includeWorldInfoEntries)) {
      const withWorldInfo = await prepareController(settings, messages, context, chatId, userId, generationType, true);
      worldInfoDiagnostics = withWorldInfo.worldInfoDiagnostics;
      prepared = withWorldInfo;
    }

    prepared = applyContextFilter(prepared, settings, messages, context, generationType, filterDecision);
    const gateGuidance = directorGuidanceFromGates(gateRecords);
    if (gateGuidance) prepared.controllerMessages.splice(1, 0, { role: "system", content: gateGuidance });
    turnTrace.directorMessagesJson = jsonText(prepared.controllerMessages);
    target = await resolveTurnTarget(settings, gateRecords, userId);
    if (!target) {
      await recordTurnRun(makeRunBase("skipped", startedAt, {
        channel: "director", generationType, connectionId: settings.connectionId,
        error: "Choose a LumiWorld controller connection first.",
        ...runLogWorldInfoPatch(worldInfoDiagnostics),
        jev: jevDiagnostics.used ? { ...jevDiagnostics, gates: gateRecords } : null,
        trace: turnTrace,
      }), userId, settings);
      return messages;
    }

    const first = await callController(userId, settings, target, prepared.controllerMessages);
    let directive = first.directive;
    let threadLabel = first.threadLabel;
    let withheldReason: string | null = null;
    turnTrace.initialDirective = directive;
    turnTrace.initialResponseJson = first.responseJson;

    /* ---------------- Phase B: one batched verification request ---------------- */
    if (jevRun.enabled) {
      const phase = await runGatePhase("verify", {
        jevRun, settings,
        stateContext: prepared.stateContext,
        worldStateContext: projectWorldState(worldState),
        turnContext: prepared.turnContext,
        directive,
        diagnostics: jevDiagnostics,
      });
      Object.assign(jevDiagnostics, mergeJevDiagnostics(jevDiagnostics, phase, "verify_draft"));
      verifyRecords = phase.records;
      let assessment = assessVerification(verifyRecords, phase.error);
      turnTrace.verificationVerdict = assessment.verdict;
      turnTrace.verificationReason = assessment.reason;
      if (assessment.repair) {
        // Exactly one bounded repair attempt. A failed or unresolved repair
        // withholds the note rather than sending the known problem downstream.
        const repaired = await regenerateDirective(userId, settings, target, prepared, directive, assessment.repair, verifyRecords);
        jevDiagnostics.revision = {
          action: assessment.repair.action, reason: assessment.repair.reason,
          status: repaired.directive ? "revised" : "failed",
          durationMs: repaired.durationMs, error: repaired.error,
          initialDirectivePreview: makeDirectivePreview(directive) ?? "",
          revisedDirectivePreview: makeDirectivePreview(repaired.directive), unresolved: true,
          promptJson: repaired.promptJson, revisedDirective: repaired.directive,
          responseJson: repaired.responseJson,
        };
        if (repaired.directive) {
          directive = repaired.directive;
          threadLabel = repaired.threadLabel;
          const recheck = await runGatePhase("verify", {
            jevRun, settings,
            stateContext: prepared.stateContext,
            worldStateContext: projectWorldState(worldState),
            turnContext: prepared.turnContext,
            directive,
            diagnostics: jevDiagnostics,
          });
          Object.assign(jevDiagnostics, mergeJevDiagnostics(jevDiagnostics, recheck, "verify_revision"));
          verifyRecords = recheck.records;
          assessment = assessVerification(verifyRecords, recheck.error);
          turnTrace.verificationVerdict = assessment.verdict;
          turnTrace.verificationReason = assessment.reason;
          jevDiagnostics.revision.unresolved = assessment.verdict !== "clean";
          if (assessment.verdict !== "clean") withheldReason = assessment.reason ?? "The revised note could not be verified.";
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
      const allRecords = withConfidenceGate(
        withDegradationGate(jevDiagnostics.phases.flatMap((phase) => phase.gates), { status: jevDiagnostics.status, error: jevDiagnostics.error }),
        settings.jev.minConfidence,
      );
      await recordTurnRun(makeRunBase("skipped", startedAt, {
        channel: "director", generationType, directorDurationMs: first.durationMs,
        connectionId: target.connectionId, connectionName: target.connectionName, model: target.model,
        error: `Director note withheld: ${withheldReason}`, ...runLogWorldInfoPatch(worldInfoDiagnostics),
        jev: { ...jevDiagnostics, gates: allRecords, gateCount: allRecords.length }, trace: turnTrace,
      }), userId, settings);
      return messages;
    }

    /* ---------------- Commit derived state ---------------- */
    // The scene may only advance once a reply actually lands. A dry run never
    // counts, and a live turn defers its commit to GENERATION_ENDED so a
    // cancelled, failed, or superseded generation cannot move the world.
    if (settings.jev.enabled && settings.jev.worldStateEnabled && turnTrace.verificationVerdict === "clean" && chatId && !dryRun) {
      const committed = commitWorldState(worldState, verifyRecords, threadLabel);
      worldState = committed;
      turnTrace.worldStateAfterJson = jsonText(committed);
      if (userId && generationId && activeGenerationIds.get(generationChatKey(userId, chatId)) === generationId) {
        pendingCommits.set(generationCommitKey(userId, chatId, generationId), { userId, chatId, state: committed });
        turnTrace.worldStateOutcome = "pending";
      } else {
        // A generation that was superseded during Jev work, or one whose start
        // event was unavailable, must never commit under another generation's ID.
        spindle.log.warn("LumiWorld skipped a scene-state commit because its generation could not be matched.");
        turnTrace.worldStateOutcome = "discarded";
      }
    }

    const allRecords = withConfidenceGate(
      withDegradationGate(jevDiagnostics.phases.flatMap((phase) => phase.gates), { status: jevDiagnostics.status, error: jevDiagnostics.error }),
      settings.jev.minConfidence,
    );
    turnTrace.finalDirective = directive;
    turnTrace.directiveDisposition = "injected";
    const injected: LlmMessageDTO = { role: "system", content: buildInjectedDirective(directive) };
    await recordTurnRun(makeRunBase("success", startedAt, {
      channel: "director", generationType, directorDurationMs: first.durationMs,
      connectionId: target.connectionId, connectionName: target.connectionName, model: target.model,
      directivePreview: makeDirectivePreview(directive), ...runLogWorldInfoPatch(worldInfoDiagnostics),
      jev: settings.jev.enabled || jevDiagnostics.used
        ? { ...jevDiagnostics, gates: allRecords, gateCount: allRecords.length }
        : null,
      trace: turnTrace,
    }), userId, settings);
    return { messages: [injected, ...messages], breakdown: [{ messageIndex: 0, name: BREAKDOWN_NAME }] };
  } catch (error) {
    const isTimeout = error instanceof ControllerTimeoutError;
    const isEmptyDirective = error instanceof EmptyControllerDirectiveError;
    const message = error instanceof Error ? error.message : String(error);
    if (error instanceof EmptyControllerDirectiveError) turnTrace.initialResponseJson = error.responseJson;
    const recordedGates = jevDiagnostics.used
      ? withConfidenceGate(withDegradationGate(jevDiagnostics.phases.flatMap((phase) => phase.gates), {
        status: jevDiagnostics.status, error: jevDiagnostics.error,
      }), settings.jev.minConfidence)
      : [];
    await recordTurnRun(makeRunBase(isTimeout ? "timeout" : isEmptyDirective ? "skipped" : "error", startedAt, {
      channel: "director", generationType,
      connectionId: target?.connectionId ?? settings.connectionId,
      connectionName: target?.connectionName, model: target?.model,
      error: message, ...runLogWorldInfoPatch(worldInfoDiagnostics),
      jev: jevDiagnostics.used
        ? { ...jevDiagnostics, gates: recordedGates, gateCount: recordedGates.length }
        : null,
      trace: turnTrace,
    }), userId, settings);
    spindle.log.warn(`LumiWorld interceptor skipped injection: ${message}`);
    return messages;
  } finally {
    directorBusy.release(busyKey);
  }
}

function resolveJevModelForDiagnostics(settings: LumiWorldSettings): string {
  const provider = resolveJevProvider(settings.jev);
  return settings.jev.model.trim() || provider.defaultModel;
}

/**
 * Builds the repair prompt and runs the single allowed regeneration.
 *
 * Returns null when the repair itself fails; the caller then withholds the note.
 */
async function regenerateDirective(
  userId: string | null,
  settings: LumiWorldSettings,
  target: ControllerTarget,
  prepared: PreparedController,
  originalDirective: string,
  repair: { action: string; reason: string },
  records: JevGateRecord[],
): Promise<{ directive: string | null; threadLabel: string | null; durationMs: number; error: string | null; promptJson: string | null; responseJson: string | null }> {
  const violated = records
    .filter((record) => ["player_agency", "continuity_guard", "duplicate_suppression", "intensity_boundary", "director_verification"].includes(record.gateId)
      && (record.usedFallback || ["violation", "repeats", "near_duplicate", "out_of_range", true].includes(record.value as string | boolean)))
    .map((record) => record.usedFallback
      ? `- ${record.label}: inconclusive; Jev could not confirm this check${record.confidence != null ? ` (confidence ${record.confidence.toFixed(2)})` : ""}`
      : `- ${record.label}: ${String(record.value)}`)
    .join("\n");
  const repairMessages: LlmMessageLike[] = [
    ...prepared.controllerMessages,
    {
      role: "user",
      content: [
        "Revise this complete original Director note:",
        `<draft_directive>\n${originalDirective}\n</draft_directive>`,
        `Repair it with this action: ${repair.action}.`,
        repair.reason,
        violated ? `Blocking or inconclusive checks:\n${violated}` : "",
        "An inconclusive check is not a confirmed violation. Make the scene timing and the player's completed action unambiguous while keeping sound parts of the draft.",
        "Preserve unaffected beats. Preserve the actor, target, objects, and completed outcome in the latest player chat action exactly. Do not redirect a finished action or decide the player's next action.",
        "Return only the corrected directive, preferably as JSON with director_note and an optional specific thread_label. There is no LumiWorld output length limit.",
      ].filter(Boolean).join("\n"),
    },
  ];
  const promptJson = jsonText(repairMessages);
  const startedAt = Date.now();
  try {
    const repaired = await callController(userId, settings, target, repairMessages);
    return { directive: repaired.directive, threadLabel: repaired.threadLabel, durationMs: repaired.durationMs, error: null, promptJson, responseJson: repaired.responseJson };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    spindle.log.warn(`LumiWorld repair attempt failed: ${message}`);
    return { directive: null, threadLabel: null, durationMs: Date.now() - startedAt, error: message, promptJson,
      responseJson: error instanceof EmptyControllerDirectiveError ? error.responseJson : null };
  }
}

/**
 * Drawer smoke test for the Jev connection.
 *
 * Sends one tiny Noul question with a fixed, chat-free state so the test costs
 * almost nothing and never transmits the user's conversation.
 */
async function runJevTest(
  userId: string | null,
  patch?: Partial<LumiWorldSettings>,
  draftKey?: string,
): Promise<void> {
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
    retryOnRateLimit: settings.jev.retryOnRateLimit,
  });

  if (!outcome.ok || !outcome.response) {
    send({ type: "jev_test_result", ok: false, error: outcome.error ?? "Jev did not answer." }, userId ?? undefined);
    return;
  }

  const answer = outcome.response.answers.connectivity;
  const confidence = answer && answer.type === "noul" ? Math.max(answer.noul, 1 - answer.noul) : null;
  const label = answer && answer.type === "noul" ? (answer.noul >= 0.5 ? "yes" : "no") : "unknown";

  // Only persist a key that the provider actually accepted. If storage refuses it
  // the test must fail loudly: a silently unstored key would break every later turn.
  if (draft) {
    try {
      await storeJevKey(settings.jev.provider, draft, userId);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      spindle.log.warn(`LumiWorld could not store the Jev key: ${message}`);
      send({
        type: "jev_test_result", ok: false,
        error: `Jev answered, but the key could not be saved: ${message}`,
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
    confidence,
  }, userId ?? undefined);
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
        channel: "director",
        generationType: "test",
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
        channel: "director",
        generationType: "test",
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
  void pushState(lastFrontendUserId);
});

(spindle as any).on?.("GENERATION_STARTED", (payload: unknown, eventUserId?: string) => {
  const chatId = extractChatId(payload);
  const generationId = extractGenerationId(payload);
  if (!chatId || !generationId || !eventUserId) return;
  const chatKey = generationChatKey(eventUserId, chatId);
  const previous = activeGenerationIds.get(chatKey);
  if (previous && previous !== generationId) {
    const previousKey = generationCommitKey(eventUserId, chatId, previous);
    const hadPendingState = pendingCommits.delete(previousKey);
    const previousRunId = generationRunIds.get(previousKey);
    generationRunIds.delete(previousKey);
    if (previousRunId) void patchRunTrace(eventUserId, previousRunId, {
      generationOutcome: "superseded", worldStateOutcome: hadPendingState ? "discarded" : "not_used",
    });
  }
  activeGenerationIds.set(chatKey, generationId);
});

/**
 * Flushes a staged scene-state commit once the reply has actually landed.
 *
 * `GENERATION_ENDED` carries an `error` field when the generation failed, so a
 * failed turn is dropped rather than advancing the world.
 */
(spindle as any).on?.("GENERATION_ENDED", (payload: unknown, eventUserId?: string) => {
  const chatId = extractChatId(payload);
  const generationId = extractGenerationId(payload);
  if (!chatId || !generationId || !eventUserId) return;
  const chatKey = generationChatKey(eventUserId, chatId);
  if (activeGenerationIds.get(chatKey) === generationId) activeGenerationIds.delete(chatKey);
  const commitKey = generationCommitKey(eventUserId, chatId, generationId);
  const pending = pendingCommits.get(commitKey);
  pendingCommits.delete(commitKey);
  const runId = generationRunIds.get(commitKey);
  generationRunIds.delete(commitKey);

  const event = payload as { error?: unknown; content?: unknown; messageId?: unknown };
  const failed = !!event.error;
  const patch: Partial<TurnTrace> = {
    generationOutcome: failed ? "failed" : "completed",
    generationError: failed ? String(event.error) : null,
    finalReply: typeof event.content === "string" ? event.content : null,
    messageId: typeof event.messageId === "string" ? event.messageId : null,
    worldStateOutcome: pending ? failed ? "discarded" : "saved" : "not_used",
  };
  if (failed || !pending) {
    if (runId) void patchRunTrace(eventUserId, runId, patch);
    return;
  }

  void saveWorldState(storageApi(), pending.chatId, pending.state, pending.userId)
    .then(() => { if (runId) return patchRunTrace(eventUserId, runId, patch); })
    .catch((error: unknown) => {
      spindle.log.warn(`LumiWorld could not save scene state: ${error instanceof Error ? error.message : String(error)}`);
      if (runId) void patchRunTrace(eventUserId, runId, { ...patch, worldStateOutcome: "save_failed" });
    });
});

/** A stopped generation never produced a reply, so its staged commit is discarded. */
(spindle as any).on?.("GENERATION_STOPPED", (payload: unknown, eventUserId?: string) => {
  const chatId = extractChatId(payload);
  const generationId = extractGenerationId(payload);
  if (!chatId || !generationId || !eventUserId) return;
  const chatKey = generationChatKey(eventUserId, chatId);
  if (activeGenerationIds.get(chatKey) === generationId) activeGenerationIds.delete(chatKey);
  const commitKey = generationCommitKey(eventUserId, chatId, generationId);
  const hadPendingState = pendingCommits.delete(commitKey);
  const runId = generationRunIds.get(commitKey);
  generationRunIds.delete(commitKey);
  if (runId) void patchRunTrace(eventUserId, runId, {
    generationOutcome: "stopped",
    finalReply: typeof (payload as { content?: unknown }).content === "string" ? (payload as { content: string }).content : null,
    worldStateOutcome: hadPendingState ? "discarded" : "not_used",
  });
});

(spindle as any).on?.("CHAT_SWITCHED", (payload: unknown, eventUserId?: string) => {
  const userId = eventUserId || lastFrontendUserId;
  if (!userId) return;
  rememberChatUser(extractChatId(payload), userId);
  void pushState(userId);
});

permissionsApi()?.onDenied?.(({ permission, operation }: { permission: string; operation: string }) => {
  spindle.log.warn(`LumiWorld permission denied for ${operation}: ${permission}`);
});

spindle.onFrontendMessage(async (raw, userId) => {
  lastFrontendUserId = userId;
  const message = raw as FrontendToBackend;
  if ("chatId" in message) rememberChatUser(message.chatId, userId);
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
          send({ type: "settings_save_error", revision: message.revision,
            message: error instanceof Error ? error.message : String(error) }, userId);
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
