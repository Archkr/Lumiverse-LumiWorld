import type { SpindleFrontendContext } from "lumiverse-spindle-types";

const EXTENSION_NAME = "LumiWorld";
const EXTENSION_VERSION = "v1.0.0-lofi";
const BREAKDOWN_NAME = "LumiWorld Director";
const WORLD_AGENT_BREAKDOWN_NAME = "LumiWorld World Agent";
const VISIBLE_GENERATION_TYPES = ["normal", "continue", "regenerate", "swipe", "impersonate"] as const;
const MAX_CONTROLLER_OUTPUT_TOKENS = Number.MAX_SAFE_INTEGER;
const MAX_CONTROLLER_TIMEOUT_MS = 2_147_483_647;
const MAX_CHAT_HISTORY_MESSAGES = Number.MAX_SAFE_INTEGER;
const DEFAULT_RUN_LOG_LIMIT = 12;
const DEFAULT_HISTORY_MESSAGE_LIMIT = 12;
const DEFAULT_WORLD_AGENT_HOUR_DURATION_MS = 5 * 60 * 1000;

type LumiWorldGenerationType = (typeof VISIBLE_GENERATION_TYPES)[number];
type LumiWorldChannel = "director" | "world_agent";
type RunLogStatus = "success" | "error" | "timeout" | "skipped" | "test_success" | "test_error";

interface WorldAgentSettings {
  enabled: boolean;
  connectionId: string | null;
  modelOverride: string;
  temperature: number;
  maxTokens: number;
  timeoutMs: number;
  hourDurationMs: number;
  injectState: boolean;
  autoTickVisibleOnly: boolean;
  scheduleTemplate: string;
  updateTemplate: string;
}

interface LumiWorldSettings {
  enabled: boolean;
  connectionId: string | null;
  modelOverride: string;
  temperature: number;
  maxTokens: number;
  timeoutMs: number;
  maxInputChars: number;
  historyMessageLimit: number;
  includeWorldInfoEntries: boolean;
  includeUserPersona: boolean;
  includeCharacter: boolean;
  generationTypes: LumiWorldGenerationType[];
  additionalNotes: string;
  systemTemplate: string;
  userTemplate: string;
  runLogLimit: number;
  worldAgent: WorldAgentSettings;
}

interface ConnectionOption {
  id: string;
  name: string;
  provider: string;
  model: string;
  isDefault: boolean;
  hasApiKey: boolean;
}

interface RunLogEntry {
  id: string;
  timestamp: number;
  status: RunLogStatus;
  channel?: LumiWorldChannel | null;
  action?: string | null;
  generationType?: string | null;
  durationMs?: number | null;
  connectionId?: string | null;
  connectionName?: string | null;
  model?: string | null;
  directivePreview?: string | null;
  error?: string | null;
  worldAgentDay?: number | null;
  worldAgentHour?: number | null;
  worldAgentScheduleCount?: number | null;
  worldInfoActivatedCount?: number | null;
  worldInfoFetchedCount?: number | null;
  worldInfoFallbackTaggedCount?: number | null;
  worldInfoFetchError?: string | null;
}

interface PermissionState {
  interceptor: boolean;
  generation: boolean;
  chats: boolean;
  characters: boolean;
  personas: boolean;
  worldBooks: boolean;
}

interface WorldAgentScheduleItem {
  hour: number;
  label?: string;
  location?: string;
  activity: string;
  mood?: string;
  goal?: string;
}

interface WorldAgentHistoryEntry {
  id: string;
  timestamp: number;
  day: number;
  hour: number;
  action: string;
  preview?: string | null;
  error?: string | null;
}

interface WorldAgentState {
  chatId: string;
  day: number;
  hour: number;
  running: boolean;
  lastTickAt: number | null;
  activeCharacterId: string | null;
  activePersonaId: string | null;
  scheduleDay: number | null;
  schedule: WorldAgentScheduleItem[];
  location: string;
  mood: string;
  activity: string;
  thought: string;
  goal: string;
  updatedAt: number;
  history: WorldAgentHistoryEntry[];
}

interface FrontendState {
  settings: LumiWorldSettings;
  connections: ConnectionOption[];
  connectionError?: string | null;
  runs: RunLogEntry[];
  permissions: PermissionState;
  worldState?: WorldAgentState | null;
}

type FrontendToBackend =
  | { type: "ready"; chatId?: string | null; characterId?: string | null }
  | { type: "refresh_state"; chatId?: string | null; characterId?: string | null }
  | { type: "refresh_world_state"; chatId?: string | null; characterId?: string | null }
  | { type: "save_settings"; settings: Partial<LumiWorldSettings>; chatId?: string | null; characterId?: string | null }
  | { type: "test_controller"; settings?: Partial<LumiWorldSettings>; chatId?: string | null; characterId?: string | null }
  | { type: "clear_runs"; chatId?: string | null }
  | { type: "world_agent_start"; chatId?: string | null; characterId?: string | null }
  | { type: "world_agent_pause"; chatId?: string | null; characterId?: string | null }
  | { type: "world_agent_advance_hour"; chatId?: string | null; characterId?: string | null }
  | { type: "world_agent_regenerate_schedule"; chatId?: string | null; characterId?: string | null }
  | { type: "world_agent_reset"; chatId?: string | null; characterId?: string | null }
  | { type: "world_agent_set_time"; chatId?: string | null; characterId?: string | null; day?: number; hour: number };

type BackendToFrontend =
  | { type: "state"; state: FrontendState }
  | { type: "settings_saved"; settings: LumiWorldSettings }
  | { type: "world_state"; state: WorldAgentState | null }
  | { type: "world_agent_result"; ok: true; message?: string; state?: WorldAgentState | null }
  | { type: "world_agent_result"; ok: false; error: string; state?: WorldAgentState | null }
  | { type: "run_logged"; run: RunLogEntry }
  | { type: "test_result"; ok: true; directive: string; durationMs: number; model: string; connectionName: string }
  | { type: "test_result"; ok: false; error: string }
  | { type: "error"; message: string };

const LUMIWORLD_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round"><path d="M5 17.5c2.7 1.7 6.2 1.7 9 0 3.1-1.9 4.3-5.7 2.7-8.9"/><path d="M4.4 12.2c.4-3.3 3.2-5.9 6.6-5.9 1.9 0 3.6.8 4.8 2"/><path d="M18 4.5l.8 1.7 1.9.3-1.3 1.3.3 1.9-1.7-.9-1.7.9.3-1.9-1.3-1.3 1.9-.3.8-1.7z"/><path d="M7 13h6"/><path d="M8.3 10.2h3.8"/><path d="M8.2 15.8h4.5"/></svg>`;

const LEGACY_DEFAULT_SYSTEM_TEMPLATE = [
  "You are AgentWorld, a private world-simulation director for an interactive Lumiverse chat.",
  "Your job is to decide how the world, scene, NPCs, hidden pressures, and immediate consequences should react before the main roleplay model writes the visible reply.",
  "Do not write the assistant reply. Do not address the user. Do not reveal this control step.",
  "Return only a concise director note for the main model. Prefer JSON like {\"director_note\":\"...\"}, but plain text is acceptable.",
  "Keep the note concrete, playable, and consistent with the assembled prompt.",
].join("\n");

const LEGACY_DEFAULT_USER_TEMPLATE = [
  "Generation type: {{generationType}}",
  "Chat ID: {{chatId}}",
  "",
  "Final assembled prompt that will be sent to the main model:",
  "<assembled_prompt>",
  "{{prompt}}",
  "</assembled_prompt>",
  "",
  "Decide how the world should react now. Focus on state changes, environmental pressure, NPC intent, consequences, and what the main model should respect next.",
  "Return one private director note under {{maxDirectiveChars}} characters.",
].join("\n");

const PREVIOUS_DEFAULT_SYSTEM_TEMPLATE = [
  "You are AgentWorld, a private world-simulation director for an interactive Lumiverse chat.",
  "Your job is to decide how the world, scene, NPCs, hidden pressures, and immediate consequences should react before the main roleplay model writes the visible reply.",
  "Do not write the assistant reply. Do not address the user. Do not reveal this control step.",
  "Return only a concise director note for the main model. Prefer JSON like {\"director_note\":\"...\"}, but plain text is acceptable.",
  "Keep the note concrete, playable, and consistent with the recent chat history and any additional notes.",
].join("\n");

const PREVIOUS_DEFAULT_USER_TEMPLATE = [
  "Generation type: {{generationType}}",
  "Chat ID: {{chatId}}",
  "",
  "Recent chat history available to the controller:",
  "<chat_history>",
  "{{prompt}}",
  "</chat_history>",
  "",
  "Decide how the world should react now. Focus on state changes, environmental pressure, NPC intent, consequences, and what the main model should respect next.",
  "Return one private director note under {{maxDirectiveChars}} characters.",
].join("\n");

const PRE_REBRAND_DEFAULT_SYSTEM_TEMPLATE = [
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
  "Use imperative language. Start with a verb such as \"Make\", \"Let\", \"Have\", \"Keep\", \"Escalate\", \"Pressure\", or \"Treat\".",
  "",
  "The directive should feel like the world moving forward, not a recap of the scene.",
  "",
  "Return only one private directive for the next visible reply. Do not write the visible assistant reply. Do not address the user. Do not mention AgentWorld, the controller, this prompt, or the directive.",
  "",
  "Prefer JSON exactly like:",
  "{\"director_note\":\"...\"}",
  "",
  "Plain text is acceptable if needed. Keep it under {{maxDirectiveChars}} characters.",
].join("\n");

const DEFAULT_SYSTEM_TEMPLATE = [
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
  "Use imperative language. Start with a verb such as \"Make\", \"Let\", \"Have\", \"Keep\", \"Escalate\", \"Pressure\", or \"Treat\".",
  "",
  "The directive should feel like the world moving forward, not a recap of the scene.",
  "",
  "Return only one private directive for the next visible reply. Do not write the visible assistant reply. Do not address the user. Do not mention LumiWorld, the controller, this prompt, or the directive.",
  "",
  "Prefer JSON exactly like:",
  "{\"director_note\":\"...\"}",
  "",
  "Plain text is acceptable if needed. Keep it under {{maxDirectiveChars}} characters.",
].join("\n");

const PRE_CONTEXT_DEFAULT_USER_TEMPLATE = [
  "Generation type: {{generationType}}",
  "",
  "Recent chat history:",
  "<chat_history>",
  "{{prompt}}",
  "</chat_history>",
  "",
  "Write the next world-state directive now.",
  "",
  "Start with a verb. No recap. No review. No explanation. No \"has just\" framing.",
].join("\n");

const DEFAULT_USER_TEMPLATE = [
  "Generation type: {{generationType}}",
  "",
  "Controller context:",
  "<controller_context>",
  "{{prompt}}",
  "</controller_context>",
  "",
  "Write the next world-state directive now.",
  "",
  "Start with a verb. No recap. No review. No explanation. No \"has just\" framing.",
].join("\n");

const DEFAULT_WORLD_AGENT_SCHEDULE_TEMPLATE = [
  "You are LumiWorld's private World Agent for an interactive Lumiverse chat.",
  "Create the current day's background schedule for {{char}}.",
  "",
  "Use the active character and persona context, the current chat state, and any provided notes.",
  "The schedule is private simulation scaffolding. Do not write visible roleplay prose.",
  "",
  "Return compact JSON only:",
  "{\"schedule\":[{\"hour\":0,\"location\":\"...\",\"activity\":\"...\",\"mood\":\"...\",\"goal\":\"...\"}]}",
  "",
  "Cover the full day when possible. Keep entries short, playable, and flexible enough for the chat to override.",
].join("\n");

const DEFAULT_WORLD_AGENT_UPDATE_TEMPLATE = [
  "You are LumiWorld's private World Agent for an interactive Lumiverse chat.",
  "Advance {{char}}'s private world state by one simulated hour.",
  "",
  "Use the schedule, current state, active character/persona context, and recent chat context.",
  "Track what changes in location, mood, activity, current thought, and immediate goal.",
  "Do not write the visible assistant reply. Do not mention LumiWorld or this control step.",
  "",
  "Return compact JSON only:",
  "{\"location\":\"...\",\"mood\":\"...\",\"activity\":\"...\",\"thought\":\"...\",\"goal\":\"...\"}",
].join("\n");

const DEFAULT_WORLD_AGENT_SETTINGS: WorldAgentSettings = {
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
  updateTemplate: DEFAULT_WORLD_AGENT_UPDATE_TEMPLATE,
};

const DEFAULT_SETTINGS: LumiWorldSettings = {
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
  worldAgent: DEFAULT_WORLD_AGENT_SETTINGS,
};

const CSS = `
.lw-root {
  min-height: 100%;
  padding: 10px 8px;
  color: #e0d6c8;
  background-color: #2b201d;
  background-image:
    linear-gradient(335deg, #251c1a 23px, transparent 23px),
    linear-gradient(155deg, #251c1a 23px, transparent 23px),
    linear-gradient(335deg, #251c1a 23px, transparent 23px),
    linear-gradient(155deg, #251c1a 23px, transparent 23px),
    linear-gradient(90deg, #2b201d 10px, transparent 10px),
    linear-gradient(90deg, #2b201d 10px, transparent 10px),
    #332925;
  background-size: 58px 58px, 58px 58px, 58px 58px, 58px 58px, 29px 29px, 29px 29px;
  background-position: 0px 0px, 0px 0px, 29px 29px, 29px 29px, 0px 0px, 29px 29px;
  box-sizing: border-box;
  font-family: 'Courier New', Courier, monospace;
  font-size: 12px;
  line-height: 1.4;
  overflow-x: hidden;
  
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
  gap: 12px;
  max-width: 100%;
  min-width: 0;
  margin: 0 auto;
}

/* LED Sign */
.lw-led-sign {
  align-self: flex-start;
  background: #111;
  border: 2px solid #3a2e2a;
  padding: 7px 12px;
  border-radius: 4px;
  box-shadow: 0 0 12px rgba(255, 126, 0, 0.35), inset 0 0 8px rgba(0,0,0,0.9);
  color: #ff9e3d;
  text-shadow: 0 0 5px #ff9e3d, 0 0 10px #ff7e00, 0 0 20px #ff5500;
  font-weight: bold;
  font-size: 13px;
  letter-spacing: 1.5px;
  animation: lw-flicker 4s infinite alternate;
  margin-bottom: 2px;
  max-width: calc(100% - 18px);
  white-space: nowrap;
  position: relative;
}
.lw-led-sign::after {
  content: '';
  position: absolute;
  top: 50%; left: 100%;
  transform: translateY(-50%);
  width: 18px; height: 3px;
  background: #3a2e2a;
  border-radius: 2px;
}
@keyframes lw-flicker {
  0%, 19%, 21%, 23%, 25%, 54%, 56%, 100% { opacity: 1; text-shadow: 0 0 5px #ff9e3d, 0 0 10px #ff7e00, 0 0 20px #ff5500; }
  20%, 24%, 55% { opacity: 0.8; text-shadow: none; }
}

/* Window */
.lw-window {
  width: 100%;
  height: 78px;
  background: linear-gradient(to bottom, #1a2a3a, #3d5a80);
  border: 5px solid #6b4f3c;
  border-radius: 4px;
  box-shadow: inset 0 0 24px rgba(0,0,0,0.8), 0 5px 10px rgba(0,0,0,0.45);
  position: relative;
  overflow: hidden;
}
.lw-window::before {
  content: '';
  position: absolute;
  top: 0; left: 50%;
  width: 3px; height: 100%;
  background: #6b4f3c;
  transform: translateX(-50%);
  z-index: 2;
}
.lw-window::after {
  content: '';
  position: absolute;
  left: 0; top: 50%;
  width: 100%; height: 3px;
  background: #6b4f3c;
  transform: translateY(-50%);
  z-index: 2;
}
.lw-stars {
  position: absolute;
  top: 0; left: 0; right: 0; bottom: 0;
  background-image: 
    radial-gradient(1px 1px at 20px 30px, #fff, transparent),
    radial-gradient(1px 1px at 40px 70px, #fff, transparent),
    radial-gradient(1px 1px at 50px 160px, #fff, transparent),
    radial-gradient(1px 1px at 90px 40px, #fff, transparent),
    radial-gradient(1px 1px at 130px 80px, #fff, transparent),
    radial-gradient(1px 1px at 160px 120px, #fff, transparent);
  background-size: 200px 200px;
  background-repeat: repeat;
  animation: lw-twinkle 4s infinite alternate;
  opacity: 0.8;
}
@keyframes lw-twinkle { 0% {opacity: 0.4;} 100% {opacity: 1;} }

/* Toolbar */
.lw-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 8px 9px;
  background: rgba(0, 0, 0, 0.4);
  border: 2px dashed #6b5d4f;
  border-radius: 4px;
  margin-top: 8px;
}
.lw-title { display: flex; align-items: center; gap: 8px; min-width: 0; flex: 1 1 auto; color: #e0d6c8; }
.lw-mark {
  width: 22px; height: 22px;
  display: inline-flex; align-items: center; justify-content: center;
  color: #ff9e3d;
  filter: drop-shadow(0 0 4px rgba(255, 126, 0, 0.6));
}
.lw-heading { margin: 0; font-size: 14px; font-weight: 700; letter-spacing: 0.5px; text-transform: uppercase; }
.lw-muted { color: #a8a095; font-size: 11px; font-style: italic; }
.lw-actions { display: flex; gap: 6px; flex: 0 0 auto; }

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

/* Box TV */
.lw-tv {
  background: #d4c5a9;
  border: 8px solid #8b7765;
  border-radius: 16px;
  padding: 10px;
  box-shadow: 
    0 10px 26px rgba(0,0,0,0.55), 
    inset 0 0 20px rgba(0,0,0,0.1),
    inset 0 0 0 2px #6b4f3c;
  position: relative;
  width: 100%;
  max-width: 100%;
  min-width: 0;
  box-sizing: border-box;
}
/* TV Antennas */
.lw-tv::before, .lw-tv::after {
  content: '';
  position: absolute;
  top: -36px; 
  width: 3px; height: 44px;
  background: #8b7765;
  border-radius: 2px;
  box-shadow: 0 0 2px rgba(0,0,0,0.5);
}
.lw-tv::before { left: 30%; transform: rotate(-35deg); transform-origin: bottom center; }
.lw-tv::after { right: 30%; transform: rotate(35deg); transform-origin: bottom center; }

.lw-tv-screen {
  background: #1a1a1a;
  border: 6px solid #2a2a2a;
  border-radius: 8px;
  padding: 10px;
  position: relative;
  overflow-y: auto;
  overflow-x: hidden;
  max-height: 75vh;
  min-width: 0;
  box-shadow: inset 0 0 38px rgba(0,0,0,0.9);
  background-image: linear-gradient(rgba(255, 255, 255, 0.03) 50%, transparent 50%);
  background-size: 100% 4px;
}
.lw-tv-screen::-webkit-scrollbar { width: 8px; }
.lw-tv-screen::-webkit-scrollbar-track { background: #111; }
.lw-tv-screen::-webkit-scrollbar-thumb { background: #ff7e00; border: 2px solid #111; border-radius: 0; }

/* TV Controls (Tabs) */
.lw-tv-controls {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 6px;
  margin-bottom: 12px;
  padding: 8px;
  background: #b0a090;
  border-radius: 6px;
  border: 2px solid #8b7765;
  box-shadow: inset 0 0 10px rgba(0,0,0,0.2);
}
.lw-tv-btn {
  background: linear-gradient(to bottom, #4a3a35, #2b201d);
  border: 1px solid #1a1a1a;
  color: #ff9e3d;
  padding: 7px 5px;
  border-radius: 3px;
  cursor: pointer;
  font-family: 'Courier New', monospace;
  font-weight: bold;
  font-size: 10.5px;
  line-height: 1.15;
  text-shadow: 0 0 5px #ff5500;
  box-shadow: 0 3px 0 #1a1a1a, inset 0 1px 0 rgba(255,255,255,0.2);
  transition: all 0.1s;
  text-transform: uppercase;
  min-width: 0;
  white-space: normal;
  overflow-wrap: anywhere;
}
.lw-tv-btn:hover { color: #ffcc00; text-shadow: 0 0 8px #ffcc00; }
.lw-tv-btn.is-active {
  background: #ff9e3d;
  color: #111;
  text-shadow: none;
  box-shadow: 0 1px 0 #1a1a1a, inset 0 2px 4px rgba(0,0,0,0.4);
  transform: translateY(3px);
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
  box-shadow: 2px 4px 10px rgba(0,0,0,0.55);
  position: relative;
  transform: rotate(-0.25deg);
  transition: transform 0.3s;
  max-width: 100%;
  min-width: 0;
  overflow: hidden;
}
.lw-panel:nth-child(even) { transform: rotate(0.25deg); background-color: #f5f5dc; }
.lw-panel:nth-child(3n) { transform: rotate(-0.1deg); }
.lw-panel:hover { transform: rotate(0deg); z-index: 2; }

/* Tape effect for panels */
.lw-panel::before {
  content: '';
  position: absolute;
  top: -8px; left: 50%;
  width: 72px; height: 16px;
  background: rgba(255, 255, 255, 0.4);
  border: 1px solid rgba(0,0,0,0.1);
  transform: translateX(-50%) rotate(2deg);
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  z-index: 10;
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
.lw-panel-head h3 { margin: 0; font-size: 13px; font-weight: 700; letter-spacing: 0.5px; text-transform: uppercase; text-shadow: 1px 1px 0px rgba(0,0,0,0.1); }

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
  min-height: 132px;
  line-height: 1.4;
  font-family: 'Courier New', Courier, monospace;
  font-size: 11.5px;
}

.lw-two { display: grid; grid-template-columns: repeat(auto-fit, minmax(118px, 1fr)); gap: 10px; align-items: start; }
.lw-three { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; align-items: end; }
.lw-three > .lw-btn { grid-column: 1 / -1; }

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

.lw-type-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(96px, 1fr)); gap: 8px; }
.lw-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border: 1px solid #8b7765;
  border-radius: 2px;
  padding: 7px 8px;
  background: #fff;
  box-shadow: 2px 2px 0px rgba(0,0,0,0.1);
}

.lw-banner {
  border: 1px solid #111;
  border-radius: 2px;
  padding: 9px 10px;
  background: #ff9e3d;
  color: #111;
  font-weight: bold;
  box-shadow: 2px 3px 0px rgba(0,0,0,0.3);
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
  box-shadow: 2px 2px 0px rgba(0,0,0,0.2);
}
.lw-details summary { cursor: pointer; padding: 9px 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; }
.lw-details-body { padding: 0 11px 11px; display: grid; gap: 10px; }

/* Retro Digital Clock */
.lw-clock {
  display: grid;
  gap: 9px;
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
.lw-clock-time {
  font-size: clamp(24px, 8vw, 32px);
  line-height: 1;
  font-weight: 700;
  letter-spacing: 1px;
  text-shadow: 0 0 10px #ff5500;
  font-family: 'Courier New', Courier, monospace;
  border-bottom: 2px solid #ff5500;
  padding-bottom: 9px;
  margin-bottom: 4px;
  white-space: nowrap;
}
.lw-clock-row { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; justify-content: center; }
.lw-clock-row .lw-btn { flex: 1 1 94px; min-width: 0; }

.lw-meter-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(118px, 1fr)); gap: 8px; }
.lw-state-card {
  border: 1px solid #8b7765;
  border-radius: 2px;
  background: #fff;
  padding: 9px;
  min-height: 66px;
  display: grid;
  align-content: start;
  gap: 6px;
  box-shadow: 2px 2px 0px rgba(0,0,0,0.1);
}
.lw-state-label { color: #6b5d4f; font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; font-weight: bold; }
.lw-state-value { overflow-wrap: anywhere; font-size: 12px; }

.lw-schedule-strip {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  padding: 3px 3px 9px;
}
.lw-slot {
  flex: 0 0 132px;
  border: 1px solid #8b7765;
  border-radius: 2px;
  background: #f5f5dc;
  padding: 9px;
  display: grid;
  gap: 6px;
  box-shadow: 3px 3px 0px rgba(0,0,0,0.2);
}
.lw-slot.is-now { border-color: #ff5500; box-shadow: 3px 3px 0px #ff5500; background: #fff9e6; }

.lw-runs { display: grid; gap: 8px; }
.lw-scrollbox {
  max-height: min(360px, 42vh);
  overflow-y: auto;
  padding-right: 5px;
}
.lw-run {
  display: grid;
  gap: 5px;
  padding: 9px;
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
  font-size: 10px;
  font-weight: bold;
  border: 1px solid #111;
  text-transform: uppercase;
  border-radius: 0;
}
.lw-status.success, .lw-status.test_success { color: #111; background: #6fb7a6; }
.lw-status.error, .lw-status.timeout, .lw-status.test_error { color: #fff; background: #cf7e7e; }
.lw-status.skipped { color: #111; background: #d8aa63; }

.lw-empty {
  padding: 14px;
  text-align: center;
  color: #6b5d4f;
  border: 1px dashed #8b7765;
  border-radius: 2px;
  background: rgba(255,255,255,0.5);
  font-style: italic;
}

@media (max-width: 520px) {
  .lw-root { padding: 8px 6px; font-size: 11.5px; }
  .lw-shell { gap: 10px; }
  .lw-toolbar { flex-direction: column; align-items: stretch; }
  .lw-actions { width: 100%; justify-content: stretch; }
  .lw-actions .lw-btn { flex: 1; }
  .lw-tv { border-width: 7px; border-radius: 14px; padding: 8px; }
  .lw-tv-screen { border-width: 5px; padding: 8px; }
  .lw-window { height: 64px; }
  .lw-two, .lw-meter-grid, .lw-type-grid { grid-template-columns: 1fr; }
  .lw-clock-time { font-size: 24px; letter-spacing: 0; }
}
`;

type MountedHandle = { destroy(): void };

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function cleanString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value.trim() : fallback;
}

function cleanNullableString(value: unknown): string | null {
  const text = cleanString(value);
  return text ? text : null;
}

function numberInRange(value: unknown, fallback: number, min: number, max: number): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function integerInRange(value: unknown, fallback: number, min: number, max: number): number {
  return Math.round(numberInRange(value, fallback, min, max));
}

function normalizeGenerationTypes(value: unknown): LumiWorldGenerationType[] {
  const incoming = Array.isArray(value) ? value : DEFAULT_SETTINGS.generationTypes;
  const allowed = new Set<string>(VISIBLE_GENERATION_TYPES);
  const normalized = incoming.filter((item): item is LumiWorldGenerationType => typeof item === "string" && allowed.has(item));
  return normalized.length ? [...new Set(normalized)] : [...DEFAULT_SETTINGS.generationTypes];
}

function normalizeWorldAgentSettings(value: unknown): WorldAgentSettings {
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
    updateTemplate: cleanString(obj.updateTemplate, DEFAULT_WORLD_AGENT_UPDATE_TEMPLATE) || DEFAULT_WORLD_AGENT_UPDATE_TEMPLATE,
  };
}

function normalizeSettings(value: unknown): LumiWorldSettings {
  const obj = asRecord(value);
  const storedSystemTemplate = cleanString(obj.systemTemplate, DEFAULT_SYSTEM_TEMPLATE);
  const storedUserTemplate = cleanString(obj.userTemplate, DEFAULT_USER_TEMPLATE);
  const systemTemplate =
    !storedSystemTemplate ||
    storedSystemTemplate === LEGACY_DEFAULT_SYSTEM_TEMPLATE ||
    storedSystemTemplate === PREVIOUS_DEFAULT_SYSTEM_TEMPLATE ||
    storedSystemTemplate === PRE_REBRAND_DEFAULT_SYSTEM_TEMPLATE
      ? DEFAULT_SYSTEM_TEMPLATE
      : storedSystemTemplate;
  const userTemplate =
    !storedUserTemplate ||
    storedUserTemplate === LEGACY_DEFAULT_USER_TEMPLATE ||
    storedUserTemplate === PREVIOUS_DEFAULT_USER_TEMPLATE ||
    storedUserTemplate === PRE_CONTEXT_DEFAULT_USER_TEMPLATE
      ? DEFAULT_USER_TEMPLATE
      : storedUserTemplate;

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
    worldAgent: normalizeWorldAgentSettings(obj.worldAgent),
  };
}

function createElement<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (typeof text === "string") element.textContent = text;
  return element;
}

function activeChat(ctx: SpindleFrontendContext): { chatId: string | null; characterId: string | null } {
  try {
    return ctx.getActiveChat();
  } catch {
    return { chatId: null, characterId: null };
  }
}

function send(ctx: SpindleFrontendContext, message: FrontendToBackend): void {
  const active = activeChat(ctx);
  ctx.sendToBackend({
    ...message,
    chatId: "chatId" in message ? message.chatId ?? active.chatId : active.chatId,
    characterId: "characterId" in message ? message.characterId ?? active.characterId : active.characterId,
  });
}

function cloneSettings(settings: LumiWorldSettings): LumiWorldSettings {
  return normalizeSettings({
    ...settings,
    generationTypes: [...settings.generationTypes],
    worldAgent: { ...settings.worldAgent },
  });
}

function readChatId(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const raw = (payload as { chatId?: unknown; chat_id?: unknown }).chatId ?? (payload as { chat_id?: unknown }).chat_id;
  return typeof raw === "string" && raw.trim() ? raw : null;
}

function readCharacterId(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const raw = (payload as { characterId?: unknown; character_id?: unknown }).characterId ?? (payload as { character_id?: unknown }).character_id;
  return typeof raw === "string" && raw.trim() ? raw : null;
}

function formatStatus(status: RunLogStatus): string {
  return status.replace(/_/g, " ");
}

function formatTime(timestamp: number): string {
  try {
    return new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit", second: "2-digit" }).format(new Date(timestamp));
  } catch {
    return "";
  }
}

function formatClock(state: WorldAgentState | null | undefined): string {
  if (!state) return "Day 1, 08:00";
  return `Day ${state.day}, ${String(state.hour).padStart(2, "0")}:00`;
}

function formatDurationMs(ms: number): string {
  if (ms % 60000 === 0) return `${Math.round(ms / 60000)} min`;
  if (ms % 1000 === 0) return `${Math.round(ms / 1000)} sec`;
  return `${Math.round(ms)} ms`;
}

function formatWorldInfoRunDiagnostics(run: RunLogEntry): string | null {
  const hasDiagnostics = run.worldInfoActivatedCount != null || run.worldInfoFetchedCount != null || run.worldInfoFallbackTaggedCount != null;
  if (!hasDiagnostics) return null;
  return [
    `WI active ${run.worldInfoActivatedCount ?? 0}`,
    `fetched ${run.worldInfoFetchedCount ?? 0}`,
    `tagged fallback ${run.worldInfoFallbackTaggedCount ?? 0}`,
  ].join(" / ");
}

function connectionLabel(connection: ConnectionOption): string {
  const bits = [connection.name, connection.provider, connection.model].filter(Boolean);
  return `${bits.join(" / ")}${connection.hasApiKey ? "" : " (no key)"}`;
}

function settingsKey(settings: LumiWorldSettings): string {
  return JSON.stringify(settings);
}

function stateUiKey(state: FrontendState): string {
  return JSON.stringify({
    connections: state.connections,
    connectionError: state.connectionError ?? null,
    permissions: state.permissions,
    runs: state.runs,
    worldState: state.worldState ?? null,
  });
}

function worldStateCardValue(value: string | null | undefined, fallback = "Unset"): string {
  const text = typeof value === "string" ? value.trim() : "";
  return text || fallback;
}

export function setup(ctx: SpindleFrontendContext) {
  const cleanups: Array<() => void> = [];
  const componentHandles: MountedHandle[] = [];
  let state: FrontendState | null = null;
  let draft = cloneSettings(DEFAULT_SETTINGS);
  let activeChannel: LumiWorldChannel = "director";
  let saveTimer: ReturnType<typeof setTimeout> | null = null;
  let localRevision = 0;
  let saveRevision = 0;
  let saveInFlight = false;
  let notice: { tone: "info" | "warn" | "error" | "success"; text: string } | null = null;

  cleanups.push(ctx.dom.addStyle(CSS));

  const tab = ctx.ui.registerDrawerTab({
    id: "lumi-world",
    title: EXTENSION_NAME,
    shortName: "World",
    headerTitle: "LumiWorld",
    description: "World simulation channels",
    keywords: ["lumiworld", "world", "director", "interceptor", "simulation"],
    iconSvg: LUMIWORLD_ICON,
  });
  cleanups.push(() => tab.destroy());

  function destroyComponents(): void {
    while (componentHandles.length) {
      const handle = componentHandles.pop();
      try {
        handle?.destroy();
      } catch {
        // Host component handles can become stale across hot reloads.
      }
    }
  }

  function scheduleAutoSave(): void {
    if (saveTimer) clearTimeout(saveTimer);
    tab.setBadge("Saving");
    saveTimer = setTimeout(() => {
      saveTimer = null;
      saveRevision = localRevision;
      saveInFlight = true;
      send(ctx, { type: "save_settings", settings: draft });
    }, 450);
  }

  function updateDraft(patch: Partial<LumiWorldSettings>): void {
    draft = normalizeSettings({
      ...draft,
      ...patch,
      worldAgent: normalizeWorldAgentSettings({
        ...draft.worldAgent,
        ...(patch.worldAgent ?? {}),
      }),
    });
    localRevision += 1;
    scheduleAutoSave();
  }

  function updateWorldAgent(patch: Partial<WorldAgentSettings>): void {
    updateDraft({ worldAgent: { ...draft.worldAgent, ...patch } });
  }

  function selectedConnection(connectionId: string | null): ConnectionOption | null {
    if (!state || !connectionId) return null;
    return state.connections.find((connection) => connection.id === connectionId) ?? null;
  }

  function field(label: string, control: HTMLElement, hint?: string): HTMLElement {
    const wrap = createElement("div", "lw-field");
    wrap.appendChild(createElement("label", undefined, label));
    wrap.appendChild(control);
    if (hint) wrap.appendChild(createElement("div", "lw-hint", hint));
    return wrap;
  }

  function numberInput(value: number, min: number, max: number, step: number, onChange: (value: number) => void): HTMLInputElement {
    const input = createElement("input", "lw-input") as HTMLInputElement;
    input.type = "number";
    input.min = String(min);
    input.max = String(max);
    input.step = String(step);
    input.value = String(value);
    input.addEventListener("change", () => onChange(Number(input.value)));
    return input;
  }

  function renderNumberControl(slot: HTMLElement, value: number, min: number, max: number, step: number, onChange: (value: number) => void): void {
    const components = (ctx as any).components;
    if (components?.mountNumberStepper) {
      const handle = components.mountNumberStepper(slot, {
        value,
        min,
        max,
        step,
        onChange: (next: number | null) => {
          if (typeof next === "number" && Number.isFinite(next)) onChange(next);
        },
      }) as MountedHandle;
      componentHandles.push(handle);
      return;
    }
    slot.appendChild(numberInput(value, min, max, step, onChange));
  }

  function numberField(label: string, value: number, min: number, max: number, step: number, onChange: (value: number) => void, hint?: string): HTMLElement {
    const slot = createElement("div");
    renderNumberControl(slot, value, min, max, step, onChange);
    return field(label, slot, hint);
  }

  function renderTextareaControl(slot: HTMLElement, value: string, onChange: (value: string) => void, ariaLabel: string): void {
    const components = (ctx as any).components;
    if (components?.mountTextArea) {
      const handle = components.mountTextArea(slot, { value, rows: 8, ariaLabel, onChange }) as MountedHandle;
      componentHandles.push(handle);
      return;
    }
    const input = createElement("textarea", "lw-textarea") as HTMLTextAreaElement;
    input.value = value;
    input.spellcheck = false;
    input.addEventListener("input", () => onChange(input.value));
    slot.appendChild(input);
  }

  function textareaField(label: string, value: string, onChange: (value: string) => void, hint?: string): HTMLElement {
    const slot = createElement("div");
    renderTextareaControl(slot, value, onChange, label);
    return field(label, slot, hint);
  }

  function renderSwitchControl(slot: HTMLElement, checked: boolean, onChange: (checked: boolean) => void, ariaLabel: string, disabled = false): void {
    const components = (ctx as any).components;
    if (components?.mountSwitch && !disabled) {
      const handle = components.mountSwitch(slot, { checked, size: "md", ariaLabel, onChange }) as MountedHandle;
      componentHandles.push(handle);
      return;
    }
    const input = createElement("input") as HTMLInputElement;
    input.type = "checkbox";
    input.checked = checked;
    input.disabled = disabled;
    input.addEventListener("change", () => onChange(input.checked));
    slot.appendChild(input);
  }

  function toggleField(label: string, checked: boolean, onChange: (checked: boolean) => void, hint?: string, disabled = false): HTMLElement {
    const row = createElement("div", `lw-setting-row${disabled ? " is-disabled" : ""}`);
    const switchSlot = createElement("div", "lw-switch-slot");
    renderSwitchControl(switchSlot, checked, onChange, label, disabled);
    const text = createElement("div");
    text.appendChild(createElement("div", "lw-toggle-label", label));
    if (hint) text.appendChild(createElement("div", "lw-hint", hint));
    row.append(switchSlot, text);
    return row;
  }

  function renderConnectionControl(slot: HTMLElement, value: string | null, onChange: (connectionId: string | null) => void, ariaLabel: string): void {
    const connections = state?.connections ?? [];
    const components = (ctx as any).components;
    const options = connections.map((connection) => ({
      value: connection.id,
      label: connection.name || connection.id,
      sublabel: [connection.provider || null, connection.model || null, connection.hasApiKey ? null : "no API key", connection.isDefault ? "default" : null]
        .filter(Boolean)
        .join(" / "),
      group: connection.provider || "Connections",
      leading: { type: "initial", text: (connection.provider || connection.name || "?").slice(0, 1).toUpperCase() },
    }));

    if (value && !options.some((option) => option.value === value)) {
      options.unshift({
        value,
        label: "Saved connection not found",
        sublabel: value,
        group: "Unavailable",
        leading: { type: "initial", text: "!" },
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
        onChange: (next: string) => {
          onChange(next || null);
          render();
        },
      }) as MountedHandle;
      componentHandles.push(handle);
      return;
    }

    const select = createElement("select", "lw-select") as HTMLSelectElement;
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

  function renderModelControl(slot: HTMLElement, connectionId: string | null, value: string, onChange: (model: string) => void): void {
    const selected = selectedConnection(connectionId);
    const components = (ctx as any).components;
    if (selected && components?.mountModelCombobox) {
      const handle = components.mountModelCombobox(slot, {
        value,
        connection: { kind: "llm", id: selected.id },
        appearance: "standard",
        placeholder: selected.model || "model id",
        browseHint: selected.model ? `Connection default: ${selected.model}` : "No connection default model is configured.",
        onChange,
      }) as MountedHandle;
      componentHandles.push(handle);
      return;
    }

    const input = createElement("input", "lw-input") as HTMLInputElement;
    input.type = "text";
    input.placeholder = selected?.model || "model id";
    input.value = value;
    input.disabled = !selected;
    input.addEventListener("input", () => onChange(input.value));
    slot.appendChild(input);
  }

  function renderConnectionFields(shell: HTMLElement, channel: LumiWorldChannel): void {
    const isDirector = channel === "director";
    const panel = createElement("section", "lw-panel");
    const head = createElement("div", "lw-panel-head");
    head.appendChild(createElement("h3", undefined, isDirector ? "Controller" : "World Agent Model"));
    panel.appendChild(head);

    const form = createElement("div", "lw-form");
    const connectionSlot = createElement("div");
    form.appendChild(field("Connection", connectionSlot, "Use a Lumiverse LLM connection profile. API keys stay inside Lumiverse."));
    renderConnectionControl(
      connectionSlot,
      isDirector ? draft.connectionId : draft.worldAgent.connectionId,
      (connectionId) => isDirector
        ? updateDraft({ connectionId, modelOverride: "" })
        : updateWorldAgent({ connectionId, modelOverride: "" }),
      isDirector ? "Director Note connection" : "World Agent connection",
    );

    const modelSlot = createElement("div");
    form.appendChild(field("Model override", modelSlot, "Leave blank to use the selected connection's configured model."));
    renderModelControl(
      modelSlot,
      isDirector ? draft.connectionId : draft.worldAgent.connectionId,
      isDirector ? draft.modelOverride : draft.worldAgent.modelOverride,
      (model) => isDirector ? updateDraft({ modelOverride: model }) : updateWorldAgent({ modelOverride: model }),
    );

    const two = createElement("div", "lw-two");
    if (isDirector) {
      two.append(
        numberField("Temperature", draft.temperature, 0, 2, 0.05, (value) => updateDraft({ temperature: value })),
        numberField("Max tokens", draft.maxTokens, 64, MAX_CONTROLLER_OUTPUT_TOKENS, 1, (value) => updateDraft({ maxTokens: value })),
        numberField("Timeout ms", draft.timeoutMs, 1000, MAX_CONTROLLER_TIMEOUT_MS, 1000, (value) => updateDraft({ timeoutMs: value })),
        numberField("Chat history", draft.historyMessageLimit, 0, MAX_CHAT_HISTORY_MESSAGES, 1, (value) => updateDraft({ historyMessageLimit: value })),
        numberField("Prompt cap chars", draft.maxInputChars, 4000, 500000, 1000, (value) => updateDraft({ maxInputChars: value })),
      );
    } else {
      two.append(
        numberField("Temperature", draft.worldAgent.temperature, 0, 2, 0.05, (value) => updateWorldAgent({ temperature: value })),
        numberField("Max tokens", draft.worldAgent.maxTokens, 64, MAX_CONTROLLER_OUTPUT_TOKENS, 1, (value) => updateWorldAgent({ maxTokens: value })),
        numberField("Timeout ms", draft.worldAgent.timeoutMs, 1000, MAX_CONTROLLER_TIMEOUT_MS, 1000, (value) => updateWorldAgent({ timeoutMs: value })),
        numberField("Hour duration ms", draft.worldAgent.hourDurationMs, 1000, 365 * 24 * 60 * 60 * 1000, 1000, (value) => updateWorldAgent({ hourDurationMs: value }), `Current: ${formatDurationMs(draft.worldAgent.hourDurationMs)}`),
      );
    }
    form.appendChild(two);
    panel.appendChild(form);
    shell.appendChild(panel);
  }

  function renderDirectorChannel(shell: HTMLElement): void {
    const enabled = createElement("section", "lw-panel");
    const head = createElement("div", "lw-panel-head");
    head.appendChild(createElement("h3", undefined, "Director Note"));
    head.appendChild(createElement("span", "lw-muted", BREAKDOWN_NAME));
    enabled.appendChild(head);
    enabled.appendChild(toggleField("Enable Director Note", draft.enabled, (checked) => updateDraft({ enabled: checked }), "Visible generations receive a private director note before the main model replies."));
    shell.appendChild(enabled);

    renderConnectionFields(shell, "director");
    renderGenerationTypes(shell);
    renderDirectorAdvanced(shell);
    renderRuns(shell, "director");
  }

  function renderGenerationTypes(shell: HTMLElement): void {
    const panel = createElement("section", "lw-panel");
    const head = createElement("div", "lw-panel-head");
    head.appendChild(createElement("h3", undefined, "Runs On"));
    head.appendChild(createElement("span", "lw-muted", "Quiet jobs are skipped"));
    panel.appendChild(head);

    const grid = createElement("div", "lw-type-grid");
    const components = (ctx as any).components;
    for (const type of VISIBLE_GENERATION_TYPES) {
      const updateType = (checked: boolean) => {
        const next = new Set<LumiWorldGenerationType>(draft.generationTypes);
        if (checked) next.add(type);
        else next.delete(type);
        updateDraft({ generationTypes: [...next] });
      };

      if (components?.mountCheckbox) {
        const slot = createElement("div");
        const handle = components.mountCheckbox(slot, {
          checked: draft.generationTypes.includes(type),
          label: type,
          onChange: updateType,
        }) as MountedHandle;
        componentHandles.push(handle);
        grid.appendChild(slot);
      } else {
        const label = createElement("label", "lw-chip") as HTMLLabelElement;
        const input = createElement("input") as HTMLInputElement;
        input.type = "checkbox";
        input.checked = draft.generationTypes.includes(type);
        input.addEventListener("change", () => updateType(input.checked));
        label.append(input, document.createTextNode(type));
        grid.appendChild(label);
      }
    }
    panel.appendChild(grid);
    shell.appendChild(panel);
  }

  function renderDirectorAdvanced(shell: HTMLElement): void {
    const details = createElement("details", "lw-details") as HTMLDetailsElement;
    const summary = createElement("summary", undefined, "Advanced Settings");
    const body = createElement("div", "lw-details-body");
    const entriesHint = state?.permissions.worldBooks === false
      ? "Grant World Books permission to fetch activated entry content. Without it, LumiWorld can only use tagged standalone prompt entries."
      : "Fetch activated World Info entry content and send it to the controller.";
    body.append(
      toggleField("Entries", draft.includeWorldInfoEntries, (checked) => updateDraft({ includeWorldInfoEntries: checked }), entriesHint),
      toggleField("User persona", draft.includeUserPersona, (checked) => updateDraft({ includeUserPersona: checked }), "Send the active user persona to the controller."),
      toggleField("Character", draft.includeCharacter, (checked) => updateDraft({ includeCharacter: checked }), "Send the active character card to the controller."),
      textareaField("Additional notes", draft.additionalNotes, (value) => updateDraft({ additionalNotes: value }), "Always sent to the LumiWorld controller as a private system message."),
      textareaField("System template", draft.systemTemplate, (value) => updateDraft({ systemTemplate: value }), "Available variables: {{prompt}}, {{generationType}}, {{chatId}}, {{connectionId}}, {{timestamp}}, {{maxDirectiveChars}}, {{user}}, {{char}}."),
      textareaField("User template", draft.userTemplate, (value) => updateDraft({ userTemplate: value })),
      numberField("Run log limit", draft.runLogLimit, 0, 50, 1, (value) => updateDraft({ runLogLimit: value })),
    );
    details.append(summary, body);
    shell.appendChild(details);
  }

  function renderWorldAgentChannel(shell: HTMLElement): void {
    renderWorldAgentClock(shell);

    const settingsPanel = createElement("section", "lw-panel");
    const head = createElement("div", "lw-panel-head");
    head.appendChild(createElement("h3", undefined, "Channel"));
    head.appendChild(createElement("span", "lw-muted", WORLD_AGENT_BREAKDOWN_NAME));
    settingsPanel.appendChild(head);
    settingsPanel.append(
      toggleField("Enable World Agent", draft.worldAgent.enabled, (checked) => updateWorldAgent({ enabled: checked }), "Use per-chat simulation state for this channel."),
      toggleField("Inject state", draft.worldAgent.injectState, (checked) => updateWorldAgent({ injectState: checked }), "Add the current World Agent state to visible prompt generations."),
      toggleField("Visible-only ticks", draft.worldAgent.autoTickVisibleOnly, (checked) => updateWorldAgent({ autoTickVisibleOnly: checked }), "Automatic ticks only run while Lumiverse is visible."),
    );
    shell.appendChild(settingsPanel);

    renderConnectionFields(shell, "world_agent");
    renderWorldAgentState(shell);
    renderWorldAgentSchedule(shell);
    renderWorldAgentAdvanced(shell);
    renderRuns(shell, "world_agent");
  }

  function renderWorldAgentClock(shell: HTMLElement): void {
    const panel = createElement("section", "lw-clock");
    const stateNow = state?.worldState ?? null;
    const top = createElement("div", "lw-clock-row");
    top.append(
      createElement("div", "lw-clock-time", formatClock(stateNow)),
      createElement("span", "lw-muted", stateNow?.running ? "running" : "paused"),
    );
    panel.appendChild(top);

    const actions = createElement("div", "lw-clock-row");
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

    const timeRow = createElement("div", "lw-three");
    const dayInput = numberInput(stateNow?.day ?? 1, 1, Number.MAX_SAFE_INTEGER, 1, () => {});
    const hourInput = numberInput(stateNow?.hour ?? 8, 0, 23, 1, () => {});
    const setButton = createElement("button", "lw-btn", "Set Time");
    setButton.type = "button";
    setButton.addEventListener("click", () => send(ctx, { type: "world_agent_set_time", day: Number(dayInput.value), hour: Number(hourInput.value) }));
    timeRow.append(field("Day", dayInput), field("Hour", hourInput), setButton);
    panel.appendChild(timeRow);
    shell.appendChild(panel);
  }

  function renderWorldAgentState(shell: HTMLElement): void {
    const panel = createElement("section", "lw-panel");
    const head = createElement("div", "lw-panel-head");
    head.appendChild(createElement("h3", undefined, "Current State"));
    if (state?.worldState?.updatedAt) head.appendChild(createElement("span", "lw-muted", `Updated ${formatTime(state.worldState.updatedAt)}`));
    panel.appendChild(head);

    const grid = createElement("div", "lw-meter-grid");
    const current = state?.worldState ?? null;
    const cards = [
      ["Location", worldStateCardValue(current?.location)],
      ["Mood", worldStateCardValue(current?.mood, "Neutral")],
      ["Activity", worldStateCardValue(current?.activity, "Idle")],
      ["Goal", worldStateCardValue(current?.goal)],
      ["Thought", worldStateCardValue(current?.thought)],
      ["Schedule", current?.schedule?.length ? `${current.schedule.length} entries` : "No schedule"],
    ];
    for (const [label, value] of cards) {
      const card = createElement("div", "lw-state-card");
      card.append(createElement("div", "lw-state-label", label), createElement("div", "lw-state-value", value));
      grid.appendChild(card);
    }
    panel.appendChild(grid);

    const history = current?.history ?? [];
    const box = createElement("div", "lw-scrollbox");
    box.style.marginTop = "16px";
    if (!history.length) {
      box.appendChild(createElement("div", "lw-empty", "No World Agent activity yet."));
    } else {
      const list = createElement("div", "lw-runs");
      for (const entry of history) {
        const item = createElement("article", "lw-run");
        const row = createElement("div", "lw-run-head");
        row.append(createElement("strong", undefined, entry.action.replace(/_/g, " ")), createElement("span", "lw-muted", `Day ${entry.day}, ${String(entry.hour).padStart(2, "0")}:00`));
        item.appendChild(row);
        if (entry.preview) item.appendChild(createElement("div", undefined, entry.preview));
        if (entry.error) item.appendChild(createElement("div", "lw-muted", entry.error));
        item.appendChild(createElement("div", "lw-muted", formatTime(entry.timestamp)));
        list.appendChild(item);
      }
      box.appendChild(list);
    }
    panel.appendChild(box);
    shell.appendChild(panel);
  }

  function renderWorldAgentSchedule(shell: HTMLElement): void {
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
      if (item.location) slot.appendChild(createElement("div", "lw-muted", item.location));
      slot.appendChild(createElement("div", undefined, item.activity || "Unspecified activity"));
      if (item.mood) slot.appendChild(createElement("div", "lw-muted", `Mood: ${item.mood}`));
      if (item.goal) slot.appendChild(createElement("div", "lw-muted", `Goal: ${item.goal}`));
      strip.appendChild(slot);
    }
    panel.appendChild(strip);
    shell.appendChild(panel);
  }

  function renderWorldAgentAdvanced(shell: HTMLElement): void {
    const details = createElement("details", "lw-details") as HTMLDetailsElement;
    const summary = createElement("summary", undefined, "Advanced Settings");
    const body = createElement("div", "lw-details-body");
    body.append(
      textareaField("Schedule template", draft.worldAgent.scheduleTemplate, (value) => updateWorldAgent({ scheduleTemplate: value }), "Variables: {{chatId}}, {{user}}, {{char}}, {{day}}, {{hour}}, {{time}}, {{state}}, {{schedule}}, {{timestamp}}."),
      textareaField("Update template", draft.worldAgent.updateTemplate, (value) => updateWorldAgent({ updateTemplate: value }), "Variables: {{chatId}}, {{user}}, {{char}}, {{day}}, {{hour}}, {{time}}, {{state}}, {{schedule}}, {{timestamp}}."),
    );
    details.append(summary, body);
    shell.appendChild(details);
  }

  function renderRuns(shell: HTMLElement, channel: LumiWorldChannel): void {
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
      if (title) item.appendChild(createElement("div", "lw-muted", title));
      const meta = [run.connectionName, run.model, run.durationMs != null ? `${Math.round(run.durationMs)} ms` : null].filter(Boolean).join(" / ");
      if (meta) item.appendChild(createElement("div", "lw-muted", meta));
      const worldTime = run.worldAgentDay ? `Day ${run.worldAgentDay}, ${String(run.worldAgentHour ?? 0).padStart(2, "0")}:00` : null;
      if (worldTime) item.appendChild(createElement("div", "lw-muted", worldTime));
      const wi = formatWorldInfoRunDiagnostics(run);
      if (wi) item.appendChild(createElement("div", "lw-muted", wi));
      if (run.directivePreview) item.appendChild(createElement("div", undefined, run.directivePreview));
      if (run.error) item.appendChild(createElement("div", "lw-muted", run.error));
      if (run.worldInfoFetchError) item.appendChild(createElement("div", "lw-muted", `World Info fetch: ${run.worldInfoFetchError}`));
      list.appendChild(item);
    }
    scroll.appendChild(list);
    panel.appendChild(scroll);
    shell.appendChild(panel);
  }

  function renderNotice(shell: HTMLElement): void {
    if (!notice) return;
    const div = createElement("div", `lw-banner ${notice.tone === "warn" || notice.tone === "error" ? notice.tone : ""}`, notice.text);
    shell.appendChild(div);
  }

  function renderBanners(shell: HTMLElement): void {
    if (!state) return;
    const missingPermissions = [
      !state.permissions.interceptor ? "Interceptor" : null,
      !state.permissions.generation ? "Generation" : null,
      (draft.includeCharacter || draft.worldAgent.enabled) && !state.permissions.chats ? "Chats" : null,
      (draft.includeCharacter || draft.worldAgent.enabled) && !state.permissions.characters ? "Characters" : null,
      (draft.includeUserPersona || draft.worldAgent.enabled) && !state.permissions.personas ? "Personas" : null,
      draft.includeWorldInfoEntries && !state.permissions.worldBooks ? "World Books" : null,
    ].filter(Boolean);
    if (missingPermissions.length) {
      shell.appendChild(createElement("div", "lw-banner warn", `Grant ${missingPermissions.join(", ")} permission${missingPermissions.length === 1 ? "" : "s"} in Lumiverse's Extensions panel.`));
    }
    if (state.connectionError) shell.appendChild(createElement("div", "lw-banner warn", state.connectionError));
    if (draft.enabled && !draft.connectionId) shell.appendChild(createElement("div", "lw-banner warn", "Director Note is enabled but no controller connection is selected."));
    if (draft.worldAgent.enabled && !draft.worldAgent.connectionId) shell.appendChild(createElement("div", "lw-banner warn", "World Agent is enabled but no model connection is selected."));
  }

  function renderToolbar(shell: HTMLElement): void {
    // 1. LED Sign on the brick wall
    const ledSign = createElement("div", "lw-led-sign", `${EXTENSION_NAME} ${EXTENSION_VERSION}`);
    shell.appendChild(ledSign);

    // 2. Window on the brick wall
    const windowEl = createElement("div", "lw-window");
    const stars = createElement("div", "lw-stars");
    windowEl.appendChild(stars);
    shell.appendChild(windowEl);

    // 3. Original Toolbar setup, stylized to fit the room
    const toolbar = createElement("div", "lw-toolbar");
    const title = createElement("div", "lw-title");
    const mark = createElement("span", "lw-mark");
    mark.innerHTML = LUMIWORLD_ICON;
    const text = createElement("div");
    text.append(createElement("h2", "lw-heading", "Control Deck"), createElement("div", "lw-muted", "Lofi world simulation deck"));
    title.append(mark, text);

    const actions = createElement("div", "lw-actions");
    const refresh = createElement("button", "lw-btn", "Refresh");
    refresh.type = "button";
    refresh.addEventListener("click", () => send(ctx, { type: "refresh_state" }));
    const test = createElement("button", "lw-btn", "Test");
    test.type = "button";
    test.addEventListener("click", () => {
      notice = { tone: "info", text: "Running controller test..." };
      render();
      send(ctx, { type: "test_controller", settings: draft });
    });
    actions.append(refresh, test);
    toolbar.append(title, actions);
    shell.appendChild(toolbar);
  }

  function render(): void {
    destroyComponents();
    tab.root.replaceChildren();

    const root = createElement("div", "lw-root");
    const shell = createElement("div", "lw-shell");
    root.appendChild(shell);
    tab.root.appendChild(root);

    renderToolbar(shell);
    renderNotice(shell);

    if (!state) {
      shell.appendChild(createElement("div", "lw-empty", "Loading LumiWorld settings..."));
      return;
    }

    renderBanners(shell);
    
    // Construct the Box TV container
    const tv = createElement("div", "lw-tv");
    const tvScreen = createElement("div", "lw-tv-screen");
    
    // TV Channel Controls (replaces standard tabs)
    const tvControls = createElement("div", "lw-tv-controls");
    const channels: Array<[LumiWorldChannel, string]> = [
      ["director", "CH 1: Director"],
      ["world_agent", "CH 2: World Agent"],
    ];
    for (const [channel, label] of channels) {
      const button = createElement("button", `lw-tv-btn${activeChannel === channel ? " is-active" : ""}`, label);
      button.type = "button";
      button.addEventListener("click", () => {
        activeChannel = channel;
        render();
      });
      tvControls.appendChild(button);
    }
    
    tvScreen.appendChild(tvControls);
    
    if (activeChannel === "director") renderDirectorChannel(tvScreen);
    else renderWorldAgentChannel(tvScreen);
    
    tv.appendChild(tvScreen);
    shell.appendChild(tv);
  }

  const onBackendMessage = ctx.onBackendMessage((raw) => {
    const message = raw as BackendToFrontend;
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
        if (shouldRender) render();
        break;
      }
      case "settings_saved":
        saveInFlight = false;
        if (saveRevision === localRevision) {
          draft = cloneSettings(message.settings);
          if (state) state = { ...state, settings: message.settings };
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
        notice = message.ok
          ? { tone: "success", text: message.message || "World Agent updated." }
          : { tone: "error", text: message.error };
        if (message.state && state) state = { ...state, worldState: message.state };
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
        saveInFlight = false;
        if (!saveTimer && localRevision === saveRevision) tab.setBadge("Error");
        notice = { tone: "error", text: message.message };
        render();
        break;
    }
  });
  cleanups.push(onBackendMessage);

  const events = ctx.events;
  cleanups.push(
    events.on("CHAT_CHANGED", (payload: unknown) => {
      const chatId = readChatId(payload);
      const characterId = readCharacterId(payload);
      send(ctx, { type: "refresh_state", chatId, characterId });
      send(ctx, { type: "refresh_world_state", chatId, characterId });
    }),
  );

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
      } catch {
        // Ignore cleanup errors during extension unload.
      }
    }
  };
}
