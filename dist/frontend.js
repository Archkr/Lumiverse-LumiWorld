// src/frontend.ts
var VISIBLE_GENERATION_TYPES = ["normal", "continue", "regenerate", "swipe", "impersonate"];
var MAX_CONTROLLER_OUTPUT_TOKENS = Number.MAX_SAFE_INTEGER;
var MAX_CONTROLLER_TIMEOUT_MS = 2147483647;
var MAX_CHAT_HISTORY_MESSAGES = Number.MAX_SAFE_INTEGER;
var DEFAULT_RUN_LOG_LIMIT = 12;
var DEFAULT_HISTORY_MESSAGE_LIMIT = 12;
var DEFAULT_WORLD_AGENT_HOUR_DURATION_MS = 5 * 60 * 1000;
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
var PREVIOUS_DEFAULT_WORLD_AGENT_SCHEDULE_TEMPLATE = [
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
var PREVIOUS_BLOCK_WORLD_AGENT_SCHEDULE_TEMPLATE = [
  "You are LumiWorld's private World Agent for an interactive Lumiverse chat.",
  "Create {{char}}'s private background schedule for the entire current day.",
  "",
  "Plan the full 24-hour day as start-hour blocks, not a single current activity.",
  "Each entry's hour is the hour when that block begins. Use 0-23 hour values.",
  "Include overnight/rest time, morning, midday, afternoon, evening, and late-night blocks when they make sense.",
  "Aim for 8-14 concise entries unless the character's day truly needs fewer.",
  "Only plan where {{char}} is and what {{char}} is doing.",
  "Do not decide mood, thoughts, emotions, reactions, or current goals in the schedule.",
  "Those belong to the hourly update step.",
  "",
  "Use the active character and persona context, the current chat state, and any provided notes.",
  "The schedule is private simulation scaffolding. Do not write visible roleplay prose.",
  "Keep entries flexible enough for the chat to override.",
  "",
  "Return compact JSON only in this shape:",
  '{"schedule":[{"hour":0,"location":"...","activity":"..."},{"hour":7,"location":"...","activity":"..."},{"hour":12,"location":"...","activity":"..."},{"hour":18,"location":"...","activity":"..."}]}'
].join(`
`);
var DEFAULT_WORLD_AGENT_SCHEDULE_TEMPLATE = [
  "You are LumiWorld's private World Agent for an interactive Lumiverse chat.",
  "Create {{char}}'s private background schedule for the entire current day.",
  "",
  "Plan exactly 24 hourly entries, one entry for every hour from 0 through 23.",
  "Each entry's hour is the exact hour it describes. Use 0-23 hour values.",
  "If {{char}} keeps doing the same thing for several hours, repeat the same location and activity for each hour.",
  "For example, sleeping from midnight to 6am still needs separate 0, 1, 2, 3, 4, 5, and 6 entries.",
  "Only plan where {{char}} is and what {{char}} is doing.",
  "Do not decide mood, thoughts, emotions, reactions, or current goals in the schedule.",
  "Those belong to the hourly update step.",
  "",
  "Use the active character and persona context, the current chat state, and any provided notes.",
  "The schedule is private simulation scaffolding. Do not write visible roleplay prose.",
  "Keep entries flexible enough for the chat to override.",
  "",
  "Return compact JSON only in this shape:",
  '{"schedule":[{"hour":0,"location":"...","activity":"..."},{"hour":1,"location":"...","activity":"..."},{"hour":2,"location":"...","activity":"..."},{"hour":3,"location":"...","activity":"..."}]}'
].join(`
`);
var PREVIOUS_FULL_DAY_WORLD_AGENT_SCHEDULE_TEMPLATE = [
  "You are LumiWorld's private World Agent for an interactive Lumiverse chat.",
  "Create {{char}}'s private background schedule for the entire current day.",
  "",
  "Plan the full 24-hour day as start-hour blocks, not a single current activity.",
  "Each entry's hour is the hour when that block begins. Use 0-23 hour values.",
  "Include overnight/rest time, morning, midday, afternoon, evening, and late-night blocks when they make sense.",
  "Aim for 8-14 concise entries unless the character's day truly needs fewer.",
  "",
  "Use the active character and persona context, the current chat state, and any provided notes.",
  "The schedule is private simulation scaffolding. Do not write visible roleplay prose.",
  "Keep entries flexible enough for the chat to override.",
  "",
  "Return compact JSON only in this shape:",
  '{"schedule":[{"hour":0,"location":"...","activity":"...","mood":"...","goal":"..."},{"hour":7,"location":"...","activity":"...","mood":"...","goal":"..."},{"hour":12,"location":"...","activity":"...","mood":"...","goal":"..."},{"hour":18,"location":"...","activity":"...","mood":"...","goal":"..."}]}'
].join(`
`);
var DEFAULT_WORLD_AGENT_UPDATE_TEMPLATE = [
  "You are LumiWorld's private World Agent for an interactive Lumiverse chat.",
  "Advance {{char}}'s private world state by one simulated hour.",
  "",
  "Use the schedule as a rough location/activity plan, plus current state, active character/persona context, and recent chat context.",
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
  height: calc(var(--app-scaled-viewport-height, 100vh) - 48px);
  width: calc(100% + 24px);
  margin: -12px -12px 0;
  color: #e0d6c8;
  background: #1a1a2e;
  box-sizing: border-box;
  font-family: 'Courier New', Courier, monospace;
  font-size: 12px;
  line-height: 1.4;
  overflow: hidden;
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
}
.lw-root * { box-sizing: border-box; }
.lw-root input, .lw-root textarea, .lw-root select { accent-color: #ff7e00; font-family: 'Courier New', monospace; }

/* Navigation */
.lw-nav-btn {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  z-index: 100;
  background: rgba(0,0,0,0.6);
  border: 1px solid rgba(255,255,255,0.2);
  color: #fff;
  width: 28px;
  height: 42px;
  border-radius: 999px;
  cursor: pointer;
  font-size: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  backdrop-filter: blur(4px);
  transition: all 0.2s;
}
.lw-nav-btn:hover { background: rgba(255, 126, 0, 0.6); border-color: #ff7e00; }
.lw-nav-btn:disabled { opacity: 0.2; cursor: default; }
.lw-nav-left { left: 8px; }
.lw-nav-right { right: 8px; }

.lw-nav-dots {
  position: absolute;
  bottom: 12px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  gap: 6px;
  z-index: 100;
}
.lw-dot {
  width: 6px; height: 6px;
  background: rgba(255,255,255,0.3);
  border-radius: 50%;
  transition: all 0.3s;
}
.lw-dot.is-active { background: #ff7e00; transform: scale(1.4); }

/* Viewport and Room */
.lw-viewport {
  width: 100%;
  height: 100%;
  overflow: hidden;
  position: relative;
}
.lw-room-wrapper {
  display: flex;
  width: 400%;
  height: 100%;
  transition: transform 0.6s cubic-bezier(0.4, 0, 0.2, 1);
  background: linear-gradient(to bottom, #2c2a3d, #26243a 70%, #1a1825 100%);
  background-image: 
    repeating-linear-gradient(90deg, rgba(255,255,255,0.02) 0px, rgba(255,255,255,0.02) 40px, transparent 40px, transparent 80px),
    linear-gradient(to bottom, #2c2a3d, #26243a 70%, #1a1825 100%);
}

.lw-panel {
  flex: 0 0 25%;
  width: 25%;
  min-width: 0;
  height: 100%;
  overflow-y: auto;
  padding: 24px 30px 170px; /* Increased bottom padding for larger floor */
  box-sizing: border-box;
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  scrollbar-width: thin;
  scrollbar-color: rgba(255, 158, 61, 0.45) transparent;
}
.lw-panel::-webkit-scrollbar { width: 6px; background: transparent; }
.lw-panel::-webkit-scrollbar-thumb { background: rgba(255, 158, 61, 0.45); border-radius: 999px; }

/* Continuous Floor & Rug */
.lw-panel::after {
  content: '';
  position: absolute;
  bottom: 0; left: 0; width: 100%;
  height: 140px; /* Taller floor */
  background: repeating-linear-gradient(90deg, #4a322a 0px, #4a322a 60px, #3e2a23 60px, #3e2a23 120px);
  border-top: 6px solid #2a1a15;
  box-shadow: 0 -8px 20px rgba(0,0,0,0.4);
  z-index: 0;
  pointer-events: none;
}

.lw-panel::before {
  content: '';
  position: absolute;
  bottom: 0; left: 50%;
  transform: translateX(-50%);
  width: 80%; height: 140px;
  background: repeating-linear-gradient(45deg, #5a3f30 0px, #5a3f30 15px, #4a322a 15px, #4a322a 30px);
  z-index: 0;
  pointer-events: none;
  opacity: 0.6;
  border-radius: 8px 8px 0 0;
  box-shadow: 0 -5px 15px rgba(0,0,0,0.2);
}

/* TV Panel (Panel 0) */
.lw-window {
  position: absolute;
  top: 30px; left: 30px;
  width: clamp(160px, 25vw, 220px); 
  height: clamp(110px, 18vw, 150px);
  background: linear-gradient(to bottom, #0f3460, #16213e);
  border: 8px solid #3a261f;
  border-radius: 4px;
  box-shadow: 0 6px 15px rgba(0,0,0,0.5);
  z-index: 2;
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
  height: 50%; /* Perfectly aligns with lights */
  background: #050a14;
  clip-path: polygon(0% 100%, 0% 60%, 10% 60%, 10% 40%, 20% 40%, 20% 70%, 30% 70%, 30% 30%, 40% 30%, 40% 50%, 50% 50%, 50% 20%, 60% 20%, 60% 60%, 70% 60%, 70% 40%, 80% 40%, 80% 80%, 90% 80%, 90% 50%, 100% 50%, 100% 100%);
  z-index: 1;
}
.lw-city-lights {
  position: absolute;
  bottom: 0; left: 0; right: 0;
  height: 50%; /* Perfectly aligns with buildings */
  background-image: 
    radial-gradient(circle, #ffcc00 1px, transparent 2px),
    radial-gradient(circle, #ff9e3d 1px, transparent 2px);
  background-size: 15px 15px, 25px 25px;
  background-position: 4px 4px, 12px 10px;
  animation: lw-flicker 4s infinite alternate;
  z-index: 1;
  opacity: 0.8;
}
.lw-moon {
  position: absolute;
  top: 15px; right: 20px;
  width: 24px; height: 24px;
  background: #fffae0;
  border-radius: 50%;
  box-shadow: 0 0 12px #fffae0;
  z-index: 1;
}
.lw-window::before, .lw-window::after {
  content: '';
  position: absolute;
  background: #3a261f;
  z-index: 3;
}
.lw-window::before { top: 50%; left: 0; width: 100%; height: 6px; transform: translateY(-50%); }
.lw-window::after { left: 50%; top: 0; width: 6px; height: 100%; transform: translateX(-50%); }

.lw-led-sign {
  position: absolute;
  top: 36px; right: 30px;
  width: min(240px, 40%);
  background: #111;
  border: 4px solid #3a2e2a;
  padding: 10px 14px;
  border-radius: 6px;
  box-shadow: 0 0 20px rgba(255, 126, 0, 0.5), inset 0 0 10px rgba(0,0,0,0.9);
  color: #ff9e3d;
  text-shadow: 0 0 8px #ff9e3d, 0 0 15px #ff7e00, 0 0 25px #ff5500;
  font-weight: bold;
  font-size: clamp(12px, 2.5vw, 16px);
  letter-spacing: 1px;
  animation: lw-flicker 4s infinite alternate;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  text-align: center;
  z-index: 2;
}
@keyframes lw-flicker {
  0%, 19%, 21%, 23%, 25%, 54%, 56%, 100% { opacity: 1; filter: brightness(1.1); }
  20%, 24%, 55% { opacity: 0.6; filter: brightness(0.8); }
}

/* Retro CRT TV */
.lw-tv-container {
  position: relative;
  width: min(100%, 360px);
  margin-top: clamp(180px, 32vh, 260px);
  margin-bottom: 20px;
  z-index: 2;
}
.lw-tv {
  background: #e8e1d3;
  border-radius: 20px 20px 8px 8px;
  padding: 18px;
  padding-bottom: 40px;
  box-shadow: 
    0 15px 30px rgba(0,0,0,0.6), 
    inset 0 2px 4px rgba(255,255,255,0.6), 
    inset 0 -4px 8px rgba(0,0,0,0.1);
  position: relative;
  width: 100%;
  max-width: none;
}
.lw-tv::before { /* Vents */
  content: '';
  position: absolute;
  top: 10px; left: 50%;
  transform: translateX(-50%);
  width: 50%; height: 5px;
  background: repeating-linear-gradient(90deg, #888 0px, #888 2px, #666 2px, #666 4px);
  border-radius: 2px;
}
.lw-tv::after { /* Brand */
  content: 'LumiVision';
  position: absolute;
  bottom: 14px; left: 50%;
  transform: translateX(-50%);
  font-size: 11px;
  font-weight: bold;
  color: #888;
  letter-spacing: 2px;
  font-family: sans-serif;
}
.lw-tv-knob {
  position: absolute;
  right: -12px; bottom: 24px;
  width: 18px; height: 18px;
  background: radial-gradient(#888, #333);
  border-radius: 50%;
  border: 2px solid #222;
  box-shadow: 1px 1px 3px rgba(0,0,0,0.8);
}
.lw-tv-knob:nth-child(2) { bottom: 48px; }

.lw-tv-antenna {
  position: absolute;
  top: -80px; left: 50%;
  width: 4px; height: 80px;
  background: #8b7765;
  transform-origin: bottom center;
  z-index: 0;
  border-radius: 2px;
}
.lw-tv-antenna.lw-left { transform: translateX(-20px) rotate(-35deg); }
.lw-tv-antenna.lw-right { transform: translateX(20px) rotate(35deg); }

.lw-tv-screen {
  background: #000;
  border: 6px solid #2a2a2a;
  border-radius: 20px / 15px;
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
.lw-tv-content {
  position: absolute;
  inset: 0;
  padding: 16px;
  display: flex;
  flex-direction: column;
  color: #ff9e3d;
  text-shadow: 0 0 5px #ff5500;
  font-family: 'Courier New', monospace;
  font-size: 12px;
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
.lw-tv-row:hover { background: rgba(255, 158, 61, 0.1); }
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

.lw-plant {
  position: absolute;
  bottom: 130px; left: 40px;
  width: 50px; height: 70px;
  z-index: 2;
}
.lw-pot {
  width: 100%; height: 40px;
  background: linear-gradient(to right, #8b4513, #a0522d, #8b4513);
  border-radius: 5px 5px 15px 15px;
  position: absolute;
  bottom: 0;
  box-shadow: 2px 2px 5px rgba(0,0,0,0.5);
}
.lw-leaf {
  position: absolute;
  bottom: 35px;
  width: 15px; height: 40px;
  background: #2e8b57;
  border-radius: 50% 50% 0 0;
  transform-origin: bottom center;
}
.lw-leaf:nth-child(1) { left: 10px; transform: rotate(-20deg); }
.lw-leaf:nth-child(2) { left: 22px; transform: rotate(0deg); height: 45px; }
.lw-leaf:nth-child(3) { left: 34px; transform: rotate(20deg); }

/* Settings Panels (Paper Notes) */
.lw-poster {
  background: #fff;
  color: #111;
  width: min(100%, 420px);
  padding: 12px 16px;
  font-size: clamp(14px, 4vw, 18px);
  font-weight: 900;
  text-transform: uppercase;
  letter-spacing: 1.2px;
  text-align: center;
  box-shadow: 3px 5px 15px rgba(0,0,0,0.6);
  transform: rotate(-2deg);
  margin-top: 4px;
  border: 4px solid #111;
  z-index: 2;
}
.lw-poster.lw-alt { transform: rotate(2deg); background: #ff9e3d; }

.lw-paper {
  width: min(100%, 420px);
  max-width: 420px;
  background-color: #fefae0;
  background-image: linear-gradient(#e6dcc3 1px, transparent 1px);
  background-size: 100% 20px;
  color: #2b201d;
  border-radius: 2px;
  padding: 20px;
  box-shadow: 3px 5px 15px rgba(0,0,0,0.6);
  position: relative;
  transform: rotate(-1deg);
  transition: transform 0.3s;
  z-index: 2;
}
.lw-paper:nth-child(even) { transform: rotate(1deg); background-color: #e0d8c8; }
.lw-paper:nth-child(3n) { transform: rotate(-0.5deg); background-color: #f5f5dc; }
.lw-paper:hover { transform: rotate(0deg) scale(1.01); z-index: 10; }
.lw-paper::before {
  content: '';
  position: absolute;
  top: -10px; left: 50%;
  width: 60px; height: 18px;
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
  margin-bottom: 8px;
  border-bottom: 2px dashed #8b7765;
  padding-bottom: 5px;
  flex-wrap: wrap;
}
.lw-panel-head h3 { margin: 0; font-size: 13px; font-weight: 700; letter-spacing: 0.5px; text-transform: uppercase; text-shadow: 1px 1px 0px rgba(0,0,0,0.1); }

.lw-form { display: grid; gap: 7px; }
.lw-field { display: grid; gap: 3px; min-width: 0; }
.lw-field label, .lw-toggle-label { font-size: 11px; font-weight: 700; color: #2b201d; text-transform: uppercase; letter-spacing: 0.5px; }
.lw-hint { color: #6b5d4f; font-size: 10.5px; font-style: italic; overflow-wrap: anywhere; }
.lw-control-slot {
  width: 100%;
  min-width: 0;
  max-width: 100%;
}
.lw-control-slot,
.lw-control-slot * {
  box-sizing: border-box;
}
.lw-control-slot > *,
.lw-control-slot input,
.lw-control-slot button,
.lw-control-slot [role="combobox"] {
  max-width: 100%;
  min-width: 0;
}

.lw-input, .lw-select, .lw-textarea {
  width: 100%;
  border: 1px solid #8b7765;
  border-radius: 0;
  background: #fff;
  color: #2b201d;
  font: inherit;
  padding: 6px 8px;
  box-shadow: inset 1px 1px 4px rgba(0,0,0,0.1);
  min-width: 0;
}
.lw-input:focus, .lw-select:focus, .lw-textarea:focus { outline: 2px solid #ff7e00; outline-offset: -1px; }
.lw-textarea {
  resize: vertical;
  min-height: 76px;
  line-height: 1.3;
  font-family: 'Courier New', Courier, monospace;
  font-size: 10.5px;
}

.lw-two { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; align-items: end; }

.lw-setting-row {
  display: flex;
  gap: 8px;
  align-items: flex-start;
  padding: 4px 0;
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
  padding: 10px 12px;
  background: #ff9e3d;
  color: #111;
  font-weight: bold;
  box-shadow: 3px 4px 0px rgba(0,0,0,0.4);
  margin-bottom: 10px;
  font-size: 11.5px;
  overflow-wrap: anywhere;
  width: min(100%, 420px);
  max-width: 420px;
  text-align: center;
}
.lw-banner.info { background: #d8aa63; color: #111; }
.lw-banner.success { background: #8fbd88; color: #102610; }
.lw-banner.warn { background: #d8aa63; }
.lw-banner.error { background: #cf7e7e; color: #fff; }

.lw-details {
  border: 1px solid #8b7765;
  border-radius: 2px;
  background: #e6dcc3;
  padding: 0;
  box-shadow: 2px 3px 0px rgba(0,0,0,0.3);
}
.lw-details summary { cursor: pointer; padding: 10px 12px; font-weight: 700; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; }
.lw-details-body { padding: 0 12px 12px; display: grid; gap: 10px; }

.lw-divider {
  border: 0;
  border-top: 2px dashed #8b7765;
  margin: 4px 0;
  width: 100%;
}
.lw-form-subhead {
  font-weight: 800;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-top: 2px;
}

/* Retro Digital Clock */
.lw-clock {
  display: grid;
  gap: 7px;
  padding: 12px;
  border: 2px solid #111;
  border-radius: 4px;
  background: #111;
  color: #ff5500;
  box-shadow: inset 0 0 30px rgba(0,0,0,0.9), 0 5px 10px rgba(0,0,0,0.5);
  text-align: center;
  min-width: 0;
  width: min(100%, 420px);
  max-width: 420px;
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

.lw-meter-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 6px; }
.lw-state-card {
  border: 1px solid #8b7765;
  border-radius: 2px;
  background: #fff;
  padding: 7px;
  min-height: 42px;
  display: grid;
  align-content: start;
  gap: 4px;
  box-shadow: 2px 2px 0px rgba(0,0,0,0.1);
}
.lw-state-label { color: #6b5d4f; font-size: 9px; text-transform: uppercase; letter-spacing: 0.5px; font-weight: bold; }
.lw-state-value { overflow-wrap: anywhere; font-size: 11px; }

.lw-schedule-strip {
  display: flex;
  gap: 6px;
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

.lw-runs { display: grid; gap: 6px; }
.lw-scrollbox {
  max-height: 150px;
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
  padding: 6px 9px;
  font: inherit;
  font-weight: bold;
  cursor: pointer;
  min-height: 28px;
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

/* Desk Decorations (Panel 1) */
.lw-desk-decor {
  position: absolute;
  bottom: 130px; left: 0;
  width: 100%;
  height: 80px;
  z-index: 1;
  pointer-events: none;
  display: flex;
  justify-content: space-between;
  padding: 0 15%;
  box-sizing: border-box;
}
.lw-mug {
  position: relative;
  bottom: 0; left: 0;
  width: 36px; height: 42px;
  background: #eee;
  border-radius: 5px 5px 15px 15px;
  box-shadow: 2px 2px 5px rgba(0,0,0,0.5);
}
.lw-mug::after { /* Handle */
  content: '';
  position: absolute;
  right: -12px; top: 10px;
  width: 14px; height: 18px;
  border: 3px solid #eee;
  border-left: none;
  border-radius: 0 10px 10px 0;
}
.lw-mug::before { /* Coffee */
  content: '';
  position: absolute;
  top: 5px; left: 5px; right: 5px;
  height: 7px;
  background: #4a2e24;
  border-radius: 2px;
}
.lw-steam {
  position: absolute;
  top: -20px; left: 12px;
  width: 5px; height: 25px;
  background: rgba(255,255,255,0.15);
  filter: blur(3px);
  animation: lw-steam 3s infinite ease-in;
}
.lw-steam2 { left: 22px; animation-delay: 1s; }
@keyframes lw-steam {
  0% { transform: translateY(0) scale(1); opacity: 0.5; }
  100% { transform: translateY(-20px) scale(1.5); opacity: 0; }
}
.lw-lamp {
  position: relative;
  bottom: 0; right: 0;
  width: 60px; height: 80px;
}
.lw-lamp-base { width: 40px; height: 8px; background: #333; position: absolute; bottom: 0; left: 10px; border-radius: 2px; }
.lw-lamp-arm { width: 4px; height: 50px; background: #444; position: absolute; bottom: 8px; left: 28px; transform: rotate(15deg); transform-origin: bottom center; }
.lw-lamp-head { width: 36px; height: 20px; background: #555; border-radius: 18px 18px 2px 2px; position: absolute; bottom: 52px; left: 12px; transform: rotate(15deg); box-shadow: 1px 1px 3px rgba(0,0,0,0.5); }
.lw-lamp-glow {
  position: absolute;
  bottom: 30px; left: -30px;
  width: 140px; height: 140px;
  background: radial-gradient(circle, rgba(255, 200, 100, 0.15), transparent 70%);
  pointer-events: none;
}

/* Bed Decorations (Panel 2) */
.lw-bed {
  position: absolute;
  bottom: 130px; right: 20px;
  width: 260px; height: 110px;
  background: #6b5d4f;
  border-radius: 20px 20px 0 0;
  box-shadow: 0 -5px 15px rgba(0,0,0,0.3);
  z-index: 1;
  opacity: 0.82;
}
.lw-pillow {
  position: absolute;
  top: -20px; left: 30px;
  width: 60px; height: 30px;
  background: #ddd;
  border-radius: 12px;
  box-shadow: 2px 2px 5px rgba(0,0,0,0.3);
}
.lw-blanket {
  position: absolute;
  bottom: 0; left: 0;
  width: 100%; height: 70px;
  background: #8b4513;
  border-radius: 20px 20px 0 0;
}

/* Bookshelf Decorations (Panel 3) */
.lw-shelf {
  position: absolute;
  bottom: 130px; right: 40px;
  width: 100px; height: 140px;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  gap: 6px;
  z-index: 1;
}
.lw-shelf-board {
  height: 6px;
  background: #5a3a2e;
  box-shadow: 0 2px 4px rgba(0,0,0,0.3);
}
.lw-shelf-book {
  width: 100%;
  height: 40px;
  display: flex;
  gap: 4px;
  align-items: flex-end;
}
.lw-book {
  width: 10px;
  background: #cc7e00;
  border-radius: 2px 2px 0 0;
}
.lw-book:nth-child(2) { height: 35px; background: #6fb7a6; }
.lw-book:nth-child(3) { height: 45px; background: #cf7e7e; }
.lw-book:nth-child(4) { height: 30px; background: #d8aa63; }
.lw-book:nth-child(5) { height: 40px; background: #fff; }

@media (max-width: 360px) {
  .lw-panel { padding: 20px 30px 160px; gap: 14px; }
  .lw-nav-left { left: 4px; }
  .lw-nav-right { right: 4px; }
  .lw-window { top: 20px; left: 20px; width: 140px; height: 100px; border-width: 6px; }
  .lw-led-sign {
    top: 24px; right: 20px;
    width: min(160px, 35%);
    font-size: 12px;
    padding: 8px 10px;
  }
  .lw-tv-container { width: min(100%, 280px); margin-top: 180px; margin-bottom: 20px; }
  .lw-tv { padding: 14px; padding-bottom: 34px; border-radius: 16px 16px 8px 8px; }
  .lw-tv-content { padding: 12px; font-size: 11px; }
  .lw-tv-row { grid-template-columns: 34px 1fr; gap: 2px 5px; padding: 3px 4px; }
  .lw-tv-status { grid-column: 2; justify-self: start; font-size: 8px; }
  .lw-two { grid-template-columns: 1fr; }
  .lw-clock-actions { grid-template-columns: 1fr; }
  .lw-meter-grid { grid-template-columns: 1fr; }
  .lw-poster, .lw-paper, .lw-banner, .lw-clock { max-width: 100%; width: 100%; }
  .lw-bed { width: 200px; height: 90px; right: 0; }
  .lw-desk-decor { padding: 0 5%; }
}

.lw-float-root {
  width: 260px;
  min-height: 352px;
  color: #2b201d;
  font-family: 'Courier New', Courier, monospace;
  font-size: 11px;
  line-height: 1.35;
  position: relative;
  padding-top: 44px;
  user-select: none;
}
.lw-float-root * { box-sizing: border-box; }
.lw-monitor {
  width: 220px;
  margin: 0 auto;
  padding: 14px 14px 32px;
  border-radius: 20px 20px 10px 10px;
  background: linear-gradient(145deg, #efe6d1, #c8baa0);
  border: 5px solid #8b7765;
  outline: 2px solid #3a261f;
  box-shadow: 0 14px 24px rgba(0,0,0,0.45), inset 0 0 0 2px rgba(255,255,255,0.28), inset 0 2px 4px rgba(255,255,255,0.75), inset 0 -5px 10px rgba(0,0,0,0.16);
  position: relative;
}
.lw-monitor-antenna {
  position: absolute;
  top: -48px;
  left: 50%;
  width: 4px;
  height: 58px;
  border-radius: 999px;
  background: linear-gradient(to bottom, #b9ab92, #756653);
  box-shadow: 0 0 2px rgba(0,0,0,0.65);
  transform-origin: bottom center;
  z-index: -1;
}
.lw-monitor-antenna.left { transform: translateX(-18px) rotate(-34deg); }
.lw-monitor-antenna.right { transform: translateX(18px) rotate(34deg); }
.lw-monitor::before {
  content: '';
  position: absolute;
  top: 8px;
  left: 50%;
  width: 92px;
  height: 5px;
  transform: translateX(-50%);
  border-radius: 999px;
  background: repeating-linear-gradient(90deg, #8f887a 0 3px, #665e54 3px 6px);
}
.lw-monitor::after {
  content: 'LumiVision';
  position: absolute;
  bottom: 10px;
  left: 50%;
  transform: translateX(-50%);
  color: #81796f;
  font-family: Arial, sans-serif;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 1.6px;
}
.lw-monitor-screen {
  aspect-ratio: 4 / 3;
  border: 7px solid #211f1d;
  border-radius: 18px / 14px;
  background: radial-gradient(circle at 55% 40%, rgba(255,126,0,0.16), transparent 42%), #080807;
  color: #ff9e3d;
  padding: 10px;
  box-shadow: inset 0 0 28px rgba(0,0,0,0.95), inset 0 0 10px rgba(255,158,61,0.1);
  overflow: hidden;
  position: relative;
  text-shadow: 0 0 5px #ff5500;
}
.lw-monitor-screen::after {
  content: '';
  position: absolute;
  inset: 0;
  pointer-events: none;
  background: linear-gradient(rgba(255,255,255,0.035) 50%, rgba(0,0,0,0.2) 50%);
  background-size: 100% 4px;
}
.lw-monitor-head {
  display: flex;
  justify-content: space-between;
  gap: 6px;
  border-bottom: 1px solid #ff7e00;
  padding-bottom: 4px;
  margin-bottom: 6px;
  font-size: 10px;
  font-weight: 700;
}
.lw-monitor-channel {
  display: grid;
  grid-template-columns: 32px 1fr auto;
  align-items: center;
  gap: 5px;
  padding: 4px 5px;
  border: 1px solid transparent;
  cursor: pointer;
  position: relative;
  z-index: 1;
}
.lw-monitor-channel:hover { background: rgba(255, 158, 61, 0.12); }
.lw-monitor-channel.is-active {
  background: #ff9e3d;
  color: #080807;
  text-shadow: none;
  box-shadow: 0 0 10px rgba(255,126,0,0.4);
}
.lw-monitor-channel span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.lw-monitor-status { font-size: 8px; text-transform: uppercase; }
.lw-monitor-actions {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  margin-top: auto;
  padding-top: 7px;
  position: relative;
  z-index: 1;
}
.lw-monitor-action {
  appearance: none;
  border: 0;
  background: transparent;
  color: #ff9e3d;
  padding: 0;
  font: inherit;
  font-size: 9px;
  font-weight: 800;
  line-height: 1;
  text-transform: uppercase;
  text-shadow: 0 0 5px #ff5500;
  cursor: pointer;
}
.lw-monitor-action:hover {
  color: #ffd08a;
  text-decoration: underline;
}
.lw-monitor-knob {
  position: absolute;
  right: -10px;
  width: 17px;
  height: 17px;
  border-radius: 50%;
  border: 2px solid #24211f;
  background: radial-gradient(circle at 35% 30%, #aaa, #333);
  box-shadow: 1px 2px 4px rgba(0,0,0,0.55);
}
.lw-monitor-knob.one { bottom: 24px; }
.lw-monitor-knob.two { bottom: 48px; }
.lw-widget-note {
  width: 232px;
  margin: 6px auto 0;
  padding: 12px 14px 14px;
  background: #fff6c9;
  background-image: linear-gradient(#eadfae 1px, transparent 1px);
  background-size: 100% 20px;
  color: #352924;
  box-shadow: 0 10px 18px rgba(0,0,0,0.32);
  transform: rotate(-1deg);
  position: relative;
}
.lw-widget-note::before {
  content: '';
  position: absolute;
  top: -7px;
  left: 50%;
  width: 56px;
  height: 15px;
  transform: translateX(-50%) rotate(2deg);
  background: rgba(255,255,255,0.45);
  border: 1px dashed rgba(0,0,0,0.12);
}
.lw-note-head {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  align-items: center;
  margin-bottom: 6px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}
.lw-note-lines {
  display: grid;
  gap: 3px;
  min-height: 54px;
}
.lw-note-line {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.lw-save-dot {
  color: #6b5d4f;
  font-size: 9px;
  text-transform: uppercase;
}
.lw-save-dot.is-saving { color: #9a6100; }
.lw-save-dot.is-error { color: #9a1c1c; }

/* =========================================
   SUPER DETAILED ANIMATED SETTINGS MODAL
   (Transforms into a CRT TV broadcasting 
   different anime "channels" based on tab)
   ========================================= */
.lw-settings-modal {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  grid-template-rows: 38px minmax(0, 1fr);
  gap: 10px 12px;
  align-items: start;
  color: #e0d6c8;
  font-family: 'Courier New', Courier, monospace;
  font-size: 11.5px;
  padding: 18px;
  box-sizing: border-box;
  width: 1600px;
  height: 1184px;
  min-width: 1600px;
  min-height: 1184px;
  max-width: 1600px;
  max-height: 1184px;
  background: #050505;
  position: relative;
  overflow: hidden;
  border: 24px solid #1a1a1a;
  border-radius: 40px / 30px;
  box-shadow: 0 0 0 4px #333, 0 20px 50px rgba(0,0,0,0.8), inset 0 0 100px rgba(0,0,0,0.8);
  
  /* Hide default scrollbar but allow scroll */
  scrollbar-width: thin;
  scrollbar-color: #ff7e00 transparent;
}
.lw-settings-modal::-webkit-scrollbar { width: 6px; background: transparent; }
.lw-settings-modal::-webkit-scrollbar-thumb { background: #ff7e00; border-radius: 0; }

/* CRT Scanlines and Glare Overlay for the Modal TV */
.lw-settings-modal::after {
  content: '';
  position: absolute;
  inset: 0;
  background: 
    linear-gradient(rgba(255,255,255,0.025) 50%, rgba(0,0,0,0.15) 50%);
  background-size: 100% 4px;
  pointer-events: none;
  z-index: 30;
  opacity: 0.8;
}

/* Channel 1: Director Note (Evangelion / NERV HQ Aesthetic) */
.lw-settings-modal.is-channel-1 {
  background-color: #1a0a0a;
  background-image: 
    linear-gradient(rgba(255, 153, 51, 0.03) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255, 153, 51, 0.03) 1px, transparent 1px);
  background-size: 20px 20px;
  animation: none;
  border: 24px solid #1a1a1a !important;
  border-radius: 40px / 30px !important;
  box-shadow: 0 0 0 4px #333, 0 20px 50px rgba(0,0,0,0.8), inset 0 0 100px rgba(0,0,0,0.8) !important;
}

/* Rotating Targeting Reticle in Background */
.lw-settings-modal.is-channel-1::before {
  content: '';
  position: absolute;
  top: 50%; left: 50%;
  width: 150vmax; height: 150vmax;
  background: 
    conic-gradient(from 0deg, transparent 0%, rgba(255, 153, 51, 0.05) 10%, transparent 20%),
    repeating-conic-gradient(rgba(255, 204, 0, 0.02) 0deg 10deg, transparent 10deg 20deg);
  transform: translate(-50%, -50%);
  animation: lw-eva-rotate 30s linear infinite;
  z-index: 0;
  pointer-events: none;
}

@keyframes lw-eva-rotate {
  from { transform: translate(-50%, -50%) rotate(0deg); }
  to { transform: translate(-50%, -50%) rotate(360deg); }
}

@keyframes lw-eva-bg-pulse {
  0% { box-shadow: inset 0 0 50px rgba(255, 51, 51, 0.1); }
  100% { box-shadow: inset 0 0 100px rgba(255, 51, 51, 0.3); }
}

/* Channel 2: World Agent (Spirited Away / Ghibli Aesthetic) */
.lw-settings-modal.is-channel-2 {
  background-color: #87ceeb;
  background-image: linear-gradient(to bottom, #87ceeb 0%, #e0f7fa 60%, #f0f8ff 100%);
  animation: none;
}
.lw-settings-modal.is-channel-2::before {
  content: '';
  position: absolute;
  inset: 0;
  background-image: 
    radial-gradient(circle at 10% 20%, #222 2px, transparent 3px),
    radial-gradient(circle at 80% 40%, #222 3px, transparent 4px),
    radial-gradient(circle at 30% 70%, #222 2px, transparent 3px),
    radial-gradient(circle at 60% 80%, #222 4px, transparent 5px),
    radial-gradient(circle at 90% 10%, #222 2px, transparent 3px),
    radial-gradient(circle at 50% 50%, #222 1px, transparent 2px);
  background-size: 200px 200px, 300px 300px, 250px 250px, 400px 400px, 150px 150px, 100px 100px;
  animation: lw-ghibli-spirits 20s linear infinite;
  z-index: 0;
  pointer-events: none;
  opacity: 0.6;
}

@keyframes lw-ghibli-spirits {
  0% { background-position: 0 0, 0 0, 0 0, 0 0, 0 0, 0 0; }
  100% { background-position: 50px -200px, -80px 150px, 100px -100px, -50px -250px, 70px 300px, -30px -150px; }
}

/* Modal TV Channel Tabs (Remote Control Buttons) */
.lw-settings-modal .lw-modal-tabs {
  display: flex;
  gap: 12px;
  position: relative;
  grid-column: 1;
  grid-row: 1;
  align-self: start;
  z-index: 20;
  padding-bottom: 8px;
  border-bottom: 2px solid #333;
  margin-bottom: 0;
}

.lw-settings-modal.is-channel-1 .lw-modal-tab {
  appearance: none;
  border: 1px solid #ff9933;
  background: #000;
  color: #ff9933;
  font-family: 'Courier New', monospace;
  font-weight: 800;
  font-size: 12px;
  min-height: 34px;
  cursor: pointer;
  text-transform: uppercase;
  padding: 0 24px;
  transition: all 0.2s;
  clip-path: polygon(10px 0, 100% 0, calc(100% - 10px) 100%, 0 100%);
  box-shadow: 0 0 10px rgba(255, 153, 51, 0.2);
  letter-spacing: 1px;
}
.lw-settings-modal.is-channel-1 .lw-modal-tab:hover {
  background: #ff9933;
  color: #000;
  box-shadow: 0 0 15px #ff9933;
}
.lw-settings-modal.is-channel-1 .lw-modal-tab.is-active {
  background: #ffcc00;
  color: #000;
  border-color: #ffcc00;
  box-shadow: 0 0 20px #ffcc00;
}

.lw-settings-modal.is-channel-2 .lw-modal-tab {
  appearance: none;
  border: 2px solid #8b4513;
  background: #fffacd;
  color: #8b4513;
  font-family: Georgia, serif;
  font-weight: 800;
  font-size: 12px;
  min-height: 34px;
  cursor: pointer;
  text-transform: uppercase;
  padding: 0 24px;
  transition: all 0.2s;
  border-radius: 8px;
  box-shadow: 2px 2px 4px rgba(0,0,0,0.1);
}
.lw-settings-modal.is-channel-2 .lw-modal-tab:hover {
  background: #8b4513;
  color: #fffacd;
}
.lw-settings-modal.is-channel-2 .lw-modal-tab.is-active {
  background: #d4af37;
  color: #fff;
  border-color: #d4af37;
  box-shadow: 0 0 10px #d4af37;
}

/* Modal Actions (Refresh/Test) */
.lw-settings-modal .lw-modal-actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
  flex-wrap: wrap;
  position: relative;
  grid-column: 2;
  grid-row: 1;
  align-self: start;
  z-index: 20;
}

.lw-settings-modal .lw-modal-grid {
  display: grid;
  grid-column: 1 / -1;
  grid-row: 2;
  gap: 10px;
  align-items: stretch;
  min-height: 0;
  height: 100%;
  overflow: hidden;
  position: relative;
  z-index: 20;
}
.lw-settings-modal > .lw-banner,
.lw-settings-modal > .lw-empty {
  grid-column: 1 / -1;
}
.lw-settings-modal > .lw-banner {
  position: absolute;
  top: 64px;
  left: 28px;
  right: 28px;
  width: auto;
  max-width: none;
  margin: 0;
  z-index: 40;
}

.lw-settings-modal.is-channel-1 .lw-modal-grid {
  grid-template-columns: 600px 380px 500px;
  grid-template-rows: 360px 300px 370px;
  justify-content: center;
  grid-template-areas:
    "core model context"
    "core notes system"
    "runs user user";
}
.lw-settings-modal.is-channel-1 .lw-director-core-note { grid-area: core; }
.lw-settings-modal.is-channel-1 .lw-director-model-note { grid-area: model; }
.lw-settings-modal.is-channel-1 .lw-director-context-note { grid-area: context; }
.lw-settings-modal.is-channel-1 .lw-director-notes-note { grid-area: notes; }
.lw-settings-modal.is-channel-1 .lw-director-system-note { grid-area: system; }
.lw-settings-modal.is-channel-1 .lw-director-user-note { grid-area: user; }
.lw-settings-modal.is-channel-1 .lw-runs-note { grid-area: runs; }

.lw-settings-modal.is-channel-2 .lw-modal-grid {
  grid-template-columns: 600px 390px 500px;
  grid-template-rows: 350px 310px 320px;
  justify-content: center;
  align-content: start;
  grid-template-areas:
    "state state state"
    "clock params schedule"
    "config params schedule";
}
.lw-settings-modal.is-channel-2 .lw-world-clock-note { grid-area: clock; }
.lw-settings-modal.is-channel-2 .lw-world-config-note { grid-area: config; }
.lw-settings-modal.is-channel-2 .lw-world-params-note { grid-area: params; }
.lw-settings-modal.is-channel-2 .lw-world-state-note { grid-area: state; }
.lw-settings-modal.is-channel-2 .lw-world-schedule-note { grid-area: schedule; }

.lw-settings-modal .lw-modal-grid > .lw-paper,
.lw-settings-modal .lw-modal-grid > .lw-clock {
  width: 100%;
  max-width: 100%;
  min-width: 0;
  height: 100%;
  max-height: 100%;
  box-sizing: border-box;
}

.lw-settings-modal .lw-paper:focus-within,
.lw-settings-modal .lw-clock:focus-within {
  z-index: 100 !important;
}

/* --- OVERRIDING LOFI PAPER TO MATCH TV SHOWS --- */

/* Channel 1: NERV Terminal Panels */
.lw-settings-modal.is-channel-1 .lw-paper,
.lw-settings-modal.is-channel-1 .lw-clock,
.lw-settings-modal.is-channel-1 .lw-banner {
  width: 100%;
  max-width: none;
  background: #0a0a0a !important;
  background-image: none !important;
  color: #ffcc00 !important;
  border: 2px solid #ff9933 !important;
  border-radius: 0 !important;
  box-shadow: 0 0 15px rgba(255, 153, 51, 0.2), inset 0 0 10px rgba(0,0,0,0.8) !important;
  transform: none !important;
  clip-path: polygon(0 0, 100% 0, 100% calc(100% - 15px), calc(100% - 15px) 100%, 0 100%);
  text-shadow: 0 0 5px #ff9933;
  backdrop-filter: blur(2px);
  min-height: 0;
  padding: 14px !important;
}
.lw-settings-modal.is-channel-1 .lw-paper:hover {
  border-color: #ffcc00 !important;
  box-shadow: 0 0 25px rgba(255, 204, 0, 0.4), inset 0 0 10px rgba(0,0,0,0.8) !important;
}

.lw-settings-modal.is-channel-1 .lw-paper::before,
.lw-settings-modal.is-channel-1 .lw-paper::after { display: none; }

.lw-settings-modal.is-channel-1 .lw-panel-head {
  border-bottom: 1px solid #ff9933 !important;
}
.lw-settings-modal.is-channel-1 .lw-panel-head h3 {
  color: #ffcc00 !important;
  text-shadow: 0 0 5px #ff9933 !important;
  font-family: 'Courier New', monospace !important;
}

.lw-settings-modal.is-channel-1 .lw-field label,
.lw-settings-modal.is-channel-1 .lw-toggle-label {
  color: #ff9933 !important;
  text-shadow: 0 0 2px #ff9933 !important;
}
.lw-settings-modal.is-channel-1 .lw-hint {
  color: #aa6600 !important;
}

.lw-settings-modal.is-channel-1 .lw-input,
.lw-settings-modal.is-channel-1 .lw-select,
.lw-settings-modal.is-channel-1 .lw-textarea {
  background: #000 !important;
  color: #ffcc00 !important;
  border: 1px solid #ff9933 !important;
  border-radius: 0 !important;
  box-shadow: inset 0 0 5px rgba(255, 153, 51, 0.2) !important;
}
.lw-settings-modal.is-channel-1 .lw-input:focus,
.lw-settings-modal.is-channel-1 .lw-select:focus,
.lw-settings-modal.is-channel-1 .lw-textarea:focus {
  border-color: #ffcc00 !important;
  box-shadow: 0 0 10px rgba(255, 204, 0, 0.5) !important;
}

.lw-settings-modal.is-channel-1 .lw-setting-row {
  border-bottom: 1px dashed rgba(255, 153, 51, 0.3) !important;
}

.lw-settings-modal.is-channel-1 .lw-chip-compact {
  border: 1px solid #ff9933 !important;
  background: #000 !important;
  color: #ffcc00 !important;
  border-radius: 0 !important;
  clip-path: polygon(5px 0, 100% 0, calc(100% - 5px) 100%, 0 100%);
}

.lw-settings-modal.is-channel-1 .lw-banner {
  border: 1px solid #ff003c !important;
  background: rgba(255, 0, 60, 0.2) !important;
  color: #ff003c !important;
  text-shadow: 0 0 5px #ff003c !important;
  clip-path: polygon(10px 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%, 0 10px);
}
.lw-settings-modal.is-channel-1 .lw-banner.info,
.lw-settings-modal.is-channel-1 .lw-banner.warn {
  border-color: #ffcc00 !important;
  background: rgba(255, 204, 0, 0.16) !important;
  color: #ffcc00 !important;
  text-shadow: 0 0 5px #ffcc00 !important;
}
.lw-settings-modal.is-channel-1 .lw-banner.success {
  border-color: #55ff77 !important;
  background: rgba(85, 255, 119, 0.14) !important;
  color: #55ff77 !important;
  text-shadow: 0 0 5px #55ff77 !important;
}
.lw-settings-modal.is-channel-1 .lw-banner.error {
  border-color: #ff003c !important;
  background: rgba(255, 0, 60, 0.2) !important;
  color: #ff003c !important;
  text-shadow: 0 0 5px #ff003c !important;
}

.lw-settings-modal.is-channel-1 .lw-details {
  border: 1px solid #ff9933 !important;
  background: #000 !important;
  box-shadow: none !important;
}
.lw-settings-modal.is-channel-1 .lw-details summary { color: #ffcc00 !important; }

.lw-settings-modal.is-channel-1 .lw-divider {
  border-top: 1px dashed #ff9933 !important;
}

.lw-settings-modal.is-channel-1 .lw-clock-top { border-bottom: 2px solid #ff003c !important; }
.lw-settings-modal.is-channel-1 .lw-clock-time { color: #ff003c !important; text-shadow: 0 0 10px #ff003c !important; }
.lw-settings-modal.is-channel-1 .lw-clock-status { color: #ffcc00 !important; }

.lw-settings-modal.is-channel-1 .lw-state-card {
  border: 1px solid #ff9933 !important;
  background: #000 !important;
  border-radius: 0 !important;
  box-shadow: inset 0 0 5px rgba(255, 153, 51, 0.2) !important;
}
.lw-settings-modal.is-channel-1 .lw-state-label { color: #ff9933 !important; }
.lw-settings-modal.is-channel-1 .lw-state-value { color: #ffcc00 !important; }

.lw-settings-modal.is-channel-1 .lw-slot {
  border: 1px solid #ff9933 !important;
  background: #000 !important;
  border-radius: 0 !important;
  box-shadow: inset 0 0 5px rgba(255, 153, 51, 0.2) !important;
}
.lw-settings-modal.is-channel-1 .lw-slot.is-now {
  border-color: #ff003c !important;
  box-shadow: 0 0 10px #ff003c, inset 0 0 5px rgba(255, 0, 60, 0.2) !important;
}

.lw-settings-modal.is-channel-1 .lw-run {
  border: 1px solid #ff9933 !important;
  background: #000 !important;
  border-radius: 0 !important;
  box-shadow: inset 0 0 5px rgba(255, 153, 51, 0.2) !important;
}

.lw-settings-modal.is-channel-1 .lw-empty {
  color: #ff9933 !important;
  border: 1px dashed #ff9933 !important;
  background: rgba(0,0,0,0.5) !important;
}

.lw-settings-modal.is-channel-1 .lw-btn {
  background: #000 !important;
  color: #ffcc00 !important;
  border: 1px solid #ffcc00 !important;
  border-radius: 0 !important;
  box-shadow: 0 0 10px rgba(255, 204, 0, 0.2) !important;
  text-shadow: 0 0 5px #ffcc00 !important;
  clip-path: polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px);
}
.lw-settings-modal.is-channel-1 .lw-btn:hover {
  background: #ffcc00 !important;
  color: #000 !important;
  box-shadow: 0 0 15px #ffcc00 !important;
  text-shadow: none !important;
}
.lw-settings-modal.is-channel-1 .lw-btn-primary {
  border-color: #ff003c !important;
  color: #ff003c !important;
  text-shadow: 0 0 5px #ff003c !important;
}
.lw-settings-modal.is-channel-1 .lw-btn-primary:hover {
  background: #ff003c !important;
  color: #000 !important;
  box-shadow: 0 0 15px #ff003c !important;
}
.lw-settings-modal.is-channel-1 .lw-btn-danger {
  border-color: #aa0000 !important;
  color: #aa0000 !important;
  text-shadow: none !important;
}

.lw-settings-modal.is-channel-1 .lw-template-note .lw-textarea {
  min-height: 208px;
}

.lw-settings-modal.is-channel-1 .lw-director-notes-note .lw-textarea {
  min-height: 208px;
}

.lw-settings-modal.is-channel-1 .lw-runs-note .lw-scrollbox {
  max-height: 280px;
}

.lw-settings-modal.is-channel-1 .lw-director-notes-note .lw-textarea,
.lw-settings-modal.is-channel-1 .lw-director-system-note .lw-textarea {
  height: 208px;
  min-height: 208px;
  max-height: 208px;
}

.lw-settings-modal.is-channel-1 .lw-director-user-note .lw-textarea {
  height: 300px;
  min-height: 300px;
  max-height: 300px;
}

/* Channel 2: Ghibli Spirit Scrolls */
.lw-settings-modal.is-channel-2 .lw-paper,
.lw-settings-modal.is-channel-2 .lw-clock,
.lw-settings-modal.is-channel-2 .lw-banner {
  width: 100%;
  max-width: none;
  background: rgba(255, 250, 205, 0.76) !important;
  background-image: linear-gradient(rgba(139, 69, 19, 0.08) 1px, transparent 1px) !important;
  background-size: 100% 24px !important;
  color: #5a3a2e !important;
  border: 2px solid #8b4513 !important;
  border-radius: 12px !important;
  box-shadow: 4px 4px 0px rgba(139, 69, 19, 0.18), 0 5px 15px rgba(0,0,0,0.1) !important;
  transform: none !important;
  clip-path: none !important;
  text-shadow: none !important;
  backdrop-filter: blur(1px) saturate(1.05);
  min-height: 0;
  overflow: hidden;
  padding: 14px !important;
}
.lw-settings-modal.is-channel-2 .lw-paper:hover {
  border-color: #d4af37 !important;
  box-shadow: 4px 4px 0px rgba(212, 175, 55, 0.3), 0 5px 20px rgba(0,0,0,0.15) !important;
}

.lw-settings-modal.is-channel-2 .lw-paper::before,
.lw-settings-modal.is-channel-2 .lw-paper::after { display: none; }

.lw-settings-modal.is-channel-2 .lw-panel-head {
  border-bottom: 2px dashed #8b4513 !important;
}
.lw-settings-modal.is-channel-2 .lw-panel-head h3 {
  color: #5a3a2e !important;
  text-shadow: 1px 1px 0px rgba(255,255,255,0.5) !important;
  font-family: Georgia, serif !important;
}

.lw-settings-modal.is-channel-2 .lw-field label,
.lw-settings-modal.is-channel-2 .lw-toggle-label {
  color: #8b4513 !important;
  text-shadow: none !important;
}
.lw-settings-modal.is-channel-2 .lw-hint {
  display: none !important;
  color: #8b8b00 !important;
}

.lw-settings-modal.is-channel-2 .lw-input,
.lw-settings-modal.is-channel-2 .lw-select,
.lw-settings-modal.is-channel-2 .lw-textarea {
  background: rgba(255, 255, 255, 0.8) !important;
  color: #5a3a2e !important;
  border: 2px solid #8b4513 !important;
  border-radius: 6px !important;
  box-shadow: inset 1px 1px 4px rgba(139, 69, 19, 0.1) !important;
  font-family: Georgia, serif !important;
}
.lw-settings-modal.is-channel-2 .lw-input:focus,
.lw-settings-modal.is-channel-2 .lw-select:focus,
.lw-settings-modal.is-channel-2 .lw-textarea:focus {
  border-color: #d4af37 !important;
  box-shadow: 0 0 8px rgba(212, 175, 55, 0.4) !important;
}

.lw-settings-modal.is-channel-2 .lw-setting-row {
  border-bottom: 1px dashed rgba(139, 69, 19, 0.2) !important;
}

.lw-settings-modal.is-channel-2 .lw-chip-compact {
  border: 2px solid #8b4513 !important;
  background: #fffacd !important;
  color: #5a3a2e !important;
  border-radius: 6px !important;
  clip-path: none !important;
  box-shadow: 1px 1px 2px rgba(0,0,0,0.1) !important;
}

.lw-settings-modal.is-channel-2 .lw-banner {
  border: 2px solid #d9534f !important;
  background: #f8d7da !important;
  color: #a94442 !important;
  text-shadow: none !important;
  border-radius: 8px !important;
}
.lw-settings-modal.is-channel-2 .lw-banner.info,
.lw-settings-modal.is-channel-2 .lw-banner.warn {
  border-color: #d4af37 !important;
  background: #fff3cd !important;
  color: #5a3a2e !important;
}
.lw-settings-modal.is-channel-2 .lw-banner.success {
  border-color: #4f8f52 !important;
  background: #dff0d8 !important;
  color: #2f5f31 !important;
}
.lw-settings-modal.is-channel-2 .lw-banner.error {
  border-color: #d9534f !important;
  background: #f8d7da !important;
  color: #a94442 !important;
}

.lw-settings-modal.is-channel-1 > .lw-banner,
.lw-settings-modal.is-channel-2 > .lw-banner {
  box-sizing: border-box !important;
  left: 28px !important;
  right: 28px !important;
  width: auto !important;
  max-width: none !important;
}

.lw-settings-modal.is-channel-2 .lw-details {
  border: 2px solid #8b4513 !important;
  background: #fffacd !important;
  border-radius: 8px !important;
  box-shadow: 2px 2px 4px rgba(0,0,0,0.1) !important;
}
.lw-settings-modal.is-channel-2 .lw-details summary { color: #8b4513 !important; }

.lw-settings-modal.is-channel-2 .lw-divider {
  border-top: 2px dashed #8b4513 !important;
}

.lw-settings-modal.is-channel-2 .lw-clock-top { border-bottom: 2px solid #d4af37 !important; }
.lw-settings-modal.is-channel-2 .lw-clock-time { color: #d4af37 !important; text-shadow: 0 0 5px #d4af37 !important; }
.lw-settings-modal.is-channel-2 .lw-clock-status { color: #8b4513 !important; }

.lw-settings-modal.is-channel-2 .lw-state-card {
  border: 2px solid #8b4513 !important;
  background: rgba(255, 255, 255, 0.48) !important;
  border-radius: 8px !important;
  box-shadow: 2px 2px 4px rgba(0,0,0,0.1) !important;
}
.lw-settings-modal.is-channel-2 .lw-state-label { color: #8b4513 !important; }
.lw-settings-modal.is-channel-2 .lw-state-value { color: #5a3a2e !important; }

.lw-settings-modal.is-channel-2 .lw-slot {
  border: 2px solid #8b4513 !important;
  background: #fffacd !important;
  border-radius: 8px !important;
  box-shadow: 3px 3px 0px rgba(139, 69, 19, 0.2) !important;
}
.lw-settings-modal.is-channel-2 .lw-slot.is-now {
  border-color: #d4af37 !important;
  box-shadow: 3px 3px 0px #d4af37 !important;
  background: #fff8dc !important;
}

.lw-settings-modal.is-channel-2 .lw-run {
  border: 2px solid #8b4513 !important;
  background: rgba(255, 250, 205, 0.72) !important;
  border-radius: 8px !important;
  box-shadow: 2px 2px 4px rgba(0,0,0,0.1) !important;
}

.lw-settings-modal.is-channel-2 .lw-empty {
  color: #8b4513 !important;
  border: 2px dashed #8b4513 !important;
  background: rgba(255, 250, 205, 0.46) !important;
}

.lw-settings-modal.is-channel-2 .lw-btn {
  background: linear-gradient(to bottom, #d4af37, #aa8c2c) !important;
  color: #fff !important;
  border: 2px solid #8b4513 !important;
  border-radius: 6px !important;
  box-shadow: 2px 2px 4px rgba(0,0,0,0.2) !important;
  text-shadow: 1px 1px 1px rgba(0,0,0,0.3) !important;
  clip-path: none !important;
  font-family: Georgia, serif !important;
}
.lw-settings-modal.is-channel-2 .lw-btn:hover {
  background: linear-gradient(to bottom, #e6c557, #ccaa3c) !important;
  box-shadow: 2px 2px 6px rgba(0,0,0,0.3) !important;
}
.lw-settings-modal.is-channel-2 .lw-btn-primary {
  background: linear-gradient(to bottom, #5cb85c, #4cae4c) !important;
  border-color: #4cae4c !important;
}
.lw-settings-modal.is-channel-2 .lw-btn-primary:hover {
  background: linear-gradient(to bottom, #6cc56c, #5cb85c) !important;
}
.lw-settings-modal.is-channel-2 .lw-btn-danger {
  background: linear-gradient(to bottom, #d9534f, #c9302c) !important;
  border-color: #c9302c !important;
}

.lw-settings-modal.is-channel-2 .lw-world-params-note .lw-textarea {
  min-height: 188px;
  height: 188px;
  max-height: 188px;
}

.lw-settings-modal.is-channel-2 .lw-world-schedule-note .lw-schedule-strip {
  flex-wrap: wrap;
  align-content: flex-start;
  max-height: none;
  height: calc(100% - 46px);
  overflow-y: auto;
}

.lw-settings-modal.is-channel-2 .lw-world-schedule-note .lw-slot {
  flex: 1 1 118px;
}

.lw-settings-modal.is-channel-2 .lw-world-config-note,
.lw-settings-modal.is-channel-2 .lw-world-params-note,
.lw-settings-modal.is-channel-2 .lw-world-state-note,
.lw-settings-modal.is-channel-2 .lw-world-schedule-note {
  overflow-x: hidden !important;
  overflow-y: auto !important;
  scrollbar-width: thin;
  scrollbar-color: rgba(139, 69, 19, 0.55) rgba(255, 250, 205, 0.28);
}

.lw-settings-modal.is-channel-2 .lw-world-config-note::-webkit-scrollbar,
.lw-settings-modal.is-channel-2 .lw-world-params-note::-webkit-scrollbar,
.lw-settings-modal.is-channel-2 .lw-world-state-note::-webkit-scrollbar,
.lw-settings-modal.is-channel-2 .lw-world-schedule-note::-webkit-scrollbar {
  width: 8px;
}

.lw-settings-modal.is-channel-2 .lw-world-config-note::-webkit-scrollbar-thumb,
.lw-settings-modal.is-channel-2 .lw-world-params-note::-webkit-scrollbar-thumb,
.lw-settings-modal.is-channel-2 .lw-world-state-note::-webkit-scrollbar-thumb,
.lw-settings-modal.is-channel-2 .lw-world-schedule-note::-webkit-scrollbar-thumb {
  background: rgba(139, 69, 19, 0.55);
  border-radius: 8px;
}

.lw-settings-modal.is-channel-2 .lw-world-clock-note {
  align-self: start;
  height: 310px !important;
  max-height: 310px !important;
  gap: 5px;
  padding: 10px !important;
}

.lw-settings-modal.is-channel-2 .lw-world-config-note {
  align-self: start;
  height: 320px !important;
  max-height: 320px !important;
}

.lw-settings-modal.is-channel-2 .lw-world-state-note {
  justify-self: center;
  align-self: center;
  width: 900px !important;
  max-width: 900px !important;
  height: 280px !important;
  max-height: 280px !important;
}

.lw-settings-modal.is-channel-2 .lw-world-state-note .lw-meter-grid {
  grid-template-rows: repeat(3, minmax(58px, 1fr));
  height: calc(100% - 42px);
}

.lw-settings-modal.is-channel-2 .lw-world-params-note,
.lw-settings-modal.is-channel-2 .lw-world-schedule-note {
  align-self: start;
  height: 100% !important;
  max-height: 100% !important;
}

.lw-settings-modal.is-channel-2 .lw-world-clock-note .lw-clock-time {
  font-size: 18px;
  letter-spacing: 0;
}

.lw-settings-modal.is-channel-2 .lw-world-clock-note .lw-clock-actions {
  gap: 5px;
}

.lw-settings-modal.is-channel-2 .lw-world-clock-note .lw-clock-set {
  gap: 5px;
}

.lw-settings-modal.is-channel-2 .lw-world-clock-note .lw-field label {
  font-size: 9px;
}

.lw-settings-modal.is-channel-2 .lw-world-config-note .lw-form,
.lw-settings-modal.is-channel-2 .lw-world-params-note .lw-form {
  gap: 5px;
}

.lw-settings-modal.is-channel-2 .lw-world-config-note .lw-divider {
  margin: 1px 0;
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
  const storedScheduleTemplate = cleanString(obj.scheduleTemplate, DEFAULT_WORLD_AGENT_SCHEDULE_TEMPLATE);
  const scheduleTemplate = !storedScheduleTemplate || storedScheduleTemplate === PREVIOUS_DEFAULT_WORLD_AGENT_SCHEDULE_TEMPLATE || storedScheduleTemplate === PREVIOUS_FULL_DAY_WORLD_AGENT_SCHEDULE_TEMPLATE || storedScheduleTemplate === PREVIOUS_BLOCK_WORLD_AGENT_SCHEDULE_TEMPLATE ? DEFAULT_WORLD_AGENT_SCHEDULE_TEMPLATE : storedScheduleTemplate;
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
    scheduleTemplate,
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
    return "Day 1, 8:00am";
  return `Day ${state.day}, ${formatHourLabel(state.hour)}`;
}
function formatHourLabel(hour) {
  const normalized = Math.max(0, Math.min(23, Math.round(hour)));
  const period = normalized < 12 ? "am" : "pm";
  const displayHour = normalized % 12 || 12;
  return `${displayHour}:00${period}`;
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
  const widgetHandles = [];
  const modalHandles = [];
  let activeHandles = widgetHandles;
  let state = null;
  let draft = cloneSettings(DEFAULT_SETTINGS);
  let activeChannel = "director";
  let saveTimer = null;
  let localRevision = 0;
  let saveRevision = 0;
  let saveInFlight = false;
  let saveState = "idle";
  let settingsModal = null;
  let widget = null;
  let notice = null;
  let noticeTimer = null;
  cleanups.push(ctx.dom.addStyle(CSS));
  function setNotice(next, ttlMs = 9000) {
    if (noticeTimer) {
      clearTimeout(noticeTimer);
      noticeTimer = null;
    }
    notice = next;
    if (next && ttlMs > 0) {
      noticeTimer = setTimeout(() => {
        notice = null;
        noticeTimer = null;
        render();
      }, ttlMs);
    }
  }
  function createWidget() {
    if (widget)
      return;
    widget = ctx.ui.createFloatWidget({
      width: 260,
      height: 352,
      initialPosition: { x: 24, y: 160 },
      snapToEdge: true,
      tooltip: "LumiWorld",
      chromeless: true
    });
  }
  async function ensureWidget() {
    try {
      createWidget();
      render();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (!message.includes("PERMISSION_DENIED:ui_panels")) {
        console.warn("[LumiWorld] Failed to create floating widget:", message);
        return;
      }
      try {
        await ctx.permissions.request(["ui_panels"], {
          reason: "LumiWorld uses a floating CRT monitor widget instead of a drawer tab."
        });
        createWidget();
        render();
      } catch (requestError) {
        console.warn("[LumiWorld] UI Panels permission was not granted:", requestError);
      }
    }
  }
  cleanups.push(() => widget?.destroy());
  function destroyHandles(handles) {
    while (handles.length) {
      const handle = handles.pop();
      try {
        handle?.destroy();
      } catch {}
    }
  }
  function scheduleAutoSave() {
    if (saveTimer)
      clearTimeout(saveTimer);
    saveState = "saving";
    renderWidget();
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
      activeHandles.push(handle);
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
    slot.classList.add("lw-control-slot", "lw-textarea-slot");
    const input = createElement("textarea", "lw-textarea");
    input.setAttribute("aria-label", ariaLabel);
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
      activeHandles.push(handle);
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
    slot.classList.add("lw-control-slot", "lw-connection-slot");
    const connections = state?.connections ?? [];
    const select = createElement("select", "lw-select");
    select.setAttribute("aria-label", ariaLabel);
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
    slot.classList.add("lw-control-slot", "lw-model-slot");
    const selected = selectedConnection(connectionId);
    const input = createElement("input", "lw-input");
    input.type = "text";
    input.placeholder = selected?.model || "model id";
    input.value = value;
    input.disabled = !selected;
    input.addEventListener("input", () => onChange(input.value));
    slot.appendChild(input);
  }
  function renderDirectorChannel(shell, includeExtras = true) {
    const paper1 = createElement("div", "lw-paper lw-director-core-note");
    const head1 = createElement("div", "lw-panel-head");
    head1.appendChild(createElement("h3", undefined, "Director Core"));
    const toggleSlot = createElement("div", "lw-switch-slot");
    renderSwitchControl(toggleSlot, draft.enabled, (checked) => updateDraft({ enabled: checked }), "Enable Director Note");
    head1.appendChild(toggleSlot);
    paper1.appendChild(head1);
    const form1 = createElement("div", "lw-form");
    const connSlot = createElement("div");
    renderConnectionControl(connSlot, draft.connectionId, (id) => updateDraft({ connectionId: id, modelOverride: "" }), "Director Note connection");
    const modelSlot = createElement("div");
    renderModelControl(modelSlot, draft.connectionId, draft.modelOverride, (m) => updateDraft({ modelOverride: m }));
    form1.append(field("Connection", connSlot), field("Model Override", modelSlot));
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
        activeHandles.push(handle);
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
    form1.appendChild(runsOnDiv);
    paper1.appendChild(form1);
    shell.appendChild(paper1);
    const paper2 = createElement("div", "lw-paper lw-director-model-note");
    const head2 = createElement("div", "lw-panel-head");
    head2.appendChild(createElement("h3", undefined, "Model Parameters"));
    paper2.appendChild(head2);
    const form2 = createElement("div", "lw-form");
    const paramsGrid1 = createElement("div", "lw-two");
    paramsGrid1.append(numberField("Temp", draft.temperature, 0, 2, 0.05, (v) => updateDraft({ temperature: v })), numberField("Tokens", draft.maxTokens, 64, MAX_CONTROLLER_OUTPUT_TOKENS, 1, (v) => updateDraft({ maxTokens: v })));
    const paramsGrid2 = createElement("div", "lw-two");
    paramsGrid2.append(numberField("Timeout", draft.timeoutMs, 1000, MAX_CONTROLLER_TIMEOUT_MS, 1000, (v) => updateDraft({ timeoutMs: v })), numberField("History", draft.historyMessageLimit, 0, MAX_CHAT_HISTORY_MESSAGES, 1, (v) => updateDraft({ historyMessageLimit: v })));
    const paramsGrid3 = createElement("div", "lw-two");
    paramsGrid3.append(numberField("Cap Chars", draft.maxInputChars, 4000, 500000, 1000, (v) => updateDraft({ maxInputChars: v })), numberField("Log Limit", draft.runLogLimit, 0, 50, 1, (v) => updateDraft({ runLogLimit: v })));
    form2.append(paramsGrid1, paramsGrid2, paramsGrid3);
    paper2.appendChild(form2);
    shell.appendChild(paper2);
    const appendCard = (title, className, ...children) => {
      const paper = createElement("div", `lw-paper ${className}`);
      const head = createElement("div", "lw-panel-head");
      head.appendChild(createElement("h3", undefined, title));
      const form = createElement("div", "lw-form");
      form.append(...children);
      paper.append(head, form);
      shell.appendChild(paper);
    };
    const entriesHint = state?.permissions.worldBooks === false ? "Grant World Books permission to fetch activated entry content. Without it, LumiWorld can only use tagged standalone prompt entries." : "Fetch activated World Info entry content and send it to the controller.";
    appendCard("Controller Context", "lw-director-context-note", toggleField("Entries", draft.includeWorldInfoEntries, (checked) => updateDraft({ includeWorldInfoEntries: checked }), entriesHint), toggleField("User persona", draft.includeUserPersona, (checked) => updateDraft({ includeUserPersona: checked }), "Send the active user persona to the controller."), toggleField("Character", draft.includeCharacter, (checked) => updateDraft({ includeCharacter: checked }), "Send the active character card to the controller."));
    appendCard("Additional Notes", "lw-director-notes-note", textareaField("Notes", draft.additionalNotes, (value) => updateDraft({ additionalNotes: value }), "Always sent to the LumiWorld controller as a private system message."));
    appendCard("System Template", "lw-template-note lw-director-system-note", textareaField("System template", draft.systemTemplate, (value) => updateDraft({ systemTemplate: value }), "Available variables: {{prompt}}, {{generationType}}, {{chatId}}, {{connectionId}}, {{timestamp}}, {{maxDirectiveChars}}, {{user}}, {{char}}."));
    appendCard("User Template", "lw-template-note lw-director-user-note", textareaField("User template", draft.userTemplate, (value) => updateDraft({ userTemplate: value })));
    if (includeExtras) {
      renderRuns(shell, "director");
    }
  }
  function renderWorldAgentChannel(shell) {
    renderWorldAgentClock(shell);
    const paper1 = createElement("div", "lw-paper lw-world-config-note");
    const head1 = createElement("div", "lw-panel-head");
    head1.appendChild(createElement("h3", undefined, "Agent Configuration"));
    paper1.appendChild(head1);
    const form1 = createElement("div", "lw-form");
    form1.append(toggleField("Enable Agent", draft.worldAgent.enabled, (checked) => updateWorldAgent({ enabled: checked }), "Per-chat simulation state."), toggleField("Inject State", draft.worldAgent.injectState, (checked) => updateWorldAgent({ injectState: checked }), "Add state to visible prompt."), toggleField("Visible-only Ticks", draft.worldAgent.autoTickVisibleOnly, (checked) => updateWorldAgent({ autoTickVisibleOnly: checked }), "Ticks run only when Lumiverse is visible."));
    form1.appendChild(createElement("hr", "lw-divider"));
    const connSlot = createElement("div");
    renderConnectionControl(connSlot, draft.worldAgent.connectionId, (id) => updateWorldAgent({ connectionId: id, modelOverride: "" }), "World Agent connection");
    const modelSlot = createElement("div");
    renderModelControl(modelSlot, draft.worldAgent.connectionId, draft.worldAgent.modelOverride, (m) => updateWorldAgent({ modelOverride: m }));
    form1.append(field("Connection", connSlot), field("Model Override", modelSlot));
    paper1.appendChild(form1);
    shell.appendChild(paper1);
    const paper2 = createElement("div", "lw-paper lw-world-params-note");
    const head2 = createElement("div", "lw-panel-head");
    head2.appendChild(createElement("h3", undefined, "Simulation Parameters"));
    paper2.appendChild(head2);
    const form2 = createElement("div", "lw-form");
    const paramsGrid1 = createElement("div", "lw-two");
    paramsGrid1.append(numberField("Temp", draft.worldAgent.temperature, 0, 2, 0.05, (v) => updateWorldAgent({ temperature: v })), numberField("Tokens", draft.worldAgent.maxTokens, 64, MAX_CONTROLLER_OUTPUT_TOKENS, 1, (v) => updateWorldAgent({ maxTokens: v })));
    const paramsGrid2 = createElement("div", "lw-two");
    paramsGrid2.append(numberField("Timeout", draft.worldAgent.timeoutMs, 1000, MAX_CONTROLLER_TIMEOUT_MS, 1000, (v) => updateWorldAgent({ timeoutMs: v })), numberField("Hour Dur", draft.worldAgent.hourDurationMs, 1000, 365 * 24 * 60 * 60 * 1000, 1000, (v) => updateWorldAgent({ hourDurationMs: v })));
    form2.append(paramsGrid1, paramsGrid2, createElement("hr", "lw-divider"), createElement("div", "lw-form-subhead", "Prompt Templates"), textareaField("Schedule template", draft.worldAgent.scheduleTemplate, (value) => updateWorldAgent({ scheduleTemplate: value }), "Variables: {{chatId}}, {{user}}, {{char}}, {{day}}, {{hour}}, {{time}}, {{state}}, {{schedule}}, {{timestamp}}."), textareaField("Update template", draft.worldAgent.updateTemplate, (value) => updateWorldAgent({ updateTemplate: value }), "Variables: {{chatId}}, {{user}}, {{char}}, {{day}}, {{hour}}, {{time}}, {{state}}, {{schedule}}, {{timestamp}}."));
    paper2.appendChild(form2);
    shell.appendChild(paper2);
    renderWorldAgentState(shell);
    renderWorldAgentSchedule(shell);
  }
  function renderWorldAgentClock(shell) {
    const panel = createElement("div", "lw-clock lw-world-clock-note");
    const stateNow = state?.worldState ?? null;
    const top = createElement("div", "lw-clock-top");
    top.append(createElement("div", "lw-clock-time", formatClock(stateNow)), createElement("span", "lw-clock-status", stateNow?.running ? "▶ Running" : "⏸ Paused"));
    panel.appendChild(top);
    const actions = createElement("div", "lw-clock-actions");
    const startPause = createElement("button", `lw-btn${stateNow?.running ? "" : " lw-btn-primary"}`, stateNow?.running ? "Pause" : "Start");
    startPause.type = "button";
    startPause.addEventListener("click", () => {
      setNotice({ tone: "info", text: stateNow?.running ? "Pausing World Agent..." : "Starting World Agent..." });
      render();
      send(ctx, { type: stateNow?.running ? "world_agent_pause" : "world_agent_start" });
    });
    const advance = createElement("button", "lw-btn", "+1 Hour");
    advance.type = "button";
    advance.addEventListener("click", () => {
      setNotice({ tone: "info", text: "Advancing one simulated hour..." });
      render();
      send(ctx, { type: "world_agent_advance_hour" });
    });
    const schedule = createElement("button", "lw-btn", "Schedule");
    schedule.type = "button";
    schedule.addEventListener("click", () => {
      setNotice({ tone: "info", text: "Regenerating the daily schedule..." });
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
    const paper = createElement("div", "lw-paper lw-world-state-note");
    const head = createElement("div", "lw-panel-head");
    head.appendChild(createElement("h3", undefined, "Current State"));
    if (state?.worldState?.updatedAt)
      head.appendChild(createElement("span", "lw-muted", `Updated ${formatTime(state.worldState.updatedAt)}`));
    paper.appendChild(head);
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
    paper.appendChild(grid);
    shell.appendChild(paper);
  }
  function renderWorldAgentSchedule(shell) {
    const paper = createElement("div", "lw-paper lw-world-schedule-note");
    const head = createElement("div", "lw-panel-head");
    head.appendChild(createElement("h3", undefined, "Daily Schedule"));
    head.appendChild(createElement("span", "lw-muted", state?.worldState?.scheduleDay ? `Day ${state.worldState.scheduleDay}` : "No day"));
    paper.appendChild(head);
    const schedule = state?.worldState?.schedule ?? [];
    if (!schedule.length) {
      paper.appendChild(createElement("div", "lw-empty", "No schedule generated."));
      shell.appendChild(paper);
      return;
    }
    const strip = createElement("div", "lw-schedule-strip");
    for (const item of schedule) {
      const slot = createElement("article", `lw-slot${item.hour === state?.worldState?.hour ? " is-now" : ""}`);
      slot.append(createElement("strong", undefined, formatHourLabel(item.hour)));
      if (item.location)
        slot.appendChild(createElement("div", "lw-muted", item.location));
      slot.appendChild(createElement("div", undefined, item.activity || "Unspecified activity"));
      strip.appendChild(slot);
    }
    paper.appendChild(strip);
    shell.appendChild(paper);
  }
  function renderRuns(shell, channel) {
    const paper = createElement("div", `lw-paper ${channel === "director" ? "lw-runs-note" : "lw-world-runs-note"}`);
    const head = createElement("div", "lw-panel-head");
    head.appendChild(createElement("h3", undefined, channel === "director" ? "Recent Runs" : "Recent Activity"));
    const clear = createElement("button", "lw-btn", "Clear");
    clear.type = "button";
    clear.addEventListener("click", () => send(ctx, { type: "clear_runs" }));
    head.appendChild(clear);
    paper.appendChild(head);
    const runs = (state?.runs ?? []).filter((run) => (run.channel ?? "director") === channel);
    const scroll = createElement("div", "lw-scrollbox");
    if (!runs.length) {
      scroll.appendChild(createElement("div", "lw-empty", channel === "director" ? "No controller runs yet." : "No World Agent runs yet."));
      paper.appendChild(scroll);
      shell.appendChild(paper);
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
    paper.appendChild(scroll);
    shell.appendChild(paper);
  }
  function renderNotice(shell) {
    if (!notice)
      return;
    const div = createElement("div", `lw-banner ${notice.tone}`, notice.text);
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
  function latestRun(channel) {
    return (state?.runs ?? []).find((run) => (run.channel ?? "director") === channel) ?? null;
  }
  function channelStatus(channel) {
    if (channel === "director")
      return draft.enabled ? "live" : "off";
    if (!draft.worldAgent.enabled)
      return "off";
    return state?.worldState?.running ? "run" : "pause";
  }
  function setActiveChannel(channel) {
    activeChannel = channel;
    render();
  }
  function widgetNoteLines() {
    if (!state)
      return ["Loading LumiWorld...", "Waiting for extension state.", "Open settings after load."];
    if (activeChannel === "director") {
      const connection = selectedConnection(draft.connectionId);
      const run = latestRun("director");
      return [
        draft.enabled ? "Director: enabled" : "Director: disabled",
        connection ? `Model: ${connection.name}` : "No controller connection",
        run ? `Last: ${formatStatus(run.status)}${run.durationMs != null ? ` / ${Math.round(run.durationMs)} ms` : ""}` : "No director runs yet"
      ];
    }
    const world = state.worldState ?? null;
    return [
      draft.worldAgent.enabled ? `Clock: ${world?.running ? "running" : "paused"}` : "World Agent disabled",
      `Time: ${formatClock(world)}`,
      `Mood: ${worldStateCardValue(world?.mood, "Neutral")}`,
      `Goal: ${worldStateCardValue(world?.goal, "Unset")}`
    ];
  }
  function renderWidgetChannel(parent, channel, label, ch) {
    const row = createElement("div", `lw-monitor-channel${activeChannel === channel ? " is-active" : ""}`);
    row.append(createElement("span", undefined, ch), createElement("span", undefined, label), createElement("span", "lw-monitor-status", channelStatus(channel)));
    row.addEventListener("click", () => setActiveChannel(channel));
    parent.appendChild(row);
  }
  function renderWidget() {
    if (!widget)
      return;
    destroyHandles(widgetHandles);
    activeHandles = widgetHandles;
    widget.root.replaceChildren();
    const root = createElement("div", "lw-float-root");
    const monitor = createElement("div", "lw-monitor");
    const screen = createElement("div", "lw-monitor-screen");
    const head = createElement("div", "lw-monitor-head");
    head.append(createElement("span", undefined, "LumiWorld"), createElement("span", undefined, formatClock(state?.worldState)));
    screen.appendChild(head);
    renderWidgetChannel(screen, "director", "DIRECTOR", "CH1");
    renderWidgetChannel(screen, "world_agent", "WORLD", "CH2");
    const screenActions = createElement("div", "lw-monitor-actions");
    const refresh = createElement("button", "lw-monitor-action", "Refresh");
    refresh.type = "button";
    refresh.addEventListener("click", () => {
      send(ctx, { type: "refresh_state" });
      send(ctx, { type: "refresh_world_state" });
    });
    const open = createElement("button", "lw-monitor-action", "Settings");
    open.type = "button";
    open.addEventListener("click", () => openSettingsModal());
    screenActions.append(refresh, open);
    screen.appendChild(screenActions);
    monitor.append(createElement("div", "lw-monitor-antenna left"), createElement("div", "lw-monitor-antenna right"), screen, createElement("div", "lw-monitor-knob one"), createElement("div", "lw-monitor-knob two"));
    const note = createElement("div", "lw-widget-note");
    const noteHead = createElement("div", "lw-note-head");
    noteHead.append(createElement("span", undefined, activeChannel === "director" ? "Director Note" : "World Agent"), createElement("span", `lw-save-dot${saveState === "saving" ? " is-saving" : saveState === "error" ? " is-error" : ""}`, saveState));
    const lines = createElement("div", "lw-note-lines");
    for (const line of widgetNoteLines())
      lines.appendChild(createElement("div", "lw-note-line", line));
    note.append(noteHead, lines);
    root.append(monitor, note);
    widget.root.appendChild(root);
  }
  function renderModalTabs(shell) {
    const tabs = createElement("div", "lw-modal-tabs");
    const director = createElement("button", `lw-modal-tab${activeChannel === "director" ? " is-active" : ""}`, "CH 1: Director");
    director.type = "button";
    director.addEventListener("click", () => setActiveChannel("director"));
    const world = createElement("button", `lw-modal-tab${activeChannel === "world_agent" ? " is-active" : ""}`, "CH 2: World");
    world.type = "button";
    world.addEventListener("click", () => setActiveChannel("world_agent"));
    tabs.append(director, world);
    shell.appendChild(tabs);
  }
  function renderSettingsModal() {
    if (!settingsModal)
      return;
    destroyHandles(modalHandles);
    const previousHandles = activeHandles;
    activeHandles = modalHandles;
    try {
      settingsModal.root.replaceChildren();
      const shell = createElement("div", `lw-settings-modal is-channel-${activeChannel === "director" ? "1" : "2"}`);
      renderModalTabs(shell);
      const actions = createElement("div", "lw-modal-actions");
      const refresh = createElement("button", "lw-btn", "Refresh");
      refresh.type = "button";
      refresh.addEventListener("click", () => {
        setNotice(null);
        render();
        send(ctx, { type: "refresh_state" });
        send(ctx, { type: "refresh_world_state" });
      });
      const test = createElement("button", "lw-btn lw-btn-primary", "Test Director");
      test.type = "button";
      test.addEventListener("click", () => {
        setNotice({ tone: "info", text: "Testing Director Note controller..." });
        send(ctx, { type: "test_controller", settings: draft });
        render();
      });
      actions.append(refresh, test);
      shell.appendChild(actions);
      renderNotice(shell);
      if (!state) {
        shell.appendChild(createElement("div", "lw-empty", "Loading LumiWorld settings..."));
        settingsModal.root.appendChild(shell);
        return;
      }
      renderBanners(shell);
      const grid = createElement("div", "lw-modal-grid");
      if (activeChannel === "director")
        renderDirectorChannel(grid, true);
      else
        renderWorldAgentChannel(grid);
      shell.appendChild(grid);
      settingsModal.root.appendChild(shell);
    } finally {
      activeHandles = previousHandles;
    }
  }
  function openSettingsModal() {
    if (settingsModal) {
      renderSettingsModal();
      return;
    }
    settingsModal = ctx.ui.showModal({ title: "LumiWorld Settings", width: 1664, maxHeight: 1328 });
    settingsModal.onDismiss(() => {
      destroyHandles(modalHandles);
      settingsModal = null;
    });
    renderSettingsModal();
  }
  function render() {
    renderWidget();
    if (settingsModal)
      renderSettingsModal();
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
          saveState = "idle";
          draft = cloneSettings(message.settings);
          if (state)
            state = { ...state, settings: message.settings };
          render();
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
        setNotice(message.ok ? { tone: "success", text: message.message || "World Agent updated." } : { tone: "error", text: message.error }, message.ok ? 7000 : 12000);
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
        setNotice(message.ok ? { tone: "success", text: `Controller test succeeded on ${message.connectionName} / ${message.model}: ${message.directive}` } : { tone: "error", text: `Controller test failed: ${message.error}` }, message.ok ? 7000 : 12000);
        render();
        break;
      case "error":
        saveInFlight = false;
        if (!saveTimer && localRevision === saveRevision)
          saveState = "error";
        setNotice({ tone: "error", text: message.message }, 12000);
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
  ensureWidget();
  return () => {
    if (saveTimer) {
      clearTimeout(saveTimer);
      saveTimer = null;
    }
    if (noticeTimer) {
      clearTimeout(noticeTimer);
      noticeTimer = null;
    }
    destroyHandles(widgetHandles);
    destroyHandles(modalHandles);
    settingsModal?.dismiss();
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
