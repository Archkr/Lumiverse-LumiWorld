import { describe, expect, test } from "bun:test";
import type { JevGateRecord } from "./shared";
import {
  applyWorldStatePatch,
  commitWorldState,
  defaultWorldState,
  loadWorldState,
  normalizeWorldState,
  projectWorldState,
  saveWorldState,
  worldStatePath,
  type WorldStateStore,
} from "./world-state";

const record = (patch: Partial<JevGateRecord>): JevGateRecord => ({
  gateId: "x", label: "x", primitive: "noul", phase: "verify",
  value: null, probability: null, confidence: null, confidenceDerived: false,
  threshold: 0.6, escalated: false, usedFallback: false, fallback: "none",
  ...patch,
});

function memoryStore(seed: Record<string, unknown> = {}): WorldStateStore & { data: Map<string, unknown> } {
  const data = new Map<string, unknown>(Object.entries(seed));
  return {
    data,
    getJson: async (path, options) => (data.has(path) ? structuredClone(data.get(path)) : options.fallback),
    setJson: async (path, value) => { data.set(path, structuredClone(value)); },
  };
}

describe("world state normalization", () => {
  test("returns defaults for junk input", () => {
    expect(normalizeWorldState(null)).toEqual(defaultWorldState());
    expect(normalizeWorldState("nope")).toEqual(defaultWorldState());
    expect(normalizeWorldState({})).toEqual(defaultWorldState());
  });

  test("clamps levels and drops malformed entries", () => {
    const state = normalizeWorldState({
      turn: -3,
      danger: 99,
      tension: -4,
      location: "  The harbour  ",
      characters: ["Ada", " ada ", "", 42],
      hooks: [{ label: "The locked door" }, { label: "" }, "junk"],
      threads: [{ label: "Debt", status: "nonsense" }, { label: "" }],
      relationships: [{ character: "Ada", stance: 99 }, { character: "" }],
      clockMinutes: -10,
    });
    expect(state.turn).toBe(0);
    expect(state.danger).toBe(5);
    expect(state.tension).toBe(0);
    expect(state.location).toBe("The harbour");
    expect(state.characters).toEqual(["Ada"]);
    expect(state.hooks).toHaveLength(1);
    expect(state.threads[0]!.status).toBe("open");
    expect(state.relationships[0]!.stance).toBe(10);
    expect(state.clockMinutes).toBe(0);
  });

  test("caps the number of retained lists", () => {
    const state = normalizeWorldState({
      hooks: Array.from({ length: 40 }, (_, index) => ({ label: `hook ${index}` })),
      threads: Array.from({ length: 40 }, (_, index) => ({ label: `thread ${index}` })),
      characters: Array.from({ length: 40 }, (_, index) => `char ${index}`),
    });
    expect(state.hooks.length).toBeLessThanOrEqual(12);
    expect(state.threads.length).toBeLessThanOrEqual(12);
    expect(state.characters.length).toBeLessThanOrEqual(16);
  });
});

describe("world state patches", () => {
  test("applies a patch and advances the turn", () => {
    const next = applyWorldStatePatch(defaultWorldState(), {
      location: "The observatory",
      danger: 3,
      tension: 4,
      characters: ["Ada", "Rook"],
      hook: { label: "The sealed hatch" },
      clockAdvanceMinutes: 120,
    }, 1);
    expect(next.turn).toBe(1);
    expect(next.location).toBe("The observatory");
    expect(next.danger).toBe(3);
    expect(next.tension).toBe(4);
    expect(next.characters).toEqual(["Ada", "Rook"]);
    expect(next.hooks.map((hook) => hook.label)).toEqual(["The sealed hatch"]);
    expect(next.clockMinutes).toBe(120);
  });

  test("replaces a hook with the same label instead of duplicating it", () => {
    const first = applyWorldStatePatch(defaultWorldState(), { hook: { label: "The sealed hatch" } }, 1);
    const second = applyWorldStatePatch(first, { hook: { label: "the SEALED hatch", stale: true } }, 2);
    expect(second.hooks).toHaveLength(1);
    expect(second.hooks[0]!.lastAdvanced).toBe(2);
    expect(second.hooks[0]!.stale).toBe(true);
  });

  test("accumulates relationship stance and clamps it", () => {
    let state = applyWorldStatePatch(defaultWorldState(), { relationship: { character: "Ada", stance: 3 } }, 1);
    state = applyWorldStatePatch(state, { relationship: { character: "ada", stance: 3 } }, 2);
    expect(state.relationships).toHaveLength(1);
    expect(state.relationships[0]!.stance).toBe(6);
    state = applyWorldStatePatch(state, { relationship: { character: "Ada", stance: 99 } }, 3);
    expect(state.relationships[0]!.stance).toBe(10);
  });
});

describe("committing gate decisions", () => {
  test("advances tension only when the scene-state gates answered", () => {
    const committed = commitWorldState(defaultWorldState(), [
      record({ gateId: "scene_state_tracking", value: true, probability: 0.9 }),
      record({ gateId: "scene_state_diff", value: 4, primitive: "score" }),
      record({ gateId: "relationship_deltas", value: 4, primitive: "score" }),
    ], "Make the storm worsen.");
    expect(committed.tension).toBe(4);
    expect(committed.turn).toBe(1);
  });

  test("ignores a gate whose answer was escalated to a fallback", () => {
    const committed = commitWorldState(defaultWorldState(), [
      record({ gateId: "scene_state_tracking", value: true, usedFallback: true }),
      record({ gateId: "scene_state_diff", value: 5, primitive: "score", usedFallback: true }),
    ], "directive");
    expect(committed.tension).toBe(0);
    expect(committed.turn).toBe(1);
  });

  test("does not update the scene when nothing changed", () => {
    const committed = commitWorldState(defaultWorldState(), [
      record({ gateId: "scene_state_tracking", value: false }),
      record({ gateId: "scene_state_diff", value: 2, primitive: "score" }),
    ], "directive");
    expect(committed.tension).toBe(0);
    expect(committed.turn).toBe(1);
  });

  test("records a thread lifecycle from the chosen strategy", () => {
    const committed = commitWorldState(defaultWorldState(), [
      record({ gateId: "scene_state_tracking", value: true }),
      record({ gateId: "thread_lifecycle", value: "resolve", primitive: "choice" }),
    ], "The debt is settled.");
    expect(committed.threads[0]!.status).toBe("resolved");
  });

  test("still advances the turn with no records at all", () => {
    const committed = commitWorldState(defaultWorldState(), [], null);
    expect(committed.turn).toBe(1);
    expect(committed.tension).toBe(0);
  });
});

describe("state projection", () => {
  test("renders a compact, readable summary", () => {
    const state = applyWorldStatePatch(defaultWorldState(), {
      location: "The observatory",
      danger: 3,
      tension: 4,
      characters: ["Ada", "Rook"],
      hook: { label: "The sealed hatch" },
      clockAdvanceMinutes: 90,
    }, 1);
    const text = projectWorldState(state);
    expect(text).toContain("Location: The observatory");
    expect(text).toContain("Danger: 3/5, Tension: 4/5");
    expect(text).toContain("Present: Ada, Rook");
    expect(text).toContain("The sealed hatch");
    expect(text).toContain("+90 minutes");
  });

  test("omits stale hooks and the default empty state", () => {
    const stale = applyWorldStatePatch(defaultWorldState(), { hook: { label: "Forgotten", stale: true } }, 1);
    expect(projectWorldState(stale)).not.toContain("Forgotten");
    expect(projectWorldState(defaultWorldState())).toBe("Danger: 0/5, Tension: 0/5");
  });
});

describe("persistence", () => {
  test("saves and loads a round trip", async () => {
    const store = memoryStore();
    const state = applyWorldStatePatch(defaultWorldState(), { location: "The pier", tension: 2 }, 1);
    await saveWorldState(store, "chat-1", state, "user-1");
    const loaded = await loadWorldState(store, "chat-1", "user-1", true);
    expect(loaded.location).toBe("The pier");
    expect(loaded.turn).toBe(1);
  });

  test("returns defaults when disabled or unscoped", async () => {
    const store = memoryStore();
    expect(await loadWorldState(store, "chat-1", "user-1", false)).toEqual(defaultWorldState());
    expect(await loadWorldState(store, "", "user-1", true)).toEqual(defaultWorldState());
  });

  test("survives a corrupt file and a throwing store", async () => {
    const corrupt = memoryStore({ [worldStatePath("chat-1")]: "not an object" });
    expect(await loadWorldState(corrupt, "chat-1", "user-1", true)).toEqual(defaultWorldState());
    const broken: WorldStateStore = {
      getJson: async () => { throw new Error("storage offline"); },
      setJson: async () => { throw new Error("storage offline"); },
    };
    expect(await loadWorldState(broken, "chat-1", "user-1", true)).toEqual(defaultWorldState());
    await expect(saveWorldState(broken, "chat-1", defaultWorldState(), "user-1")).resolves.toBeUndefined();
  });

  test("scopes the storage path per chat", () => {
    expect(worldStatePath("chat-1")).toBe("chats/chat-1/world.json");
    expect(worldStatePath("../../etc/passwd")).toBe("chats/.._.._etc_passwd/world.json");
    expect(worldStatePath("")).toBe("chats/unscoped/world.json");
  });
});
