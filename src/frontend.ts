import type { SpindleFrontendContext } from "lumiverse-spindle-types";
import {
  DEFAULT_SETTINGS, JEV_PROVIDERS, JEV_PROVIDER_IDS, VISIBLE_GENERATION_TYPES, normalizeSettings,
  summarizeJevDiagnostics,
  type GateDefinition, type GateFallback, type GatePolicy, type JevGateRecord,
  type JevProvider, type JevSettings, type JevTurnDiagnostics, type LumiWorldSettings, type ConnectionOption,
} from "./shared";
import { GATE_CATALOG, GATE_CATEGORY_LABELS, GATE_CATEGORY_ORDER } from "./gates";
import type { BackendToFrontend, FrontendState, FrontendToBackend } from "./types";

const VERSION = "0.5.0-experimental";
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
.lw-title-row { display:flex; align-items:center; gap:8px; }
.lw-tabs { position:sticky; top:0; z-index:2; display:flex; gap:2px; margin:2px 0 16px; padding:3px; border:1px solid var(--lumiverse-border); border-radius:10px; background:var(--lumiverse-surface-raised); backdrop-filter:blur(8px); }
.lw-tab { flex:1 1 0; display:flex; align-items:center; justify-content:center; gap:7px; min-width:0; min-height:34px; padding:6px 10px; border:0; border-radius:7px; color:var(--lumiverse-text-muted); background:transparent; font:inherit; font-size:12.5px; font-weight:600; cursor:pointer; transition:background .15s,color .15s; }
.lw-tab:hover { color:var(--lumiverse-text); background:var(--lumiverse-fill-hover); }
.lw-tab[aria-selected="true"] { color:var(--lumiverse-primary-text); background:var(--lumiverse-primary-soft); box-shadow:inset 0 0 0 1px var(--lumiverse-primary-muted); }
.lw-tab:focus-visible { outline:2px solid var(--lumiverse-primary); outline-offset:2px; }
.lw-tab .lw-dot { transition:background .15s; }
.lw-tab[data-dirty="true"] .lw-dot { background:var(--lumiverse-warning); }
.lw-view-head { display:grid; gap:6px; margin:0 0 16px; }
.lw-view-title { margin:0; font-size:15px; font-weight:650; letter-spacing:-.2px; }
.lw-view-intro { margin:0; color:var(--lumiverse-text-muted); font-size:12px; line-height:1.55; }
.lw-panel-view { display:grid; gap:0; }
.lw-panel-view[hidden] { display:none; }
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
/* --- Pills ---------------------------------------------------------- */
.lw-badge { display:inline-flex; align-items:center; gap:5px; min-height:20px; padding:1px 8px; border:1px solid var(--lumiverse-border); border-radius:999px; color:var(--lumiverse-text-muted); background:var(--lumiverse-fill-subtle); font-size:10.5px; font-weight:550; letter-spacing:.01em; white-space:nowrap; }
.lw-badge[data-tone="success"] { border-color:var(--lumiverse-success); color:var(--lumiverse-success); }
.lw-badge[data-tone="warning"] { border-color:var(--lumiverse-warning); color:var(--lumiverse-warning); }
.lw-badge[data-tone="error"] { border-color:var(--lumiverse-danger); color:var(--lumiverse-danger); }
.lw-badge[data-tone="primary"] { border-color:var(--lumiverse-primary-muted); color:var(--lumiverse-primary-text); background:var(--lumiverse-primary-soft); }
.lw-dot { width:6px; height:6px; flex:none; border-radius:50%; background:var(--lumiverse-text-muted); }
.lw-badge[data-tone="success"] .lw-dot { background:var(--lumiverse-success); }
.lw-badge[data-tone="warning"] .lw-dot { background:var(--lumiverse-warning); }
.lw-badge[data-tone="error"] .lw-dot { background:var(--lumiverse-danger); }
.lw-badge[data-tone="primary"] .lw-dot { background:var(--lumiverse-primary); }

/* --- Jev panel ------------------------------------------------------ */
.lw-panel { display:grid; gap:14px; margin:4px 0 6px; padding:14px; border:1px solid var(--lumiverse-border); border-radius:var(--lumiverse-radius-lg,12px); background:var(--lumiverse-surface-raised); }
.lw-panel[data-active="true"] { border-color:var(--lumiverse-primary-muted); }
.lw-panel-soon { color:var(--lumiverse-text-muted); font-size:12px; line-height:1.55; }
.lw-stack { display:grid; gap:12px; }
.lw-control-card { display:grid; gap:12px; padding:12px; border:1px solid var(--lumiverse-border); border-radius:var(--lumiverse-radius,8px); background:var(--lumiverse-fill-subtle); }
.lw-control-head { display:flex; align-items:center; justify-content:space-between; gap:10px; }
.lw-control-title { font-size:12px; font-weight:600; }

/* --- Segmented provider control ------------------------------------- */
.lw-segments { display:flex; gap:4px; padding:3px; border:1px solid var(--lumiverse-border); border-radius:var(--lumiverse-radius,8px); background:var(--lumiverse-input-bg); }
.lw-segment { flex:1 1 0; min-width:0; min-height:30px; padding:5px 10px; border:0; border-radius:6px; color:var(--lumiverse-text-muted); background:transparent; font:inherit; font-size:12px; font-weight:550; cursor:pointer; transition:background .15s,color .15s; }
.lw-segment:hover { color:var(--lumiverse-text); background:var(--lumiverse-fill-hover); }
.lw-segment[aria-pressed="true"] { color:var(--lumiverse-primary-text); background:var(--lumiverse-primary-soft); box-shadow:inset 0 0 0 1px var(--lumiverse-primary-muted); }
.lw-segment:focus-visible { outline:2px solid var(--lumiverse-primary); outline-offset:2px; }
.lw-provider-note { font-size:11px; }
.lw-provider-note a { color:var(--lumiverse-primary-text); }

/* --- Key row -------------------------------------------------------- */
.lw-key-row { display:grid; grid-template-columns:minmax(0,1fr) auto auto; align-items:center; gap:8px; }

/* --- Gates ---------------------------------------------------------- */
.lw-gate-body { display:grid; gap:6px; }
.lw-cat-head { display:flex; align-items:center; justify-content:space-between; gap:10px; margin-top:14px; }
.lw-cat-head:first-child { margin-top:0; }
.lw-cat-title { display:flex; align-items:baseline; gap:7px; font-size:11px; font-weight:650; letter-spacing:.07em; text-transform:uppercase; color:var(--lumiverse-text-muted); }
.lw-cat-head .lw-button { min-height:24px; padding:1px 8px; font-size:10.5px; font-weight:600; }
.lw-gate { display:grid; gap:0; margin-bottom:2px; border:1px solid transparent; border-radius:9px; }
.lw-gate[data-on="true"] { border-color:var(--lumiverse-border); background:var(--lumiverse-fill-subtle); }
.lw-gate[data-open="true"] { border-color:var(--lumiverse-primary-muted); background:var(--lumiverse-surface-raised); }
.lw-gate[data-custom="true"][data-on="true"] { box-shadow:inset 3px 0 0 var(--lumiverse-primary); }
.lw-gate-row { display:grid; grid-template-columns:auto minmax(0,1fr) auto auto; align-items:center; gap:10px; padding:7px 10px; }
.lw-gate-copy { display:grid; gap:1px; min-width:0; }
.lw-gate-name { font-size:12.5px; font-weight:550; }
.lw-gate[data-on="false"] .lw-gate-name { color:var(--lumiverse-text-muted); font-weight:450; }
.lw-gate-meta { color:var(--lumiverse-text-muted); font-size:10.5px; }
.lw-gate-meta code { font-family:var(--lumiverse-font-mono,monospace); font-size:10.5px; }
.lw-gate-caret { display:grid; place-items:center; width:22px; height:22px; padding:0; border:1px solid var(--lumiverse-border); border-radius:6px; color:var(--lumiverse-text-muted); background:var(--lumiverse-fill-subtle); font:inherit; font-size:10px; cursor:pointer; }
.lw-gate-caret:hover { color:var(--lumiverse-text); background:var(--lumiverse-fill-hover); }
.lw-gate-caret:focus-visible { outline:2px solid var(--lumiverse-primary); outline-offset:2px; }
.lw-gate-sheet { display:grid; gap:10px; padding:2px 14px 13px; }
.lw-sheet-label { display:flex; align-items:baseline; justify-content:space-between; gap:10px; font-size:11px; font-weight:600; letter-spacing:.03em; text-transform:uppercase; color:var(--lumiverse-text-muted); }
.lw-sheet-copy { color:var(--lumiverse-text-muted); font-size:11.5px; line-height:1.5; }

/* --- Diagnostics ---------------------------------------------------- */
.lw-diag { display:grid; gap:12px; }
.lw-diag-strip { display:flex; flex-wrap:wrap; gap:5px; }
.lw-diag-list { display:grid; gap:4px; max-height:360px; overflow:auto; }
.lw-diag-row { display:grid; grid-template-columns:minmax(0,1fr) auto; align-items:start; gap:4px 10px; padding:8px 10px; border:1px solid var(--lumiverse-border); border-radius:8px; background:var(--lumiverse-fill-subtle); }
.lw-diag-row[data-flag="true"] { border-left:3px solid var(--lumiverse-warning); }
.lw-diag-row[data-on="false"] { opacity:.65; }
.lw-diag-head { display:flex; align-items:baseline; gap:8px; min-width:0; }
.lw-diag-name { font-size:12px; font-weight:600; }
.lw-diag-value { flex:none; padding:1px 7px; border:1px solid var(--lumiverse-border); border-radius:6px; background:var(--lumiverse-input-bg); font-family:var(--lumiverse-font-mono,monospace); font-size:10.5px; }
.lw-diag-row[data-flag="true"] .lw-diag-value { border-color:var(--lumiverse-warning); color:var(--lumiverse-warning); }
.lw-diag-meta { display:flex; align-items:center; justify-content:flex-end; gap:6px; }
.lw-diag-note { grid-column:1 / -1; color:var(--lumiverse-text-muted); font-size:11px; line-height:1.45; }
.lw-gate-reset { justify-self:start; }

@container director (max-width:300px) { .lw-setup { padding:12px; } .lw-option span { padding:6px 8px; } .lw-icon { width:34px; height:34px; } }
@media (prefers-reduced-motion:reduce) { .lw-root * { scroll-behavior:auto!important; transition:none!important; } }
`;

const GATE_FALLBACKS: readonly GateFallback[] = [
  "run", "skip", "accept", "retry", "patch", "soften", "drop", "hold", "none", "ignore",
];

const GATE_FALLBACK_LABELS: Record<GateFallback, string> = {
  run: "Run the Director ungated",
  skip: "Skip the Director",
  accept: "Accept the draft",
  retry: "Regenerate once",
  patch: "Rewrite the part that infringes",
  soften: "Soften the directive",
  drop: "Drop the claim",
  hold: "Hold the beat",
  none: "Record only",
  ignore: "Ignore the answer",
};

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

function textInput(value: string, placeholder: string, ariaLabel: string, onInput: (next: string) => void): HTMLInputElement {
  const input = el("input", "lw-input");
  input.type = "text";
  input.value = value;
  input.placeholder = placeholder;
  input.setAttribute("aria-label", ariaLabel);
  input.addEventListener("input", () => onInput(input.value));
  return input;
}

const CHEVRON_SVG = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m6 4 4 4-4 4"/></svg>';

interface CollapsibleOptions {
  title: string;
  badge?: string;
  badgeTone?: "neutral" | "primary" | "success" | "warning" | "error";
  expanded: boolean;
  onToggle: (expanded: boolean) => void;
  className?: string;
}

/**
 * A self-owned collapsible section.
 *
 * The host's `mountCollapsibleSection` is preferred when the drawer can mount it,
 * but its chrome is subject to host registration timing, so this stands in as the
 * default and gives LumiWorld full control over the header, badge, and body.
 */
function collapsible(options: CollapsibleOptions, build: (body: HTMLElement) => void): HTMLElement {
  const details = el("details", `lw-details${options.className ? ` ${options.className}` : ""}`);
  details.open = options.expanded;
  details.addEventListener("toggle", () => options.onToggle(details.open));

  const summary = el("summary");
  const copy = el("span", "lw-summary-copy");
  copy.append(el("span", undefined, options.title));
  summary.append(copy);
  if (options.badge) {
    const badge = el("span", "lw-badge", options.badge);
    if (options.badgeTone && options.badgeTone !== "neutral") badge.dataset.tone = options.badgeTone;
    summary.append(badge);
  }
  details.append(summary);

  const body = el("div", "lw-details-body");
  build(body);
  details.append(body);
  return details;
}

/** A small status pill: a coloured dot plus a label. */
function pill(text: string, tone: "neutral" | "success" | "warning" | "error" | "primary" = "neutral"): HTMLElement {
  const badge = el("span", "lw-badge");
  if (tone !== "neutral") badge.dataset.tone = tone;
  badge.append(el("span", "lw-dot"), el("span", undefined, text));
  return badge;
}

/**
 * A segmented control. The host's `mountSelect` renders a collapsed dropdown;
 * two options read better as visible segments.
 */
function segmented(
  value: string,
  options: Array<{ value: string; label: string }>,
  ariaLabel: string,
  onChange: (next: string) => void,
): HTMLElement {
  const group = el("div", "lw-segments");
  group.setAttribute("role", "group");
  group.setAttribute("aria-label", ariaLabel);
  for (const option of options) {
    const node = el("button", "lw-segment", option.label);
    node.type = "button";
    node.setAttribute("aria-pressed", String(option.value === value));
    node.addEventListener("click", () => { if (option.value !== value) onChange(option.value); });
    group.append(node);
  }
  return group;
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
  let jevTestPending = false;
  let jevKeyDraft = "";
  let advancedOpen = false;
  let templatesOpen = false;
  let notesOpen = false;
  let jevOpen = false;
  let gatesOpen = false;
  /** Gate ids whose detail sheet is expanded. Survives re-renders. */
  const openGates = new Set<string>();
  type LumiTab = "director" | "jev";
  let activeTab: LumiTab = "director";
  let diagnosticsOpen = false;
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
    const previous = normalizeFrontendSettings(draft);
    draft = normalizeFrontendSettings({ ...draft, ...patch });
    // A re-render triggered by pure UI state (an opened gate sheet, a mode toggle)
    // holds no settings change, so it must not queue a write.
    if (JSON.stringify(previous) === JSON.stringify(draft)) {
      if (rerender) render();
      return;
    }
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

  /* ---------------- Jev ---------------- */

  function providerInfo(): typeof JEV_PROVIDERS.typesafe {
    return JEV_PROVIDERS[draft.jev.provider];
  }

  function hasJevKey(): boolean {
    return !!state?.hasJevKey;
  }

  function canTestJev(): boolean {
    if (!state?.permissions.corsProxy) return false;
    if (jevKeyDraft.trim()) return true;
    return hasJevKey();
  }

  function selectControl(value: string, options: Array<{ value: string; label: string }>, ariaLabel: string, onChange: (next: string) => void): HTMLElement {
    const slot = el("div", "lw-control");
    const select = el("select", "lw-select");
    for (const option of options) select.appendChild(new Option(option.label, option.value));
    select.value = value;
    select.setAttribute("aria-label", ariaLabel);
    select.addEventListener("change", () => onChange(select.value));
    slot.appendChild(select);
    return slot;
  }

  function numberInput(value: number, min: number, max: number, step: number, ariaLabel: string, onChange: (next: number) => void): HTMLInputElement {
    const input = el("input", "lw-input");
    input.type = "number";
    input.value = String(value);
    input.min = String(min);
    input.max = String(max);
    input.step = String(step);
    input.setAttribute("aria-label", ariaLabel);
    input.addEventListener("change", () => {
      if (input.value === "") return;
      const parsed = Number(input.value);
      if (Number.isFinite(parsed)) onChange(Math.min(max, Math.max(min, parsed)));
    });
    return input;
  }

  function mutateJev(patch: Partial<JevSettings>, rerender = false): void {
    mutate({ jev: { ...draft.jev, ...patch } }, rerender);
  }

  /** Sparse override: only properties the user actually changed are stored. */
  function mutateGate(gateId: string, patch: Partial<GatePolicy>): void {
    const current = draft.jev.gatePolicy[gateId] ?? {};
    mutateJev({ gatePolicy: { ...draft.jev.gatePolicy, [gateId]: { ...current, ...patch } } });
  }

  function resetGate(gateId: string): void {
    if (!(gateId in draft.jev.gatePolicy)) return;
    const next = { ...draft.jev.gatePolicy };
    delete next[gateId];
    mutateJev({ gatePolicy: next }, true);
  }

  function effectivePolicy(definition: GateDefinition): Required<GatePolicy> {
    const override = draft.jev.gatePolicy[definition.id] ?? {};
    return {
      enabled: override.enabled ?? definition.enabledByDefault,
      threshold: override.threshold
        ?? (definition.id === "confidence_escalation" ? draft.jev.minConfidence : definition.threshold),
      fallback: override.fallback ?? definition.fallback,
    };
  }

  function testJev(): void {
    if (jevTestPending || !canTestJev()) return;
    jevTestPending = true;
    showNotice({ tone: "info", text: "Testing Jev…" }, 0);
    updateJevTestButton();
    send({ type: "test_jev", settings: draft, apiKey: jevKeyDraft.trim() || undefined });
  }

  function updateJevStatus(): void {
    const target = drawer.root.querySelector<HTMLElement>("[data-lw-jev-status]");
    if (!target) return;
    const tone = !draft.jev.enabled
      ? "neutral"
      : !state?.permissions.corsProxy || (!hasJevKey() && !jevKeyDraft.trim()) ? "warning" : "success";
    const text = !draft.jev.enabled
      ? "Off"
      : !state?.permissions.corsProxy ? "Needs permission" : hasJevKey() || jevKeyDraft.trim() ? "Ready" : "Needs key";
    target.replaceChildren(pill(text, tone));
  }

  function updateJevTestButton(): void {
    updateJevStatus();
    const node = drawer.root.querySelector<HTMLButtonElement>("[data-lw-jev-test]");
    if (node) {
      node.disabled = jevTestPending || !canTestJev();
      node.setAttribute("aria-busy", String(jevTestPending));
      node.textContent = jevTestPending ? "Testing Jev…" : "Test Jev";
    }
    const hint = drawer.root.querySelector<HTMLElement>("[data-lw-jev-hint]");
    if (hint) {
      hint.textContent = !state?.permissions.corsProxy
        ? "The cors_proxy permission is required to reach Jev."
        : jevKeyDraft.trim() ? "Sends one tiny yes/no question and stores the key if it works."
        : hasJevKey() ? "Uses the stored key. One tiny yes/no question; your chat is not sent."
        : "Paste an API key to test the connection.";
    }
  }

  function jevSection(): HTMLElement {
    const section = el("section", "lw-section");
    section.append(el("h2", "lw-section-title", "Jev simulation"));

    const panel = el("div", "lw-panel");
    panel.dataset.active = String(draft.jev.enabled);

    // Header: the switch plus a live status pill, so the panel state is legible
    // without expanding anything.
    const head = el("div", "lw-row");
    const headCopy = el("div", "lw-row-copy");
    const headTitle = el("div", "lw-row-title", "Use Jev gates");
    headCopy.append(headTitle, el("div", "lw-hint", "Ask a cheap decision model whether each turn needs the Director at all."));
    head.append(headCopy);
    const headSwitch = el("div", "lw-control");
    const headFallback = () => {
      const input = el("input");
      input.type = "checkbox";
      input.checked = draft.jev.enabled;
      input.setAttribute("aria-label", "Use Jev gates");
      input.addEventListener("change", () => mutateJev({ enabled: input.checked }, true));
      headSwitch.replaceChildren(input);
    };
    if (typeof ctx.components?.mountSwitch === "function") {
      queueMount(() => ctx.components!.mountSwitch!(headSwitch, {
        checked: draft.jev.enabled, size: "md", ariaLabel: "Use Jev gates",
        onChange: (enabled: boolean) => mutateJev({ enabled }, true),
      }), headFallback);
    } else headFallback();
    head.append(headSwitch);
    panel.append(head);

    if (!draft.jev.enabled) {
      const card = el("div", "lw-control-card");
      card.append(el("div", "lw-panel-soon",
        "Jev is off. LumiWorld runs exactly as the Director-only baseline: one Director call per selected reply type, no network calls beyond your own connection."));
      panel.append(card);
      section.append(panel);
      return section;
    }

    // --- Connection ---
    const connection = el("div", "lw-control-card");
    const connectionHead = el("div", "lw-control-head");
    const connectionTitle = el("div");
    connectionTitle.append(el("div", "lw-control-title", "Decision provider"));
    const note = el("div", "lw-provider-note");
    const link = el("a", undefined, `${providerInfo().label} API keys`) as HTMLAnchorElement;
    link.href = providerInfo().keyUrl;
    link.target = "_blank";
    link.rel = "noreferrer noopener";
    note.append(document.createTextNode("Get one from "), link, document.createTextNode("."));
    connectionTitle.append(note);
    connectionHead.append(connectionTitle);
    connection.append(connectionHead);

    connection.append(segmented(
      draft.jev.provider,
      JEV_PROVIDER_IDS.map((id) => ({ value: id, label: JEV_PROVIDERS[id].label })),
      "Jev provider",
      (value) => mutateJev({ provider: value as JevProvider, model: "" }, true),
    ));

    const fields = el("div", "lw-fields");
    fields.append(
      field("Model", textInput(draft.jev.model, providerInfo().defaultModel, "Jev model", (value) => mutateJev({ model: value })),
        `Blank uses ${providerInfo().defaultModel}.`),
      field("State cap (chars)", numberInput(
        draft.jev.maxStateChars, 2000, 32000, 1000, "Jev state cap",
        (value) => mutateJev({ maxStateChars: value }),
      ), "Jev allows 32k tokens for the state."),
    );
    connection.append(fields);
    panel.append(connection);

    // --- Credential ---
    const credential = el("div", "lw-control-card");
    const credentialHead = el("div", "lw-control-head");
    credentialHead.append(el("div", "lw-control-title", "API key"));
    credentialHead.append(pill(hasJevKey() ? "Stored" : "Not set", hasJevKey() ? "success" : "warning"));
    credential.append(credentialHead);

    const keyRow = el("div", "lw-key-row");
    const keyInput = el("input", "lw-input");
    keyInput.type = "password";
    keyInput.autocomplete = "off";
    keyInput.spellcheck = false;
    keyInput.value = jevKeyDraft;
    keyInput.placeholder = hasJevKey() ? "A key is stored — paste to replace" : "Paste your API key";
    keyInput.setAttribute("aria-label", "Jev API key");
    keyInput.addEventListener("input", () => { jevKeyDraft = keyInput.value; updateJevTestButton(); });
    const clear = button("Clear", () => {
      jevKeyDraft = "";
      send({ type: "clear_jev_key", provider: draft.jev.provider });
    });
    clear.disabled = !hasJevKey();
    keyRow.append(keyInput, clear);
    credential.append(keyRow);
    credential.append(el("div", "lw-hint", "Encrypted at rest per Lumiverse user, and never sent back to this panel."));

    const actions = el("div", "lw-actions");
    const test = button("Test Jev", testJev, true);
    test.dataset.lwJevTest = "";
    const hint = el("div", "lw-hint lw-test-hint");
    hint.dataset.lwJevHint = "";
    actions.append(test, hint);
    credential.append(actions);
    panel.append(credential);

    // --- Shape of the request ---
    const shape = el("div", "lw-control-card");
    const shapeHead = el("div", "lw-control-head");
    shapeHead.append(el("div", "lw-control-title", "What gets sent"));
    shapeHead.append(pill("Capped", "primary"));
    shape.append(shapeHead);
    const shapeFields = el("div", "lw-fields");
    shapeFields.append(
      field("History messages", numberInput(
        draft.jev.historyMessageLimit, 0, 24, 1, "Jev history messages",
        (value) => mutateJev({ historyMessageLimit: value }),
      )),
      field("Timeout (ms)", numberInput(
        draft.jev.timeoutMs, 1000, 60000, 500, "Jev timeout",
        (value) => mutateJev({ timeoutMs: value }),
      )),
      field("Confidence floor", numberInput(
        draft.jev.minConfidence, 0, 1, 0.05, "Confidence floor",
        (value) => mutateJev({ minConfidence: value }),
      ), "Applies to every gate. Decisions below it use their fallback."),
    );
    shape.append(shapeFields);
    shape.append(el("div", "lw-hint",
      "The state is a redacted projection: recent turns plus the context sources you enabled, never your full transcript."));
    panel.append(shape);

    section.append(panel);
    return section;
  }

  function gatesSection(): HTMLElement {
    const definitions = GATE_CATALOG;
    const enabled = definitions.filter((definition) => effectivePolicy(definition).enabled).length;
    // A hand-tuned gate keeps a marker so a non-default setup is visible at a glance.
    const customised = definitions.filter((definition) => definition.id in draft.jev.gatePolicy).length;

    return collapsible({
      title: "Jev gates",
      badge: `${enabled}/${definitions.length}`,
      expanded: gatesOpen,
      onToggle: (open) => { gatesOpen = open; },
      className: "lw-gates",
    }, (body) => {
      body.classList.add("lw-gate-body");
      body.append(el("p", "lw-hint",
        "Enabled gates travel in one batched request per phase, so adding gates adds no round trips. A gate that cannot answer uses its own fallback."));

      for (const category of GATE_CATEGORY_ORDER) {
        const group = definitions.filter((definition) => definition.category === category);
        if (group.length === 0) continue;
        const on = group.filter((definition) => effectivePolicy(definition).enabled).length;

        const head = el("div", "lw-cat-head");
        const title = el("span", "lw-cat-title");
        title.append(
          el("span", undefined, GATE_CATEGORY_LABELS[category]),
          el("span", "lw-cat-count", `${on}/${group.length}`),
        );
        const all = button(on === group.length ? "Disable all" : "Enable all", () => {
          const next = { ...draft.jev.gatePolicy };
          for (const definition of group) next[definition.id] = { ...next[definition.id], enabled: on !== group.length };
          mutateJev({ gatePolicy: next }, true);
        });
        all.title = on === group.length ? `Turn off every ${GATE_CATEGORY_LABELS[category]} gate` : `Turn on every ${GATE_CATEGORY_LABELS[category]} gate`;
        head.append(title, all);
        body.append(head);

        for (const definition of group) body.append(gateCard(definition));
      }

      if (customised > 0) {
        const footer = el("div", "lw-cat-head");
        const cleared = button(`Reset ${customised} changed gate${customised === 1 ? "" : "s"} to defaults`, () => {
          mutateJev({ gatePolicy: {} }, true);
        });
        cleared.className = "lw-button lw-button-primary";
        footer.append(cleared);
        body.append(footer);
      }
    });
  }

  /**
   * One gate, collapsed to a single line: switch, name, shape, and a caret that
   * reveals the floor and fallback. Collapsed rows exist so 36 gates stay
   * scannable instead of becoming a wall of selects.
   */
  function gateCard(definition: GateDefinition): HTMLElement {
    const policy = effectivePolicy(definition);
    const isOpen = openGates.has(definition.id);
    const isCustom = definition.id in draft.jev.gatePolicy;
    const card = el("div", "lw-gate");
    card.dataset.lwGate = definition.id;
    card.dataset.on = String(policy.enabled);
    card.dataset.open = String(isOpen);
    card.dataset.custom = String(isCustom);

    const switchSlot = el("div", "lw-control");
    const switchFallback = () => {
      const input = el("input");
      input.type = "checkbox";
      input.checked = policy.enabled;
      input.setAttribute("aria-label", definition.label);
      input.addEventListener("change", () => mutateGate(definition.id, { enabled: input.checked }));
      switchSlot.replaceChildren(input);
    };
    if (typeof ctx.components?.mountSwitch === "function") {
      queueMount(() => ctx.components!.mountSwitch!(switchSlot, {
        checked: policy.enabled,
        size: "sm",
        ariaLabel: definition.label,
        onChange: (checked: boolean) => mutateGate(definition.id, { enabled: checked }),
      }), switchFallback);
    } else switchFallback();

    const copy = el("div", "lw-gate-copy");
    const meta = el("div", "lw-gate-meta");
    const shape = definition.codeOnly
      ? definition.appliesWhen ?? "Evaluated in code"
      : `${definition.primitiveLabel} · ${definition.phase === "gate" ? "before the Director" : "verifies the draft"}`;
    meta.append(el("span", undefined, shape));
    if (isCustom) meta.append(document.createTextNode(" · "), el("code", undefined, "custom"));
    copy.append(el("div", "lw-gate-name", definition.label), meta);

    const caret = el("button", "lw-gate-caret", isOpen ? "▾" : "▸");
    caret.type = "button";
    caret.setAttribute("aria-expanded", String(isOpen));
    caret.setAttribute("aria-label", `${isOpen ? "Hide" : "Show"} ${definition.label} settings`);
    caret.addEventListener("click", () => {
      if (isOpen) openGates.delete(definition.id);
      else openGates.add(definition.id);
      mutate({}, true);
    });

    const row = el("div", "lw-gate-row");
    row.append(switchSlot, copy, caret);
    card.append(row);

    if (isOpen) card.append(gateSheet(definition, policy, isCustom));
    return card;
  }

  /** The expanded controls for one gate: confidence floor, fallback, and reset. */
  function gateSheet(definition: GateDefinition, policy: Required<GatePolicy>, isCustom: boolean): HTMLElement {
    const sheet = el("div", "lw-gate-sheet");

    if (definition.codeOnly) {
      sheet.append(el("div", "lw-sheet-copy", definition.rationale));
      if (isCustom) sheet.append(gateReset(definition));
      return sheet;
    }

    sheet.append(el("div", "lw-sheet-copy", definition.rationale));

    const floorHead = el("div", "lw-sheet-label");
    const value = el("button", "lw-diag-value", policy.threshold.toFixed(2));
    value.type = "button";
    value.title = "Click to type an exact floor";
    let editing = false;
    value.addEventListener("click", () => {
      if (editing) return;
      editing = true;
      const input = numberInput(policy.threshold, 0, 1, 0.05, `${definition.label} threshold`,
        (next) => mutateGate(definition.id, { threshold: next }));
      input.className = "lw-input";
      value.replaceWith(input);
      input.focus();
      input.select();
    });
    floorHead.append(el("span", undefined, "Confidence floor"), value);
    sheet.append(floorHead);

    const track = el("div", "lw-control");
    const sliderFallback = () => {
      track.replaceChildren(numberInput(policy.threshold, 0, 1, 0.05, `${definition.label} threshold`,
        (next) => mutateGate(definition.id, { threshold: next })));
    };
    if (typeof ctx.components?.mountRangeSlider === "function") {
      queueMount(() => ctx.components!.mountRangeSlider!(track, {
        min: 0, max: 1, step: 0.05, value: policy.threshold,
        onCommit: (next: number) => mutateGate(definition.id, { threshold: next }),
      }), sliderFallback);
    } else sliderFallback();
    sheet.append(track);
    sheet.append(el("div", "lw-hint",
      "Answers below this are escalated: the gate stops deciding and uses its fallback instead."));

    const fallbackHead = el("div", "lw-sheet-label");
    fallbackHead.append(el("span", undefined, "When it cannot answer"));
    sheet.append(fallbackHead, selectControl(
      policy.fallback,
      GATE_FALLBACKS.map((value) => ({ value, label: GATE_FALLBACK_LABELS[value] })),
      `${definition.label} fallback`,
      (next) => mutateGate(definition.id, { fallback: next as GateFallback }),
    ));

    if (isCustom) sheet.append(gateReset(definition));
    return sheet;
  }

  function gateReset(definition: GateDefinition): HTMLElement {
    const reset = button("Reset to default", () => resetGate(definition.id));
    reset.className = "lw-button lw-gate-reset";
    return reset;
  }

  function latestJevRun(): { run: { jev: JevTurnDiagnostics }; } | null {
    for (const run of state?.runs ?? []) {
      if (run.jev) return { run: { jev: run.jev } };
    }
    return null;
  }

  function diagnosticsSection(): HTMLElement {
    const diagnostics = latestJevRun()?.run.jev ?? null;
    const summary = summarizeJevDiagnostics(diagnostics);

    return collapsible({
      title: "Last turn decisions",
      badge: diagnostics ? (diagnostics.status === "ok" ? "answered" : diagnostics.status) : undefined,
      badgeTone: diagnostics
        ? (diagnostics.status === "ok" ? "success" : diagnostics.status === "degraded" ? "warning" : "error")
        : "neutral",
      expanded: diagnosticsOpen,
      onToggle: (open) => { diagnosticsOpen = open; },
    }, (body) => {
      if (!diagnostics) {
        body.append(el("p", "lw-hint",
          state?.settings.jev.enabled
            ? "Generate a reply to see what each gate decided for that turn."
            : "Turn on Use Jev gates to start recording decisions."));
        return;
      }
      body.append(diagnosticsPanel(diagnostics, summary));
    });
  }

  function diagnosticsPanel(diagnostics: JevTurnDiagnostics, summary: string | null): HTMLElement {
    const wrap = el("div", "lw-diag");

    const strip = el("div", "lw-diag-strip");
    const status = el("span", "lw-badge");
    status.dataset.tone = diagnostics.status === "ok" ? "success" : diagnostics.status === "degraded" ? "warning" : "error";
    status.append(el("span", "lw-dot"), el("span", undefined,
      diagnostics.status === "ok" ? "Answered every gate" : diagnostics.status === "degraded" ? "Degraded" : "Skipped the Director"));
    strip.append(status);

    if (diagnostics.resolvedModel) strip.append(el("span", "lw-badge", diagnostics.resolvedModel));
    strip.append(el("span", "lw-badge", `${diagnostics.requestCount} request${diagnostics.requestCount === 1 ? "" : "s"}`));
    if (diagnostics.fallbackCount) {
      const fallback = el("span", "lw-badge");
      fallback.dataset.tone = "warning";
      fallback.append(el("span", "lw-dot"), el("span", undefined, `${diagnostics.fallbackCount} fallback`));
      strip.append(fallback);
    }
    if (diagnostics.escalatedCount) {
      strip.append(el("span", "lw-badge", `${diagnostics.escalatedCount} escalated`));
    }
    const latency = [diagnostics.gatePhaseMs, diagnostics.verifyPhaseMs]
      .filter((value): value is number => value !== null)
      .reduce((total, value) => total + value, 0);
    if (latency > 0) strip.append(el("span", "lw-badge", `${latency}ms in Jev`));
    if (diagnostics.inputTokens !== null) strip.append(el("span", "lw-badge", `${diagnostics.inputTokens} in / ${diagnostics.outputTokens ?? 0} out`));
    if (diagnostics.stateCompacted) strip.append(el("span", "lw-badge", "state compacted"));
    wrap.append(strip);

    if (diagnostics.error) {
      const notice = el("div", "lw-notice", diagnostics.error);
      notice.dataset.tone = "warning";
      wrap.append(notice);
    }

    // Real gate decisions first; the two code-computed records are informational
    // and would otherwise sit in the middle of the list as noise.
    const decided = diagnostics.gates.filter((record) => record.gateId !== "confidence_escalation" && record.gateId !== "budget_degradation");
    const computed = diagnostics.gates.filter((record) => record.gateId === "confidence_escalation" || record.gateId === "budget_degradation");

    const list = el("div", "lw-diag-list");
    for (const record of decided) list.append(gateResultRow(record));
    for (const record of computed) list.append(gateResultRow(record, true));
    wrap.append(list);

    if (summary) wrap.append(el("p", "lw-hint", summary));
    return wrap;
  }

  function gateResultRow(record: JevGateRecord, informational = false): HTMLElement {
    const flagged = !informational && (record.usedFallback || record.escalated);
    const row = el("div", "lw-diag-row");
    row.dataset.flag = String(flagged);
    row.dataset.on = String(!informational);

    const head = el("div", "lw-diag-head");
    head.append(el("span", "lw-diag-name", record.label), el("span", "lw-diag-value", describeGateValue(record)));

    const meta = el("div", "lw-diag-meta");
    if (record.confidence !== null) {
      const confidence = el("span", "lw-badge", `${record.confidenceDerived ? "~" : ""}${record.confidence.toFixed(2)}`);
      if (record.confidence < record.threshold) {
        confidence.dataset.tone = "warning";
        confidence.title = `Below the ${record.threshold.toFixed(2)} floor`;
      }
      meta.append(confidence);
    }
    if (record.usedFallback && !informational) {
      const fallback = el("span", "lw-badge", GATE_FALLBACK_LABELS[record.fallback]);
      fallback.dataset.tone = "warning";
      meta.append(fallback);
    }
    row.append(head, meta);
    if (record.note) row.append(el("span", "lw-diag-note", record.note));
    return row;
  }

  function describeGateValue(record: JevGateRecord): string {
    if (record.value === null) return "no answer";
    if (typeof record.value === "boolean") return record.value ? "yes" : "no";
    return String(record.value);
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

  /**
   * A segmented view switcher for the single drawer tab.
   *
   * The host allows one tab per extension here, so the Director and Jev surfaces
   * live as two views inside it. Views are hidden rather than re-rendered, which
   * keeps typed-but-unsaved input (a pasted Jev key) alive when switching.
   */
  function viewTabs(): HTMLElement {
    const list = el("div", "lw-tabs");
    list.setAttribute("role", "tablist");
    list.setAttribute("aria-label", "LumiWorld views");

    const entries: Array<{ id: LumiTab; label: string; hint: string }> = [
      { id: "director", label: "Director", hint: "Connection, triggers, and context" },
      { id: "jev", label: "Jev", hint: "Gate setup and last-turn decisions" },
    ];

    for (const entry of entries) {
      const tab = el("button", "lw-tab");
      tab.type = "button";
      tab.id = `lw-tab-${entry.id}`;
      tab.setAttribute("role", "tab");
      tab.setAttribute("aria-selected", String(activeTab === entry.id));
      tab.setAttribute("aria-controls", `lw-view-${entry.id}`);
      tab.tabIndex = activeTab === entry.id ? 0 : -1;
      tab.title = entry.hint;
      tab.append(document.createTextNode(entry.label));

      // The dot carries enabled/attention state, so each tab is legible at rest.
      const dot = el("span", "lw-dot");
      if (entry.id === "director") {
        const ready = draft.enabled && !!state?.permissions.interceptor && draft.generationTypes.length > 0;
        if (!ready) dot.style.background = "var(--lumiverse-warning)";
      } else {
        const on = draft.jev.enabled;
        dot.style.background = on ? "var(--lumiverse-primary)" : "var(--lumiverse-text-muted)";
        dot.style.opacity = on ? "1" : ".5";
      }
      tab.append(dot);

      tab.addEventListener("click", () => activateView(entry.id));
      tab.addEventListener("keydown", (event) => {
        const key = (event as KeyboardEvent).key;
        if (key !== "ArrowRight" && key !== "ArrowLeft" && key !== "Home" && key !== "End") return;
        event.preventDefault();
        const index = entries.findIndex((candidate) => candidate.id === activeTab);
        const next = key === "Home" ? 0
          : key === "End" ? entries.length - 1
          : key === "ArrowRight" ? (index + 1) % entries.length
          : (index - 1 + entries.length) % entries.length;
        activateView(entries[next]!.id);
        drawer.root.querySelector<HTMLElement>(`#lw-tab-${entries[next]!.id}`)?.focus();
      });

      list.append(tab);
    }
    return list;
  }

  /** Switches views in place. Settings opened in one view stay expanded in the other. */
  function activateView(tab: LumiTab): void {
    activeTab = tab;
    for (const buttonNode of drawer.root.querySelectorAll<HTMLElement>('[role="tab"]')) {
      buttonNode.setAttribute("aria-selected", String(buttonNode.id === `lw-tab-${tab}`));
      buttonNode.tabIndex = buttonNode.id === `lw-tab-${tab}` ? 0 : -1;
    }
    for (const view of drawer.root.querySelectorAll<HTMLElement>("[data-lw-view]")) {
      view.hidden = view.dataset.lwView !== tab;
    }
    // Focused controls inside a hidden view would leave the caret stranded.
    activeElementInside(drawer.root)?.blur();
  }

  function activeElementInside(root: HTMLElement): HTMLElement | null {
    const active = document.activeElement as HTMLElement | null;
    return active && root.contains(active) ? active : null;
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

    const notices = el("div"); notices.dataset.lwNotice = "";
    const warnings = el("div"); warnings.dataset.lwWarnings = "";
    shell.append(notices, warnings);
    updateWarnings();
    if (!state) { shell.append(el("div", "lw-loading", "Loading LumiWorld settings…")); updateDirectorStatus(); renderNotice(); return; }

    shell.append(viewTabs());

    const directorView = renderDirectorView();
    const jevView = renderJevView();
    shell.append(directorView, jevView);

    const footer = el("footer", "lw-footer");
    footer.append(el("span", undefined, `LumiWorld ${VERSION}`));
    const footerStatus = el("div", "lw-footer-status");
    const saveStatus = el("span", "lw-save"); saveStatus.dataset.lwSaveStatus = "";
    saveStatus.setAttribute("role", "status");
    const retry = button("Retry save", () => scheduleSave(0)); retry.dataset.lwRetry = "";
    footerStatus.append(saveStatus, retry); footer.append(footerStatus); shell.append(footer);

    flushMounts();
    activateView(activeTab);
    updateDirectorStatus(); updateSaveStatus(); updateTestButton(); updateJevTestButton(); renderNotice();
  }

  /** Director surface: connection, what it runs for, and what it sees. */
  function renderDirectorView(): HTMLElement {
    const view = el("div", "lw-panel-view");
    view.dataset.lwView = "director";
    view.setAttribute("role", "tabpanel");
    view.setAttribute("aria-labelledby", "lw-tab-director");

    const core = el("section", "lw-setup"); core.setAttribute("aria-label", "Director connection");
    const fields = el("div", "lw-fields"); fields.append(connectionField(), modelField()); core.append(fields);
    const actions = el("div", "lw-actions");
    const test = button("Test Director", testDirector, true); test.dataset.lwTest = "";
    const testHint = el("div", "lw-hint lw-test-hint"); testHint.dataset.lwTestHint = "";
    testHint.id = "lw-test-hint"; test.setAttribute("aria-describedby", testHint.id);
    actions.append(test, testHint); core.append(actions); view.append(core);

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
    generation.append(options); view.append(generation);

    const context = el("section", "lw-section"); context.append(el("h2", "lw-section-title", "Include in context"));
    const contextRows = el("div", "lw-context");
    contextRows.append(
      switchField("Character", draft.includeCharacter, (includeCharacter) => mutate({ includeCharacter })),
      switchField("User persona", draft.includeUserPersona, (includeUserPersona) => mutate({ includeUserPersona })),
      switchField("Activated World Info", draft.includeWorldInfoEntries, (includeWorldInfoEntries) => mutate({ includeWorldInfoEntries })),
    ); context.append(contextRows); view.append(context);

    const notes = el("details", "lw-details"); notes.open = notesOpen;
    notes.addEventListener("toggle", () => { notesOpen = notes.open; });
    const notesSummary = el("summary"); const notesCopy = el("span", "lw-summary-copy");
    const notesHint = el("span", "lw-hint", draft.additionalNotes.trim() ? "Your extra guidance" : "Optional guidance for the next reply");
    notesHint.dataset.lwNotesHint = "";
    notesCopy.append(el("span", undefined, "Director notes"), notesHint);
    notesSummary.append(notesCopy); notes.append(notesSummary);
    const notesBody = el("div", "lw-details-body");
    notesBody.append(textAreaField("Private guidance", "additionalNotes", draft.additionalNotes));
    notes.append(notesBody); view.append(notes);

    // Response limits and templates shape the Director call, so they belong here
    // rather than competing with the gate setup for space in the Jev view.
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
    advanced.append(advancedBody); view.append(advanced);

    const templates = el("details", "lw-details"); templates.open = templatesOpen;
    templates.addEventListener("toggle", () => { templatesOpen = templates.open; });
    templates.append(el("summary", undefined, "Prompt templates"));
    const templateBody = el("div", "lw-details-body");
    templateBody.append(textAreaField("System template", "systemTemplate", draft.systemTemplate),
      textAreaField("User template", "userTemplate", draft.userTemplate));
    templates.append(templateBody); advancedBody.append(templates);

    return view;
  }

  /** Jev surface: what Jev is, how each gate behaves, and what it decided. */
  function renderJevView(): HTMLElement {
    const view = el("div", "lw-panel-view");
    view.dataset.lwView = "jev";
    view.setAttribute("role", "tabpanel");
    view.setAttribute("aria-labelledby", "lw-tab-jev");

    const head = el("div", "lw-view-head");
    const copy = el("div", "lw-row-copy");
    const line = el("div", "lw-title-row");
    line.append(el("h2", "lw-view-title", "Jev"));
    const statusSlot = el("span");
    statusSlot.dataset.lwJevStatus = "";
    line.append(statusSlot);
    copy.append(line, el("p", "lw-view-intro",
      "Jev decides whether a turn needs the Director, then verifies the draft before it reaches your reply."));
    head.append(copy);
    view.append(head);

    view.append(jevSection());
    view.append(gatesSection());
    view.append(diagnosticsSection());
    return view;
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
    if (message.type === "jev_test_result") {
      jevTestPending = false;
      if (message.ok) jevKeyDraft = "";
      updateJevTestButton();
      showNotice(message.ok
        ? {
            tone: "success",
            text: `Jev answered on ${message.provider} / ${message.model} in ${message.latencyMs}ms (signal: ${message.answer}${message.confidence !== null ? `, confidence ${message.confidence.toFixed(2)}` : ""}).`,
          }
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
