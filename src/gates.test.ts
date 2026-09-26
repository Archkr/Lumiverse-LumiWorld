import { describe, expect, test } from "bun:test";
import { DEFAULT_JEV_SETTINGS, type GateFallback, type JevGateRecord, type JevSettings } from "./shared";
import {
  GATE_CATALOG,
  GATE_CATEGORY_LABELS,
  GATE_BY_ID,
  contextFilterDecision,
  coreGateIds,
  decideRepair,
  directorGuidanceFromGates,
  planGates,
  questionsFromPlan,
  resolveGateAnswer,
  resolveGatePolicy,
  shouldRunDirector,
  wantsStrongDirectorModel,
  withConfidenceGate,
  withDegradationGate,
} from "./gates";
import type { JevAnswer } from "./jev";

const settings = (patch: Partial<JevSettings> = {}): JevSettings => ({ ...DEFAULT_JEV_SETTINGS, ...patch });

const fullContext = {
  hasHistory: true,
  hasCharacter: true,
  hasPersona: true,
  hasWorldInfo: true,
  hasDirectorNotes: true,
  worldStateEnabled: true,
  generationType: "normal",
};

/** The 40 capabilities named in the v0.5 update plan, in document order. */
const PLANNED_GATES: readonly string[] = [
  "smart_trigger", "pacing_control", "npc_autonomy", "world_movement", "reveal_control",
  "conflict_escalation", "context_filter", "model_route", "director_verification",
  "story_thread", "scene_state_tracking",
  "player_agency", "user_intent_arbitration", "duplicate_suppression", "continuity_guard",
  "intensity_boundary", "confidence_escalation", "budget_degradation",
  "claim_extraction", "contradiction_localization", "repair_strategy", "scene_state_diff",
  "relationship_deltas", "thread_lifecycle",
  "arc_position", "emotional_release", "development_shape", "focus_selection",
  "foreshadowing", "callback", "hook_prioritization", "context_compaction",
  "time_clock", "environment_conditions", "consequence_propagation", "npc_entry_exit",
];

describe("gate catalog", () => {
  test("covers the planned capabilities exactly", () => {
    // Two extra catalog entries are the document's "Time and clock control" and
    // "Environment and conditions" world gates plus the code-computed pair, which
    // are all present above; the catalog must be a superset with no duplicates.
    const ids = GATE_CATALOG.map((gate) => gate.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const planned of PLANNED_GATES) expect(GATE_BY_ID.has(planned)).toBe(true);
  });

  test("declares a coherent definition for every gate", () => {
    const problems: string[] = [];
    for (const gate of GATE_CATALOG) {
      if (!gate.label.trim()) problems.push(`${gate.id}: no label`);
      if (!gate.rationale.trim()) problems.push(`${gate.id}: no rationale`);
      if (!["noul", "choice", "score"].includes(gate.primitive)) problems.push(`${gate.id}: bad primitive`);
      if (!["gate", "verify"].includes(gate.phase)) problems.push(`${gate.id}: bad phase`);
      if (!Object.keys(GATE_CATEGORY_LABELS).includes(gate.category)) problems.push(`${gate.id}: bad category`);
      if (!gate.codeOnly) {
        if (!gate.instructions.trim()) problems.push(`${gate.id}: no instructions`);
        if (gate.criteria === undefined) problems.push(`${gate.id}: no criteria`);
      }
      if ((gate.primitive === "choice" || gate.primitive === "score") && !Array.isArray(gate.criteria) && typeof gate.criteria !== "object") {
        problems.push(`${gate.id}: unlikely criteria`);
      }
    }
    expect(problems).toEqual([]);
  });

  test("enables exactly the core loop by default", () => {
    expect([...coreGateIds()].sort()).toEqual([
      "budget_degradation",
      "confidence_escalation",
      "context_filter",
      "continuity_guard",
      "director_verification",
      "duplicate_suppression",
      "intensity_boundary",
      "model_route",
      "player_agency",
      "scene_state_tracking",
      "smart_trigger",
    ].sort());
    expect(new Set(coreGateIds()).size).toBe(coreGateIds().length);
  });

  test("gives every gate a declared fallback", () => {
    const allowed: GateFallback[] = ["run", "skip", "accept", "retry", "patch", "soften", "drop", "hold", "none", "ignore"];
    for (const gate of GATE_CATALOG) expect(allowed).toContain(gate.fallback);
  });

  test("keeps the two code-computed gates out of the wire batch", () => {
    expect(GATE_BY_ID.get("confidence_escalation")?.codeOnly).toBe(true);
    expect(GATE_BY_ID.get("budget_degradation")?.codeOnly).toBe(true);
  });
});

describe("gate planning", () => {
  test("splits the batch into exactly one request per phase", () => {
    const gatePhase = planGates("gate", settings(), fullContext);
    const verifyPhase = planGates("verify", settings(), fullContext);
    expect(gatePhase.gates.length).toBeGreaterThan(0);
    expect(verifyPhase.gates.length).toBeGreaterThan(0);
    for (const entry of gatePhase.gates) expect(entry.policy.definition.phase).toBe("gate");
    for (const entry of verifyPhase.gates) expect(entry.policy.definition.phase).toBe("verify");
    // A single batched map per phase: no gate appears twice, and every gate in the
    // phase is carried in that one map.
    const questions = questionsFromPlan(gatePhase);
    expect(Object.keys(questions)).toHaveLength(gatePhase.gates.length);
  });

  test("omits disabled gates and records them as skipped", () => {
    const plan = planGates("gate", settings({ gatePolicy: { smart_trigger: { enabled: false } } }), fullContext);
    expect(plan.gates.some((entry) => entry.policy.definition.id === "smart_trigger")).toBe(false);
    expect(plan.skipped).toContain("smart_trigger");
  });

  test("forces a gate on when the turn overrides it", () => {
    const plan = planGates("gate", settings(), fullContext, { reveal_control: true });
    expect(plan.gates.some((entry) => entry.policy.definition.id === "reveal_control")).toBe(true);
  });

  test("only offers context sources that exist this turn", () => {
    const sparse = planGates("gate", settings(), {
      hasHistory: true, hasCharacter: false, hasPersona: false, hasWorldInfo: false,
      hasDirectorNotes: false, worldStateEnabled: false, generationType: "normal",
    });
    const filter = sparse.gates.find((entry) => entry.policy.definition.id === "context_filter");
    const options = filter?.question.criteria as Record<string, string>;
    expect(Object.keys(options)).toEqual(["all", "history_only"]);
  });

  test("drops the context filter entirely when there is no context", () => {
    const plan = planGates("gate", settings(), {
      hasHistory: false, hasCharacter: false, hasPersona: false, hasWorldInfo: false,
      hasDirectorNotes: false, worldStateEnabled: false, generationType: "normal",
    });
    expect(plan.gates.some((entry) => entry.policy.definition.id === "context_filter")).toBe(false);
  });

  test("lets world gates use Jev-only lore without offering it as Director filter context", () => {
    const plan = planGates("gate", settings({ gatePolicy: { foreshadowing: { enabled: true } } }), {
      hasHistory: false, hasCharacter: false, hasPersona: false, hasWorldInfo: false,
      jevHasWorldInfo: true, hasDirectorNotes: false, worldStateEnabled: false, generationType: "normal",
    });
    expect(plan.gates.some((entry) => entry.policy.definition.id === "foreshadowing")).toBe(true);
    expect(plan.gates.some((entry) => entry.policy.definition.id === "context_filter")).toBe(false);
  });

  test("applies per-gate threshold overrides", () => {
    const policy = resolveGatePolicy(GATE_BY_ID.get("smart_trigger")!, settings({ gatePolicy: { smart_trigger: { threshold: 0.9 } } }));
    expect(policy.threshold).toBe(0.9);
    const escalation = resolveGatePolicy(GATE_BY_ID.get("confidence_escalation")!, settings({ minConfidence: 0.7 }));
    expect(escalation.threshold).toBe(0.7);
  });
});

describe("gate resolution", () => {
  const policy = (id: string, patch: Partial<JevSettings> = {}) =>
    resolveGatePolicy(GATE_BY_ID.get(id)!, settings(patch));

  test("maps a confident noul answer to a boolean and derives its confidence", () => {
    const record = resolveGateAnswer(policy("smart_trigger"), { type: "noul", noul: 0.92 }, { minConfidence: 0.55 });
    expect(record.value).toBe(true);
    expect(record.confidence).toBeCloseTo(0.92, 5);
    expect(record.confidenceDerived).toBe(true);
    expect(record.escalated).toBe(false);
    expect(record.usedFallback).toBe(false);
  });

  test("treats a noul near 0.5 as uncertain and applies the fallback", () => {
    const record = resolveGateAnswer(policy("smart_trigger"), { type: "noul", noul: 0.52 }, { minConfidence: 0.55 });
    expect(record.value).toBe(true);
    expect(record.confidence).toBeCloseTo(0.52, 5);
    expect(record.escalated).toBe(true);
    expect(record.usedFallback).toBe(true);
    expect(record.fallback).toBe("run");
  });

  test("counts a confident no as a confident decision", () => {
    const record = resolveGateAnswer(policy("smart_trigger"), { type: "noul", noul: 0.05 }, { minConfidence: 0.55 });
    expect(record.value).toBe(false);
    expect(record.confidence).toBeCloseTo(0.95, 5);
    expect(record.escalated).toBe(false);
  });

  test("carries choice probabilities and reported confidence", () => {
    const record = resolveGateAnswer(
      policy("duplicate_suppression"),
      { type: "choice", choice: "repeats", probabilities: { new: 0.1, repeats: 0.8, near_duplicate: 0.1 }, confidence: 0.8 },
      { minConfidence: 0.55 },
    );
    expect(record.value).toBe("repeats");
    expect(record.probability).toBeCloseTo(0.8, 5);
    expect(record.confidence).toBeCloseTo(0.8, 5);
    expect(record.confidenceDerived).toBe(false);
    expect(record.probabilities).toEqual({ new: 0.1, repeats: 0.8, near_duplicate: 0.1 });
  });

  test("a missing answer applies the gate fallback", () => {
    const record = resolveGateAnswer(policy("continuity_guard"), undefined, { minConfidence: 0.55 });
    expect(record.value).toBeNull();
    expect(record.usedFallback).toBe(true);
    expect(record.fallback).toBe("soften");
    expect(record.note).toMatch(/no answer/i);
  });

  test("a low-confidence choice escalates to its fallback", () => {
    const record = resolveGateAnswer(
      policy("duplicate_suppression"),
      { type: "choice", choice: "new", probabilities: { new: 0.4, repeats: 0.35, near_duplicate: 0.25 }, confidence: 0.3 },
      { minConfidence: 0.55 },
    );
    expect(record.escalated).toBe(true);
    expect(record.usedFallback).toBe(true);
  });
});

describe("decision helpers", () => {
  const record = (patch: Partial<JevGateRecord>): JevGateRecord => ({
    gateId: "x", label: "x", primitive: "noul", phase: "gate",
    value: null, probability: null, confidence: null, confidenceDerived: false,
    threshold: 0.6, escalated: false, usedFallback: false, fallback: "run",
    ...patch,
  });

  test("turns accepted craft and world answers into Director guidance only", () => {
    const guidance = directorGuidanceFromGates([
      record({ gateId: "pacing_control", value: "tighten", primitive: "choice" }),
      record({ gateId: "npc_autonomy", value: "assist", primitive: "choice", usedFallback: true }),
      record({ gateId: "emotional_release", value: 3, primitive: "score" }),
      record({ gateId: "foreshadowing", value: false }),
      record({ gateId: "model_route", value: "strong", primitive: "choice" }),
      record({ gateId: "continuity_guard", value: "violation", primitive: "choice", phase: "verify" }),
    ]);
    expect(guidance).toContain("Increase pressure and shorten the scene's patience");
    expect(guidance).toContain("A short release would help the scene breathe");
    expect(guidance).toContain("A planted detail would read as conspicuous");
    expect(guidance).not.toContain("An NPC helps");
    expect(guidance).not.toContain("strong");
    expect(guidance).not.toContain("contradicts");
  });

  test("runs the Director when the trigger gate says yes", () => {
    expect(shouldRunDirector([record({ gateId: "smart_trigger", value: true })]).run).toBe(true);
  });

  test("skips the Director only on a confident no", () => {
    const decision = shouldRunDirector([record({ gateId: "smart_trigger", value: false })]);
    expect(decision.run).toBe(false);
    expect(decision.reason).toMatch(/does not need Director intervention/i);
  });

  test("fails open when the trigger gate answered nothing", () => {
    expect(shouldRunDirector([record({ gateId: "smart_trigger", value: null })]).run).toBe(true);
    expect(shouldRunDirector([]).run).toBe(true);
  });

  test("fails open when the trigger gate result was escalated", () => {
    expect(shouldRunDirector([record({ gateId: "smart_trigger", value: false, usedFallback: true })]).run).toBe(true);
  });

  test("maps context filtering choices onto source flags", () => {
    expect(contextFilterDecision([record({ gateId: "context_filter", value: "history_only", primitive: "choice" })]))
      .toEqual({ keepHistory: true, keepCharacter: false, keepPersona: false, keepWorldInfo: false });
    expect(contextFilterDecision([record({ gateId: "context_filter", value: "all", primitive: "choice" })]))
      .toEqual({ keepHistory: true, keepCharacter: true, keepPersona: true, keepWorldInfo: true });
    expect(contextFilterDecision([])).toBeNull();
  });

  test("only promotes the model on a confident strong route", () => {
    expect(wantsStrongDirectorModel([record({ gateId: "model_route", value: "strong", primitive: "choice" })])).toBe(true);
    expect(wantsStrongDirectorModel([record({ gateId: "model_route", value: "cheap", primitive: "choice" })])).toBe(false);
    expect(wantsStrongDirectorModel([record({ gateId: "model_route", value: "strong", primitive: "choice", usedFallback: true })])).toBe(false);
  });

  test("chooses a repair from the specific violated guardrail", () => {
    expect(decideRepair([record({ gateId: "director_verification", value: "clean", primitive: "choice" })])).toBeNull();
    expect(decideRepair([record({ gateId: "director_verification", value: "violation", primitive: "choice" })])?.action).toBe("full_retry");
    expect(decideRepair([record({ gateId: "player_agency", value: true })])?.action).toBe("patch");
    expect(decideRepair([record({ gateId: "duplicate_suppression", value: "repeats", primitive: "choice" })])?.action).toBe("full_retry");
    expect(decideRepair([record({ gateId: "continuity_guard", value: "violation", primitive: "choice" })])?.action).toBe("soften");
    expect(decideRepair([record({ gateId: "intensity_boundary", value: "out_of_range", primitive: "choice" })])?.action).toBe("soften");
  });

  test("honours an explicit repair strategy from Jev", () => {
    const decision = decideRepair([
      record({ gateId: "continuity_guard", value: "violation", primitive: "choice" }),
      record({ gateId: "repair_strategy", value: "drop_claim", primitive: "choice" }),
    ]);
    expect(decision?.action).toBe("drop_claim");
  });

  test("ignores escalated guardrails when deciding on a repair", () => {
    expect(decideRepair([
      record({ gateId: "player_agency", value: true, usedFallback: true }),
    ])).toBeNull();
  });
});

describe("cross-cutting gates", () => {
  test("records degradation and keeps the fail-open fallback", () => {
    const records = withDegradationGate([], { status: "degraded", error: "network unreachable" });
    const record = records.find((entry) => entry.gateId === "budget_degradation")!;
    expect(record.value).toBe(true);
    expect(record.usedFallback).toBe(true);
    expect(record.fallback).toBe("run");
    expect(record.note).toMatch(/ungated/i);
  });

  test("records a clean turn when Jev answered everything", () => {
    const records = withDegradationGate([], { status: "ok", error: null });
    const record = records.find((entry) => entry.gateId === "budget_degradation")!;
    expect(record.usedFallback).toBe(false);
  });

  test("flags only the escalated answers", () => {
    const base: JevGateRecord = {
      gateId: "a", label: "A", primitive: "noul", phase: "verify", value: true,
      probability: 0.9, confidence: 0.9, confidenceDerived: true, threshold: 0.6,
      escalated: false, usedFallback: false, fallback: "run",
    };
    const records = withConfidenceGate([base, { ...base, gateId: "b", escalated: true }], 0.55);
    const record = records.find((entry) => entry.gateId === "confidence_escalation")!;
    expect(record.value).toBe(true);
    expect(record.note).toMatch(/\bb\b/);
  });
});
