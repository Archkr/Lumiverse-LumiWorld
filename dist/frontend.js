// src/shared.ts
var VISIBLE_GENERATION_TYPES = [
  "normal",
  "continue",
  "regenerate",
  "swipe",
  "impersonate"
];
var JEV_PROVIDERS = {
  typesafe: {
    id: "typesafe",
    label: "TypeSafe",
    baseUrl: "https://api.typesafe.ai",
    path: "/v1/systemone",
    defaultModel: "jev-latest",
    keyUrl: "https://console.typesafe.ai/keys"
  },
  openrouter: {
    id: "openrouter",
    label: "OpenRouter",
    baseUrl: "https://openrouter.ai/api",
    path: "/alpha/decisions",
    defaultModel: "typesafe/jev-1.13",
    keyUrl: "https://openrouter.ai/settings/keys"
  }
};
var JEV_PROVIDER_IDS = ["typesafe", "openrouter"];
var DEFAULT_JEV_STATE_CHARS = 30000;
var MIN_JEV_STATE_CHARS = 2000;
var MAX_JEV_STATE_CHARS = 32000;
var DEFAULT_JEV_TIMEOUT_MS = 8000;
var MIN_JEV_TIMEOUT_MS = 1000;
var MAX_JEV_TIMEOUT_MS = 60000;
var MAX_JEV_HISTORY_MESSAGES = 24;
var DEFAULT_JEV_MIN_CONFIDENCE = 0.55;
var DEFAULT_JEV_SETTINGS = {
  enabled: false,
  provider: "typesafe",
  model: "",
  baseUrlOverride: "",
  timeoutMs: DEFAULT_JEV_TIMEOUT_MS,
  maxStateChars: DEFAULT_JEV_STATE_CHARS,
  historyMessageLimit: 10,
  minConfidence: DEFAULT_JEV_MIN_CONFIDENCE,
  retryOnRateLimit: true,
  worldStateEnabled: true,
  gatePolicy: {}
};
var MAX_CONTROLLER_OUTPUT_TOKENS = Number.MAX_SAFE_INTEGER;
var MAX_DIRECTOR_TIMEOUT_MS = 300000;
var MAX_CHAT_HISTORY_MESSAGES = Number.MAX_SAFE_INTEGER;
var DEFAULT_RUN_LOG_LIMIT = 12;
var DEFAULT_HISTORY_MESSAGE_LIMIT = 12;
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
var DEFAULT_SETTINGS = {
  enabled: false,
  connectionId: null,
  modelOverride: "",
  strongConnectionId: null,
  strongModelOverride: "",
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
  jev: { ...DEFAULT_JEV_SETTINGS }
};
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
  return Array.isArray(value) ? [...new Set(normalized)] : [...DEFAULT_SETTINGS.generationTypes];
}
var GATE_FALLBACKS = [
  "run",
  "skip",
  "accept",
  "retry",
  "patch",
  "soften",
  "drop",
  "hold",
  "none",
  "ignore"
];
function normalizeProbability(value) {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n))
    return;
  return Math.min(1, Math.max(0, n));
}
function normalizeGatePolicy(value) {
  const obj = asRecord(value);
  const normalized = {};
  for (const [gateId, raw] of Object.entries(obj)) {
    const id = gateId.trim();
    if (!id)
      continue;
    const entry = asRecord(raw);
    const policy = {};
    if (typeof entry.enabled === "boolean")
      policy.enabled = entry.enabled;
    const threshold = normalizeProbability(entry.threshold);
    if (threshold !== undefined)
      policy.threshold = threshold;
    const fallback = cleanString(entry.fallback);
    if (GATE_FALLBACKS.includes(fallback))
      policy.fallback = fallback;
    if (Object.keys(policy).length > 0)
      normalized[id] = policy;
  }
  return normalized;
}
function normalizeJevSettings(value) {
  const obj = asRecord(value);
  const provider = cleanString(obj.provider) === "openrouter" ? "openrouter" : "typesafe";
  return {
    enabled: typeof obj.enabled === "boolean" ? obj.enabled : DEFAULT_JEV_SETTINGS.enabled,
    provider,
    model: cleanString(obj.model),
    baseUrlOverride: cleanString(obj.baseUrlOverride).replace(/\/+$/, ""),
    timeoutMs: integerInRange(obj.timeoutMs, DEFAULT_JEV_SETTINGS.timeoutMs, MIN_JEV_TIMEOUT_MS, MAX_JEV_TIMEOUT_MS),
    maxStateChars: integerInRange(obj.maxStateChars, DEFAULT_JEV_SETTINGS.maxStateChars, MIN_JEV_STATE_CHARS, MAX_JEV_STATE_CHARS),
    historyMessageLimit: integerInRange(obj.historyMessageLimit, DEFAULT_JEV_SETTINGS.historyMessageLimit, 0, MAX_JEV_HISTORY_MESSAGES),
    minConfidence: numberInRange(obj.minConfidence, DEFAULT_JEV_SETTINGS.minConfidence, 0, 1),
    retryOnRateLimit: typeof obj.retryOnRateLimit === "boolean" ? obj.retryOnRateLimit : DEFAULT_JEV_SETTINGS.retryOnRateLimit,
    worldStateEnabled: typeof obj.worldStateEnabled === "boolean" ? obj.worldStateEnabled : DEFAULT_JEV_SETTINGS.worldStateEnabled,
    gatePolicy: normalizeGatePolicy(obj.gatePolicy)
  };
}
function summarizeJevDiagnostics(diagnostics) {
  if (!diagnostics || !diagnostics.used)
    return null;
  const parts = [
    `${diagnostics.gateCount} gate${diagnostics.gateCount === 1 ? "" : "s"}`,
    diagnostics.requestCount ? `${diagnostics.requestCount} Jev request${diagnostics.requestCount === 1 ? "" : "s"}` : null,
    diagnostics.fallbackCount ? `${diagnostics.fallbackCount} fallback${diagnostics.fallbackCount === 1 ? "" : "s"}` : null,
    diagnostics.escalatedCount ? `${diagnostics.escalatedCount} escalated` : null,
    diagnostics.status === "degraded" ? "degraded" : null
  ].filter(Boolean);
  return parts.length ? parts.join(" · ") : null;
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
    strongConnectionId: cleanNullableString(obj.strongConnectionId),
    strongModelOverride: cleanString(obj.strongModelOverride),
    temperature: numberInRange(obj.temperature, DEFAULT_SETTINGS.temperature, 0, 2),
    maxTokens: integerInRange(obj.maxTokens, DEFAULT_SETTINGS.maxTokens, 64, MAX_CONTROLLER_OUTPUT_TOKENS),
    timeoutMs: integerInRange(obj.timeoutMs, DEFAULT_SETTINGS.timeoutMs, 1000, MAX_DIRECTOR_TIMEOUT_MS),
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
    jev: normalizeJevSettings(obj.jev)
  };
}

// src/gates.ts
var GATE_CATEGORY_LABELS = {
  director_control: "Director control",
  guardrails: "Guardrails",
  state_accuracy: "State accuracy",
  narrative: "Narrative direction",
  world: "World progression"
};
var GATE_CATEGORY_ORDER = [
  "director_control",
  "guardrails",
  "state_accuracy",
  "narrative",
  "world"
];
function noul(id, label, category, phase, instructions, rationale, criteria, fallback) {
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
    blockValue: false
  };
}
function choice(id, label, category, phase, instructions, rationale, criteria, fallback, safeValue, blockValue) {
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
    blockValue
  };
}
function score(id, label, category, phase, instructions, rationale, criteria, fallback, safeValue, blockValue) {
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
    blockValue
  };
}
var CORE_GATES = new Set([
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
  "scene_state_tracking"
]);
function withCore(gates) {
  return gates.map((gate) => CORE_GATES.has(gate.id) ? { ...gate, enabledByDefault: true } : gate);
}
var GATE_CATALOG = withCore([
  noul("smart_trigger", "Smart Director triggering", "director_control", "gate", "Given `chat_history`, `scene_state`, `director_notes`, and the latest player message, is there anything in this turn that a private world director should intervene in before the visible reply is written? Judge only whether intervention would add something the main model would otherwise miss.", "Decides whether the Director runs at all, so a quiet or purely conversational turn costs one cheap Jev call instead of a full Director generation.", {
    true: "The turn creates or changes world pressure, NPC intent, an offscreen consequence, a reveal, or a development the main model would plausibly miss",
    false: "The turn is a direct continuation of the immediately preceding exchange and needs no new world development"
  }, "run"),
  choice("context_filter", "Context filtering", "director_control", "gate", "Which parts of the assembled context are actually relevant to directing this turn? Choose the smallest set that still covers what the Director needs.", "Drops irrelevant lore and context before the Director sees it, which cuts prompt tokens and reduces distraction.", {
    all: "Every available context source is relevant",
    history_and_character: "Recent chat history and the active character matter; detailed lore does not",
    world_info_only: "The activated lore matters more than the recent small talk",
    history_only: "Only the recent exchange matters; drop character sheets and lore"
  }, "run", "all", "history_only"),
  choice("model_route", "Model routing", "director_control", "gate", "How difficult is this turn to direct? Judge the complexity of the world development needed, not the length of the chat.", "Selects a cheap or strong Director model per turn instead of paying for the strongest model on every reply.", {
    cheap: "A small, local development is enough; no deep reasoning required",
    strong: "A consequential, multi-thread, or continuity-sensitive development is needed"
  }, "run", "cheap", "strong"),
  choice("pacing_control", "Pacing control", "director_control", "gate", "How should the scene's pacing be handled in the next development?", "Translates stagnation, tension, and urgency into a pacing instruction for the Director.", {
    hold: "Let the current beat breathe; do not accelerate",
    tighten: "Increase pressure and shorten the scene's patience",
    slow: "Give the scene a slower, quieter treatment",
    turn: "Introduce a reversal that changes the direction of the scene"
  }, "run", "hold", "slow"),
  choice("npc_autonomy", "NPC autonomy", "director_control", "gate", "Which category of action should a non-player character take next, if any?", "Picks who acts and the kind of action, after which the Director writes the specific, natural action.", {
    none: "No NPC needs to act in this turn",
    confront: "An NPC directly challenges, blocks, or pushes back",
    withdraw: "An NPC pulls away, goes quiet, or leaves the exchange",
    reveal_intent: "An NPC shows their true motive or loyalty",
    assist: "An NPC helps, concedes, or offers something",
    conspire: "An NPC acts behind the scenes or coordinates with another"
  }, "run", "none", "withdraw"),
  noul("world_movement", "World movement", "director_control", "gate", "Should offscreen factions, organisations, or background events advance during this turn?", "Keeps the world moving without the visible cast, and prevents the world from freezing around the player.", {
    true: "Something offscreen would plausibly progress now and its consequence could reach the scene",
    false: "Nothing offscreen would meaningfully change in the span of this turn"
  }, "run"),
  noul("reveal_control", "Reveal control", "director_control", "gate", "Is now a good moment for a previously withheld secret or reveal to begin landing? Judge readiness, not whether the secret exists.", "Stops the Director from either hoarding a reveal forever or spending it too early.", {
    true: "Enough has been established that landing part of this reveal now would read as earned",
    false: "The reveal has not been set up enough, or the scene has no room for it now"
  }, "run"),
  choice("conflict_escalation", "Conflict escalation", "director_control", "gate", "What should happen to the current conflict?", "Chooses the conflict beat so the Director constructs an event in the right register.", {
    hold: "Leave the conflict at its current level",
    escalate: "Raise the stakes, cost, or hostility",
    interrupt: "Cut the conflict short with an outside event",
    resolve: "Bring this conflict to a genuine conclusion",
    redirect: "Move the conflict somewhere else or onto a different target"
  }, "run", "hold", "resolve"),
  choice("story_thread", "Story-thread management", "director_control", "gate", "Which unresolved story thread most deserves movement in this turn? Use `scene_state` for the open threads if present.", "Picks the thread to advance so the Director does not drift onto uninteresting tangents.", {
    none: "No open thread needs movement right now",
    primary: "The main unresolved thread",
    secondary: "A background or supporting thread",
    newest: "The thread introduced most recently",
    neglected: "The thread that has been untouched longest"
  }, "run", "none", "primary"),
  choice("arc_position", "Arc position", "director_control", "gate", "Where does this scene currently sit in its dramatic arc?", "Anchors the Director's development to the scene's dramatic position instead of an arbitrary beat.", {
    setup: "Establishing characters, place, and stakes",
    rising: "Pressure and complications building",
    turn: "A reversal or reframing has just occurred",
    climax: "The decisive confrontation or peak",
    release: "Aftermath and decompression"
  }, "run", "setup", "release"),
  choice("development_shape", "Development shape", "director_control", "gate", "What form should the next development take?", "Decides the shape of the beat so the Director realises that form rather than defaulting to a description of the environment.", {
    npc_action: "A character does something with visible consequence",
    dialogue: "A line of dialogue reframes the situation",
    environmental: "The environment or setting itself changes",
    revelation: "Information is disclosed",
    time_skip: "Time passes and the situation has moved on",
    offscreen_cut: "The scene cuts to something happening elsewhere"
  }, "run", "environmental", "offscreen_cut"),
  choice("focus_selection", "Focus selection", "director_control", "gate", "Which element should this development centre on?", "Focuses the beat so it lands rather than diffusing across the whole cast.", {
    player: "The player's character and their immediate situation",
    active_npc: "The character currently most engaged with the player",
    absent_npc: "A character who is not in the scene right now",
    location: "The place itself and what it is doing",
    faction: "An organisation or group acting in the background"
  }, "run", "player", "faction"),
  choice("time_clock", "Time and clock control", "world", "gate", "Should in-world time advance during this turn, and roughly how far?", "Controls the story clock so the Director does not narrate irrelevant passage of time.", {
    none: "Time does not meaningfully advance",
    minutes: "A few minutes pass",
    hours: "Some hours pass",
    day: "A day or more passes"
  }, "run", "none", "day"),
  choice("environment_conditions", "Environment and conditions", "world", "gate", "Should the environment change during this turn — weather, light, temperature, or the condition of the location?", "Lets the world react physically without the Director decorating every reply with weather.", {
    unchanged: "Leave conditions as they are",
    weather: "Weather shifts",
    light: "Light or time-of-day shifts",
    location_state: "The location itself is altered or damaged",
    worsening: "Conditions deteriorate in a way that presses on the scene"
  }, "run", "unchanged", "worsening"),
  choice("npc_entry_exit", "NPC entry and exit", "world", "gate", "Should any non-player character enter or leave the scene during this turn?", "Stages arrivals and departures deliberately instead of leaving the cast static.", {
    none: "The current cast stays as it is",
    enter_known: "A character already established elsewhere arrives",
    enter_new: "A new character appears",
    exit: "A present character leaves"
  }, "run", "none", "exit"),
  choice("consequence_propagation", "Consequence propagation", "world", "gate", "Should the most recent committed development ripple outward into factions, threads, or relationships offscreen?", "Propagates consequences so the world remembers what happened even when the scene moves on.", {
    contained: "The development stays local to the scene",
    faction: "An organisation reacts",
    relationship: "A relationship changes because of it",
    thread: "Another thread is affected by it",
    broad: "Several of the above react at once"
  }, "run", "contained", "broad"),
  choice("director_verification", "Director verification", "guardrails", "verify", "Read `draft_directive` against `chat_history` and `scene_state`. Does it contain a contradiction, a repetition of something already committed, or a premature resolution of an open thread?", "Checks the directive before it is injected, so a bad note costs one retry instead of a bad reply.", {
    clean: "The directive is free of contradictions, repetition, and premature resolution",
    violation: "The directive contains at least one of those problems",
    uncertain: "Something looks off, but it is not clear enough to call a violation"
  }, "accept", "clean", "violation"),
  noul("player_agency", "Player agency guard", "guardrails", "verify", "Does `draft_directive` decide what the player's character thinks, feels, says, or does? Judge only the player's character, not NPCs and not the world.", "Catches the most damaging Director failure: a private note that hijacks the player's character.", {
    true: "The directive dictates the player's character's decision, dialogue, thoughts, or movement",
    false: "The directive leaves the player's character's choices open"
  }, "patch"),
  choice("user_intent_arbitration", "User-intent arbitration", "guardrails", "verify", "The player's explicit out-of-character instruction, if any, is in `director_notes`. Does `draft_directive` follow that instruction, follow the world's momentum, or blend them?", "Reconciles an explicit player instruction with the world's own momentum instead of silently overriding the player.", {
    follows_instruction: "The directive honours the explicit instruction",
    follows_world: "The directive follows world momentum and sets the instruction aside",
    blends: "The directive satisfies both, weighting the instruction",
    not_applicable: "There is no explicit out-of-character instruction to reconcile"
  }, "accept", "not_applicable", "follows_world"),
  choice("duplicate_suppression", "Duplicate suppression", "guardrails", "verify", "Compared with the recent exchange in `chat_history`, does `draft_directive` develop something genuinely new or repeat a development that has already been committed?", "Stops the Director from re-running a beat that has already happened, which reads to the player as the story stalling.", {
    new: "The development has not happened yet in the recent exchange",
    repeats: "The directive repeats a development that already happened",
    near_duplicate: "The directive is a thin variation on something that already happened"
  }, "retry", "new", "repeats"),
  choice("continuity_guard", "Continuity guard", "guardrails", "verify", "Does `draft_directive` contradict established facts in `chat_history`, `scene_state`, or `world_info`?", "Prevents the Director from breaking facts the story has already committed to.", {
    consistent: "Nothing in the directive contradicts established facts",
    violation: "The directive contradicts an established fact",
    uncertain: "The directive may contradict an established fact, but it is not clear"
  }, "soften", "consistent", "violation"),
  choice("intensity_boundary", "Intensity and boundary gating", "guardrails", "verify", "Weigh `draft_directive` against `director_notes` and the scene's established intensity. Does it stay inside the range the player has signalled?", "Keeps the Director inside the intensity band the player actually asked for, rather than escalating past it.", {
    within_range: "The directive stays inside the established range",
    borderline: "The directive sits at the edge of the range",
    out_of_range: "The directive exceeds the established range or crosses a stated boundary"
  }, "soften", "within_range", "out_of_range"),
  noul("claim_extraction", "Claim extraction", "state_accuracy", "verify", "Does `draft_directive` assert a concrete fact, action, or state change that should be recorded as committed?", "Flags directives that introduce committable facts, so only validated claims reach the world state.", {
    true: "The directive asserts at least one concrete fact, action, or state change",
    false: "The directive is purely atmospheric and commits nothing"
  }, "none"),
  noul("contradiction_localization", "Contradiction localization", "state_accuracy", "verify", "If `draft_directive` conflicts with committed facts, is the conflict confined to a single element rather than the whole directive?", "Tells the repair path whether a targeted patch is viable or the whole directive must be regenerated.", {
    true: "The conflict is confined to one element that could be replaced on its own",
    false: "The conflict affects the directive as a whole, or there is no conflict"
  }, "patch"),
  choice("repair_strategy", "Repair strategy", "state_accuracy", "verify", "Given the checks recorded in `scene_state` and the draft in `draft_directive`, which repair fits best if a repair is needed?", "Chooses the cheapest repair that resolves the problem instead of always regenerating.", {
    accept: "No repair needed",
    full_retry: "Regenerate the directive from scratch",
    patch: "Replace only the offending element",
    soften: "Keep the directive but reduce its force",
    drop_claim: "Drop the offending claim and keep the rest"
  }, "accept", "accept", "soften"),
  noul("scene_state_tracking", "Scene state tracking", "state_accuracy", "verify", "Does the draft directive change the scene's location, danger level, tension, active characters, or unresolved hooks in a way worth persisting for the next turn?", "Decides whether the derived scene state needs updating, so later turns inherit an accurate world model.", {
    true: "The directive changes at least one tracked scene state field",
    false: "The scene state is unchanged by this directive"
  }, "none"),
  score("scene_state_diff", "Scene state diff", "state_accuracy", "verify", "How much did this directive move the scene's tension?", "Supplies the per-turn tension delta that the persisted scene state advances by.", [
    "Tension fell sharply; the scene decompressed",
    "Tension eased slightly",
    "Tension is unchanged",
    "Tension rose slightly",
    "Tension rose sharply; the scene is now wound much tighter"
  ], "none", 2, 2),
  score("relationship_deltas", "Relationship deltas", "state_accuracy", "verify", "In this directive, how did the most affected character's stance toward the player change?", "Records the per-character shift in stance so later dialogue and action reflect the new relationship.", [
    "Markedly more hostile or distrustful",
    "Slightly cooler or more guarded",
    "Unchanged",
    "Slightly warmer or more trusting",
    "Markedly more trusting, indebted, or attached"
  ], "none", 2, 2),
  choice("thread_lifecycle", "Thread lifecycle", "state_accuracy", "verify", "What is the state of the story thread this directive develops?", "Closes or parks threads deliberately so the open-thread list stays meaningful.", {
    continue: "Still open and worth developing further",
    resolve: "Brought to a genuine conclusion by this directive",
    dormant: "Parked for now, still open but not active",
    abandoned: "Dropped; this thread is no longer part of the story"
  }, "none", "continue", "abandoned"),
  score("emotional_release", "Emotional release", "narrative", "gate", "Given `chat_history` and `scene_state`, how much does the accumulated tension in this scene need a release right now?", "Stops the Director from holding tension forever, which is the usual way a slow scene becomes tiring.", [
    "Hold the tension; a release now would deflate the scene",
    "Ease the tension very slightly",
    "Neutral; no release is needed either way",
    "A short release would help the scene breathe",
    "The scene urgently needs a release, comic beat, or quiet moment"
  ], "run", 2, 2),
  noul("foreshadowing", "Foreshadowing", "narrative", "gate", "Should this turn plant a small seed for a future development without paying it off now?", "Encourages deliberate setup so later revelations feel earned rather than abrupt.", {
    true: "A detail could be planted now that would pay off later without drawing attention",
    false: "A planted detail would read as conspicuous, or there is nothing worth setting up"
  }, "run"),
  noul("callback", "Callback", "narrative", "gate", "Does `chat_history` contain an earlier established detail that would land well if it were echoed in this turn?", "Reuses what the story has already built instead of introducing new material by default.", {
    true: "There is an earlier detail whose return would feel meaningful now",
    false: "No earlier detail would land naturally in this turn"
  }, "run"),
  score("hook_prioritization", "Hook prioritization", "narrative", "gate", "Judging by stakes and readiness, how strong is the case for advancing the most promising unresolved hook this turn?", "Ranks open hooks so the Director advances the one that most deserves movement.", [
    "Advance no hook this turn",
    "Weak case; the hooks can wait",
    "Moderate case for advancing the top hook",
    "Strong case; this hook is ready and matters",
    "Advance the top hook now; further delay would deflate it"
  ], "run", 2, 2),
  noul("context_compaction", "Context compaction", "narrative", "gate", "Is `chat_history` long or repetitive enough that older context should be summarised to protect the context window?", "Decides when the Director should spend tokens summarising rather than re-reading old context.", {
    true: "Older context has become long or repetitive enough to be worth summarising",
    false: "The current context is compact enough to keep as it is"
  }, "run"),
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
    appliesWhen: "Evaluated in code from the confidence Jev reports for the other gates."
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
    appliesWhen: "Evaluated in code from the Jev client result and the remaining interceptor budget."
  }
]);
var GATE_BY_ID = new Map(GATE_CATALOG.map((gate) => [gate.id, gate]));

// src/frontend.ts
var VERSION = "0.5.0-experimental";
var ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M5 17.5c2.7 1.7 6.2 1.7 9 0 3.1-1.9 4.3-5.7 2.7-8.9"/><path d="M4.4 12.2c.4-3.3 3.2-5.9 6.6-5.9 1.9 0 3.6.8 4.8 2"/><path d="M18 4.5l.8 1.7 1.9.3-1.3 1.3.3 1.9-1.7-.9-1.7.9.3-1.9-1.3-1.3 1.9-.3.8-1.7z"/><path d="M7 13h6"/></svg>`;
var LABELS = {
  normal: "New reply",
  continue: "Continue",
  regenerate: "Regenerate",
  swipe: "Swipe",
  impersonate: "Impersonate"
};
var CSS = `
.lw-root { box-sizing:border-box; container:director / inline-size; width:100%; padding:8px 6px 0; color:var(--lumiverse-text); font:13px/1.5 var(--lumiverse-font-family,system-ui,sans-serif); }
.lw-root *, .lw-root *::before, .lw-root *::after { box-sizing:border-box; }
.lw-root [hidden] { display:none; }
.lw-shell { max-width:720px; margin:0 auto; }
.lw-header { display:flex; align-items:center; justify-content:space-between; gap:16px; padding:4px 0 18px; }
.lw-brand { display:flex; align-items:center; gap:12px; min-width:0; }
.lw-icon { display:grid; place-items:center; width:40px; height:40px; flex:none; border-radius:12px; color:var(--lumiverse-primary-text); background:var(--lumiverse-primary-soft); }
.lw-icon svg { width:25px; height:25px; }
.lw-title { margin:0; font-size:22px; line-height:1.2; font-weight:650; letter-spacing:-.5px; }
.lw-title-row { display:flex; align-items:center; gap:8px; }
.lw-status { display:flex; align-items:center; gap:6px; margin-top:4px; color:var(--lumiverse-text-muted); font-size:12px; }
.lw-status::before { content:""; width:6px; height:6px; border-radius:50%; background:var(--lumiverse-text-muted); }
.lw-status[data-tone="success"]::before { background:var(--lumiverse-success); }
.lw-status[data-tone="warning"]::before { background:var(--lumiverse-warning); }
.lw-header > .lw-row .lw-row-copy { display:none; }
.lw-intro { margin:0 0 18px; color:var(--lumiverse-text-muted); font-size:12px; line-height:1.6; }
.lw-setup { display:grid; gap:14px; padding:16px; border:1px solid var(--lumiverse-border); border-radius:var(--lumiverse-radius-lg,12px); background:var(--lumiverse-surface-raised); }
.lw-section { padding:20px 0; border-bottom:1px solid var(--lumiverse-border); }
.lw-section-title { margin:0 0 10px; color:var(--lumiverse-text-muted); font-size:11px; font-weight:650; letter-spacing:.08em; text-transform:uppercase; }
.lw-row { display:flex; align-items:center; justify-content:space-between; gap:16px; min-height:38px; }
.lw-row-copy { min-width:0; }
.lw-row-title { font-weight:500; }
.lw-row > .lw-control { flex:none; }
.lw-hint { margin:0; color:var(--lumiverse-text-muted); font-size:12px; line-height:1.5; }
.lw-field { display:grid; gap:6px; min-width:0; }
.lw-field > :first-child { font-size:12px; font-weight:550; }
.lw-fields { display:grid; gap:14px; grid-template-columns:repeat(auto-fit,minmax(min(100%,220px),1fr)); }
.lw-control { min-width:0; }
.lw-input, .lw-textarea, .lw-select { width:100%; min-height:38px; padding:9px 11px; border:1px solid var(--lumiverse-border); border-radius:var(--lumiverse-radius,8px); background:var(--lumiverse-input-bg); color:var(--lumiverse-text); font:inherit; }
.lw-input::placeholder, .lw-textarea::placeholder { color:var(--lumiverse-text-muted); opacity:1; }
.lw-input:disabled { cursor:not-allowed; }
.lw-textarea { min-height:90px; resize:vertical; }
.lw-template { min-height:200px; font:12px/1.6 var(--lumiverse-font-mono,monospace); }
.lw-actions { display:flex; flex-direction:column; align-items:stretch; gap:8px; }
.lw-test-hint { text-align:center; font-size:11px; }
.lw-button { display:inline-flex; align-items:center; justify-content:center; gap:8px; min-height:38px; padding:8px 12px; border:1px solid var(--lumiverse-border); border-radius:var(--lumiverse-radius,8px); color:var(--lumiverse-text); background:var(--lumiverse-fill-subtle); font:inherit; font-weight:600; cursor:pointer; }
.lw-button:hover:not(:disabled) { background:var(--lumiverse-fill-hover); }
.lw-button-primary { border-color:var(--lumiverse-primary-muted); background:var(--lumiverse-primary-soft); color:var(--lumiverse-primary-text); }
.lw-button-primary:hover:not(:disabled) { background:var(--lumiverse-primary-020); border-color:var(--lumiverse-primary); }
.lw-button:disabled { color:var(--lumiverse-text-muted); border-color:var(--lumiverse-border); background:var(--lumiverse-fill-subtle); cursor:not-allowed; }
.lw-button svg { width:15px; height:15px; flex:none; }
.lw-save { display:flex; align-items:center; gap:5px; font-size:11px; }
.lw-save::before { content:"✓"; }
.lw-save[data-tone="error"] { color:var(--lumiverse-danger); }
.lw-save[data-tone="error"]::before { content:"!"; }
.lw-save[data-tone="warning"]::before { content:"·"; }
.lw-notice { margin-bottom:14px; padding:11px 12px; border:1px solid var(--lumiverse-border); border-left:3px solid var(--lumiverse-primary); border-radius:8px; background:var(--lumiverse-fill-subtle); overflow-wrap:anywhere; font-size:12px; }
.lw-notice[data-tone="error"] { border-left-color:var(--lumiverse-danger); }
.lw-notice[data-tone="warning"] { border-left-color:var(--lumiverse-warning); }
.lw-notice[data-tone="success"] { border-left-color:var(--lumiverse-success); }
.lw-options { display:flex; flex-wrap:wrap; gap:7px; margin:0; padding:0; border:0; min-width:0; }
.lw-option { position:relative; display:flex; align-items:center; cursor:pointer; }
.lw-option input { position:absolute; width:1px; height:1px; opacity:0; }
.lw-option span { display:flex; align-items:center; gap:6px; min-height:34px; padding:6px 10px; border:1px solid var(--lumiverse-border); border-radius:7px; color:var(--lumiverse-text-muted); font-size:12px; transition:background .15s,border-color .15s; }
.lw-option span::before { content:""; width:11px; height:11px; border:1px solid var(--lumiverse-text-muted); border-radius:3px; }
.lw-option input:checked + span { border-color:var(--lumiverse-primary-muted); color:var(--lumiverse-primary-text); background:var(--lumiverse-primary-soft); }
.lw-option input:checked + span::before { content:"✓"; display:grid; place-items:center; border:0; font-size:12px; font-weight:750; }
.lw-option:hover span { border-color:var(--lumiverse-primary); background:var(--lumiverse-primary-light); }
.lw-option input:focus-visible + span { outline:2px solid var(--lumiverse-primary); outline-offset:3px; }
.lw-context { display:grid; gap:2px; }
.lw-context .lw-hint { margin-top:8px; }
.lw-details { border-bottom:1px solid var(--lumiverse-border); }
.lw-details > summary { display:flex; align-items:center; justify-content:space-between; gap:12px; padding:16px 0; list-style:none; cursor:pointer; font-size:13px; font-weight:550; }
.lw-details > summary::-webkit-details-marker { display:none; }
.lw-details > summary::after { content:""; width:7px; height:7px; margin:0 4px 0 8px; flex:none; border-right:1.5px solid var(--lumiverse-text-muted); border-bottom:1.5px solid var(--lumiverse-text-muted); transform:rotate(45deg) translateY(-2px); }
.lw-details[open] > summary::after { transform:rotate(225deg) translate(-2px,-1px); }
.lw-summary-copy { display:grid; gap:2px; }
.lw-summary-copy .lw-hint { font-size:11px; font-weight:400; }
.lw-details-body { display:grid; gap:16px; padding:0 0 18px; }
.lw-details .lw-details { border:0; border-top:1px solid var(--lumiverse-border); }
.lw-details .lw-details-body .lw-details-body { padding-bottom:0; }
.lw-footer { display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:8px; padding:16px 0 8px; color:var(--lumiverse-text-muted); font-size:11px; }
.lw-footer .lw-button { min-height:28px; padding:3px 8px; font-size:11px; }
.lw-footer-status { display:flex; align-items:center; flex-wrap:wrap; gap:8px; }
.lw-loading { padding:16px 0; color:var(--lumiverse-text-muted); }
.lw-root :is(button,input,select,textarea,summary):focus-visible { outline:2px solid var(--lumiverse-primary); outline-offset:3px; }
/* --- Pills ---------------------------------------------------------- */
.lw-badge { display:inline-flex; align-items:center; gap:5px; min-height:20px; padding:1px 8px; border:1px solid var(--lumiverse-border); border-radius:999px; color:var(--lumiverse-text-muted); background:var(--lumiverse-fill-subtle); font-size:10.5px; font-weight:550; letter-spacing:.01em; white-space:nowrap; }
.lw-badge[data-tone="success"] { border-color:var(--lumiverse-success); color:var(--lumiverse-success); }
.lw-badge[data-tone="warning"] { border-color:var(--lumiverse-warning); color:var(--lumiverse-warning); }
.lw-badge[data-tone="error"] { border-color:var(--lumiverse-danger); color:var(--lumiverse-danger); }
.lw-badge[data-tone="primary"] { border-color:var(--lumiverse-primary-muted); color:var(--lumiverse-primary-text); background:var(--lumiverse-primary-soft); }
.lw-dot { width:6px; height:6px; flex:none; border-radius:50%; background:var(--lumiverse-text-muted); }
.lw-badge[data-tone="success"] .lw-dot { background:var(--lumiverse-success); }
.lw-badge[data-tone="warning"] .lw-dot { background:var(--lumiverse-warning); }
.lw-badge[data-tone="error"] .lw-dot { background:var(--lumiverse-danger); }
.lw-badge[data-tone="primary"] .lw-dot { background:var(--lumiverse-primary); }

/* --- Jev panel ------------------------------------------------------ */
.lw-panel { display:grid; gap:14px; margin:4px 0 6px; padding:14px; border:1px solid var(--lumiverse-border); border-radius:var(--lumiverse-radius-lg,12px); background:var(--lumiverse-surface-raised); }
.lw-panel[data-active="true"] { border-color:var(--lumiverse-primary-muted); }
.lw-panel-soon { color:var(--lumiverse-text-muted); font-size:12px; line-height:1.55; }
.lw-stack { display:grid; gap:12px; }
.lw-control-card { display:grid; gap:12px; padding:12px; border:1px solid var(--lumiverse-border); border-radius:var(--lumiverse-radius,8px); background:var(--lumiverse-fill-subtle); }
.lw-control-head { display:flex; align-items:center; justify-content:space-between; gap:10px; }
.lw-control-title { font-size:12px; font-weight:600; }

/* --- Segmented provider control ------------------------------------- */
.lw-segments { display:flex; gap:4px; padding:3px; border:1px solid var(--lumiverse-border); border-radius:var(--lumiverse-radius,8px); background:var(--lumiverse-input-bg); }
.lw-segment { flex:1 1 0; min-width:0; min-height:30px; padding:5px 10px; border:0; border-radius:6px; color:var(--lumiverse-text-muted); background:transparent; font:inherit; font-size:12px; font-weight:550; cursor:pointer; transition:background .15s,color .15s; }
.lw-segment:hover { color:var(--lumiverse-text); background:var(--lumiverse-fill-hover); }
.lw-segment[aria-pressed="true"] { color:var(--lumiverse-primary-text); background:var(--lumiverse-primary-soft); box-shadow:inset 0 0 0 1px var(--lumiverse-primary-muted); }
.lw-segment:focus-visible { outline:2px solid var(--lumiverse-primary); outline-offset:2px; }
.lw-provider-note { font-size:11px; }
.lw-provider-note a { color:var(--lumiverse-primary-text); }

/* --- Key row -------------------------------------------------------- */
.lw-key-row { display:grid; grid-template-columns:minmax(0,1fr) auto auto; align-items:center; gap:8px; }

/* --- Gates ---------------------------------------------------------- */
.lw-gate-body { display:grid; gap:6px; }
.lw-cat-head { display:flex; align-items:center; justify-content:space-between; gap:10px; margin-top:14px; }
.lw-cat-head:first-child { margin-top:0; }
.lw-cat-title { display:flex; align-items:baseline; gap:7px; font-size:11px; font-weight:650; letter-spacing:.07em; text-transform:uppercase; color:var(--lumiverse-text-muted); }
.lw-cat-head .lw-button { min-height:24px; padding:1px 8px; font-size:10.5px; font-weight:600; }
.lw-gate { display:grid; gap:0; margin-bottom:2px; border:1px solid transparent; border-radius:9px; }
.lw-gate[data-on="true"] { border-color:var(--lumiverse-border); background:var(--lumiverse-fill-subtle); }
.lw-gate[data-open="true"] { border-color:var(--lumiverse-primary-muted); background:var(--lumiverse-surface-raised); }
.lw-gate[data-custom="true"][data-on="true"] { box-shadow:inset 3px 0 0 var(--lumiverse-primary); }
.lw-gate-row { display:grid; grid-template-columns:auto minmax(0,1fr) auto auto; align-items:center; gap:10px; padding:7px 10px; }
.lw-gate-copy { display:grid; gap:1px; min-width:0; }
.lw-gate-name { font-size:12.5px; font-weight:550; }
.lw-gate[data-on="false"] .lw-gate-name { color:var(--lumiverse-text-muted); font-weight:450; }
.lw-gate-meta { color:var(--lumiverse-text-muted); font-size:10.5px; }
.lw-gate-meta code { font-family:var(--lumiverse-font-mono,monospace); font-size:10.5px; }
.lw-gate-caret { display:grid; place-items:center; width:22px; height:22px; padding:0; border:1px solid var(--lumiverse-border); border-radius:6px; color:var(--lumiverse-text-muted); background:var(--lumiverse-fill-subtle); font:inherit; font-size:10px; cursor:pointer; }
.lw-gate-caret:hover { color:var(--lumiverse-text); background:var(--lumiverse-fill-hover); }
.lw-gate-caret:focus-visible { outline:2px solid var(--lumiverse-primary); outline-offset:2px; }
.lw-gate-sheet { display:grid; gap:10px; padding:2px 14px 13px; }
.lw-sheet-label { display:flex; align-items:baseline; justify-content:space-between; gap:10px; font-size:11px; font-weight:600; letter-spacing:.03em; text-transform:uppercase; color:var(--lumiverse-text-muted); }
.lw-sheet-copy { color:var(--lumiverse-text-muted); font-size:11.5px; line-height:1.5; }

/* --- Diagnostics ---------------------------------------------------- */
.lw-diag { display:grid; gap:12px; }
.lw-diag-strip { display:flex; flex-wrap:wrap; gap:5px; }
.lw-diag-list { display:grid; gap:4px; max-height:360px; overflow:auto; }
.lw-diag-row { display:grid; grid-template-columns:minmax(0,1fr) auto; align-items:start; gap:4px 10px; padding:8px 10px; border:1px solid var(--lumiverse-border); border-radius:8px; background:var(--lumiverse-fill-subtle); }
.lw-diag-row[data-flag="true"] { border-left:3px solid var(--lumiverse-warning); }
.lw-diag-row[data-on="false"] { opacity:.65; }
.lw-diag-head { display:flex; align-items:baseline; gap:8px; min-width:0; }
.lw-diag-name { font-size:12px; font-weight:600; }
.lw-diag-value { flex:none; padding:1px 7px; border:1px solid var(--lumiverse-border); border-radius:6px; background:var(--lumiverse-input-bg); font-family:var(--lumiverse-font-mono,monospace); font-size:10.5px; }
.lw-diag-row[data-flag="true"] .lw-diag-value { border-color:var(--lumiverse-warning); color:var(--lumiverse-warning); }
.lw-diag-meta { display:flex; align-items:center; justify-content:flex-end; gap:6px; }
.lw-diag-note { grid-column:1 / -1; color:var(--lumiverse-text-muted); font-size:11px; line-height:1.45; }
.lw-gate-reset { justify-self:start; }

@container director (max-width:300px) { .lw-setup { padding:12px; } .lw-option span { padding:6px 8px; } .lw-icon { width:34px; height:34px; } }
@media (prefers-reduced-motion:reduce) { .lw-root * { scroll-behavior:auto!important; transition:none!important; } }
`;
var GATE_FALLBACKS2 = [
  "run",
  "skip",
  "accept",
  "retry",
  "patch",
  "soften",
  "drop",
  "hold",
  "none",
  "ignore"
];
var GATE_FALLBACK_LABELS = {
  run: "Run the Director ungated",
  skip: "Skip the Director",
  accept: "Accept the draft",
  retry: "Regenerate once",
  patch: "Rewrite the part that infringes",
  soften: "Soften the directive",
  drop: "Drop the claim",
  hold: "Hold the beat",
  none: "Record only",
  ignore: "Ignore the answer"
};
function normalizeFrontendSettings(value) {
  return normalizeSettings(value);
}

class SettingsSaveQueue {
  revision = 0;
  savedRevision = 0;
  inFlightRevision = null;
  markDirty() {
    return ++this.revision;
  }
  begin() {
    if (this.inFlightRevision !== null || !this.isDirty)
      return null;
    this.inFlightRevision = this.revision;
    return this.inFlightRevision;
  }
  acknowledge(revision) {
    if (this.inFlightRevision !== revision)
      return this.isDirty;
    this.savedRevision = Math.max(this.savedRevision, revision);
    this.inFlightRevision = null;
    return this.isDirty;
  }
  fail(revision) {
    if (this.inFlightRevision === revision)
      this.inFlightRevision = null;
    return this.isDirty;
  }
  get isInFlight() {
    return this.inFlightRevision !== null;
  }
  get isDirty() {
    return this.revision > this.savedRevision;
  }
}
function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className)
    node.className = className;
  if (text)
    node.textContent = text;
  return node;
}
function button(label, handler, primary = false) {
  const node = el("button", `lw-button${primary ? " lw-button-primary" : ""}`, label);
  node.type = "button";
  node.addEventListener("click", handler);
  return node;
}
function textInput(value, placeholder, ariaLabel, onInput) {
  const input = el("input", "lw-input");
  input.type = "text";
  input.value = value;
  input.placeholder = placeholder;
  input.setAttribute("aria-label", ariaLabel);
  input.addEventListener("input", () => onInput(input.value));
  return input;
}
function collapsible(options, build) {
  const details = el("details", `lw-details${options.className ? ` ${options.className}` : ""}`);
  details.open = options.expanded;
  details.addEventListener("toggle", () => options.onToggle(details.open));
  const summary = el("summary");
  const copy = el("span", "lw-summary-copy");
  copy.append(el("span", undefined, options.title));
  summary.append(copy);
  if (options.badge) {
    const badge = el("span", "lw-badge", options.badge);
    if (options.badgeTone && options.badgeTone !== "neutral")
      badge.dataset.tone = options.badgeTone;
    summary.append(badge);
  }
  details.append(summary);
  const body = el("div", "lw-details-body");
  build(body);
  details.append(body);
  return details;
}
function pill(text, tone = "neutral") {
  const badge = el("span", "lw-badge");
  if (tone !== "neutral")
    badge.dataset.tone = tone;
  badge.append(el("span", "lw-dot"), el("span", undefined, text));
  return badge;
}
function segmented(value, options, ariaLabel, onChange) {
  const group = el("div", "lw-segments");
  group.setAttribute("role", "group");
  group.setAttribute("aria-label", ariaLabel);
  for (const option of options) {
    const node = el("button", "lw-segment", option.label);
    node.type = "button";
    node.setAttribute("aria-pressed", String(option.value === value));
    node.addEventListener("click", () => {
      if (option.value !== value)
        onChange(option.value);
    });
    group.append(node);
  }
  return group;
}
function activeChat(ctx) {
  try {
    return ctx.getActiveChat();
  } catch {
    return { chatId: null, characterId: null };
  }
}
function setup(ctx) {
  const cleanups = [];
  const handles = [];
  const queue = new SettingsSaveQueue;
  let pending = [];
  let state = null;
  let draft = normalizeFrontendSettings(DEFAULT_SETTINGS);
  let saveState = "saved";
  let notice = null;
  let noticeTimer = null;
  let saveTimer = null;
  let testPending = false;
  let jevTestPending = false;
  let jevKeyDraft = "";
  let advancedOpen = false;
  let templatesOpen = false;
  let notesOpen = false;
  let jevOpen = false;
  let gatesOpen = false;
  const openGates = new Set;
  let diagnosticsOpen = false;
  let nextFieldId = 0;
  cleanups.push(ctx.dom.addStyle(CSS));
  const drawer = ctx.ui.registerDrawerTab({
    id: "lumi-world",
    title: "LumiWorld",
    shortName: "Director",
    headerTitle: "LumiWorld",
    description: "Private Director notes for chat replies",
    keywords: ["lumiworld", "director", "prompt"],
    iconSvg: ICON
  });
  cleanups.push(() => drawer.destroy());
  function send(message) {
    ctx.sendToBackend({ ...activeChat(ctx), ...message });
  }
  function destroyHandles() {
    while (handles.length)
      try {
        handles.pop()?.destroy();
      } catch {}
  }
  function queueMount(mount, fallback) {
    pending.push({ mount, fallback });
  }
  function flushMounts() {
    while (pending.length) {
      const task = pending.shift();
      try {
        handles.push(task.mount());
      } catch (error) {
        console.warn("[LumiWorld] Shared control unavailable.", error);
        task.fallback();
      }
    }
  }
  function updateSaveStatus() {
    const badge = drawer.root.querySelector("[data-lw-save-status]");
    if (badge) {
      badge.textContent = saveState === "saving" ? "Saving…" : saveState === "error" ? "Save failed" : "All changes saved";
      badge.dataset.tone = saveState === "error" ? "error" : saveState === "saving" ? "warning" : "success";
    }
    const retry = drawer.root.querySelector("[data-lw-retry]");
    if (retry)
      retry.hidden = saveState !== "error";
    drawer.setBadge(saveState === "error" ? "Error" : saveState === "saving" ? "Saving" : null);
  }
  function updateDirectorStatus() {
    const badge = drawer.root.querySelector("[data-lw-director-status]");
    if (!badge)
      return;
    const ready = draft.enabled && !!state?.permissions.interceptor && canTest() && draft.generationTypes.length > 0;
    badge.textContent = !draft.enabled ? "Disabled" : ready ? "Ready for replies" : "Setup needed";
    badge.dataset.tone = ready ? "success" : draft.enabled ? "warning" : "neutral";
  }
  function showNotice(next, ttl = 1e4) {
    if (noticeTimer)
      clearTimeout(noticeTimer);
    notice = next;
    noticeTimer = next && ttl > 0 ? setTimeout(() => {
      notice = null;
      renderNotice();
    }, ttl) : null;
    renderNotice();
  }
  function renderNotice() {
    const target = drawer.root.querySelector("[data-lw-notice]");
    if (!target)
      return;
    target.replaceChildren();
    target.hidden = !notice;
    if (!notice)
      return;
    const banner = el("div", "lw-notice", notice.text);
    banner.dataset.tone = notice.tone;
    banner.setAttribute("role", notice.tone === "error" ? "alert" : "status");
    target.appendChild(banner);
  }
  function scheduleSave(delay = 450) {
    if (saveTimer)
      clearTimeout(saveTimer);
    saveState = "saving";
    updateSaveStatus();
    saveTimer = setTimeout(() => {
      saveTimer = null;
      const revision = queue.begin();
      if (revision !== null)
        send({ type: "save_settings", revision, settings: draft });
    }, delay);
  }
  function mutate(patch, rerender = false) {
    const previous = normalizeFrontendSettings(draft);
    draft = normalizeFrontendSettings({ ...draft, ...patch });
    if (JSON.stringify(previous) === JSON.stringify(draft)) {
      if (rerender)
        render();
      return;
    }
    queue.markDirty();
    scheduleSave();
    const notesHint = drawer.root.querySelector("[data-lw-notes-hint]");
    if (notesHint)
      notesHint.textContent = draft.additionalNotes.trim() ? "Your extra guidance" : "Optional guidance for the next reply";
    if (rerender)
      render();
    else {
      updateTestButton();
      updateDirectorStatus();
      updateWarnings();
    }
  }
  function field(label, control, hint) {
    const wrapper = el("div", "lw-field");
    const id = `lw-field-${++nextFieldId}`;
    const isInput = control instanceof HTMLInputElement || control instanceof HTMLTextAreaElement || control instanceof HTMLSelectElement;
    const labelNode = el(isInput ? "label" : "div", undefined, label);
    labelNode.id = `${id}-label`;
    if (isInput) {
      control.id = id;
      labelNode.htmlFor = id;
    } else {
      control.setAttribute("role", "group");
      control.setAttribute("aria-labelledby", labelNode.id);
    }
    wrapper.append(labelNode, control);
    if (hint)
      wrapper.appendChild(el("div", "lw-hint", hint));
    return wrapper;
  }
  function switchField(label, checked, onChange, hint) {
    const row = el("div", "lw-row");
    const copy = el("div", "lw-row-copy");
    copy.append(el("div", "lw-row-title", label));
    if (hint)
      copy.append(el("div", "lw-hint", hint));
    const slot = el("div", "lw-control");
    const fallback = () => {
      const input = el("input");
      input.type = "checkbox";
      input.checked = checked;
      input.setAttribute("aria-label", label);
      input.addEventListener("change", () => onChange(input.checked));
      slot.replaceChildren(input);
    };
    if (ctx.components?.mountSwitch)
      queueMount(() => ctx.components.mountSwitch(slot, { checked, size: "md", ariaLabel: label, onChange }), fallback);
    else
      fallback();
    row.append(copy, slot);
    return row;
  }
  function connectionField() {
    const slot = el("div", "lw-control");
    const options = (state?.connections ?? []).map((connection) => ({
      value: connection.id,
      label: connection.name || connection.id,
      sublabel: [connection.provider, connection.model, connection.hasApiKey ? null : "No API key"].filter(Boolean).join(" · "),
      group: connection.provider || "Connections"
    }));
    if (draft.connectionId && !options.some((option) => option.value === draft.connectionId)) {
      options.unshift({ value: draft.connectionId, label: "Saved connection unavailable", sublabel: draft.connectionId, group: "Unavailable" });
    }
    const fallback = () => {
      const select = el("select", "lw-select");
      select.appendChild(new Option("Select connection…", ""));
      for (const option of options)
        select.appendChild(new Option(option.label, option.value));
      select.value = draft.connectionId ?? "";
      select.addEventListener("change", () => mutate({ connectionId: select.value || null, modelOverride: "" }, true));
      slot.replaceChildren(select);
    };
    if (ctx.components?.mountSelect)
      queueMount(() => ctx.components.mountSelect(slot, {
        value: draft.connectionId ?? "",
        options,
        placeholder: "Select connection…",
        searchPlaceholder: "Search connections…",
        emptyMessage: state?.connectionError || "No LLM connections found.",
        clearable: true,
        clearLabel: "No connection",
        ariaLabel: "Director connection",
        onChange: (value) => mutate({ connectionId: value || null, modelOverride: "" }, true)
      }), fallback);
    else
      fallback();
    return field("Connection", slot);
  }
  function modelField() {
    const slot = el("div", "lw-control");
    const selected = state?.connections.find((item) => item.id === draft.connectionId);
    const fallback = () => {
      const input = el("input", "lw-input");
      input.type = "text";
      input.placeholder = selected?.model || "Model ID";
      input.value = draft.modelOverride;
      input.disabled = !selected;
      input.setAttribute("aria-label", "Director model");
      input.addEventListener("input", () => mutate({ modelOverride: input.value }));
      slot.replaceChildren(input);
    };
    if (selected && ctx.components?.mountModelCombobox)
      queueMount(() => ctx.components.mountModelCombobox(slot, {
        value: draft.modelOverride,
        connection: { kind: "llm", id: selected.id },
        appearance: "standard",
        placeholder: selected.model || "Model ID",
        browseHint: selected.model ? `Connection default: ${selected.model}` : "Choose a model for this connection.",
        onChange: (value) => mutate({ modelOverride: value })
      }), fallback);
    else
      fallback();
    return field("Model", slot, selected?.model ? "Leave blank to use the connection’s default." : selected ? "Choose a model for this connection." : "Select a connection to choose a model.");
  }
  function numberField(label, key, value, min, max, step, hint) {
    const slot = el("div", "lw-control");
    const fallback = () => {
      const input = el("input", "lw-input");
      input.type = "number";
      input.value = String(value);
      input.min = String(min);
      input.max = String(max);
      input.step = String(step);
      input.setAttribute("aria-label", label);
      input.addEventListener("change", () => {
        if (input.value !== "")
          mutate({ [key]: Number(input.value) });
      });
      slot.replaceChildren(input);
    };
    if (ctx.components?.mountNumberStepper)
      queueMount(() => ctx.components.mountNumberStepper(slot, {
        value,
        min,
        max,
        step,
        onChange: (next) => {
          if (next !== null)
            mutate({ [key]: next });
        }
      }), fallback);
    else
      fallback();
    return field(label, slot, hint);
  }
  function textAreaField(label, key, value, hint) {
    const input = el("textarea", `lw-textarea${key === "additionalNotes" ? "" : " lw-template"}`);
    input.value = value;
    if (key === "additionalNotes")
      input.placeholder = "What should the Director keep in mind?";
    input.spellcheck = key === "additionalNotes";
    input.addEventListener("input", () => mutate({ [key]: input.value }));
    return field(label, input, hint);
  }
  function selectedConnection() {
    return state?.connections.find((item) => item.id === draft.connectionId) ?? null;
  }
  function providerInfo() {
    return JEV_PROVIDERS[draft.jev.provider];
  }
  function hasJevKey() {
    return !!state?.hasJevKey;
  }
  function canTestJev() {
    if (!state?.permissions.corsProxy)
      return false;
    if (jevKeyDraft.trim())
      return true;
    return hasJevKey();
  }
  function selectControl(value, options, ariaLabel, onChange) {
    const slot = el("div", "lw-control");
    const select = el("select", "lw-select");
    for (const option of options)
      select.appendChild(new Option(option.label, option.value));
    select.value = value;
    select.setAttribute("aria-label", ariaLabel);
    select.addEventListener("change", () => onChange(select.value));
    slot.appendChild(select);
    return slot;
  }
  function numberInput(value, min, max, step, ariaLabel, onChange) {
    const input = el("input", "lw-input");
    input.type = "number";
    input.value = String(value);
    input.min = String(min);
    input.max = String(max);
    input.step = String(step);
    input.setAttribute("aria-label", ariaLabel);
    input.addEventListener("change", () => {
      if (input.value === "")
        return;
      const parsed = Number(input.value);
      if (Number.isFinite(parsed))
        onChange(Math.min(max, Math.max(min, parsed)));
    });
    return input;
  }
  function mutateJev(patch, rerender = false) {
    mutate({ jev: { ...draft.jev, ...patch } }, rerender);
  }
  function mutateGate(gateId, patch) {
    const current = draft.jev.gatePolicy[gateId] ?? {};
    mutateJev({ gatePolicy: { ...draft.jev.gatePolicy, [gateId]: { ...current, ...patch } } });
  }
  function resetGate(gateId) {
    if (!(gateId in draft.jev.gatePolicy))
      return;
    const next = { ...draft.jev.gatePolicy };
    delete next[gateId];
    mutateJev({ gatePolicy: next }, true);
  }
  function effectivePolicy(definition) {
    const override = draft.jev.gatePolicy[definition.id] ?? {};
    return {
      enabled: override.enabled ?? definition.enabledByDefault,
      threshold: override.threshold ?? (definition.id === "confidence_escalation" ? draft.jev.minConfidence : definition.threshold),
      fallback: override.fallback ?? definition.fallback
    };
  }
  function testJev() {
    if (jevTestPending || !canTestJev())
      return;
    jevTestPending = true;
    showNotice({ tone: "info", text: "Testing Jev…" }, 0);
    updateJevTestButton();
    send({ type: "test_jev", settings: draft, apiKey: jevKeyDraft.trim() || undefined });
  }
  function updateJevStatus() {
    const target = drawer.root.querySelector("[data-lw-jev-status]");
    if (!target)
      return;
    const tone = !draft.jev.enabled ? "neutral" : !state?.permissions.corsProxy || !hasJevKey() && !jevKeyDraft.trim() ? "warning" : "success";
    const text = !draft.jev.enabled ? "Off" : !state?.permissions.corsProxy ? "Needs permission" : hasJevKey() || jevKeyDraft.trim() ? "Ready" : "Needs key";
    target.replaceChildren(pill(text, tone));
  }
  function updateJevTestButton() {
    updateJevStatus();
    const node = drawer.root.querySelector("[data-lw-jev-test]");
    if (node) {
      node.disabled = jevTestPending || !canTestJev();
      node.setAttribute("aria-busy", String(jevTestPending));
      node.textContent = jevTestPending ? "Testing Jev…" : "Test Jev";
    }
    const hint = drawer.root.querySelector("[data-lw-jev-hint]");
    if (hint) {
      hint.textContent = !state?.permissions.corsProxy ? "The cors_proxy permission is required to reach Jev." : jevKeyDraft.trim() ? "Sends one tiny yes/no question and stores the key if it works." : hasJevKey() ? "Uses the stored key. One tiny yes/no question; your chat is not sent." : "Paste an API key to test the connection.";
    }
  }
  function jevSection() {
    const section = el("section", "lw-section");
    section.append(el("h2", "lw-section-title", "Jev simulation"));
    const panel = el("div", "lw-panel");
    panel.dataset.active = String(draft.jev.enabled);
    const head = el("div", "lw-row");
    const headCopy = el("div", "lw-row-copy");
    const headTitle = el("div", "lw-row-title");
    headTitle.append(document.createTextNode("Use Jev gates"));
    const statusSlot = el("span");
    statusSlot.dataset.lwJevStatus = "";
    headTitle.append(statusSlot);
    headTitle.classList.add("lw-title-row");
    headCopy.append(headTitle, el("div", "lw-hint", "Ask a cheap decision model whether each turn needs the Director at all."));
    head.append(headCopy);
    const headSwitch = el("div", "lw-control");
    const headFallback = () => {
      const input = el("input");
      input.type = "checkbox";
      input.checked = draft.jev.enabled;
      input.setAttribute("aria-label", "Use Jev gates");
      input.addEventListener("change", () => mutateJev({ enabled: input.checked }, true));
      headSwitch.replaceChildren(input);
    };
    if (typeof ctx.components?.mountSwitch === "function") {
      queueMount(() => ctx.components.mountSwitch(headSwitch, {
        checked: draft.jev.enabled,
        size: "md",
        ariaLabel: "Use Jev gates",
        onChange: (enabled) => mutateJev({ enabled }, true)
      }), headFallback);
    } else
      headFallback();
    head.append(headSwitch);
    panel.append(head);
    if (!draft.jev.enabled) {
      const card = el("div", "lw-control-card");
      card.append(el("div", "lw-panel-soon", "Jev is off. LumiWorld runs exactly as the Director-only baseline: one Director call per selected reply type, no network calls beyond your own connection."));
      panel.append(card);
      section.append(panel);
      return section;
    }
    const connection = el("div", "lw-control-card");
    const connectionHead = el("div", "lw-control-head");
    const connectionTitle = el("div");
    connectionTitle.append(el("div", "lw-control-title", "Decision provider"));
    const note = el("div", "lw-provider-note");
    const link = el("a", undefined, `${providerInfo().label} API keys`);
    link.href = providerInfo().keyUrl;
    link.target = "_blank";
    link.rel = "noreferrer noopener";
    note.append(document.createTextNode("Get one from "), link, document.createTextNode("."));
    connectionTitle.append(note);
    connectionHead.append(connectionTitle);
    connection.append(connectionHead);
    connection.append(segmented(draft.jev.provider, JEV_PROVIDER_IDS.map((id) => ({ value: id, label: JEV_PROVIDERS[id].label })), "Jev provider", (value) => mutateJev({ provider: value, model: "" }, true)));
    const fields = el("div", "lw-fields");
    fields.append(field("Model", textInput(draft.jev.model, providerInfo().defaultModel, "Jev model", (value) => mutateJev({ model: value })), `Blank uses ${providerInfo().defaultModel}.`), field("State cap (chars)", numberInput(draft.jev.maxStateChars, 2000, 32000, 1000, "Jev state cap", (value) => mutateJev({ maxStateChars: value })), "Jev allows 32k tokens for the state."));
    connection.append(fields);
    panel.append(connection);
    const credential = el("div", "lw-control-card");
    const credentialHead = el("div", "lw-control-head");
    credentialHead.append(el("div", "lw-control-title", "API key"));
    credentialHead.append(pill(hasJevKey() ? "Stored" : "Not set", hasJevKey() ? "success" : "warning"));
    credential.append(credentialHead);
    const keyRow = el("div", "lw-key-row");
    const keyInput = el("input", "lw-input");
    keyInput.type = "password";
    keyInput.autocomplete = "off";
    keyInput.spellcheck = false;
    keyInput.value = jevKeyDraft;
    keyInput.placeholder = hasJevKey() ? "A key is stored — paste to replace" : "Paste your API key";
    keyInput.setAttribute("aria-label", "Jev API key");
    keyInput.addEventListener("input", () => {
      jevKeyDraft = keyInput.value;
      updateJevTestButton();
    });
    const clear = button("Clear", () => {
      jevKeyDraft = "";
      send({ type: "clear_jev_key", provider: draft.jev.provider });
    });
    clear.disabled = !hasJevKey();
    keyRow.append(keyInput, clear);
    credential.append(keyRow);
    credential.append(el("div", "lw-hint", "Encrypted at rest per Lumiverse user, and never sent back to this panel."));
    const actions = el("div", "lw-actions");
    const test = button("Test Jev", testJev, true);
    test.dataset.lwJevTest = "";
    const hint = el("div", "lw-hint lw-test-hint");
    hint.dataset.lwJevHint = "";
    actions.append(test, hint);
    credential.append(actions);
    panel.append(credential);
    const shape = el("div", "lw-control-card");
    const shapeHead = el("div", "lw-control-head");
    shapeHead.append(el("div", "lw-control-title", "What gets sent"));
    shapeHead.append(pill("Capped", "primary"));
    shape.append(shapeHead);
    const shapeFields = el("div", "lw-fields");
    shapeFields.append(field("History messages", numberInput(draft.jev.historyMessageLimit, 0, 24, 1, "Jev history messages", (value) => mutateJev({ historyMessageLimit: value }))), field("Timeout (ms)", numberInput(draft.jev.timeoutMs, 1000, 60000, 500, "Jev timeout", (value) => mutateJev({ timeoutMs: value }))), field("Confidence floor", numberInput(draft.jev.minConfidence, 0, 1, 0.05, "Confidence floor", (value) => mutateJev({ minConfidence: value })), "Applies to every gate. Decisions below it use their fallback."));
    shape.append(shapeFields);
    shape.append(el("div", "lw-hint", "The state is a redacted projection: recent turns plus the context sources you enabled, never your full transcript."));
    panel.append(shape);
    section.append(panel);
    return section;
  }
  function gatesSection() {
    const definitions = GATE_CATALOG;
    const enabled = definitions.filter((definition) => effectivePolicy(definition).enabled).length;
    const customised = definitions.filter((definition) => (definition.id in draft.jev.gatePolicy)).length;
    return collapsible({
      title: "Jev gates",
      badge: `${enabled}/${definitions.length}`,
      expanded: gatesOpen,
      onToggle: (open) => {
        gatesOpen = open;
      },
      className: "lw-gates"
    }, (body) => {
      body.classList.add("lw-gate-body");
      body.append(el("p", "lw-hint", "Enabled gates travel in one batched request per phase, so adding gates adds no round trips. A gate that cannot answer uses its own fallback."));
      for (const category of GATE_CATEGORY_ORDER) {
        const group = definitions.filter((definition) => definition.category === category);
        if (group.length === 0)
          continue;
        const on = group.filter((definition) => effectivePolicy(definition).enabled).length;
        const head = el("div", "lw-cat-head");
        const title = el("span", "lw-cat-title");
        title.append(el("span", undefined, GATE_CATEGORY_LABELS[category]), el("span", "lw-cat-count", `${on}/${group.length}`));
        const all = button(on === group.length ? "Disable all" : "Enable all", () => {
          const next = { ...draft.jev.gatePolicy };
          for (const definition of group)
            next[definition.id] = { ...next[definition.id], enabled: on !== group.length };
          mutateJev({ gatePolicy: next }, true);
        });
        all.title = on === group.length ? `Turn off every ${GATE_CATEGORY_LABELS[category]} gate` : `Turn on every ${GATE_CATEGORY_LABELS[category]} gate`;
        head.append(title, all);
        body.append(head);
        for (const definition of group)
          body.append(gateCard(definition));
      }
      if (customised > 0) {
        const footer = el("div", "lw-cat-head");
        const cleared = button(`Reset ${customised} changed gate${customised === 1 ? "" : "s"} to defaults`, () => {
          mutateJev({ gatePolicy: {} }, true);
        });
        cleared.className = "lw-button lw-button-primary";
        footer.append(cleared);
        body.append(footer);
      }
    });
  }
  function gateCard(definition) {
    const policy = effectivePolicy(definition);
    const isOpen = openGates.has(definition.id);
    const isCustom = definition.id in draft.jev.gatePolicy;
    const card = el("div", "lw-gate");
    card.dataset.lwGate = definition.id;
    card.dataset.on = String(policy.enabled);
    card.dataset.open = String(isOpen);
    card.dataset.custom = String(isCustom);
    const switchSlot = el("div", "lw-control");
    const switchFallback = () => {
      const input = el("input");
      input.type = "checkbox";
      input.checked = policy.enabled;
      input.setAttribute("aria-label", definition.label);
      input.addEventListener("change", () => mutateGate(definition.id, { enabled: input.checked }));
      switchSlot.replaceChildren(input);
    };
    if (typeof ctx.components?.mountSwitch === "function") {
      queueMount(() => ctx.components.mountSwitch(switchSlot, {
        checked: policy.enabled,
        size: "sm",
        ariaLabel: definition.label,
        onChange: (checked) => mutateGate(definition.id, { enabled: checked })
      }), switchFallback);
    } else
      switchFallback();
    const copy = el("div", "lw-gate-copy");
    const meta = el("div", "lw-gate-meta");
    const shape = definition.codeOnly ? definition.appliesWhen ?? "Evaluated in code" : `${definition.primitiveLabel} · ${definition.phase === "gate" ? "before the Director" : "verifies the draft"}`;
    meta.append(el("span", undefined, shape));
    if (isCustom)
      meta.append(document.createTextNode(" · "), el("code", undefined, "custom"));
    copy.append(el("div", "lw-gate-name", definition.label), meta);
    const caret = el("button", "lw-gate-caret", isOpen ? "▾" : "▸");
    caret.type = "button";
    caret.setAttribute("aria-expanded", String(isOpen));
    caret.setAttribute("aria-label", `${isOpen ? "Hide" : "Show"} ${definition.label} settings`);
    caret.addEventListener("click", () => {
      if (isOpen)
        openGates.delete(definition.id);
      else
        openGates.add(definition.id);
      mutate({}, true);
    });
    const row = el("div", "lw-gate-row");
    row.append(switchSlot, copy, caret);
    card.append(row);
    if (isOpen)
      card.append(gateSheet(definition, policy, isCustom));
    return card;
  }
  function gateSheet(definition, policy, isCustom) {
    const sheet = el("div", "lw-gate-sheet");
    if (definition.codeOnly) {
      sheet.append(el("div", "lw-sheet-copy", definition.rationale));
      if (isCustom)
        sheet.append(gateReset(definition));
      return sheet;
    }
    sheet.append(el("div", "lw-sheet-copy", definition.rationale));
    const floorHead = el("div", "lw-sheet-label");
    const value = el("button", "lw-diag-value", policy.threshold.toFixed(2));
    value.type = "button";
    value.title = "Click to type an exact floor";
    let editing = false;
    value.addEventListener("click", () => {
      if (editing)
        return;
      editing = true;
      const input = numberInput(policy.threshold, 0, 1, 0.05, `${definition.label} threshold`, (next) => mutateGate(definition.id, { threshold: next }));
      input.className = "lw-input";
      value.replaceWith(input);
      input.focus();
      input.select();
    });
    floorHead.append(el("span", undefined, "Confidence floor"), value);
    sheet.append(floorHead);
    const track = el("div", "lw-control");
    const sliderFallback = () => {
      track.replaceChildren(numberInput(policy.threshold, 0, 1, 0.05, `${definition.label} threshold`, (next) => mutateGate(definition.id, { threshold: next })));
    };
    if (typeof ctx.components?.mountRangeSlider === "function") {
      queueMount(() => ctx.components.mountRangeSlider(track, {
        min: 0,
        max: 1,
        step: 0.05,
        value: policy.threshold,
        onCommit: (next) => mutateGate(definition.id, { threshold: next })
      }), sliderFallback);
    } else
      sliderFallback();
    sheet.append(track);
    sheet.append(el("div", "lw-hint", "Answers below this are escalated: the gate stops deciding and uses its fallback instead."));
    const fallbackHead = el("div", "lw-sheet-label");
    fallbackHead.append(el("span", undefined, "When it cannot answer"));
    sheet.append(fallbackHead, selectControl(policy.fallback, GATE_FALLBACKS2.map((value) => ({ value, label: GATE_FALLBACK_LABELS[value] })), `${definition.label} fallback`, (next) => mutateGate(definition.id, { fallback: next })));
    if (isCustom)
      sheet.append(gateReset(definition));
    return sheet;
  }
  function gateReset(definition) {
    const reset = button("Reset to default", () => resetGate(definition.id));
    reset.className = "lw-button lw-gate-reset";
    return reset;
  }
  function latestJevRun() {
    for (const run of state?.runs ?? []) {
      if (run.jev)
        return { run: { jev: run.jev } };
    }
    return null;
  }
  function diagnosticsSection() {
    const diagnostics = latestJevRun()?.run.jev ?? null;
    const summary = summarizeJevDiagnostics(diagnostics);
    return collapsible({
      title: "Last turn decisions",
      badge: diagnostics ? diagnostics.status === "ok" ? "answered" : diagnostics.status : undefined,
      badgeTone: diagnostics ? diagnostics.status === "ok" ? "success" : diagnostics.status === "degraded" ? "warning" : "error" : "neutral",
      expanded: diagnosticsOpen,
      onToggle: (open) => {
        diagnosticsOpen = open;
      }
    }, (body) => {
      if (!diagnostics) {
        body.append(el("p", "lw-hint", state?.settings.jev.enabled ? "Generate a reply to see what each gate decided for that turn." : "Turn on Use Jev gates to start recording decisions."));
        return;
      }
      body.append(diagnosticsPanel(diagnostics, summary));
    });
  }
  function diagnosticsPanel(diagnostics, summary) {
    const wrap = el("div", "lw-diag");
    const strip = el("div", "lw-diag-strip");
    const status = el("span", "lw-badge");
    status.dataset.tone = diagnostics.status === "ok" ? "success" : diagnostics.status === "degraded" ? "warning" : "error";
    status.append(el("span", "lw-dot"), el("span", undefined, diagnostics.status === "ok" ? "Answered every gate" : diagnostics.status === "degraded" ? "Degraded" : "Skipped the Director"));
    strip.append(status);
    if (diagnostics.resolvedModel)
      strip.append(el("span", "lw-badge", diagnostics.resolvedModel));
    strip.append(el("span", "lw-badge", `${diagnostics.requestCount} request${diagnostics.requestCount === 1 ? "" : "s"}`));
    if (diagnostics.fallbackCount) {
      const fallback = el("span", "lw-badge");
      fallback.dataset.tone = "warning";
      fallback.append(el("span", "lw-dot"), el("span", undefined, `${diagnostics.fallbackCount} fallback`));
      strip.append(fallback);
    }
    if (diagnostics.escalatedCount) {
      strip.append(el("span", "lw-badge", `${diagnostics.escalatedCount} escalated`));
    }
    const latency = [diagnostics.gatePhaseMs, diagnostics.verifyPhaseMs].filter((value) => value !== null).reduce((total, value) => total + value, 0);
    if (latency > 0)
      strip.append(el("span", "lw-badge", `${latency}ms in Jev`));
    if (diagnostics.inputTokens !== null)
      strip.append(el("span", "lw-badge", `${diagnostics.inputTokens} in / ${diagnostics.outputTokens ?? 0} out`));
    if (diagnostics.stateCompacted)
      strip.append(el("span", "lw-badge", "state compacted"));
    wrap.append(strip);
    if (diagnostics.error) {
      const notice = el("div", "lw-notice", diagnostics.error);
      notice.dataset.tone = "warning";
      wrap.append(notice);
    }
    const decided = diagnostics.gates.filter((record) => record.gateId !== "confidence_escalation" && record.gateId !== "budget_degradation");
    const computed = diagnostics.gates.filter((record) => record.gateId === "confidence_escalation" || record.gateId === "budget_degradation");
    const list = el("div", "lw-diag-list");
    for (const record of decided)
      list.append(gateResultRow(record));
    for (const record of computed)
      list.append(gateResultRow(record, true));
    wrap.append(list);
    if (summary)
      wrap.append(el("p", "lw-hint", summary));
    return wrap;
  }
  function gateResultRow(record, informational = false) {
    const flagged = !informational && (record.usedFallback || record.escalated);
    const row = el("div", "lw-diag-row");
    row.dataset.flag = String(flagged);
    row.dataset.on = String(!informational);
    const head = el("div", "lw-diag-head");
    head.append(el("span", "lw-diag-name", record.label), el("span", "lw-diag-value", describeGateValue(record)));
    const meta = el("div", "lw-diag-meta");
    if (record.confidence !== null) {
      const confidence = el("span", "lw-badge", `${record.confidenceDerived ? "~" : ""}${record.confidence.toFixed(2)}`);
      if (record.confidence < record.threshold) {
        confidence.dataset.tone = "warning";
        confidence.title = `Below the ${record.threshold.toFixed(2)} floor`;
      }
      meta.append(confidence);
    }
    if (record.usedFallback && !informational) {
      const fallback = el("span", "lw-badge", GATE_FALLBACK_LABELS[record.fallback]);
      fallback.dataset.tone = "warning";
      meta.append(fallback);
    }
    row.append(head, meta);
    if (record.note)
      row.append(el("span", "lw-diag-note", record.note));
    return row;
  }
  function describeGateValue(record) {
    if (record.value === null)
      return "no answer";
    if (typeof record.value === "boolean")
      return record.value ? "yes" : "no";
    return String(record.value);
  }
  function canTest() {
    const connection = selectedConnection();
    return !!(state?.permissions.generation && connection && (draft.modelOverride.trim() || connection.model.trim()));
  }
  function testDirector() {
    if (testPending || !canTest())
      return;
    testPending = true;
    showNotice({ tone: "info", text: "Testing Director…" }, 0);
    updateTestButton();
    send({ type: "test_controller", settings: draft });
  }
  function updateTestButton() {
    const node = drawer.root.querySelector("[data-lw-test]");
    if (node) {
      node.disabled = testPending || !canTest();
      node.setAttribute("aria-busy", String(testPending));
      node.replaceChildren();
      const icon = el("span");
      icon.setAttribute("aria-hidden", "true");
      icon.innerHTML = `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"><path d="m7 4 9 6-9 6V4Z"/></svg>`;
      node.append(icon, document.createTextNode(testPending ? "Testing Director…" : "Test Director"));
    }
    const hint = drawer.root.querySelector("[data-lw-test-hint]");
    if (hint) {
      hint.textContent = !selectedConnection() ? "Choose a connection to test the Director." : !state?.permissions.generation ? "Generation permission is required to test." : !canTest() ? "Choose a model to test the Director." : "Uses a sample prompt. Your chat stays unchanged.";
    }
  }
  function renderWarnings(target) {
    if (!state)
      return;
    const missing = [
      !state.permissions.interceptor ? "Interceptor" : null,
      !state.permissions.generation ? "Generation" : null,
      draft.includeCharacter && !state.permissions.characters ? "Characters" : null,
      draft.includeUserPersona && !state.permissions.personas ? "Personas" : null,
      draft.includeWorldInfoEntries && !state.permissions.worldBooks ? "World Books" : null
    ].filter(Boolean);
    if (missing.length) {
      const warning = el("div", "lw-notice", `Grant ${missing.join(", ")} permission${missing.length === 1 ? "" : "s"} in Lumiverse Extensions.`);
      warning.dataset.tone = "warning";
      target.append(warning);
    }
    if (state.connectionError) {
      const warning = el("div", "lw-notice", state.connectionError);
      warning.dataset.tone = "error";
      target.append(warning);
    }
    if (draft.enabled && !draft.generationTypes.length) {
      const warning = el("div", "lw-notice", "No reply types are selected, so the Director will not run.");
      warning.dataset.tone = "warning";
      target.append(warning);
    }
  }
  function updateWarnings() {
    const target = drawer.root.querySelector("[data-lw-warnings]");
    if (!target)
      return;
    target.replaceChildren();
    renderWarnings(target);
    target.hidden = !target.childElementCount;
  }
  function render() {
    destroyHandles();
    pending = [];
    nextFieldId = 0;
    const root = el("div", "lw-root");
    const shell = el("div", "lw-shell");
    root.append(shell);
    drawer.root.replaceChildren(root);
    const header = el("header", "lw-header");
    const brand = el("div", "lw-brand");
    const icon = el("div", "lw-icon");
    icon.innerHTML = ICON;
    icon.setAttribute("aria-hidden", "true");
    const title = el("div");
    title.append(el("h1", "lw-title", "Director"));
    const directorStatus = el("span", "lw-status");
    directorStatus.dataset.lwDirectorStatus = "";
    title.append(directorStatus);
    brand.append(icon, title);
    header.append(brand);
    if (state)
      header.append(switchField("Enable Director", draft.enabled, (enabled) => mutate({ enabled })));
    shell.append(header);
    shell.append(el("p", "lw-intro", "Guide your next reply with a private Director note."));
    const notices = el("div");
    notices.dataset.lwNotice = "";
    shell.append(notices);
    const warnings = el("div");
    warnings.dataset.lwWarnings = "";
    shell.append(warnings);
    updateWarnings();
    if (!state) {
      shell.append(el("div", "lw-loading", "Loading Director settings…"));
      updateDirectorStatus();
      renderNotice();
      return;
    }
    const core = el("section", "lw-setup");
    core.setAttribute("aria-label", "Director connection");
    const fields = el("div", "lw-fields");
    fields.append(connectionField(), modelField());
    core.append(fields);
    const actions = el("div", "lw-actions");
    const test = button("Test Director", testDirector, true);
    test.dataset.lwTest = "";
    const testHint = el("div", "lw-hint lw-test-hint");
    testHint.dataset.lwTestHint = "";
    testHint.id = "lw-test-hint";
    test.setAttribute("aria-describedby", testHint.id);
    actions.append(test, testHint);
    core.append(actions);
    shell.append(core);
    const generation = el("section", "lw-section");
    const options = el("fieldset", "lw-options");
    options.append(el("legend", "lw-section-title", "Run before"));
    for (const type of VISIBLE_GENERATION_TYPES) {
      const label = el("label", "lw-option");
      const input = el("input");
      input.type = "checkbox";
      input.checked = draft.generationTypes.includes(type);
      input.addEventListener("change", () => mutate({ generationTypes: input.checked ? [...draft.generationTypes, type] : draft.generationTypes.filter((item) => item !== type) }));
      label.append(input, el("span", undefined, LABELS[type]));
      options.append(label);
    }
    generation.append(options);
    shell.append(generation);
    const context = el("section", "lw-section");
    context.append(el("h2", "lw-section-title", "Include in context"));
    const contextRows = el("div", "lw-context");
    contextRows.append(switchField("Character", draft.includeCharacter, (includeCharacter) => mutate({ includeCharacter })), switchField("User persona", draft.includeUserPersona, (includeUserPersona) => mutate({ includeUserPersona })), switchField("Activated World Info", draft.includeWorldInfoEntries, (includeWorldInfoEntries) => mutate({ includeWorldInfoEntries })));
    context.append(contextRows);
    shell.append(context);
    const notes = el("details", "lw-details");
    notes.open = notesOpen;
    notes.addEventListener("toggle", () => {
      notesOpen = notes.open;
    });
    const notesSummary = el("summary");
    const notesCopy = el("span", "lw-summary-copy");
    const notesHint = el("span", "lw-hint", draft.additionalNotes.trim() ? "Your extra guidance" : "Optional guidance for the next reply");
    notesHint.dataset.lwNotesHint = "";
    notesCopy.append(el("span", undefined, "Director notes"), notesHint);
    notesSummary.append(notesCopy);
    notes.append(notesSummary);
    const notesBody = el("div", "lw-details-body");
    notesBody.append(textAreaField("Private guidance", "additionalNotes", draft.additionalNotes));
    notes.append(notesBody);
    shell.append(notes);
    shell.append(jevSection());
    shell.append(gatesSection());
    shell.append(diagnosticsSection());
    const advanced = el("details", "lw-details");
    advanced.open = advancedOpen;
    advanced.addEventListener("toggle", () => {
      advancedOpen = advanced.open;
    });
    const advancedSummary = el("summary");
    const advancedCopy = el("span", "lw-summary-copy");
    advancedCopy.append(el("span", undefined, "Advanced settings"), el("span", "lw-hint", "Response limits & prompt templates"));
    advancedSummary.append(advancedCopy);
    advanced.append(advancedSummary);
    const advancedBody = el("div", "lw-details-body");
    const parameters = el("div", "lw-fields");
    parameters.append(numberField("Temperature", "temperature", draft.temperature, 0, 2, 0.05), numberField("Max tokens", "maxTokens", draft.maxTokens, 64, Number.MAX_SAFE_INTEGER, 1), numberField("Timeout (ms)", "timeoutMs", draft.timeoutMs, 1000, 300000, 1000, "Lumiverse limits interceptors to five minutes."), numberField("History messages", "historyMessageLimit", draft.historyMessageLimit, 0, Number.MAX_SAFE_INTEGER, 1), numberField("Prompt cap (chars)", "maxInputChars", draft.maxInputChars, 4000, 500000, 1000), numberField("Run log limit", "runLogLimit", draft.runLogLimit, 0, 50, 1));
    advancedBody.append(parameters);
    advanced.append(advancedBody);
    shell.append(advanced);
    const templates = el("details", "lw-details");
    templates.open = templatesOpen;
    templates.addEventListener("toggle", () => {
      templatesOpen = templates.open;
    });
    templates.append(el("summary", undefined, "Prompt templates"));
    const templateBody = el("div", "lw-details-body");
    templateBody.append(textAreaField("System template", "systemTemplate", draft.systemTemplate), textAreaField("User template", "userTemplate", draft.userTemplate));
    templates.append(templateBody);
    advancedBody.append(templates);
    const footer = el("footer", "lw-footer");
    footer.append(el("span", undefined, `LumiWorld ${VERSION}`));
    const footerStatus = el("div", "lw-footer-status");
    const saveStatus = el("span", "lw-save");
    saveStatus.dataset.lwSaveStatus = "";
    saveStatus.setAttribute("role", "status");
    const retry = button("Retry save", () => scheduleSave(0));
    retry.dataset.lwRetry = "";
    footerStatus.append(saveStatus, retry);
    footer.append(footerStatus);
    shell.append(footer);
    flushMounts();
    updateDirectorStatus();
    updateSaveStatus();
    updateTestButton();
    updateJevTestButton();
    renderNotice();
  }
  cleanups.push(ctx.onBackendMessage((payload) => {
    const message = payload;
    if (message.type === "state") {
      state = message.state;
      if (!queue.isDirty && !saveTimer)
        draft = normalizeFrontendSettings(message.state.settings);
      if (drawer.root.contains(document.activeElement) && document.activeElement?.matches("input,textarea,select,[role=combobox]")) {
        updateWarnings();
        updateDirectorStatus();
        updateSaveStatus();
        updateTestButton();
      } else
        render();
      return;
    }
    if (message.type === "settings_saved") {
      const more = queue.acknowledge(message.revision);
      if (more)
        scheduleSave(0);
      else {
        saveState = "saved";
        if (state)
          state = { ...state, settings: message.settings };
        if (notice?.text.startsWith("Settings were not saved:"))
          showNotice(null);
      }
      updateSaveStatus();
      return;
    }
    if (message.type === "settings_save_error") {
      queue.fail(message.revision);
      saveState = "error";
      showNotice({ tone: "error", text: `Settings were not saved: ${message.message}` }, 0);
      updateSaveStatus();
      return;
    }
    if (message.type === "test_result") {
      testPending = false;
      updateTestButton();
      showNotice(message.ok ? { tone: "success", text: `Test succeeded on ${message.connectionName} / ${message.model}: ${message.directive}` } : { tone: "error", text: message.error }, 15000);
      return;
    }
    if (message.type === "jev_test_result") {
      jevTestPending = false;
      if (message.ok)
        jevKeyDraft = "";
      updateJevTestButton();
      showNotice(message.ok ? {
        tone: "success",
        text: `Jev answered on ${message.provider} / ${message.model} in ${message.latencyMs}ms (signal: ${message.answer}${message.confidence !== null ? `, confidence ${message.confidence.toFixed(2)}` : ""}).`
      } : { tone: "error", text: message.error }, 15000);
      return;
    }
    if (message.type === "error") {
      testPending = false;
      updateTestButton();
      showNotice({ tone: "error", text: message.message }, 15000);
    }
  }));
  cleanups.push(ctx.events.on("CHAT_CHANGED", () => send({ type: "refresh_state" })));
  send({ type: "ready" });
  render();
  return () => {
    if (saveTimer)
      clearTimeout(saveTimer);
    if (noticeTimer)
      clearTimeout(noticeTimer);
    destroyHandles();
    for (const cleanup of cleanups.reverse())
      try {
        cleanup();
      } catch {}
  };
}
export {
  SettingsSaveQueue,
  normalizeFrontendSettings,
  setup
};
