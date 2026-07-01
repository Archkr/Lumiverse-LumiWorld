import type { SpindleFrontendContext } from "lumiverse-spindle-types";
import {
  DEFAULT_SETTINGS,
  EXTENSION_NAME,
  VISIBLE_GENERATION_TYPES,
  normalizeSettings,
  type AgentWorldGenerationType,
  type AgentWorldSettings,
  type ConnectionOption,
  type RunLogEntry,
} from "./shared";
import type { BackendToFrontend, FrontendState, FrontendToBackend } from "./types";

const AGENTWORLD_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3.5a8.5 8.5 0 1 0 8.5 8.5"/><path d="M12 3.5c2.2 2.1 3.2 4.9 3 8.5-.2 3.5-1.2 6.3-3 8.5"/><path d="M12 3.5c-2.2 2.1-3.2 4.9-3 8.5.2 3.5 1.2 6.3 3 8.5"/><path d="M3.8 10h10.4"/><path d="M4.8 15h9.8"/><path d="M16.5 4.2l1.4 2.8 3.1.4-2.2 2.2.5 3.1-2.8-1.5-2.8 1.5.5-3.1L12 7.4l3.1-.4 1.4-2.8z"/></svg>`;

const CSS = `
.agent-world-root {
  min-height: 100%;
  padding: 12px;
  color: var(--lumiverse-text);
  background: var(--lumiverse-bg, transparent);
  box-sizing: border-box;
  font: 13px/1.45 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}
.agent-world-root * { box-sizing: border-box; }
.agent-world-shell { display: flex; flex-direction: column; gap: 12px; }
.agent-world-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding-bottom: 6px;
  border-bottom: 1px solid var(--lumiverse-border);
}
.agent-world-title { display: flex; align-items: center; gap: 8px; min-width: 0; }
.agent-world-mark {
  width: 24px;
  height: 24px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--lumiverse-accent);
}
.agent-world-heading { font-size: 15px; font-weight: 650; margin: 0; }
.agent-world-subtle { color: var(--lumiverse-text-dim); font-size: 12px; }
.agent-world-actions { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
.agent-world-btn {
  appearance: none;
  border: 1px solid var(--lumiverse-border);
  background: var(--lumiverse-fill-subtle);
  color: var(--lumiverse-text);
  border-radius: 8px;
  padding: 7px 10px;
  font: inherit;
  cursor: pointer;
}
.agent-world-btn:hover { border-color: var(--lumiverse-accent); }
.agent-world-btn-primary {
  background: var(--lumiverse-accent);
  color: var(--lumiverse-accent-contrast, white);
  border-color: var(--lumiverse-accent);
}
.agent-world-btn-danger { color: var(--lumiverse-danger, #d94b4b); }
.agent-world-grid { display: grid; grid-template-columns: 1fr; gap: 10px; }
.agent-world-panel {
  border: 1px solid var(--lumiverse-border);
  background: var(--lumiverse-fill-subtle);
  border-radius: 8px;
  padding: 12px;
}
.agent-world-panel-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 10px;
}
.agent-world-panel-title h3 {
  margin: 0;
  font-size: 13px;
  font-weight: 650;
}
.agent-world-form { display: grid; gap: 10px; }
.agent-world-field { display: grid; gap: 5px; min-width: 0; }
.agent-world-field label, .agent-world-toggle-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--lumiverse-text);
}
.agent-world-hint { font-size: 11.5px; color: var(--lumiverse-text-dim); }
.agent-world-input, .agent-world-select, .agent-world-textarea {
  width: 100%;
  border: 1px solid var(--lumiverse-border);
  border-radius: 8px;
  background: var(--lumiverse-bg-elevated, var(--lumiverse-fill));
  color: var(--lumiverse-text);
  font: inherit;
  padding: 8px 9px;
}
.agent-world-textarea {
  resize: vertical;
  min-height: 132px;
  line-height: 1.35;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 12px;
}
.agent-world-two { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.agent-world-toggle {
  display: flex;
  gap: 8px;
  align-items: flex-start;
  padding: 8px 0;
}
.agent-world-toggle input { margin-top: 2px; }
.agent-world-type-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
.agent-world-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border: 1px solid var(--lumiverse-border);
  border-radius: 8px;
  padding: 7px 8px;
  background: var(--lumiverse-bg-elevated, transparent);
}
.agent-world-chip input { margin: 0; }
.agent-world-banner {
  border: 1px solid var(--lumiverse-border);
  border-radius: 8px;
  padding: 9px 10px;
  background: color-mix(in srgb, var(--lumiverse-accent) 10%, transparent);
  color: var(--lumiverse-text);
}
.agent-world-banner.warn {
  background: color-mix(in srgb, #e1a629 15%, transparent);
}
.agent-world-runs { display: grid; gap: 8px; }
.agent-world-run {
  display: grid;
  gap: 5px;
  padding: 9px;
  border: 1px solid var(--lumiverse-border);
  border-radius: 8px;
  background: var(--lumiverse-bg-elevated, transparent);
}
.agent-world-run-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.agent-world-status {
  display: inline-flex;
  align-items: center;
  border-radius: 999px;
  padding: 2px 7px;
  font-size: 11px;
  border: 1px solid var(--lumiverse-border);
  color: var(--lumiverse-text);
}
.agent-world-status.success, .agent-world-status.test_success {
  color: var(--lumiverse-success, #2f9e57);
}
.agent-world-status.error, .agent-world-status.timeout, .agent-world-status.test_error {
  color: var(--lumiverse-danger, #d94b4b);
}
.agent-world-details {
  border: 1px solid var(--lumiverse-border);
  border-radius: 8px;
  background: var(--lumiverse-fill-subtle);
  padding: 0;
}
.agent-world-details summary {
  cursor: pointer;
  padding: 10px 12px;
  font-weight: 650;
}
.agent-world-details-body { padding: 0 12px 12px; display: grid; gap: 10px; }
.agent-world-empty {
  padding: 14px;
  text-align: center;
  color: var(--lumiverse-text-dim);
  border: 1px dashed var(--lumiverse-border);
  border-radius: 8px;
}
@media (max-width: 520px) {
  .agent-world-two, .agent-world-type-grid { grid-template-columns: 1fr; }
  .agent-world-toolbar { align-items: flex-start; flex-direction: column; }
}
`;

type MountedHandle = { destroy(): void };

function createElement<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (typeof text === "string") element.textContent = text;
  return element;
}

function send(ctx: SpindleFrontendContext, message: FrontendToBackend): void {
  ctx.sendToBackend(message);
}

function cloneSettings(settings: AgentWorldSettings): AgentWorldSettings {
  return normalizeSettings({
    ...settings,
    generationTypes: [...settings.generationTypes],
  });
}

function readChatId(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const raw = (payload as { chatId?: unknown; chat_id?: unknown }).chatId ?? (payload as { chat_id?: unknown }).chat_id;
  return typeof raw === "string" && raw.trim() ? raw : null;
}

function formatStatus(status: RunLogEntry["status"]): string {
  return status.replace(/_/g, " ");
}

function formatTime(timestamp: number): string {
  try {
    return new Intl.DateTimeFormat(undefined, {
      hour: "numeric",
      minute: "2-digit",
      second: "2-digit",
    }).format(new Date(timestamp));
  } catch {
    return "";
  }
}

function connectionLabel(connection: ConnectionOption): string {
  const bits = [connection.name, connection.provider, connection.model].filter(Boolean);
  return `${bits.join(" / ")}${connection.hasApiKey ? "" : " (no key)"}`;
}

function setDirty(tab: ReturnType<SpindleFrontendContext["ui"]["registerDrawerTab"]>, value: boolean): void {
  tab.setBadge(value ? "Unsaved" : null);
}

export function setup(ctx: SpindleFrontendContext) {
  const cleanups: Array<() => void> = [];
  const componentHandles: MountedHandle[] = [];
  let state: FrontendState | null = null;
  let draft = cloneSettings(DEFAULT_SETTINGS);
  let dirty = false;
  let notice: { tone: "info" | "warn" | "error" | "success"; text: string } | null = null;

  cleanups.push(ctx.dom.addStyle(CSS));

  const tab = ctx.ui.registerDrawerTab({
    id: "agent-world",
    title: EXTENSION_NAME,
    shortName: "World",
    headerTitle: "AgentWorld",
    description: "Configure the AgentWorld prompt interceptor",
    keywords: ["agentworld", "qwen", "director", "interceptor", "world"],
    iconSvg: AGENTWORLD_ICON,
  });
  cleanups.push(() => tab.destroy());

  function destroyComponents(): void {
    while (componentHandles.length) {
      const handle = componentHandles.pop();
      try {
        handle?.destroy();
      } catch {
        // ignore stale host component handles during reload
      }
    }
  }

  function markDirty(): void {
    dirty = true;
    setDirty(tab, true);
  }

  function selectedConnection(): ConnectionOption | null {
    if (!state || !draft.connectionId) return null;
    return state.connections.find((connection) => connection.id === draft.connectionId) ?? null;
  }

  function updateDraft(patch: Partial<AgentWorldSettings>): void {
    draft = normalizeSettings({ ...draft, ...patch });
    markDirty();
  }

  function field(label: string, control: HTMLElement, hint?: string): HTMLElement {
    const wrap = createElement("div", "agent-world-field");
    const labelEl = createElement("label", undefined, label);
    wrap.append(labelEl, control);
    if (hint) wrap.appendChild(createElement("div", "agent-world-hint", hint));
    return wrap;
  }

  function numberInput(value: number, min: number, max: number, step: number, onChange: (value: number) => void): HTMLInputElement {
    const input = createElement("input", "agent-world-input") as HTMLInputElement;
    input.type = "number";
    input.min = String(min);
    input.max = String(max);
    input.step = String(step);
    input.value = String(value);
    input.addEventListener("change", () => onChange(Number(input.value)));
    return input;
  }

  function textarea(value: string, onChange: (value: string) => void): HTMLTextAreaElement {
    const input = createElement("textarea", "agent-world-textarea") as HTMLTextAreaElement;
    input.value = value;
    input.spellcheck = false;
    input.addEventListener("input", () => onChange(input.value));
    return input;
  }

  function renderEnabledPanel(shell: HTMLElement): void {
    const panel = createElement("section", "agent-world-panel");
    const title = createElement("div", "agent-world-panel-title");
    title.appendChild(createElement("h3", undefined, "Controller"));
    panel.appendChild(title);

    const form = createElement("div", "agent-world-form");

    const enabledRow = createElement("label", "agent-world-toggle") as HTMLLabelElement;
    const enabled = createElement("input") as HTMLInputElement;
    enabled.type = "checkbox";
    enabled.checked = draft.enabled;
    enabled.addEventListener("change", () => updateDraft({ enabled: enabled.checked }));
    const enabledText = createElement("div");
    enabledText.append(
      createElement("div", "agent-world-toggle-label", "Enable AgentWorld"),
      createElement("div", "agent-world-hint", "When enabled, visible chat generations receive a private director note before the main model replies."),
    );
    enabledRow.append(enabled, enabledText);
    form.appendChild(enabledRow);

    const connectionSelect = createElement("select", "agent-world-select") as HTMLSelectElement;
    connectionSelect.appendChild(new Option("Select controller connection...", ""));
    for (const connection of state?.connections ?? []) {
      connectionSelect.appendChild(new Option(connectionLabel(connection), connection.id));
    }
    connectionSelect.value = draft.connectionId ?? "";
    connectionSelect.addEventListener("change", () => {
      updateDraft({ connectionId: connectionSelect.value || null, modelOverride: "" });
      render();
    });
    form.appendChild(field("Connection", connectionSelect, "Use a Lumiverse LLM connection profile. API keys stay inside Lumiverse."));

    const modelSlot = createElement("div");
    form.appendChild(field("Model override", modelSlot, "Leave blank to use the selected connection's configured model."));
    renderModelControl(modelSlot);

    const two = createElement("div", "agent-world-two");
    two.append(
      field("Temperature", numberInput(draft.temperature, 0, 2, 0.05, (value) => updateDraft({ temperature: value }))),
      field("Max tokens", numberInput(draft.maxTokens, 64, 4096, 1, (value) => updateDraft({ maxTokens: value }))),
      field("Timeout ms", numberInput(draft.timeoutMs, 1000, 55000, 1000, (value) => updateDraft({ timeoutMs: value }))),
      field("Prompt cap chars", numberInput(draft.maxInputChars, 4000, 500000, 1000, (value) => updateDraft({ maxInputChars: value }))),
    );
    form.appendChild(two);
    panel.appendChild(form);
    shell.appendChild(panel);
  }

  function renderModelControl(slot: HTMLElement): void {
    const selected = selectedConnection();
    const components = (ctx as any).components;
    if (selected && components?.mountModelCombobox) {
      const handle = components.mountModelCombobox(slot, {
        value: draft.modelOverride,
        connection: { kind: "llm", id: selected.id },
        appearance: "standard",
        placeholder: selected.model || "model id",
        browseHint: selected.model ? `Connection default: ${selected.model}` : "No connection default model is configured.",
        onChange: (value: string) => updateDraft({ modelOverride: value }),
      }) as MountedHandle;
      componentHandles.push(handle);
      return;
    }

    const input = createElement("input", "agent-world-input") as HTMLInputElement;
    input.type = "text";
    input.placeholder = selected?.model || "model id";
    input.value = draft.modelOverride;
    input.disabled = !selected;
    input.addEventListener("input", () => updateDraft({ modelOverride: input.value }));
    slot.appendChild(input);
  }

  function renderGenerationTypes(shell: HTMLElement): void {
    const panel = createElement("section", "agent-world-panel");
    const title = createElement("div", "agent-world-panel-title");
    title.appendChild(createElement("h3", undefined, "Runs On"));
    title.appendChild(createElement("span", "agent-world-subtle", "Quiet/background jobs are skipped"));
    panel.appendChild(title);

    const grid = createElement("div", "agent-world-type-grid");
    for (const type of VISIBLE_GENERATION_TYPES) {
      const label = createElement("label", "agent-world-chip") as HTMLLabelElement;
      const input = createElement("input") as HTMLInputElement;
      input.type = "checkbox";
      input.checked = draft.generationTypes.includes(type);
      input.addEventListener("change", () => {
        const next = new Set<AgentWorldGenerationType>(draft.generationTypes);
        if (input.checked) next.add(type);
        else next.delete(type);
        updateDraft({ generationTypes: [...next] });
      });
      label.append(input, document.createTextNode(type));
      grid.appendChild(label);
    }
    panel.appendChild(grid);
    shell.appendChild(panel);
  }

  function renderTemplates(shell: HTMLElement): void {
    const details = createElement("details", "agent-world-details") as HTMLDetailsElement;
    const summary = createElement("summary", undefined, "Advanced controller prompt");
    const body = createElement("div", "agent-world-details-body");
    body.append(
      field("System template", textarea(draft.systemTemplate, (value) => updateDraft({ systemTemplate: value })), "Available variables: {{prompt}}, {{generationType}}, {{chatId}}, {{connectionId}}, {{timestamp}}, {{maxDirectiveChars}}."),
      field("User template", textarea(draft.userTemplate, (value) => updateDraft({ userTemplate: value }))),
      field("Run log limit", numberInput(draft.runLogLimit, 0, 50, 1, (value) => updateDraft({ runLogLimit: value }))),
    );
    details.append(summary, body);
    shell.appendChild(details);
  }

  function renderRuns(shell: HTMLElement): void {
    const panel = createElement("section", "agent-world-panel");
    const title = createElement("div", "agent-world-panel-title");
    title.appendChild(createElement("h3", undefined, "Recent Runs"));
    const clear = createElement("button", "agent-world-btn", "Clear");
    clear.type = "button";
    clear.addEventListener("click", () => send(ctx, { type: "clear_runs" }));
    title.appendChild(clear);
    panel.appendChild(title);

    const runs = state?.runs ?? [];
    if (!runs.length) {
      panel.appendChild(createElement("div", "agent-world-empty", "No controller runs yet."));
      shell.appendChild(panel);
      return;
    }

    const list = createElement("div", "agent-world-runs");
    for (const run of runs) {
      const item = createElement("article", "agent-world-run");
      const head = createElement("div", "agent-world-run-head");
      head.append(
        createElement("span", `agent-world-status ${run.status}`, formatStatus(run.status)),
        createElement("span", "agent-world-subtle", formatTime(run.timestamp)),
      );
      item.appendChild(head);
      const meta = [run.connectionName, run.model, run.durationMs != null ? `${Math.round(run.durationMs)} ms` : null]
        .filter(Boolean)
        .join(" / ");
      if (meta) item.appendChild(createElement("div", "agent-world-subtle", meta));
      if (run.directivePreview) item.appendChild(createElement("div", undefined, run.directivePreview));
      if (run.error) item.appendChild(createElement("div", "agent-world-subtle", run.error));
      list.appendChild(item);
    }
    panel.appendChild(list);
    shell.appendChild(panel);
  }

  function renderNotice(shell: HTMLElement): void {
    if (!notice) return;
    const banner = createElement("div", `agent-world-banner ${notice.tone === "warn" || notice.tone === "error" ? "warn" : ""}`, notice.text);
    shell.appendChild(banner);
  }

  function renderBanners(shell: HTMLElement): void {
    if (!state) return;
    if (!state.permissions.interceptor || !state.permissions.generation) {
      shell.appendChild(
        createElement(
          "div",
          "agent-world-banner warn",
          "Grant the Interceptor and Generation permissions in Lumiverse's Extensions panel to activate AgentWorld.",
        ),
      );
    }
    if (draft.enabled && !draft.connectionId) {
      shell.appendChild(createElement("div", "agent-world-banner warn", "AgentWorld is enabled but no controller connection is selected."));
    }
  }

  function renderToolbar(shell: HTMLElement): void {
    const toolbar = createElement("div", "agent-world-toolbar");
    const title = createElement("div", "agent-world-title");
    const mark = createElement("span", "agent-world-mark");
    mark.innerHTML = AGENTWORLD_ICON;
    const text = createElement("div");
    text.append(createElement("h2", "agent-world-heading", EXTENSION_NAME), createElement("div", "agent-world-subtle", "Private world-director prompt interceptor"));
    title.append(mark, text);

    const actions = createElement("div", "agent-world-actions");
    const refresh = createElement("button", "agent-world-btn", "Refresh");
    refresh.type = "button";
    refresh.addEventListener("click", () => send(ctx, { type: "refresh_state" }));
    const test = createElement("button", "agent-world-btn", "Test");
    test.type = "button";
    test.addEventListener("click", () => {
      notice = { tone: "info", text: "Running controller test..." };
      render();
      send(ctx, { type: "test_controller", settings: draft });
    });
    const save = createElement("button", "agent-world-btn agent-world-btn-primary", dirty ? "Save" : "Saved");
    save.type = "button";
    save.disabled = !dirty;
    save.addEventListener("click", () => {
      dirty = false;
      setDirty(tab, false);
      send(ctx, { type: "save_settings", settings: draft });
      render();
    });
    actions.append(refresh, test, save);
    toolbar.append(title, actions);
    shell.appendChild(toolbar);
  }

  function render(): void {
    destroyComponents();
    tab.root.replaceChildren();

    const root = createElement("div", "agent-world-root");
    const shell = createElement("div", "agent-world-shell");
    root.appendChild(shell);
    tab.root.appendChild(root);

    renderToolbar(shell);
    renderNotice(shell);

    if (!state) {
      shell.appendChild(createElement("div", "agent-world-empty", "Loading AgentWorld settings..."));
      return;
    }

    renderBanners(shell);
    renderEnabledPanel(shell);
    renderGenerationTypes(shell);
    renderTemplates(shell);
    renderRuns(shell);
  }

  const onBackendMessage = ctx.onBackendMessage((raw) => {
    const message = raw as BackendToFrontend;
    switch (message.type) {
      case "state":
        state = message.state;
        if (!dirty) {
          draft = cloneSettings(message.state.settings);
        }
        render();
        break;
      case "settings_saved":
        dirty = false;
        setDirty(tab, false);
        draft = cloneSettings(message.settings);
        notice = { tone: "success", text: "AgentWorld settings saved." };
        render();
        break;
      case "run_logged":
        if (state) {
          state = { ...state, runs: [message.run, ...state.runs].slice(0, draft.runLogLimit) };
          render();
        }
        break;
      case "test_result":
        notice = message.ok
          ? { tone: "success", text: `Controller test succeeded on ${message.connectionName} / ${message.model}: ${message.directive}` }
          : { tone: "error", text: `Controller test failed: ${message.error}` };
        render();
        break;
      case "error":
        notice = { tone: "error", text: message.message };
        render();
        break;
    }
  });
  cleanups.push(onBackendMessage);

  const events = (ctx as any).events;
  if (events?.on) {
    cleanups.push(
      events.on("CHAT_CHANGED", (payload: unknown) => send(ctx, { type: "refresh_state", chatId: readChatId(payload) })),
    );
  }

  send(ctx, { type: "ready" });
  render();

  return () => {
    destroyComponents();
    for (const cleanup of cleanups.reverse()) {
      try {
        cleanup();
      } catch {
        // ignore cleanup errors during extension unload
      }
    }
  };
}
