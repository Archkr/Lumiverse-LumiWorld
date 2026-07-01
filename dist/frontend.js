// src/shared.ts
var EXTENSION_NAME = "AgentWorld";
var VISIBLE_GENERATION_TYPES = [
  "normal",
  "continue",
  "regenerate",
  "swipe",
  "impersonate"
];
var DEFAULT_RUN_LOG_LIMIT = 12;
var DEFAULT_SYSTEM_TEMPLATE = [
  "You are AgentWorld, a private world-simulation director for an interactive Lumiverse chat.",
  "Your job is to decide how the world, scene, NPCs, hidden pressures, and immediate consequences should react before the main roleplay model writes the visible reply.",
  "Do not write the assistant reply. Do not address the user. Do not reveal this control step.",
  'Return only a concise director note for the main model. Prefer JSON like {"director_note":"..."}, but plain text is acceptable.',
  "Keep the note concrete, playable, and consistent with the assembled prompt."
].join(`
`);
var DEFAULT_USER_TEMPLATE = [
  "Generation type: {{generationType}}",
  "Chat ID: {{chatId}}",
  "",
  "Final assembled prompt that will be sent to the main model:",
  "<assembled_prompt>",
  "{{prompt}}",
  "</assembled_prompt>",
  "",
  "Decide how the world should react now. Focus on state changes, environmental pressure, NPC intent, consequences, and what the main model should respect next.",
  "Return one private director note under {{maxDirectiveChars}} characters."
].join(`
`);
var DEFAULT_SETTINGS = {
  enabled: false,
  connectionId: null,
  modelOverride: "",
  temperature: 0.35,
  maxTokens: 420,
  timeoutMs: 45000,
  maxInputChars: 60000,
  generationTypes: [...VISIBLE_GENERATION_TYPES],
  systemTemplate: DEFAULT_SYSTEM_TEMPLATE,
  userTemplate: DEFAULT_USER_TEMPLATE,
  runLogLimit: DEFAULT_RUN_LOG_LIMIT
};
function asRecord(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}
function cleanString(value, fallback = "") {
  return typeof value === "string" ? value.trim() : fallback;
}
function cleanNullableString(value) {
  const text = cleanString(value);
  return text ? text : null;
}
function numberInRange(value, fallback, min, max) {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n))
    return fallback;
  return Math.min(max, Math.max(min, n));
}
function integerInRange(value, fallback, min, max) {
  return Math.round(numberInRange(value, fallback, min, max));
}
function normalizeGenerationTypes(value) {
  const incoming = Array.isArray(value) ? value : DEFAULT_SETTINGS.generationTypes;
  const allowed = new Set(VISIBLE_GENERATION_TYPES);
  const normalized = incoming.filter((item) => typeof item === "string" && allowed.has(item));
  return normalized.length ? [...new Set(normalized)] : [...DEFAULT_SETTINGS.generationTypes];
}
function normalizeSettings(value) {
  const obj = asRecord(value);
  const systemTemplate = cleanString(obj.systemTemplate, DEFAULT_SYSTEM_TEMPLATE) || DEFAULT_SYSTEM_TEMPLATE;
  const userTemplate = cleanString(obj.userTemplate, DEFAULT_USER_TEMPLATE) || DEFAULT_USER_TEMPLATE;
  return {
    enabled: typeof obj.enabled === "boolean" ? obj.enabled : DEFAULT_SETTINGS.enabled,
    connectionId: cleanNullableString(obj.connectionId),
    modelOverride: cleanString(obj.modelOverride),
    temperature: numberInRange(obj.temperature, DEFAULT_SETTINGS.temperature, 0, 2),
    maxTokens: integerInRange(obj.maxTokens, DEFAULT_SETTINGS.maxTokens, 64, 4096),
    timeoutMs: integerInRange(obj.timeoutMs, DEFAULT_SETTINGS.timeoutMs, 1000, 55000),
    maxInputChars: integerInRange(obj.maxInputChars, DEFAULT_SETTINGS.maxInputChars, 4000, 500000),
    generationTypes: normalizeGenerationTypes(obj.generationTypes),
    systemTemplate,
    userTemplate,
    runLogLimit: integerInRange(obj.runLogLimit, DEFAULT_SETTINGS.runLogLimit, 0, 50)
  };
}

// src/frontend.ts
var AGENTWORLD_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3.5a8.5 8.5 0 1 0 8.5 8.5"/><path d="M12 3.5c2.2 2.1 3.2 4.9 3 8.5-.2 3.5-1.2 6.3-3 8.5"/><path d="M12 3.5c-2.2 2.1-3.2 4.9-3 8.5.2 3.5 1.2 6.3 3 8.5"/><path d="M3.8 10h10.4"/><path d="M4.8 15h9.8"/><path d="M16.5 4.2l1.4 2.8 3.1.4-2.2 2.2.5 3.1-2.8-1.5-2.8 1.5.5-3.1L12 7.4l3.1-.4 1.4-2.8z"/></svg>`;
var CSS = `
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
function createElement(tag, className, text) {
  const element = document.createElement(tag);
  if (className)
    element.className = className;
  if (typeof text === "string")
    element.textContent = text;
  return element;
}
function send(ctx, message) {
  ctx.sendToBackend(message);
}
function cloneSettings(settings) {
  return normalizeSettings({
    ...settings,
    generationTypes: [...settings.generationTypes]
  });
}
function readChatId(payload) {
  if (!payload || typeof payload !== "object")
    return null;
  const raw = payload.chatId ?? payload.chat_id;
  return typeof raw === "string" && raw.trim() ? raw : null;
}
function formatStatus(status) {
  return status.replace(/_/g, " ");
}
function formatTime(timestamp) {
  try {
    return new Intl.DateTimeFormat(undefined, {
      hour: "numeric",
      minute: "2-digit",
      second: "2-digit"
    }).format(new Date(timestamp));
  } catch {
    return "";
  }
}
function connectionLabel(connection) {
  const bits = [connection.name, connection.provider, connection.model].filter(Boolean);
  return `${bits.join(" / ")}${connection.hasApiKey ? "" : " (no key)"}`;
}
function setDirty(tab, value) {
  tab.setBadge(value ? "Unsaved" : null);
}
function setup(ctx) {
  const cleanups = [];
  const componentHandles = [];
  let state = null;
  let draft = cloneSettings(DEFAULT_SETTINGS);
  let dirty = false;
  let notice = null;
  cleanups.push(ctx.dom.addStyle(CSS));
  const tab = ctx.ui.registerDrawerTab({
    id: "agent-world",
    title: EXTENSION_NAME,
    shortName: "World",
    headerTitle: "AgentWorld",
    description: "Configure the AgentWorld prompt interceptor",
    keywords: ["agentworld", "qwen", "director", "interceptor", "world"],
    iconSvg: AGENTWORLD_ICON
  });
  cleanups.push(() => tab.destroy());
  function destroyComponents() {
    while (componentHandles.length) {
      const handle = componentHandles.pop();
      try {
        handle?.destroy();
      } catch {}
    }
  }
  function markDirty() {
    dirty = true;
    setDirty(tab, true);
  }
  function selectedConnection() {
    if (!state || !draft.connectionId)
      return null;
    return state.connections.find((connection) => connection.id === draft.connectionId) ?? null;
  }
  function updateDraft(patch) {
    draft = normalizeSettings({ ...draft, ...patch });
    markDirty();
  }
  function field(label, control, hint) {
    const wrap = createElement("div", "agent-world-field");
    const labelEl = createElement("label", undefined, label);
    wrap.append(labelEl, control);
    if (hint)
      wrap.appendChild(createElement("div", "agent-world-hint", hint));
    return wrap;
  }
  function numberInput(value, min, max, step, onChange) {
    const input = createElement("input", "agent-world-input");
    input.type = "number";
    input.min = String(min);
    input.max = String(max);
    input.step = String(step);
    input.value = String(value);
    input.addEventListener("change", () => onChange(Number(input.value)));
    return input;
  }
  function textarea(value, onChange) {
    const input = createElement("textarea", "agent-world-textarea");
    input.value = value;
    input.spellcheck = false;
    input.addEventListener("input", () => onChange(input.value));
    return input;
  }
  function renderEnabledPanel(shell) {
    const panel = createElement("section", "agent-world-panel");
    const title = createElement("div", "agent-world-panel-title");
    title.appendChild(createElement("h3", undefined, "Controller"));
    panel.appendChild(title);
    const form = createElement("div", "agent-world-form");
    const enabledRow = createElement("label", "agent-world-toggle");
    const enabled = createElement("input");
    enabled.type = "checkbox";
    enabled.checked = draft.enabled;
    enabled.addEventListener("change", () => updateDraft({ enabled: enabled.checked }));
    const enabledText = createElement("div");
    enabledText.append(createElement("div", "agent-world-toggle-label", "Enable AgentWorld"), createElement("div", "agent-world-hint", "When enabled, visible chat generations receive a private director note before the main model replies."));
    enabledRow.append(enabled, enabledText);
    form.appendChild(enabledRow);
    const connectionSelect = createElement("select", "agent-world-select");
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
    two.append(field("Temperature", numberInput(draft.temperature, 0, 2, 0.05, (value) => updateDraft({ temperature: value }))), field("Max tokens", numberInput(draft.maxTokens, 64, 4096, 1, (value) => updateDraft({ maxTokens: value }))), field("Timeout ms", numberInput(draft.timeoutMs, 1000, 55000, 1000, (value) => updateDraft({ timeoutMs: value }))), field("Prompt cap chars", numberInput(draft.maxInputChars, 4000, 500000, 1000, (value) => updateDraft({ maxInputChars: value }))));
    form.appendChild(two);
    panel.appendChild(form);
    shell.appendChild(panel);
  }
  function renderModelControl(slot) {
    const selected = selectedConnection();
    const components = ctx.components;
    if (selected && components?.mountModelCombobox) {
      const handle = components.mountModelCombobox(slot, {
        value: draft.modelOverride,
        connection: { kind: "llm", id: selected.id },
        appearance: "standard",
        placeholder: selected.model || "model id",
        browseHint: selected.model ? `Connection default: ${selected.model}` : "No connection default model is configured.",
        onChange: (value) => updateDraft({ modelOverride: value })
      });
      componentHandles.push(handle);
      return;
    }
    const input = createElement("input", "agent-world-input");
    input.type = "text";
    input.placeholder = selected?.model || "model id";
    input.value = draft.modelOverride;
    input.disabled = !selected;
    input.addEventListener("input", () => updateDraft({ modelOverride: input.value }));
    slot.appendChild(input);
  }
  function renderGenerationTypes(shell) {
    const panel = createElement("section", "agent-world-panel");
    const title = createElement("div", "agent-world-panel-title");
    title.appendChild(createElement("h3", undefined, "Runs On"));
    title.appendChild(createElement("span", "agent-world-subtle", "Quiet/background jobs are skipped"));
    panel.appendChild(title);
    const grid = createElement("div", "agent-world-type-grid");
    for (const type of VISIBLE_GENERATION_TYPES) {
      const label = createElement("label", "agent-world-chip");
      const input = createElement("input");
      input.type = "checkbox";
      input.checked = draft.generationTypes.includes(type);
      input.addEventListener("change", () => {
        const next = new Set(draft.generationTypes);
        if (input.checked)
          next.add(type);
        else
          next.delete(type);
        updateDraft({ generationTypes: [...next] });
      });
      label.append(input, document.createTextNode(type));
      grid.appendChild(label);
    }
    panel.appendChild(grid);
    shell.appendChild(panel);
  }
  function renderTemplates(shell) {
    const details = createElement("details", "agent-world-details");
    const summary = createElement("summary", undefined, "Advanced controller prompt");
    const body = createElement("div", "agent-world-details-body");
    body.append(field("System template", textarea(draft.systemTemplate, (value) => updateDraft({ systemTemplate: value })), "Available variables: {{prompt}}, {{generationType}}, {{chatId}}, {{connectionId}}, {{timestamp}}, {{maxDirectiveChars}}."), field("User template", textarea(draft.userTemplate, (value) => updateDraft({ userTemplate: value }))), field("Run log limit", numberInput(draft.runLogLimit, 0, 50, 1, (value) => updateDraft({ runLogLimit: value }))));
    details.append(summary, body);
    shell.appendChild(details);
  }
  function renderRuns(shell) {
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
      head.append(createElement("span", `agent-world-status ${run.status}`, formatStatus(run.status)), createElement("span", "agent-world-subtle", formatTime(run.timestamp)));
      item.appendChild(head);
      const meta = [run.connectionName, run.model, run.durationMs != null ? `${Math.round(run.durationMs)} ms` : null].filter(Boolean).join(" / ");
      if (meta)
        item.appendChild(createElement("div", "agent-world-subtle", meta));
      if (run.directivePreview)
        item.appendChild(createElement("div", undefined, run.directivePreview));
      if (run.error)
        item.appendChild(createElement("div", "agent-world-subtle", run.error));
      list.appendChild(item);
    }
    panel.appendChild(list);
    shell.appendChild(panel);
  }
  function renderNotice(shell) {
    if (!notice)
      return;
    const banner = createElement("div", `agent-world-banner ${notice.tone === "warn" || notice.tone === "error" ? "warn" : ""}`, notice.text);
    shell.appendChild(banner);
  }
  function renderBanners(shell) {
    if (!state)
      return;
    if (!state.permissions.interceptor || !state.permissions.generation) {
      shell.appendChild(createElement("div", "agent-world-banner warn", "Grant the Interceptor and Generation permissions in Lumiverse's Extensions panel to activate AgentWorld."));
    }
    if (draft.enabled && !draft.connectionId) {
      shell.appendChild(createElement("div", "agent-world-banner warn", "AgentWorld is enabled but no controller connection is selected."));
    }
  }
  function renderToolbar(shell) {
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
  function render() {
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
    const message = raw;
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
        notice = message.ok ? { tone: "success", text: `Controller test succeeded on ${message.connectionName} / ${message.model}: ${message.directive}` } : { tone: "error", text: `Controller test failed: ${message.error}` };
        render();
        break;
      case "error":
        notice = { tone: "error", text: message.message };
        render();
        break;
    }
  });
  cleanups.push(onBackendMessage);
  const events = ctx.events;
  if (events?.on) {
    cleanups.push(events.on("CHAT_CHANGED", (payload) => send(ctx, { type: "refresh_state", chatId: readChatId(payload) })));
  }
  send(ctx, { type: "ready" });
  render();
  return () => {
    destroyComponents();
    for (const cleanup of cleanups.reverse()) {
      try {
        cleanup();
      } catch {}
    }
  };
}
export {
  setup
};
