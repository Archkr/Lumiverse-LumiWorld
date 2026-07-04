// src/frontend.ts
var EXTENSION_NAME = "LumiWorld";
var EXTENSION_VERSION = "v1.0.0-lofi";
var VISIBLE_GENERATION_TYPES = ["normal", "continue", "regenerate", "swipe", "impersonate"];
var MAX_CONTROLLER_OUTPUT_TOKENS = Number.MAX_SAFE_INTEGER;
var MAX_CONTROLLER_TIMEOUT_MS = 2147483647;
var MAX_CHAT_HISTORY_MESSAGES = Number.MAX_SAFE_INTEGER;
var DEFAULT_RUN_LOG_LIMIT = 12;
var DEFAULT_HISTORY_MESSAGE_LIMIT = 12;
var DEFAULT_WORLD_AGENT_HOUR_DURATION_MS = 5 * 60 * 1000;
var LUMIWORLD_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round"><path d="M5 17.5c2.7 1.7 6.2 1.7 9 0 3.1-1.9 4.3-5.7 2.7-8.9"/><path d="M4.4 12.2c.4-3.3 3.2-5.9 6.6-5.9 1.9 0 3.6.8 4.8 2"/><path d="M18 4.5l.8 1.7 1.9.3-1.3 1.3.3 1.9-1.7-.9-1.7.9.3-1.9-1.3-1.3 1.9-.3.8-1.7z"/><path d="M7 13h6"/><path d="M8.3 10.2h3.8"/><path d="M8.2 15.8h4.5"/></svg>`;
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
var DEFAULT_WORLD_AGENT_SCHEDULE_TEMPLATE = [
  "You are LumiWorld's private World Agent for an interactive Lumiverse chat.",
  "Create the current day's background schedule for {{char}}.",
  "",
  "Use the active character and persona context, the current chat state, and any provided notes.",
  "The schedule is private simulation scaffolding. Do not write visible roleplay prose.",
  "",
  "Return compact JSON only:",
  '{"schedule":[{"hour":0,"location":"...","activity":"...","mood":"...","goal":"..."}]}',
  "",
  "Cover the full day when possible. Keep entries short, playable, and flexible enough for the chat to override."
].join(`
`);
var DEFAULT_WORLD_AGENT_UPDATE_TEMPLATE = [
  "You are LumiWorld's private World Agent for an interactive Lumiverse chat.",
  "Advance {{char}}'s private world state by one simulated hour.",
  "",
  "Use the schedule, current state, active character/persona context, and recent chat context.",
  "Track what changes in location, mood, activity, current thought, and immediate goal.",
  "Do not write the visible assistant reply. Do not mention LumiWorld or this control step.",
  "",
  "Return compact JSON only:",
  '{"location":"...","mood":"...","activity":"...","thought":"...","goal":"..."}'
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
  injectState: true,
  autoTickVisibleOnly: true,
  scheduleTemplate: DEFAULT_WORLD_AGENT_SCHEDULE_TEMPLATE,
  updateTemplate: DEFAULT_WORLD_AGENT_UPDATE_TEMPLATE
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
  runLogLimit: DEFAULT_RUN_LOG_LIMIT,
  worldAgent: DEFAULT_WORLD_AGENT_SETTINGS
};
var CSS = `
.lw-root {
  min-height: calc(var(--app-scaled-viewport-height, 100vh) - 48px);
  width: calc(100% + 24px);
  margin: -12px -12px 0;
  padding: 14px 14px 40px;
  color: #e0d6c8;
  /* Moody Room Background */
  background: radial-gradient(circle at 80% 10%, rgba(255, 200, 100, 0.15), transparent 40%), radial-gradient(circle at 20% 90%, rgba(30, 30, 50, 0.5), transparent 50%), linear-gradient(to bottom, #1a1a2e, #16213e);
  box-sizing: border-box;
  font-family: 'Courier New', Courier, monospace;
  font-size: 12px;
  line-height: 1.4;
  overflow-x: hidden;
  position: relative;
  
  /* Theme overrides for Spindle components to force the lofi aesthetic */
  --lumiverse-fill: #fff9e6;
  --lumiverse-fill-subtle: #f5f5dc;
  --lumiverse-text: #2b201d;
  --lumiverse-text-dim: #6b5d4f;
  --lumiverse-border: #8b7765;
  --lumiverse-border-hover: #6b4f3c;
  --lumiverse-primary: #ff7e00;
  --lumiverse-primary-contrast: #111;
  --lumiverse-danger: #cf7e7e;
  --lumiverse-warning-050: #d8aa63;
  --lumiverse-success: #6fb7a6;
  --lumiverse-radius: 2px;
  --lumiverse-radius-xl: 2px;
  --lumiverse-transition-fast: 0.1s linear;
  
  --lw-gold: #d8aa63;
  --lw-rose: #cf7e7e;
}
.lw-root * { box-sizing: border-box; }
.lw-root input, .lw-root textarea, .lw-root select { accent-color: #ff7e00; font-family: 'Courier New', monospace; }

.lw-shell {
  display: flex;
  flex-direction: column;
  gap: 14px;
  width: 100%;
  max-width: 390px;
  min-width: 0;
  margin: 0 auto;
  position: relative;
  z-index: 1;
}

/* Decorative Background Elements */
.lw-window {
  position: absolute;
  top: 10px; left: 10px;
  width: 130px; height: 90px;
  background: linear-gradient(to bottom, #0f3460, #16213e);
  border: 6px solid #3a261f;
  border-radius: 2px;
  box-shadow: 0 4px 10px rgba(0,0,0,0.5);
  z-index: 0;
  overflow: hidden;
}
.lw-rain {
  position: absolute;
  top: 0; left: 0; right: 0; bottom: 0;
  background: repeating-linear-gradient(170deg, transparent 0, transparent 3px, rgba(255,255,255,0.1) 3px, rgba(255,255,255,0.1) 4px);
  animation: lw-rain 0.3s linear infinite;
  z-index: 2;
}
@keyframes lw-rain {
  from { background-position: 0 0; }
  to { background-position: -20px 40px; }
}
.lw-city {
  position: absolute;
  bottom: 0; left: 0; right: 0;
  height: 40px;
  background: #050a14;
  clip-path: polygon(0% 100%, 0% 60%, 10% 60%, 10% 40%, 20% 40%, 20% 70%, 30% 70%, 30% 30%, 40% 30%, 40% 50%, 50% 50%, 50% 20%, 60% 20%, 60% 60%, 70% 60%, 70% 40%, 80% 40%, 80% 80%, 90% 80%, 90% 50%, 100% 50%, 100% 100%);
  z-index: 1;
}
.lw-city-lights {
  position: absolute;
  bottom: 0; left: 0; right: 0;
  height: 40px;
  background-image: 
    radial-gradient(circle, #ffcc00 1px, transparent 2px),
    radial-gradient(circle, #ff9e3d 1px, transparent 2px);
  background-size: 15px 15px, 25px 25px;
  background-position: 5px 5px, 12px 10px;
  animation: lw-flicker 4s infinite alternate;
  z-index: 1;
  opacity: 0.8;
}
.lw-window::after {
  content: '';
  position: absolute;
  top: 50%; left: 0; width: 100%; height: 4px;
  background: #3a261f;
  transform: translateY(-50%);
  z-index: 3;
}
.lw-window::before {
  content: '';
  position: absolute;
  left: 50%; top: 0; width: 4px; height: 100%;
  background: #3a261f;
  transform: translateX(-50%);
  z-index: 3;
}

.lw-bulb {
  position: absolute;
  top: 20px; right: 20px;
  width: 2px; height: 50px;
  background: #333;
  z-index: 0;
}
.lw-bulb::after {
  content: '';
  position: absolute;
  bottom: -15px; left: -7px;
  width: 16px; height: 16px;
  background: radial-gradient(#fffae0, #ff9e3d);
  border-radius: 50%;
  box-shadow: 0 0 25px 10px rgba(255, 158, 61, 0.4);
  animation: lw-flicker 5s infinite alternate;
}

@keyframes lw-flicker {
  0%, 19%, 21%, 23%, 25%, 54%, 56%, 100% { opacity: 1; filter: brightness(1.1); }
  20%, 24%, 55% { opacity: 0.6; filter: brightness(0.8); }
}

/* Shelf and LED Sign */
.lw-shelf-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-top: clamp(86px, 25vw, 102px);
  margin-bottom: 14px;
  width: 100%;
}
.lw-led-sign {
  width: min(100%, 335px);
  background: #111;
  border: 3px solid #3a2e2a;
  padding: 8px 12px;
  border-radius: 6px;
  box-shadow: 0 0 20px rgba(255, 126, 0, 0.5), inset 0 0 10px rgba(0,0,0,0.9);
  color: #ff9e3d;
  text-shadow: 0 0 8px #ff9e3d, 0 0 15px #ff7e00, 0 0 25px #ff5500;
  font-weight: bold;
  font-size: clamp(14px, 4vw, 17px);
  letter-spacing: 1.2px;
  animation: lw-flicker 4s infinite alternate;
  white-space: nowrap;
  text-align: center;
  margin-bottom: 4px;
}
.lw-shelf {
  width: min(92%, 320px);
  height: 10px;
  background: linear-gradient(to bottom, #5a3a2e, #3a261f);
  background-image: repeating-linear-gradient(90deg, #4a2e24 0px, #5a3a2e 2px, #4a2e24 4px);
  border-radius: 2px;
  box-shadow: 0 6px 8px rgba(0,0,0,0.6);
  position: relative;
}
.lw-shelf::before, .lw-shelf::after {
  content: '';
  position: absolute;
  bottom: -8px;
  width: 6px;
  height: 8px;
  background: #3a261f;
}
.lw-shelf::before { left: 15%; }
.lw-shelf::after { right: 15%; }

/* TV and Desk Scene */
.lw-scene {
  position: relative;
  width: min(100%, 340px);
  min-height: 174px;
  margin: 0 auto;
  padding-top: 10px;
  display: flex;
  align-items: flex-end;
  justify-content: flex-start;
}

/* Retro CRT TV */
.lw-tv {
  background: #e8e1d3;
  border-radius: 20px 20px 8px 8px;
  padding: 15px;
  padding-bottom: 35px;
  box-shadow: 
    0 15px 30px rgba(0,0,0,0.6), 
    inset 0 2px 4px rgba(255,255,255,0.6), 
    inset 0 -4px 8px rgba(0,0,0,0.1);
  position: relative;
  width: 190px;
  flex: 0 0 190px;
  max-width: 58%;
  z-index: 2;
}
.lw-tv::before { /* Vents */
  content: '';
  position: absolute;
  top: 8px; left: 50%;
  transform: translateX(-50%);
  width: 50%; height: 4px;
  background: repeating-linear-gradient(90deg, #888 0px, #888 2px, #666 2px, #666 4px);
  border-radius: 2px;
}
.lw-tv::after { /* Brand */
  content: 'LumiVision';
  position: absolute;
  bottom: 12px; left: 50%;
  transform: translateX(-50%);
  font-size: 10px;
  font-weight: bold;
  color: #888;
  letter-spacing: 2px;
  font-family: sans-serif;
}
.lw-tv-knob {
  position: absolute;
  right: -10px; bottom: 20px;
  width: 16px; height: 16px;
  background: radial-gradient(#888, #333);
  border-radius: 50%;
  border: 2px solid #222;
  box-shadow: 1px 1px 3px rgba(0,0,0,0.8);
}
.lw-tv-knob:nth-child(2) { bottom: 40px; }

.lw-tv-screen {
  background: #000;
  border: 6px solid #2a2a2a;
  border-radius: 20px / 15px; /* CRT Curve */
  padding: 0;
  position: relative;
  width: 100%;
  aspect-ratio: 4 / 3;
  overflow: hidden;
  box-shadow: inset 0 0 40px rgba(0,0,0,0.9), inset 0 0 10px rgba(255,255,255,0.1);
}
.lw-tv-scanlines {
  position: absolute;
  top: 0; left: 0; width: 100%; height: 100%;
  background: linear-gradient(rgba(255,255,255,0) 50%, rgba(0,0,0,0.25) 50%);
  background-size: 100% 4px;
  pointer-events: none;
  z-index: 3;
}
.lw-tv-glare {
  position: absolute;
  top: -20%; left: -20%;
  width: 50%; height: 150%;
  background: linear-gradient(115deg, rgba(255,255,255,0.05) 0%, transparent 50%);
  transform: rotate(20deg);
  pointer-events: none;
  z-index: 4;
}

/* TV Content (Cable Guide) */
.lw-tv-content {
  position: absolute;
  inset: 0;
  padding: 12px;
  display: flex;
  flex-direction: column;
  color: #ff9e3d;
  text-shadow: 0 0 5px #ff5500;
  font-family: 'Courier New', monospace;
  font-size: 11px;
  z-index: 2;
}
.lw-tv-header {
  display: flex;
  justify-content: space-between;
  border-bottom: 1px solid #ff9e3d;
  padding-bottom: 4px;
  margin-bottom: 8px;
  font-weight: bold;
}
.lw-tv-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.lw-tv-row {
  display: grid;
  grid-template-columns: 40px 1fr auto;
  align-items: center;
  padding: 4px 6px;
  border: 1px solid transparent;
  cursor: pointer;
  transition: background 0.1s;
}
.lw-tv-row:hover {
  background: rgba(255, 158, 61, 0.1);
}
.lw-tv-row.is-active {
  background: #ff9e3d;
  color: #000;
  text-shadow: none;
  border-color: #fff;
  box-shadow: 0 0 8px rgba(255, 126, 0, 0.5);
}
.lw-tv-ch { font-weight: bold; }
.lw-tv-status { font-size: 9px; opacity: 0.9; text-transform: uppercase; }
.lw-tv-footer {
  margin-top: auto;
  font-size: 9px;
  text-align: center;
  opacity: 0.7;
  border-top: 1px dashed #ff9e3d;
  padding-top: 4px;
}

/* Wooden Desk */
.lw-desk {
  flex: 1 1 0;
  min-width: 118px;
  width: auto;
  margin-left: -10px;
  height: 16px;
  background: linear-gradient(to bottom, #5a3a2e, #3a261f);
  background-image: repeating-linear-gradient(90deg, rgba(0,0,0,0.1) 0px, rgba(0,0,0,0.1) 1px, transparent 1px, transparent 4px);
  border-radius: 2px;
  box-shadow: 0 10px 15px rgba(0,0,0,0.6);
  position: relative;
  z-index: 1;
  margin-top: 0;
  margin-bottom: 35px;
}

/* Desk Items */
.lw-desk-item { position: absolute; bottom: 16px; z-index: 3; }

.lw-mug {
  left: 15px;
  width: 24px; height: 24px;
  background: #ddd;
  border-radius: 4px 4px 12px 12px;
  box-shadow: 2px 2px 5px rgba(0,0,0,0.5);
}
.lw-mug::before { /* Handle */
  content: '';
  position: absolute;
  right: -8px; top: 6px;
  width: 8px; height: 10px;
  border: 2px solid #ddd;
  border-left: none;
  border-radius: 0 6px 6px 0;
}
.lw-mug::after { /* Coffee */
  content: '';
  position: absolute;
  top: 2px; left: 2px; right: 2px;
  height: 4px;
  background: #4a2e24;
  border-radius: 2px;
}
.lw-steam {
  position: absolute;
  top: -10px; left: 8px;
  width: 4px; height: 15px;
  background: rgba(255,255,255,0.15);
  filter: blur(3px);
  animation: lw-steam 3s infinite ease-in;
}
.lw-steam2 { left: 14px; animation-delay: 1s; }
@keyframes lw-steam {
  0% { transform: translateY(0) scale(1); opacity: 0.5; }
  100% { transform: translateY(-15px) scale(1.5); opacity: 0; }
}

.lw-books {
  right: 20px;
  width: 30px; height: 20px;
}
.lw-book {
  position: absolute;
  width: 30px; height: 6px;
  background: #cc7e00;
  border: 1px solid #8b4513;
  box-shadow: 1px 1px 2px rgba(0,0,0,0.3);
}
.lw-book:nth-child(1) { bottom: 0; }
.lw-book:nth-child(2) { bottom: 7px; background: #6fb7a6; width: 28px; left: 2px; }
.lw-book:nth-child(3) { bottom: 14px; background: #cf7e7e; width: 32px; left: -1px; }

.lw-lamp {
  right: 60px;
  width: 10px; height: 40px;
}
.lw-lamp-base { width: 20px; height: 4px; background: #333; position: absolute; bottom: 0; left: -5px; border-radius: 2px; }
.lw-lamp-arm { width: 4px; height: 30px; background: #444; position: absolute; bottom: 4px; left: 3px; transform: rotate(20deg); transform-origin: bottom; }
.lw-lamp-head { width: 20px; height: 12px; background: #555; border-radius: 10px 10px 2px 2px; position: absolute; top: -8px; left: 5px; transform: rotate(20deg); box-shadow: 1px 1px 3px rgba(0,0,0,0.5); }
.lw-lamp-glow {
  position: absolute;
  top: 0; left: -30px;
  width: 80px; height: 80px;
  background: radial-gradient(circle, rgba(255, 200, 100, 0.2), transparent 70%);
  pointer-events: none;
}

/* Settings Area (Paper Notes) */
.lw-settings-area {
  width: min(100%, 356px);
  margin: 22px auto 0;
  display: flex;
  flex-direction: column;
  gap: 16px;
  position: relative;
  z-index: 1;
}

/* Panels (Paper Notes) */
.lw-panel {
  border: none;
  background-color: #fefae0;
  background-image: linear-gradient(#e6dcc3 1px, transparent 1px);
  background-size: 100% 20px;
  color: #2b201d;
  border-radius: 2px;
  padding: 14px;
  margin-bottom: 14px;
  box-shadow: 3px 5px 15px rgba(0,0,0,0.6);
  position: relative;
  transform: rotate(-1deg);
  transition: transform 0.3s;
  max-width: 100%;
  min-width: 0;
  overflow: hidden;
}
.lw-panel:nth-child(even) { transform: rotate(1deg); background-color: #e0d8c8; }
.lw-panel:nth-child(3n) { transform: rotate(-0.5deg); background-color: #f5f5dc; }
.lw-panel:hover { transform: rotate(0deg) scale(1.01); z-index: 2; }
.lw-panel::before {
  content: '';
  position: absolute;
  top: -8px; left: 50%;
  width: 50px; height: 16px;
  background: rgba(255, 255, 255, 0.3);
  border: 1px dashed rgba(0,0,0,0.1);
  transform: translateX(-50%) rotate(-2deg);
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  z-index: 10;
  backdrop-filter: blur(2px);
}

.lw-panel-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 10px;
  border-bottom: 2px dashed #8b7765;
  padding-bottom: 6px;
  flex-wrap: wrap;
}
.lw-panel-head h3 { margin: 0; font-size: 14px; font-weight: 700; letter-spacing: 0.5px; text-transform: uppercase; text-shadow: 1px 1px 0px rgba(0,0,0,0.1); }

.lw-form { display: grid; gap: 10px; }
.lw-field { display: grid; gap: 4px; min-width: 0; }
.lw-field label, .lw-toggle-label { font-size: 11px; font-weight: 700; color: #2b201d; text-transform: uppercase; letter-spacing: 0.5px; }
.lw-hint { color: #6b5d4f; font-size: 10.5px; font-style: italic; overflow-wrap: anywhere; }

.lw-input, .lw-select, .lw-textarea {
  width: 100%;
  border: 1px solid #8b7765;
  border-radius: 0;
  background: #fff;
  color: #2b201d;
  font: inherit;
  padding: 7px 8px;
  box-shadow: inset 1px 1px 4px rgba(0,0,0,0.1);
  min-width: 0;
}
.lw-input:focus, .lw-select:focus, .lw-textarea:focus { outline: 2px solid #ff7e00; outline-offset: -1px; }
.lw-textarea {
  resize: vertical;
  min-height: 100px;
  line-height: 1.4;
  font-family: 'Courier New', Courier, monospace;
  font-size: 11px;
}

.lw-two { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; align-items: end; }

.lw-setting-row {
  display: flex;
  gap: 8px;
  align-items: flex-start;
  padding: 6px 0;
  border-bottom: 1px dashed rgba(0,0,0,0.1);
}
.lw-setting-row.is-disabled { opacity: 0.55; }
.lw-setting-row > div:last-child { min-width: 0; }
.lw-switch-slot { flex: 0 0 auto; padding-top: 1px; }

.lw-chips-inline { display: flex; flex-wrap: wrap; gap: 6px; }
.lw-chip-compact {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  border: 1px solid #8b7765;
  border-radius: 2px;
  background: #fff;
  font-size: 10px;
  text-transform: capitalize;
  box-shadow: 1px 1px 0px rgba(0,0,0,0.1);
}

.lw-banner {
  border: 1px solid #111;
  border-radius: 2px;
  padding: 9px 10px;
  background: #ff9e3d;
  color: #111;
  font-weight: bold;
  box-shadow: 3px 4px 0px rgba(0,0,0,0.4);
  margin-bottom: 10px;
  font-size: 11.5px;
  overflow-wrap: anywhere;
}
.lw-banner.warn { background: #d8aa63; }
.lw-banner.error { background: #cf7e7e; color: #fff; }

.lw-details {
  border: 1px solid #8b7765;
  border-radius: 2px;
  background: #e6dcc3;
  padding: 0;
  margin-bottom: 14px;
  box-shadow: 2px 3px 0px rgba(0,0,0,0.3);
}
.lw-details summary { cursor: pointer; padding: 9px 11px; font-weight: 700; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; }
.lw-details-body { padding: 0 11px 11px; display: grid; gap: 10px; }

.lw-divider {
  border: 0;
  border-top: 2px dashed #8b7765;
  margin: 4px 0;
  width: 100%;
}

/* Retro Digital Clock */
.lw-clock {
  display: grid;
  gap: 8px;
  padding: 12px;
  border: 2px solid #111;
  border-radius: 4px;
  background: #111;
  color: #ff5500;
  box-shadow: inset 0 0 30px rgba(0,0,0,0.9), 0 5px 10px rgba(0,0,0,0.5);
  text-align: center;
  margin-bottom: 14px;
  min-width: 0;
}
.lw-clock-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 2px solid #ff5500;
  padding-bottom: 6px;
  gap: 8px;
}
.lw-clock-time {
  font-size: 20px;
  font-weight: 700;
  letter-spacing: 1px;
  text-shadow: 0 0 10px #ff5500;
  font-family: 'Courier New', Courier, monospace;
  white-space: nowrap;
}
.lw-clock-status { font-size: 11px; color: #ff9e3d; white-space: nowrap; }
.lw-clock-actions { display: grid; grid-template-columns: repeat(2, 1fr); gap: 6px; }
.lw-clock-set { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; align-items: end; }
.lw-clock-set .lw-btn { grid-column: span 2; }

.lw-meter-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; }
.lw-state-card {
  border: 1px solid #8b7765;
  border-radius: 2px;
  background: #fff;
  padding: 8px;
  min-height: 50px;
  display: grid;
  align-content: start;
  gap: 4px;
  box-shadow: 2px 2px 0px rgba(0,0,0,0.1);
}
.lw-state-label { color: #6b5d4f; font-size: 9px; text-transform: uppercase; letter-spacing: 0.5px; font-weight: bold; }
.lw-state-value { overflow-wrap: anywhere; font-size: 11px; }

.lw-schedule-strip {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  padding: 3px 3px 9px;
}
.lw-slot {
  flex: 0 0 120px;
  border: 1px solid #8b7765;
  border-radius: 2px;
  background: #f5f5dc;
  padding: 8px;
  display: grid;
  gap: 4px;
  box-shadow: 3px 3px 0px rgba(0,0,0,0.2);
}
.lw-slot.is-now { border-color: #ff5500; box-shadow: 3px 3px 0px #ff5500; background: #fff9e6; }

.lw-runs { display: grid; gap: 8px; }
.lw-scrollbox {
  max-height: 300px;
  overflow-y: auto;
  padding-right: 5px;
}
.lw-run {
  display: grid;
  gap: 4px;
  padding: 8px;
  border: 1px solid #8b7765;
  border-radius: 2px;
  background: #fff;
  box-shadow: 2px 2px 0px rgba(0,0,0,0.1);
}
.lw-run-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.lw-status {
  display: inline-flex;
  align-items: center;
  padding: 2px 6px;
  font-size: 9px;
  font-weight: bold;
  border: 1px solid #111;
  text-transform: uppercase;
  border-radius: 0;
}
.lw-status.success, .lw-status.test_success { color: #111; background: #6fb7a6; }
.lw-status.error, .lw-status.timeout, .lw-status.test_error { color: #fff; background: #cf7e7e; }
.lw-status.skipped { color: #111; background: #d8aa63; }

.lw-empty {
  padding: 12px;
  text-align: center;
  color: #6b5d4f;
  border: 1px dashed #8b7765;
  border-radius: 2px;
  background: rgba(255,255,255,0.5);
  font-style: italic;
  font-size: 11px;
}

/* Buttons */
.lw-btn {
  appearance: none;
  border: 1px solid #111;
  background: linear-gradient(to bottom, #e6dcc3, #c4b89a);
  color: #2b201d;
  border-radius: 3px;
  padding: 6px 8px;
  font: inherit;
  font-weight: bold;
  cursor: pointer;
  min-height: 30px;
  box-shadow: 0 3px 0 #5a4a3f, 0 4px 6px rgba(0,0,0,0.3);
  transition: transform 0.1s, box-shadow 0.1s;
  text-transform: uppercase;
  line-height: 1.15;
  overflow-wrap: anywhere;
  min-width: 0;
}
.lw-btn:hover { background: linear-gradient(to bottom, #f0e6cd, #d4c8aa); }
.lw-btn:active { transform: translateY(3px); box-shadow: 0 1px 0 #5a4a3f, 0 2px 4px rgba(0,0,0,0.3); }
.lw-btn:disabled { cursor: default; opacity: 0.55; box-shadow: 0 4px 0 #5a4a3f; }
.lw-btn-primary { background: linear-gradient(to bottom, #ff9e3d, #cc7e00); color: #111; border-color: #5a3000; box-shadow: 0 3px 0 #5a3000, 0 4px 6px rgba(0,0,0,0.3); }
.lw-btn-primary:active { box-shadow: 0 1px 0 #5a3000; }
.lw-btn-danger { background: linear-gradient(to bottom, #cf7e7e, #a04040); color: #fff; border-color: #400000; box-shadow: 0 3px 0 #400000, 0 4px 6px rgba(0,0,0,0.3); }
.lw-btn-danger:active { box-shadow: 0 1px 0 #400000; }

@media (max-width: 340px) {
  .lw-root { padding: 10px 10px 30px; font-size: 11.5px; }
  .lw-window { width: 100px; height: 70px; top: 5px; left: 5px; }
  .lw-bulb { right: 10px; }
  .lw-shelf-container { margin-top: 78px; }
  .lw-led-sign { font-size: 13px; letter-spacing: 0.8px; padding-inline: 8px; }
  .lw-scene { min-height: 160px; }
  .lw-tv { width: 170px; flex-basis: 170px; max-width: 57%; padding: 12px; padding-bottom: 30px; }
  .lw-desk { min-width: 92px; margin-bottom: 30px; }
  .lw-settings-area { width: 100%; }
  .lw-clock-time { font-size: 18px; letter-spacing: 0; }
}
`;
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
function normalizeWorldAgentSettings(value) {
  const obj = asRecord(value);
  return {
    enabled: typeof obj.enabled === "boolean" ? obj.enabled : DEFAULT_WORLD_AGENT_SETTINGS.enabled,
    connectionId: cleanNullableString(obj.connectionId),
    modelOverride: cleanString(obj.modelOverride),
    temperature: numberInRange(obj.temperature, DEFAULT_WORLD_AGENT_SETTINGS.temperature, 0, 2),
    maxTokens: integerInRange(obj.maxTokens, DEFAULT_WORLD_AGENT_SETTINGS.maxTokens, 64, MAX_CONTROLLER_OUTPUT_TOKENS),
    timeoutMs: integerInRange(obj.timeoutMs, DEFAULT_WORLD_AGENT_SETTINGS.timeoutMs, 1000, MAX_CONTROLLER_TIMEOUT_MS),
    hourDurationMs: integerInRange(obj.hourDurationMs, DEFAULT_WORLD_AGENT_SETTINGS.hourDurationMs, 1000, 365 * 24 * 60 * 60 * 1000),
    injectState: typeof obj.injectState === "boolean" ? obj.injectState : DEFAULT_WORLD_AGENT_SETTINGS.injectState,
    autoTickVisibleOnly: typeof obj.autoTickVisibleOnly === "boolean" ? obj.autoTickVisibleOnly : DEFAULT_WORLD_AGENT_SETTINGS.autoTickVisibleOnly,
    scheduleTemplate: cleanString(obj.scheduleTemplate, DEFAULT_WORLD_AGENT_SCHEDULE_TEMPLATE) || DEFAULT_WORLD_AGENT_SCHEDULE_TEMPLATE,
    updateTemplate: cleanString(obj.updateTemplate, DEFAULT_WORLD_AGENT_UPDATE_TEMPLATE) || DEFAULT_WORLD_AGENT_UPDATE_TEMPLATE
  };
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
    timeoutMs: integerInRange(obj.timeoutMs, DEFAULT_SETTINGS.timeoutMs, 1000, MAX_CONTROLLER_TIMEOUT_MS),
    maxInputChars: integerInRange(obj.maxInputChars, DEFAULT_SETTINGS.maxInputChars, 4000, 500000),
    historyMessageLimit: integerInRange(obj.historyMessageLimit, DEFAULT_SETTINGS.historyMessageLimit, 0, MAX_CHAT_HISTORY_MESSAGES),
    includeWorldInfoEntries: typeof obj.includeWorldInfoEntries === "boolean" ? obj.includeWorldInfoEntries : DEFAULT_SETTINGS.includeWorldInfoEntries,
    includeUserPersona: typeof obj.includeUserPersona === "boolean" ? obj.includeUserPersona : DEFAULT_SETTINGS.includeUserPersona,
    includeCharacter: typeof obj.includeCharacter === "boolean" ? obj.includeCharacter : DEFAULT_SETTINGS.includeCharacter,
    generationTypes: normalizeGenerationTypes(obj.generationTypes),
    additionalNotes: cleanString(obj.additionalNotes),
    systemTemplate,
    userTemplate,
    runLogLimit: integerInRange(obj.runLogLimit, DEFAULT_SETTINGS.runLogLimit, 0, 50),
    worldAgent: normalizeWorldAgentSettings(obj.worldAgent)
  };
}
function createElement(tag, className, text) {
  const element = document.createElement(tag);
  if (className)
    element.className = className;
  if (typeof text === "string")
    element.textContent = text;
  return element;
}
function activeChat(ctx) {
  try {
    return ctx.getActiveChat();
  } catch {
    return { chatId: null, characterId: null };
  }
}
function send(ctx, message) {
  const active = activeChat(ctx);
  ctx.sendToBackend({
    ...message,
    chatId: "chatId" in message ? message.chatId ?? active.chatId : active.chatId,
    characterId: "characterId" in message ? message.characterId ?? active.characterId : active.characterId
  });
}
function cloneSettings(settings) {
  return normalizeSettings({
    ...settings,
    generationTypes: [...settings.generationTypes],
    worldAgent: { ...settings.worldAgent }
  });
}
function readChatId(payload) {
  if (!payload || typeof payload !== "object")
    return null;
  const raw = payload.chatId ?? payload.chat_id;
  return typeof raw === "string" && raw.trim() ? raw : null;
}
function readCharacterId(payload) {
  if (!payload || typeof payload !== "object")
    return null;
  const raw = payload.characterId ?? payload.character_id;
  return typeof raw === "string" && raw.trim() ? raw : null;
}
function formatStatus(status) {
  return status.replace(/_/g, " ");
}
function formatTime(timestamp) {
  try {
    return new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit", second: "2-digit" }).format(new Date(timestamp));
  } catch {
    return "";
  }
}
function formatClock(state) {
  if (!state)
    return "Day 1, 08:00";
  return `Day ${state.day}, ${String(state.hour).padStart(2, "0")}:00`;
}
function formatWorldInfoRunDiagnostics(run) {
  const hasDiagnostics = run.worldInfoActivatedCount != null || run.worldInfoFetchedCount != null || run.worldInfoFallbackTaggedCount != null;
  if (!hasDiagnostics)
    return null;
  return [
    `WI active ${run.worldInfoActivatedCount ?? 0}`,
    `fetched ${run.worldInfoFetchedCount ?? 0}`,
    `tagged fallback ${run.worldInfoFallbackTaggedCount ?? 0}`
  ].join(" / ");
}
function connectionLabel(connection) {
  const bits = [connection.name, connection.provider, connection.model].filter(Boolean);
  return `${bits.join(" / ")}${connection.hasApiKey ? "" : " (no key)"}`;
}
function settingsKey(settings) {
  return JSON.stringify(settings);
}
function stateUiKey(state) {
  return JSON.stringify({
    connections: state.connections,
    connectionError: state.connectionError ?? null,
    permissions: state.permissions,
    runs: state.runs,
    worldState: state.worldState ?? null
  });
}
function worldStateCardValue(value, fallback = "Unset") {
  const text = typeof value === "string" ? value.trim() : "";
  return text || fallback;
}
function setup(ctx) {
  const cleanups = [];
  const componentHandles = [];
  let state = null;
  let draft = cloneSettings(DEFAULT_SETTINGS);
  let activeChannel = "director";
  let saveTimer = null;
  let localRevision = 0;
  let saveRevision = 0;
  let saveInFlight = false;
  let notice = null;
  cleanups.push(ctx.dom.addStyle(CSS));
  const tab = ctx.ui.registerDrawerTab({
    id: "lumi-world",
    title: EXTENSION_NAME,
    shortName: "World",
    headerTitle: "LumiWorld",
    description: "World simulation channels",
    keywords: ["lumiworld", "world", "director", "interceptor", "simulation"],
    iconSvg: LUMIWORLD_ICON
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
  function scheduleAutoSave() {
    if (saveTimer)
      clearTimeout(saveTimer);
    tab.setBadge("Saving");
    saveTimer = setTimeout(() => {
      saveTimer = null;
      saveRevision = localRevision;
      saveInFlight = true;
      send(ctx, { type: "save_settings", settings: draft });
    }, 450);
  }
  function updateDraft(patch) {
    draft = normalizeSettings({
      ...draft,
      ...patch,
      worldAgent: normalizeWorldAgentSettings({
        ...draft.worldAgent,
        ...patch.worldAgent ?? {}
      })
    });
    localRevision += 1;
    scheduleAutoSave();
  }
  function updateWorldAgent(patch) {
    updateDraft({ worldAgent: { ...draft.worldAgent, ...patch } });
  }
  function selectedConnection(connectionId) {
    if (!state || !connectionId)
      return null;
    return state.connections.find((connection) => connection.id === connectionId) ?? null;
  }
  function field(label, control, hint) {
    const wrap = createElement("div", "lw-field");
    wrap.appendChild(createElement("label", undefined, label));
    wrap.appendChild(control);
    if (hint)
      wrap.appendChild(createElement("div", "lw-hint", hint));
    return wrap;
  }
  function numberInput(value, min, max, step, onChange) {
    const input = createElement("input", "lw-input");
    input.type = "number";
    input.min = String(min);
    input.max = String(max);
    input.step = String(step);
    input.value = String(value);
    input.addEventListener("change", () => onChange(Number(input.value)));
    return input;
  }
  function renderNumberControl(slot, value, min, max, step, onChange) {
    const components = ctx.components;
    if (components?.mountNumberStepper) {
      const handle = components.mountNumberStepper(slot, {
        value,
        min,
        max,
        step,
        onChange: (next) => {
          if (typeof next === "number" && Number.isFinite(next))
            onChange(next);
        }
      });
      componentHandles.push(handle);
      return;
    }
    slot.appendChild(numberInput(value, min, max, step, onChange));
  }
  function numberField(label, value, min, max, step, onChange, hint) {
    const slot = createElement("div");
    renderNumberControl(slot, value, min, max, step, onChange);
    return field(label, slot, hint);
  }
  function renderTextareaControl(slot, value, onChange, ariaLabel) {
    const components = ctx.components;
    if (components?.mountTextArea) {
      const handle = components.mountTextArea(slot, { value, rows: 8, ariaLabel, onChange });
      componentHandles.push(handle);
      return;
    }
    const input = createElement("textarea", "lw-textarea");
    input.value = value;
    input.spellcheck = false;
    input.addEventListener("input", () => onChange(input.value));
    slot.appendChild(input);
  }
  function textareaField(label, value, onChange, hint) {
    const slot = createElement("div");
    renderTextareaControl(slot, value, onChange, label);
    return field(label, slot, hint);
  }
  function renderSwitchControl(slot, checked, onChange, ariaLabel, disabled = false) {
    const components = ctx.components;
    if (components?.mountSwitch && !disabled) {
      const handle = components.mountSwitch(slot, { checked, size: "md", ariaLabel, onChange });
      componentHandles.push(handle);
      return;
    }
    const input = createElement("input");
    input.type = "checkbox";
    input.checked = checked;
    input.disabled = disabled;
    input.addEventListener("change", () => onChange(input.checked));
    slot.appendChild(input);
  }
  function toggleField(label, checked, onChange, hint, disabled = false) {
    const row = createElement("div", `lw-setting-row${disabled ? " is-disabled" : ""}`);
    const switchSlot = createElement("div", "lw-switch-slot");
    renderSwitchControl(switchSlot, checked, onChange, label, disabled);
    const text = createElement("div");
    text.appendChild(createElement("div", "lw-toggle-label", label));
    if (hint)
      text.appendChild(createElement("div", "lw-hint", hint));
    row.append(switchSlot, text);
    return row;
  }
  function renderConnectionControl(slot, value, onChange, ariaLabel) {
    const connections = state?.connections ?? [];
    const components = ctx.components;
    const options = connections.map((connection) => ({
      value: connection.id,
      label: connection.name || connection.id,
      sublabel: [connection.provider || null, connection.model || null, connection.hasApiKey ? null : "no API key", connection.isDefault ? "default" : null].filter(Boolean).join(" / "),
      group: connection.provider || "Connections",
      leading: { type: "initial", text: (connection.provider || connection.name || "?").slice(0, 1).toUpperCase() }
    }));
    if (value && !options.some((option) => option.value === value)) {
      options.unshift({
        value,
        label: "Saved connection not found",
        sublabel: value,
        group: "Unavailable",
        leading: { type: "initial", text: "!" }
      });
    }
    if (components?.mountSelect) {
      const handle = components.mountSelect(slot, {
        value: value ?? "",
        options,
        placeholder: "Select connection...",
        searchPlaceholder: "Search LLM connections...",
        emptyMessage: state?.connectionError || "No LLM connection profiles found.",
        noResultsMessage: "No matching LLM connection profiles.",
        clearable: true,
        clearLabel: "No connection",
        ariaLabel,
        portal: true,
        maxHeight: 320,
        onChange: (next) => {
          onChange(next || null);
          render();
        }
      });
      componentHandles.push(handle);
      return;
    }
    const select = createElement("select", "lw-select");
    select.appendChild(new Option("Select connection...", ""));
    for (const connection of connections) {
      select.appendChild(new Option(connectionLabel(connection), connection.id));
    }
    select.value = value ?? "";
    select.addEventListener("change", () => {
      onChange(select.value || null);
      render();
    });
    slot.appendChild(select);
  }
  function renderModelControl(slot, connectionId, value, onChange) {
    const selected = selectedConnection(connectionId);
    const components = ctx.components;
    if (selected && components?.mountModelCombobox) {
      const handle = components.mountModelCombobox(slot, {
        value,
        connection: { kind: "llm", id: selected.id },
        appearance: "standard",
        placeholder: selected.model || "model id",
        browseHint: selected.model ? `Connection default: ${selected.model}` : "No connection default model is configured.",
        onChange
      });
      componentHandles.push(handle);
      return;
    }
    const input = createElement("input", "lw-input");
    input.type = "text";
    input.placeholder = selected?.model || "model id";
    input.value = value;
    input.disabled = !selected;
    input.addEventListener("input", () => onChange(input.value));
    slot.appendChild(input);
  }
  function renderDirectorChannel(shell) {
    const panel = createElement("section", "lw-panel");
    const head = createElement("div", "lw-panel-head");
    head.appendChild(createElement("h3", undefined, "Director Settings"));
    const toggleSlot = createElement("div", "lw-switch-slot");
    renderSwitchControl(toggleSlot, draft.enabled, (checked) => updateDraft({ enabled: checked }), "Enable Director Note");
    head.appendChild(toggleSlot);
    panel.appendChild(head);
    const form = createElement("div", "lw-form");
    const connSlot = createElement("div");
    renderConnectionControl(connSlot, draft.connectionId, (id) => updateDraft({ connectionId: id, modelOverride: "" }), "Director Note connection");
    form.appendChild(field("Connection", connSlot));
    const modelSlot = createElement("div");
    renderModelControl(modelSlot, draft.connectionId, draft.modelOverride, (m) => updateDraft({ modelOverride: m }));
    form.appendChild(field("Model Override", modelSlot));
    const paramsGrid = createElement("div", "lw-two");
    paramsGrid.append(numberField("Temp", draft.temperature, 0, 2, 0.05, (v) => updateDraft({ temperature: v })), numberField("Tokens", draft.maxTokens, 64, MAX_CONTROLLER_OUTPUT_TOKENS, 1, (v) => updateDraft({ maxTokens: v })));
    form.appendChild(paramsGrid);
    const paramsGrid2 = createElement("div", "lw-two");
    paramsGrid2.append(numberField("Timeout", draft.timeoutMs, 1000, MAX_CONTROLLER_TIMEOUT_MS, 1000, (v) => updateDraft({ timeoutMs: v })), numberField("History", draft.historyMessageLimit, 0, MAX_CHAT_HISTORY_MESSAGES, 1, (v) => updateDraft({ historyMessageLimit: v })));
    form.appendChild(paramsGrid2);
    const paramsGrid3 = createElement("div", "lw-two");
    paramsGrid3.append(numberField("Cap Chars", draft.maxInputChars, 4000, 500000, 1000, (v) => updateDraft({ maxInputChars: v })), numberField("Log Limit", draft.runLogLimit, 0, 50, 1, (v) => updateDraft({ runLogLimit: v })));
    form.appendChild(paramsGrid3);
    const runsOnDiv = createElement("div", "lw-field");
    runsOnDiv.appendChild(createElement("label", undefined, "Runs On"));
    const chips = createElement("div", "lw-chips-inline");
    const components = ctx.components;
    for (const type of VISIBLE_GENERATION_TYPES) {
      const updateType = (checked) => {
        const next = new Set(draft.generationTypes);
        if (checked)
          next.add(type);
        else
          next.delete(type);
        updateDraft({ generationTypes: [...next] });
      };
      if (components?.mountCheckbox) {
        const slot = createElement("div");
        const handle = components.mountCheckbox(slot, { checked: draft.generationTypes.includes(type), label: type, onChange: updateType });
        componentHandles.push(handle);
        chips.appendChild(slot);
      } else {
        const label = createElement("label", "lw-chip-compact");
        const input = createElement("input");
        input.type = "checkbox";
        input.checked = draft.generationTypes.includes(type);
        input.addEventListener("change", () => updateType(input.checked));
        label.append(input, document.createTextNode(type));
        chips.appendChild(label);
      }
    }
    runsOnDiv.appendChild(chips);
    form.appendChild(runsOnDiv);
    panel.appendChild(form);
    shell.appendChild(panel);
    renderDirectorAdvanced(shell);
    renderRuns(shell, "director");
  }
  function renderDirectorAdvanced(shell) {
    const details = createElement("details", "lw-details");
    const summary = createElement("summary", undefined, "Advanced Settings");
    const body = createElement("div", "lw-details-body");
    const entriesHint = state?.permissions.worldBooks === false ? "Grant World Books permission to fetch activated entry content. Without it, LumiWorld can only use tagged standalone prompt entries." : "Fetch activated World Info entry content and send it to the controller.";
    body.append(toggleField("Entries", draft.includeWorldInfoEntries, (checked) => updateDraft({ includeWorldInfoEntries: checked }), entriesHint), toggleField("User persona", draft.includeUserPersona, (checked) => updateDraft({ includeUserPersona: checked }), "Send the active user persona to the controller."), toggleField("Character", draft.includeCharacter, (checked) => updateDraft({ includeCharacter: checked }), "Send the active character card to the controller."), textareaField("Additional notes", draft.additionalNotes, (value) => updateDraft({ additionalNotes: value }), "Always sent to the LumiWorld controller as a private system message."), textareaField("System template", draft.systemTemplate, (value) => updateDraft({ systemTemplate: value }), "Available variables: {{prompt}}, {{generationType}}, {{chatId}}, {{connectionId}}, {{timestamp}}, {{maxDirectiveChars}}, {{user}}, {{char}}."), textareaField("User template", draft.userTemplate, (value) => updateDraft({ userTemplate: value })));
    details.append(summary, body);
    shell.appendChild(details);
  }
  function renderWorldAgentChannel(shell) {
    renderWorldAgentClock(shell);
    const panel = createElement("section", "lw-panel");
    const head = createElement("div", "lw-panel-head");
    head.appendChild(createElement("h3", undefined, "World Agent Settings"));
    panel.appendChild(head);
    const form = createElement("div", "lw-form");
    form.append(toggleField("Enable Agent", draft.worldAgent.enabled, (checked) => updateWorldAgent({ enabled: checked }), "Per-chat simulation state."), toggleField("Inject State", draft.worldAgent.injectState, (checked) => updateWorldAgent({ injectState: checked }), "Add state to visible prompt."), toggleField("Visible-only Ticks", draft.worldAgent.autoTickVisibleOnly, (checked) => updateWorldAgent({ autoTickVisibleOnly: checked }), "Ticks run only when Lumiverse is visible."));
    form.appendChild(createElement("hr", "lw-divider"));
    const connSlot = createElement("div");
    renderConnectionControl(connSlot, draft.worldAgent.connectionId, (id) => updateWorldAgent({ connectionId: id, modelOverride: "" }), "World Agent connection");
    form.appendChild(field("Connection", connSlot));
    const modelSlot = createElement("div");
    renderModelControl(modelSlot, draft.worldAgent.connectionId, draft.worldAgent.modelOverride, (m) => updateWorldAgent({ modelOverride: m }));
    form.appendChild(field("Model Override", modelSlot));
    const paramsGrid = createElement("div", "lw-two");
    paramsGrid.append(numberField("Temp", draft.worldAgent.temperature, 0, 2, 0.05, (v) => updateWorldAgent({ temperature: v })), numberField("Tokens", draft.worldAgent.maxTokens, 64, MAX_CONTROLLER_OUTPUT_TOKENS, 1, (v) => updateWorldAgent({ maxTokens: v })));
    form.appendChild(paramsGrid);
    const paramsGrid2 = createElement("div", "lw-two");
    paramsGrid2.append(numberField("Timeout", draft.worldAgent.timeoutMs, 1000, MAX_CONTROLLER_TIMEOUT_MS, 1000, (v) => updateWorldAgent({ timeoutMs: v })), numberField("Hour Dur", draft.worldAgent.hourDurationMs, 1000, 365 * 24 * 60 * 60 * 1000, 1000, (v) => updateWorldAgent({ hourDurationMs: v })));
    form.appendChild(paramsGrid2);
    panel.appendChild(form);
    shell.appendChild(panel);
    renderWorldAgentState(shell);
    renderWorldAgentSchedule(shell);
    renderWorldAgentAdvanced(shell);
    renderRuns(shell, "world_agent");
  }
  function renderWorldAgentClock(shell) {
    const panel = createElement("section", "lw-clock");
    const stateNow = state?.worldState ?? null;
    const top = createElement("div", "lw-clock-top");
    top.append(createElement("div", "lw-clock-time", formatClock(stateNow)), createElement("span", "lw-clock-status", stateNow?.running ? "▶ Running" : "⏸ Paused"));
    panel.appendChild(top);
    const actions = createElement("div", "lw-clock-actions");
    const startPause = createElement("button", `lw-btn${stateNow?.running ? "" : " lw-btn-primary"}`, stateNow?.running ? "Pause" : "Start");
    startPause.type = "button";
    startPause.addEventListener("click", () => {
      notice = { tone: "info", text: stateNow?.running ? "Pausing World Agent..." : "Starting World Agent..." };
      render();
      send(ctx, { type: stateNow?.running ? "world_agent_pause" : "world_agent_start" });
    });
    const advance = createElement("button", "lw-btn", "+1 Hour");
    advance.type = "button";
    advance.addEventListener("click", () => {
      notice = { tone: "info", text: "Advancing one simulated hour..." };
      render();
      send(ctx, { type: "world_agent_advance_hour" });
    });
    const schedule = createElement("button", "lw-btn", "Schedule");
    schedule.type = "button";
    schedule.addEventListener("click", () => {
      notice = { tone: "info", text: "Regenerating the daily schedule..." };
      render();
      send(ctx, { type: "world_agent_regenerate_schedule" });
    });
    const reset = createElement("button", "lw-btn lw-btn-danger", "Reset");
    reset.type = "button";
    reset.addEventListener("click", () => send(ctx, { type: "world_agent_reset" }));
    actions.append(startPause, advance, schedule, reset);
    panel.appendChild(actions);
    const timeRow = createElement("div", "lw-clock-set");
    const dayInput = numberInput(stateNow?.day ?? 1, 1, Number.MAX_SAFE_INTEGER, 1, () => {});
    const hourInput = numberInput(stateNow?.hour ?? 8, 0, 23, 1, () => {});
    const setButton = createElement("button", "lw-btn", "Set Time");
    setButton.type = "button";
    setButton.addEventListener("click", () => send(ctx, { type: "world_agent_set_time", day: Number(dayInput.value), hour: Number(hourInput.value) }));
    timeRow.append(field("Day", dayInput), field("Hour", hourInput), setButton);
    panel.appendChild(timeRow);
    shell.appendChild(panel);
  }
  function renderWorldAgentState(shell) {
    const panel = createElement("section", "lw-panel");
    const head = createElement("div", "lw-panel-head");
    head.appendChild(createElement("h3", undefined, "Current State"));
    if (state?.worldState?.updatedAt)
      head.appendChild(createElement("span", "lw-muted", `Updated ${formatTime(state.worldState.updatedAt)}`));
    panel.appendChild(head);
    const grid = createElement("div", "lw-meter-grid");
    const current = state?.worldState ?? null;
    const cards = [
      ["Location", worldStateCardValue(current?.location)],
      ["Mood", worldStateCardValue(current?.mood, "Neutral")],
      ["Activity", worldStateCardValue(current?.activity, "Idle")],
      ["Goal", worldStateCardValue(current?.goal)],
      ["Thought", worldStateCardValue(current?.thought)],
      ["Schedule", current?.schedule?.length ? `${current.schedule.length} entries` : "No schedule"]
    ];
    for (const [label, value] of cards) {
      const card = createElement("div", "lw-state-card");
      card.append(createElement("div", "lw-state-label", label), createElement("div", "lw-state-value", value));
      grid.appendChild(card);
    }
    panel.appendChild(grid);
    const history = current?.history ?? [];
    const box = createElement("div", "lw-scrollbox");
    box.style.marginTop = "10px";
    if (!history.length) {
      box.appendChild(createElement("div", "lw-empty", "No World Agent activity yet."));
    } else {
      const list = createElement("div", "lw-runs");
      for (const entry of history) {
        const item = createElement("article", "lw-run");
        const row = createElement("div", "lw-run-head");
        row.append(createElement("strong", undefined, entry.action.replace(/_/g, " ")), createElement("span", "lw-muted", `Day ${entry.day}, ${String(entry.hour).padStart(2, "0")}:00`));
        item.appendChild(row);
        if (entry.preview)
          item.appendChild(createElement("div", undefined, entry.preview));
        if (entry.error)
          item.appendChild(createElement("div", "lw-muted", entry.error));
        item.appendChild(createElement("div", "lw-muted", formatTime(entry.timestamp)));
        list.appendChild(item);
      }
      box.appendChild(list);
    }
    panel.appendChild(box);
    shell.appendChild(panel);
  }
  function renderWorldAgentSchedule(shell) {
    const panel = createElement("section", "lw-panel");
    const head = createElement("div", "lw-panel-head");
    head.appendChild(createElement("h3", undefined, "Daily Schedule"));
    head.appendChild(createElement("span", "lw-muted", state?.worldState?.scheduleDay ? `Day ${state.worldState.scheduleDay}` : "No day"));
    panel.appendChild(head);
    const schedule = state?.worldState?.schedule ?? [];
    if (!schedule.length) {
      panel.appendChild(createElement("div", "lw-empty", "No schedule generated."));
      shell.appendChild(panel);
      return;
    }
    const strip = createElement("div", "lw-schedule-strip");
    for (const item of schedule) {
      const slot = createElement("article", `lw-slot${item.hour === state?.worldState?.hour ? " is-now" : ""}`);
      slot.append(createElement("strong", undefined, `${String(item.hour).padStart(2, "0")}:00`));
      if (item.location)
        slot.appendChild(createElement("div", "lw-muted", item.location));
      slot.appendChild(createElement("div", undefined, item.activity || "Unspecified activity"));
      if (item.mood)
        slot.appendChild(createElement("div", "lw-muted", `Mood: ${item.mood}`));
      if (item.goal)
        slot.appendChild(createElement("div", "lw-muted", `Goal: ${item.goal}`));
      strip.appendChild(slot);
    }
    panel.appendChild(strip);
    shell.appendChild(panel);
  }
  function renderWorldAgentAdvanced(shell) {
    const details = createElement("details", "lw-details");
    const summary = createElement("summary", undefined, "Advanced Settings");
    const body = createElement("div", "lw-details-body");
    body.append(textareaField("Schedule template", draft.worldAgent.scheduleTemplate, (value) => updateWorldAgent({ scheduleTemplate: value }), "Variables: {{chatId}}, {{user}}, {{char}}, {{day}}, {{hour}}, {{time}}, {{state}}, {{schedule}}, {{timestamp}}."), textareaField("Update template", draft.worldAgent.updateTemplate, (value) => updateWorldAgent({ updateTemplate: value }), "Variables: {{chatId}}, {{user}}, {{char}}, {{day}}, {{hour}}, {{time}}, {{state}}, {{schedule}}, {{timestamp}}."));
    details.append(summary, body);
    shell.appendChild(details);
  }
  function renderRuns(shell, channel) {
    const panel = createElement("section", "lw-panel");
    const head = createElement("div", "lw-panel-head");
    head.appendChild(createElement("h3", undefined, channel === "director" ? "Recent Runs" : "Recent Activity"));
    const clear = createElement("button", "lw-btn", "Clear");
    clear.type = "button";
    clear.addEventListener("click", () => send(ctx, { type: "clear_runs" }));
    head.appendChild(clear);
    panel.appendChild(head);
    const runs = (state?.runs ?? []).filter((run) => (run.channel ?? "director") === channel);
    const scroll = createElement("div", "lw-scrollbox");
    if (!runs.length) {
      scroll.appendChild(createElement("div", "lw-empty", channel === "director" ? "No controller runs yet." : "No World Agent runs yet."));
      panel.appendChild(scroll);
      shell.appendChild(panel);
      return;
    }
    const list = createElement("div", "lw-runs");
    for (const run of runs) {
      const item = createElement("article", "lw-run");
      const runHead = createElement("div", "lw-run-head");
      runHead.append(createElement("span", `lw-status ${run.status}`, formatStatus(run.status)), createElement("span", "lw-muted", formatTime(run.timestamp)));
      item.appendChild(runHead);
      const title = [run.action ? run.action.replace(/_/g, " ") : null, run.generationType ?? null].filter(Boolean).join(" / ");
      if (title)
        item.appendChild(createElement("div", "lw-muted", title));
      const meta = [run.connectionName, run.model, run.durationMs != null ? `${Math.round(run.durationMs)} ms` : null].filter(Boolean).join(" / ");
      if (meta)
        item.appendChild(createElement("div", "lw-muted", meta));
      const worldTime = run.worldAgentDay ? `Day ${run.worldAgentDay}, ${String(run.worldAgentHour ?? 0).padStart(2, "0")}:00` : null;
      if (worldTime)
        item.appendChild(createElement("div", "lw-muted", worldTime));
      const wi = formatWorldInfoRunDiagnostics(run);
      if (wi)
        item.appendChild(createElement("div", "lw-muted", wi));
      if (run.directivePreview)
        item.appendChild(createElement("div", undefined, run.directivePreview));
      if (run.error)
        item.appendChild(createElement("div", "lw-muted", run.error));
      if (run.worldInfoFetchError)
        item.appendChild(createElement("div", "lw-muted", `World Info fetch: ${run.worldInfoFetchError}`));
      list.appendChild(item);
    }
    scroll.appendChild(list);
    panel.appendChild(scroll);
    shell.appendChild(panel);
  }
  function renderNotice(shell) {
    if (!notice)
      return;
    const div = createElement("div", `lw-banner ${notice.tone === "warn" || notice.tone === "error" ? notice.tone : ""}`, notice.text);
    shell.appendChild(div);
  }
  function renderBanners(shell) {
    if (!state)
      return;
    const missingPermissions = [
      !state.permissions.interceptor ? "Interceptor" : null,
      !state.permissions.generation ? "Generation" : null,
      (draft.includeCharacter || draft.worldAgent.enabled) && !state.permissions.chats ? "Chats" : null,
      (draft.includeCharacter || draft.worldAgent.enabled) && !state.permissions.characters ? "Characters" : null,
      (draft.includeUserPersona || draft.worldAgent.enabled) && !state.permissions.personas ? "Personas" : null,
      draft.includeWorldInfoEntries && !state.permissions.worldBooks ? "World Books" : null
    ].filter(Boolean);
    if (missingPermissions.length) {
      shell.appendChild(createElement("div", "lw-banner warn", `Grant ${missingPermissions.join(", ")} permission${missingPermissions.length === 1 ? "" : "s"} in Lumiverse's Extensions panel.`));
    }
    if (state.connectionError)
      shell.appendChild(createElement("div", "lw-banner warn", state.connectionError));
    if (draft.enabled && !draft.connectionId)
      shell.appendChild(createElement("div", "lw-banner warn", "Director Note is enabled but no controller connection is selected."));
    if (draft.worldAgent.enabled && !draft.worldAgent.connectionId)
      shell.appendChild(createElement("div", "lw-banner warn", "World Agent is enabled but no model connection is selected."));
  }
  function renderTvGuide(shell) {
    const scene = createElement("div", "lw-scene");
    const tv = createElement("div", "lw-tv");
    const tvScreen = createElement("div", "lw-tv-screen");
    tvScreen.appendChild(createElement("div", "lw-tv-scanlines"));
    tvScreen.appendChild(createElement("div", "lw-tv-glare"));
    const content = createElement("div", "lw-tv-content");
    const header = createElement("div", "lw-tv-header");
    header.append(createElement("span", undefined, "◆ LUMI-VISION"), createElement("span", undefined, formatClock(state?.worldState)));
    content.appendChild(header);
    const list = createElement("div", "lw-tv-list");
    const ch1 = createElement("div", `lw-tv-row${activeChannel === "director" ? " is-active" : ""}`);
    ch1.innerHTML = `<span class="lw-tv-ch">CH 01</span><span class="lw-tv-name">DIRECTOR NOTE</span><span class="lw-tv-status">${draft.enabled ? "● LIVE" : "OFF"}</span>`;
    ch1.addEventListener("click", () => {
      activeChannel = "director";
      render();
    });
    const ch2 = createElement("div", `lw-tv-row${activeChannel === "world_agent" ? " is-active" : ""}`);
    ch2.innerHTML = `<span class="lw-tv-ch">CH 02</span><span class="lw-tv-name">WORLD AGENT</span><span class="lw-tv-status">${state?.worldState?.running ? "● RUN" : "PAUSE"}</span>`;
    ch2.addEventListener("click", () => {
      activeChannel = "world_agent";
      render();
    });
    list.append(ch1, ch2);
    content.appendChild(list);
    const footer = createElement("div", "lw-tv-footer", "SELECT CHANNEL TO TUNE IN");
    content.appendChild(footer);
    tvScreen.appendChild(content);
    tv.appendChild(createElement("div", "lw-tv-knob"));
    tv.appendChild(createElement("div", "lw-tv-knob"));
    tv.appendChild(tvScreen);
    const desk = createElement("div", "lw-desk");
    const mug = createElement("div", "lw-desk-item lw-mug");
    mug.innerHTML = `<div class="lw-steam"></div><div class="lw-steam lw-steam2"></div>`;
    const books = createElement("div", "lw-desk-item lw-books");
    books.innerHTML = `<div class="lw-book"></div><div class="lw-book"></div><div class="lw-book"></div>`;
    const lamp = createElement("div", "lw-desk-item lw-lamp");
    lamp.innerHTML = `<div class="lw-lamp-glow"></div><div class="lw-lamp-base"></div><div class="lw-lamp-arm"></div><div class="lw-lamp-head"></div>`;
    desk.append(mug, books, lamp);
    scene.append(tv, desk);
    shell.appendChild(scene);
  }
  function render() {
    destroyComponents();
    tab.root.replaceChildren();
    const root = createElement("div", "lw-root");
    const shell = createElement("div", "lw-shell");
    root.appendChild(shell);
    tab.root.appendChild(root);
    const window = createElement("div", "lw-window");
    window.innerHTML = `<div class="lw-city"></div><div class="lw-city-lights"></div><div class="lw-rain"></div>`;
    shell.appendChild(window);
    shell.appendChild(createElement("div", "lw-bulb"));
    const shelfContainer = createElement("div", "lw-shelf-container");
    shelfContainer.appendChild(createElement("div", "lw-led-sign", `${EXTENSION_NAME} ${EXTENSION_VERSION}`));
    shelfContainer.appendChild(createElement("div", "lw-shelf"));
    shell.appendChild(shelfContainer);
    renderNotice(shell);
    if (!state) {
      shell.appendChild(createElement("div", "lw-empty", "Loading LumiWorld settings..."));
      return;
    }
    renderBanners(shell);
    renderTvGuide(shell);
    const settingsArea = createElement("div", "lw-settings-area");
    if (activeChannel === "director")
      renderDirectorChannel(settingsArea);
    else
      renderWorldAgentChannel(settingsArea);
    shell.appendChild(settingsArea);
  }
  const onBackendMessage = ctx.onBackendMessage((raw) => {
    const message = raw;
    switch (message.type) {
      case "state": {
        const previous = state;
        const previousSettingsKey = previous ? settingsKey(previous.settings) : "";
        const previousUiKey = previous ? stateUiKey(previous) : "";
        state = message.state;
        const canHydrateSettings = localRevision === saveRevision && !saveTimer && !saveInFlight;
        let shouldRender = !previous || previousUiKey !== stateUiKey(message.state);
        if (canHydrateSettings) {
          const previousDraftKey = settingsKey(draft);
          draft = cloneSettings(message.state.settings);
          shouldRender ||= previousSettingsKey !== settingsKey(message.state.settings) && previousDraftKey !== settingsKey(draft);
        }
        if (shouldRender)
          render();
        break;
      }
      case "settings_saved":
        saveInFlight = false;
        if (saveRevision === localRevision) {
          draft = cloneSettings(message.settings);
          if (state)
            state = { ...state, settings: message.settings };
          tab.setBadge(null);
        } else if (!saveTimer) {
          scheduleAutoSave();
        }
        break;
      case "world_state":
        if (state) {
          state = { ...state, worldState: message.state };
          render();
        }
        break;
      case "world_agent_result":
        notice = message.ok ? { tone: "success", text: message.message || "World Agent updated." } : { tone: "error", text: message.error };
        if (message.state && state)
          state = { ...state, worldState: message.state };
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
        saveInFlight = false;
        if (!saveTimer && localRevision === saveRevision)
          tab.setBadge("Error");
        notice = { tone: "error", text: message.message };
        render();
        break;
    }
  });
  cleanups.push(onBackendMessage);
  const events = ctx.events;
  cleanups.push(events.on("CHAT_CHANGED", (payload) => {
    const chatId = readChatId(payload);
    const characterId = readCharacterId(payload);
    send(ctx, { type: "refresh_state", chatId, characterId });
    send(ctx, { type: "refresh_world_state", chatId, characterId });
  }));
  const initial = activeChat(ctx);
  send(ctx, { type: "ready", chatId: initial.chatId, characterId: initial.characterId });
  render();
  return () => {
    if (saveTimer) {
      clearTimeout(saveTimer);
      saveTimer = null;
    }
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
