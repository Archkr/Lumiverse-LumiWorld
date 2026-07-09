import { describe, expect, test } from "bun:test";
import { normalizeFrontendSettings, SettingsSaveQueue } from "./frontend";

describe("frontend settings contract", () => {
  test("keeps the Director timeout aligned with Lumiverse's interceptor ceiling", () => {
    const settings = normalizeFrontendSettings({ timeoutMs: 900000, worldAgent: { timeoutMs: 900000 } });
    expect(settings.timeoutMs).toBe(300000);
    expect(settings.worldAgent.timeoutMs).toBe(900000);
  });

  test("keeps World Agent history and context settings independent", () => {
    const settings = normalizeFrontendSettings({
      worldAgent: { historyMessageLimit: 33, includeUserPersona: false, includeCharacter: false },
    });
    expect(settings.worldAgent.historyMessageLimit).toBe(33);
    expect(settings.worldAgent.includeUserPersona).toBe(false);
    expect(settings.worldAgent.includeCharacter).toBe(false);
  });
});

describe("serialized autosave queue", () => {
  test("does not dispatch a second write until the first acknowledgement arrives", () => {
    const queue = new SettingsSaveQueue();
    queue.markDirty();
    expect(queue.begin()).toBe(1);
    queue.markDirty();
    expect(queue.begin()).toBeNull();
    expect(queue.acknowledge()).toBe(true);
    expect(queue.begin()).toBe(2);
    expect(queue.acknowledge()).toBe(false);
  });
});
