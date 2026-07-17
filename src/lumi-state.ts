import type { WorldAgentState } from "./shared";

export const LUMI_STATE_PROTOCOL = "lumi_state.v1" as const;
export const LUMI_STATE_SCHEMA_VERSION = 1 as const;
export const LUMI_WORLD_STATE_ENDPOINT = "agent_world.state.current";

export interface LumiStateProvenanceV1 {
  extensionId: string;
  method: string;
  observedAt: number;
  confidence?: number;
}

export interface LumiStateEntityRefV1 {
  namespace: string;
  id: string;
  kind: "character" | "persona" | "npc" | "object" | "thread";
}

export type LumiStateSubjectV1 =
  | { kind: "scene" }
  | { kind: "actor"; actor: LumiStateEntityRefV1 };

export interface LumiStateTimeClaimV1 {
  id: string;
  subject: LumiStateSubjectV1;
  clock: string;
  date: string | null;
  time: string | null;
  day: number | null;
  hour: number | null;
  running: boolean | null;
  timezone: string | null;
  provenance: LumiStateProvenanceV1;
}

export interface LumiStateSceneV1 {
  locations: unknown[];
  times: LumiStateTimeClaimV1[];
  cast: unknown[];
  objects: unknown[];
  conditions: unknown[];
  threads: unknown[];
}

export interface LumiStateSnapshotV1 {
  protocol: typeof LUMI_STATE_PROTOCOL;
  schemaVersion: typeof LUMI_STATE_SCHEMA_VERSION;
  source: {
    extensionId: string;
    extensionVersion: string;
    endpoint: string;
  };
  chatId: string | null;
  revision: number;
  freshness: "fresh" | "stale" | "unavailable";
  generatedAt: number;
  updatedAt: number | null;
  visibility: "public";
  state: LumiStateSceneV1;
}

export function makeWorldLumiStateSnapshot(
  chatId: string | null,
  state: WorldAgentState | null,
  extensionVersion: string,
  generatedAt = Date.now(),
): LumiStateSnapshotV1 {
  const hasState = !!chatId && !!state;
  const scene: LumiStateSceneV1 = {
    locations: [],
    times: hasState ? [{
      id: "simulation-clock",
      subject: { kind: "scene" },
      clock: "simulation",
      date: null,
      time: null,
      day: state.day,
      hour: state.hour,
      running: state.running,
      timezone: null,
      provenance: {
        extensionId: "agent_world",
        method: "simulation",
        observedAt: state.updatedAt,
        confidence: 1,
      },
    }] : [],
    cast: [],
    objects: [],
    conditions: [],
    threads: [],
  };

  return {
    protocol: LUMI_STATE_PROTOCOL,
    schemaVersion: LUMI_STATE_SCHEMA_VERSION,
    source: {
      extensionId: "agent_world",
      extensionVersion,
      endpoint: LUMI_WORLD_STATE_ENDPOINT,
    },
    chatId,
    revision: hasState ? state.revision : 0,
    freshness: hasState ? "fresh" : "unavailable",
    generatedAt,
    updatedAt: hasState ? state.updatedAt : null,
    visibility: "public",
    state: scene,
  };
}
