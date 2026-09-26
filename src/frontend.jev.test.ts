import { beforeEach, describe, expect, test } from "bun:test";
import { JSDOM } from "jsdom";
import { DEFAULT_SETTINGS, JEV_PROVIDERS, type LumiWorldSettings } from "./shared";
import { GATE_CATALOG } from "./gates";
import type { BackendToFrontend, FrontendState, FrontendToBackend } from "./types";

const dom = new JSDOM("<!doctype html><html><body></body></html>");
(globalThis as any).window = dom.window;
(globalThis as any).document = dom.window.document;
(globalThis as any).HTMLElement = dom.window.HTMLElement;
(globalThis as any).HTMLInputElement = dom.window.HTMLInputElement;
(globalThis as any).HTMLTextAreaElement = dom.window.HTMLTextAreaElement;
(globalThis as any).HTMLSelectElement = dom.window.HTMLSelectElement;
(globalThis as any).HTMLButtonElement = dom.window.HTMLButtonElement;
(globalThis as any).Option = dom.window.Option;

// Imported lazily so the jsdom globals above exist before the module runs.
const frontendModule = require("./frontend") as typeof import("./frontend");
const setupDrawer: (typeof import("./frontend"))["setup"] = frontendModule.setup;

const settings = (patch: Partial<LumiWorldSettings> = {}): LumiWorldSettings => ({
  ...DEFAULT_SETTINGS,
  ...patch,
});

function makeState(patch: Partial<FrontendState> = {}): FrontendState {
  return {
    settings: settings(),
    connections: [{ id: "conn-1", name: "Director", provider: "mock", model: "mock-model", isDefault: true, hasApiKey: true }],
    connectionError: null,
    runs: [],
    permissions: {
      interceptor: true, generation: true, chats: true, characters: true,
      personas: true, worldBooks: true, corsProxy: true,
    },
    hasJevKey: false,
    jevProviderInfo: JEV_PROVIDERS.typesafe,
    jevEndpoint: "https://api.typesafe.ai/v1/systemone",
    activeGateCount: 0,
    ...patch,
  };
}

interface Harness {
  root: HTMLElement;
  sent: FrontendToBackend[];
  push: (message: BackendToFrontend) => void;
  /** Flushes the debounced settings save without waiting in real time. */
  advanceSave: () => void;
  destroy: () => void;
}

const realSetTimeout = globalThis.setTimeout;
/** Timer callbacks the drawer scheduled, so debounced saves can be flushed. */
let scheduled: Array<() => void> = [];

/**
 * Runs the drawer against instant timers. Autosave is debounced, so real-time
 * assertions on `save_settings` would otherwise race the clock.
 */
function instantTimers(): void {
  (globalThis as any).setTimeout = (handler: (...args: any[]) => void) => {
    scheduled.push(() => handler());
    return 0 as unknown as ReturnType<typeof setTimeout>;
  };
  (globalThis as any).clearTimeout = () => {};
}

function flushTimers(): void {
  const pending = scheduled;
  scheduled = [];
  for (const callback of pending) callback();
}

/** Mounts the real drawer against a minimal host surface. */
function mount(initial: FrontendState): Harness {
  instantTimers();
  const root = document.createElement("div");
  document.body.appendChild(root);
  const sent: FrontendToBackend[] = [];
  // The drawer only receives backend state after this handler is registered, so
  // the type is fixed up front instead of inferred from the initial null.
  let onBackendMessage: ((payload: unknown) => void) | null = null;
  const backendHandler = (payload: unknown): void => onBackendMessage?.(payload);
  const mounted: Array<{ destroy(): void }> = [];

  const ctx: any = {
    getActiveChat: () => ({ chatId: "chat-1", characterId: null }),
    sendToBackend: (message: FrontendToBackend) => { sent.push(message); },
    onBackendMessage: (handler: (payload: unknown) => void) => { onBackendMessage = handler; return () => {}; },
    events: { on: () => () => {} },
    dom: { addStyle: () => () => {} },
    log: { info: () => {}, warn: () => {}, error: () => {} },
    ui: {
      registerDrawerTab: () => ({ root, setBadge: () => {}, destroy: () => {} }),
    },
    components: {
      mountSwitch: (host: HTMLElement, options: { checked: boolean; ariaLabel: string; onChange: (value: boolean) => void }) => {
        const input = document.createElement("input");
        input.type = "checkbox";
        input.checked = options.checked;
        input.setAttribute("aria-label", options.ariaLabel);
        input.addEventListener("change", () => options.onChange(input.checked));
        host.replaceChildren(input);
        const handle = { destroy: () => {} };
        mounted.push(handle);
        return handle;
      },
    },
  };

  const destroy = setupDrawer(ctx);
  backendHandler({ type: "state", state: initial });
  return {
    root,
    sent,
    push: backendHandler,
    advanceSave: flushTimers,
    destroy: () => { destroy(); (globalThis as any).setTimeout = realSetTimeout; root.remove(); },
  };
}

/** Finds a rendered control by its accessible label. */
function labelled(root: HTMLElement, label: string): HTMLElement | null {
  return root.querySelector<HTMLElement>(`[aria-label="${label}"]`);
}

beforeEach(() => {
  if (!(globalThis as any).document) throw new Error("jsdom did not install a document");
  scheduled = [];
});

describe("Jev drawer section", () => {
  test("stays collapsed while Jev is disabled", () => {
    const harness = mount(makeState());
    expect(harness.root.textContent).toContain("Jev simulation");
    expect(harness.root.textContent).toContain("Director-only baseline");
    // No provider or key controls until the feature is switched on.
    expect(labelled(harness.root, "Jev provider")).toBeNull();
    expect(labelled(harness.root, "Jev API key")).toBeNull();
    harness.destroy();
  });

  test("reveals the provider and key controls once enabled", () => {
    const harness = mount(makeState({ settings: settings({ jev: { ...DEFAULT_SETTINGS.jev, enabled: true } }) }));
    const provider = labelled(harness.root, "Jev provider") as HTMLSelectElement;
    expect(provider).not.toBeNull();
    expect([...provider.options].map((option) => option.value)).toEqual(["typesafe", "openrouter"]);
    expect(labelled(harness.root, "Jev API key")).not.toBeNull();
    expect(harness.root.textContent).toContain("https://console.typesafe.ai/keys");
    expect(harness.root.textContent).toContain("Not set");
    harness.destroy();
  });

  test("shows the OpenRouter guidance when that provider is selected", () => {
    const harness = mount(makeState({
      settings: settings({ jev: { ...DEFAULT_SETTINGS.jev, enabled: true, provider: "openrouter" } }),
      jevProviderInfo: JEV_PROVIDERS.openrouter,
    }));
    expect(harness.root.textContent).toContain("https://openrouter.ai/settings/keys");
    expect(harness.root.textContent).toContain("Leave blank to use typesafe/jev-1.13");
    const provider = labelled(harness.root, "Jev provider") as HTMLSelectElement;
    expect(provider.value).toBe("openrouter");
    harness.destroy();
  });

  test("never renders the stored key value", () => {
    const harness = mount(makeState({
      hasJevKey: true,
      settings: settings({ jev: { ...DEFAULT_SETTINGS.jev, enabled: true } }),
    }));
    const key = labelled(harness.root, "Jev API key") as HTMLInputElement;
    expect(key.type).toBe("password");
    expect(key.value).toBe("");
    expect(harness.root.textContent).toContain("Stored");
    harness.destroy();
  });

  test("sends the typed key with a test request and clears it afterwards", () => {
    const harness = mount(makeState({
      settings: settings({ jev: { ...DEFAULT_SETTINGS.jev, enabled: true } }),
    }));
    const key = labelled(harness.root, "Jev API key") as HTMLInputElement;
    key.value = "secret-key";
    key.dispatchEvent(new dom.window.Event("input"));
    const test = harness.root.querySelector<HTMLButtonElement>("[data-lw-jev-test]")!;
    expect(test.disabled).toBe(false);
    test.click();
    const message = harness.sent.find((entry) => entry.type === "test_jev");
    expect(message?.type).toBe("test_jev");
    if (message?.type === "test_jev") expect(message.apiKey).toBe("secret-key");
    expect(JSON.stringify(harness.root.innerHTML)).not.toContain("secret-key");
    harness.destroy();
  });

  test("disables the Jev test without the cors_proxy permission", () => {
    const harness = mount(makeState({
      settings: settings({ jev: { ...DEFAULT_SETTINGS.jev, enabled: true } }),
      permissions: {
        interceptor: true, generation: true, chats: true, characters: true,
        personas: true, worldBooks: true, corsProxy: false,
      },
    }));
    const test = harness.root.querySelector<HTMLButtonElement>("[data-lw-jev-test]")!;
    expect(test.disabled).toBe(true);
    harness.destroy();
  });

  test("reports a Jev test result in the notice area", () => {
    const harness = mount(makeState({ settings: settings({ jev: { ...DEFAULT_SETTINGS.jev, enabled: true } }) }));
    harness.push({
      type: "jev_test_result", ok: true, latencyMs: 120, model: "jev-1.13.0",
      provider: "TypeSafe", answer: "yes", confidence: 0.98,
    });
    expect(harness.root.textContent).toContain("Jev answered on TypeSafe / jev-1.13.0");
    harness.push({ type: "jev_test_result", ok: false, error: "HTTP 401 Unauthorized" });
    expect(harness.root.textContent).toContain("HTTP 401 Unauthorized");
    harness.destroy();
  });
});

describe("Jev gates editor", () => {
  test("renders every catalog gate grouped by category", () => {
    const harness = mount(makeState({ settings: settings({ jev: { ...DEFAULT_SETTINGS.jev, enabled: true } }) }));
    // The gates editor is a collapsed <details>; its rows are still in the DOM.
    for (const definition of GATE_CATALOG) {
      const row = harness.root.querySelector(`[data-lw-gate="${definition.id}"]`);
      expect(row, `missing gate row for ${definition.id}`).not.toBeNull();
      expect(row!.textContent).toContain(definition.label);
    }
    expect(harness.root.textContent).toContain("Director control");
    expect(harness.root.textContent).toContain("Guardrails");
    expect(harness.root.textContent).toContain("State accuracy");
    expect(harness.root.textContent).toContain("Narrative direction");
    expect(harness.root.textContent).toContain("World progression");
    harness.destroy();
  });

  test("reflects core-loop defaults in the toggles and the count", () => {
    const harness = mount(makeState({ settings: settings({ jev: { ...DEFAULT_SETTINGS.jev, enabled: true } }) }));
    const smartTrigger = harness.root.querySelector<HTMLInputElement>('[data-lw-gate="smart_trigger"] input[type="checkbox"]')!;
    const callback = harness.root.querySelector<HTMLInputElement>('[data-lw-gate="callback"] input[type="checkbox"]')!;
    expect(smartTrigger.checked).toBe(true);
    expect(callback.checked).toBe(false);
    const enabled = GATE_CATALOG.filter((definition) => definition.enabledByDefault).length;
    expect(harness.root.textContent).toContain(`${enabled} of ${GATE_CATALOG.length} enabled`);
    harness.destroy();
  });

  test("writes a sparse gate override when a toggle changes", () => {
    const harness = mount(makeState({ settings: settings({ jev: { ...DEFAULT_SETTINGS.jev, enabled: true } }) }));
    const toggle = harness.root.querySelector<HTMLInputElement>('[data-lw-gate="callback"] input[type="checkbox"]')!;
    toggle.checked = true;
    toggle.dispatchEvent(new dom.window.Event("change"));
    // Settings saves are debounced.
    harness.advanceSave();
    const save = harness.sent.filter((entry) => entry.type === "save_settings").pop();
    expect(save?.type).toBe("save_settings");
    if (save?.type === "save_settings") {
      expect(save.settings.jev?.gatePolicy.callback).toEqual({ enabled: true });
      expect(save.settings.jev?.gatePolicy.smart_trigger).toBeUndefined();
    }
    harness.destroy();
  });

  test("preserves an existing override when only the threshold changes", () => {
    const harness = mount(makeState({
      settings: settings({
        jev: { ...DEFAULT_SETTINGS.jev, enabled: true, gatePolicy: { callback: { enabled: true } } },
      }),
    }));
    const threshold = labelled(harness.root, "Callback threshold") as HTMLInputElement;
    threshold.value = "0.8";
    threshold.dispatchEvent(new dom.window.Event("change"));
    harness.advanceSave();
    const save = harness.sent.filter((entry) => entry.type === "save_settings").pop();
    expect(save?.type).toBe("save_settings");
    if (save?.type === "save_settings") {
      expect(save.settings.jev?.gatePolicy.callback).toEqual({ enabled: true, threshold: 0.8 });
    }
    harness.destroy();
  });

  test("offers every declared fallback for a gate", () => {
    const harness = mount(makeState({ settings: settings({ jev: { ...DEFAULT_SETTINGS.jev, enabled: true } }) }));
    const fallback = labelled(harness.root, "Continuity guard fallback") as HTMLSelectElement;
    expect(fallback).not.toBeNull();
    expect([...fallback.options].map((option) => option.value)).toContain("soften");
    expect([...fallback.options].map((option) => option.value)).toContain("run");
    expect(fallback.value).toBe("soften");
    harness.destroy();
  });
});

describe("Jev diagnostics panel", () => {
  const jevRun = {
    used: true,
    enabled: true,
    provider: "typesafe" as const,
    model: "jev-latest",
    resolvedModel: "jev-1.13.0",
    status: "ok" as const,
    error: null,
    requestCount: 2,
    inputTokens: 240,
    outputTokens: 24,
    costUsd: null,
    gatePhaseMs: 120,
    verifyPhaseMs: 90,
    gateCount: 2,
    fallbackCount: 1,
    escalatedCount: 1,
    stateChars: 900,
    stateCompacted: false,
    gates: [
      {
        gateId: "smart_trigger", label: "Smart Director triggering", primitive: "noul" as const, phase: "gate" as const,
        value: true, probability: 0.95, confidence: 0.95, confidenceDerived: true,
        threshold: 0.6, escalated: false, usedFallback: false, fallback: "run" as const,
      },
      {
        gateId: "continuity_guard", label: "Continuity guard", primitive: "choice" as const, phase: "verify" as const,
        value: "violation", probability: 0.8, confidence: 0.3, confidenceDerived: false,
        threshold: 0.5, escalated: true, usedFallback: true, fallback: "soften" as const,
        note: "Confidence 0.30 is below the 0.50 floor, so the fallback applied.",
      },
    ],
  };

  test("explains that no decisions exist yet", () => {
    const harness = mount(makeState());
    expect(harness.root.textContent).toContain("Last turn decisions");
    expect(harness.root.textContent).toContain("No Jev decisions recorded yet");
    harness.destroy();
  });

  test("renders each gate outcome with its confidence and fallback", () => {
    const harness = mount(makeState({
      runs: [{ id: "run-1", timestamp: 1, status: "success", channel: "director", jev: jevRun }],
    }));
    const root = harness.root;
    expect(root.textContent).toContain("2 gates");
    expect(root.textContent).toContain("2 requests");
    expect(root.textContent).toContain("1 fallback");
    expect(root.textContent).toContain("1 escalated");
    expect(root.textContent).toContain("Smart Director triggering");
    expect(root.textContent).toContain("Continuity guard");
    // A derived Noul confidence is marked so it is not read as model-reported.
    expect(root.textContent).toContain("~0.95");
    expect(root.textContent).toContain("fallback: Soften the directive");
    expect(root.textContent).toContain("below 0.50");
    const flagged = root.querySelector('[data-flag="true"]');
    expect(flagged?.textContent).toContain("Continuity guard");
    harness.destroy();
  });

  test("surfaces a degraded turn and its error", () => {
    const harness = mount(makeState({
      runs: [{
        id: "run-2", timestamp: 2, status: "success", channel: "director",
        jev: { ...jevRun, status: "degraded" as const, error: "network unreachable", resolvedModel: null },
      }],
    }));
    expect(harness.root.textContent).toContain("Degraded");
    expect(harness.root.textContent).toContain("network unreachable");
    harness.destroy();
  });

  test("shows the newest run that has Jev diagnostics", () => {
    const harness = mount(makeState({
      runs: [
        { id: "run-new", timestamp: 2, status: "success", channel: "director" },
        { id: "run-old", timestamp: 1, status: "success", channel: "director", jev: jevRun },
      ],
    }));
    expect(harness.root.textContent).toContain("2 gates");
    harness.destroy();
  });
});
