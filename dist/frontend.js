// src/frontend.ts
var EXTENSION_NAME = "LumiWorld";
var VISIBLE_GENERATION_TYPES = ["normal", "continue", "regenerate", "swipe", "impersonate"];
var MAX_DIRECTOR_TIMEOUT_MS = 300000;
var MAX_WORLD_AGENT_TIMEOUT_MS = 2147483647;
var MAX_SAFE_SETTING = Number.MAX_SAFE_INTEGER;
var DEFAULT_HISTORY_MESSAGE_LIMIT = 12;
var DEFAULT_WORLD_AGENT_HOUR_DURATION_MS = 5 * 60 * 1000;
var ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M5 17.5c2.7 1.7 6.2 1.7 9 0 3.1-1.9 4.3-5.7 2.7-8.9"/><path d="M4.4 12.2c.4-3.3 3.2-5.9 6.6-5.9 1.9 0 3.6.8 4.8 2"/><path d="M18 4.5l.8 1.7 1.9.3-1.3 1.3.3 1.9-1.7-.9-1.7.9.3-1.9-1.3-1.3 1.9-.3.8-1.7z"/><path d="M7 13h6"/></svg>`;
var DEFAULT_SYSTEM_TEMPLATE = [
  "You are LumiWorld, a private world-state director for an interactive Lumiverse chat.",
  "Advance the world behind the next visible reply.",
  "Do not recap, write the assistant reply, address the user, or mention this control step.",
  'Return one concise, playable world-state directive. Prefer JSON like {"director_note":"..."}.'
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
  "Write the next world-state directive now."
].join(`
`);
var DEFAULT_SCHEDULE_TEMPLATE = [
  "You are LumiWorld's private World Agent for an interactive Lumiverse chat.",
  "Create {{char}}'s private background schedule for the current day.",
  "Return exactly 24 JSON schedule entries, one for every hour from 0 through 23.",
  "Only plan location and activity. Do not decide mood, thoughts, emotions, reactions, or goals.",
  'Return only: {"schedule":[{"hour":0,"location":"...","activity":"..."}]}'
].join(`
`);
var DEFAULT_UPDATE_TEMPLATE = [
  "You are LumiWorld's private World Agent for an interactive Lumiverse chat.",
  "Advance {{char}}'s private state by one simulated hour.",
  "Use the schedule, current state, character/persona context, and recent chat context.",
  "Return compact JSON for location, activity, current thought, and immediate goal. Do not write visible roleplay prose."
].join(`
`);
var DEFAULT_WORLD_AGENT_SETTINGS = {
  enabled: false,
  connectionId: null,
  modelOverride: "",
  temperature: 0.45,
  maxTokens: 700,
  timeoutMs: 60000,
  hourDurationMs: DEFAULT_WORLD_AGENT_HOUR_DURATION_MS,
  historyMessageLimit: DEFAULT_HISTORY_MESSAGE_LIMIT,
  includeUserPersona: true,
  includeCharacter: true,
  injectState: true,
  autoTickVisibleOnly: true,
  scheduleTemplate: DEFAULT_SCHEDULE_TEMPLATE,
  updateTemplate: DEFAULT_UPDATE_TEMPLATE
};
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
  runLogLimit: 12,
  worldAgent: DEFAULT_WORLD_AGENT_SETTINGS
};
var CSS = `
.lw-workbench, .lw-drawer { color:var(--lumiverse-text); font-family:var(--lumiverse-font-family,system-ui,sans-serif); font-size:13px; line-height:1.45; }
.lw-workbench *, .lw-drawer * { box-sizing:border-box; }
.lw-workbench { display:flex; flex-direction:column; width:100%; height:clamp(460px,calc(100vh - 150px),820px); min-height:0; overflow:hidden; padding:4px; }
.lw-modal-header { flex:0 0 auto; display:flex; justify-content:space-between; align-items:center; gap:12px; padding:2px 0 12px; background:var(--lumiverse-surface, var(--lumiverse-fill)); border-bottom:1px solid var(--lumiverse-border); }
.lw-modal-body { flex:1 1 auto; min-height:0; overflow:auto; padding:12px 2px 2px; }
.lw-channel-tabs { display:flex; gap:4px; padding:3px; border:1px solid var(--lumiverse-border); border-radius:8px; background:var(--lumiverse-fill-subtle); }
.lw-channel-tab { appearance:none; border:0; border-radius:5px; background:transparent; color:var(--lumiverse-text-dim); font:inherit; font-weight:700; padding:7px 10px; cursor:pointer; }
.lw-channel-tab.is-active { background:var(--lumiverse-primary, var(--lumiverse-accent)); color:var(--lumiverse-primary-contrast, CanvasText); }
.lw-header-actions { display:flex; gap:8px; flex-wrap:wrap; justify-content:flex-end; }
.lw-btn { appearance:none; min-height:32px; border:1px solid var(--lumiverse-border); border-radius:6px; background:var(--lumiverse-fill); color:var(--lumiverse-text); font:inherit; font-weight:650; padding:6px 10px; cursor:pointer; }
.lw-btn:hover:not(:disabled) { background:var(--lumiverse-fill-hover, var(--lumiverse-fill-subtle)); border-color:var(--lumiverse-border-hover, var(--lumiverse-border)); }
.lw-btn:focus-visible, .lw-channel-tab:focus-visible { outline:2px solid var(--lumiverse-primary, var(--lumiverse-accent)); outline-offset:2px; }
.lw-btn-primary { background:var(--lumiverse-primary, var(--lumiverse-accent)); border-color:var(--lumiverse-primary, var(--lumiverse-accent)); color:var(--lumiverse-primary-contrast, CanvasText); }
.lw-btn-danger { color:var(--lumiverse-danger, #b42318); }
.lw-btn:disabled { opacity:.48; cursor:not-allowed; }
.lw-banner { display:flex; align-items:center; justify-content:space-between; gap:10px; padding:10px 12px; border:1px solid var(--lumiverse-border); border-radius:6px; background:var(--lumiverse-fill-subtle); }
.lw-banner.warning { border-color:var(--lumiverse-warning, #b7791f); }
.lw-banner.error { border-color:var(--lumiverse-danger, #b42318); }
.lw-banner.success { border-color:var(--lumiverse-success, #18864b); }
.lw-banner-copy { border:0; background:transparent; color:inherit; font:inherit; font-weight:700; text-decoration:underline; cursor:pointer; white-space:nowrap; }
.lw-grid { display:grid; grid-template-columns:repeat(12,minmax(0,1fr)); gap:12px; align-items:start; }
.lw-panel { grid-column:span 4; min-width:0; border:1px solid var(--lumiverse-border); border-radius:7px; background:var(--lumiverse-fill-subtle); padding:14px; display:grid; gap:12px; }
.lw-panel.wide { grid-column:span 8; }.lw-panel.full { grid-column:1 / -1; }.lw-panel.half { grid-column:span 6; }
.lw-panel-head { display:flex; justify-content:space-between; gap:8px; align-items:center; padding-bottom:9px; border-bottom:1px solid var(--lumiverse-border); }
.lw-panel h3 { margin:0; font-size:13px; letter-spacing:0; }.lw-subtle { color:var(--lumiverse-text-dim); font-size:12px; }
.lw-form { display:grid; gap:11px; }.lw-two { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:10px; }
.lw-field { display:grid; gap:5px; min-width:0; }.lw-field > label, .lw-field-label { color:var(--lumiverse-text-dim); font-size:11px; font-weight:700; }
.lw-input, .lw-textarea, .lw-select { width:100%; border:1px solid var(--lumiverse-border); border-radius:6px; background:var(--lumiverse-fill); color:var(--lumiverse-text); font:inherit; padding:7px 8px; }
.lw-textarea { min-height:150px; resize:vertical; font-family:ui-monospace,SFMono-Regular,Consolas,monospace; font-size:12px; line-height:1.45; }
.lw-setting { display:flex; gap:10px; align-items:flex-start; padding:8px 0; border-bottom:1px solid var(--lumiverse-border-subtle, var(--lumiverse-border)); }.lw-setting:last-child { border-bottom:0; }
.lw-setting-copy { display:grid; gap:2px; min-width:0; }.lw-setting-title { font-weight:700; }.lw-setting-hint { color:var(--lumiverse-text-dim); font-size:12px; }
.lw-switch-slot { flex:0 0 auto; min-height:24px; display:flex; align-items:center; }.lw-control-slot { min-width:0; position:relative; }
.lw-generation-types { display:flex; flex-wrap:wrap; gap:7px; }.lw-check { display:inline-flex; gap:5px; align-items:center; font-size:12px; }
.lw-details { border:1px solid var(--lumiverse-border); border-radius:6px; background:var(--lumiverse-fill); }.lw-details summary { cursor:pointer; padding:10px; font-weight:700; }.lw-details-body { padding:0 10px 12px; display:grid; gap:11px; }
.lw-clock { display:grid; gap:12px; }.lw-clock-readout { padding:12px; border:1px solid var(--lumiverse-border); border-radius:6px; background:var(--lumiverse-fill); display:flex; justify-content:space-between; gap:10px; align-items:baseline; }.lw-clock-time { font-size:20px; font-weight:750; letter-spacing:0; }.lw-clock-status { color:var(--lumiverse-text-dim); font-size:12px; white-space:nowrap; }
.lw-actions { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:8px; }.lw-actions .lw-btn { width:100%; }
.lw-meters { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:8px; }.lw-meter { border:1px solid var(--lumiverse-border); border-radius:6px; padding:9px; background:var(--lumiverse-fill); min-width:0; }.lw-meter-label { color:var(--lumiverse-text-dim); font-size:10px; font-weight:700; text-transform:uppercase; }.lw-meter-value { margin-top:4px; overflow-wrap:anywhere; }
.lw-schedule { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:8px; }.lw-slot { min-width:0; border:1px solid var(--lumiverse-border); border-radius:6px; background:var(--lumiverse-fill); padding:8px; display:grid; gap:4px; }.lw-slot.is-now { border-color:var(--lumiverse-primary, var(--lumiverse-accent)); box-shadow:0 0 0 1px var(--lumiverse-primary, var(--lumiverse-accent)); }.lw-slot-time { font-size:11px; font-weight:750; }.lw-slot-location { color:var(--lumiverse-text-dim); font-size:12px; overflow-wrap:anywhere; }.lw-slot-activity { overflow-wrap:anywhere; }
.lw-empty { color:var(--lumiverse-text-dim); border:1px dashed var(--lumiverse-border); border-radius:6px; padding:14px; text-align:center; }
.lw-drawer { min-height:100%; padding:12px; background:var(--lumiverse-surface, transparent); }.lw-drawer-header { display:flex; justify-content:space-between; gap:8px; padding-bottom:10px; border-bottom:1px solid var(--lumiverse-border); }.lw-drawer-title { display:flex; align-items:center; gap:8px; font-size:15px; font-weight:750; }.lw-drawer-icon { width:22px; height:22px; color:var(--lumiverse-primary, var(--lumiverse-accent)); }.lw-drawer-body { padding-top:12px; }.lw-drawer .lw-grid { grid-template-columns:1fr; }.lw-drawer .lw-panel,.lw-drawer .lw-panel.wide,.lw-drawer .lw-panel.half,.lw-drawer .lw-panel.full { grid-column:1 / -1; }
.lw-float-root { width:260px; min-height:258px; position:relative; padding-top:42px; color:#2b201d; font-family:"Courier New",Courier,monospace; font-size:11px; line-height:1.35; user-select:none; }.lw-float-root * { box-sizing:border-box; }.lw-monitor { width:236px; margin:0 auto; padding:12px 12px 30px; position:relative; border:5px solid #8b7765; outline:2px solid #3a261f; border-radius:20px 20px 10px 10px; background:linear-gradient(145deg,#efe6d1,#c8baa0); box-shadow:0 14px 24px rgba(0,0,0,.45),inset 0 0 0 2px rgba(255,255,255,.28),inset 0 2px 4px rgba(255,255,255,.75),inset 0 -5px 10px rgba(0,0,0,.16); }.lw-monitor::before { content:""; position:absolute; top:8px; left:50%; width:92px; height:5px; transform:translateX(-50%); border-radius:999px; background:repeating-linear-gradient(90deg,#8f887a 0 3px,#665e54 3px 6px); }.lw-monitor::after { content:"LumiVision"; position:absolute; bottom:10px; left:50%; transform:translateX(-50%); color:#81796f; font-family:Arial,sans-serif; font-size:10px; font-weight:700; letter-spacing:1.6px; }.lw-monitor-antenna { position:absolute; top:-48px; left:50%; z-index:-1; width:4px; height:58px; transform-origin:bottom center; border-radius:999px; background:linear-gradient(to bottom,#b9ab92,#756653); box-shadow:0 0 2px rgba(0,0,0,.65); }.lw-monitor-antenna.left { transform:translateX(-18px) rotate(-34deg); }.lw-monitor-antenna.right { transform:translateX(18px) rotate(34deg); }.lw-monitor-screen { position:relative; aspect-ratio:4 / 3; overflow:hidden; padding:8px 8px 24px; border:7px solid #211f1d; border-radius:18px / 14px; background:radial-gradient(circle at 55% 40%,rgba(255,126,0,.16),transparent 42%),#080807; color:#ff9e3d; box-shadow:inset 0 0 28px rgba(0,0,0,.95),inset 0 0 10px rgba(255,158,61,.1); text-shadow:0 0 5px #ff5500; }.lw-monitor-screen::after { content:""; position:absolute; inset:0; pointer-events:none; background:linear-gradient(rgba(255,255,255,.035) 50%,rgba(0,0,0,.2) 50%); background-size:100% 4px; }.lw-monitor-head { position:relative; z-index:1; display:flex; justify-content:space-between; gap:6px; margin-bottom:4px; padding-bottom:3px; border-bottom:1px solid #ff7e00; font-size:10px; font-weight:700; }.lw-monitor-note-head { position:relative; z-index:1; display:flex; justify-content:space-between; gap:8px; align-items:center; margin-bottom:3px; font-size:10px; font-weight:800; text-transform:uppercase; }.lw-monitor-lines { position:relative; z-index:1; display:grid; gap:1px; }.lw-monitor-line { overflow:hidden; white-space:nowrap; text-overflow:ellipsis; }.lw-monitor-actions { position:absolute; z-index:1; right:10px; bottom:8px; left:10px; display:flex; justify-content:center; }.lw-monitor-action { appearance:none; border:0; background:transparent; color:#ff9e3d; padding:0; font:inherit; font-size:9px; font-weight:800; line-height:1; text-transform:uppercase; text-shadow:0 0 5px #ff5500; cursor:pointer; }.lw-monitor-action:hover { color:#ffd08a; text-decoration:underline; }.lw-monitor-knob { appearance:none; position:absolute; right:-10px; width:17px; height:17px; padding:0; border:2px solid #24211f; border-radius:50%; background:radial-gradient(circle at 35% 30%,#aaa,#333); box-shadow:1px 2px 4px rgba(0,0,0,.55); cursor:pointer; }.lw-monitor-knob:hover,.lw-monitor-knob:focus-visible { filter:brightness(1.25); outline:none; }.lw-monitor-knob.channel { bottom:24px; }.lw-monitor-knob.settings { bottom:48px; }.lw-save-dot { color:#6b5d4f; font-size:9px; text-transform:uppercase; }.lw-save-dot.is-saving { color:#9a6100; }.lw-save-dot.is-error { color:#9a1c1c; }
/* Premium glass-console modal */
.lw-workbench { padding:0; border:1px solid var(--lcs-glass-border, var(--lumiverse-border)); border-radius:var(--lumiverse-radius-xl,16px); background:linear-gradient(145deg,var(--lcs-glass-bg,var(--lumiverse-card-bg,var(--lumiverse-fill))),var(--lumiverse-bg-elevated,var(--lumiverse-fill))); box-shadow:var(--lumiverse-shadow-lg,0 24px 80px rgba(0,0,0,.5)),inset 0 1px 0 var(--lumiverse-highlight-inset-md,rgba(255,255,255,.12)); backdrop-filter:blur(var(--lcs-glass-strong-blur,12px)); }
.lw-modal-body { height:100%; min-height:0; padding:0; overflow:hidden; }
.lw-console-header { flex:0 0 auto; display:flex; align-items:center; justify-content:space-between; gap:20px; padding:20px 24px; border-bottom:1px solid var(--lcs-glass-border,var(--lumiverse-border)); background:linear-gradient(100deg,var(--lumiverse-primary-010,transparent),transparent 52%); }
.lw-console-header-brand { display:flex; align-items:center; gap:13px; min-width:0; }.lw-console-header-copy { min-width:0; }
.lw-console-header-icon,.lw-console-rail-icon { display:grid; place-items:center; color:var(--lumiverse-primary,var(--lumiverse-accent)); filter:drop-shadow(0 0 9px var(--lumiverse-primary-020,transparent)); }.lw-console-header-icon { width:34px; height:34px; padding:7px; border:1px solid var(--lumiverse-primary-050,var(--lumiverse-border)); border-radius:11px; background:var(--lumiverse-primary-010,var(--lumiverse-fill)); }.lw-console-header-icon svg,.lw-console-rail-icon svg { width:100%; height:100%; }
.lw-console-eyebrow { color:var(--lumiverse-primary-text,var(--lumiverse-primary,var(--lumiverse-accent))); font-size:10px; font-weight:800; letter-spacing:.14em; text-transform:uppercase; }.lw-console-title { margin:2px 0 1px; color:var(--lumiverse-text); font-size:20px; font-weight:800; letter-spacing:-.025em; }.lw-console-subtitle { margin:0; color:var(--lumiverse-text-dim); font-size:12px; }.lw-console-header-actions { display:flex; align-items:center; justify-content:flex-end; flex-wrap:wrap; gap:8px; }
.lw-console-layout { display:grid; grid-template-columns:228px minmax(0,1fr); height:100%; min-height:0; flex:1 1 auto; overflow:hidden; }.lw-console-rail { display:flex; min-width:0; flex-direction:column; gap:18px; padding:18px 12px; overflow:auto; border-right:1px solid var(--lcs-glass-border,var(--lumiverse-border)); background:var(--lumiverse-fill-subtle); }.lw-console-rail-brand { display:flex; align-items:center; gap:9px; padding:0 8px 4px; color:var(--lumiverse-text); font-size:14px; font-weight:800; }.lw-console-rail-icon { width:24px; height:24px; }
.lw-console-nav { display:grid; gap:6px; }.lw-console-nav-item { display:flex; width:100%; align-items:center; gap:10px; padding:10px 9px; border:1px solid transparent; border-radius:12px; background:transparent; color:var(--lumiverse-text-dim); text-align:left; font:inherit; cursor:pointer; transition:background var(--lumiverse-transition-fast,.15s ease),border-color var(--lumiverse-transition-fast,.15s ease),color var(--lumiverse-transition-fast,.15s ease),transform var(--lumiverse-transition-fast,.15s ease); }.lw-console-nav-item:hover { transform:translateX(2px); border-color:var(--lcs-glass-border-hover,var(--lumiverse-border-hover)); background:var(--lcs-glass-bg-hover,var(--lumiverse-fill-hover)); color:var(--lumiverse-text); }.lw-console-nav-item.is-active { border-color:var(--lumiverse-primary-020,var(--lumiverse-border)); background:linear-gradient(135deg,var(--lumiverse-primary-015,var(--lumiverse-fill-hover)),var(--lumiverse-fill)); color:var(--lumiverse-text); box-shadow:inset 3px 0 var(--lumiverse-primary,var(--lumiverse-accent)),var(--lumiverse-shadow-sm,0 2px 8px rgba(0,0,0,.2)); }.lw-console-nav-item:focus-visible { outline:2px solid var(--lumiverse-primary,var(--lumiverse-accent)); outline-offset:2px; }.lw-console-nav-marker { display:grid; width:28px; height:28px; flex:0 0 auto; place-items:center; border:1px solid var(--lumiverse-border); border-radius:9px; color:var(--lumiverse-text-dim); font-family:var(--lumiverse-font-mono,ui-monospace,monospace); font-size:10px; }.lw-console-nav-item.is-active .lw-console-nav-marker { border-color:var(--lumiverse-primary-050,var(--lumiverse-primary)); background:var(--lumiverse-primary-015,var(--lumiverse-fill)); color:var(--lumiverse-primary-text,var(--lumiverse-primary)); }.lw-console-nav-copy { display:grid; min-width:0; gap:2px; }.lw-console-nav-label { color:inherit; font-size:12px; font-weight:800; }.lw-console-nav-description { overflow:hidden; color:var(--lumiverse-text-dim); font-size:10px; text-overflow:ellipsis; white-space:nowrap; }.lw-console-rail-footer { display:grid; gap:8px; margin-top:auto; padding:11px 8px 2px; border-top:1px solid var(--lumiverse-border); color:var(--lumiverse-text-dim); font-size:10px; }
.lw-console-main { height:100%; min-width:0; min-height:0; overflow-x:hidden; overflow-y:auto; overscroll-behavior:contain; padding:22px; scrollbar-color:var(--lumiverse-primary-020,var(--lumiverse-border)) transparent; }.lw-console-main > .lw-banner { margin-bottom:12px; }.lw-console-main .lw-grid { gap:14px; }
.lw-panel.lw-console-card { border-color:var(--lcs-glass-border,var(--lumiverse-border)); border-radius:var(--lumiverse-radius-lg,12px); background:var(--lcs-glass-bg,var(--lumiverse-card-bg,var(--lumiverse-fill-subtle))); box-shadow:var(--lumiverse-shadow-sm,0 2px 8px rgba(0,0,0,.2)),inset 0 1px 0 var(--lumiverse-highlight-inset,rgba(255,255,255,.08)); transition:border-color var(--lumiverse-transition-fast,.15s ease),box-shadow var(--lumiverse-transition-fast,.15s ease),transform var(--lumiverse-transition-fast,.15s ease); }.lw-panel.lw-console-card:hover { transform:translateY(-1px); border-color:var(--lcs-glass-border-hover,var(--lumiverse-border-hover)); box-shadow:var(--lumiverse-shadow-md,0 8px 24px rgba(0,0,0,.3)),inset 0 1px 0 var(--lumiverse-highlight-inset-md,rgba(255,255,255,.12)); }.lw-panel.lw-console-card .lw-panel-head { align-items:flex-start; border-bottom-color:var(--lcs-glass-border,var(--lumiverse-border)); }.lw-panel.lw-console-card .lw-panel-head h3 { font-size:14px; letter-spacing:-.01em; }.lw-panel.lw-console-card .lw-panel-head .lw-status-badge { margin-left:auto; }
.lw-overview-hero { display:flex; align-items:flex-end; justify-content:space-between; gap:24px; margin-bottom:16px; padding:22px; overflow:hidden; border:1px solid var(--lumiverse-primary-020,var(--lumiverse-border)); border-radius:var(--lumiverse-radius-lg,12px); background:radial-gradient(circle at 88% 15%,var(--lumiverse-primary-015,transparent),transparent 38%),linear-gradient(135deg,var(--lcs-glass-bg-hover,var(--lumiverse-fill-hover)),var(--lcs-glass-bg,var(--lumiverse-fill))); box-shadow:inset 0 1px 0 var(--lumiverse-highlight-inset-md,rgba(255,255,255,.12)); }.lw-overview-hero-copy { max-width:650px; }.lw-overview-hero-title { margin:5px 0 7px; font-size:clamp(22px,3vw,32px); letter-spacing:-.045em; line-height:1.05; }.lw-overview-hero-text,.lw-card-copy { margin:0; color:var(--lumiverse-text-muted,var(--lumiverse-text-dim)); font-size:13px; line-height:1.55; }.lw-overview-hero-aside { display:grid; min-width:210px; gap:12px; justify-items:end; }.lw-overview-hero-metrics { display:grid; grid-template-columns:repeat(2,minmax(86px,1fr)); gap:9px; width:100%; }.lw-overview-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:14px; margin-bottom:14px; }.lw-overview-stat { display:grid; gap:3px; min-width:0; padding:9px 10px; border:1px solid var(--lumiverse-border); border-radius:10px; background:var(--lumiverse-fill-subtle); }.lw-overview-stat-label { overflow:hidden; color:var(--lumiverse-text-dim); font-size:10px; font-weight:700; text-overflow:ellipsis; text-transform:uppercase; white-space:nowrap; }.lw-overview-stat-value { overflow:hidden; color:var(--lumiverse-text); font-size:12px; font-weight:750; text-overflow:ellipsis; white-space:nowrap; }.lw-overview-stat-value.success { color:var(--lumiverse-success,#22c55e); }.lw-overview-actions { display:flex; flex-wrap:wrap; gap:8px; margin-top:auto; padding-top:5px; }.lw-overview-card { min-height:220px; }.lw-overview-card > .lw-card-copy { min-height:42px; }
.lw-status-badge { display:inline-flex; align-items:center; gap:6px; width:max-content; min-height:22px; padding:3px 8px; border:1px solid var(--lumiverse-border); border-radius:999px; background:var(--lumiverse-fill-subtle); color:var(--lumiverse-text-dim); font-size:10px; font-weight:800; letter-spacing:.02em; white-space:nowrap; }.lw-status-badge::before { width:5px; height:5px; border-radius:50%; background:currentColor; box-shadow:0 0 8px currentColor; content:""; }.lw-status-badge.success { border-color:var(--lumiverse-success-020,var(--lumiverse-border)); background:var(--lumiverse-success-015,var(--lumiverse-fill-subtle)); color:var(--lumiverse-success,#22c55e); }.lw-status-badge.warning { border-color:var(--lumiverse-warning-020,var(--lumiverse-border)); background:var(--lumiverse-warning-015,var(--lumiverse-fill-subtle)); color:var(--lumiverse-warning,#f59e0b); }.lw-status-badge.error { border-color:var(--lumiverse-danger-020,var(--lumiverse-border)); background:var(--lumiverse-danger-015,var(--lumiverse-fill-subtle)); color:var(--lumiverse-danger,#ef4444); }.lw-run-list { display:grid; gap:7px; }.lw-run-row { display:grid; grid-template-columns:minmax(90px,.5fr) minmax(0,1fr) auto; align-items:center; gap:10px; padding:9px 10px; border:1px solid var(--lumiverse-border); border-radius:9px; background:var(--lumiverse-fill-subtle); }.lw-run-label { font-weight:750; }.lw-run-meta { overflow:hidden; color:var(--lumiverse-text-dim); font-size:11px; text-overflow:ellipsis; white-space:nowrap; }
.lw-btn { min-height:35px; border-radius:10px; background:var(--lcs-glass-bg-hover,var(--lumiverse-fill)); box-shadow:inset 0 1px 0 var(--lumiverse-highlight-inset,rgba(255,255,255,.08)); transition:background var(--lumiverse-transition-fast,.15s ease),border-color var(--lumiverse-transition-fast,.15s ease),transform var(--lumiverse-transition-fast,.15s ease),box-shadow var(--lumiverse-transition-fast,.15s ease); }.lw-btn:hover:not(:disabled) { transform:translateY(-1px); background:var(--lcs-glass-bg-hover,var(--lumiverse-fill-hover)); box-shadow:var(--lumiverse-shadow-sm,0 2px 8px rgba(0,0,0,.2)); }.lw-btn-primary { background:linear-gradient(135deg,var(--lumiverse-primary,var(--lumiverse-accent)),var(--lumiverse-primary-hover,var(--lumiverse-primary,var(--lumiverse-accent)))); box-shadow:0 4px 16px var(--lumiverse-primary-020,transparent),inset 0 1px 0 var(--lumiverse-highlight-inset-md,rgba(255,255,255,.15)); }.lw-btn-danger { color:var(--lumiverse-danger,#ef4444); }.lw-channel-tabs { border-radius:999px; background:var(--lcs-glass-bg,var(--lumiverse-fill-subtle)); }.lw-channel-tab { border-radius:999px; padding:8px 13px; transition:background var(--lumiverse-transition-fast,.15s ease),color var(--lumiverse-transition-fast,.15s ease),transform var(--lumiverse-transition-fast,.15s ease); }.lw-channel-tab:hover:not(.is-active) { transform:translateY(-1px); color:var(--lumiverse-text); }
.lw-input,.lw-textarea,.lw-select { border-radius:10px; border-color:var(--lcs-glass-border,var(--lumiverse-border)); background:var(--lumiverse-fill); transition:border-color var(--lumiverse-transition-fast,.15s ease),box-shadow var(--lumiverse-transition-fast,.15s ease),background var(--lumiverse-transition-fast,.15s ease); }.lw-input:hover,.lw-textarea:hover,.lw-select:hover { border-color:var(--lcs-glass-border-hover,var(--lumiverse-border-hover)); background:var(--lumiverse-fill-hover,var(--lumiverse-fill)); }.lw-input:focus,.lw-textarea:focus,.lw-select:focus { border-color:var(--lumiverse-primary-050,var(--lumiverse-primary)); box-shadow:0 0 0 3px var(--lumiverse-primary-010,transparent); outline:none; }.lw-setting { padding:10px 0; border-bottom-color:var(--lcs-glass-border,var(--lumiverse-border)); }.lw-check { padding:8px 11px; border:1px solid var(--lumiverse-border); border-radius:999px; background:var(--lumiverse-fill-subtle); color:var(--lumiverse-text-dim); cursor:pointer; transition:background var(--lumiverse-transition-fast,.15s ease),border-color var(--lumiverse-transition-fast,.15s ease),color var(--lumiverse-transition-fast,.15s ease),transform var(--lumiverse-transition-fast,.15s ease); }.lw-check:hover { transform:translateY(-1px); border-color:var(--lumiverse-border-hover); color:var(--lumiverse-text); }.lw-check.is-selected { border-color:var(--lumiverse-primary-050,var(--lumiverse-primary)); background:var(--lumiverse-primary-015,var(--lumiverse-fill)); color:var(--lumiverse-text); box-shadow:0 0 0 2px var(--lumiverse-primary-010,transparent); }.lw-check input { accent-color:var(--lumiverse-primary,var(--lumiverse-accent)); }.lw-range-slot { min-width:0; }.lw-range-fallback-wrap { display:flex; align-items:center; gap:10px; }.lw-range-fallback { width:100%; accent-color:var(--lumiverse-primary,var(--lumiverse-accent)); }.lw-range-value { min-width:38px; color:var(--lumiverse-text-muted,var(--lumiverse-text)); font-family:var(--lumiverse-font-mono,ui-monospace,monospace); font-size:11px; text-align:right; }
.lw-details { border-radius:10px; border-color:var(--lcs-glass-border,var(--lumiverse-border)); background:var(--lumiverse-fill-subtle); }.lw-details summary { padding:12px; transition:background var(--lumiverse-transition-fast,.15s ease); }.lw-details summary:hover { background:var(--lumiverse-fill-hover); }.lw-schedule { gap:9px; }.lw-slot { border-radius:10px; border-color:var(--lcs-glass-border,var(--lumiverse-border)); background:var(--lumiverse-fill-subtle); transition:transform var(--lumiverse-transition-fast,.15s ease),border-color var(--lumiverse-transition-fast,.15s ease),background var(--lumiverse-transition-fast,.15s ease); }.lw-slot:hover { transform:translateY(-2px); border-color:var(--lcs-glass-border-hover,var(--lumiverse-border-hover)); background:var(--lcs-glass-bg-hover,var(--lumiverse-fill-hover)); }.lw-slot.is-now { border-color:var(--lumiverse-primary,var(--lumiverse-accent)); background:var(--lumiverse-primary-010,var(--lumiverse-fill-subtle)); box-shadow:0 0 0 1px var(--lumiverse-primary,var(--lumiverse-accent)),0 0 18px var(--lumiverse-primary-015,transparent); }.lw-banner { border-radius:10px; border-color:var(--lcs-glass-border,var(--lumiverse-border)); background:var(--lcs-glass-bg,var(--lumiverse-fill-subtle)); box-shadow:inset 0 1px 0 var(--lumiverse-highlight-inset,rgba(255,255,255,.08)); }.lw-empty { border-radius:10px; background:var(--lumiverse-fill-subtle); }
@media (max-width:900px) { .lw-panel,.lw-panel.wide,.lw-panel.half { grid-column:1 / -1; }.lw-schedule { grid-template-columns:repeat(3,minmax(0,1fr)); } }
@media (max-width:560px) { .lw-modal-header,.lw-drawer-header { align-items:stretch; flex-direction:column; }.lw-header-actions { justify-content:stretch; }.lw-header-actions .lw-btn { flex:1; }.lw-two,.lw-meters,.lw-actions { grid-template-columns:1fr; }.lw-schedule { grid-template-columns:repeat(2,minmax(0,1fr)); }.lw-clock-readout { align-items:flex-start; flex-direction:column; } }
@media (max-width:760px) { .lw-console-header { align-items:flex-start; flex-direction:column; padding:16px; }.lw-console-header-actions { width:100%; justify-content:flex-start; }.lw-console-layout { display:flex; flex-direction:column; height:100%; }.lw-console-rail { flex:0 0 auto; flex-direction:row; align-items:center; gap:12px; padding:10px 12px; overflow-x:auto; border-right:0; border-bottom:1px solid var(--lcs-glass-border,var(--lumiverse-border)); }.lw-console-rail-brand,.lw-console-rail-footer { display:none; }.lw-console-nav { display:flex; flex:1 1 auto; gap:6px; }.lw-console-nav-item { min-width:150px; }.lw-console-main { flex:1 1 auto; height:auto; padding:14px; overflow-y:auto; }.lw-overview-hero { align-items:flex-start; flex-direction:column; padding:17px; }.lw-overview-hero-aside { width:100%; justify-items:stretch; }.lw-overview-grid { grid-template-columns:1fr; } }
@media (prefers-reduced-motion:reduce) { .lw-console-nav-item,.lw-btn,.lw-panel.lw-console-card,.lw-check,.lw-slot,.lw-channel-tab { transition:none; } .lw-console-nav-item:hover,.lw-btn:hover:not(:disabled),.lw-panel.lw-console-card:hover,.lw-check:hover,.lw-slot:hover,.lw-channel-tab:hover:not(.is-active) { transform:none; } }
`;
function asRecord(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}
function cleanString(value, fallback = "") {
  return typeof value === "string" ? value.trim() : fallback;
}
function cleanNullableString(value) {
  const text = cleanString(value);
  return text || null;
}
function numberInRange(value, fallback, min, max) {
  const numeric = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numeric) ? Math.min(max, Math.max(min, numeric)) : fallback;
}
function integerInRange(value, fallback, min, max) {
  return Math.round(numberInRange(value, fallback, min, max));
}
function normalizeFrontendSettings(value) {
  const input = asRecord(value);
  const world = asRecord(input.worldAgent);
  const allowed = new Set(VISIBLE_GENERATION_TYPES);
  const generationTypes = Array.isArray(input.generationTypes) ? input.generationTypes.filter((item) => typeof item === "string" && allowed.has(item)) : [...VISIBLE_GENERATION_TYPES];
  return {
    enabled: typeof input.enabled === "boolean" ? input.enabled : DEFAULT_SETTINGS.enabled,
    connectionId: cleanNullableString(input.connectionId),
    modelOverride: cleanString(input.modelOverride),
    temperature: numberInRange(input.temperature, DEFAULT_SETTINGS.temperature, 0, 2),
    maxTokens: integerInRange(input.maxTokens, DEFAULT_SETTINGS.maxTokens, 64, MAX_SAFE_SETTING),
    timeoutMs: integerInRange(input.timeoutMs, DEFAULT_SETTINGS.timeoutMs, 1000, MAX_DIRECTOR_TIMEOUT_MS),
    maxInputChars: integerInRange(input.maxInputChars, DEFAULT_SETTINGS.maxInputChars, 4000, 500000),
    historyMessageLimit: integerInRange(input.historyMessageLimit, DEFAULT_SETTINGS.historyMessageLimit, 0, MAX_SAFE_SETTING),
    includeWorldInfoEntries: typeof input.includeWorldInfoEntries === "boolean" ? input.includeWorldInfoEntries : DEFAULT_SETTINGS.includeWorldInfoEntries,
    includeUserPersona: typeof input.includeUserPersona === "boolean" ? input.includeUserPersona : DEFAULT_SETTINGS.includeUserPersona,
    includeCharacter: typeof input.includeCharacter === "boolean" ? input.includeCharacter : DEFAULT_SETTINGS.includeCharacter,
    generationTypes: generationTypes.length ? [...new Set(generationTypes)] : [...VISIBLE_GENERATION_TYPES],
    additionalNotes: cleanString(input.additionalNotes),
    systemTemplate: cleanString(input.systemTemplate, DEFAULT_SYSTEM_TEMPLATE),
    userTemplate: cleanString(input.userTemplate, DEFAULT_USER_TEMPLATE),
    runLogLimit: integerInRange(input.runLogLimit, DEFAULT_SETTINGS.runLogLimit, 0, 50),
    worldAgent: {
      enabled: typeof world.enabled === "boolean" ? world.enabled : DEFAULT_WORLD_AGENT_SETTINGS.enabled,
      connectionId: cleanNullableString(world.connectionId),
      modelOverride: cleanString(world.modelOverride),
      temperature: numberInRange(world.temperature, DEFAULT_WORLD_AGENT_SETTINGS.temperature, 0, 2),
      maxTokens: integerInRange(world.maxTokens, DEFAULT_WORLD_AGENT_SETTINGS.maxTokens, 64, MAX_SAFE_SETTING),
      timeoutMs: integerInRange(world.timeoutMs, DEFAULT_WORLD_AGENT_SETTINGS.timeoutMs, 1000, MAX_WORLD_AGENT_TIMEOUT_MS),
      hourDurationMs: integerInRange(world.hourDurationMs, DEFAULT_WORLD_AGENT_SETTINGS.hourDurationMs, 1000, 365 * 24 * 60 * 60 * 1000),
      historyMessageLimit: integerInRange(world.historyMessageLimit, DEFAULT_WORLD_AGENT_SETTINGS.historyMessageLimit, 0, MAX_SAFE_SETTING),
      includeUserPersona: typeof world.includeUserPersona === "boolean" ? world.includeUserPersona : DEFAULT_WORLD_AGENT_SETTINGS.includeUserPersona,
      includeCharacter: typeof world.includeCharacter === "boolean" ? world.includeCharacter : DEFAULT_WORLD_AGENT_SETTINGS.includeCharacter,
      injectState: typeof world.injectState === "boolean" ? world.injectState : DEFAULT_WORLD_AGENT_SETTINGS.injectState,
      autoTickVisibleOnly: typeof world.autoTickVisibleOnly === "boolean" ? world.autoTickVisibleOnly : DEFAULT_WORLD_AGENT_SETTINGS.autoTickVisibleOnly,
      scheduleTemplate: cleanString(world.scheduleTemplate, DEFAULT_SCHEDULE_TEMPLATE),
      updateTemplate: cleanString(world.updateTemplate, DEFAULT_UPDATE_TEMPLATE)
    }
  };
}
function cloneSettings(settings) {
  return normalizeFrontendSettings({ ...settings, generationTypes: [...settings.generationTypes], worldAgent: { ...settings.worldAgent } });
}

class SettingsSaveQueue {
  revision = 0;
  sentRevision = 0;
  inFlight = false;
  markDirty() {
    this.revision += 1;
    return this.revision;
  }
  begin() {
    if (this.inFlight || this.sentRevision >= this.revision)
      return null;
    this.inFlight = true;
    this.sentRevision = this.revision;
    return this.sentRevision;
  }
  acknowledge() {
    this.inFlight = false;
    return this.sentRevision < this.revision;
  }
  fail() {
    this.inFlight = false;
  }
  get isInFlight() {
    return this.inFlight;
  }
  get isDirty() {
    return this.sentRevision < this.revision;
  }
}
function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className)
    node.className = className;
  if (text != null)
    node.textContent = text;
  return node;
}
function formatHour(hour) {
  const normalized = Math.max(0, Math.min(23, Math.round(hour)));
  return `${normalized % 12 || 12}:00${normalized < 12 ? "am" : "pm"}`;
}
function formatClock(state, durationMs, now = Date.now()) {
  if (!state)
    return "Day 1, 8:00:00am";
  let day = state.day;
  let hour = state.hour;
  let seconds = 0;
  if (state.running && state.lastTickAt != null && durationMs > 0) {
    const elapsed = Math.max(0, now - state.lastTickAt);
    if (elapsed >= durationMs) {
      hour = (hour + 1) % 24;
      if (hour === 0)
        day += 1;
    } else
      seconds = Math.floor(elapsed / durationMs * 3600);
  }
  const minute = String(Math.floor(seconds / 60)).padStart(2, "0");
  const second = String(seconds % 60).padStart(2, "0");
  const normalized = Math.max(0, Math.min(23, hour));
  return `Day ${day}, ${normalized % 12 || 12}:${minute}:${second}${normalized < 12 ? "am" : "pm"}`;
}
function activeChat(ctx) {
  try {
    return ctx.getActiveChat();
  } catch {
    return { chatId: null, characterId: null };
  }
}
function readId(payload, key) {
  const record = asRecord(payload);
  const value = record[key] ?? record[key === "chatId" ? "chat_id" : "character_id"];
  return typeof value === "string" && value.trim() ? value : null;
}
function setup(ctx) {
  const cleanups = [];
  const drawerHandles = [];
  const modalHandles = [];
  let mountingHandles = drawerHandles;
  let state = null;
  let draft = cloneSettings(DEFAULT_SETTINGS);
  let activeChannel = "director";
  let modalView = "overview";
  let notice = null;
  let noticeTimer = null;
  let saveTimer = null;
  let clockTimer = null;
  let saveState = "saved";
  let modal = null;
  let widget = null;
  const queue = new SettingsSaveQueue;
  cleanups.push(ctx.dom.addStyle(CSS));
  const drawer = ctx.ui.registerDrawerTab({
    id: "lumi-world",
    title: EXTENSION_NAME,
    shortName: "World",
    headerTitle: "LumiWorld",
    description: "Private director notes and per-chat world simulation",
    keywords: ["lumiworld", "director", "world", "agent"],
    iconSvg: ICON
  });
  cleanups.push(() => drawer.destroy());
  function send(message) {
    const active = activeChat(ctx);
    ctx.sendToBackend({ ...message, chatId: "chatId" in message ? message.chatId ?? active.chatId : active.chatId, characterId: "characterId" in message ? message.characterId ?? active.characterId : active.characterId });
  }
  function destroyHandles(handles) {
    while (handles.length) {
      try {
        handles.pop()?.destroy();
      } catch {}
    }
  }
  function setNotice(next, ttlMs = 9000) {
    if (noticeTimer)
      clearTimeout(noticeTimer);
    notice = next;
    noticeTimer = next ? setTimeout(() => {
      notice = null;
      renderInteractive();
    }, ttlMs) : null;
  }
  function copyText(text) {
    (async () => {
      try {
        if (navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(text);
          return;
        }
      } catch {}
      const fallback = document.createElement("textarea");
      fallback.value = text;
      fallback.setAttribute("readonly", "true");
      fallback.style.cssText = "position:fixed;left:-9999px;top:0";
      document.body.appendChild(fallback);
      fallback.focus();
      fallback.select();
      try {
        document.execCommand("copy");
      } finally {
        fallback.remove();
      }
    })();
  }
  function scheduleSave(delay = 450) {
    if (saveTimer)
      clearTimeout(saveTimer);
    saveState = "saving";
    drawer.setBadge("Saving");
    renderWidget();
    saveTimer = setTimeout(() => {
      saveTimer = null;
      const revision = queue.begin();
      if (revision == null)
        return;
      send({ type: "save_settings", settings: cloneSettings(draft) });
    }, delay);
  }
  function mutate(patch, rerender = false) {
    draft = normalizeFrontendSettings({ ...draft, ...patch, worldAgent: { ...draft.worldAgent, ...patch.worldAgent ?? {} } });
    queue.markDirty();
    scheduleSave();
    if (rerender)
      renderInteractive();
  }
  function mutateWorld(patch, rerender = false) {
    mutate({ worldAgent: { ...draft.worldAgent, ...patch } }, rerender);
  }
  function selectedConnection(id) {
    return state?.connections.find((connection) => connection.id === id) ?? null;
  }
  function field(label, control, hint) {
    const wrapper = element("div", "lw-field");
    wrapper.append(element("label", undefined, label), control);
    if (hint)
      wrapper.appendChild(element("div", "lw-subtle", hint));
    return wrapper;
  }
  function nativeNumber(value, min, max, step, onChange) {
    const input = element("input", "lw-input");
    input.type = "number";
    input.value = String(value);
    input.min = String(min);
    input.max = String(max);
    input.step = String(step);
    input.addEventListener("change", () => onChange(Number(input.value)));
    return input;
  }
  function numberField(label, value, min, max, step, onChange, hint) {
    const slot = element("div", "lw-control-slot");
    const components = ctx.components;
    if (components?.mountNumberStepper) {
      mountingHandles.push(components.mountNumberStepper(slot, { value, min, max, step, onChange: (next) => {
        if (typeof next === "number")
          onChange(next);
      } }));
    } else
      slot.appendChild(nativeNumber(value, min, max, step, onChange));
    return field(label, slot, hint);
  }
  function rangeField(label, value, min, max, step, onChange, hint, suffix = "") {
    const slot = element("div", "lw-range-slot");
    const components = ctx.components;
    if (components?.mountRangeSlider) {
      const decimals = step < 1 ? Math.max(0, String(step).split(".")[1]?.length ?? 0) : 0;
      mountingHandles.push(components.mountRangeSlider(slot, {
        label,
        min,
        max,
        step,
        value,
        hint,
        format: { decimals, suffix },
        onCommit: (next) => onChange(next)
      }));
      return slot;
    }
    const input = element("input", "lw-range-fallback");
    input.type = "range";
    input.value = String(value);
    input.min = String(min);
    input.max = String(max);
    input.step = String(step);
    const valueReadout = element("span", "lw-range-value", `${value}${suffix}`);
    input.addEventListener("input", () => {
      const next = Number(input.value);
      valueReadout.textContent = `${next}${suffix}`;
      onChange(next);
    });
    const fallback = element("div", "lw-range-fallback-wrap");
    fallback.append(input, valueReadout);
    return field(label, fallback, hint);
  }
  function textField(label, value, onChange, hint) {
    const input = element("input", "lw-input");
    input.type = "text";
    input.value = value;
    input.addEventListener("input", () => onChange(input.value));
    return field(label, input, hint);
  }
  function textareaField(label, value, onChange, hint) {
    const input = element("textarea", "lw-textarea");
    input.value = value;
    input.spellcheck = false;
    input.addEventListener("input", () => onChange(input.value));
    return field(label, input, hint);
  }
  function switchField(label, checked, onChange, hint, disabled = false) {
    const row = element("div", "lw-setting");
    const slot = element("div", "lw-switch-slot");
    const components = ctx.components;
    if (components?.mountSwitch && !disabled)
      mountingHandles.push(components.mountSwitch(slot, { checked, size: "md", ariaLabel: label, onChange }));
    else {
      const input = element("input");
      input.type = "checkbox";
      input.checked = checked;
      input.disabled = disabled;
      input.addEventListener("change", () => onChange(input.checked));
      slot.appendChild(input);
    }
    const copy = element("div", "lw-setting-copy");
    copy.appendChild(element("div", "lw-setting-title", label));
    if (hint)
      copy.appendChild(element("div", "lw-setting-hint", hint));
    row.append(slot, copy);
    return row;
  }
  function connectionField(label, value, onChange) {
    const slot = element("div", "lw-control-slot");
    const options = (state?.connections ?? []).map((connection) => ({
      value: connection.id,
      label: connection.name || connection.id,
      sublabel: [connection.provider, connection.model, connection.hasApiKey ? null : "no API key", connection.isDefault ? "default" : null].filter(Boolean).join(" / "),
      group: connection.provider || "Connections",
      leading: { type: "initial", text: (connection.provider || connection.name || "?").slice(0, 1).toUpperCase() }
    }));
    if (value && !options.some((option) => option.value === value))
      options.unshift({ value, label: "Saved connection not found", sublabel: value, group: "Unavailable", leading: { type: "initial", text: "!" } });
    const components = ctx.components;
    if (components?.mountSelect) {
      mountingHandles.push(components.mountSelect(slot, {
        value: value ?? "",
        options,
        placeholder: "Select connection...",
        searchPlaceholder: "Search LLM connections...",
        emptyMessage: state?.connectionError || "No LLM connection profiles found.",
        noResultsMessage: "No matching LLM connection profiles.",
        clearable: true,
        clearLabel: "No connection",
        ariaLabel: label,
        onChange: (next) => {
          onChange(next || null);
          renderInteractive();
        }
      }));
    } else {
      const select = element("select", "lw-select");
      select.appendChild(new Option("Select connection...", ""));
      for (const connection of state?.connections ?? [])
        select.appendChild(new Option(`${connection.name} / ${connection.provider} / ${connection.model}`, connection.id));
      select.value = value ?? "";
      select.addEventListener("change", () => {
        onChange(select.value || null);
        renderInteractive();
      });
      slot.appendChild(select);
    }
    return field(label, slot);
  }
  function modelField(label, connectionId, value, onChange) {
    const slot = element("div", "lw-control-slot");
    const selected = selectedConnection(connectionId);
    const components = ctx.components;
    if (selected && components?.mountModelCombobox) {
      mountingHandles.push(components.mountModelCombobox(slot, {
        value,
        connection: { kind: "llm", id: selected.id },
        appearance: "standard",
        placeholder: selected.model || "model id",
        browseHint: selected.model ? `Connection default: ${selected.model}` : "No default model is configured.",
        onChange
      }));
    } else {
      const input = element("input", "lw-input");
      input.placeholder = selected?.model || "model id";
      input.value = value;
      input.disabled = !selected;
      input.addEventListener("input", () => onChange(input.value));
      slot.appendChild(input);
    }
    return field(label, slot);
  }
  function panel(title, className = "") {
    const card = element("section", `lw-panel ${className}`.trim());
    card.appendChild(element("div", "lw-panel-head"));
    card.firstElementChild.appendChild(element("h3", undefined, title));
    return card;
  }
  function button(label, className, handler, disabled = false) {
    const node = element("button", `lw-btn ${className}`.trim(), label);
    node.type = "button";
    node.disabled = disabled;
    node.addEventListener("click", handler);
    return node;
  }
  function collapsible(title, build) {
    const host = element("div", "lw-control-slot");
    const components = ctx.components;
    if (components?.mountCollapsibleSection) {
      const handle = components.mountCollapsibleSection(host, { title, defaultExpanded: false });
      mountingHandles.push(handle);
      build(handle.body);
      return host;
    }
    const details = element("details", "lw-details");
    details.appendChild(element("summary", undefined, title));
    const body = element("div", "lw-details-body");
    build(body);
    details.appendChild(body);
    host.appendChild(details);
    return host;
  }
  function renderNotice(target) {
    if (!notice)
      return;
    const banner = element("div", `lw-banner ${notice.tone}`);
    banner.appendChild(element("span", undefined, notice.text));
    const copyPayload = notice.copyText;
    if (copyPayload)
      banner.appendChild(button("Copy output", "lw-banner-copy", () => copyText(copyPayload)));
    target.appendChild(banner);
  }
  function renderWarnings(target) {
    if (!state)
      return;
    const missing = [
      !state.permissions.interceptor ? "Interceptor" : null,
      !state.permissions.generation ? "Generation" : null,
      draft.worldAgent.enabled && draft.worldAgent.historyMessageLimit > 0 && !state.permissions.chatMutation ? "Chat Mutation" : null,
      (draft.includeCharacter || draft.worldAgent.includeCharacter) && !state.permissions.characters ? "Characters" : null,
      (draft.includeUserPersona || draft.worldAgent.includeUserPersona) && !state.permissions.personas ? "Personas" : null,
      draft.includeWorldInfoEntries && !state.permissions.worldBooks ? "World Books" : null
    ].filter(Boolean);
    if (missing.length)
      target.appendChild(element("div", "lw-banner warning", `Grant ${missing.join(", ")} permission${missing.length === 1 ? "" : "s"} in Lumiverse Extensions.`));
    if (state.connectionError)
      target.appendChild(element("div", "lw-banner error", state.connectionError));
  }
  function statusBadge(text, tone = "neutral") {
    return element("span", `lw-status-badge ${tone}`, text);
  }
  function selectModalView(next) {
    modalView = next;
    if (next !== "overview")
      activeChannel = next;
    renderInteractive();
  }
  function overviewStat(label, value, tone = "neutral") {
    const stat = element("div", "lw-overview-stat");
    stat.append(element("div", "lw-overview-stat-label", label), element("div", `lw-overview-stat-value ${tone}`, value));
    return stat;
  }
  function renderOverview(target) {
    const directorConnection = selectedConnection(draft.connectionId);
    const worldConnection = selectedConnection(draft.worldAgent.connectionId);
    const current = state?.worldState ?? null;
    const latestDirectorRun = state?.runs.find((run) => run.channel === "director");
    const hero = element("section", "lw-overview-hero");
    const heroCopy = element("div", "lw-overview-hero-copy");
    heroCopy.append(element("div", "lw-console-eyebrow", "LUMIWORLD CONTROL ROOM"), element("h2", "lw-overview-hero-title", "Shape the world behind the reply."), element("p", "lw-overview-hero-text", "Tune the private director and keep the character's hidden day moving in sync with the conversation."));
    const heroAside = element("div", "lw-overview-hero-aside");
    const syncTone = saveState === "error" ? "error" : saveState === "saving" ? "warning" : "success";
    heroAside.append(statusBadge(saveState === "saving" ? "Syncing changes" : saveState === "error" ? "Sync error" : "All changes saved", syncTone));
    const heroMetrics = element("div", "lw-overview-hero-metrics");
    heroMetrics.append(overviewStat("Director", draft.enabled ? "Online" : "Standby", draft.enabled ? "success" : "neutral"), overviewStat("World clock", current?.running ? formatClock(current, draft.worldAgent.hourDurationMs) : "Paused", current?.running ? "success" : "neutral"));
    heroAside.appendChild(heroMetrics);
    hero.append(heroCopy, heroAside);
    target.appendChild(hero);
    const overviewGrid = element("div", "lw-overview-grid");
    const director = panel("Director Note", "lw-console-card");
    director.firstElementChild.appendChild(statusBadge(draft.enabled ? "Online" : "Standby", draft.enabled ? "success" : "neutral"));
    director.append(element("p", "lw-card-copy", draft.enabled ? "A private controller call is ready to shape every enabled visible generation." : "Enable the Director when you want LumiWorld to quietly prepare the next world-state beat."), overviewStat("Connection", directorConnection?.name || "Not configured"), overviewStat("Latest run", latestDirectorRun?.status ?? "No runs yet", latestDirectorRun?.status === "success" ? "success" : "neutral"));
    const directorActions = element("div", "lw-overview-actions");
    directorActions.append(button("Configure Director", "lw-btn-primary", () => selectModalView("director")), button("Test Director", "", () => {
      setNotice({ tone: "info", text: "Testing Director Note..." });
      renderModal();
      send({ type: "test_controller", settings: draft });
    }, !draft.connectionId || !state?.permissions.generation));
    director.appendChild(directorActions);
    overviewGrid.appendChild(director);
    const world = panel("World Agent", "lw-console-card");
    world.firstElementChild.appendChild(statusBadge(draft.worldAgent.enabled ? current?.running ? "Running" : "Paused" : "Standby", draft.worldAgent.enabled && current?.running ? "success" : "neutral"));
    world.append(element("p", "lw-card-copy", draft.worldAgent.enabled ? "The private clock and schedule are ready to advance alongside the active chat." : "Enable the World Agent to give the active character a persistent private routine."), overviewStat("Current time", formatClock(current, draft.worldAgent.hourDurationMs)), overviewStat("Connection", worldConnection?.name || "Not configured"));
    const worldActions = element("div", "lw-overview-actions");
    const canModelRun = !!(draft.worldAgent.enabled && draft.worldAgent.connectionId && state?.permissions.generation);
    worldActions.append(button("Configure World", "lw-btn-primary", () => selectModalView("world_agent")), button(current?.running ? "Pause clock" : "Start clock", "", () => {
      setNotice({ tone: "info", text: current?.running ? "Pausing World Agent..." : "Starting World Agent..." });
      send({ type: current?.running ? "world_agent_pause" : "world_agent_start" });
    }, current?.running ? !current : !canModelRun));
    world.appendChild(worldActions);
    overviewGrid.appendChild(world);
    target.appendChild(overviewGrid);
    const activity = panel("Recent activity", "lw-console-card full");
    const runs = (state?.runs ?? []).slice(0, 5);
    if (!runs.length)
      activity.appendChild(element("div", "lw-empty", "No LumiWorld activity has been recorded yet."));
    else {
      const runList = element("div", "lw-run-list");
      for (const run of runs) {
        const row = element("div", "lw-run-row");
        const label = run.channel === "world_agent" ? "World Agent" : "Director Note";
        row.append(element("div", "lw-run-label", label), element("div", "lw-run-meta", run.action || "Controller activity"), statusBadge(run.status, run.status === "success" || run.status === "test_success" ? "success" : run.status === "error" || run.status === "test_error" ? "error" : "neutral"));
        runList.appendChild(row);
      }
      activity.appendChild(runList);
    }
    target.appendChild(activity);
  }
  function renderModalNavigation() {
    const rail = element("aside", "lw-console-rail");
    const railBrand = element("div", "lw-console-rail-brand");
    const railIcon = element("span", "lw-console-rail-icon");
    railIcon.innerHTML = ICON;
    railBrand.append(railIcon, element("span", undefined, "LumiWorld"));
    rail.appendChild(railBrand);
    const nav = element("nav", "lw-console-nav");
    const entries = [
      ["overview", "Overview", "Live system pulse", "01"],
      ["director", "Director Note", "Prompt control", "02"],
      ["world_agent", "World Agent", "Private simulation", "03"]
    ];
    for (const [view, label, description, index] of entries) {
      const item = element("button", `lw-console-nav-item${modalView === view ? " is-active" : ""}`);
      item.type = "button";
      item.setAttribute("aria-current", modalView === view ? "page" : "false");
      const marker = element("span", "lw-console-nav-marker", index);
      const copy = element("span", "lw-console-nav-copy");
      copy.append(element("span", "lw-console-nav-label", label), element("span", "lw-console-nav-description", description));
      item.append(marker, copy);
      item.addEventListener("click", () => selectModalView(view));
      nav.appendChild(item);
    }
    rail.appendChild(nav);
    const footer = element("div", "lw-console-rail-footer");
    footer.append(statusBadge("Private by design", "success"), element("span", undefined, "Settings autosave as you work."));
    rail.appendChild(footer);
    return rail;
  }
  function renderDirector(target) {
    const grid = element("div", "lw-grid");
    const core = panel("Director Note", "half");
    core.firstElementChild.appendChild(switchField("Enable Director Note", draft.enabled, (enabled) => mutate({ enabled }), "Runs before enabled visible reply types."));
    const coreForm = element("div", "lw-form");
    coreForm.append(connectionField("Connection", draft.connectionId, (connectionId) => mutate({ connectionId, modelOverride: "" }, true)), modelField("Model override", draft.connectionId, draft.modelOverride, (modelOverride) => mutate({ modelOverride })));
    core.appendChild(coreForm);
    grid.appendChild(core);
    const params = panel("Response Parameters", "half");
    const paramsForm = element("div", "lw-form");
    const rowOne = element("div", "lw-two");
    rowOne.append(rangeField("Temperature", draft.temperature, 0, 2, 0.05, (temperature) => mutate({ temperature }), "How expressive the Director should be.", ""), numberField("Max tokens", draft.maxTokens, 64, MAX_SAFE_SETTING, 1, (maxTokens) => mutate({ maxTokens })));
    const rowTwo = element("div", "lw-two");
    rowTwo.append(numberField("Timeout ms", draft.timeoutMs, 1000, MAX_DIRECTOR_TIMEOUT_MS, 1000, (timeoutMs) => mutate({ timeoutMs }), "Lumiverse limits prompt interceptors to five minutes."), numberField("History", draft.historyMessageLimit, 0, MAX_SAFE_SETTING, 1, (historyMessageLimit) => mutate({ historyMessageLimit })));
    const rowThree = element("div", "lw-two");
    rowThree.append(numberField("Prompt cap chars", draft.maxInputChars, 4000, 500000, 1000, (maxInputChars) => mutate({ maxInputChars })), numberField("Run log limit", draft.runLogLimit, 0, 50, 1, (runLogLimit) => mutate({ runLogLimit })));
    paramsForm.append(rowOne, rowTwo, rowThree);
    params.appendChild(paramsForm);
    grid.appendChild(params);
    const context = panel("Controller Context", "half");
    context.append(switchField("Activated entries", draft.includeWorldInfoEntries, (includeWorldInfoEntries) => mutate({ includeWorldInfoEntries }), "Send activated World Info content only to the controller."), switchField("User persona", draft.includeUserPersona, (includeUserPersona) => mutate({ includeUserPersona })), switchField("Character", draft.includeCharacter, (includeCharacter) => mutate({ includeCharacter })));
    grid.appendChild(context);
    const notes = panel("Additional Notes", "half");
    notes.appendChild(textareaField("Notes", draft.additionalNotes, (additionalNotes) => mutate({ additionalNotes }), "Private context for the Director Note model."));
    grid.appendChild(notes);
    const runs = panel("Runs On", "full");
    const types = element("div", "lw-generation-types");
    for (const type of VISIBLE_GENERATION_TYPES) {
      const label = element("label", `lw-check${draft.generationTypes.includes(type) ? " is-selected" : ""}`);
      const input = element("input");
      input.type = "checkbox";
      input.checked = draft.generationTypes.includes(type);
      input.addEventListener("change", () => {
        label.classList.toggle("is-selected", input.checked);
        mutate({ generationTypes: input.checked ? [...new Set([...draft.generationTypes, type])] : draft.generationTypes.filter((item) => item !== type) });
      });
      label.append(input, document.createTextNode(type));
      types.appendChild(label);
    }
    runs.appendChild(types);
    grid.appendChild(runs);
    const advanced = panel("Advanced Prompt Templates", "full");
    advanced.appendChild(collapsible("Open templates", (body) => body.append(textareaField("System template", draft.systemTemplate, (systemTemplate) => mutate({ systemTemplate })), textareaField("User template", draft.userTemplate, (userTemplate) => mutate({ userTemplate })))));
    grid.appendChild(advanced);
    target.appendChild(grid);
  }
  function renderWorldClock(target) {
    const current = state?.worldState ?? null;
    const canModelRun = !!(draft.worldAgent.enabled && draft.worldAgent.connectionId && state?.permissions.generation);
    const card = panel("World Clock", "half");
    const readout = element("div", "lw-clock-readout");
    const clock = element("div", "lw-clock-time", formatClock(current, draft.worldAgent.hourDurationMs));
    clock.dataset.lwClock = "";
    readout.append(clock, element("span", "lw-clock-status", current?.running ? "Running" : "Paused"));
    card.appendChild(readout);
    const actions = element("div", "lw-actions");
    actions.append(button(current?.running ? "Pause" : "Start", current?.running ? "" : "lw-btn-primary", () => {
      setNotice({ tone: "info", text: current?.running ? "Pausing World Agent..." : "Starting World Agent..." });
      send({ type: current?.running ? "world_agent_pause" : "world_agent_start" });
    }, current?.running ? !current : !canModelRun), button("+1 Hour", "", () => {
      setNotice({ tone: "info", text: "Advancing World Agent..." });
      send({ type: "world_agent_advance_hour" });
    }, !canModelRun), button("Schedule", "", () => {
      setNotice({ tone: "info", text: "Generating the daily schedule..." });
      send({ type: "world_agent_regenerate_schedule" });
    }, !canModelRun), button("Reset", "lw-btn-danger", () => send({ type: "world_agent_reset" })));
    card.appendChild(actions);
    const setTime = element("div", "lw-two");
    const day = nativeNumber(current?.day ?? 1, 1, MAX_SAFE_SETTING, 1, () => {});
    const hour = nativeNumber(current?.hour ?? 8, 0, 23, 1, () => {});
    setTime.append(field("Day", day), field("Hour", hour));
    card.append(setTime, button("Set Time", "", () => send({ type: "world_agent_set_time", day: Number(day.value), hour: Number(hour.value) })));
    target.appendChild(card);
  }
  function renderWorld(target) {
    const grid = element("div", "lw-grid");
    renderWorldClock(grid);
    const agent = panel("Agent Configuration", "half");
    agent.append(switchField("Enable Agent", draft.worldAgent.enabled, (enabled) => mutateWorld({ enabled })), switchField("Inject State", draft.worldAgent.injectState, (injectState) => mutateWorld({ injectState }), "Adds compact current state to visible prompts."), switchField("Visible-only Ticks", draft.worldAgent.autoTickVisibleOnly, (autoTickVisibleOnly) => mutateWorld({ autoTickVisibleOnly })), connectionField("Connection", draft.worldAgent.connectionId, (connectionId) => mutateWorld({ connectionId, modelOverride: "" }, true)), modelField("Model override", draft.worldAgent.connectionId, draft.worldAgent.modelOverride, (modelOverride) => mutateWorld({ modelOverride })));
    grid.appendChild(agent);
    const context = panel("Agent Context", "half");
    context.append(switchField("User persona", draft.worldAgent.includeUserPersona, (includeUserPersona) => mutateWorld({ includeUserPersona })), switchField("Character", draft.worldAgent.includeCharacter, (includeCharacter) => mutateWorld({ includeCharacter })), numberField("History", draft.worldAgent.historyMessageLimit, 0, MAX_SAFE_SETTING, 1, (historyMessageLimit) => mutateWorld({ historyMessageLimit }), "Read-only stored chat messages sent to World Agent calls."));
    grid.appendChild(context);
    const stateCard = panel("Current State", "half");
    const current = state?.worldState;
    const metrics = element("div", "lw-meters");
    for (const [label, value] of [["Location", current?.location || "Unspecified"], ["Mood", current?.mood || "Neutral"], ["Activity", current?.activity || "Idle"], ["Goal", current?.goal || "Unset"], ["Thought", current?.thought || "Unset"], ["History", `${current?.schedule.length ?? 0} schedule entries`]]) {
      const meter = element("div", "lw-meter");
      meter.append(element("div", "lw-meter-label", label), element("div", "lw-meter-value", value));
      metrics.appendChild(meter);
    }
    stateCard.appendChild(metrics);
    grid.appendChild(stateCard);
    const params = panel("Simulation Parameters", "half");
    const first = element("div", "lw-two");
    first.append(rangeField("Temperature", draft.worldAgent.temperature, 0, 2, 0.05, (temperature) => mutateWorld({ temperature }), "How freely the World Agent should improvise.", ""), numberField("Max tokens", draft.worldAgent.maxTokens, 64, MAX_SAFE_SETTING, 1, (maxTokens) => mutateWorld({ maxTokens })));
    const second = element("div", "lw-two");
    second.append(numberField("Timeout ms", draft.worldAgent.timeoutMs, 1000, MAX_WORLD_AGENT_TIMEOUT_MS, 1000, (timeoutMs) => mutateWorld({ timeoutMs })), numberField("Hour duration ms", draft.worldAgent.hourDurationMs, 1000, 365 * 24 * 60 * 60 * 1000, 1000, (hourDurationMs) => mutateWorld({ hourDurationMs })));
    params.append(first, second, collapsible("Prompt templates", (body) => body.append(textareaField("Schedule template", draft.worldAgent.scheduleTemplate, (scheduleTemplate) => mutateWorld({ scheduleTemplate })), textareaField("Update template", draft.worldAgent.updateTemplate, (updateTemplate) => mutateWorld({ updateTemplate })))));
    grid.appendChild(params);
    const schedule = panel("Daily Schedule", "full");
    const scheduleGrid = element("div", "lw-schedule");
    const entries = current?.schedule ?? [];
    if (!entries.length)
      schedule.appendChild(element("div", "lw-empty", "No valid daily schedule has been generated."));
    else {
      for (const item of entries) {
        const slot = element("article", `lw-slot${item.hour === current?.hour ? " is-now" : ""}`);
        slot.append(element("div", "lw-slot-time", formatHour(item.hour)), element("div", "lw-slot-location", item.location || "Unspecified location"), element("div", "lw-slot-activity", item.activity));
        scheduleGrid.appendChild(slot);
      }
      schedule.appendChild(scheduleGrid);
    }
    grid.appendChild(schedule);
    target.appendChild(grid);
  }
  function renderChannel(target) {
    renderWarnings(target);
    renderNotice(target);
    if (!state) {
      target.appendChild(element("div", "lw-empty", "Loading LumiWorld..."));
      return;
    }
    if (activeChannel === "director")
      renderDirector(target);
    else
      renderWorld(target);
  }
  function renderModalContent(target) {
    renderWarnings(target);
    renderNotice(target);
    if (!state) {
      target.appendChild(element("div", "lw-empty", "Loading LumiWorld..."));
      return;
    }
    if (modalView === "overview")
      renderOverview(target);
    else if (modalView === "director")
      renderDirector(target);
    else
      renderWorld(target);
  }
  function renderDrawer() {
    destroyHandles(drawerHandles);
    mountingHandles = drawerHandles;
    drawer.root.replaceChildren();
    const root = element("div", "lw-drawer");
    const header = element("div", "lw-drawer-header");
    const title = element("div", "lw-drawer-title");
    const icon = element("span", "lw-drawer-icon");
    icon.innerHTML = ICON;
    title.append(icon, document.createTextNode(EXTENSION_NAME));
    header.append(title, channelTabs());
    root.append(header);
    const body = element("div", "lw-drawer-body");
    renderChannel(body);
    root.appendChild(body);
    drawer.root.appendChild(root);
  }
  function channelTabs() {
    const tabs = element("div", "lw-channel-tabs");
    for (const [channel, label] of [["director", "Director"], ["world_agent", "World"]]) {
      const tab = element("button", `lw-channel-tab${activeChannel === channel ? " is-active" : ""}`, label);
      tab.type = "button";
      tab.addEventListener("click", () => {
        activeChannel = channel;
        if (modal)
          modalView = channel;
        renderInteractive();
      });
      tabs.appendChild(tab);
    }
    return tabs;
  }
  function widgetLines() {
    if (!state)
      return ["Loading LumiWorld...", "Waiting for extension state."];
    if (activeChannel === "director") {
      const connection = selectedConnection(draft.connectionId);
      const run = state.runs.find((item) => item.channel === "director");
      return [
        draft.enabled ? "Director: enabled" : "Director: disabled",
        connection ? `Model: ${connection.name}` : "No controller connection",
        `Last Run: ${run?.status ?? "none"}`
      ];
    }
    const world = state.worldState;
    return [
      draft.worldAgent.enabled ? `Clock: ${world?.running ? "running" : "paused"}` : "World Agent disabled",
      `Time: ${formatClock(world, draft.worldAgent.hourDurationMs)}`,
      `Mood: ${world?.mood || "Neutral"}`,
      `Goal: ${world?.goal || "Unset"}`
    ];
  }
  function renderWidget() {
    if (!widget)
      return;
    widget.root.replaceChildren();
    const root = element("div", "lw-float-root");
    const monitor = element("div", "lw-monitor");
    const screen = element("div", "lw-monitor-screen");
    const head = element("div", "lw-monitor-head");
    const clock = element("span", undefined, formatClock(state?.worldState, draft.worldAgent.hourDurationMs));
    clock.dataset.lwClock = "";
    head.append(element("span", undefined, EXTENSION_NAME), clock);
    const noteHead = element("div", "lw-monitor-note-head");
    noteHead.append(element("span", undefined, activeChannel === "director" ? "Director Note" : "World"), element("span", `lw-save-dot${saveState === "saving" ? " is-saving" : saveState === "error" ? " is-error" : ""}`, saveState));
    const lines = element("div", "lw-monitor-lines");
    for (const line of widgetLines())
      lines.appendChild(element("div", "lw-monitor-line", line));
    const actions = element("div", "lw-monitor-actions");
    const refresh = element("button", "lw-monitor-action", "Refresh");
    refresh.type = "button";
    refresh.addEventListener("click", () => {
      send({ type: "refresh_state" });
      send({ type: "refresh_world_state" });
    });
    actions.appendChild(refresh);
    screen.append(head, noteHead, lines, actions);
    const settings = element("button", "lw-monitor-knob settings");
    settings.type = "button";
    settings.title = "Open LumiWorld settings";
    settings.setAttribute("aria-label", settings.title);
    settings.addEventListener("click", openModal);
    const channel = element("button", "lw-monitor-knob channel");
    channel.type = "button";
    channel.title = "Switch LumiWorld channel";
    channel.setAttribute("aria-label", channel.title);
    channel.addEventListener("click", () => {
      activeChannel = activeChannel === "director" ? "world_agent" : "director";
      renderInteractive();
    });
    monitor.append(element("div", "lw-monitor-antenna left"), element("div", "lw-monitor-antenna right"), screen, settings, channel);
    root.appendChild(monitor);
    widget.root.appendChild(root);
  }
  function renderModal() {
    if (!modal)
      return;
    destroyHandles(modalHandles);
    mountingHandles = modalHandles;
    modal.root.replaceChildren();
    const shell = element("div", "lw-workbench");
    const header = element("div", "lw-console-header");
    const brand = element("div", "lw-console-header-brand");
    const icon = element("span", "lw-console-header-icon");
    icon.innerHTML = ICON;
    const copy = element("div", "lw-console-header-copy");
    copy.append(element("div", "lw-console-eyebrow", "LUMIVERSE EXTENSION / LUMIWORLD"), element("h1", "lw-console-title", modalView === "overview" ? "World control room" : modalView === "director" ? "Director Note" : "World Agent"), element("p", "lw-console-subtitle", "Private world-state controls for the active conversation."));
    brand.append(icon, copy);
    const actions = element("div", "lw-console-header-actions");
    const syncTone = saveState === "error" ? "error" : saveState === "saving" ? "warning" : "success";
    actions.append(statusBadge(saveState === "saving" ? "Syncing" : saveState === "error" ? "Save error" : "Saved", syncTone));
    actions.appendChild(button("Refresh", "", () => {
      send({ type: "refresh_state" });
      send({ type: "refresh_world_state" });
    }));
    if (modalView === "director")
      actions.appendChild(button("Test Director", "lw-btn-primary", () => {
        setNotice({ tone: "info", text: "Testing Director Note..." });
        renderModal();
        send({ type: "test_controller", settings: draft });
      }, !draft.connectionId || !state?.permissions.generation));
    header.append(brand, actions);
    shell.appendChild(header);
    const body = element("div", "lw-modal-body");
    const layout = element("div", "lw-console-layout");
    layout.appendChild(renderModalNavigation());
    const content = element("main", "lw-console-main");
    renderModalContent(content);
    layout.appendChild(content);
    body.appendChild(layout);
    shell.appendChild(body);
    modal.root.appendChild(shell);
  }
  function openModal() {
    if (!modal) {
      modalView = activeChannel;
      const width = Math.max(420, Math.min(1180, window.innerWidth - 32));
      const maxHeight = Math.max(560, window.innerHeight - 32);
      modal = ctx.ui.showModal({ title: "LumiWorld Settings", width, maxHeight });
      modal.onDismiss(() => {
        destroyHandles(modalHandles);
        modal = null;
      });
    }
    renderModal();
  }
  function updateLiveClock() {
    const value = formatClock(state?.worldState, draft.worldAgent.hourDurationMs);
    for (const root of [widget?.root, drawer.root, modal?.root]) {
      if (!root)
        continue;
      for (const node of root.querySelectorAll("[data-lw-clock]"))
        node.textContent = value;
    }
  }
  function syncClockTimer() {
    const running = !!state?.worldState?.running && draft.worldAgent.enabled;
    if (running && !clockTimer)
      clockTimer = setInterval(updateLiveClock, 1000);
    if (!running && clockTimer) {
      clearInterval(clockTimer);
      clockTimer = null;
    }
    updateLiveClock();
  }
  function renderInteractive() {
    renderWidget();
    renderDrawer();
    if (modal)
      renderModal();
    syncClockTimer();
  }
  function createWidget() {
    if (widget)
      return;
    widget = ctx.ui.createFloatWidget({ width: 260, height: 258, initialPosition: { x: 24, y: 160 }, snapToEdge: true, tooltip: "LumiWorld", chromeless: true });
  }
  async function ensureWidget() {
    try {
      createWidget();
      renderWidget();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (!message.includes("PERMISSION_DENIED:ui_panels"))
        return;
      try {
        await ctx.permissions.request(["ui_panels"], { reason: "LumiWorld provides a floating CRT status widget for desktop use." });
        createWidget();
        renderWidget();
      } catch {}
    }
  }
  cleanups.push(() => widget?.destroy());
  cleanups.push(ctx.onBackendMessage((payload) => {
    const message = payload;
    if (message.type === "state") {
      state = message.state;
      if (!queue.isInFlight && !queue.isDirty && !saveTimer)
        draft = cloneSettings(message.state.settings);
      if (document.activeElement?.matches("input, textarea, [role=combobox]"))
        renderWidget();
      else
        renderInteractive();
      return;
    }
    if (message.type === "settings_saved") {
      const hasMore = queue.acknowledge();
      if (hasMore)
        scheduleSave(0);
      else {
        saveState = "saved";
        drawer.setBadge(null);
        draft = cloneSettings(message.settings);
        if (state)
          state = { ...state, settings: message.settings };
      }
      renderWidget();
      return;
    }
    if (message.type === "world_state") {
      if (state)
        state = { ...state, worldState: message.state };
      renderInteractive();
      return;
    }
    if (message.type === "world_agent_result") {
      if (message.result.state && state)
        state = { ...state, worldState: message.result.state };
      setNotice({ tone: message.result.status === "error" ? "error" : message.result.status === "warning" ? "warning" : "success", text: message.result.error ? `${message.result.message} ${message.result.error}` : message.result.message, copyText: message.result.rawOutput });
      renderInteractive();
      return;
    }
    if (message.type === "test_result") {
      setNotice(message.ok ? { tone: "success", text: `Controller test succeeded on ${message.connectionName} / ${message.model}: ${message.directive}` } : { tone: "error", text: message.error });
      renderInteractive();
      return;
    }
    if (message.type === "error") {
      queue.fail();
      saveState = "error";
      drawer.setBadge("Error");
      setNotice({ tone: "error", text: message.message });
      renderInteractive();
    }
  }));
  cleanups.push(ctx.events.on("CHAT_CHANGED", (payload) => {
    const chatId = readId(payload, "chatId");
    const characterId = readId(payload, "characterId");
    send({ type: "refresh_state", chatId, characterId });
    send({ type: "refresh_world_state", chatId, characterId });
  }));
  const initial = activeChat(ctx);
  send({ type: "ready", chatId: initial.chatId, characterId: initial.characterId });
  renderInteractive();
  ensureWidget();
  return () => {
    if (saveTimer)
      clearTimeout(saveTimer);
    if (noticeTimer)
      clearTimeout(noticeTimer);
    if (clockTimer)
      clearInterval(clockTimer);
    destroyHandles(drawerHandles);
    destroyHandles(modalHandles);
    modal?.dismiss();
    for (const cleanup of cleanups.reverse())
      try {
        cleanup();
      } catch {}
  };
}
export {
  setup,
  normalizeFrontendSettings,
  SettingsSaveQueue
};
