import { beforeEach, describe, expect, test } from "bun:test";
import { JSDOM } from "jsdom";
import { DEFAULT_SETTINGS, normalizeSettings, type JevGateRecord, type LumiWorldSettings } from "./shared";
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
      personas: true, worldBooks: true, decisions: true,
    },
    decisionConnections: [{ id: "decision-1", name: "My decisions", provider: "openrouter", model: "~typesafe/jev-latest", isDefault: true, hasApiKey: true }],
    decisionConnectionError: null,
    decisionsAvailable: true,
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
function mount(initial: FrontendState, onBadge?: (value: string | null, root: HTMLElement) => void): Harness {
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
      registerDrawerTab: () => ({ root, setBadge: (value: string | null) => onBadge?.(value, root), destroy: () => {} }),
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

function latestCatalogRequestId(harness: Harness): number {
  const request = harness.sent.filter((message) => message.type === "get_decision_models").pop();
  if (request?.type !== "get_decision_models" || request.requestId === undefined) throw new Error("No catalog request");
  return request.requestId;
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

describe("Director prompt presets", () => {
  const presetSelect = (root: HTMLElement) => labelled(root, "Prompt preset") as HTMLSelectElement;
  const template = (root: HTMLElement, index: number) => root.querySelectorAll<HTMLTextAreaElement>(".lw-template")[index]!;
  const action = (root: HTMLElement, text: string) => [...root.querySelectorAll<HTMLButtonElement>("button")]
    .find((item) => item.textContent === text)!;

  test("saves two editable variants and switches between each and the built-in default", () => {
    const harness = mount(makeState());
    expect(presetSelect(harness.root).value).toBe("builtin");
    expect(template(harness.root, 0).readOnly).toBe(true);
    action(harness.root, "New preset from current").click();
    const firstId = presetSelect(harness.root).value;
    expect(firstId).not.toBe("builtin");
    const nameA = labelled(harness.root, "Preset name") as HTMLInputElement;
    nameA.value = "Variant A";
    nameA.dispatchEvent(new dom.window.Event("change", { bubbles: true }));
    template(harness.root, 0).value = "System A {{prompt}}";
    template(harness.root, 0).dispatchEvent(new dom.window.Event("input", { bubbles: true }));
    template(harness.root, 1).value = "User A {{prompt}}";
    template(harness.root, 1).dispatchEvent(new dom.window.Event("input", { bubbles: true }));

    action(harness.root, "New preset from current").click();
    const secondId = presetSelect(harness.root).value;
    expect(secondId).not.toBe(firstId);
    expect(template(harness.root, 0).value).toBe("System A {{prompt}}");
    const nameB = labelled(harness.root, "Preset name") as HTMLInputElement;
    nameB.value = "Variant B";
    nameB.dispatchEvent(new dom.window.Event("change", { bubbles: true }));
    template(harness.root, 0).value = "System B {{prompt}}";
    template(harness.root, 0).dispatchEvent(new dom.window.Event("input", { bubbles: true }));
    template(harness.root, 1).value = "User B {{prompt}}";
    template(harness.root, 1).dispatchEvent(new dom.window.Event("input", { bubbles: true }));

    presetSelect(harness.root).value = firstId;
    presetSelect(harness.root).dispatchEvent(new dom.window.Event("change", { bubbles: true }));
    expect([template(harness.root, 0).value, template(harness.root, 1).value])
      .toEqual(["System A {{prompt}}", "User A {{prompt}}"]);
    action(harness.root, "Use built-in defaults").click();
    expect(presetSelect(harness.root).value).toBe("builtin");
    expect(template(harness.root, 0).value).toBe(DEFAULT_SETTINGS.systemTemplate);
    presetSelect(harness.root).value = secondId;
    presetSelect(harness.root).dispatchEvent(new dom.window.Event("change", { bubbles: true }));
    expect([template(harness.root, 0).value, template(harness.root, 1).value])
      .toEqual(["System B {{prompt}}", "User B {{prompt}}"]);

    harness.advanceSave();
    const save = harness.sent.filter((entry) => entry.type === "save_settings").pop();
    expect(save?.type).toBe("save_settings");
    if (save?.type === "save_settings") {
      const saved = normalizeSettings(save.settings);
      expect(saved.promptPresets.map((preset) => preset.name)).toEqual(["Variant A", "Variant B"]);
      expect(saved.activePromptPresetId).toBe(secondId);
      harness.destroy();
      const reloaded = mount(makeState({ settings: saved }));
      expect(presetSelect(reloaded.root).value).toBe(secondId);
      expect(template(reloaded.root, 0).value).toBe("System B {{prompt}}");
      reloaded.destroy();
    } else harness.destroy();
  });

  test("requires a second click to delete a custom preset and keeps the built-in one", () => {
    const harness = mount(makeState());
    action(harness.root, "New preset from current").click();
    action(harness.root, "Delete preset").click();
    expect(presetSelect(harness.root).options.length).toBe(2);
    action(harness.root, "Confirm delete preset").click();
    expect(presetSelect(harness.root).options.length).toBe(1);
    expect(presetSelect(harness.root).value).toBe("builtin");
    harness.destroy();
  });
});

describe("Drawer scroll position", () => {
  function scrollHost(root: HTMLElement): HTMLElement {
    const host = document.createElement("div");
    document.body.append(host);
    host.append(root);
    return host;
  }

  function clampScroll(root: HTMLElement): void {
    // jsdom has no layout. Model the browser clamping a scroller when its
    // content is briefly removed by the drawer or a host badge update.
    for (let element: HTMLElement | null = root; element; element = element.parentElement) {
      element.scrollTop = 0;
      element.scrollLeft = 0;
    }
  }

  test("preserves the root and host scrollers across settings and backend renders", () => {
    const state = makeState({ settings: settings({ jev: { ...DEFAULT_SETTINGS.jev, enabled: true } }) });
    const harness = mount(state);
    harness.root.querySelector<HTMLButtonElement>("#lw-tab-jev")!.click();
    const host = scrollHost(harness.root);
    const replaceChildren = harness.root.replaceChildren.bind(harness.root);
    harness.root.replaceChildren = (...nodes) => {
      // The replacement already contains both completed views; it is never an
      // empty shell while the browser calculates the host's scroll range.
      expect((nodes[0] as HTMLElement).querySelectorAll("[data-lw-view]")).toHaveLength(2);
      clampScroll(harness.root);
      replaceChildren(...nodes);
    };
    harness.root.scrollTop = 120;
    harness.root.scrollLeft = 10;
    host.scrollTop = 840;
    host.scrollLeft = 35;

    const connection = labelled(harness.root, "Decision connection") as HTMLSelectElement;
    connection.value = "decision-1";
    connection.dispatchEvent(new dom.window.Event("change"));
    expect([harness.root.scrollTop, harness.root.scrollLeft, host.scrollTop, host.scrollLeft]).toEqual([120, 10, 840, 35]);
    harness.push({ type: "state", state });
    expect([harness.root.scrollTop, harness.root.scrollLeft, host.scrollTop, host.scrollLeft]).toEqual([120, 10, 840, 35]);
    harness.destroy();
    host.remove();
  });

  test("preserves the host scroller when saving a switch or confidence floor", () => {
    const harness = mount(makeState({ settings: settings({ jev: { ...DEFAULT_SETTINGS.jev, enabled: true } }) }),
      (_badge, root) => clampScroll(root));
    harness.root.querySelector<HTMLButtonElement>("#lw-tab-jev")!.click();
    const host = scrollHost(harness.root);
    host.scrollTop = 760;
    const contextSwitch = harness.root.querySelector<HTMLInputElement>('[aria-label="Jev context"] [aria-label="Character"]')!;
    contextSwitch.checked = false;
    contextSwitch.dispatchEvent(new dom.window.Event("change", { bubbles: true }));
    expect(host.scrollTop).toBe(760);

    expandGate(harness.root, "continuity_guard");
    const floor = labelled(harness.root, "Continuity guard threshold") as HTMLInputElement;
    floor.value = "0.5";
    floor.dispatchEvent(new dom.window.Event("change", { bubbles: true }));
    expect(host.scrollTop).toBe(760);
    harness.advanceSave();
    const save = harness.sent.filter((entry) => entry.type === "save_settings").pop()!;
    if (save.type !== "save_settings") throw new Error("settings were not saved");
    harness.push({ type: "settings_saved", revision: save.revision, settings: normalizeSettings(save.settings) });
    expect(host.scrollTop).toBe(760);
    harness.destroy();
    host.remove();
  });

  test("restores after host layout without overriding a later user scroll or teardown", () => {
    const requestFrame = dom.window.requestAnimationFrame;
    const cancelFrame = dom.window.cancelAnimationFrame;
    let nextFrame = 0;
    const frames = new Map<number, FrameRequestCallback>();
    dom.window.requestAnimationFrame = (callback) => { frames.set(++nextFrame, callback); return nextFrame; };
    dom.window.cancelAnimationFrame = (id) => { frames.delete(id); };
    let hostLayout = () => {};
    const harness = mount(makeState({ settings: settings({ jev: { ...DEFAULT_SETTINGS.jev, enabled: true } }) }),
      (_badge, root) => { hostLayout = () => clampScroll(root); });
    const host = scrollHost(harness.root);
    try {
      host.scrollTop = 690;
      const change = () => {
        const input = labelled(harness.root, "Character") as HTMLInputElement;
        input.checked = !input.checked;
        input.dispatchEvent(new dom.window.Event("change", { bubbles: true }));
      };
      const flushFrames = () => {
        const pending = [...frames.values()]; frames.clear();
        for (const callback of pending) callback(0);
      };
      change();
      hostLayout();
      expect(host.scrollTop).toBe(0);
      // Another backend/save update before paint must not replace the original
      // position with the host's temporary 0.
      change();
      hostLayout();
      flushFrames();
      expect(host.scrollTop).toBe(690);

      change();
      host.dispatchEvent(new dom.window.WheelEvent("wheel", { bubbles: true }));
      host.scrollTop = 340;
      flushFrames();
      expect(host.scrollTop).toBe(340);

      change();
      harness.destroy();
      expect(frames.size).toBe(0);
    } finally {
      harness.destroy();
      host.remove();
      dom.window.requestAnimationFrame = requestFrame;
      dom.window.cancelAnimationFrame = cancelFrame;
    }
  });
});

describe("Jev drawer section", () => {
  test("stays collapsed while Jev is disabled", () => {
    const harness = mount(makeState());
    expect(harness.root.textContent).toContain("Jev decides whether a turn needs the Director");
    expect(harness.root.textContent).toContain("Director-only baseline");
    // The connection card stays collapsed until the feature is switched on.
    expect(labelled(harness.root, "Decision connection")).toBeNull();
    expect(labelled(harness.root, "Jev API key")).toBeNull();
    harness.destroy();
  });

  test("uses saved Decision connections without credential controls", () => {
    const harness = mount(makeState({ settings: settings({ jev: { ...DEFAULT_SETTINGS.jev, enabled: true } }) }));
    const select = labelled(harness.root, "Decision connection") as HTMLSelectElement;
    expect(select.value).toBe("");
    expect([...select.options].map((option) => option.textContent)).toEqual(["Account default · My decisions", "My decisions · openrouter · default"]);
    expect(labelled(harness.root, "Jev API key")).toBeNull();
    expect(labelled(harness.root, "Jev provider")).toBeNull();
    expect(harness.root.textContent).toContain("Manage providers and API keys in Lumiverse’s Decision connections");
    expect(harness.root.querySelector<HTMLInputElement>('[aria-label="Jev model"]')?.placeholder).toBe("~typesafe/jev-latest");
    expect(harness.sent.filter((entry) => entry.type === "get_decision_models")).toEqual([
      expect.objectContaining({ type: "get_decision_models", connectionId: null }),
    ]);
    harness.destroy();
  });

  test("saves Jev's three context switches without changing the Director switches", () => {
    const harness = mount(makeState({ settings: settings({
      includeCharacter: false, includeUserPersona: false, includeWorldInfoEntries: false,
      jev: { ...DEFAULT_SETTINGS.jev, enabled: true },
    }) }));
    const context = harness.root.querySelector<HTMLElement>('[aria-label="Jev context"]')!;
    const character = labelled(context, "Character") as HTMLInputElement;
    const persona = labelled(context, "User persona") as HTMLInputElement;
    const worldInfo = labelled(context, "Activated World Info") as HTMLInputElement;
    expect([character.checked, persona.checked, worldInfo.checked]).toEqual([true, true, false]);
    character.checked = false; character.dispatchEvent(new dom.window.Event("change", { bubbles: true }));
    persona.checked = false; persona.dispatchEvent(new dom.window.Event("change", { bubbles: true }));
    worldInfo.checked = true; worldInfo.dispatchEvent(new dom.window.Event("change", { bubbles: true }));
    harness.advanceSave();
    const save = harness.sent.filter((entry) => entry.type === "save_settings").pop();
    expect(save?.type).toBe("save_settings");
    if (save?.type === "save_settings") {
      expect(save.settings.jev?.includeCharacter).toBe(false);
      expect(save.settings.jev?.includeUserPersona).toBe(false);
      expect(save.settings.jev?.includeWorldInfoEntries).toBe(true);
      expect(save.settings.includeCharacter).toBe(false);
      expect(save.settings.includeUserPersona).toBe(false);
      expect(save.settings.includeWorldInfoEntries).toBe(false);
    }
    harness.destroy();
  });

  test("preserves exact discovered model IDs and permits manual overrides", () => {
    const harness = mount(makeState({ settings: settings({ jev: { ...DEFAULT_SETTINGS.jev, enabled: true } }) }));
    harness.push({ type: "decision_models", connectionId: null, requestId: latestCatalogRequestId(harness), error: null, models: [
      { id: "~typesafe/jev-latest", label: "Jev latest", protocol: "supported" },
      { id: "manual-catalog-entry", label: "Unverified model", protocol: "unverified" },
      { id: "together/tev1", label: "Tev1", protocol: "unsupported" },
    ] });
    const options = [...harness.root.querySelectorAll<HTMLOptionElement>("[data-lw-decision-models] option")];
    expect(options.map((option) => option.value)).toEqual(["~typesafe/jev-latest", "manual-catalog-entry"]);
    const input = labelled(harness.root, "Jev model") as HTMLInputElement;
    input.value = "vendor/new-model";
    input.dispatchEvent(new dom.window.Event("input"));
    harness.advanceSave();
    const save = harness.sent.find((entry) => entry.type === "save_settings");
    expect(save?.type === "save_settings" && save.settings.jev?.model).toBe("vendor/new-model");
    expect(harness.root.querySelector<HTMLButtonElement>("[data-lw-jev-test]")?.disabled).toBe(false);
    input.value = "together/tev1";
    input.dispatchEvent(new dom.window.Event("input"));
    expect(harness.root.querySelector<HTMLButtonElement>("[data-lw-jev-test]")?.disabled).toBe(true);
    expect(harness.root.textContent).toContain("unsupported Decision protocol");
    harness.destroy();
  });

  test("uses explicit connections and ignores model responses from previous selections", () => {
    const initial = makeState({
      settings: settings({ jev: { ...DEFAULT_SETTINGS.jev, enabled: true, model: "old-override" } }),
    });
    initial.decisionConnections.push({ id: "decision-2", name: "Other", provider: "typesafe", model: "jev-latest", isDefault: false, hasApiKey: true });
    const harness = mount(initial);
    const select = labelled(harness.root, "Decision connection") as HTMLSelectElement;
    select.value = "decision-2";
    select.dispatchEvent(new dom.window.Event("change"));
    expect((labelled(harness.root, "Jev model") as HTMLInputElement).value).toBe("");
    expect(harness.sent.filter((entry) => entry.type === "get_decision_models").map((entry) => entry.type === "get_decision_models" && entry.connectionId)).toEqual([null, "decision-2"]);
    harness.push({ type: "decision_models", connectionId: null, requestId: 1, error: null, models: [{ id: "stale", label: "Stale", protocol: "supported" }] });
    expect(harness.root.querySelector("[data-lw-decision-models] option")).toBeNull();
    harness.push({ type: "decision_models", connectionId: "decision-2", requestId: latestCatalogRequestId(harness), error: null, models: [{ id: "jev-latest", label: "Current", protocol: "supported" }] });
    expect(harness.root.querySelector<HTMLOptionElement>("[data-lw-decision-models] option")?.value).toBe("jev-latest");
    harness.advanceSave();
    const save = harness.sent.find((entry) => entry.type === "save_settings");
    expect(save?.type === "save_settings" && save.settings.jev?.connectionId).toBe("decision-2");
    const requests = harness.sent.filter((entry) => entry.type === "get_decision_models").length;
    harness.root.querySelector<HTMLButtonElement>('[data-lw-gate="continuity_guard"] .lw-gate-caret')!.click();
    expect(harness.sent.filter((entry) => entry.type === "get_decision_models")).toHaveLength(requests);
    harness.destroy();
  });

  test("rejects stale default catalogs when the account default changes", () => {
    const state = makeState({ settings: settings({ jev: { ...DEFAULT_SETTINGS.jev, enabled: true } }) });
    const harness = mount(state);
    const oldRequestId = latestCatalogRequestId(harness);
    state.decisionConnections = [{ ...state.decisionConnections[0]!, id: "new-default", model: "new-model" }];
    harness.push({ type: "state", state });
    const requestId = latestCatalogRequestId(harness);
    expect(requestId).not.toBe(oldRequestId);
    harness.push({ type: "decision_models", connectionId: null, requestId: oldRequestId, models: [{ id: "stale-default", label: "Old", protocol: "supported" }], error: null });
    expect(harness.root.querySelector("[data-lw-decision-models] option")).toBeNull();
    harness.push({ type: "decision_models", connectionId: null, requestId, models: [{ id: "new-model", label: "New", protocol: "supported" }], error: null });
    expect(harness.root.querySelector<HTMLOptionElement>("[data-lw-decision-models] option")?.value).toBe("new-model");
    expect((labelled(harness.root, "Jev model") as HTMLInputElement).placeholder).toBe("new-model");
    harness.destroy();
  });

  test("keeps a missing explicit connection selected and never uses the default", () => {
    const harness = mount(makeState({ settings: settings({ jev: { ...DEFAULT_SETTINGS.jev, enabled: true, connectionId: "deleted-profile" } }) }));
    expect((labelled(harness.root, "Decision connection") as HTMLSelectElement).value).toBe("deleted-profile");
    expect(harness.root.textContent).toContain("saved Decision connection is unavailable");
    expect(harness.root.querySelector<HTMLButtonElement>("[data-lw-jev-test]")?.disabled).toBe(true);
    expect(harness.sent.filter((entry) => entry.type === "get_decision_models")).toHaveLength(0);
    harness.destroy();
  });

  test("sends a credential-free test using the selected Decision connection", () => {
    const harness = mount(makeState({ settings: settings({ jev: { ...DEFAULT_SETTINGS.jev, enabled: true, connectionId: "decision-1" } }) }));
    const test = harness.root.querySelector<HTMLButtonElement>("[data-lw-jev-test]")!;
    expect(test.disabled).toBe(false);
    expect(harness.root.textContent).toContain("your chat is not sent");
    test.click();
    const message = harness.sent.find((entry) => entry.type === "test_jev");
    expect(message?.type).toBe("test_jev");
    expect(message).not.toHaveProperty("apiKey");
    if (message?.type === "test_jev") expect(message.settings?.jev?.connectionId).toBe("decision-1");
    harness.destroy();
  });

  test("disables Decision access without permission or host support", () => {
    for (const blocked of [{ decisionsAvailable: false }, { permissions: { ...makeState().permissions, decisions: false } }]) {
      const harness = mount(makeState({ settings: settings({ jev: { ...DEFAULT_SETTINGS.jev, enabled: true } }), ...blocked }));
      expect(harness.root.querySelector<HTMLButtonElement>("[data-lw-jev-test]")?.disabled).toBe(true);
      expect(harness.sent.filter((entry) => entry.type === "get_decision_models")).toHaveLength(0);
      expect(harness.root.textContent).toContain("decisionsAvailable" in blocked ? "Update Lumiverse" : "decisions permission");
      harness.destroy();
    }
  });

  test("keeps manual model entry available when catalog discovery fails", () => {
    const harness = mount(makeState({ settings: settings({ jev: { ...DEFAULT_SETTINGS.jev, enabled: true } }) }));
    harness.push({ type: "decision_models", connectionId: null, requestId: latestCatalogRequestId(harness), error: "Provider unavailable", models: [] });
    expect(harness.root.textContent).toContain("Model discovery failed: Provider unavailable");
    expect((labelled(harness.root, "Jev model") as HTMLInputElement).disabled).toBe(false);
    expect(harness.root.querySelector<HTMLButtonElement>("[data-lw-jev-test]")?.disabled).toBe(false);
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

  test("lets users set the default and strong Director targets", () => {
    const initial = makeState({
      settings: settings({ connectionId: "conn-1" }),
      connections: [
        { id: "conn-1", name: "Default", provider: "mock", model: "small-model", isDefault: true, hasApiKey: true },
        { id: "conn-2", name: "Strong", provider: "mock", model: "large-model", isDefault: false, hasApiKey: true },
      ],
    });
    const harness = mount(initial);
    expect(harness.root.textContent).toContain("Default Director · cheap route");
    expect(harness.root.textContent).toContain("Strong Director · optional");

    const connection = labelled(harness.root, "Strong Director connection") as HTMLSelectElement;
    connection.value = "conn-2";
    connection.dispatchEvent(new dom.window.Event("change", { bubbles: true }));
    const model = labelled(harness.root, "Strong Director model") as HTMLInputElement;
    model.value = "strong-override";
    model.dispatchEvent(new dom.window.Event("input", { bubbles: true }));
    harness.advanceSave();
    const saved = harness.sent.find((message) => message.type === "save_settings");
    expect(saved?.type === "save_settings" && saved.settings.strongConnectionId).toBe("conn-2");
    expect(saved?.type === "save_settings" && saved.settings.strongModelOverride).toBe("strong-override");

    tabs(harness.root)[1]!.click();
    expandGate(harness.root, "model_route");
    expect(harness.root.querySelector('[data-lw-gate="model_route"]')?.textContent).toContain("Director tab");
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

  test("keeps a typed Decision model override when switching views", () => {
    const harness = mount(makeState({ settings: settings({ jev: { ...DEFAULT_SETTINGS.jev, enabled: true } }) }));
    const key = labelled(harness.root, "Jev model") as HTMLInputElement;
    key.value = "half-typed";
    key.dispatchEvent(new dom.window.Event("input"));

    tabs(harness.root)[0]!.click();
    tabs(harness.root)[1]!.click();

    const after = labelled(harness.root, "Jev model") as HTMLInputElement;
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
    expect(jev.textContent).toContain("Decisions");
    harness.destroy();
  });

  test("leaves the Director tab unmarked when nothing needs action", () => {
    const directorDot = (root: HTMLElement) => root.querySelector("#lw-tab-director .lw-tab-dot");

    // Director disabled is a choice, not a problem.
    const idle = mount(makeState());
    expect(directorDot(idle.root)).toBeNull();
    // Jev is still marked, because its state appears nowhere else on screen.
    expect(idle.root.querySelector("#lw-tab-jev .lw-tab-dot")).not.toBeNull();
    idle.destroy();

    // Enabled and fully configured needs no badge either.
    const ready = mount(makeState({
      settings: settings({ enabled: true, connectionId: "conn-1", modelOverride: "m" }),
    }));
    expect(directorDot(ready.root)).toBeNull();
    ready.destroy();

    // Enabled with the interceptor granted but no reply types selected.
    const noTypes = mount(makeState({
      settings: settings({ enabled: true, connectionId: "conn-1", modelOverride: "m", generationTypes: [] }),
    }));
    expect(directorDot(noTypes.root)?.getAttribute("title")).toMatch(/reply types/i);
    noTypes.destroy();
  });

  test("always marks the Jev tab, including while it is off", () => {
    // Jev's state is stated nowhere else, so the marker must be there at rest.
    const off = mount(makeState());
    const offDot = off.root.querySelector<HTMLElement>("#lw-tab-jev .lw-tab-dot");
    expect(offDot).not.toBeNull();
    expect(offDot!.getAttribute("title")).toBe("Jev is off");
    // The marker travels with the label instead of sitting at the tab's edge.
    expect(offDot!.parentElement?.className).toBe("lw-tab-content");
    expect(offDot!.parentElement?.querySelector(".lw-tab-label")?.textContent).toBe("Jev");
    off.destroy();
  });

  test("flags an enabled Director that cannot run", () => {
    const harness = mount(makeState({ settings: settings({ enabled: true, connectionId: null }) }));
    const dot = harness.root.querySelector<HTMLElement>("#lw-tab-director .lw-tab-dot");
    expect(dot).not.toBeNull();
    expect(dot!.getAttribute("title")).toMatch(/connection and model/i);
    expect(dot!.getAttribute("aria-hidden")).toBe("true");
    harness.destroy();
  });

  test("flags a Jev that has no Decision connection, and clears once configured", () => {
    const unkeyed = mount(makeState({ decisionConnections: [], settings: settings({ jev: { ...DEFAULT_SETTINGS.jev, enabled: true } }) }));
    expect(unkeyed.root.querySelector<HTMLElement>("#lw-tab-jev .lw-tab-dot")?.getAttribute("title")).toMatch(/Decision connection/i);
    unkeyed.destroy();

    const keyed = mount(makeState({
      settings: settings({ jev: { ...DEFAULT_SETTINGS.jev, enabled: true } }),
    }));
    expect(keyed.root.querySelector<HTMLElement>("#lw-tab-jev .lw-tab-dot")?.getAttribute("title")).toBe("Jev is active");
    keyed.destroy();
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

  test("restores the master switches from saved settings after reload", () => {
    const harness = mount(makeState({
      settings: settings({ enabled: true, jev: { ...DEFAULT_SETTINGS.jev, enabled: true } }),
    }));
    const director = labelled(harness.root, "Enable Director") as HTMLInputElement;
    expect(director.checked).toBe(true);
    tabs(harness.root)[1]!.click();
    const jev = labelled(harness.root, "Enable Jev") as HTMLInputElement;
    expect(jev.checked).toBe(true);
    harness.destroy();
  });

  test("updates the mounted switch when backend settings change", () => {
    const harness = mount(makeState());
    expect((labelled(harness.root, "Enable Director") as HTMLInputElement).checked).toBe(false);
    harness.push({ type: "state", state: makeState({ settings: settings({ enabled: true }) }) });
    expect((labelled(harness.root, "Enable Director") as HTMLInputElement).checked).toBe(true);
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
      settings: settings({ jev: { ...DEFAULT_SETTINGS.jev, enabled: true } }),
    }));
    const slot = harness.root.querySelector<HTMLElement>("[data-lw-jev-status]")!;
    expect(slot.textContent).toContain("Ready");
    harness.destroy();
  });
});

describe("Jev decisions editor", () => {
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
    expect(card().textContent).toContain("Answers below this are left out of the Director's guidance.");
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
    expect(tuned.root.textContent).toContain("Reset 1 changed decision to defaults");
    tuned.destroy();
  });

  test("offers working guard fallbacks and saves the selected action", () => {
    const harness = mount(makeState({ settings: settings({ jev: { ...DEFAULT_SETTINGS.jev, enabled: true } }) }));
    expandGate(harness.root, "continuity_guard");
    const fallback = labelled(harness.root, "Continuity guard fallback") as HTMLSelectElement;
    expect(fallback).not.toBeNull();
    expect([...fallback.options].map((option) => option.value)).toContain("soften");
    expect([...fallback.options].map((option) => option.value)).toEqual(["retry", "patch", "soften", "drop", "accept", "ignore", "skip"]);
    expect(fallback.value).toBe("soften");
    fallback.value = "accept";
    fallback.dispatchEvent(new dom.window.Event("change", { bubbles: true }));
    harness.advanceSave();
    const save = harness.sent.findLast((message) => message.type === "save_settings");
    expect(save?.type === "save_settings" && save.settings.jev?.gatePolicy.continuity_guard?.fallback).toBe("accept");
    harness.destroy();
  });

  test("explains fixed fallbacks without showing unsupported choices", () => {
    const harness = mount(makeState());
    for (const gateId of ["context_filter", "model_route", "scene_state_tracking", "claim_extraction"]) {
      expandGate(harness.root, gateId);
      const card = harness.root.querySelector(`[data-lw-gate="${gateId}"]`)!;
      expect(card.querySelector("select")).toBeNull();
      expect(card.textContent).toContain("If this decision cannot answer");
    }
    harness.destroy();
  });

  test("shows the global floor's effect on a lower per-guard floor", () => {
    const harness = mount(makeState({ settings: settings({ jev: { ...DEFAULT_SETTINGS.jev,
      gatePolicy: { continuity_guard: { threshold: 0.5 } } } }) }));
    expandGate(harness.root, "continuity_guard");
    expect(harness.root.querySelector('[data-lw-gate="continuity_guard"]')!.textContent).toContain("Effective floor: 0.55");
    const threshold = labelled(harness.root, "Continuity guard threshold") as HTMLInputElement;
    threshold.value = "0.8";
    threshold.dispatchEvent(new dom.window.Event("change", { bubbles: true }));
    expect(harness.root.querySelector('[data-lw-gate="continuity_guard"]')!.textContent).toContain("Effective floor: 0.80");
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
    phases: [],
    revision: null,
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
    expect(harness.root.textContent).toContain("Last turn");
    expect(harness.root.textContent).toContain("Generate a reply to see the full turn trace here.");
    harness.destroy();
  });

  test("renders each gate outcome with its confidence and fallback", () => {
    const harness = mount(makeState({
      runs: [{ id: "run-1", timestamp: 1, status: "success", channel: "director", jev: jevRun }],
    }));
    const root = harness.root;
    expect(root.textContent).toContain("2 Jev requests");
    expect(root.textContent).toContain("1 fallback");
    expect(root.textContent).toContain("partial");
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

  test("distinguishes guidance sent to the Director from a dropped low-confidence choice", () => {
    const accepted = {
      gateId: "pacing_control", label: "Pacing control", primitive: "choice" as const, phase: "gate" as const,
      value: "tighten", probability: 0.9, confidence: 0.9, confidenceDerived: false,
      threshold: 0.55, escalated: false, usedFallback: false, fallback: "run" as const,
    };
    const ignored = {
      ...accepted, gateId: "npc_autonomy", label: "NPC autonomy", value: "assist",
      probability: 0.28, confidence: 0.28, escalated: true, usedFallback: true,
    };
    const harness = mount(makeState({
      runs: [{ id: "run-guided", timestamp: 1, status: "success", channel: "director",
        jev: { ...jevRun, gates: [accepted, ignored] } }],
    }));
    const row = (name: string) => [...harness.root.querySelectorAll<HTMLElement>(".lw-diag-row")]
      .find((item) => item.textContent?.includes(name));
    expect(row("Pacing control")?.textContent).toContain("Sent to Director");
    expect(row("NPC autonomy")?.textContent).toContain("Decision ignored");
    harness.destroy();
  });

  test("separates a skip decision from unused gate answers", () => {
    const skipped = {
      ...jevRun,
      status: "skipped" as const,
      requestCount: 1,
      gates: [
        { ...jevRun.gates[0]!, value: false, probability: 0.27, confidence: 0.73 },
        { ...jevRun.gates[1]!, phase: "gate" as const, fallback: "run" as const },
      ],
    };
    const harness = mount(makeState({
      runs: [{ id: "skip-1", timestamp: 1, status: "skipped", channel: "director", jev: skipped }],
    }));
    const panel = harness.root.querySelector<HTMLElement>(".lw-diag")!;
    expect(panel.querySelector(".lw-diag-outcome")?.textContent).toContain("No LumiWorld note was added");
    const rows = panel.querySelectorAll<HTMLElement>(".lw-diag-row");
    expect(rows[0]?.textContent).toContain("Smart Director triggering");
    expect(rows[1]?.textContent).toContain("Continuity guard");
    expect(rows[1]?.dataset.on).toBe("false");
    expect(panel.textContent).toContain("not used");
    harness.destroy();
  });

  test("surfaces a degraded turn and its error", () => {
    const harness = mount(makeState({
      runs: [{
        id: "run-2", timestamp: 2, status: "success", channel: "director",
        jev: { ...jevRun, status: "degraded" as const, error: "network unreachable", resolvedModel: null },
      }],
    }));
    expect(harness.root.textContent).toContain("degraded");
    expect(harness.root.textContent).toContain("network unreachable");
    harness.destroy();
  });

  test("explains a recorded turn whose individual decisions are missing", () => {
    const harness = mount(makeState({
      runs: [{ id: "run-missing-gates", timestamp: 2, status: "error", channel: "director",
        jev: { ...jevRun, requestCount: 1, gates: [] } }],
    }));
    expect(harness.root.textContent).toContain("Decision details were not saved for this turn.");
    harness.destroy();
  });

  test("shows the actual latest turn, even if Jev was not used", () => {
    const harness = mount(makeState({
      runs: [
        { id: "run-new", timestamp: 2, status: "success", channel: "director" },
        { id: "run-old", timestamp: 1, status: "success", channel: "director", jev: jevRun },
      ],
    }));
    expect(harness.root.textContent).toContain("Last turn");
    expect(harness.root.textContent).toContain("Jev not used");
    expect(harness.root.querySelector(".lw-diag")?.textContent).not.toContain("2 Jev requests");
    harness.destroy();
  });

  test("shows every pass and copies the complete turn including chat text", async () => {
    const copied: string[] = [];
    const previousNavigator = Object.getOwnPropertyDescriptor(globalThis, "navigator");
    Object.defineProperty(globalThis, "navigator", {
      configurable: true, value: { clipboard: { writeText: async (value: string) => { copied.push(value); } } },
    });
    const initial = jevRun.gates[1]! as JevGateRecord;
    const final = { ...initial, value: "consistent", confidence: 0.92, usedFallback: false, escalated: false };
    const phase = (stage: "before_director" | "verify_draft" | "verify_revision", gates: JevGateRecord[]) => ({
      stage, questionCount: gates.length, requestCount: 1, durationMs: 40,
      inputTokens: 120, outputTokens: 12, costUsd: 0.00001, resolvedModel: "jev-1.13.0",
      stateChars: 800, stateCompacted: false, error: null, gates,
      requestJson: JSON.stringify({ state: { chat_history: ["PRIVATE_CHAT_CANARY"] }, questions: {} }),
      responseJson: JSON.stringify([{ status: 200, body: "RAW_JEV_RESPONSE" }]),
    });
    const run = {
      id: "turn-full", timestamp: 2, status: "success" as const, channel: "director" as const,
      durationMs: 320, directorDurationMs: 90, directivePreview: "Revised note",
      trace: {
        chatId: "chat-1", generationId: "generation-1", dryRun: false,
        generationOutcome: "completed" as const, generationError: null, messageId: "m1",
        finalReply: "VISIBLE_REPLY_CANARY", worldStateOutcome: "saved" as const,
        worldStateBeforeJson: JSON.stringify({ turn: 1 }), worldStateAfterJson: JSON.stringify({ turn: 2 }),
        settingsJson: JSON.stringify({ jev: { enabled: true }, privateNotes: "PRIVATE_SETTINGS_CANARY" }),
        incomingMessagesJson: JSON.stringify([{ role: "user", content: "PRIVATE_CHAT_CANARY" }]),
        directorMessagesJson: JSON.stringify([{ role: "system", content: "PRIVATE_DIRECTOR_PROMPT" }]),
        initialDirective: "Initial note", finalDirective: "Revised note",
        initialResponseJson: JSON.stringify({ choices: [{ message: { content: "Initial note" } }] }),
      },
      jev: {
        ...jevRun, requestCount: 3, gateCount: 3, fallbackCount: 1,
        gates: [jevRun.gates[0]!, initial, final],
        phases: [phase("before_director", [jevRun.gates[0]!]), phase("verify_draft", [initial]), phase("verify_revision", [final])],
        revision: {
          action: "soften", reason: "Continuity conflict", status: "revised" as const,
          durationMs: 80, error: null, initialDirectivePreview: "Initial note",
          revisedDirectivePreview: "Revised note", unresolved: false,
          promptJson: JSON.stringify([{ role: "system", content: "PRIVATE_REVISION_PROMPT" }]),
          revisedDirective: "Revised note", responseJson: JSON.stringify({ result: "Revised note" }),
        },
      },
    };
    try {
      const harness = mount(makeState({ runs: [run] }));
      const steps = [...harness.root.querySelectorAll<HTMLDetailsElement>(".lw-diag-step")];
      expect(steps.map((step) => step.querySelector("summary")?.textContent)).toEqual([
        expect.stringContaining("Before Director"), expect.stringContaining("Director draft"),
        expect.stringContaining("Check draft"), expect.stringContaining("Director revision"),
        expect.stringContaining("Check revision"), expect.stringContaining("Final outcome"),
      ]);
      expect(steps[2]?.textContent).toContain("violation");
      expect(steps[4]?.textContent).toContain("consistent");
      expect(harness.root.textContent).toContain("PRIVATE_CHAT_CANARY");
      const copy = [...harness.root.querySelectorAll<HTMLButtonElement>("button")]
        .find((button) => button.textContent === "Copy all")!;
      copy.click();
      await Promise.resolve();
      const report = JSON.parse(copied[0]!) as any;
      expect(report.run.trace.incomingMessages[0].content).toBe("PRIVATE_CHAT_CANARY");
      expect(report.run.trace.settings.privateNotes).toBe("PRIVATE_SETTINGS_CANARY");
      expect(report.run.trace.finalReply).toBe("VISIBLE_REPLY_CANARY");
      expect(report.run.trace.worldStateAfter.turn).toBe(2);
      expect(report.run.jev.phases).toHaveLength(3);
      expect(report.run.jev.revision.prompt[0].content).toBe("PRIVATE_REVISION_PROMPT");
      expect(report.run.jev.phases[1].responseAttempts[0].body).toBe("RAW_JEV_RESPONSE");
      harness.destroy();
    } finally {
      if (previousNavigator) Object.defineProperty(globalThis, "navigator", previousNavigator);
      else delete (globalThis as any).navigator;
    }
  });

  test("updates Last turn as soon as the backend records a run", () => {
    const harness = mount(makeState());
    harness.push({ type: "run_logged", run: {
      id: "just-recorded", timestamp: 10, status: "success", channel: "director",
      trace: { chatId: "chat-1", generationId: null, dryRun: false, settingsJson: null,
        generationOutcome: "unknown", generationError: null, messageId: null,
        finalReply: null, worldStateOutcome: "not_used",
        worldStateBeforeJson: null, worldStateAfterJson: null,
        incomingMessagesJson: "[]", directorMessagesJson: null,
        initialDirective: "A new note", finalDirective: "A new note", initialResponseJson: null },
    } });
    expect(harness.root.querySelector(".lw-diag")?.textContent).toContain("A new note");
    harness.destroy();
  });

  test("shows a withheld note as inconclusive without presenting it as the final directive", () => {
    const harness = mount(makeState({ runs: [{
      id: "withheld-turn", timestamp: 10, status: "skipped", channel: "director",
      error: "Director note withheld: Player agency was inconclusive.",
      trace: { chatId: "chat-1", generationId: null, dryRun: false,
        generationOutcome: "completed", generationError: null, messageId: null,
        finalReply: "Visible reply", worldStateOutcome: "not_used",
        directiveDisposition: "withheld", verificationVerdict: "inconclusive",
        verificationReason: "Player agency was inconclusive.",
        worldStateBeforeJson: null, worldStateAfterJson: null, settingsJson: null,
        incomingMessagesJson: "[]", directorMessagesJson: "[]",
        initialDirective: "Rejected draft", finalDirective: null, initialResponseJson: null },
    }] }));
    const text = harness.root.querySelector(".lw-diag")?.textContent ?? "";
    expect(text).toContain("note withheld");
    expect(text).toContain("verification inconclusive");
    expect(text).toContain("Rejected draft");
    expect(text).toContain("Visible reply");
    harness.destroy();
  });

  test("does not replace the last reply with a Director connection test", () => {
    const harness = mount(makeState({ runs: [
      { id: "test-timeout", timestamp: 11, status: "timeout", channel: "director", generationType: "test" },
      { id: "real-turn", timestamp: 10, status: "success", channel: "director", directivePreview: "Real turn note" },
    ] }));
    expect(harness.root.querySelector(".lw-diag")?.textContent).toContain("Real turn note");
    expect(harness.root.querySelector(".lw-diag")?.textContent).not.toContain("test-timeout");
    harness.destroy();
  });
});
