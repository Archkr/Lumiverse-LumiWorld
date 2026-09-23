// src/shared.ts
var VISIBLE_GENERATION_TYPES = [
  "normal",
  "continue",
  "regenerate",
  "swipe",
  "impersonate"
];
var MAX_CONTROLLER_OUTPUT_TOKENS = Number.MAX_SAFE_INTEGER;
var MAX_DIRECTOR_TIMEOUT_MS = 300000;
var MAX_CHAT_HISTORY_MESSAGES = Number.MAX_SAFE_INTEGER;
var DEFAULT_RUN_LOG_LIMIT = 12;
var DEFAULT_HISTORY_MESSAGE_LIMIT = 12;
var LEGACY_DEFAULT_SYSTEM_TEMPLATE = [
  "You are AgentWorld, a private world-simulation director for an interactive Lumiverse chat.",
  "Your job is to decide how the world, scene, NPCs, hidden pressures, and immediate consequences should react before the main roleplay model writes the visible reply.",
  "Do not write the assistant reply. Do not address the user. Do not reveal this control step.",
  'Return only a concise director note for the main model. Prefer JSON like {"director_note":"..."}, but plain text is acceptable.',
  "Keep the note concrete, playable, and consistent with the assembled prompt."
].join(`
`);
var LEGACY_DEFAULT_USER_TEMPLATE = [
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
var PREVIOUS_DEFAULT_SYSTEM_TEMPLATE = [
  "You are AgentWorld, a private world-simulation director for an interactive Lumiverse chat.",
  "Your job is to decide how the world, scene, NPCs, hidden pressures, and immediate consequences should react before the main roleplay model writes the visible reply.",
  "Do not write the assistant reply. Do not address the user. Do not reveal this control step.",
  'Return only a concise director note for the main model. Prefer JSON like {"director_note":"..."}, but plain text is acceptable.',
  "Keep the note concrete, playable, and consistent with the recent chat history and any additional notes."
].join(`
`);
var PREVIOUS_DEFAULT_USER_TEMPLATE = [
  "Generation type: {{generationType}}",
  "Chat ID: {{chatId}}",
  "",
  "Recent chat history available to the controller:",
  "<chat_history>",
  "{{prompt}}",
  "</chat_history>",
  "",
  "Decide how the world should react now. Focus on state changes, environmental pressure, NPC intent, consequences, and what the main model should respect next.",
  "Return one private director note under {{maxDirectiveChars}} characters."
].join(`
`);
var PRE_REBRAND_DEFAULT_SYSTEM_TEMPLATE = [
  "You are AgentWorld, a private world-state director for an interactive Lumiverse chat.",
  "",
  "Your job is to advance the world behind the next visible reply.",
  "",
  "Do not recap what already happened. Do not restate recent dialogue. Do not explain lore. Do not open with character names or summaries.",
  "",
  "Write only the next world-state directive:",
  "- what changes in the environment, situation, systems, factions, observers, or hidden risk",
  "- how that pressure forces NPCs to act now",
  "- what the main model should show in the next reply",
  "- what must remain unresolved or unrevealed",
  "",
  'Use imperative language. Start with a verb such as "Make", "Let", "Have", "Keep", "Escalate", "Pressure", or "Treat".',
  "",
  "The directive should feel like the world moving forward, not a recap of the scene.",
  "",
  "Return only one private directive for the next visible reply. Do not write the visible assistant reply. Do not address the user. Do not mention AgentWorld, the controller, this prompt, or the directive.",
  "",
  "Prefer JSON exactly like:",
  '{"director_note":"..."}',
  "",
  "Plain text is acceptable if needed. Keep it under {{maxDirectiveChars}} characters."
].join(`
`);
var DEFAULT_SYSTEM_TEMPLATE = [
  "You are LumiWorld, a private world-state director for an interactive Lumiverse chat.",
  "",
  "Your job is to advance the world behind the next visible reply.",
  "",
  "Do not recap what already happened. Do not restate recent dialogue. Do not explain lore. Do not open with character names or summaries.",
  "",
  "Write only the next world-state directive:",
  "- what changes in the environment, situation, systems, factions, observers, or hidden risk",
  "- how that pressure forces NPCs to act now",
  "- what the main model should show in the next reply",
  "- what must remain unresolved or unrevealed",
  "",
  'Use imperative language. Start with a verb such as "Make", "Let", "Have", "Keep", "Escalate", "Pressure", or "Treat".',
  "",
  "The directive should feel like the world moving forward, not a recap of the scene.",
  "",
  "Return only one private directive for the next visible reply. Do not write the visible assistant reply. Do not address the user. Do not mention LumiWorld, the controller, this prompt, or the directive.",
  "",
  "Prefer JSON exactly like:",
  '{"director_note":"..."}',
  "",
  "Plain text is acceptable if needed. Keep it under {{maxDirectiveChars}} characters."
].join(`
`);
var PRE_CONTEXT_DEFAULT_USER_TEMPLATE = [
  "Generation type: {{generationType}}",
  "",
  "Recent chat history:",
  "<chat_history>",
  "{{prompt}}",
  "</chat_history>",
  "",
  "Write the next world-state directive now.",
  "",
  'Start with a verb. No recap. No review. No explanation. No "has just" framing.'
].join(`
`);
var DEFAULT_USER_TEMPLATE = [
  "Generation type: {{generationType}}",
  "",
  "Controller context:",
  "<controller_context>",
  "{{prompt}}",
  "</controller_context>",
  "",
  "Write the next world-state directive now.",
  "",
  'Start with a verb. No recap. No review. No explanation. No "has just" framing.'
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
  historyMessageLimit: DEFAULT_HISTORY_MESSAGE_LIMIT,
  includeWorldInfoEntries: false,
  includeUserPersona: true,
  includeCharacter: true,
  generationTypes: [...VISIBLE_GENERATION_TYPES],
  additionalNotes: "",
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
  return Array.isArray(value) ? [...new Set(normalized)] : [...DEFAULT_SETTINGS.generationTypes];
}
function normalizeSettings(value) {
  const obj = asRecord(value);
  const storedSystemTemplate = cleanString(obj.systemTemplate, DEFAULT_SYSTEM_TEMPLATE);
  const storedUserTemplate = cleanString(obj.userTemplate, DEFAULT_USER_TEMPLATE);
  const systemTemplate = !storedSystemTemplate || storedSystemTemplate === LEGACY_DEFAULT_SYSTEM_TEMPLATE || storedSystemTemplate === PREVIOUS_DEFAULT_SYSTEM_TEMPLATE || storedSystemTemplate === PRE_REBRAND_DEFAULT_SYSTEM_TEMPLATE ? DEFAULT_SYSTEM_TEMPLATE : storedSystemTemplate;
  const userTemplate = !storedUserTemplate || storedUserTemplate === LEGACY_DEFAULT_USER_TEMPLATE || storedUserTemplate === PREVIOUS_DEFAULT_USER_TEMPLATE || storedUserTemplate === PRE_CONTEXT_DEFAULT_USER_TEMPLATE ? DEFAULT_USER_TEMPLATE : storedUserTemplate;
  return {
    enabled: typeof obj.enabled === "boolean" ? obj.enabled : DEFAULT_SETTINGS.enabled,
    connectionId: cleanNullableString(obj.connectionId),
    modelOverride: cleanString(obj.modelOverride),
    temperature: numberInRange(obj.temperature, DEFAULT_SETTINGS.temperature, 0, 2),
    maxTokens: integerInRange(obj.maxTokens, DEFAULT_SETTINGS.maxTokens, 64, MAX_CONTROLLER_OUTPUT_TOKENS),
    timeoutMs: integerInRange(obj.timeoutMs, DEFAULT_SETTINGS.timeoutMs, 1000, MAX_DIRECTOR_TIMEOUT_MS),
    maxInputChars: integerInRange(obj.maxInputChars, DEFAULT_SETTINGS.maxInputChars, 4000, 500000),
    historyMessageLimit: integerInRange(obj.historyMessageLimit, DEFAULT_SETTINGS.historyMessageLimit, 0, MAX_CHAT_HISTORY_MESSAGES),
    includeWorldInfoEntries: typeof obj.includeWorldInfoEntries === "boolean" ? obj.includeWorldInfoEntries : DEFAULT_SETTINGS.includeWorldInfoEntries,
    includeUserPersona: typeof obj.includeUserPersona === "boolean" ? obj.includeUserPersona : DEFAULT_SETTINGS.includeUserPersona,
    includeCharacter: typeof obj.includeCharacter === "boolean" ? obj.includeCharacter : DEFAULT_SETTINGS.includeCharacter,
    generationTypes: normalizeGenerationTypes(obj.generationTypes),
    additionalNotes: cleanString(obj.additionalNotes),
    systemTemplate,
    userTemplate,
    runLogLimit: integerInRange(obj.runLogLimit, DEFAULT_SETTINGS.runLogLimit, 0, 50)
  };
}

// src/frontend.ts
var VERSION = "0.4.0";
var ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M5 17.5c2.7 1.7 6.2 1.7 9 0 3.1-1.9 4.3-5.7 2.7-8.9"/><path d="M4.4 12.2c.4-3.3 3.2-5.9 6.6-5.9 1.9 0 3.6.8 4.8 2"/><path d="M18 4.5l.8 1.7 1.9.3-1.3 1.3.3 1.9-1.7-.9-1.7.9.3-1.9-1.3-1.3 1.9-.3.8-1.7z"/><path d="M7 13h6"/></svg>`;
var LABELS = {
  normal: "New reply",
  continue: "Continue",
  regenerate: "Regenerate",
  swipe: "Swipe",
  impersonate: "Impersonate"
};
var CSS = `
.lw-root { box-sizing:border-box; width:100%; padding:16px; color:var(--lumiverse-text); background:var(--lumiverse-bg,transparent); font:13px/1.5 var(--lumiverse-font-family,system-ui,sans-serif); }
.lw-root * { box-sizing:border-box; }
.lw-shell { max-width:720px; margin:0 auto; display:grid; gap:14px; }
.lw-header { display:flex; align-items:flex-start; justify-content:space-between; gap:12px; }
.lw-statuses { display:flex; flex-wrap:wrap; justify-content:flex-end; gap:5px; }
.lw-brand { display:flex; align-items:center; gap:10px; min-width:0; }
.lw-icon { display:grid; place-items:center; width:32px; height:32px; flex:none; border-radius:10px; color:var(--lumiverse-accent); background:var(--lumiverse-fill-subtle); border:1px solid var(--lumiverse-border); }
.lw-icon svg { width:22px; height:22px; }
.lw-title { margin:0; font-size:16px; line-height:1.2; font-weight:700; }
.lw-version { color:var(--lumiverse-text-dim); font-size:11px; }
.lw-intro { margin:0; color:var(--lumiverse-text-dim); }
.lw-card { min-width:0; padding:14px; border:1px solid var(--lumiverse-border); border-radius:var(--lumiverse-radius,12px); background:var(--lumiverse-fill,transparent); }
.lw-card h2 { margin:0 0 11px; font-size:13px; font-weight:700; }
.lw-stack { display:grid; gap:12px; }
.lw-row { display:flex; align-items:center; justify-content:space-between; gap:12px; }
.lw-row-copy { min-width:0; }
.lw-row-title { font-weight:650; }
.lw-hint { margin-top:3px; color:var(--lumiverse-text-dim); font-size:12px; }
.lw-field { display:grid; gap:5px; min-width:0; }
.lw-field > label, .lw-field > legend { color:var(--lumiverse-text); font-weight:600; }
.lw-fields { display:grid; gap:12px; grid-template-columns:repeat(auto-fit,minmax(min(100%,210px),1fr)); }
.lw-control { min-width:0; }
.lw-input, .lw-textarea, .lw-select { width:100%; min-height:36px; padding:8px 10px; border:1px solid var(--lumiverse-border); border-radius:var(--lumiverse-radius,9px); background:var(--lumiverse-fill-subtle); color:var(--lumiverse-text); font:inherit; }
.lw-textarea { min-height:112px; resize:vertical; }
.lw-template { min-height:200px; font:12px/1.45 ui-monospace,SFMono-Regular,Consolas,monospace; }
.lw-actions { display:flex; flex-wrap:wrap; align-items:center; gap:8px; }
.lw-button { min-height:36px; padding:8px 12px; border:1px solid var(--lumiverse-border); border-radius:var(--lumiverse-radius,9px); color:var(--lumiverse-text); background:var(--lumiverse-fill-subtle); font:inherit; font-weight:600; cursor:pointer; }
.lw-button:hover:not(:disabled) { background:var(--lumiverse-fill-hover,var(--lumiverse-fill)); }
.lw-button:disabled { opacity:.5; cursor:not-allowed; }
.lw-button-primary { border-color:var(--lumiverse-accent); background:var(--lumiverse-accent); color:var(--lumiverse-primary-contrast,#fff); }
.lw-button-primary:hover:not(:disabled) { background:var(--lumiverse-primary-hover,var(--lumiverse-accent)); }
.lw-badge { display:inline-flex; align-items:center; min-height:24px; padding:2px 8px; border-radius:999px; border:1px solid var(--lumiverse-border); background:var(--lumiverse-fill-subtle); color:var(--lumiverse-text-dim); font-size:11px; font-weight:650; white-space:nowrap; }
.lw-badge[data-tone="success"] { color:var(--lumiverse-success,#22a66b); }
.lw-badge[data-tone="error"] { color:var(--lumiverse-danger,#ef4444); }
.lw-badge[data-tone="warning"] { color:var(--lumiverse-warning,#d99a20); }
.lw-notice { padding:10px 12px; border:1px solid var(--lumiverse-border); border-left:3px solid var(--lumiverse-accent); border-radius:8px; background:var(--lumiverse-fill-subtle); overflow-wrap:anywhere; }
.lw-notice[data-tone="error"] { border-left-color:var(--lumiverse-danger,#ef4444); }
.lw-notice[data-tone="warning"] { border-left-color:var(--lumiverse-warning,#d99a20); }
.lw-notice[data-tone="success"] { border-left-color:var(--lumiverse-success,#22a66b); }
.lw-notice + .lw-notice { margin-top:8px; }
.lw-options { display:grid; gap:8px; grid-template-columns:repeat(auto-fit,minmax(min(100%,150px),1fr)); }
.lw-option { display:flex; align-items:center; gap:7px; min-height:36px; padding:7px 9px; border:1px solid var(--lumiverse-border); border-radius:9px; cursor:pointer; }
.lw-option:has(input:checked) { border-color:var(--lumiverse-accent); background:var(--lumiverse-fill-subtle); }
.lw-option input { accent-color:var(--lumiverse-accent); }
.lw-activity { display:grid; gap:0; }
.lw-run { display:grid; grid-template-columns:1fr auto; gap:2px 8px; padding:9px 0; border-top:1px solid var(--lumiverse-border); }
.lw-run:first-child { border-top:0; padding-top:0; }
.lw-run-title { font-weight:600; }
.lw-run-time, .lw-run-detail, .lw-empty { color:var(--lumiverse-text-dim); font-size:12px; }
.lw-run-detail { grid-column:1/-1; overflow-wrap:anywhere; }
.lw-details { border:1px solid var(--lumiverse-border); border-radius:var(--lumiverse-radius,12px); background:var(--lumiverse-fill,transparent); }
.lw-details > summary { padding:13px 14px; cursor:pointer; font-weight:700; }
.lw-details > .lw-details-body { padding:0 14px 14px; display:grid; gap:14px; }
.lw-loading { padding:16px; color:var(--lumiverse-text-dim); }
.lw-root :is(button,input,select,textarea,summary):focus-visible { outline:2px solid var(--lumiverse-accent); outline-offset:2px; }
@media (max-width:420px) { .lw-root { padding:12px; } .lw-card { padding:12px; } .lw-header { align-items:flex-start; } }
@media (prefers-reduced-motion:reduce) { .lw-root * { scroll-behavior:auto!important; transition:none!important; } }
`;
function normalizeFrontendSettings(value) {
  return normalizeSettings(value);
}
function directorRuns(runs, limit = 5) {
  return runs.filter((run) => run.channel !== "world_agent").sort((a, b) => b.timestamp - a.timestamp).slice(0, limit);
}

class SettingsSaveQueue {
  revision = 0;
  savedRevision = 0;
  inFlightRevision = null;
  markDirty() {
    return ++this.revision;
  }
  begin() {
    if (this.inFlightRevision !== null || !this.isDirty)
      return null;
    this.inFlightRevision = this.revision;
    return this.inFlightRevision;
  }
  acknowledge(revision) {
    if (this.inFlightRevision !== revision)
      return this.isDirty;
    this.savedRevision = Math.max(this.savedRevision, revision);
    this.inFlightRevision = null;
    return this.isDirty;
  }
  fail(revision) {
    if (this.inFlightRevision === revision)
      this.inFlightRevision = null;
    return this.isDirty;
  }
  get isInFlight() {
    return this.inFlightRevision !== null;
  }
  get isDirty() {
    return this.revision > this.savedRevision;
  }
}
function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className)
    node.className = className;
  if (text)
    node.textContent = text;
  return node;
}
function button(label, handler, primary = false) {
  const node = el("button", `lw-button${primary ? " lw-button-primary" : ""}`, label);
  node.type = "button";
  node.addEventListener("click", handler);
  return node;
}
function activeChat(ctx) {
  try {
    return ctx.getActiveChat();
  } catch {
    return { chatId: null, characterId: null };
  }
}
function setup(ctx) {
  const cleanups = [];
  const handles = [];
  const queue = new SettingsSaveQueue;
  let pending = [];
  let state = null;
  let draft = normalizeFrontendSettings(DEFAULT_SETTINGS);
  let saveState = "saved";
  let notice = null;
  let noticeTimer = null;
  let saveTimer = null;
  let testPending = false;
  let advancedOpen = false;
  let templatesOpen = false;
  let nextFieldId = 0;
  cleanups.push(ctx.dom.addStyle(CSS));
  const drawer = ctx.ui.registerDrawerTab({
    id: "lumi-world",
    title: "LumiWorld",
    shortName: "Director",
    headerTitle: "LumiWorld",
    description: "Private Director notes for chat replies",
    keywords: ["lumiworld", "director", "prompt"],
    iconSvg: ICON
  });
  cleanups.push(() => drawer.destroy());
  function send(message) {
    ctx.sendToBackend({ ...activeChat(ctx), ...message });
  }
  function destroyHandles() {
    while (handles.length)
      try {
        handles.pop()?.destroy();
      } catch {}
  }
  function queueMount(mount, fallback) {
    pending.push({ mount, fallback });
  }
  function flushMounts() {
    while (pending.length) {
      const task = pending.shift();
      try {
        handles.push(task.mount());
      } catch (error) {
        console.warn("[LumiWorld] Shared control unavailable.", error);
        task.fallback();
      }
    }
  }
  function updateSaveStatus() {
    const badge = drawer.root.querySelector("[data-lw-save-status]");
    if (badge) {
      badge.textContent = saveState === "saving" ? "Saving…" : saveState === "error" ? "Save failed" : "Saved";
      badge.dataset.tone = saveState === "error" ? "error" : saveState === "saving" ? "warning" : "success";
    }
    const retry = drawer.root.querySelector("[data-lw-retry]");
    if (retry)
      retry.hidden = saveState !== "error";
    drawer.setBadge(saveState === "error" ? "Error" : saveState === "saving" ? "Saving" : null);
  }
  function updateDirectorStatus() {
    const badge = drawer.root.querySelector("[data-lw-director-status]");
    if (!badge)
      return;
    const ready = draft.enabled && !!state?.permissions.interceptor && canTest() && draft.generationTypes.length > 0;
    badge.textContent = !draft.enabled ? "Off" : ready ? "Ready" : "Needs setup";
    badge.dataset.tone = ready ? "success" : draft.enabled ? "warning" : "neutral";
  }
  function showNotice(next, ttl = 1e4) {
    if (noticeTimer)
      clearTimeout(noticeTimer);
    notice = next;
    noticeTimer = next && ttl > 0 ? setTimeout(() => {
      notice = null;
      renderNotice();
    }, ttl) : null;
    renderNotice();
  }
  function renderNotice() {
    const target = drawer.root.querySelector("[data-lw-notice]");
    if (!target)
      return;
    target.replaceChildren();
    target.hidden = !notice;
    if (!notice)
      return;
    const banner = el("div", "lw-notice", notice.text);
    banner.dataset.tone = notice.tone;
    banner.setAttribute("role", notice.tone === "error" ? "alert" : "status");
    target.appendChild(banner);
  }
  function scheduleSave(delay = 450) {
    if (saveTimer)
      clearTimeout(saveTimer);
    saveState = "saving";
    updateSaveStatus();
    saveTimer = setTimeout(() => {
      saveTimer = null;
      const revision = queue.begin();
      if (revision !== null)
        send({ type: "save_settings", revision, settings: draft });
    }, delay);
  }
  function mutate(patch, rerender = false) {
    draft = normalizeFrontendSettings({ ...draft, ...patch });
    queue.markDirty();
    scheduleSave();
    if (rerender)
      render();
    else {
      updateTestButton();
      updateDirectorStatus();
      updateWarnings();
    }
  }
  function field(label, control, hint) {
    const wrapper = el("div", "lw-field");
    const id = `lw-field-${++nextFieldId}`;
    const isInput = control instanceof HTMLInputElement || control instanceof HTMLTextAreaElement || control instanceof HTMLSelectElement;
    const labelNode = el(isInput ? "label" : "div", undefined, label);
    labelNode.id = `${id}-label`;
    if (isInput) {
      control.id = id;
      labelNode.htmlFor = id;
    } else {
      control.setAttribute("role", "group");
      control.setAttribute("aria-labelledby", labelNode.id);
    }
    wrapper.append(labelNode, control);
    if (hint)
      wrapper.appendChild(el("div", "lw-hint", hint));
    return wrapper;
  }
  function switchField(label, checked, onChange, hint) {
    const row = el("div", "lw-row");
    const copy = el("div", "lw-row-copy");
    copy.append(el("div", "lw-row-title", label));
    if (hint)
      copy.append(el("div", "lw-hint", hint));
    const slot = el("div", "lw-control");
    const fallback = () => {
      const input = el("input");
      input.type = "checkbox";
      input.checked = checked;
      input.setAttribute("aria-label", label);
      input.addEventListener("change", () => onChange(input.checked));
      slot.replaceChildren(input);
    };
    if (ctx.components?.mountSwitch)
      queueMount(() => ctx.components.mountSwitch(slot, { checked, size: "md", ariaLabel: label, onChange }), fallback);
    else
      fallback();
    row.append(copy, slot);
    return row;
  }
  function connectionField() {
    const slot = el("div", "lw-control");
    const options = (state?.connections ?? []).map((connection) => ({
      value: connection.id,
      label: connection.name || connection.id,
      sublabel: [connection.provider, connection.model, connection.hasApiKey ? null : "No API key"].filter(Boolean).join(" · "),
      group: connection.provider || "Connections"
    }));
    if (draft.connectionId && !options.some((option) => option.value === draft.connectionId)) {
      options.unshift({ value: draft.connectionId, label: "Saved connection unavailable", sublabel: draft.connectionId, group: "Unavailable" });
    }
    const fallback = () => {
      const select = el("select", "lw-select");
      select.appendChild(new Option("Select connection…", ""));
      for (const option of options)
        select.appendChild(new Option(option.label, option.value));
      select.value = draft.connectionId ?? "";
      select.addEventListener("change", () => mutate({ connectionId: select.value || null, modelOverride: "" }, true));
      slot.replaceChildren(select);
    };
    if (ctx.components?.mountSelect)
      queueMount(() => ctx.components.mountSelect(slot, {
        value: draft.connectionId ?? "",
        options,
        placeholder: "Select connection…",
        searchPlaceholder: "Search connections…",
        emptyMessage: state?.connectionError || "No LLM connections found.",
        clearable: true,
        clearLabel: "No connection",
        ariaLabel: "Director connection",
        onChange: (value) => mutate({ connectionId: value || null, modelOverride: "" }, true)
      }), fallback);
    else
      fallback();
    return field("Connection", slot);
  }
  function modelField() {
    const slot = el("div", "lw-control");
    const selected = state?.connections.find((item) => item.id === draft.connectionId);
    const fallback = () => {
      const input = el("input", "lw-input");
      input.type = "text";
      input.placeholder = selected?.model || "Model ID";
      input.value = draft.modelOverride;
      input.disabled = !selected;
      input.addEventListener("input", () => mutate({ modelOverride: input.value }));
      slot.replaceChildren(input);
    };
    if (selected && ctx.components?.mountModelCombobox)
      queueMount(() => ctx.components.mountModelCombobox(slot, {
        value: draft.modelOverride,
        connection: { kind: "llm", id: selected.id },
        appearance: "standard",
        placeholder: selected.model || "Model ID",
        browseHint: selected.model ? `Connection default: ${selected.model}` : "Choose a model for this connection.",
        onChange: (value) => mutate({ modelOverride: value })
      }), fallback);
    else
      fallback();
    return field("Model override", slot, "Leave blank to use the connection’s default model.");
  }
  function numberField(label, key, value, min, max, step, hint) {
    const slot = el("div", "lw-control");
    const fallback = () => {
      const input = el("input", "lw-input");
      input.type = "number";
      input.value = String(value);
      input.min = String(min);
      input.max = String(max);
      input.step = String(step);
      input.addEventListener("change", () => {
        if (input.value !== "")
          mutate({ [key]: Number(input.value) });
      });
      slot.replaceChildren(input);
    };
    if (ctx.components?.mountNumberStepper)
      queueMount(() => ctx.components.mountNumberStepper(slot, {
        value,
        min,
        max,
        step,
        onChange: (next) => {
          if (next !== null)
            mutate({ [key]: next });
        }
      }), fallback);
    else
      fallback();
    return field(label, slot, hint);
  }
  function textAreaField(label, key, value, hint) {
    const input = el("textarea", `lw-textarea${key === "additionalNotes" ? "" : " lw-template"}`);
    input.value = value;
    input.spellcheck = key === "additionalNotes";
    input.addEventListener("input", () => mutate({ [key]: input.value }));
    return field(label, input, hint);
  }
  function selectedConnection() {
    return state?.connections.find((item) => item.id === draft.connectionId) ?? null;
  }
  function canTest() {
    const connection = selectedConnection();
    return !!(state?.permissions.generation && connection && (draft.modelOverride.trim() || connection.model.trim()));
  }
  function testDirector() {
    if (testPending || !canTest())
      return;
    testPending = true;
    showNotice({ tone: "info", text: "Testing Director…" }, 0);
    updateTestButton();
    send({ type: "test_controller", settings: draft });
  }
  function updateTestButton() {
    const node = drawer.root.querySelector("[data-lw-test]");
    if (node) {
      node.disabled = testPending || !canTest();
      node.textContent = testPending ? "Testing…" : "Test Director";
    }
  }
  function renderActivity() {
    const target = drawer.root.querySelector("[data-lw-activity]");
    if (!target)
      return;
    target.replaceChildren();
    const runs = directorRuns(state?.runs ?? []);
    if (!runs.length) {
      target.appendChild(el("div", "lw-empty", "No Director activity yet."));
      return;
    }
    for (const run of runs) {
      const row = el("div", "lw-run");
      const title = run.status.startsWith("test") ? "Director test" : run.generationType ? LABELS[run.generationType] || run.generationType : "Director run";
      row.append(el("div", "lw-run-title", title));
      const badge = el("span", "lw-badge", run.status.replaceAll("_", " "));
      badge.dataset.tone = run.status === "success" || run.status === "test_success" ? "success" : run.status === "error" || run.status === "test_error" || run.status === "timeout" ? "error" : "warning";
      row.append(badge);
      row.append(el("div", "lw-run-time", new Date(run.timestamp).toLocaleString()));
      const detail = run.error || run.directivePreview || [run.connectionName, run.model].filter(Boolean).join(" · ");
      if (detail)
        row.append(el("div", "lw-run-detail", detail));
      target.append(row);
    }
  }
  function renderWarnings(target) {
    if (!state)
      return;
    const missing = [
      !state.permissions.interceptor ? "Interceptor" : null,
      !state.permissions.generation ? "Generation" : null,
      draft.includeCharacter && !state.permissions.characters ? "Characters" : null,
      draft.includeUserPersona && !state.permissions.personas ? "Personas" : null,
      draft.includeWorldInfoEntries && !state.permissions.worldBooks ? "World Books" : null
    ].filter(Boolean);
    if (missing.length) {
      const warning = el("div", "lw-notice", `Grant ${missing.join(", ")} permission${missing.length === 1 ? "" : "s"} in Lumiverse Extensions.`);
      warning.dataset.tone = "warning";
      target.append(warning);
    }
    if (state.connectionError) {
      const warning = el("div", "lw-notice", state.connectionError);
      warning.dataset.tone = "error";
      target.append(warning);
    }
    if (draft.enabled && !draft.generationTypes.length) {
      const warning = el("div", "lw-notice", "No reply types are selected, so the Director will not run.");
      warning.dataset.tone = "warning";
      target.append(warning);
    }
  }
  function updateWarnings() {
    const target = drawer.root.querySelector("[data-lw-warnings]");
    if (!target)
      return;
    target.replaceChildren();
    renderWarnings(target);
    target.hidden = !target.childElementCount;
  }
  function render() {
    destroyHandles();
    pending = [];
    nextFieldId = 0;
    const root = el("div", "lw-root");
    const shell = el("div", "lw-shell");
    root.append(shell);
    drawer.root.replaceChildren(root);
    const header = el("header", "lw-header");
    const brand = el("div", "lw-brand");
    const icon = el("div", "lw-icon");
    icon.innerHTML = ICON;
    const title = el("div");
    title.append(el("h1", "lw-title", "Director"), el("div", "lw-version", `LumiWorld v${VERSION}`));
    brand.append(icon, title);
    const statuses = el("div", "lw-statuses");
    const directorStatus = el("span", "lw-badge");
    directorStatus.dataset.lwDirectorStatus = "";
    const saveStatus = el("span", "lw-badge");
    saveStatus.dataset.lwSaveStatus = "";
    statuses.append(directorStatus, saveStatus);
    header.append(brand, statuses);
    shell.append(header);
    shell.append(el("p", "lw-intro", "Shape the next reply with a private world-state note."));
    const notices = el("div");
    notices.dataset.lwNotice = "";
    shell.append(notices);
    const warnings = el("div");
    warnings.dataset.lwWarnings = "";
    shell.append(warnings);
    updateWarnings();
    if (!state) {
      shell.append(el("div", "lw-loading", "Loading Director settings…"));
      updateDirectorStatus();
      updateSaveStatus();
      renderNotice();
      return;
    }
    const core = el("section", "lw-card lw-stack");
    core.append(switchField("Enable Director", draft.enabled, (enabled) => mutate({ enabled }), "Runs before selected visible reply types."));
    const fields = el("div", "lw-fields");
    fields.append(connectionField(), modelField());
    core.append(fields);
    const actions = el("div", "lw-actions");
    const test = button("Test Director", testDirector, true);
    test.dataset.lwTest = "";
    actions.append(test);
    const retry = button("Retry save", () => scheduleSave(0));
    retry.dataset.lwRetry = "";
    actions.append(retry);
    core.append(actions);
    shell.append(core);
    const runsCard = el("section", "lw-card");
    runsCard.append(el("h2", undefined, "Recent activity"));
    const activity = el("div", "lw-activity");
    activity.dataset.lwActivity = "";
    runsCard.append(activity);
    shell.append(runsCard);
    const generation = el("section", "lw-card");
    generation.append(el("h2", undefined, "Runs on"));
    const options = el("div", "lw-options");
    for (const type of VISIBLE_GENERATION_TYPES) {
      const label = el("label", "lw-option");
      const input = el("input");
      input.type = "checkbox";
      input.checked = draft.generationTypes.includes(type);
      input.addEventListener("change", () => mutate({ generationTypes: input.checked ? [...draft.generationTypes, type] : draft.generationTypes.filter((item) => item !== type) }, true));
      label.append(input, document.createTextNode(LABELS[type]));
      options.append(label);
    }
    generation.append(options);
    shell.append(generation);
    const context = el("section", "lw-card lw-stack");
    context.append(el("h2", undefined, "Director context"));
    context.append(switchField("Activated World Info", draft.includeWorldInfoEntries, (includeWorldInfoEntries) => mutate({ includeWorldInfoEntries }), "Send activated entries only to the Director."), switchField("User persona", draft.includeUserPersona, (includeUserPersona) => mutate({ includeUserPersona })), switchField("Character", draft.includeCharacter, (includeCharacter) => mutate({ includeCharacter })));
    shell.append(context);
    const notes = el("section", "lw-card lw-stack");
    notes.append(el("h2", undefined, "Additional notes"), textAreaField("Private notes", "additionalNotes", draft.additionalNotes, "Extra guidance sent only to the Director."));
    shell.append(notes);
    const advanced = el("details", "lw-details");
    advanced.open = advancedOpen;
    advanced.addEventListener("toggle", () => {
      advancedOpen = advanced.open;
    });
    advanced.append(el("summary", undefined, "Response settings"));
    const advancedBody = el("div", "lw-details-body");
    const parameters = el("div", "lw-fields");
    parameters.append(numberField("Temperature", "temperature", draft.temperature, 0, 2, 0.05), numberField("Max tokens", "maxTokens", draft.maxTokens, 64, Number.MAX_SAFE_INTEGER, 1), numberField("Timeout (ms)", "timeoutMs", draft.timeoutMs, 1000, 300000, 1000, "Lumiverse limits interceptors to five minutes."), numberField("History messages", "historyMessageLimit", draft.historyMessageLimit, 0, Number.MAX_SAFE_INTEGER, 1), numberField("Prompt cap (chars)", "maxInputChars", draft.maxInputChars, 4000, 500000, 1000), numberField("Run log limit", "runLogLimit", draft.runLogLimit, 0, 50, 1));
    advancedBody.append(parameters);
    advanced.append(advancedBody);
    shell.append(advanced);
    const templates = el("details", "lw-details");
    templates.open = templatesOpen;
    templates.addEventListener("toggle", () => {
      templatesOpen = templates.open;
    });
    templates.append(el("summary", undefined, "Prompt templates"));
    const templateBody = el("div", "lw-details-body");
    templateBody.append(textAreaField("System template", "systemTemplate", draft.systemTemplate), textAreaField("User template", "userTemplate", draft.userTemplate));
    templates.append(templateBody);
    shell.append(templates);
    flushMounts();
    updateDirectorStatus();
    updateSaveStatus();
    updateTestButton();
    renderActivity();
    renderNotice();
  }
  cleanups.push(ctx.onBackendMessage((payload) => {
    const message = payload;
    if (message.type === "state") {
      state = message.state;
      if (!queue.isDirty && !saveTimer)
        draft = normalizeFrontendSettings(message.state.settings);
      if (drawer.root.contains(document.activeElement) && document.activeElement?.matches("input,textarea,select,[role=combobox]")) {
        renderActivity();
        updateWarnings();
        updateDirectorStatus();
        updateSaveStatus();
        updateTestButton();
      } else
        render();
      return;
    }
    if (message.type === "settings_saved") {
      const more = queue.acknowledge(message.revision);
      if (more)
        scheduleSave(0);
      else {
        saveState = "saved";
        if (state)
          state = { ...state, settings: message.settings };
        if (notice?.text.startsWith("Settings were not saved:"))
          showNotice(null);
      }
      updateSaveStatus();
      return;
    }
    if (message.type === "settings_save_error") {
      queue.fail(message.revision);
      saveState = "error";
      showNotice({ tone: "error", text: `Settings were not saved: ${message.message}` }, 0);
      updateSaveStatus();
      return;
    }
    if (message.type === "run_logged") {
      if (message.run.channel !== "world_agent" && state) {
        state = { ...state, runs: directorRuns([message.run, ...state.runs.filter((run) => run.id !== message.run.id)], draft.runLogLimit) };
        renderActivity();
      }
      return;
    }
    if (message.type === "test_result") {
      testPending = false;
      updateTestButton();
      showNotice(message.ok ? { tone: "success", text: `Test succeeded on ${message.connectionName} / ${message.model}: ${message.directive}` } : { tone: "error", text: message.error }, 15000);
      return;
    }
    if (message.type === "error") {
      testPending = false;
      updateTestButton();
      showNotice({ tone: "error", text: message.message }, 15000);
    }
  }));
  cleanups.push(ctx.events.on("CHAT_CHANGED", () => send({ type: "refresh_state" })));
  send({ type: "ready" });
  render();
  return () => {
    if (saveTimer)
      clearTimeout(saveTimer);
    if (noticeTimer)
      clearTimeout(noticeTimer);
    destroyHandles();
    for (const cleanup of cleanups.reverse())
      try {
        cleanup();
      } catch {}
  };
}
export {
  SettingsSaveQueue,
  directorRuns,
  normalizeFrontendSettings,
  setup
};
