import { describe, expect, test } from "bun:test";
import { makeWorldLumiStateSnapshot } from "./lumi-state";
import { makeDefaultWorldAgentState, normalizeWorldAgentState } from "./shared";

describe("LumiState world publisher", () => {
  test("publishes only the simulation clock", () => {
    const state = makeDefaultWorldAgentState("chat-1", { characterId: "char-1", personaId: "persona-1" });
    Object.assign(state, {
      revision: 12,
      day: 4,
      hour: 19,
      running: true,
      location: "Secret bunker",
      mood: "Afraid",
      activity: "Hiding",
      thought: "Nobody can know.",
      goal: "Escape unseen.",
      schedule: [{ hour: 19, activity: "Hiding", location: "Secret bunker" }],
      updatedAt: 1000,
    });

    const snapshot = makeWorldLumiStateSnapshot("chat-1", state, "0.3.2", 2000);
    expect(snapshot).toMatchObject({
      protocol: "lumi_state.v1",
      schemaVersion: 1,
      chatId: "chat-1",
      revision: 12,
      freshness: "fresh",
      updatedAt: 1000,
    });
    expect(snapshot.state.times[0]).toMatchObject({ clock: "simulation", day: 4, hour: 19, running: true });
    expect(snapshot.state.locations).toEqual([]);
    expect(JSON.stringify(snapshot)).not.toContain("Secret bunker");
    expect(JSON.stringify(snapshot)).not.toContain("Nobody can know");
    expect(JSON.stringify(snapshot)).not.toContain("Escape unseen");
  });

  test("does not fabricate a default world state", () => {
    const snapshot = makeWorldLumiStateSnapshot("chat-1", null, "0.3.2", 2000);
    expect(snapshot.chatId).toBe("chat-1");
    expect(snapshot.revision).toBe(0);
    expect(snapshot.freshness).toBe("unavailable");
    expect(snapshot.state.times).toEqual([]);
  });

  test("migrates legacy persisted state to a monotonic revision baseline", () => {
    const legacy = normalizeWorldAgentState({ chatId: "chat-1", day: 2, hour: 11, updatedAt: 12345 }, "chat-1");
    expect(legacy.schemaVersion).toBe(1);
    expect(legacy.revision).toBe(12345);
    expect(makeDefaultWorldAgentState("new-chat").revision).toBe(0);
  });
});
