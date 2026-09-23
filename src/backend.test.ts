import { describe, expect, test } from "bun:test";
import { DEFAULT_SETTINGS } from "./shared";
import type { BackendToFrontend, FrontendToBackend } from "./types";

type Interceptor = (messages: any[], context: unknown) => Promise<any>;
type MessageHandler = (message: FrontendToBackend, userId: string) => Promise<void>;

const stored = new Map<string, unknown>([
  ["global/settings.json", {
    ...DEFAULT_SETTINGS,
    enabled: true,
    connectionId: "director-connection",
    includeCharacter: false,
    includeUserPersona: false,
    worldAgent: { enabled: true, injectState: true, connectionId: "old-world" },
  }],
  ["global/runs.json", [
    { id: "old-world-run", timestamp: 1, status: "success", channel: "world_agent", worldAgentDay: 4, legacyDetail: "keep" },
  ]],
]);
const sent: BackendToFrontend[] = [];
let interceptor: Interceptor | null = null;
let messageHandler: MessageHandler | null = null;
let generations = 0;
let rpcPublications = 0;
let failNextSettingsSave = false;

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
  connections: {
    list: async () => [{ id: "director-connection", name: "Director", provider: "mock", model: "mock-model", has_api_key: true }],
    get: async (id: string) => id === "director-connection"
      ? { id, name: "Director", provider: "mock", model: "mock-model", has_api_key: true } : null,
  },
  permissions: { has: () => true, onChanged: () => {}, onDenied: () => {} },
  personas: { getActive: async () => null },
  chats: { get: async () => null },
  world_books: {},
  generate: { raw: async () => { generations++; return { choices: [{ message: { content: '{"director_note":"Make the storm intensify."}' } }] }; } },
  rpcPool: { sync: () => { rpcPublications++; } },
  log: { info: () => {}, warn: () => {}, error: () => {} },
  sendToFrontend: (message: BackendToFrontend) => { sent.push(message); },
  registerInterceptor: (handler: Interceptor) => { interceptor = handler; },
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
