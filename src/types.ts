import type { LumiWorldSettings, ConnectionOption, DecisionModelOption, RunLogEntry } from "./shared";

export interface PermissionState {
  interceptor: boolean;
  generation: boolean;
  chats: boolean;
  characters: boolean;
  personas: boolean;
  worldBooks: boolean;
  decisions: boolean;
}

export interface FrontendState {
  settings: LumiWorldSettings;
  connections: ConnectionOption[];
  connectionError?: string | null;
  runs: RunLogEntry[];
  permissions: PermissionState;
  decisionConnections: ConnectionOption[];
  decisionConnectionError: string | null;
  /** Whether the host advertises decisions-v1 and provides the Decisions API. */
  decisionsAvailable: boolean;
  /** Gate policy settings are keyed by gate id; the catalog itself ships with the frontend. */
  activeGateCount: number;
}

export type FrontendToBackend =
  | { type: "ready"; chatId?: string | null; characterId?: string | null }
  | { type: "refresh_state"; chatId?: string | null; characterId?: string | null }
  | { type: "save_settings"; revision: number; settings: Partial<LumiWorldSettings>; chatId?: string | null; characterId?: string | null }
  | { type: "test_controller"; settings?: Partial<LumiWorldSettings>; chatId?: string | null; characterId?: string | null }
  | { type: "test_jev"; settings?: Partial<LumiWorldSettings>; chatId?: string | null; characterId?: string | null }
  | { type: "get_decision_models"; connectionId: string | null; requestId?: number; chatId?: string | null; characterId?: string | null };

export type BackendToFrontend =
  | { type: "state"; state: FrontendState }
  | { type: "settings_saved"; revision: number; settings: LumiWorldSettings }
  | { type: "settings_save_error"; revision: number; message: string }
  | { type: "run_logged"; run: RunLogEntry }
  | { type: "test_result"; ok: true; directive: string; durationMs: number; model: string; connectionName: string }
  | { type: "test_result"; ok: false; error: string }
  | { type: "jev_test_result"; ok: true; latencyMs: number; model: string; provider: string; answer: string; confidence: number | null }
  | { type: "jev_test_result"; ok: false; error: string }
  | { type: "decision_models"; connectionId: string | null; requestId?: number; models: DecisionModelOption[]; error: string | null }
  | { type: "error"; message: string };
