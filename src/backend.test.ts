import { beforeEach, describe, expect, test } from "bun:test";
import { DEFAULT_SETTINGS, type JevSettings, type LumiWorldSettings } from "./shared";
import type { BackendToFrontend, FrontendToBackend } from "./types";

type Interceptor = (messages: any[], context: unknown) => Promise<any>;
type MessageHandler = (message: FrontendToBackend, userId: string) => Promise<void>;

const baseSettings: LumiWorldSettings = {
  ...DEFAULT_SETTINGS,
  enabled: true,
  connectionId: "director-connection",
  includeCharacter: false,
  includeUserPersona: false,
};

/** Jev switched on with a stored key; individual tests narrow this further. */
function jevSettings(patch: Partial<JevSettings> = {}): JevSettings {
  return { ...DEFAULT_SETTINGS.jev, enabled: true, provider: "typesafe", model: "", gatePolicy: {}, ...patch };
}

const stored = new Map<string, unknown>([
  ["global/settings.json", {
    ...baseSettings,
    worldAgent: { enabled: true, injectState: true, connectionId: "old-world" },
  }],
  ["global/runs.json", [
    { id: "old-world-run", timestamp: 1, status: "success", channel: "world_agent", worldAgentDay: 4, legacyDetail: "keep" },
  ]],
]);
/** Mirrors the encrypted per-user enclave, including the host's key rules. */
const enclave = new Map<string, string>();
const ENCLAVE_KEY_PATTERN = /^[a-zA-Z0-9_.-]{1,128}$/;
function assertEnclaveKey(key: string): void {
  if (!ENCLAVE_KEY_PATTERN.test(key)) {
    throw new Error("Invalid enclave key: must be 1-128 characters, alphanumeric/underscore/dash/dot only");
  }
}
const sent: BackendToFrontend[] = [];
let interceptor: Interceptor | null = null;
let messageHandler: MessageHandler | null = null;
let generations = 0;
let rpcPublications = 0;
let failNextSettingsSave = false;
/** Every Jev question map the extension sent, one entry per request. */
const jevRequests: Array<Record<string, { type: string }>> = [];
let jevAnswerFor: (gateId: string) => unknown | undefined = () => undefined;
let corsShouldThrow = false;
let worldInfoFetches = 0;
/** What each host call was scoped to, for verifying the resolved user. */
let enclaveGetUsers: Array<string | undefined> = [];
let generateUsers: Array<string | undefined> = [];
const generatedModels: string[] = [];
/** Host lifecycle events the extension subscribed to. */
const eventHandlers = new Map<string, (payload: unknown, userId?: string) => void>();
function emitEvent(name: string, payload: unknown, userId?: string): void {
  eventHandlers.get(name)?.(payload, userId);
}
function beginGeneration(chatId: string, generationId: string, userId = "user-jev"): void {
  emitEvent("GENERATION_STARTED", { chatId, generationId }, userId);
}
let worldInfoEntryFetches = 0;

function jevAnswerBody(questions: Record<string, { type: string }>): string {
  const answers: Record<string, unknown> = {};
  for (const gateId of Object.keys(questions)) {
    const answer = jevAnswerFor(gateId);
    if (answer !== undefined) answers[gateId] = answer;
  }
  return JSON.stringify({ model: "jev-1.13.0", answers, usage: { input_tokens: 120, output_tokens: 12 } });
}

/** Answers just enough for a clean, fully verified Jev turn. */
function answerCleanTurn(): void {
  jevAnswerFor = (gateId) => {
    switch (gateId) {
      case "smart_trigger": return { type: "noul", noul: 0.95 };
      case "context_filter": return { type: "choice", choice: "all", probabilities: { all: 0.9, history_only: 0.1 }, confidence: 0.9 };
      case "model_route": return { type: "choice", choice: "cheap", probabilities: { cheap: 0.9, strong: 0.1 }, confidence: 0.9 };
      case "director_verification": return { type: "choice", choice: "clean", probabilities: { clean: 0.95, violation: 0.05 }, confidence: 0.95 };
      case "player_agency": return { type: "noul", noul: 0.02 };
      case "duplicate_suppression": return { type: "choice", choice: "new", probabilities: { new: 0.9, repeats: 0.05, near_duplicate: 0.05 }, confidence: 0.9 };
      case "continuity_guard": return { type: "choice", choice: "consistent", probabilities: { consistent: 0.9, violation: 0.05, uncertain: 0.05 }, confidence: 0.9 };
      case "intensity_boundary": return { type: "choice", choice: "within_range", probabilities: { within_range: 0.9, borderline: 0.05, out_of_range: 0.05 }, confidence: 0.9 };
      case "repair_strategy": return { type: "choice", choice: "accept", probabilities: { accept: 0.9, full_retry: 0.1 }, confidence: 0.9 };
      case "scene_state_tracking": return { type: "noul", noul: 0.9 };
      case "scene_state_diff": return { type: "score", score: 3, legend: {}, probabilities: { "3": 0.9 }, confidence: 0.9 };
      default: return undefined;
    }
  };
}

const jevMessages = [{ role: "user", content: "I open the observatory door.", __isChatHistory: true }];

/** Runs one Director turn, after making sure the acting user is known. */
async function runJevTurn(chatId = "chat-jev"): Promise<any> {
  await messageHandler!({ type: "refresh_state", chatId }, "user-jev");
  return interceptor!(jevMessages, { chatId, generationType: "normal" });
}

function directorRuns(result: any): boolean {
  return Array.isArray(result?.breakdown) && result.breakdown[0]?.name === "LumiWorld Director";
}

function latestRun(): any {
  return (stored.get("global/runs.json") as any[])[0];
}

(globalThis as any).spindle = {
  userStorage: {
    mkdir: async () => {},
    getJson: async (path: string, options: { fallback: unknown }) => stored.has(path) ? structuredClone(stored.get(path)) : options.fallback,
    setJson: async (path: string, value: unknown) => {
      if (path === "global/settings.json" && failNextSettingsSave) {
        failNextSettingsSave = false;
        throw new Error("storage unavailable");
      }
      stored.set(path, structuredClone(value));
    },
  },
  enclave: {
    // Mirrors the host's key validation. Without it the mock accepts anything and
    // an invalid key format passes every test while failing in Lumiverse.
    get: async (key: string, userId?: string) => { assertEnclaveKey(key); enclaveGetUsers.push(userId); return enclave.get(key) ?? null; },
    put: async (key: string, value: string) => { assertEnclaveKey(key); enclave.set(key, value); },
    delete: async (key: string) => { assertEnclaveKey(key); return enclave.delete(key); },
    has: async (key: string) => { assertEnclaveKey(key); return enclave.has(key); },
    list: async () => [...enclave.keys()],
  },
  connections: {
    list: async () => [{ id: "director-connection", name: "Director", provider: "mock", model: "mock-model", has_api_key: true }],
    get: async (id: string) => id === "director-connection"
      ? { id, name: "Director", provider: "mock", model: "mock-model", has_api_key: true } : null,
  },
  permissions: { has: () => true, onChanged: () => {}, onDenied: () => {} },
  personas: { getActive: async () => null },
  chats: { get: async () => null },
  world_books: {
    getActivated: async () => {
      worldInfoFetches += 1;
      return [{ id: "entry-1", comment: "The sealed hatch" }];
    },
    entries: {
      get: async (id: string) => {
        worldInfoEntryFetches += 1;
        return id === "entry-1"
          ? { id, content: "A hatch is sealed with salt and iron.", comment: "The sealed hatch" } : null;
      },
    },
  },
  cors: async (_url: string, options: { body: string }) => {
    if (corsShouldThrow) throw new Error("network unreachable");
    const payload = JSON.parse(options.body) as { questions: Record<string, { type: string }> };
    jevRequests.push(payload.questions);
    return { status: 200, statusText: "OK", headers: {}, body: jevAnswerBody(payload.questions) };
  },
  generate: {
    raw: async (input: any) => {
      generations += 1;
      generateUsers.push(input?.userId);
      generatedModels.push(input?.model);
      return { choices: [{ message: { content: '{"director_note":"Make the storm intensify."}' } }] };
    },
  },
  rpcPool: { sync: () => { rpcPublications++; } },
  log: { info: () => {}, warn: () => {}, error: () => {} },
  sendToFrontend: (message: BackendToFrontend) => { sent.push(message); },
  registerInterceptor: (handler: Interceptor) => { interceptor = handler; },
  on: (name: string, handler: (payload: unknown, userId?: string) => void) => {
    eventHandlers.set(name, handler);
    return () => eventHandlers.delete(name);
  },
  onFrontendMessage: (handler: MessageHandler) => { messageHandler = handler; },
};

await import("./backend");

describe("v0.4 backend", () => {
  test("does not publish a World Agent endpoint", () => {
    expect(rpcPublications).toBe(0);
  });

  test("keeps old simulation data without running it", async () => {
    expect(messageHandler).not.toBeNull();
    await messageHandler!({ type: "ready", chatId: "chat-1" }, "user-1");
    const state = sent.find((message) => message.type === "state");
    expect(state?.type).toBe("state");
    if (state?.type === "state") {
      expect("worldState" in state.state).toBe(false);
      expect(state.state.runs).toEqual([]);
      expect("worldAgent" in state.state.settings).toBe(false);
    }
    expect(stored.has("world-agent/chats/chat-1.json")).toBe(false);
    expect((stored.get("global/settings.json") as any).worldAgent.enabled).toBe(true);
  });

  test("injects only the Director note for a visible reply", async () => {
    expect(interceptor).not.toBeNull();
    const messages = [{ role: "user", content: "Open the door." }];
    const quiet = await interceptor!(messages, { chatId: "chat-1", generationType: "quiet" });
    expect(quiet).toBe(messages);
    expect(generations).toBe(0);
    const result = await interceptor!(messages, { chatId: "chat-1", generationType: "normal" });
    expect(result.messages).toHaveLength(2);
    expect(result.messages[0].content).toContain("[LumiWorld Director]");
    expect(JSON.stringify(result)).not.toContain("LumiWorld World Agent");
    expect(result.breakdown).toEqual([{ messageIndex: 0, name: "LumiWorld Director" }]);
    expect(generations).toBe(1);
  });

  test("runs for every selected visible reply type", async () => {
    const messages = [{ role: "user", content: "Keep going." }];
    for (const generationType of ["continue", "regenerate", "swipe", "impersonate"]) {
      const result = await interceptor!(messages, { chatId: "chat-1", generationType });
      expect(result.breakdown).toEqual([{ messageIndex: 0, name: "LumiWorld Director" }]);
    }
    expect(generations).toBe(5);
  });

  test("retains runs from simultaneous Director calls in different chats", async () => {
    const messages = [{ role: "user", content: "Continue." }];
    await Promise.all([
      interceptor!(messages, { chatId: "chat-2", generationType: "normal" }),
      interceptor!(messages, { chatId: "chat-3", generationType: "normal" }),
    ]);
    const runs = stored.get("global/runs.json") as any[];
    expect(runs.filter((run) => run.channel === "director")).toHaveLength(7);
  });

  test("preserves legacy settings and runs when saving Director changes", async () => {
    await messageHandler!({ type: "save_settings", revision: 1, settings: { temperature: 0.7 } }, "user-1");
    const settings = stored.get("global/settings.json") as any;
    expect(settings.temperature).toBe(0.7);
    expect(settings.worldAgent).toEqual({ enabled: true, injectState: true, connectionId: "old-world" });
    const runs = stored.get("global/runs.json") as any[];
    expect(runs.find((run) => run.id === "old-world-run")).toEqual({
      id: "old-world-run", timestamp: 1, status: "success", channel: "world_agent", worldAgentDay: 4, legacyDetail: "keep",
    });
    expect(sent.some((message) => message.type === "settings_saved" && message.revision === 1)).toBe(true);
  });

  test("reports a failed settings write and accepts a retry", async () => {
    failNextSettingsSave = true;
    await messageHandler!({ type: "save_settings", revision: 2, settings: { temperature: 0.8 } }, "user-1");
    expect(sent.some((message) => message.type === "settings_save_error" && message.revision === 2)).toBe(true);
    expect((stored.get("global/settings.json") as any).temperature).toBe(0.7);
    await messageHandler!({ type: "save_settings", revision: 2, settings: { temperature: 0.8 } }, "user-1");
    expect((stored.get("global/settings.json") as any).temperature).toBe(0.8);
  });
});

describe("v0.5 Jev turn flow", () => {
  beforeEach(() => {
    jevRequests.length = 0;
    generatedModels.length = 0;
    sent.length = 0;
    generations = 0;
    corsShouldThrow = false;
    worldInfoFetches = 0;
    worldInfoEntryFetches = 0;
    jevAnswerFor = () => undefined;
    enclave.clear();
    enclave.set("jev-api-key.typesafe", "test-key");
    stored.forEach((_value, key) => { if (key !== "global/runs.json") stored.delete(key); });
    stored.set("global/settings.json", { ...baseSettings, jev: jevSettings() });
    stored.set("global/runs.json", []);
  });

  test("batches each phase into exactly one request", async () => {
    answerCleanTurn();
    const result = await runJevTurn();
    expect(directorRuns(result)).toBe(true);
    // At most two phases: one gate request and one verification request.
    expect(jevRequests).toHaveLength(2);
    // Gates travel together in one map instead of one request each.
    expect(Object.keys(jevRequests[0]!)).toContain("smart_trigger");
    expect(Object.keys(jevRequests[1]!)).toContain("director_verification");
    expect(generations).toBe(1);
  });

  test("uses the configured strong Director model when Jev selects strong", async () => {
    stored.set("global/settings.json", { ...baseSettings, strongModelOverride: "strong-model", jev: jevSettings() });
    answerCleanTurn();
    const normalAnswer = jevAnswerFor;
    jevAnswerFor = (id) => id === "model_route"
      ? { type: "choice", choice: "strong", probabilities: { cheap: 0.02, strong: 0.98 }, confidence: 0.98 }
      : normalAnswer(id);
    await runJevTurn();
    expect(generatedModels).toContain("strong-model");
  });

  test("skips the Director and sends no verification request when Jev says no", async () => {
    jevAnswerFor = (gateId) => (gateId === "smart_trigger" ? { type: "noul", noul: 0.04 } : undefined);
    const result = await runJevTurn();
    expect(result).toBe(jevMessages);
    expect(generations).toBe(0);
    expect(jevRequests).toHaveLength(1);
    const run = latestRun();
    expect(run.status).toBe("skipped");
    expect(run.error).toMatch(/does not need Director intervention/i);
    expect(run.jev.used).toBe(true);
    expect(run.jev.status).toBe("skipped");
  });

  test("fails open and runs the Director when the proxy throws", async () => {
    corsShouldThrow = true;
    const result = await runJevTurn();
    expect(directorRuns(result)).toBe(true);
    expect(generations).toBe(1);
    const run = latestRun();
    expect(run.status).toBe("success");
    expect(run.jev.status).toBe("degraded");
    expect(run.jev.error).toMatch(/network unreachable/);
    const degradation = run.jev.gates.find((gate: any) => gate.gateId === "budget_degradation");
    expect(degradation.usedFallback).toBe(true);
    expect(degradation.fallback).toBe("run");
  });

  test("runs the Director ungated when no Jev key is stored", async () => {
    enclave.clear();
    const result = await runJevTurn();
    expect(directorRuns(result)).toBe(true);
    expect(jevRequests).toHaveLength(0);
    expect(generations).toBe(1);
    const run = latestRun();
    expect(run.jev.status).toBe("degraded");
    expect(run.jev.error).toMatch(/no jev api key/i);
  });

  test("does not consult Jev at all when Jev is disabled", async () => {
    stored.set("global/settings.json", { ...baseSettings, jev: jevSettings({ enabled: false }) });
    const result = await runJevTurn();
    expect(directorRuns(result)).toBe(true);
    expect(jevRequests).toHaveLength(0);
    expect(generations).toBe(1);
    expect(latestRun().jev).toBeNull();
  });

  test("repairs once when verification finds a violation, then re-verifies", async () => {
    answerCleanTurn();
    let verifications = 0;
    const clean = jevAnswerFor;
    jevAnswerFor = (gateId) => {
      if (gateId !== "director_verification") return clean(gateId);
      verifications += 1;
      return verifications === 1
        ? { type: "choice", choice: "violation", probabilities: { violation: 0.99, clean: 0.01 }, confidence: 0.99 }
        : { type: "choice", choice: "clean", probabilities: { clean: 0.95, violation: 0.05 }, confidence: 0.95 };
    };
    const result = await runJevTurn();
    expect(directorRuns(result)).toBe(true);
    // One Director call plus exactly one bounded repair regeneration.
    expect(generations).toBe(2);
    // gate, verify, re-verify.
    expect(jevRequests).toHaveLength(3);
    expect(latestRun().status).toBe("success");
  });

  test("never loops: a persistent violation stops after one repair", async () => {
    answerCleanTurn();
    const clean = jevAnswerFor;
    jevAnswerFor = (gateId) => (gateId === "director_verification"
      ? { type: "choice", choice: "violation", probabilities: { violation: 0.99, clean: 0.01 }, confidence: 0.99 }
      : clean(gateId));
    const result = await runJevTurn();
    expect(directorRuns(result)).toBe(true);
    expect(generations).toBe(2);
    expect(jevRequests).toHaveLength(3);
    expect(result.messages[0].content).toContain("[LumiWorld Director]");
  });

  test("records gate evidence including confidence and thresholds", async () => {
    answerCleanTurn();
    await runJevTurn();
    const run = latestRun();
    const trigger = run.jev.gates.find((gate: any) => gate.gateId === "smart_trigger");
    expect(trigger.value).toBe(true);
    expect(trigger.confidenceDerived).toBe(true);
    expect(trigger.confidence).toBeCloseTo(0.95, 5);
    expect(run.jev.requestCount).toBe(2);
    expect(run.jev.inputTokens).toBe(240);
    expect(run.jev.resolvedModel).toBe("jev-1.13.0");
    expect(run.jev.gates.some((gate: any) => gate.gateId === "confidence_escalation")).toBe(true);
  });

  test("stages scene state during interception and commits it after the reply lands", async () => {
    stored.set("global/settings.json", {
      ...baseSettings,
      jev: jevSettings({ gatePolicy: { scene_state_diff: { enabled: true } } }),
    });
    answerCleanTurn();
    beginGeneration("chat-state", "g1");
    await runJevTurn("chat-state");
    const path = "chats/chat-state/world.json";

    // Interception alone must not move the world: the reply has not landed yet.
    expect(stored.has(path)).toBe(false);

    emitEvent("GENERATION_ENDED", { generationId: "g1", chatId: "chat-state", messageId: "m1", content: "ok" }, "user-jev");
    expect(stored.has(path)).toBe(true);
    const state = stored.get(path) as any;
    expect(state.turn).toBe(1);
    expect(state.tension).toBe(3);
  });

  test("a late end from an older generation cannot commit the newer turn", async () => {
    stored.set("global/settings.json", {
      ...baseSettings,
      jev: jevSettings({ gatePolicy: { scene_state_diff: { enabled: true } } }),
    });
    answerCleanTurn();

    beginGeneration("chat-race", "gen-a");
    await runJevTurn("chat-race");
    beginGeneration("chat-race", "gen-b");
    await runJevTurn("chat-race");

    emitEvent("GENERATION_ENDED", { generationId: "gen-a", chatId: "chat-race", messageId: "m-a", content: "a" }, "user-jev");
    expect(stored.has("chats/chat-race/world.json")).toBe(false);

    emitEvent("GENERATION_ENDED", { generationId: "gen-b", chatId: "chat-race", messageId: "m-b", content: "b" }, "user-jev");
    expect((stored.get("chats/chat-race/world.json") as any).turn).toBe(1);
  });

  test("a late stop from an older generation cannot discard the newer turn", async () => {
    stored.set("global/settings.json", {
      ...baseSettings,
      jev: jevSettings({ gatePolicy: { scene_state_diff: { enabled: true } } }),
    });
    answerCleanTurn();
    beginGeneration("chat-stop-race", "gen-a");
    await runJevTurn("chat-stop-race");
    beginGeneration("chat-stop-race", "gen-b");
    await runJevTurn("chat-stop-race");

    emitEvent("GENERATION_STOPPED", { generationId: "gen-a", chatId: "chat-stop-race" }, "user-jev");
    emitEvent("GENERATION_ENDED", { generationId: "gen-b", chatId: "chat-stop-race", messageId: "m-b", content: "b" }, "user-jev");
    expect((stored.get("chats/chat-stop-race/world.json") as any).turn).toBe(1);
  });

  test("a duplicated end event for one generation commits once", async () => {
    stored.set("global/settings.json", {
      ...baseSettings,
      jev: jevSettings({ gatePolicy: { scene_state_diff: { enabled: true } } }),
    });
    answerCleanTurn();
    beginGeneration("chat-dup", "gen-dup");
    await runJevTurn("chat-dup");
    emitEvent("GENERATION_ENDED", { generationId: "gen-dup", chatId: "chat-dup", messageId: "m1", content: "ok" }, "user-jev");
    const first = (stored.get("chats/chat-dup/world.json") as any).turn;
    // A second report for the same generation must not advance the world again.
    emitEvent("GENERATION_ENDED", { generationId: "gen-dup", chatId: "chat-dup", messageId: "m1", content: "ok" }, "user-jev");
    expect((stored.get("chats/chat-dup/world.json") as any).turn).toBe(first);
  });

  test("a dry run never stages scene state", async () => {
    stored.set("global/settings.json", {
      ...baseSettings,
      jev: jevSettings({ gatePolicy: { scene_state_diff: { enabled: true } } }),
    });
    answerCleanTurn();
    await messageHandler!({ type: "refresh_state", chatId: "chat-dry" }, "user-jev");
    await interceptor!(jevMessages, { chatId: "chat-dry", generationType: "normal", dryRun: true });

    expect(stored.has("chats/chat-dry/world.json")).toBe(false);
    // Even after the host reports an end, nothing was staged to write.
    emitEvent("GENERATION_ENDED", { generationId: "g2", chatId: "chat-dry", messageId: "m2", content: "preview" });
    expect(stored.has("chats/chat-dry/world.json")).toBe(false);
  });

  test("does not commit scene state without a matching start event", async () => {
    stored.set("global/settings.json", {
      ...baseSettings,
      jev: jevSettings({ gatePolicy: { scene_state_diff: { enabled: true } } }),
    });
    answerCleanTurn();
    await runJevTurn("chat-unmatched");
    emitEvent("GENERATION_ENDED", {
      generationId: "unmatched", chatId: "chat-unmatched", messageId: "m-unmatched", content: "ok",
    }, "user-jev");
    expect(stored.has("chats/chat-unmatched/world.json")).toBe(false);
  });

  test("a failed generation discards its staged scene state", async () => {
    stored.set("global/settings.json", {
      ...baseSettings,
      jev: jevSettings({ gatePolicy: { scene_state_diff: { enabled: true } } }),
    });
    answerCleanTurn();
    beginGeneration("chat-fail", "g3");
    await runJevTurn("chat-fail");
    expect(stored.has("chats/chat-fail/world.json")).toBe(false);

    emitEvent("GENERATION_ENDED", { generationId: "g3", chatId: "chat-fail", error: "provider exploded" }, "user-jev");
    expect(stored.has("chats/chat-fail/world.json")).toBe(false);
  });

  test("a stopped generation discards its staged scene state", async () => {
    stored.set("global/settings.json", {
      ...baseSettings,
      jev: jevSettings({ gatePolicy: { scene_state_diff: { enabled: true } } }),
    });
    answerCleanTurn();
    beginGeneration("chat-stop", "g4");
    await runJevTurn("chat-stop");
    emitEvent("GENERATION_STOPPED", { generationId: "g4", chatId: "chat-stop" }, "user-jev");
    emitEvent("GENERATION_ENDED", { generationId: "g4", chatId: "chat-stop", messageId: "m4", content: "partial" }, "user-jev");
    expect(stored.has("chats/chat-stop/world.json")).toBe(false);
  });

  test("uses the host's per-generation user, not the last frontend user", async () => {
    answerCleanTurn();
    // The drawer identified user-A, then a generation arrives for user-B.
    await messageHandler!({ type: "refresh_state", chatId: "chat-a" }, "user-a");
    enclaveGetUsers = [];
    generateUsers = [];
    await interceptor!(jevMessages, {
      chatId: "chat-b", generationType: "normal", userId: "user-b",
    });

    // The Jev key must be read for the generation's own user...
    expect(enclaveGetUsers).toContain("user-b");
    expect(enclaveGetUsers).not.toContain("user-a");
    // ...and the Director must be called for that user too.
    expect(generateUsers).toContain("user-b");
    expect(generateUsers).not.toContain("user-a");
  });

  test("delivers World Info to the Director when the filter keeps it", async () => {
    stored.set("global/settings.json", { ...baseSettings, includeWorldInfoEntries: true, jev: jevSettings() });
    answerCleanTurn();
    let seen: any[] = [];
    // Capture the prompt the Director is actually handed.
    const originalRaw = (globalThis as any).spindle.generate.raw;
    (globalThis as any).spindle.generate.raw = async (input: any) => {
      seen = input.messages;
      return originalRaw(input);
    };
    await runJevTurn();
    (globalThis as any).spindle.generate.raw = originalRaw;

    const prompt = seen.map((m: any) => (typeof m.content === "string" ? m.content : "")).join("\n");
    // The entry text must reach the Director, not merely be fetched.
    expect(prompt).toContain("sealed with salt and iron");
    expect(prompt).toContain("The sealed hatch");
  });

  test("omits World Info from the Director prompt when the filter discards it", async () => {
    stored.set("global/settings.json", { ...baseSettings, includeWorldInfoEntries: true, jev: jevSettings() });
    answerCleanTurn();
    const clean = jevAnswerFor;
    jevAnswerFor = (gateId) => (gateId === "context_filter"
      ? { type: "choice", choice: "history_only", probabilities: { history_only: 0.9 }, confidence: 0.9 }
      : clean(gateId));
    let seen: any[] = [];
    const originalRaw = (globalThis as any).spindle.generate.raw;
    (globalThis as any).spindle.generate.raw = async (input: any) => {
      seen = input.messages;
      return originalRaw(input);
    };
    await runJevTurn();
    (globalThis as any).spindle.generate.raw = originalRaw;

    const prompt = seen.map((m: any) => (typeof m.content === "string" ? m.content : "")).join("\n");
    expect(prompt).not.toContain("sealed with salt and iron");
  });

  test("skips the World Info fetch when the filter gate discards lore", async () => {
    stored.set("global/settings.json", {
      ...baseSettings,
      includeWorldInfoEntries: true,
      jev: jevSettings(),
    });
    answerCleanTurn();
    const clean = jevAnswerFor;
    jevAnswerFor = (gateId) => (gateId === "context_filter"
      ? { type: "choice", choice: "history_only", probabilities: { history_only: 0.9 }, confidence: 0.9 }
      : clean(gateId));
    const result = await runJevTurn();
    expect(directorRuns(result)).toBe(true);
    // The gate said lore is irrelevant, so the expensive lookup never happens.
    expect(worldInfoFetches).toBe(0);
    expect(worldInfoEntryFetches).toBe(0);
  });

  test("still fetches World Info when the filter gate keeps it", async () => {
    stored.set("global/settings.json", {
      ...baseSettings,
      includeWorldInfoEntries: true,
      jev: jevSettings(),
    });
    answerCleanTurn();
    const result = await runJevTurn();
    expect(directorRuns(result)).toBe(true);
    expect(worldInfoFetches).toBe(1);
  });

  test("narrows context to the history only when the filter gate says so", async () => {
    stored.set("global/settings.json", {
      ...baseSettings,
      includeCharacter: true,
      includeUserPersona: true,
      jev: jevSettings(),
    });
    answerCleanTurn();
    const clean = jevAnswerFor;
    jevAnswerFor = (gateId) => (gateId === "context_filter"
      ? { type: "choice", choice: "history_only", probabilities: { history_only: 0.9 }, confidence: 0.9 }
      : clean(gateId));
    const result = await runJevTurn();
    expect(directorRuns(result)).toBe(true);
    expect(latestRun().status).toBe("success");
  });

  test("keeps the provider's documented fallbacks when the gate phase is inapplicable", async () => {
    stored.set("global/settings.json", {
      ...baseSettings,
      jev: jevSettings({ worldStateEnabled: false }),
    });
    answerCleanTurn();
    await runJevTurn();
    const run = latestRun();
    // The scene-state gates need persisted state, so they are omitted from the
    // batch rather than asked with nothing to answer against.
    expect(run.jev.gates.some((gate: any) => gate.gateId === "scene_state_diff")).toBe(false);
    expect(run.status).toBe("success");
  });
});

describe("v0.5 Jev drawer protocol", () => {
  beforeEach(() => {
    jevRequests.length = 0;
    sent.length = 0;
    corsShouldThrow = false;
    worldInfoFetches = 0;
    worldInfoEntryFetches = 0;
    jevAnswerFor = () => undefined;
    enclave.clear();
    stored.forEach((_value, key) => { if (key !== "global/runs.json") stored.delete(key); });
    stored.set("global/settings.json", { ...baseSettings, jev: jevSettings() });
    stored.set("global/runs.json", []);
  });

  test("tests the connection and stores the key on success", async () => {
    jevAnswerFor = () => ({ type: "noul", noul: 0.97 });
    await messageHandler!({ type: "test_jev", settings: { jev: jevSettings() }, apiKey: "fresh-key" }, "user-jev");
    const result = sent.find((message) => message.type === "jev_test_result");
    expect(result?.type).toBe("jev_test_result");
    if (result?.type === "jev_test_result" && result.ok) {
      expect(result.model).toBe("jev-1.13.0");
      expect(result.answer).toBe("yes");
      expect(result.provider).toBe("TypeSafe");
    } else {
      throw new Error("expected a successful Jev test");
    }
    expect(enclave.get("jev-api-key.typesafe")).toBe("fresh-key");
    sent.length = 0;
    await messageHandler!({ type: "refresh_state", chatId: "chat-jev" }, "user-jev");
    const reloaded = sent.find((message) => message.type === "state");
    expect(reloaded?.type === "state" && reloaded.state.hasJevKey).toBe(true);
  });

  test("does not store a key the provider rejected", async () => {
    corsShouldThrow = true;
    await messageHandler!({ type: "test_jev", settings: { jev: jevSettings() }, apiKey: "bad-key" }, "user-jev");
    const result = sent.find((message) => message.type === "jev_test_result");
    expect(result?.type === "jev_test_result" && result.ok).toBe(false);
    expect(enclave.has("jev-api-key.typesafe")).toBe(false);
  });

  test("reports a missing key without calling Jev", async () => {
    await messageHandler!({ type: "test_jev", settings: { jev: jevSettings() } }, "user-jev");
    const result = sent.find((message) => message.type === "jev_test_result");
    expect(result?.type === "jev_test_result" && result.ok).toBe(false);
    if (result?.type === "jev_test_result" && !result.ok) expect(result.error).toMatch(/no jev api key/i);
    expect(jevRequests).toHaveLength(0);
  });

  test("clears a stored key", async () => {
    enclave.set("jev-api-key.typesafe", "existing");
    await messageHandler!({ type: "clear_jev_key", provider: "typesafe" }, "user-jev");
    expect(enclave.has("jev-api-key.typesafe")).toBe(false);
  });

  test("reports gateway state without exposing the key", async () => {
    enclave.set("jev-api-key.typesafe", "existing");
    await messageHandler!({ type: "refresh_state", chatId: "chat-jev" }, "user-jev");
    const state = sent.find((message) => message.type === "state");
    expect(state?.type).toBe("state");
    if (state?.type !== "state") throw new Error("expected a state message");
    expect(state.state.hasJevKey).toBe(true);
    expect(state.state.jevProviderInfo.id).toBe("typesafe");
    expect(state.state.jevEndpoint).toBe("https://api.typesafe.ai/v1/systemone");
    expect(JSON.stringify(state.state)).not.toContain("existing");
  });
});
