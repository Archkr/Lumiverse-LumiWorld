import type { LumiWorldSettings, ConnectionOption, RunLogEntry } from "./shared";

export interface PermissionState {
  interceptor: boolean;
  generation: boolean;
  chats: boolean;
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
}

export type FrontendToBackend =
  | { type: "ready"; chatId?: string | null }
  | { type: "refresh_state"; chatId?: string | null }
  | { type: "save_settings"; settings: Partial<LumiWorldSettings>; chatId?: string | null }
  | { type: "test_controller"; settings?: Partial<LumiWorldSettings>; chatId?: string | null }
  | { type: "clear_runs"; chatId?: string | null };

export type BackendToFrontend =
  | { type: "state"; state: FrontendState }
  | { type: "settings_saved"; settings: LumiWorldSettings }
  | { type: "run_logged"; run: RunLogEntry }
  | { type: "test_result"; ok: true; directive: string; durationMs: number; model: string; connectionName: string }
  | { type: "test_result"; ok: false; error: string }
  | { type: "error"; message: string };
