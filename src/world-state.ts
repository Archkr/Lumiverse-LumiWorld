/**
 * Derived scene state, persisted per chat.
 *
 * This is what makes the world model trustworthy enough for the Director to build
 * on: each turn Jev classifies what changed, and the next turn's gate state and
 * Director context include that accumulated state instead of re-deriving it.
 *
 * The schema is deliberately flat with room to grow. `relationships` and
 * `foreshadowing` are carried through but have no v0.5 UI.
 */

import { DEFAULT_JEV_SETTINGS, type JevGateRecord } from "./shared";

export interface SceneHook {
  id: string;
  label: string;
  /** Turn index when the hook was last advanced. */
  lastAdvanced: number;
  stale: boolean;
}

export interface SceneThread {
  id: string;
  label: string;
  status: "open" | "resolved" | "dormant" | "abandoned";
  lastAdvanced: number;
}

export interface SceneRelationship {
  character: string;
  /** Signed stance delta accumulated from `relationship_deltas`. */
  stance: number;
  updatedTurn: number;
}

export interface WorldState {
  version: number;
  /** Monotonically increasing turn counter for this chat. */
  turn: number;
  location: string | null;
  /** 0 calm .. 5 critical. */
  danger: number;
  /** 0 calm .. 5 peak. */
  tension: number;
  characters: string[];
  hooks: SceneHook[];
  threads: SceneThread[];
  relationships: SceneRelationship[];
  /** In-world minutes elapsed, accumulated from `time_clock`. */
  clockMinutes: number;
  updatedAt: number;
}

export const WORLD_STATE_VERSION = 1;
const MAX_HOOKS = 12;
const MAX_THREADS = 12;
const MAX_CHARACTERS = 16;
const MAX_RELATIONSHIPS = 16;
const MAX_LABEL_CHARS = 160;

export function defaultWorldState(): WorldState {
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
    updatedAt: 0,
  };
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function clampLevel(value: unknown, fallback: number): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(5, Math.max(0, n));
}

function cleanLabel(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.replace(/\s+/g, " ").trim().slice(0, MAX_LABEL_CHARS);
}

function normalizeStringList(value: unknown, limit: number): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of value) {
    const label = cleanLabel(item);
    if (!label || seen.has(label.toLowerCase())) continue;
    seen.add(label.toLowerCase());
    out.push(label);
    if (out.length >= limit) break;
  }
  return out;
}

function normalizeHooks(value: unknown): SceneHook[] {
  if (!Array.isArray(value)) return [];
  const out: SceneHook[] = [];
  for (const item of value) {
    const obj = asRecord(item);
    const label = cleanLabel(obj.label);
    if (!label) continue;
    out.push({
      id: cleanLabel(obj.id) || `hook-${out.length + 1}`,
      label,
      lastAdvanced: Number.isFinite(Number(obj.lastAdvanced)) ? Number(obj.lastAdvanced) : 0,
      stale: obj.stale === true,
    });
    if (out.length >= MAX_HOOKS) break;
  }
  return out;
}

function normalizeThreads(value: unknown): SceneThread[] {
  if (!Array.isArray(value)) return [];
  const statuses = new Set<SceneThread["status"]>(["open", "resolved", "dormant", "abandoned"]);
  const out: SceneThread[] = [];
  for (const item of value) {
    const obj = asRecord(item);
    const label = cleanLabel(obj.label);
    if (!label) continue;
    const status = cleanLabel(obj.status) as SceneThread["status"];
    out.push({
      id: cleanLabel(obj.id) || `thread-${out.length + 1}`,
      label,
      status: statuses.has(status) ? status : "open",
      lastAdvanced: Number.isFinite(Number(obj.lastAdvanced)) ? Number(obj.lastAdvanced) : 0,
    });
    if (out.length >= MAX_THREADS) break;
  }
  return out;
}

function normalizeRelationships(value: unknown): SceneRelationship[] {
  if (!Array.isArray(value)) return [];
  const out: SceneRelationship[] = [];
  for (const item of value) {
    const obj = asRecord(item);
    const character = cleanLabel(obj.character);
    if (!character) continue;
    const stance = Number(obj.stance);
    out.push({
      character,
      stance: Number.isFinite(stance) ? Math.min(10, Math.max(-10, stance)) : 0,
      updatedTurn: Number.isFinite(Number(obj.updatedTurn)) ? Number(obj.updatedTurn) : 0,
    });
    if (out.length >= MAX_RELATIONSHIPS) break;
  }
  return out;
}

/** Never throws: an unreadable or corrupt file degrades to the default state. */
export function normalizeWorldState(value: unknown): WorldState {
  const obj = asRecord(value);
  if (Object.keys(obj).length === 0) return defaultWorldState();
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
    updatedAt: Number.isFinite(Number(obj.updatedAt)) ? Number(obj.updatedAt) : 0,
  };
}

/** Replaces an entry with the same label in place, or appends it and trims to `limit`. */
function upsertByLabel<T extends { label: string }>(list: T[], entry: T, limit: number): T[] {
  const index = list.findIndex((item) => item.label.toLowerCase() === entry.label.toLowerCase());
  if (index === -1) return [...list, entry].slice(-limit);
  const next = [...list];
  next[index] = entry;
  return next;
}

export interface WorldStatePatch {
  location?: string | null;
  danger?: number;
  tension?: number;
  characters?: string[];
  hook?: { label: string; stale?: boolean };
  thread?: { label: string; status: SceneThread["status"] };
  relationship?: { character: string; stance: number };
  clockAdvanceMinutes?: number;
}

export function applyWorldStatePatch(state: WorldState, patch: WorldStatePatch, turn: number): WorldState {
  const next: WorldState = { ...state, turn, updatedAt: Date.now() };
  if (patch.location !== undefined) next.location = cleanLabel(patch.location) || null;
  if (patch.danger !== undefined) next.danger = clampLevel(patch.danger, next.danger);
  if (patch.tension !== undefined) next.tension = clampLevel(patch.tension, next.tension);
  if (patch.characters !== undefined) next.characters = normalizeStringList(patch.characters, MAX_CHARACTERS);
  if (patch.clockAdvanceMinutes) next.clockMinutes = Math.max(0, next.clockMinutes + Math.floor(patch.clockAdvanceMinutes));
  if (patch.hook) {
    const label = cleanLabel(patch.hook.label);
    if (label) {
      next.hooks = upsertByLabel(next.hooks, {
        id: `hook-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40)}`,
        label,
        lastAdvanced: turn,
        stale: patch.hook.stale === true,
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
        lastAdvanced: turn,
      }, MAX_THREADS);
    }
  }
  if (patch.relationship) {
    const character = cleanLabel(patch.relationship.character);
    if (character) {
      const index = next.relationships.findIndex((item) => item.character.toLowerCase() === character.toLowerCase());
      const existing = index === -1 ? { character, stance: 0, updatedTurn: turn } : next.relationships[index]!;
      const updated: SceneRelationship = {
        character,
        stance: Math.min(10, Math.max(-10, existing.stance + patch.relationship.stance)),
        updatedTurn: turn,
      };
      const list = [...next.relationships];
      if (index === -1) list.push(updated);
      else list[index] = updated;
      next.relationships = list.slice(-MAX_RELATIONSHIPS);
    }
  }
  return next;
}

/* ------------------------------------------------------------------ *
 * Committing gate decisions
 * ------------------------------------------------------------------ */

function readChoice(records: JevGateRecord[], gateId: string): string | null {
  const record = records.find((entry) => entry.gateId === gateId);
  if (!record || record.usedFallback || typeof record.value !== "string") return null;
  return record.value;
}

function readNumber(records: JevGateRecord[], gateId: string): number | null {
  const record = records.find((entry) => entry.gateId === gateId);
  if (!record || record.usedFallback || typeof record.value !== "number") return null;
  return record.value;
}

const CLOCK_MINUTES: Record<string, number> = { none: 0, minutes: 5, hours: 120, day: 1440 };

/** The `thread_lifecycle` gate vocabulary mapped onto the persisted thread status. */
const THREAD_STATUS: Record<string, SceneThread["status"]> = {
  continue: "open",
  resolve: "resolved",
  dormant: "dormant",
  abandoned: "abandoned",
};

/**
 * Maps verification-phase decisions onto the persisted scene state.
 *
 * Gates that did not answer, or whose answer was escalated to a fallback, are
 * ignored: an unconfident classification must not silently rewrite the world model.
 */
export function commitWorldState(state: WorldState, records: JevGateRecord[], directive: string | null): WorldState {
  const turn = state.turn + 1;
  const patch: WorldStatePatch = {};

  const sceneChanged = records.find((record) => record.gateId === "scene_state_tracking");
  const tensionDelta = readNumber(records, "scene_state_diff");
  const relationshipDelta = readNumber(records, "relationship_deltas");

  const shouldUpdate = sceneChanged
    ? sceneChanged.value === true && !sceneChanged.usedFallback
    : tensionDelta !== null || relationshipDelta !== null;

  if (shouldUpdate) {
    if (tensionDelta !== null) patch.tension = tensionDelta;
    if (relationshipDelta !== null) patch.relationship = { character: "scene", stance: Math.round(relationshipDelta - 2) };
    const clock = readChoice(records, "time_clock");
    if (clock) patch.clockAdvanceMinutes = CLOCK_MINUTES[clock] ?? 0;
    const entry = readChoice(records, "npc_entry_exit");
    if (entry === "enter_new") patch.hook = { label: "A new character has entered the scene", stale: false };
    const lifecycle = readChoice(records, "thread_lifecycle");
    const status = lifecycle ? THREAD_STATUS[lifecycle] : undefined;
    if (status && directive) {
      patch.thread = { label: directive.slice(0, 80), status };
    }
  }

  if (Object.keys(patch).length === 0) {
    return { ...state, turn, updatedAt: Date.now() };
  }
  return applyWorldStatePatch(state, patch, turn);
}

/**
 * Projects the persisted state into the compact string embedded in the Jev
 * `scene_state` field and appended to the Director context.
 */
export function projectWorldState(state: WorldState): string {
  const lines: string[] = [];
  if (state.location) lines.push(`Location: ${state.location}`);
  lines.push(`Danger: ${state.danger}/5, Tension: ${state.tension}/5`);
  if (state.characters.length) lines.push(`Present: ${state.characters.join(", ")}`);
  const openThreads = state.threads.filter((thread) => thread.status === "open" || thread.status === "dormant");
  if (openThreads.length) {
    lines.push(`Open threads: ${openThreads.map((thread) => `${thread.label} (${thread.status})`).join("; ")}`);
  }
  const activeHooks = state.hooks.filter((hook) => !hook.stale);
  if (activeHooks.length) lines.push(`Open hooks: ${activeHooks.map((hook) => hook.label).join("; ")}`);
  if (state.clockMinutes > 0) lines.push(`In-world clock: +${state.clockMinutes} minutes since the scene began`);
  if (state.relationships.length) {
    const notable = state.relationships.filter((relationship) => relationship.character !== "scene" && relationship.stance !== 0);
    if (notable.length) {
      lines.push(`Relationship shifts: ${notable.map((relationship) => `${relationship.character} ${relationship.stance > 0 ? "+" : ""}${relationship.stance}`).join(", ")}`);
    }
  }
  return lines.join("\n");
}

/* ------------------------------------------------------------------ *
 * Persistence
 * ------------------------------------------------------------------ */

export function worldStatePath(chatId: string): string {
  const safe = chatId.replace(/[^A-Za-z0-9._-]/g, "_").slice(0, 120) || "unscoped";
  return `chats/${safe}/world.json`;
}

export interface WorldStateStore {
  getJson(path: string, options: { fallback: unknown; userId?: string }): Promise<unknown>;
  setJson(path: string, value: unknown, options: { indent?: number; userId?: string }): Promise<void>;
}

export async function loadWorldState(
  storage: WorldStateStore | null | undefined,
  chatId: string,
  userId?: string | null,
  enabled = DEFAULT_JEV_SETTINGS.worldStateEnabled,
): Promise<WorldState> {
  if (!enabled || !chatId || !storage?.getJson) return defaultWorldState();
  try {
    const stored = await storage.getJson(worldStatePath(chatId), { fallback: {}, userId: userId ?? undefined });
    return normalizeWorldState(stored);
  } catch {
    return defaultWorldState();
  }
}

export async function saveWorldState(
  storage: WorldStateStore | null | undefined,
  chatId: string,
  state: WorldState,
  userId?: string | null,
): Promise<void> {
  if (!chatId || !storage?.setJson) return;
  try {
    await storage.setJson(worldStatePath(chatId), state, { indent: 2, userId: userId ?? undefined });
  } catch {
    // World state is an optimization; losing it must never break a generation.
  }
}
