import type { LumiWorldSettings, WorldAgentSettings, WorldAgentState, ConnectionOption, RunLogEntry } from "./shared";

export interface PermissionState {
  interceptor: boolean;
  generation: boolean;
  chats: boolean;
  chatMutation: boolean;
  characters: boolean;
  personas: boolean;
  worldBooks: boolean;
}

export interface FrontendState {
  settings: LumiWorldSettings;
  connections: ConnectionOption[];
  connectionError?: string | null;
  runs: RunLogEntry[];
  permissions: PermissionState;
  worldState?: WorldAgentState | null;
}

export type FrontendToBackend =
  | { type: "ready"; chatId?: string | null; characterId?: string | null }
  | { type: "refresh_state"; chatId?: string | null; characterId?: string | null }
  | { type: "refresh_world_state"; chatId?: string | null; characterId?: string | null }
  | { type: "save_settings"; settings: Partial<LumiWorldSettings>; chatId?: string | null; characterId?: string | null }
  | { type: "save_world_settings"; settings: Partial<WorldAgentSettings>; chatId?: string | null; characterId?: string | null }
  | { type: "test_controller"; settings?: Partial<LumiWorldSettings>; chatId?: string | null; characterId?: string | null }
  | { type: "clear_runs"; chatId?: string | null }
  | { type: "world_agent_start"; chatId?: string | null; characterId?: string | null }
  | { type: "world_agent_pause"; chatId?: string | null; characterId?: string | null }
  | { type: "world_agent_advance_hour"; chatId?: string | null; characterId?: string | null }
  | { type: "world_agent_regenerate_schedule"; chatId?: string | null; characterId?: string | null }
  | { type: "world_agent_reset"; chatId?: string | null; characterId?: string | null }
  | { type: "world_agent_set_time"; chatId?: string | null; characterId?: string | null; day?: number; hour: number };

export type BackendToFrontend =
  | { type: "state"; state: FrontendState }
  | { type: "settings_saved"; settings: LumiWorldSettings }
  | { type: "world_state"; state: WorldAgentState | null }
  | { type: "world_agent_result"; ok: true; message?: string; state?: WorldAgentState | null; rawOutput?: string | null }
  | { type: "world_agent_result"; ok: false; error: string; state?: WorldAgentState | null; rawOutput?: string | null }
  | { type: "run_logged"; run: RunLogEntry }
  | { type: "test_result"; ok: true; directive: string; durationMs: number; model: string; connectionName: string }
  | { type: "test_result"; ok: false; error: string }
  | { type: "error"; message: string };
