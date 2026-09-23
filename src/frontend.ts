import type { SpindleFrontendContext } from "lumiverse-spindle-types";
import { DEFAULT_SETTINGS, VISIBLE_GENERATION_TYPES, normalizeSettings, type LumiWorldSettings, type ConnectionOption } from "./shared";
import type { BackendToFrontend, FrontendState, FrontendToBackend } from "./types";

const VERSION = "0.4.0";
const ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M5 17.5c2.7 1.7 6.2 1.7 9 0 3.1-1.9 4.3-5.7 2.7-8.9"/><path d="M4.4 12.2c.4-3.3 3.2-5.9 6.6-5.9 1.9 0 3.6.8 4.8 2"/><path d="M18 4.5l.8 1.7 1.9.3-1.3 1.3.3 1.9-1.7-.9-1.7.9.3-1.9-1.3-1.3 1.9-.3.8-1.7z"/><path d="M7 13h6"/></svg>`;
const LABELS: Record<string, string> = {
  normal: "New reply", continue: "Continue", regenerate: "Regenerate", swipe: "Swipe", impersonate: "Impersonate",
};
const CSS = `
.lw-root { box-sizing:border-box; container:director / inline-size; width:100%; padding:8px 6px 0; color:var(--lumiverse-text); font:13px/1.5 var(--lumiverse-font-family,system-ui,sans-serif); }
.lw-root *, .lw-root *::before, .lw-root *::after { box-sizing:border-box; }
.lw-root [hidden] { display:none; }
.lw-shell { max-width:720px; margin:0 auto; }
.lw-header { display:flex; align-items:center; justify-content:space-between; gap:16px; padding:4px 0 18px; }
.lw-brand { display:flex; align-items:center; gap:12px; min-width:0; }
.lw-icon { display:grid; place-items:center; width:40px; height:40px; flex:none; border-radius:12px; color:var(--lumiverse-primary-text); background:var(--lumiverse-primary-soft); }
.lw-icon svg { width:25px; height:25px; }
.lw-title { margin:0; font-size:22px; line-height:1.2; font-weight:650; letter-spacing:-.5px; }
.lw-status { display:flex; align-items:center; gap:6px; margin-top:4px; color:var(--lumiverse-text-muted); font-size:12px; }
.lw-status::before { content:""; width:6px; height:6px; border-radius:50%; background:var(--lumiverse-text-muted); }
.lw-status[data-tone="success"]::before { background:var(--lumiverse-success); }
.lw-status[data-tone="warning"]::before { background:var(--lumiverse-warning); }
.lw-header > .lw-row .lw-row-copy { display:none; }
.lw-intro { margin:0 0 18px; color:var(--lumiverse-text-muted); font-size:12px; line-height:1.6; }
.lw-setup { display:grid; gap:14px; padding:16px; border:1px solid var(--lumiverse-border); border-radius:var(--lumiverse-radius-lg,12px); background:var(--lumiverse-surface-raised); }
.lw-section { padding:20px 0; border-bottom:1px solid var(--lumiverse-border); }
.lw-section-title { margin:0 0 10px; color:var(--lumiverse-text-muted); font-size:11px; font-weight:650; letter-spacing:.08em; text-transform:uppercase; }
.lw-row { display:flex; align-items:center; justify-content:space-between; gap:16px; min-height:38px; }
.lw-row-copy { min-width:0; }
.lw-row-title { font-weight:500; }
.lw-row > .lw-control { flex:none; }
.lw-hint { margin:0; color:var(--lumiverse-text-muted); font-size:12px; line-height:1.5; }
.lw-field { display:grid; gap:6px; min-width:0; }
.lw-field > :first-child { font-size:12px; font-weight:550; }
.lw-fields { display:grid; gap:14px; grid-template-columns:repeat(auto-fit,minmax(min(100%,220px),1fr)); }
.lw-control { min-width:0; }
.lw-input, .lw-textarea, .lw-select { width:100%; min-height:38px; padding:9px 11px; border:1px solid var(--lumiverse-border); border-radius:var(--lumiverse-radius,8px); background:var(--lumiverse-input-bg); color:var(--lumiverse-text); font:inherit; }
.lw-input::placeholder, .lw-textarea::placeholder { color:var(--lumiverse-text-muted); opacity:1; }
.lw-input:disabled { cursor:not-allowed; }
.lw-textarea { min-height:90px; resize:vertical; }
.lw-template { min-height:200px; font:12px/1.6 var(--lumiverse-font-mono,monospace); }
.lw-actions { display:flex; flex-direction:column; align-items:stretch; gap:8px; }
.lw-test-hint { text-align:center; font-size:11px; }
.lw-button { display:inline-flex; align-items:center; justify-content:center; gap:8px; min-height:38px; padding:8px 12px; border:1px solid var(--lumiverse-border); border-radius:var(--lumiverse-radius,8px); color:var(--lumiverse-text); background:var(--lumiverse-fill-subtle); font:inherit; font-weight:600; cursor:pointer; }
.lw-button:hover:not(:disabled) { background:var(--lumiverse-fill-hover); }
.lw-button-primary { border-color:var(--lumiverse-primary-muted); background:var(--lumiverse-primary-soft); color:var(--lumiverse-primary-text); }
.lw-button-primary:hover:not(:disabled) { background:var(--lumiverse-primary-020); border-color:var(--lumiverse-primary); }
.lw-button:disabled { color:var(--lumiverse-text-muted); border-color:var(--lumiverse-border); background:var(--lumiverse-fill-subtle); cursor:not-allowed; }
.lw-button svg { width:15px; height:15px; flex:none; }
.lw-save { display:flex; align-items:center; gap:5px; font-size:11px; }
.lw-save::before { content:"✓"; }
.lw-save[data-tone="error"] { color:var(--lumiverse-danger); }
.lw-save[data-tone="error"]::before { content:"!"; }
.lw-save[data-tone="warning"]::before { content:"·"; }
.lw-notice { margin-bottom:14px; padding:11px 12px; border:1px solid var(--lumiverse-border); border-left:3px solid var(--lumiverse-primary); border-radius:8px; background:var(--lumiverse-fill-subtle); overflow-wrap:anywhere; font-size:12px; }
.lw-notice[data-tone="error"] { border-left-color:var(--lumiverse-danger); }
.lw-notice[data-tone="warning"] { border-left-color:var(--lumiverse-warning); }
.lw-notice[data-tone="success"] { border-left-color:var(--lumiverse-success); }
.lw-options { display:flex; flex-wrap:wrap; gap:7px; margin:0; padding:0; border:0; min-width:0; }
.lw-option { position:relative; display:flex; align-items:center; cursor:pointer; }
.lw-option input { position:absolute; width:1px; height:1px; opacity:0; }
.lw-option span { display:flex; align-items:center; gap:6px; min-height:34px; padding:6px 10px; border:1px solid var(--lumiverse-border); border-radius:7px; color:var(--lumiverse-text-muted); font-size:12px; transition:background .15s,border-color .15s; }
.lw-option span::before { content:""; width:11px; height:11px; border:1px solid var(--lumiverse-text-muted); border-radius:3px; }
.lw-option input:checked + span { border-color:var(--lumiverse-primary-muted); color:var(--lumiverse-primary-text); background:var(--lumiverse-primary-soft); }
.lw-option input:checked + span::before { content:"✓"; display:grid; place-items:center; border:0; font-size:12px; font-weight:750; }
.lw-option:hover span { border-color:var(--lumiverse-primary); background:var(--lumiverse-primary-light); }
.lw-option input:focus-visible + span { outline:2px solid var(--lumiverse-primary); outline-offset:3px; }
.lw-context { display:grid; gap:2px; }
.lw-context .lw-hint { margin-top:8px; }
.lw-details { border-bottom:1px solid var(--lumiverse-border); }
.lw-details > summary { display:flex; align-items:center; justify-content:space-between; gap:12px; padding:16px 0; list-style:none; cursor:pointer; font-size:13px; font-weight:550; }
.lw-details > summary::-webkit-details-marker { display:none; }
.lw-details > summary::after { content:""; width:7px; height:7px; margin:0 4px 0 8px; flex:none; border-right:1.5px solid var(--lumiverse-text-muted); border-bottom:1.5px solid var(--lumiverse-text-muted); transform:rotate(45deg) translateY(-2px); }
.lw-details[open] > summary::after { transform:rotate(225deg) translate(-2px,-1px); }
.lw-summary-copy { display:grid; gap:2px; }
.lw-summary-copy .lw-hint { font-size:11px; font-weight:400; }
.lw-details-body { display:grid; gap:16px; padding:0 0 18px; }
.lw-details .lw-details { border:0; border-top:1px solid var(--lumiverse-border); }
.lw-details .lw-details-body .lw-details-body { padding-bottom:0; }
.lw-footer { display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:8px; padding:16px 0 8px; color:var(--lumiverse-text-muted); font-size:11px; }
.lw-footer .lw-button { min-height:28px; padding:3px 8px; font-size:11px; }
.lw-footer-status { display:flex; align-items:center; flex-wrap:wrap; gap:8px; }
.lw-loading { padding:16px 0; color:var(--lumiverse-text-muted); }
.lw-root :is(button,input,select,textarea,summary):focus-visible { outline:2px solid var(--lumiverse-primary); outline-offset:3px; }
@container director (max-width:300px) { .lw-setup { padding:12px; } .lw-option span { padding:6px 8px; } .lw-icon { width:34px; height:34px; } }
@media (prefers-reduced-motion:reduce) { .lw-root * { scroll-behavior:auto!important; transition:none!important; } }
`;

type MountedHandle = { destroy(): void };
type Notice = { tone: "info" | "success" | "warning" | "error"; text: string };

export function normalizeFrontendSettings(value: unknown): LumiWorldSettings {
  return normalizeSettings(value);
}

export class SettingsSaveQueue {
  private revision = 0;
  private savedRevision = 0;
  private inFlightRevision: number | null = null;
  markDirty(): number { return ++this.revision; }
  begin(): number | null {
    if (this.inFlightRevision !== null || !this.isDirty) return null;
    this.inFlightRevision = this.revision;
    return this.inFlightRevision;
  }
  acknowledge(revision: number): boolean {
    if (this.inFlightRevision !== revision) return this.isDirty;
    this.savedRevision = Math.max(this.savedRevision, revision);
    this.inFlightRevision = null;
    return this.isDirty;
  }
  fail(revision: number): boolean {
    if (this.inFlightRevision === revision) this.inFlightRevision = null;
    return this.isDirty;
  }
  get isInFlight(): boolean { return this.inFlightRevision !== null; }
  get isDirty(): boolean { return this.revision > this.savedRevision; }
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

function button(label: string, handler: () => void, primary = false): HTMLButtonElement {
  const node = el("button", `lw-button${primary ? " lw-button-primary" : ""}`, label);
  node.type = "button";
  node.addEventListener("click", handler);
  return node;
}

function activeChat(ctx: SpindleFrontendContext): { chatId: string | null; characterId: string | null } {
  try { return ctx.getActiveChat(); }
  catch { return { chatId: null, characterId: null }; }
}

export function setup(ctx: SpindleFrontendContext) {
  const cleanups: Array<() => void> = [];
  const handles: MountedHandle[] = [];
  const queue = new SettingsSaveQueue();
  let pending: Array<{ mount: () => MountedHandle; fallback: () => void }> = [];
  let state: FrontendState | null = null;
  let draft = normalizeFrontendSettings(DEFAULT_SETTINGS);
  let saveState: "saved" | "saving" | "error" = "saved";
  let notice: Notice | null = null;
  let noticeTimer: ReturnType<typeof setTimeout> | null = null;
  let saveTimer: ReturnType<typeof setTimeout> | null = null;
  let testPending = false;
  let advancedOpen = false;
  let templatesOpen = false;
  let notesOpen = false;
  let nextFieldId = 0;

  cleanups.push(ctx.dom.addStyle(CSS));
  const drawer = ctx.ui.registerDrawerTab({
    id: "lumi-world", title: "LumiWorld", shortName: "Director", headerTitle: "LumiWorld",
    description: "Private Director notes for chat replies", keywords: ["lumiworld", "director", "prompt"], iconSvg: ICON,
  });
  cleanups.push(() => drawer.destroy());

  function send(message: FrontendToBackend): void {
    ctx.sendToBackend({ ...activeChat(ctx), ...message });
  }

  function destroyHandles(): void {
    while (handles.length) try { handles.pop()?.destroy(); } catch { /* Host may already have detached a control. */ }
  }

  function queueMount(mount: () => MountedHandle, fallback: () => void): void {
    pending.push({ mount, fallback });
  }

  function flushMounts(): void {
    while (pending.length) {
      const task = pending.shift()!;
      try { handles.push(task.mount()); }
      catch (error) { console.warn("[LumiWorld] Shared control unavailable.", error); task.fallback(); }
    }
  }

  function updateSaveStatus(): void {
    const badge = drawer.root.querySelector<HTMLElement>("[data-lw-save-status]");
    if (badge) {
      badge.textContent = saveState === "saving" ? "Saving…" : saveState === "error" ? "Save failed" : "All changes saved";
      badge.dataset.tone = saveState === "error" ? "error" : saveState === "saving" ? "warning" : "success";
    }
    const retry = drawer.root.querySelector<HTMLButtonElement>("[data-lw-retry]");
    if (retry) retry.hidden = saveState !== "error";
    drawer.setBadge(saveState === "error" ? "Error" : saveState === "saving" ? "Saving" : null);
  }

  function updateDirectorStatus(): void {
    const badge = drawer.root.querySelector<HTMLElement>("[data-lw-director-status]");
    if (!badge) return;
    const ready = draft.enabled && !!state?.permissions.interceptor && canTest() && draft.generationTypes.length > 0;
    badge.textContent = !draft.enabled ? "Disabled" : ready ? "Ready for replies" : "Setup needed";
    badge.dataset.tone = ready ? "success" : draft.enabled ? "warning" : "neutral";
  }

  function showNotice(next: Notice | null, ttl = 10000): void {
    if (noticeTimer) clearTimeout(noticeTimer);
    notice = next;
    noticeTimer = next && ttl > 0 ? setTimeout(() => { notice = null; renderNotice(); }, ttl) : null;
    renderNotice();
  }

  function renderNotice(): void {
    const target = drawer.root.querySelector<HTMLElement>("[data-lw-notice]");
    if (!target) return;
    target.replaceChildren();
    target.hidden = !notice;
    if (!notice) return;
    const banner = el("div", "lw-notice", notice.text);
    banner.dataset.tone = notice.tone;
    banner.setAttribute("role", notice.tone === "error" ? "alert" : "status");
    target.appendChild(banner);
  }

  function scheduleSave(delay = 450): void {
    if (saveTimer) clearTimeout(saveTimer);
    saveState = "saving";
    updateSaveStatus();
    saveTimer = setTimeout(() => {
      saveTimer = null;
      const revision = queue.begin();
      if (revision !== null) send({ type: "save_settings", revision, settings: draft });
    }, delay);
  }

  function mutate(patch: Partial<LumiWorldSettings>, rerender = false): void {
    draft = normalizeFrontendSettings({ ...draft, ...patch });
    queue.markDirty();
    scheduleSave();
    const notesHint = drawer.root.querySelector<HTMLElement>("[data-lw-notes-hint]");
    if (notesHint) notesHint.textContent = draft.additionalNotes.trim() ? "Your extra guidance" : "Optional guidance for the next reply";
    if (rerender) render();
    else { updateTestButton(); updateDirectorStatus(); updateWarnings(); }
  }

  function field(label: string, control: HTMLElement, hint?: string): HTMLElement {
    const wrapper = el("div", "lw-field");
    const id = `lw-field-${++nextFieldId}`;
    const isInput = control instanceof HTMLInputElement || control instanceof HTMLTextAreaElement || control instanceof HTMLSelectElement;
    const labelNode = el(isInput ? "label" : "div", undefined, label);
    labelNode.id = `${id}-label`;
    if (isInput) { control.id = id; (labelNode as HTMLLabelElement).htmlFor = id; }
    else { control.setAttribute("role", "group"); control.setAttribute("aria-labelledby", labelNode.id); }
    wrapper.append(labelNode, control);
    if (hint) wrapper.appendChild(el("div", "lw-hint", hint));
    return wrapper;
  }

  function switchField(label: string, checked: boolean, onChange: (value: boolean) => void, hint?: string): HTMLElement {
    const row = el("div", "lw-row");
    const copy = el("div", "lw-row-copy");
    copy.append(el("div", "lw-row-title", label));
    if (hint) copy.append(el("div", "lw-hint", hint));
    const slot = el("div", "lw-control");
    const fallback = () => {
      const input = el("input"); input.type = "checkbox"; input.checked = checked;
      input.setAttribute("aria-label", label); input.addEventListener("change", () => onChange(input.checked));
      slot.replaceChildren(input);
    };
    if (ctx.components?.mountSwitch) queueMount(() => ctx.components.mountSwitch(slot, { checked, size: "md", ariaLabel: label, onChange }), fallback);
    else fallback();
    row.append(copy, slot);
    return row;
  }

  function connectionField(): HTMLElement {
    const slot = el("div", "lw-control");
    const options = (state?.connections ?? []).map((connection) => ({
      value: connection.id, label: connection.name || connection.id,
      sublabel: [connection.provider, connection.model, connection.hasApiKey ? null : "No API key"].filter(Boolean).join(" · "),
      group: connection.provider || "Connections",
    }));
    if (draft.connectionId && !options.some((option) => option.value === draft.connectionId)) {
      options.unshift({ value: draft.connectionId, label: "Saved connection unavailable", sublabel: draft.connectionId, group: "Unavailable" });
    }
    const fallback = () => {
      const select = el("select", "lw-select");
      select.appendChild(new Option("Select connection…", ""));
      for (const option of options) select.appendChild(new Option(option.label, option.value));
      select.value = draft.connectionId ?? "";
      select.addEventListener("change", () => mutate({ connectionId: select.value || null, modelOverride: "" }, true));
      slot.replaceChildren(select);
    };
    if (ctx.components?.mountSelect) queueMount(() => ctx.components.mountSelect(slot, {
      value: draft.connectionId ?? "", options, placeholder: "Select connection…",
      searchPlaceholder: "Search connections…", emptyMessage: state?.connectionError || "No LLM connections found.",
      clearable: true, clearLabel: "No connection", ariaLabel: "Director connection",
      onChange: (value: string) => mutate({ connectionId: value || null, modelOverride: "" }, true),
    }), fallback);
    else fallback();
    return field("Connection", slot);
  }

  function modelField(): HTMLElement {
    const slot = el("div", "lw-control");
    const selected = state?.connections.find((item) => item.id === draft.connectionId);
    const fallback = () => {
      const input = el("input", "lw-input"); input.type = "text";
      input.placeholder = selected?.model || "Model ID"; input.value = draft.modelOverride; input.disabled = !selected;
      input.setAttribute("aria-label", "Director model");
      input.addEventListener("input", () => mutate({ modelOverride: input.value }));
      slot.replaceChildren(input);
    };
    if (selected && ctx.components?.mountModelCombobox) queueMount(() => ctx.components.mountModelCombobox(slot, {
      value: draft.modelOverride, connection: { kind: "llm", id: selected.id },
      appearance: "standard", placeholder: selected.model || "Model ID",
      browseHint: selected.model ? `Connection default: ${selected.model}` : "Choose a model for this connection.",
      onChange: (value: string) => mutate({ modelOverride: value }),
    }), fallback);
    else fallback();
    return field("Model", slot, selected?.model ? "Leave blank to use the connection’s default." : selected ? "Choose a model for this connection." : "Select a connection to choose a model.");
  }

  function numberField(label: string, key: keyof LumiWorldSettings, value: number, min: number, max: number, step: number, hint?: string): HTMLElement {
    const slot = el("div", "lw-control");
    const fallback = () => {
      const input = el("input", "lw-input"); input.type = "number"; input.value = String(value);
      input.min = String(min); input.max = String(max); input.step = String(step);
      input.setAttribute("aria-label", label);
      input.addEventListener("change", () => { if (input.value !== "") mutate({ [key]: Number(input.value) } as Partial<LumiWorldSettings>); });
      slot.replaceChildren(input);
    };
    if (ctx.components?.mountNumberStepper) queueMount(() => ctx.components.mountNumberStepper(slot, {
      value, min, max, step,
      onChange: (next: number | null) => { if (next !== null) mutate({ [key]: next } as Partial<LumiWorldSettings>); },
    }), fallback);
    else fallback();
    return field(label, slot, hint);
  }

  function textAreaField(label: string, key: "additionalNotes" | "systemTemplate" | "userTemplate", value: string, hint?: string): HTMLElement {
    const input = el("textarea", `lw-textarea${key === "additionalNotes" ? "" : " lw-template"}`);
    input.value = value;
    if (key === "additionalNotes") input.placeholder = "What should the Director keep in mind?";
    input.spellcheck = key === "additionalNotes";
    input.addEventListener("input", () => mutate({ [key]: input.value }));
    return field(label, input, hint);
  }

  function selectedConnection(): ConnectionOption | null {
    return state?.connections.find((item) => item.id === draft.connectionId) ?? null;
  }

  function canTest(): boolean {
    const connection = selectedConnection();
    return !!(state?.permissions.generation && connection && (draft.modelOverride.trim() || connection.model.trim()));
  }

  function testDirector(): void {
    if (testPending || !canTest()) return;
    testPending = true;
    showNotice({ tone: "info", text: "Testing Director…" }, 0);
    updateTestButton();
    send({ type: "test_controller", settings: draft });
  }

  function updateTestButton(): void {
    const node = drawer.root.querySelector<HTMLButtonElement>("[data-lw-test]");
    if (node) {
      node.disabled = testPending || !canTest();
      node.setAttribute("aria-busy", String(testPending));
      node.replaceChildren();
      const icon = el("span"); icon.setAttribute("aria-hidden", "true");
      icon.innerHTML = `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"><path d="m7 4 9 6-9 6V4Z"/></svg>`;
      node.append(icon, document.createTextNode(testPending ? "Testing Director…" : "Test Director"));
    }
    const hint = drawer.root.querySelector<HTMLElement>("[data-lw-test-hint]");
    if (hint) {
      hint.textContent = !selectedConnection() ? "Choose a connection to test the Director."
        : !state?.permissions.generation ? "Generation permission is required to test."
        : !canTest() ? "Choose a model to test the Director." : "Uses a sample prompt. Your chat stays unchanged.";
    }
  }

  function renderWarnings(target: HTMLElement): void {
    if (!state) return;
    const missing = [
      !state.permissions.interceptor ? "Interceptor" : null,
      !state.permissions.generation ? "Generation" : null,
      draft.includeCharacter && !state.permissions.characters ? "Characters" : null,
      draft.includeUserPersona && !state.permissions.personas ? "Personas" : null,
      draft.includeWorldInfoEntries && !state.permissions.worldBooks ? "World Books" : null,
    ].filter(Boolean);
    if (missing.length) {
      const warning = el("div", "lw-notice", `Grant ${missing.join(", ")} permission${missing.length === 1 ? "" : "s"} in Lumiverse Extensions.`);
      warning.dataset.tone = "warning"; target.append(warning);
    }
    if (state.connectionError) {
      const warning = el("div", "lw-notice", state.connectionError); warning.dataset.tone = "error"; target.append(warning);
    }
    if (draft.enabled && !draft.generationTypes.length) {
      const warning = el("div", "lw-notice", "No reply types are selected, so the Director will not run.");
      warning.dataset.tone = "warning"; target.append(warning);
    }
  }

  function updateWarnings(): void {
    const target = drawer.root.querySelector<HTMLElement>("[data-lw-warnings]");
    if (!target) return;
    target.replaceChildren();
    renderWarnings(target);
    target.hidden = !target.childElementCount;
  }

  function render(): void {
    destroyHandles(); pending = []; nextFieldId = 0;
    const root = el("div", "lw-root");
    const shell = el("div", "lw-shell"); root.append(shell); drawer.root.replaceChildren(root);
    const header = el("header", "lw-header");
    const brand = el("div", "lw-brand"); const icon = el("div", "lw-icon"); icon.innerHTML = ICON; icon.setAttribute("aria-hidden", "true");
    const title = el("div"); title.append(el("h1", "lw-title", "Director"));
    const directorStatus = el("span", "lw-status"); directorStatus.dataset.lwDirectorStatus = "";
    title.append(directorStatus); brand.append(icon, title); header.append(brand);
    if (state) header.append(switchField("Enable Director", draft.enabled, (enabled) => mutate({ enabled })));
    shell.append(header);
    shell.append(el("p", "lw-intro", "Guide your next reply with a private Director note."));
    const notices = el("div"); notices.dataset.lwNotice = ""; shell.append(notices);
    const warnings = el("div"); warnings.dataset.lwWarnings = ""; shell.append(warnings);
    updateWarnings();
    if (!state) { shell.append(el("div", "lw-loading", "Loading Director settings…")); updateDirectorStatus(); renderNotice(); return; }

    const core = el("section", "lw-setup"); core.setAttribute("aria-label", "Director connection");
    const fields = el("div", "lw-fields"); fields.append(connectionField(), modelField()); core.append(fields);
    const actions = el("div", "lw-actions");
    const test = button("Test Director", testDirector, true); test.dataset.lwTest = "";
    const testHint = el("div", "lw-hint lw-test-hint"); testHint.dataset.lwTestHint = "";
    testHint.id = "lw-test-hint"; test.setAttribute("aria-describedby", testHint.id);
    actions.append(test, testHint); core.append(actions); shell.append(core);

    const generation = el("section", "lw-section");
    const options = el("fieldset", "lw-options");
    options.append(el("legend", "lw-section-title", "Run before"));
    for (const type of VISIBLE_GENERATION_TYPES) {
      const label = el("label", "lw-option"); const input = el("input");
      input.type = "checkbox"; input.checked = draft.generationTypes.includes(type);
      input.addEventListener("change", () => mutate({ generationTypes: input.checked
        ? [...draft.generationTypes, type] : draft.generationTypes.filter((item) => item !== type) }));
      label.append(input, el("span", undefined, LABELS[type])); options.append(label);
    }
    generation.append(options); shell.append(generation);

    const context = el("section", "lw-section"); context.append(el("h2", "lw-section-title", "Include in context"));
    const contextRows = el("div", "lw-context");
    contextRows.append(
      switchField("Character", draft.includeCharacter, (includeCharacter) => mutate({ includeCharacter })),
      switchField("User persona", draft.includeUserPersona, (includeUserPersona) => mutate({ includeUserPersona })),
      switchField("Activated World Info", draft.includeWorldInfoEntries, (includeWorldInfoEntries) => mutate({ includeWorldInfoEntries })),
    ); context.append(contextRows); shell.append(context);

    const notes = el("details", "lw-details"); notes.open = notesOpen;
    notes.addEventListener("toggle", () => { notesOpen = notes.open; });
    const notesSummary = el("summary"); const notesCopy = el("span", "lw-summary-copy");
    const notesHint = el("span", "lw-hint", draft.additionalNotes.trim() ? "Your extra guidance" : "Optional guidance for the next reply");
    notesHint.dataset.lwNotesHint = "";
    notesCopy.append(el("span", undefined, "Director notes"), notesHint);
    notesSummary.append(notesCopy); notes.append(notesSummary);
    const notesBody = el("div", "lw-details-body");
    notesBody.append(textAreaField("Private guidance", "additionalNotes", draft.additionalNotes));
    notes.append(notesBody); shell.append(notes);

    const advanced = el("details", "lw-details"); advanced.open = advancedOpen;
    advanced.addEventListener("toggle", () => { advancedOpen = advanced.open; });
    const advancedSummary = el("summary"); const advancedCopy = el("span", "lw-summary-copy");
    advancedCopy.append(el("span", undefined, "Advanced settings"), el("span", "lw-hint", "Response limits & prompt templates"));
    advancedSummary.append(advancedCopy); advanced.append(advancedSummary);
    const advancedBody = el("div", "lw-details-body");
    const parameters = el("div", "lw-fields");
    parameters.append(
      numberField("Temperature", "temperature", draft.temperature, 0, 2, .05),
      numberField("Max tokens", "maxTokens", draft.maxTokens, 64, Number.MAX_SAFE_INTEGER, 1),
      numberField("Timeout (ms)", "timeoutMs", draft.timeoutMs, 1000, 300000, 1000, "Lumiverse limits interceptors to five minutes."),
      numberField("History messages", "historyMessageLimit", draft.historyMessageLimit, 0, Number.MAX_SAFE_INTEGER, 1),
      numberField("Prompt cap (chars)", "maxInputChars", draft.maxInputChars, 4000, 500000, 1000),
      numberField("Run log limit", "runLogLimit", draft.runLogLimit, 0, 50, 1),
    ); advancedBody.append(parameters);
    advanced.append(advancedBody); shell.append(advanced);

    const templates = el("details", "lw-details"); templates.open = templatesOpen;
    templates.addEventListener("toggle", () => { templatesOpen = templates.open; });
    templates.append(el("summary", undefined, "Prompt templates"));
    const templateBody = el("div", "lw-details-body");
    templateBody.append(textAreaField("System template", "systemTemplate", draft.systemTemplate),
      textAreaField("User template", "userTemplate", draft.userTemplate));
    templates.append(templateBody); advancedBody.append(templates);

    const footer = el("footer", "lw-footer");
    footer.append(el("span", undefined, `LumiWorld ${VERSION}`));
    const footerStatus = el("div", "lw-footer-status");
    const saveStatus = el("span", "lw-save"); saveStatus.dataset.lwSaveStatus = "";
    saveStatus.setAttribute("role", "status");
    const retry = button("Retry save", () => scheduleSave(0)); retry.dataset.lwRetry = "";
    footerStatus.append(saveStatus, retry); footer.append(footerStatus); shell.append(footer);

    flushMounts(); updateDirectorStatus(); updateSaveStatus(); updateTestButton(); renderNotice();
  }

  cleanups.push(ctx.onBackendMessage((payload) => {
    const message = payload as BackendToFrontend;
    if (message.type === "state") {
      state = message.state;
      if (!queue.isDirty && !saveTimer) draft = normalizeFrontendSettings(message.state.settings);
      if (drawer.root.contains(document.activeElement) && document.activeElement?.matches("input,textarea,select,[role=combobox]")) {
        updateWarnings(); updateDirectorStatus(); updateSaveStatus(); updateTestButton();
      } else render();
      return;
    }
    if (message.type === "settings_saved") {
      const more = queue.acknowledge(message.revision);
      if (more) scheduleSave(0);
      else {
        saveState = "saved";
        if (state) state = { ...state, settings: message.settings };
        if (notice?.text.startsWith("Settings were not saved:")) showNotice(null);
      }
      updateSaveStatus(); return;
    }
    if (message.type === "settings_save_error") {
      queue.fail(message.revision); saveState = "error";
      showNotice({ tone: "error", text: `Settings were not saved: ${message.message}` }, 0);
      updateSaveStatus(); return;
    }
    if (message.type === "test_result") {
      testPending = false; updateTestButton();
      showNotice(message.ok
        ? { tone: "success", text: `Test succeeded on ${message.connectionName} / ${message.model}: ${message.directive}` }
        : { tone: "error", text: message.error }, 15000);
      return;
    }
    if (message.type === "error") {
      testPending = false;
      updateTestButton();
      showNotice({ tone: "error", text: message.message }, 15000);
    }
  }));

  cleanups.push(ctx.events.on("CHAT_CHANGED", () => send({ type: "refresh_state" })));
  send({ type: "ready" }); render();
  return () => {
    if (saveTimer) clearTimeout(saveTimer);
    if (noticeTimer) clearTimeout(noticeTimer);
    destroyHandles();
    for (const cleanup of cleanups.reverse()) try { cleanup(); } catch { /* Extension teardown is best effort. */ }
  };
}
