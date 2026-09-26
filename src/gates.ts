/**
 * The LumiWorld gate catalog.
 *
 * Every capability in the v0.5 update plan is one entry here. A gate declares the
 * typed Jev question it sends, how its answer is interpreted, the confidence
 * threshold that applies, and the fallback used when Jev cannot answer. The
 * frontend renders this table directly, so behaviour and UI cannot drift apart.
 *
 * Two rules shape the catalog:
 *  - Jev answers only Choice, Score, or Noul. It never generates prose, so what is
 *    recorded per gate is the typed decision plus its probabilities, not a written
 *    rationale.
 *  - Every gate belongs to exactly one Jev round trip. "gate" gates run before the
 *    Director; "verify" gates run against the draft directive afterwards. Each
 *    phase is a single batched request.
 *
 * Coverage note: the v0.5 update plan lists 40 capabilities and this catalog holds
 * 36 gates. The mapping is one-to-one except for three folds, where asking a
 * second question would spend a question without adding a decision:
 *  - "Director verification" already describes contradictions, repetition, and
 *    premature resolution together, so it needs no separate repetition gate.
 *  - "Graceful degradation" is one gate covering unavailability, timeout, budget
 *    exhaustion, and rate limiting. It is evaluated in code, not sent to Jev.
 *  - "Confidence escalation" is likewise computed in code from the confidence the
 *    other gates report.
 */

import {
  type GateCategory,
  type GateDefinition,
  type GateFallback,
  type GatePolicy,
  type GateValue,
  type JevGateRecord,
  type JevPrimitive,
  type JevSettings,
  type JevTurnDiagnostics,
  type ResolvedGatePolicy,
} from "./shared";

export const GATE_CATEGORY_LABELS: Record<GateCategory, string> = {
  director_control: "Director control",
  guardrails: "Guardrails",
  state_accuracy: "State accuracy",
  narrative: "Narrative direction",
  world: "World progression",
};

export const GATE_CATEGORY_ORDER: readonly GateCategory[] = [
  "director_control",
  "guardrails",
  "state_accuracy",
  "narrative",
  "world",
];

/** Confidence used for a reported answer that carried no confidence value. */
const REPORTED_CONFIDENCE = 1;

function noul(
  id: string,
  label: string,
  category: GateCategory,
  phase: GateDefinition["phase"],
  instructions: string,
  rationale: string,
  criteria: { true: string; false: string } | undefined,
  fallback: GateFallback,
): GateDefinition {
  return {
    id,
    label,
    primitive: "noul",
    primitiveLabel: "Yes / No",
    phase,
    category,
    instructions,
    rationale,
    criteria,
    enabledByDefault: false,
    threshold: 0.6,
    fallback,
    safeValue: true,
    blockValue: false,
  };
}

function choice(
  id: string,
  label: string,
  category: GateCategory,
  phase: GateDefinition["phase"],
  instructions: string,
  rationale: string,
  criteria: Record<string, string>,
  fallback: GateFallback,
  safeValue: GateValue,
  blockValue: GateValue,
): GateDefinition {
  return {
    id,
    label,
    primitive: "choice",
    primitiveLabel: "Choice",
    phase,
    category,
    instructions,
    rationale,
    criteria,
    enabledByDefault: false,
    threshold: 0.5,
    fallback,
    safeValue,
    blockValue,
  };
}

function score(
  id: string,
  label: string,
  category: GateCategory,
  phase: GateDefinition["phase"],
  instructions: string,
  rationale: string,
  criteria: string[],
  fallback: GateFallback,
  safeValue: GateValue,
  blockValue: GateValue,
): GateDefinition {
  return {
    id,
    label,
    primitive: "score",
    primitiveLabel: "Score",
    phase,
    category,
    instructions,
    rationale,
    criteria,
    enabledByDefault: false,
    threshold: 0.5,
    fallback,
    safeValue,
    blockValue,
  };
}

/** Gates that are on by default: the core loop, all of them fail-open. */
const CORE_GATES: ReadonlySet<string> = new Set([
  "smart_trigger",
  "context_filter",
  "model_route",
  "director_verification",
  "player_agency",
  "duplicate_suppression",
  "continuity_guard",
  "intensity_boundary",
  "confidence_escalation",
  "budget_degradation",
  "scene_state_tracking",
]);

function withCore(gates: GateDefinition[]): GateDefinition[] {
  return gates.map((gate) => (CORE_GATES.has(gate.id) ? { ...gate, enabledByDefault: true } : gate));
}

export const GATE_CATALOG: readonly GateDefinition[] = withCore([
  /* ---------------- Director control (gate phase) ---------------- */
  noul(
    "smart_trigger",
    "Smart Director triggering",
    "director_control",
    "gate",
    "Given `chat_history`, `scene_state`, `director_notes`, and the latest player message, is there anything in this turn that a private world director should intervene in before the visible reply is written? Judge only whether intervention would add something the main model would otherwise miss.",
    "Decides whether the Director runs at all, so a quiet or purely conversational turn costs one cheap Jev call instead of a full Director generation.",
    {
      true: "The turn creates or changes world pressure, NPC intent, an offscreen consequence, a reveal, or a development the main model would plausibly miss",
      false: "The turn is a direct continuation of the immediately preceding exchange and needs no new world development",
    },
    "run",
  ),
  choice(
    "context_filter",
    "Context filtering",
    "director_control",
    "gate",
    "Which parts of the assembled context are actually relevant to directing this turn? Choose the smallest set that still covers what the Director needs.",
    "Drops irrelevant lore and context before the Director sees it, which cuts prompt tokens and reduces distraction.",
    {
      all: "Every available context source is relevant",
      history_and_character: "Recent chat history and the active character matter; detailed lore does not",
      world_info_only: "The activated lore matters more than the recent small talk",
      history_only: "Only the recent exchange matters; drop character sheets and lore",
    },
    "run",
    "all",
    "history_only",
  ),
  choice(
    "model_route",
    "Model routing",
    "director_control",
    "gate",
    "How difficult is this turn to direct? Judge the complexity of the world development needed, not the length of the chat.",
    "Selects a cheap or strong Director model per turn instead of paying for the strongest model on every reply.",
    {
      cheap: "A small, local development is enough; no deep reasoning required",
      strong: "A consequential, multi-thread, or continuity-sensitive development is needed",
    },
    "run",
    "cheap",
    "strong",
  ),
  choice(
    "pacing_control",
    "Pacing control",
    "director_control",
    "gate",
    "How should the scene's pacing be handled in the next development?",
    "Translates stagnation, tension, and urgency into a pacing instruction for the Director.",
    {
      hold: "Let the current beat breathe; do not accelerate",
      tighten: "Increase pressure and shorten the scene's patience",
      slow: "Give the scene a slower, quieter treatment",
      turn: "Introduce a reversal that changes the direction of the scene",
    },
    "run",
    "hold",
    "slow",
  ),
  choice(
    "npc_autonomy",
    "NPC autonomy",
    "director_control",
    "gate",
    "Which category of action should a non-player character take next, if any?",
    "Picks who acts and the kind of action, after which the Director writes the specific, natural action.",
    {
      none: "No NPC needs to act in this turn",
      confront: "An NPC directly challenges, blocks, or pushes back",
      withdraw: "An NPC pulls away, goes quiet, or leaves the exchange",
      reveal_intent: "An NPC shows their true motive or loyalty",
      assist: "An NPC helps, concedes, or offers something",
      conspire: "An NPC acts behind the scenes or coordinates with another",
    },
    "run",
    "none",
    "withdraw",
  ),
  noul(
    "world_movement",
    "World movement",
    "director_control",
    "gate",
    "Should offscreen factions, organisations, or background events advance during this turn?",
    "Keeps the world moving without the visible cast, and prevents the world from freezing around the player.",
    {
      true: "Something offscreen would plausibly progress now and its consequence could reach the scene",
      false: "Nothing offscreen would meaningfully change in the span of this turn",
    },
    "run",
  ),
  noul(
    "reveal_control",
    "Reveal control",
    "director_control",
    "gate",
    "Is now a good moment for a previously withheld secret or reveal to begin landing? Judge readiness, not whether the secret exists.",
    "Stops the Director from either hoarding a reveal forever or spending it too early.",
    {
      true: "Enough has been established that landing part of this reveal now would read as earned",
      false: "The reveal has not been set up enough, or the scene has no room for it now",
    },
    "run",
  ),
  choice(
    "conflict_escalation",
    "Conflict escalation",
    "director_control",
    "gate",
    "What should happen to the current conflict?",
    "Chooses the conflict beat so the Director constructs an event in the right register.",
    {
      hold: "Leave the conflict at its current level",
      escalate: "Raise the stakes, cost, or hostility",
      interrupt: "Cut the conflict short with an outside event",
      resolve: "Bring this conflict to a genuine conclusion",
      redirect: "Move the conflict somewhere else or onto a different target",
    },
    "run",
    "hold",
    "resolve",
  ),
  choice(
    "story_thread",
    "Story-thread management",
    "director_control",
    "gate",
    "Which unresolved story thread most deserves movement in this turn? Use `scene_state` for the open threads if present.",
    "Picks the thread to advance so the Director does not drift onto uninteresting tangents.",
    {
      none: "No open thread needs movement right now",
      primary: "The main unresolved thread",
      secondary: "A background or supporting thread",
      newest: "The thread introduced most recently",
      neglected: "The thread that has been untouched longest",
    },
    "run",
    "none",
    "primary",
  ),
  choice(
    "arc_position",
    "Arc position",
    "director_control",
    "gate",
    "Where does this scene currently sit in its dramatic arc?",
    "Anchors the Director's development to the scene's dramatic position instead of an arbitrary beat.",
    {
      setup: "Establishing characters, place, and stakes",
      rising: "Pressure and complications building",
      turn: "A reversal or reframing has just occurred",
      climax: "The decisive confrontation or peak",
      release: "Aftermath and decompression",
    },
    "run",
    "setup",
    "release",
  ),
  choice(
    "development_shape",
    "Development shape",
    "director_control",
    "gate",
    "What form should the next development take?",
    "Decides the shape of the beat so the Director realises that form rather than defaulting to a description of the environment.",
    {
      npc_action: "A character does something with visible consequence",
      dialogue: "A line of dialogue reframes the situation",
      environmental: "The environment or setting itself changes",
      revelation: "Information is disclosed",
      time_skip: "Time passes and the situation has moved on",
      offscreen_cut: "The scene cuts to something happening elsewhere",
    },
    "run",
    "environmental",
    "offscreen_cut",
  ),
  choice(
    "focus_selection",
    "Focus selection",
    "director_control",
    "gate",
    "Which element should this development centre on?",
    "Focuses the beat so it lands rather than diffusing across the whole cast.",
    {
      player: "The player's character and their immediate situation",
      active_npc: "The character currently most engaged with the player",
      absent_npc: "A character who is not in the scene right now",
      location: "The place itself and what it is doing",
      faction: "An organisation or group acting in the background",
    },
    "run",
    "player",
    "faction",
  ),
  choice(
    "time_clock",
    "Time and clock control",
    "world",
    "gate",
    "Should in-world time advance during this turn, and roughly how far?",
    "Controls the story clock so the Director does not narrate irrelevant passage of time.",
    {
      none: "Time does not meaningfully advance",
      minutes: "A few minutes pass",
      hours: "Some hours pass",
      day: "A day or more passes",
    },
    "run",
    "none",
    "day",
  ),
  choice(
    "environment_conditions",
    "Environment and conditions",
    "world",
    "gate",
    "Should the environment change during this turn — weather, light, temperature, or the condition of the location?",
    "Lets the world react physically without the Director decorating every reply with weather.",
    {
      unchanged: "Leave conditions as they are",
      weather: "Weather shifts",
      light: "Light or time-of-day shifts",
      location_state: "The location itself is altered or damaged",
      worsening: "Conditions deteriorate in a way that presses on the scene",
    },
    "run",
    "unchanged",
    "worsening",
  ),
  choice(
    "npc_entry_exit",
    "NPC entry and exit",
    "world",
    "gate",
    "Should any non-player character enter or leave the scene during this turn?",
    "Stages arrivals and departures deliberately instead of leaving the cast static.",
    {
      none: "The current cast stays as it is",
      enter_known: "A character already established elsewhere arrives",
      enter_new: "A new character appears",
      exit: "A present character leaves",
    },
    "run",
    "none",
    "exit",
  ),
  choice(
    "consequence_propagation",
    "Consequence propagation",
    "world",
    "gate",
    "Should the most recent committed development ripple outward into factions, threads, or relationships offscreen?",
    "Propagates consequences so the world remembers what happened even when the scene moves on.",
    {
      contained: "The development stays local to the scene",
      faction: "An organisation reacts",
      relationship: "A relationship changes because of it",
      thread: "Another thread is affected by it",
      broad: "Several of the above react at once",
    },
    "run",
    "contained",
    "broad",
  ),

  /* ---------------- Guardrails (verify phase) ---------------- */
  choice(
    "director_verification",
    "Director verification",
    "guardrails",
    "verify",
    "Read `draft_directive` against `chat_history` and `scene_state`. Does it contain a contradiction, a repetition of something already committed, or a premature resolution of an open thread?",
    "Checks the directive before it is injected, so a bad note costs one retry instead of a bad reply.",
    {
      clean: "The directive is free of contradictions, repetition, and premature resolution",
      violation: "The directive contains at least one of those problems",
      uncertain: "Something looks off, but it is not clear enough to call a violation",
    },
    "accept",
    "clean",
    "violation",
  ),
  noul(
    "player_agency",
    "Player agency guard",
    "guardrails",
    "verify",
    "Does `draft_directive` decide what the player's character thinks, feels, says, or does? Judge only the player's character, not NPCs and not the world.",
    "Catches the most damaging Director failure: a private note that hijacks the player's character.",
    {
      true: "The directive dictates the player's character's decision, dialogue, thoughts, or movement",
      false: "The directive leaves the player's character's choices open",
    },
    "patch",
  ),
  choice(
    "user_intent_arbitration",
    "User-intent arbitration",
    "guardrails",
    "verify",
    "The player's explicit out-of-character instruction, if any, is in `director_notes`. Does `draft_directive` follow that instruction, follow the world's momentum, or blend them?",
    "Reconciles an explicit player instruction with the world's own momentum instead of silently overriding the player.",
    {
      follows_instruction: "The directive honours the explicit instruction",
      follows_world: "The directive follows world momentum and sets the instruction aside",
      blends: "The directive satisfies both, weighting the instruction",
      not_applicable: "There is no explicit out-of-character instruction to reconcile",
    },
    "accept",
    "not_applicable",
    "follows_world",
  ),
  choice(
    "duplicate_suppression",
    "Duplicate suppression",
    "guardrails",
    "verify",
    "Compared with the recent exchange in `chat_history`, does `draft_directive` develop something genuinely new or repeat a development that has already been committed?",
    "Stops the Director from re-running a beat that has already happened, which reads to the player as the story stalling.",
    {
      new: "The development has not happened yet in the recent exchange",
      repeats: "The directive repeats a development that already happened",
      near_duplicate: "The directive is a thin variation on something that already happened",
    },
    "retry",
    "new",
    "repeats",
  ),
  choice(
    "continuity_guard",
    "Continuity guard",
    "guardrails",
    "verify",
    "Does `draft_directive` contradict established facts in `chat_history`, `scene_state`, or `world_info`?",
    "Prevents the Director from breaking facts the story has already committed to.",
    {
      consistent: "Nothing in the directive contradicts established facts",
      violation: "The directive contradicts an established fact",
      uncertain: "The directive may contradict an established fact, but it is not clear",
    },
    "soften",
    "consistent",
    "violation",
  ),
  choice(
    "intensity_boundary",
    "Intensity and boundary gating",
    "guardrails",
    "verify",
    "Weigh `draft_directive` against `director_notes` and the scene's established intensity. Does it stay inside the range the player has signalled?",
    "Keeps the Director inside the intensity band the player actually asked for, rather than escalating past it.",
    {
      within_range: "The directive stays inside the established range",
      borderline: "The directive sits at the edge of the range",
      out_of_range: "The directive exceeds the established range or crosses a stated boundary",
    },
    "soften",
    "within_range",
    "out_of_range",
  ),

  /* ---------------- State accuracy (verify phase) ---------------- */
  noul(
    "claim_extraction",
    "Claim extraction",
    "state_accuracy",
    "verify",
    "Does `draft_directive` assert a concrete fact, action, or state change that should be recorded as committed?",
    "Flags directives that introduce committable facts, so only validated claims reach the world state.",
    {
      true: "The directive asserts at least one concrete fact, action, or state change",
      false: "The directive is purely atmospheric and commits nothing",
    },
    "none",
  ),
  noul(
    "contradiction_localization",
    "Contradiction localization",
    "state_accuracy",
    "verify",
    "If `draft_directive` conflicts with committed facts, is the conflict confined to a single element rather than the whole directive?",
    "Tells the repair path whether a targeted patch is viable or the whole directive must be regenerated.",
    {
      true: "The conflict is confined to one element that could be replaced on its own",
      false: "The conflict affects the directive as a whole, or there is no conflict",
    },
    "patch",
  ),
  choice(
    "repair_strategy",
    "Repair strategy",
    "state_accuracy",
    "verify",
    "Given the checks recorded in `scene_state` and the draft in `draft_directive`, which repair fits best if a repair is needed?",
    "Chooses the cheapest repair that resolves the problem instead of always regenerating.",
    {
      accept: "No repair needed",
      full_retry: "Regenerate the directive from scratch",
      patch: "Replace only the offending element",
      soften: "Keep the directive but reduce its force",
      drop_claim: "Drop the offending claim and keep the rest",
    },
    "accept",
    "accept",
    "soften",
  ),
  noul(
    "scene_state_tracking",
    "Scene state tracking",
    "state_accuracy",
    "verify",
    "Does the draft directive change the scene's location, danger level, tension, active characters, or unresolved hooks in a way worth persisting for the next turn?",
    "Decides whether the derived scene state needs updating, so later turns inherit an accurate world model.",
    {
      true: "The directive changes at least one tracked scene state field",
      false: "The scene state is unchanged by this directive",
    },
    "none",
  ),
  score(
    "scene_state_diff",
    "Scene state diff",
    "state_accuracy",
    "verify",
    "How much did this directive move the scene's tension?",
    "Supplies the per-turn tension delta that the persisted scene state advances by.",
    [
      "Tension fell sharply; the scene decompressed",
      "Tension eased slightly",
      "Tension is unchanged",
      "Tension rose slightly",
      "Tension rose sharply; the scene is now wound much tighter",
    ],
    "none",
    2,
    2,
  ),
  score(
    "relationship_deltas",
    "Relationship deltas",
    "state_accuracy",
    "verify",
    "In this directive, how did the most affected character's stance toward the player change?",
    "Records the per-character shift in stance so later dialogue and action reflect the new relationship.",
    [
      "Markedly more hostile or distrustful",
      "Slightly cooler or more guarded",
      "Unchanged",
      "Slightly warmer or more trusting",
      "Markedly more trusting, indebted, or attached",
    ],
    "none",
    2,
    2,
  ),
  choice(
    "thread_lifecycle",
    "Thread lifecycle",
    "state_accuracy",
    "verify",
    "What is the state of the story thread this directive develops?",
    "Closes or parks threads deliberately so the open-thread list stays meaningful.",
    {
      continue: "Still open and worth developing further",
      resolve: "Brought to a genuine conclusion by this directive",
      dormant: "Parked for now, still open but not active",
      abandoned: "Dropped; this thread is no longer part of the story",
    },
    "none",
    "continue",
    "abandoned",
  ),

  /* ---------------- Narrative direction (gate phase) ---------------- */
  score(
    "emotional_release",
    "Emotional release",
    "narrative",
    "gate",
    "Given `chat_history` and `scene_state`, how much does the accumulated tension in this scene need a release right now?",
    "Stops the Director from holding tension forever, which is the usual way a slow scene becomes tiring.",
    [
      "Hold the tension; a release now would deflate the scene",
      "Ease the tension very slightly",
      "Neutral; no release is needed either way",
      "A short release would help the scene breathe",
      "The scene urgently needs a release, comic beat, or quiet moment",
    ],
    "run",
    2,
    2,
  ),
  noul(
    "foreshadowing",
    "Foreshadowing",
    "narrative",
    "gate",
    "Should this turn plant a small seed for a future development without paying it off now?",
    "Encourages deliberate setup so later revelations feel earned rather than abrupt.",
    {
      true: "A detail could be planted now that would pay off later without drawing attention",
      false: "A planted detail would read as conspicuous, or there is nothing worth setting up",
    },
    "run",
  ),
  noul(
    "callback",
    "Callback",
    "narrative",
    "gate",
    "Does `chat_history` contain an earlier established detail that would land well if it were echoed in this turn?",
    "Reuses what the story has already built instead of introducing new material by default.",
    {
      true: "There is an earlier detail whose return would feel meaningful now",
      false: "No earlier detail would land naturally in this turn",
    },
    "run",
  ),
  score(
    "hook_prioritization",
    "Hook prioritization",
    "narrative",
    "gate",
    "Judging by stakes and readiness, how strong is the case for advancing the most promising unresolved hook this turn?",
    "Ranks open hooks so the Director advances the one that most deserves movement.",
    [
      "Advance no hook this turn",
      "Weak case; the hooks can wait",
      "Moderate case for advancing the top hook",
      "Strong case; this hook is ready and matters",
      "Advance the top hook now; further delay would deflate it",
    ],
    "run",
    2,
    2,
  ),
  noul(
    "context_compaction",
    "Context compaction",
    "narrative",
    "gate",
    "Is `chat_history` long or repetitive enough that older context should be summarised to protect the context window?",
    "Decides when the Director should spend tokens summarising rather than re-reading old context.",
    {
      true: "Older context has become long or repetitive enough to be worth summarising",
      false: "The current context is compact enough to keep as it is",
    },
    "run",
  ),

  /* ---------------- Cross-cutting (evaluated in code) ---------------- */
  {
    id: "confidence_escalation",
    label: "Confidence escalation",
    primitive: "noul",
    primitiveLabel: "Computed",
    phase: "verify",
    category: "guardrails",
    instructions: "",
    rationale: "Flags every gate answer whose confidence falls below the configured floor so only the uncertain decisions are escalated and logged for the diagnostics view.",
    enabledByDefault: false,
    threshold: 0.55,
    fallback: "none",
    safeValue: true,
    blockValue: false,
    codeOnly: true,
    appliesWhen: "A decision answered below the confidence floor.",
  },
  {
    id: "budget_degradation",
    label: "Graceful degradation",
    primitive: "noul",
    primitiveLabel: "Computed",
    phase: "gate",
    category: "guardrails",
    instructions: "",
    rationale: "Detects unavailability, timeout, token-budget exhaustion, and rate limiting, then selects the declared fallback so LumiWorld still runs Director-only.",
    enabledByDefault: false,
    threshold: 0.5,
    fallback: "run",
    safeValue: true,
    blockValue: false,
    codeOnly: true,
    appliesWhen: "Jev was unavailable, timed out, or exceeded the remaining budget.",
  },
]);

export const GATE_BY_ID: ReadonlyMap<string, GateDefinition> = new Map(GATE_CATALOG.map((gate) => [gate.id, gate]));

export function coreGateIds(): string[] {
  return GATE_CATALOG.filter((gate) => gate.enabledByDefault).map((gate) => gate.id);
}

/* ------------------------------------------------------------------ *
 * Policy resolution
 * ------------------------------------------------------------------ */

export function resolveGatePolicy(definition: GateDefinition, settings: JevSettings): ResolvedGatePolicy {
  const override: GatePolicy | undefined = settings.gatePolicy[definition.id];
  const enabled = override?.enabled ?? definition.enabledByDefault;
  const threshold = override?.threshold ?? (definition.id === "confidence_escalation" ? settings.minConfidence : definition.threshold);
  const fallback = override?.fallback ?? definition.fallback;
  return { definition, enabled, threshold, fallback };
}

export function resolveAllGatePolicies(settings: JevSettings): Map<string, ResolvedGatePolicy> {
  return new Map(GATE_CATALOG.map((definition) => [definition.id, resolveGatePolicy(definition, settings)]));
}

export type GateOverrides = Partial<Record<string, GateValue>>;

export interface GatePlan {
  gates: Array<{ policy: ResolvedGatePolicy; question: { type: JevPrimitive; instructions: string; criteria?: unknown } }>;
  skipped: string[];
}

function dynamicCriteria(
  id: string,
  context: TurnContext,
  base: GateDefinition,
): Record<string, string> | string[] | { true: string; false: string } | undefined {
  if (id !== "context_filter") return base.criteria;
  // Only offer context sources that actually exist this turn, otherwise Jev is
  // asked to weigh options that were never supplied.
  const options: Record<string, string> = {
    all: "Every available context source is relevant",
  };
  if (context.hasHistory) {
    options.history_only = "Only the recent exchange matters; drop character sheets and lore";
    options.history_and_character = "Recent chat history and the active character matter; detailed lore does not";
  }
  if (context.hasWorldInfo) options.world_info_only = "The activated lore matters more than the recent small talk";
  if (!context.hasCharacter && !context.hasPersona) {
    delete options.history_and_character;
  }
  if (!context.hasWorldInfo) delete options.world_info_only;
  return options;
}

export interface TurnContext {
  /** Sources that are actually present in the assembled context this turn. */
  hasHistory: boolean;
  hasCharacter: boolean;
  hasPersona: boolean;
  hasWorldInfo: boolean;
  hasDirectorNotes: boolean;
  worldStateEnabled: boolean;
  generationType: string;
}

function gateApplies(definition: GateDefinition, context: TurnContext): boolean {
  switch (definition.id) {
    // The primary trigger judgment must always be asked. Conditioning it on
    // history would let a history-less turn bypass the Director gate entirely.
    case "smart_trigger":
      return true;
    case "context_filter":
      return context.hasHistory || context.hasCharacter || context.hasPersona || context.hasWorldInfo;
    case "pacing_control":
    case "story_thread":
    case "arc_position":
    case "focus_selection":
    case "emotional_release":
    case "hook_prioritization":
    case "context_compaction":
    case "callback":
      return context.hasHistory;
    case "foreshadowing":
      return context.hasHistory || context.hasWorldInfo;
    case "reveal_control":
      return context.hasHistory || context.hasWorldInfo;
    case "world_movement":
    case "consequence_propagation":
      return context.hasHistory || context.hasWorldInfo;
    case "scene_state_tracking":
    case "scene_state_diff":
      return context.worldStateEnabled;
    case "relationship_deltas":
    case "thread_lifecycle":
      return context.worldStateEnabled || context.hasHistory;
    default:
      return true;
  }
}

/**
 * Chooses the gates for one phase and builds their Jev questions.
 *
 * `phase` is what keeps the turn to a bounded number of round trips: every "gate"
 * question travels in one request, every "verify" question in one more.
 */
export function planGates(
  phase: "gate" | "verify",
  settings: JevSettings,
  context: TurnContext,
  overrides: GateOverrides = {},
): GatePlan {
  const policies = resolveAllGatePolicies(settings);
  const selected: GatePlan["gates"] = [];
  const skipped: string[] = [];

  for (const definition of GATE_CATALOG) {
    if (definition.phase !== phase) continue;
    if (definition.codeOnly) continue;
    const policy = policies.get(definition.id)!;
    const forced = overrides[definition.id];
    const enabled = forced !== undefined ? true : policy.enabled;
    if (!enabled) {
      skipped.push(definition.id);
      continue;
    }
    if (!gateApplies(definition, context)) {
      skipped.push(definition.id);
      continue;
    }
    selected.push({
      policy,
      question: {
        type: definition.primitive,
        instructions: definition.instructions,
        ...(definition.criteria ? { criteria: dynamicCriteria(definition.id, context, definition) } : {}),
      },
    });
  }

  return { gates: selected, skipped };
}

export function questionsFromPlan(plan: GatePlan): Record<string, { type: JevPrimitive; instructions: string; criteria?: unknown }> {
  const questions: Record<string, { type: JevPrimitive; instructions: string; criteria?: unknown }> = {};
  for (const entry of plan.gates) questions[entry.policy.definition.id] = entry.question;
  return questions;
}

/* ------------------------------------------------------------------ *
 * Answer resolution
 * ------------------------------------------------------------------ */

export interface ResolveContext {
  minConfidence: number;
}

function matches(value: GateValue, expected: GateValue): boolean {
  if (typeof value === "number" && typeof expected === "number") return Math.abs(value - expected) < 1e-9;
  return value === expected;
}

/**
 * Turns one raw Jev answer into a gate record.
 *
 * Noul answers carry no confidence field, so their confidence is derived as
 * `max(p, 1 - p)` and flagged as derived. Answer values below the gate threshold
 * are escalated: the gate's declared fallback is applied and the escalation is
 * recorded for the diagnostics view.
 */
export function resolveGateAnswer(
  policy: ResolvedGatePolicy,
  rawAnswer: import("./jev").JevAnswer | undefined,
  resolveContext: ResolveContext,
): JevGateRecord {
  const { definition } = policy;
  const base: JevGateRecord = {
    gateId: definition.id,
    label: definition.label,
    primitive: definition.primitive,
    phase: definition.phase,
    value: null,
    probability: null,
    confidence: null,
    confidenceDerived: false,
    threshold: policy.threshold,
    escalated: false,
    usedFallback: false,
    fallback: policy.fallback,
  };

  if (!rawAnswer) {
    return {
      ...base,
      usedFallback: true,
      note: "Jev returned no answer for this gate, so its fallback applied.",
    };
  }

  let value: GateValue;
  let confidence: number | null;
  let probability: number | null;
  let confidenceDerived = false;
  let probabilities: Record<string, number> | undefined;

  if (rawAnswer.type === "noul") {
    value = rawAnswer.noul >= 0.5;
    probability = rawAnswer.noul;
    confidence = rawAnswer.noul >= 0.5 ? rawAnswer.noul : 1 - rawAnswer.noul;
    confidenceDerived = true;
  } else if (rawAnswer.type === "choice") {
    value = rawAnswer.choice;
    probabilities = rawAnswer.probabilities;
    probability = rawAnswer.probabilities[rawAnswer.choice] ?? null;
    confidence = rawAnswer.confidence ?? REPORTED_CONFIDENCE;
  } else {
    value = rawAnswer.score;
    probabilities = rawAnswer.probabilities;
    probability = rawAnswer.probabilities[String(Math.round(rawAnswer.score))] ?? null;
    confidence = rawAnswer.confidence ?? REPORTED_CONFIDENCE;
  }

  const escalated = confidence !== null && confidence < Math.max(policy.threshold, resolveContext.minConfidence);
  const escalatedNote = escalated
    ? `Confidence ${confidence !== null ? confidence.toFixed(2) : "unknown"} is below the ${Math.max(policy.threshold, resolveContext.minConfidence).toFixed(2)} floor, so the fallback applied.`
    : undefined;

  return {
    ...base,
    value,
    probability,
    confidence,
    confidenceDerived,
    escalated,
    usedFallback: escalated,
    probabilities,
    note: escalatedNote ?? (confidenceDerived ? "Noul answers carry no confidence; this value is derived from the probability." : undefined),
  };
}

export function resolveGateAnswers(
  plan: GatePlan,
  answers: Record<string, import("./jev").JevAnswer>,
  minConfidence: number,
): JevGateRecord[] {
  return plan.gates.map((entry) =>
    resolveGateAnswer(entry.policy, answers[entry.policy.definition.id], { minConfidence }),
  );
}

export function gateRecordById(records: JevGateRecord[], gateId: string): JevGateRecord | undefined {
  return records.find((record) => record.gateId === gateId);
}

/* ------------------------------------------------------------------ *
 * Decision helpers
 * ------------------------------------------------------------------ */

export interface DirectorDecision {
  run: boolean;
  reason: string | null;
}

/**
 * Smart triggering is the only gate that can cancel the Director.
 *
 * When `smart_trigger` did not answer, or its confidence was too low to act on,
 * the turn runs ungated rather than silently skipping direction.
 */
export function shouldRunDirector(records: JevGateRecord[]): DirectorDecision {
  const trigger = gateRecordById(records, "smart_trigger");
  if (!trigger) return { run: true, reason: null };
  if (trigger.usedFallback || trigger.value === null) return { run: true, reason: null };
  if (matches(trigger.value, true)) return { run: true, reason: null };
  return { run: false, reason: "Jev judged that this turn does not need Director intervention." };
}

export interface ContextFilterDecision {
  keepHistory: boolean;
  keepCharacter: boolean;
  keepPersona: boolean;
  keepWorldInfo: boolean;
}

export function contextFilterDecision(records: JevGateRecord[]): ContextFilterDecision | null {
  const record = gateRecordById(records, "context_filter");
  if (!record || record.usedFallback || typeof record.value !== "string") return null;
  switch (record.value) {
    case "all":
      return { keepHistory: true, keepCharacter: true, keepPersona: true, keepWorldInfo: true };
    case "history_and_character":
      return { keepHistory: true, keepCharacter: true, keepPersona: false, keepWorldInfo: false };
    case "world_info_only":
      return { keepHistory: false, keepCharacter: false, keepPersona: false, keepWorldInfo: true };
    case "history_only":
      return { keepHistory: true, keepCharacter: false, keepPersona: false, keepWorldInfo: false };
    default:
      return null;
  }
}

export function wantsStrongDirectorModel(records: JevGateRecord[]): boolean {
  const record = gateRecordById(records, "model_route");
  if (!record || record.usedFallback) return false;
  return record.value === "strong";
}

export type RepairAction = "accept" | "full_retry" | "patch" | "soften" | "drop_claim";

export interface RepairDecision {
  action: RepairAction;
  reason: string;
}

/**
 * Verification drives at most one bounded repair. The guardrails are consulted
 * before the generic repair strategy so a specific violation chooses the repair
 * that actually fits it.
 */
export function decideRepair(records: JevGateRecord[]): RepairDecision | null {
  const strategy = gateRecordById(records, "repair_strategy");
  const chosen = typeof strategy?.value === "string" && !strategy.usedFallback
    ? (strategy.value as RepairAction)
    : null;

  const violation = (gateId: string, blockingValue: GateValue): JevGateRecord | undefined => {
    const record = gateRecordById(records, gateId);
    if (!record || record.usedFallback || record.value === null) return undefined;
    return matches(record.value, blockingValue) ? record : undefined;
  };

  if (violation("player_agency", true)) {
    return { action: chosen && chosen !== "accept" ? chosen : "patch", reason: "The draft directive decided something for the player's character." };
  }
  const duplicate = violation("duplicate_suppression", "repeats") ?? violation("duplicate_suppression", "near_duplicate");
  if (duplicate) {
    return { action: chosen && chosen !== "accept" ? chosen : "full_retry", reason: "The draft directive repeats a development that already happened." };
  }
  if (violation("continuity_guard", "violation")) {
    return { action: chosen && chosen !== "accept" ? chosen : "soften", reason: "The draft directive contradicts an established fact." };
  }
  if (violation("intensity_boundary", "out_of_range")) {
    return { action: chosen && chosen !== "accept" ? chosen : "soften", reason: "The draft directive exceeds the established intensity range." };
  }
  if (violation("director_verification", "violation")) {
    return { action: chosen && chosen !== "accept" ? chosen : "full_retry", reason: "Jev's overall verification flagged the draft directive." };
  }
  return null;
}

export function countJevFlags(records: JevGateRecord[]): { fallback: number; escalated: number } {
  return {
    fallback: records.filter((record) => record.usedFallback).length,
    escalated: records.filter((record) => record.escalated).length,
  };
}

/** Applies computed cross-cutting gates after the Jev phases have resolved. */
export function withDegradationGate(
  records: JevGateRecord[],
  diagnostics: Pick<JevTurnDiagnostics, "status" | "error"> & { reason?: string | null },
): JevGateRecord[] {
  const definition = GATE_BY_ID.get("budget_degradation")!;
  const degraded = diagnostics.status !== "ok";
  const record: JevGateRecord = {
    gateId: definition.id,
    label: definition.label,
    primitive: definition.primitive,
    phase: definition.phase,
    value: degraded,
    probability: null,
    confidence: null,
    confidenceDerived: false,
    threshold: definition.threshold,
    escalated: degraded,
    usedFallback: degraded,
    fallback: definition.fallback,
    note: degraded
      ? `Jev was unavailable, so LumiWorld ran the Director ungated. ${diagnostics.error ?? diagnostics.reason ?? ""}`.trim()
      : "Jev answered every gate for this turn.",
  };
  return [...records, record];
}

export function withConfidenceGate(records: JevGateRecord[], floor: number): JevGateRecord[] {
  const escalated = records.filter((record) => record.escalated);
  const record: JevGateRecord = {
    gateId: "confidence_escalation",
    label: "Confidence escalation",
    primitive: "noul",
    phase: "verify",
    value: escalated.length > 0,
    probability: null,
    confidence: null,
    confidenceDerived: false,
    threshold: floor,
    escalated: escalated.length > 0,
    usedFallback: false,
    fallback: "none",
    note: escalated.length
      ? `Escalated: ${escalated.map((entry) => entry.gateId).join(", ")}.`
      : "No gate answer fell below the confidence floor.",
  };
  return [...records, record];
}
