import { describe, expect, test } from "bun:test";
import { directorRuns, normalizeFrontendSettings, SettingsSaveQueue } from "./frontend";
import type { RunLogEntry } from "./shared";

describe("Director settings", () => {
  test("clamps timeout to Lumiverse's interceptor ceiling", () => {
    expect(normalizeFrontendSettings({ timeoutMs: 900000 }).timeoutMs).toBe(300000);
  });

  test("keeps an explicit empty generation selection", () => {
    expect(normalizeFrontendSettings({ generationTypes: [] }).generationTypes).toEqual([]);
  });

  test("ignores legacy World Agent settings", () => {
    const settings = normalizeFrontendSettings({ connectionId: "director", worldAgent: { enabled: true } });
    expect(settings.connectionId).toBe("director");
    expect("worldAgent" in settings).toBe(false);
  });
});

describe("serialized autosave queue", () => {
  test("sends newer edits after the previous acknowledgement", () => {
    const queue = new SettingsSaveQueue();
    queue.markDirty();
    expect(queue.begin()).toBe(1);
    queue.markDirty();
    expect(queue.begin()).toBeNull();
    expect(queue.acknowledge(1)).toBe(true);
    expect(queue.begin()).toBe(2);
    expect(queue.acknowledge(2)).toBe(false);
    expect(queue.isDirty).toBe(false);
  });

  test("retains the unsaved revision for retry after failure", () => {
    const queue = new SettingsSaveQueue();
    queue.markDirty();
    expect(queue.begin()).toBe(1);
    expect(queue.fail(1)).toBe(true);
    expect(queue.isDirty).toBe(true);
    expect(queue.begin()).toBe(1);
    expect(queue.acknowledge(1)).toBe(false);
  });

  test("ignores stale acknowledgements", () => {
    const queue = new SettingsSaveQueue();
    queue.markDirty();
    expect(queue.begin()).toBe(1);
    queue.fail(1);
    queue.markDirty();
    expect(queue.begin()).toBe(2);
    expect(queue.acknowledge(1)).toBe(true);
    expect(queue.isInFlight).toBe(true);
    expect(queue.acknowledge(2)).toBe(false);
  });
});

describe("Director activity", () => {
  test("filters historical World Agent runs without deleting them", () => {
    const runs: RunLogEntry[] = [
      { id: "world", timestamp: 3, status: "success", channel: "world_agent" },
      { id: "director", timestamp: 2, status: "success", channel: "director" },
      { id: "legacy", timestamp: 1, status: "test_success" },
    ];
    expect(directorRuns(runs).map((run) => run.id)).toEqual(["director", "legacy"]);
    expect(runs).toHaveLength(3);
  });
});
