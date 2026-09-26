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

/** The provider picker is a segmented group, not a dropdown. */
function providerSegments(root: HTMLElement): HTMLButtonElement[] {
  return [...root.querySelectorAll<HTMLButtonElement>('[aria-label="Jev provider"] .lw-segment')];
}

function apiKeyLink(root: HTMLElement): HTMLAnchorElement | null {
  return root.querySelector<HTMLAnchorElement>(".lw-provider-note a");
}

/** Gate cards are collapsed to one scannable line until their caret is opened. */
function expandGate(root: HTMLElement, gateId: string): void {
  const card = root.querySelector<HTMLElement>(`[data-lw-gate="${gateId}"]`);
  if (!card) throw new Error(`no gate card for ${gateId}`);
  const caret = card.querySelector<HTMLButtonElement>(".lw-gate-caret");
  if (!caret) throw new Error(`no caret for ${gateId}`);
  caret.click();
}

beforeEach(() => {
  if (!(globalThis as any).document) throw new Error("jsdom did not install a document");
  scheduled = [];
});

describe("Jev drawer section", () => {
  test("stays collapsed while Jev is disabled", () => {
    const harness = mount(makeState());
    expect(harness.root.textContent).toContain("Jev decides whether a turn needs the Director");
    expect(harness.root.textContent).toContain("Director-only baseline");
    // No provider or key controls until the feature is switched on.
    expect(labelled(harness.root, "Jev provider")).toBeNull();
    expect(labelled(harness.root, "Jev API key")).toBeNull();
    harness.destroy();
  });

  test("reveals the provider and key controls once enabled", () => {
    const harness = mount(makeState({ settings: settings({ jev: { ...DEFAULT_SETTINGS.jev, enabled: true } }) }));
    const segments = providerSegments(harness.root);
    expect(segments.map((node) => node.textContent)).toEqual(["TypeSafe", "OpenRouter"]);
    // The active provider is exposed as a pressed state, not a dropdown value.
    expect(segments[0]!.getAttribute("aria-pressed")).toBe("true");
    expect(segments[1]!.getAttribute("aria-pressed")).toBe("false");
    expect(labelled(harness.root, "Jev API key")).not.toBeNull();
    expect(apiKeyLink(harness.root)?.href).toBe("https://console.typesafe.ai/keys");
    expect(harness.root.textContent).toContain("Not set");
    harness.destroy();
  });

  test("shows the OpenRouter guidance when that provider is selected", () => {
    const harness = mount(makeState({
      settings: settings({ jev: { ...DEFAULT_SETTINGS.jev, enabled: true, provider: "openrouter" } }),
      jevProviderInfo: JEV_PROVIDERS.openrouter,
    }));
    expect(apiKeyLink(harness.root)?.href).toBe("https://openrouter.ai/settings/keys");
    expect(harness.root.textContent).toContain("Blank uses typesafe/jev-1.13");
    const segments = providerSegments(harness.root);
    expect(segments[1]!.getAttribute("aria-pressed")).toBe("true");
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

describe("drawer views", () => {
  function views(root: HTMLElement): Record<string, HTMLElement> {
    const director = root.querySelector<HTMLElement>('[data-lw-view="director"]')!;
    const jev = root.querySelector<HTMLElement>('[data-lw-view="jev"]')!;
    return { director, jev };
  }

  function tabs(root: HTMLElement): HTMLButtonElement[] {
    return [...root.querySelectorAll<HTMLButtonElement>('[role="tab"]')];
  }

  test("registers exactly two views inside the single drawer tab", () => {
    const harness = mount(makeState());
    const list = harness.root.querySelector('[role="tablist"]');
    expect(list).not.toBeNull();
    expect(tabs(harness.root).map((tab) => tab.textContent)).toEqual(["Director", "Jev"]);
    expect(harness.root.querySelectorAll("[data-lw-view]")).toHaveLength(2);
    harness.destroy();
  });

  test("opens on Director and switches to Jev on click", () => {
    const harness = mount(makeState());
    const { director, jev } = views(harness.root);
    expect(director.hidden).toBe(false);
    expect(jev.hidden).toBe(true);

    tabs(harness.root)[1]!.click();
    expect(views(harness.root).director.hidden).toBe(true);
    expect(views(harness.root).jev.hidden).toBe(false);
    harness.destroy();
  });

  test("keeps exactly one tab selected and focusable", () => {
    const harness = mount(makeState());
    const selected = () => tabs(harness.root).map((tab) => tab.getAttribute("aria-selected"));
    expect(selected()).toEqual(["true", "false"]);
    tabs(harness.root)[1]!.click();
    expect(tabs(harness.root).map((tab) => tab.getAttribute("aria-selected"))).toEqual(["false", "true"]);
    expect(tabs(harness.root).map((tab) => tab.tabIndex)).toEqual([-1, 0]);
    harness.destroy();
  });

  test("moves between views with the arrow keys", () => {
    const harness = mount(makeState());
    const first = tabs(harness.root)[0]!;
    first.dispatchEvent(new dom.window.KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
    expect(views(harness.root).jev.hidden).toBe(false);
    tabs(harness.root)[1]!.dispatchEvent(new dom.window.KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true }));
    expect(views(harness.root).director.hidden).toBe(false);
    harness.destroy();
  });

  test("keeps a typed Jev key when switching views", () => {
    const harness = mount(makeState({ settings: settings({ jev: { ...DEFAULT_SETTINGS.jev, enabled: true } }) }));
    const key = labelled(harness.root, "Jev API key") as HTMLInputElement;
    key.value = "half-typed";
    key.dispatchEvent(new dom.window.Event("input"));

    tabs(harness.root)[0]!.click();
    tabs(harness.root)[1]!.click();

    const after = labelled(harness.root, "Jev API key") as HTMLInputElement;
    expect(after.value).toBe("half-typed");
    harness.destroy();
  });

  test("keeps Director settings out of the Jev view", () => {
    const harness = mount(makeState({ settings: settings({ jev: { ...DEFAULT_SETTINGS.jev, enabled: true } }) }));
    const { director, jev } = views(harness.root);
    expect(director.textContent).toContain("Run before");
    expect(jev.textContent).not.toContain("Run before");

    // Both views label a block "Advanced settings", so separate them by the
    // controls each one owns: Director's sampler vs Jev's request shape.
    const within = (view: HTMLElement, label: string) => view.querySelector(`[aria-label="${label}"]`);
    expect(within(director, "Temperature")).not.toBeNull();
    expect(within(jev, "Temperature")).toBeNull();
    expect(within(jev, "Jev state cap")).not.toBeNull();
    expect(within(director, "Jev state cap")).toBeNull();
    expect(jev.textContent).toContain("Jev gates");
    harness.destroy();
  });

  test("re-targets the master toggle when the view changes", () => {
    const harness = mount(makeState({
      settings: settings({ enabled: true, jev: { ...DEFAULT_SETTINGS.jev, enabled: false } }),
    }));
    // The header owns one master switch, and it follows the active view.
    expect(labelled(harness.root, "Enable Director")).not.toBeNull();
    expect(labelled(harness.root, "Enable Jev")).toBeNull();

    tabs(harness.root)[1]!.click();
    expect(labelled(harness.root, "Enable Jev")).not.toBeNull();
    expect(labelled(harness.root, "Enable Director")).toBeNull();
    harness.destroy();
  });

  test("registers the header switch exactly once per view", () => {
    const harness = mount(makeState({ settings: settings({ jev: { ...DEFAULT_SETTINGS.jev, enabled: true } }) }));
    const headerSwitches = harness.root.querySelectorAll('.lw-header input[type="checkbox"]');
    expect(headerSwitches).toHaveLength(1);
    // The Jev panel must not duplicate the master toggle.
    expect(harness.root.querySelectorAll('[aria-label="Use Jev gates"]')).toHaveLength(0);
    harness.destroy();
  });

  test("shows the active view's state in the header status line", () => {
    const harness = mount(makeState({
      hasJevKey: true,
      settings: settings({ enabled: true, jev: { ...DEFAULT_SETTINGS.jev, enabled: true } }),
    }));
    const status = () => harness.root.querySelector<HTMLElement>("[data-lw-header-status]")!;
    expect(status().textContent).toBe("Setup needed");
    tabs(harness.root)[1]!.click();
    expect(status().textContent).toBe("Ready");
    tabs(harness.root)[0]!.click();
    expect(status().textContent).toBe("Setup needed");
    harness.destroy();
  });

  test("renders exactly one brand, title, and status in the header", () => {
    const harness = mount(makeState());
    // The header is built once and re-attached, so nothing may be duplicated.
    expect(harness.root.querySelectorAll(".lw-header")).toHaveLength(1);
    expect(harness.root.querySelectorAll(".lw-brand")).toHaveLength(1);
    expect(harness.root.querySelectorAll(".lw-title")).toHaveLength(1);
    expect(harness.root.querySelectorAll(".lw-icon")).toHaveLength(1);
    expect(harness.root.querySelectorAll("[data-lw-header-status]")).toHaveLength(1);
    harness.destroy();
  });

  test("survives a re-render without duplicating the header", () => {
    const state = makeState({ settings: settings({ enabled: true }) });
    const harness = mount(state);
    // Backend state pushes re-render the drawer, which is the normal case.
    harness.push({ type: "state", state });
    harness.push({ type: "state", state });
    expect(harness.root.querySelectorAll(".lw-brand")).toHaveLength(1);
    expect(harness.root.querySelectorAll(".lw-title")).toHaveLength(1);
    expect(harness.root.querySelectorAll('.lw-header input[type="checkbox"]')).toHaveLength(1);
    harness.destroy();
  });

  test("keeps one header switch across a view switch and a re-render", () => {
    const state = makeState({ settings: settings({ jev: { ...DEFAULT_SETTINGS.jev, enabled: true } }) });
    const harness = mount(state);
    tabs(harness.root)[1]!.click();
    harness.push({ type: "state", state });
    expect(harness.root.querySelectorAll(".lw-header")).toHaveLength(1);
    expect(harness.root.querySelectorAll('.lw-header input[type="checkbox"]')).toHaveLength(1);
    expect(labelled(harness.root, "Enable Jev")).not.toBeNull();
    harness.destroy();
  });

  test("re-points the tagline when the view changes", () => {
    const harness = mount(makeState());
    const intro = () => harness.root.querySelector<HTMLElement>("[data-lw-intro]")!;
    expect(intro().textContent).toContain("private Director note");
    tabs(harness.root)[1]!.click();
    expect(intro().textContent).toContain("Gate the Director");
    expect(intro().textContent).not.toContain("private Director note");
    harness.destroy();
  });

  test("names the header after the active view", () => {
    const harness = mount(makeState());
    const title = () => harness.root.querySelector(".lw-title")!.textContent;
    expect(title()).toBe("Director");
    tabs(harness.root)[1]!.click();
    expect(title()).toBe("Jev");
    harness.destroy();
  });

  test("shows the Jev status pill in the view header", () => {
    const harness = mount(makeState({
      hasJevKey: true,
      settings: settings({ jev: { ...DEFAULT_SETTINGS.jev, enabled: true } }),
    }));
    const slot = harness.root.querySelector<HTMLElement>("[data-lw-jev-status]")!;
    expect(slot.textContent).toContain("Ready");
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
      // Collapsed cards carry the shape but not the floor/fallback controls.
      expect(row!.querySelector(`[aria-label="${definition.label} fallback"]`)).toBeNull();
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
    expect(harness.root.textContent).toContain(`${enabled}/${GATE_CATALOG.length}`);
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
    expandGate(harness.root, "callback");
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

  test("expands one gate sheet at a time without touching the others", () => {
    const harness = mount(makeState({ settings: settings({ jev: { ...DEFAULT_SETTINGS.jev, enabled: true } }) }));
    const card = () => harness.root.querySelector<HTMLElement>('[data-lw-gate="callback"]')!;
    expect(card().dataset.open).toBe("false");
    expandGate(harness.root, "callback");
    expect(card().dataset.open).toBe("true");
    expect(labelled(harness.root, "Callback fallback")).not.toBeNull();
    // Opening a second gate must not disturb the first.
    expandGate(harness.root, "foreshadowing");
    expect(card().dataset.open).toBe("true");
    const closed = harness.root.querySelector<HTMLElement>('[data-lw-gate="foreshadowing"]')!;
    expect(closed.dataset.open).toBe("true");
    harness.destroy();
  });

  test("marks a hand-tuned gate as custom and clears it on reset", () => {
    const harness = mount(makeState({
      settings: settings({
        jev: { ...DEFAULT_SETTINGS.jev, enabled: true, gatePolicy: { callback: { enabled: true, threshold: 0.9 } } },
      }),
    }));
    const card = () => harness.root.querySelector<HTMLElement>('[data-lw-gate="callback"]')!;
    expect(card().dataset.custom).toBe("true");
    expandGate(harness.root, "callback");
    const reset = card().querySelector<HTMLButtonElement>(".lw-gate-reset")!;
    expect(reset).not.toBeNull();
    reset.click();
    expect(card().dataset.custom).toBe("false");
    const save = harness.sent.filter((entry) => entry.type === "save_settings").pop();
    if (save?.type === "save_settings") expect(save.settings.jev?.gatePolicy.callback).toBeUndefined();
    harness.destroy();
  });

  test("toggles every gate in a category at once", () => {
    const harness = mount(makeState({ settings: settings({ jev: { ...DEFAULT_SETTINGS.jev, enabled: true } }) }));
    // Narrative direction ships entirely off, so the bulk action turns it on.
    const narrativeHead = [...harness.root.querySelectorAll<HTMLElement>(".lw-cat-head")]
      .find((head) => head.textContent?.includes("Narrative direction"))!;
    expect(narrativeHead.textContent).toContain("0/5");
    const bulk = narrativeHead.querySelector<HTMLButtonElement>("button")!;
    expect(bulk.textContent).toBe("Enable all");
    bulk.click();
    harness.advanceSave();
    const save = harness.sent.filter((entry) => entry.type === "save_settings").pop();
    expect(save?.type).toBe("save_settings");
    if (save?.type === "save_settings") {
      for (const id of ["emotional_release", "foreshadowing", "callback", "hook_prioritization", "context_compaction"]) {
        expect(save.settings.jev?.gatePolicy[id]?.enabled).toBe(true);
      }
      // Only the acted-on category is written.
      expect(save.settings.jev?.gatePolicy.smart_trigger).toBeUndefined();
    }
    harness.destroy();
  });

  test("offers a single reset once any gate has been changed", () => {
    const clean = mount(makeState({ settings: settings({ jev: { ...DEFAULT_SETTINGS.jev, enabled: true } }) }));
    expect(clean.root.textContent).not.toContain("to defaults");
    clean.destroy();

    const tuned = mount(makeState({
      settings: settings({ jev: { ...DEFAULT_SETTINGS.jev, enabled: true, gatePolicy: { callback: { enabled: true } } } }),
    }));
    expect(tuned.root.textContent).toContain("Reset 1 changed gate to defaults");
    tuned.destroy();
  });

  test("offers every declared fallback for a gate", () => {
    const harness = mount(makeState({ settings: settings({ jev: { ...DEFAULT_SETTINGS.jev, enabled: true } }) }));
    expandGate(harness.root, "continuity_guard");
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
    expect(harness.root.textContent).toContain("Turn on Use Jev gates to start recording decisions.");
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
    expect(root.textContent).toContain("Soften the directive");
    // The sub-threshold confidence is flagged on the badge itself.
    const belowFloor = root.querySelector<HTMLElement>('[title="Below the 0.50 floor"]');
    expect(belowFloor?.textContent).toBe("0.30");
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
