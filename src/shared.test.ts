import { describe, expect, test } from "bun:test";
import {
  DEFAULT_SETTINGS,
  PREVIOUS_BLOCK_WORLD_AGENT_SCHEDULE_TEMPLATE,
  PREVIOUS_DEFAULT_SYSTEM_TEMPLATE,
  PREVIOUS_DEFAULT_USER_TEMPLATE,
  PREVIOUS_FULL_DAY_WORLD_AGENT_SCHEDULE_TEMPLATE,
  PREVIOUS_DEFAULT_WORLD_AGENT_SCHEDULE_TEMPLATE,
  PRE_CONTEXT_DEFAULT_USER_TEMPLATE,
  PRE_REBRAND_DEFAULT_SYSTEM_TEMPLATE,
  advanceWorldAgentHour,
  appendRunLog,
  buildControllerMessages,
  buildInjectedDirective,
  buildWorldAgentStateInjection,
  describeEmptyControllerResponse,
  describeEmptyWorldAgentResponse,
  extractControllerResponseText,
  formatPromptForController,
  formatWorldAgentClock,
  formatWorldAgentHourLabel,
  isWorldAgentHourDue,
  makeDefaultWorldAgentState,
  normalizeRunLog,
  normalizeSettings,
  normalizeWorldAgentState,
  parseControllerDirective,
  parseControllerDirectiveFromResponse,
  parseWorldAgentSchedule,
  parseWorldAgentUpdate,
  resolveControllerTarget,
  resolveWorldAgentTarget,
  resolveWorldInfoContextMessages,
  extractActivatedWorldInfoEntries,
  resolveIdentityMacros,
  selectChatHistoryMessagesForController,
  selectControllerMessagesForController,
  serializeMessageContent,
  shouldInterceptGeneration,
  type LlmMessageLike,
  type RunLogEntry,
} from "./shared";

describe("settings normalization", () => {
  test("clamps numeric settings and restores empty templates", () => {
    const settings = normalizeSettings({
      enabled: true,
      connectionId: "  conn-1 ",
      modelOverride: "  controller-model ",
      temperature: 9,
      maxTokens: 2,
      timeoutMs: 500,
      maxInputChars: 20,
      historyMessageLimit: -4,
      includeWorldInfoEntries: true,
      includeUserPersona: false,
      includeCharacter: false,
      generationTypes: ["normal", "quiet", "swipe", "normal"],
      additionalNotes: "  remember the silver key ",
      systemTemplate: "",
      userTemplate: "",
      runLogLimit: 999,
    });

    expect(settings.enabled).toBe(true);
    expect(settings.connectionId).toBe("conn-1");
    expect(settings.modelOverride).toBe("controller-model");
    expect(settings.temperature).toBe(2);
    expect(settings.maxTokens).toBe(64);
    expect(settings.timeoutMs).toBe(1000);
    expect(settings.maxInputChars).toBe(4000);
    expect(settings.historyMessageLimit).toBe(0);
    expect(settings.includeWorldInfoEntries).toBe(true);
    expect(settings.includeUserPersona).toBe(false);
    expect(settings.includeCharacter).toBe(false);
    expect(settings.generationTypes).toEqual(["normal", "swipe"]);
    expect(settings.additionalNotes).toBe("remember the silver key");
    expect(settings.systemTemplate).toBe(DEFAULT_SETTINGS.systemTemplate);
    expect(settings.userTemplate).toBe(DEFAULT_SETTINGS.userTemplate);
    expect(settings.runLogLimit).toBe(50);
  });

  test("migrates previous built-in controller templates", () => {
    const settings = normalizeSettings({
      systemTemplate: PREVIOUS_DEFAULT_SYSTEM_TEMPLATE,
      userTemplate: PREVIOUS_DEFAULT_USER_TEMPLATE,
    });

    expect(settings.systemTemplate).toBe(DEFAULT_SETTINGS.systemTemplate);
    expect(settings.userTemplate).toBe(DEFAULT_SETTINGS.userTemplate);
  });

  test("migrates pre-rebrand built-in controller template", () => {
    const settings = normalizeSettings({
      systemTemplate: PRE_REBRAND_DEFAULT_SYSTEM_TEMPLATE,
      userTemplate: PRE_CONTEXT_DEFAULT_USER_TEMPLATE,
    });

    expect(settings.systemTemplate).toBe(DEFAULT_SETTINGS.systemTemplate);
    expect(settings.userTemplate).toBe(DEFAULT_SETTINGS.userTemplate);
  });

  test("does not cap controller max tokens at legacy 4096", () => {
    expect(normalizeSettings({ maxTokens: 32768 }).maxTokens).toBe(32768);
  });

  test("does not cap controller timeout at legacy 55 seconds", () => {
    expect(normalizeSettings({ timeoutMs: 600000 }).timeoutMs).toBe(600000);
  });

  test("migrates 0.2 settings into nested 0.3 world agent defaults", () => {
    const settings = normalizeSettings({
      enabled: true,
      connectionId: "director",
      worldAgent: {
        enabled: true,
        connectionId: "world",
        modelOverride: "sim-model",
        temperature: 0.9,
        maxTokens: 32000,
        timeoutMs: 180000,
        hourDurationMs: 120000,
        injectState: false,
        autoTickVisibleOnly: false,
        scheduleTemplate: "schedule {{char}}",
        updateTemplate: "update {{user}}",
      },
    });

    expect(settings.enabled).toBe(true);
    expect(settings.worldAgent).toMatchObject({
      enabled: true,
      connectionId: "world",
      modelOverride: "sim-model",
      temperature: 0.9,
      maxTokens: 32000,
      timeoutMs: 180000,
      hourDurationMs: 120000,
      injectState: false,
      autoTickVisibleOnly: false,
      scheduleTemplate: "schedule {{char}}",
      updateTemplate: "update {{user}}",
    });

    expect(normalizeSettings({}).worldAgent.enabled).toBe(false);
  });

  test("migrates the previous stock World Agent schedule template to the full-day version", () => {
    const settings = normalizeSettings({
      worldAgent: {
        scheduleTemplate: PREVIOUS_DEFAULT_WORLD_AGENT_SCHEDULE_TEMPLATE,
      },
    });

    expect(settings.worldAgent.scheduleTemplate).toBe(DEFAULT_SETTINGS.worldAgent.scheduleTemplate);
    expect(settings.worldAgent.scheduleTemplate).toContain("exactly 24 hourly entries");
    expect(settings.worldAgent.scheduleTemplate).toContain("one entry for every hour");
    expect(settings.worldAgent.scheduleTemplate).not.toContain("\"mood\"");
  });

  test("migrates the mood-writing full-day World Agent schedule template", () => {
    const settings = normalizeSettings({
      worldAgent: {
        scheduleTemplate: PREVIOUS_FULL_DAY_WORLD_AGENT_SCHEDULE_TEMPLATE,
      },
    });

    expect(settings.worldAgent.scheduleTemplate).toBe(DEFAULT_SETTINGS.worldAgent.scheduleTemplate);
    expect(settings.worldAgent.scheduleTemplate).toContain("Do not decide mood");
    expect(settings.worldAgent.scheduleTemplate).not.toContain("\"goal\"");
  });

  test("migrates the sparse-block World Agent schedule template", () => {
    const settings = normalizeSettings({
      worldAgent: {
        scheduleTemplate: PREVIOUS_BLOCK_WORLD_AGENT_SCHEDULE_TEMPLATE,
      },
    });

    expect(settings.worldAgent.scheduleTemplate).toBe(DEFAULT_SETTINGS.worldAgent.scheduleTemplate);
    expect(settings.worldAgent.scheduleTemplate).toContain("repeat the same location and activity for each hour");
  });
});

describe("generation gating", () => {
  test("skips disabled and quiet/background generation types", () => {
    const disabled = normalizeSettings({ enabled: false });
    expect(shouldInterceptGeneration(disabled, "normal").intercept).toBe(false);

    const enabled = normalizeSettings({ enabled: true });
    expect(shouldInterceptGeneration(enabled, "normal").intercept).toBe(true);
    expect(shouldInterceptGeneration(enabled, "quiet").intercept).toBe(false);
  });
});

describe("connection/model resolution", () => {
  test("uses model override when provided", () => {
    const settings = normalizeSettings({ connectionId: "conn-1", modelOverride: "override-model" });
    const target = resolveControllerTarget(settings, {
      id: "conn-1",
      name: "Controller",
      provider: "custom",
      model: "connection-model",
      isDefault: false,
      hasApiKey: true,
    });

    expect(target.ok).toBe(true);
    if (target.ok) {
      expect(target.model).toBe("override-model");
      expect(target.provider).toBe("custom");
    }
  });

  test("rejects missing connection or model", () => {
    expect(resolveControllerTarget(normalizeSettings({ connectionId: null }), null).ok).toBe(false);
    expect(
      resolveControllerTarget(normalizeSettings({ connectionId: "conn-1" }), {
        id: "conn-1",
        name: "No model",
        provider: "custom",
        model: "",
        isDefault: false,
        hasApiKey: true,
      }).ok,
    ).toBe(false);
  });

  test("resolves the World Agent connection independently", () => {
    const settings = normalizeSettings({
      connectionId: "director",
      modelOverride: "director-model",
      worldAgent: { connectionId: "world", modelOverride: "world-model" },
    });
    const target = resolveWorldAgentTarget(settings.worldAgent, {
      id: "world",
      name: "World",
      provider: "custom",
      model: "default-world",
      isDefault: false,
      hasApiKey: true,
    });

    expect(target.ok).toBe(true);
    if (target.ok) {
      expect(target.connectionId).toBe("world");
      expect(target.model).toBe("world-model");
    }
  });
});

describe("message serialization and prompt trimming", () => {
  test("serializes multimodal/tool parts into textual placeholders", () => {
    const text = serializeMessageContent([
      { type: "text", text: "look" },
      { type: "image", mime_type: "image/png" },
      { type: "tool_use", name: "search", input: { q: "storm" } },
      { type: "tool_result", tool_use_id: "abc", content: "found" },
    ]);

    expect(text).toContain("look");
    expect(text).toContain("[image:image/png]");
    expect(text).toContain("[tool_use:search");
    expect(text).toContain("[tool_result:abc]");
  });

  test("preserves leading system context and the recent tail under cap", () => {
    const messages: LlmMessageLike[] = [
      { role: "system", content: "IMPORTANT SYSTEM CONTEXT" },
      ...Array.from({ length: 18 }, (_, index) => ({
        role: index % 2 === 0 ? "user" : "assistant",
        content: `older-${index} ${"x".repeat(180)}`,
      }) as LlmMessageLike),
      { role: "user", content: "LATEST USER TURN SHOULD REMAIN" },
    ];

    const snapshot = formatPromptForController(messages, 1600);
    expect(snapshot.truncated).toBe(true);
    expect(snapshot.prompt.length).toBeLessThanOrEqual(1600);
    expect(snapshot.prompt).toContain("IMPORTANT SYSTEM CONTEXT");
    expect(snapshot.prompt).toContain("LATEST USER TURN SHOULD REMAIN");
    expect(snapshot.prompt).toContain("omitted");
  });

  test("selects only recent Lumiverse chat-history messages for the controller", () => {
    const messages: LlmMessageLike[] = [
      { role: "system", content: "persona scaffold" },
      { role: "user", content: "old user", __isChatHistory: true },
      { role: "assistant", content: "old assistant", __isChatHistory: true },
      { role: "system", content: "non-chat injected block" },
      { role: "user", content: "recent user", sourceIndexInChat: 12 },
      { role: "assistant", content: "recent assistant", sourceMessageId: "message-13" },
      { role: "system", content: "post-history instruction" },
    ];

    const selected = selectChatHistoryMessagesForController(messages, 2);
    expect(selected.map((message) => message.content)).toEqual(["recent user", "recent assistant"]);
    expect(selectChatHistoryMessagesForController(messages, 0)).toEqual([]);
  });

  test("builds controller input from resolved context blocks and recent chat history", () => {
    const messages: LlmMessageLike[] = [
      { role: "system", content: "old lore", __isWorldInfoEntry: true },
      { role: "user", content: "old user", __isChatHistory: true },
      { role: "assistant", content: "recent assistant", __isChatHistory: true },
      { role: "system", content: "new lore", __isWorldInfoEntry: true },
      { role: "user", content: "recent user", __isChatHistory: true },
    ];
    const contextMessages: LlmMessageLike[] = [
      { role: "system", content: "Persona text" },
      { role: "system", content: "new lore" },
    ];
    const selected = selectControllerMessagesForController(
      messages,
      normalizeSettings({ historyMessageLimit: 2, includeWorldInfoEntries: true }),
      contextMessages,
    );

    expect(selected.map((message) => message.content)).toEqual([
      "Persona text",
      "new lore",
      "recent assistant",
      "recent user",
    ]);
  });
});

describe("activated World Info context", () => {
  test("resolves identity macros using Lumiverse-style fallbacks", () => {
    expect(resolveIdentityMacros("{{user}} and {{char}}", { userName: "Alice", characterName: "Bob" })).toBe("Alice and Bob");
    expect(resolveIdentityMacros("{{ USER }} watches {{ CHAR }}", { userName: "Alice", characterName: "Bob" })).toBe("Alice watches Bob");
    expect(resolveIdentityMacros("{{user}} / {{char}}", {})).toBe("User / Character");
  });

  test("extracts unique activated entry ids from interceptor context", () => {
    const entries = extractActivatedWorldInfoEntries({
      activatedWorldInfo: [
        { id: "wi-1", comment: "Storm", keys: ["rain"] },
        { id: "wi-1", comment: "Duplicate" },
        { id: "  " },
        { id: "wi-2", source: "vector", score: 0.12 },
      ],
    });

    expect(entries.map((entry) => entry.id)).toEqual(["wi-1", "wi-2"]);
    expect(entries[0].comment).toBe("Storm");
  });

  test("fetches activated entry content for controller-only context", async () => {
    const result = await resolveWorldInfoContextMessages({
      messages: [],
      settings: normalizeSettings({ includeWorldInfoEntries: true }),
      context: { activatedWorldInfo: [{ id: "wi-1", comment: "Storm front" }] },
      canFetchWorldBooks: true,
      fetchEntry: async (entryId) => ({
        id: entryId,
        content: "The storm is listening through {{user}}'s glass.",
        comment: "Storm front",
        role: "system",
      }),
      identity: { userName: "Alice", characterName: "Bob" },
    });

    expect(result.messages).toHaveLength(1);
    expect(result.messages[0].content).toBe("The storm is listening through Alice's glass.");
    expect(result.messages[0].__lumiWorldContextLabel).toBe("World Info: Storm front");
    expect(result.diagnostics).toEqual({
      activatedEntryCount: 1,
      fetchedEntryCount: 1,
      fallbackTaggedEntryCount: 0,
      fetchError: null,
    });
  });

  test("falls back to tagged prompt entries when World Books fetching is unavailable", async () => {
    const result = await resolveWorldInfoContextMessages({
      messages: [
        { role: "system", content: "Tagged lore for {{user}}", __isWorldInfoEntry: true },
        { role: "user", content: "Chat turn", __isChatHistory: true },
      ],
      settings: normalizeSettings({ includeWorldInfoEntries: true }),
      context: { activatedWorldInfo: [{ id: "wi-1", comment: "Tagged" }] },
      canFetchWorldBooks: false,
      identity: { userName: "Alice" },
    });

    expect(result.messages.map((message) => message.content)).toEqual(["Tagged lore for Alice"]);
    expect(result.diagnostics).toEqual({
      activatedEntryCount: 1,
      fetchedEntryCount: 0,
      fallbackTaggedEntryCount: 1,
      fetchError: null,
    });
  });

  test("dedupes activated entries, skips empty content, and records fetch errors", async () => {
    const result = await resolveWorldInfoContextMessages({
      messages: [{ role: "system", content: "Fallback lore", __isWorldInfoEntry: true }],
      settings: normalizeSettings({ includeWorldInfoEntries: true }),
      context: {},
      canFetchWorldBooks: true,
      fetchActivated: async () => [{ id: "wi-1" }, { id: "wi-1" }, { id: "wi-2" }, { id: "wi-3" }],
      fetchEntry: async (entryId) => {
        if (entryId === "wi-1") return { id: entryId, content: "Same lore", comment: "One" };
        if (entryId === "wi-2") return { id: entryId, content: "   ", comment: "Empty" };
        throw new Error("entry lookup failed");
      },
    });

    expect(result.messages.map((message) => message.content)).toEqual(["Same lore"]);
    expect(result.diagnostics.activatedEntryCount).toBe(3);
    expect(result.diagnostics.fetchedEntryCount).toBe(1);
    expect(result.diagnostics.fallbackTaggedEntryCount).toBe(0);
    expect(result.diagnostics.fetchError).toBe("entry lookup failed");
  });
});

describe("World Agent state and parsing", () => {
  test("normalizes per-chat state and trims history", () => {
    const state = normalizeWorldAgentState(
      {
        day: -1,
        hour: 99,
        running: true,
        schedule: [
          { hour: 23, activity: "Watch the station", location: "Platform" },
          { hour: 23, activity: "Watch the station", location: "Platform" },
          { hour: "7:00", note: "Check the signal" },
        ],
        history: Array.from({ length: 30 }, (_, index) => ({
          id: `h-${index}`,
          timestamp: index + 1,
          day: 1,
          hour: index,
          action: "tick",
          preview: "x",
        })),
      },
      "chat-1",
    );

    expect(state.chatId).toBe("chat-1");
    expect(state.day).toBe(1);
    expect(state.hour).toBe(23);
    expect(state.schedule).toHaveLength(24);
    expect(state.schedule.map((item) => item.hour)).toEqual(Array.from({ length: 24 }, (_, hour) => hour));
    expect(state.schedule[0].activity).toBe("Watch the station");
    expect(state.schedule[7].activity).toBe("Check the signal");
    expect(state.history).toHaveLength(24);
    expect(state.history[0].timestamp).toBe(30);
  });

  test("advances one simulated hour and clears schedule on day rollover", () => {
    const state = normalizeWorldAgentState({ day: 2, hour: 23, scheduleDay: 2, schedule: [{ hour: 23, activity: "Sleep" }] }, "chat-1");
    const next = advanceWorldAgentHour(state, 1000);

    expect(formatWorldAgentClock(next.day, next.hour)).toBe("Day 3, 00:00");
    expect(next.lastTickAt).toBe(1000);
    expect(next.scheduleDay).toBeNull();
    expect(next.schedule).toEqual([]);
  });

  test("checks due hours without catch-up behavior", () => {
    const settings = normalizeSettings({
      worldAgent: { enabled: true, hourDurationMs: 1000, autoTickVisibleOnly: true },
    }).worldAgent;
    const state = normalizeWorldAgentState({ running: true, lastTickAt: 1000 }, "chat-1");

    expect(isWorldAgentHourDue(state, settings, 1500, true).due).toBe(false);
    expect(isWorldAgentHourDue(state, settings, 2500, true).due).toBe(true);
    expect(isWorldAgentHourDue(state, settings, 2500, false)).toMatchObject({
      due: false,
      shouldResetLastTick: true,
      reason: "hidden",
    });
    expect(isWorldAgentHourDue(normalizeWorldAgentState({ running: true, lastTickAt: null }, "chat-1"), settings, 2500, true)).toMatchObject({
      due: false,
      shouldResetLastTick: true,
      reason: "initialized",
    });
  });

  test("parses schedule and update JSON with plain-text fallbacks", () => {
    const oneSlotSchedule = parseWorldAgentSchedule('{"schedule":[{"hour":9,"location":"Cafe","activity":"Write notes"}]}');
    expect(oneSlotSchedule).toHaveLength(24);
    expect(oneSlotSchedule[0]).toEqual({ hour: 0, location: "Cafe", activity: "Write notes" });
    expect(oneSlotSchedule[9]).toEqual({ hour: 9, location: "Cafe", activity: "Write notes" });
    const messySchedule = [
      "```json",
      "{\"schedule\": {\"hour\": 0, \"location\": \"Residential Quarters\", \"activity\": \"Sleeping\", \"mood\": \"Peaceful\", \"goal\": \"Rest and recover\"},",
      "{\"hour\": 7, \"location\": \"Kitchen\", \"activity\": \"Breakfast\", \"mood\": \"Affectionate\", \"goal\": \"Spend time\"},",
      "{\"hour\": 9, \"location\": \"Training Facility\", \"activity\": \"Combat training\", \"mood\": \"Focused\", \"goal\": \"Improve\"}}",
      "```",
    ].join("\n");
    const parsedMessy = parseWorldAgentSchedule(messySchedule);
    expect(parsedMessy).toHaveLength(24);
    expect(parsedMessy[0]).toEqual({ hour: 0, location: "Residential Quarters", activity: "Sleeping" });
    expect(parsedMessy[7]).toEqual({ hour: 7, location: "Kitchen", activity: "Breakfast" });
    expect(parsedMessy[8]).toEqual({ hour: 8, location: "Kitchen", activity: "Breakfast" });
    expect(parsedMessy[9]).toEqual({ hour: 9, location: "Training Facility", activity: "Combat training" });
    expect(normalizeWorldAgentState({ schedule: [{ hour: 0, activity: messySchedule }] }, "chat-1").schedule).toHaveLength(24);
    const fallbackSchedule = parseWorldAgentSchedule("A loose private day plan.");
    expect(fallbackSchedule).toHaveLength(24);
    expect(fallbackSchedule[0].activity).toBe("A loose private day plan.");
    expect(fallbackSchedule[23].activity).toBe("A loose private day plan.");
    expect(formatWorldAgentHourLabel(0)).toBe("12:00am");
    expect(formatWorldAgentHourLabel(13)).toBe("1:00pm");
    expect(formatWorldAgentHourLabel(22)).toBe("10:00pm");
    expect(parseWorldAgentUpdate('{"location":"Library","mood":"focused","activity":"reading","thought":"The key is missing","goal":"find it"}')).toEqual({
      location: "Library",
      mood: "focused",
      activity: "reading",
      thought: "The key is missing",
      goal: "find it",
    });
    expect(parseWorldAgentUpdate("She keeps watching the north window.")).toEqual({
      thought: "She keeps watching the north window.",
    });
  });

  test("formats private World Agent injection without raw logs", () => {
    const state = makeDefaultWorldAgentState("chat-1");
    const injected = buildWorldAgentStateInjection({
      ...state,
      day: 4,
      hour: 14,
      location: "Archive",
      mood: "wary",
      activity: "cataloging broken seals",
      thought: "Someone moved the brass case.",
      goal: "confirm who entered after midnight",
      schedule: [{ hour: 14, location: "Archive", activity: "cataloging broken seals" }],
      history: [{ id: "hidden", timestamp: 1, day: 4, hour: 14, action: "update", preview: "private raw output" }],
    });

    expect(injected).toContain("[LumiWorld World Agent]");
    expect(injected).toContain("Day 4, 14:00");
    expect(injected).toContain("Archive");
    expect(injected).not.toContain("private raw output");
  });
});

describe("controller prompt and directive parsing", () => {
  test("renders controller templates", () => {
    const messages = buildControllerMessages(
      normalizeSettings({
        systemTemplate: "System sees {{generationType}} for {{user}}",
        userTemplate: "Prompt={{prompt}} Chat={{chatId}} Max={{maxDirectiveChars}} Char={{char}}",
      }),
      { prompt: "hello", truncated: false, originalChars: 5, includedChars: 5, messageCount: 1 },
      { generationType: "swipe", chatId: "chat-1", connectionId: "conn-1", timestamp: "now", user: "Alice", char: "Bob" },
    );

    expect(messages[0].content).toBe("System sees swipe for Alice");
    expect(messages[1].content).toContain("Prompt=hello");
    expect(messages[1].content).toContain("Chat=chat-1");
    expect(messages[1].content).toContain("Char=Bob");
  });

  test("adds controller-only additional notes when templates do not place them", () => {
    const messages = buildControllerMessages(
      normalizeSettings({ additionalNotes: "{{user}} knows the tower bell is already cracked." }),
      { prompt: "hello", truncated: false, originalChars: 5, includedChars: 5, messageCount: 1 },
      { generationType: "normal", chatId: "chat-1", connectionId: "conn-1", timestamp: "now", user: "Alice" },
    );

    expect(messages).toHaveLength(3);
    expect(messages[1].role).toBe("system");
    expect(messages[1].content).toContain("Alice knows the tower bell is already cracked.");
  });

  test("always sends additional notes as a controller-only system message", () => {
    const messages = buildControllerMessages(
      normalizeSettings({
        additionalNotes: "Only the steward knows.",
        userTemplate: "Notes={{additionalNotes}} Prompt={{prompt}}",
      }),
      { prompt: "hello", truncated: false, originalChars: 5, includedChars: 5, messageCount: 1 },
      { generationType: "normal", chatId: "chat-1", connectionId: "conn-1", timestamp: "now" },
    );

    expect(messages).toHaveLength(3);
    expect(messages[1].role).toBe("system");
    expect(messages[1].content).toContain("Only the steward knows.");
    expect(messages[2].content).toContain("Notes=");
    expect(messages[2].content).not.toContain("Only the steward knows.");
  });

  test("parses json, fenced json, and plain text directives", () => {
    expect(parseControllerDirective('{"director_note":"The lights fail."}')).toBe("The lights fail.");
    expect(parseControllerDirective("```json\n{\"directive\":\"Fog rolls in.\"}\n```")).toBe("Fog rolls in.");
    expect(parseControllerDirective("Let the floorboards creak once.")).toBe("Let the floorboards creak once.");
  });

  test("extracts controller text from common provider response shapes", () => {
    expect(extractControllerResponseText({ content: "Use the rain." })).toBe("Use the rain.");
    expect(extractControllerResponseText({ choices: [{ message: { content: "{\"directive\":\"Lights flicker.\"}" } }] })).toBe(
      "{\"directive\":\"Lights flicker.\"}",
    );
    expect(extractControllerResponseText({ output: [{ content: [{ type: "output_text", text: "A hinge snaps." }] }] })).toBe(
      "A hinge snaps.",
    );
    expect(parseControllerDirectiveFromResponse({ choices: [{ message: { content: "{\"director_note\":\"Keep watch.\"}" } }] })).toBe(
      "Keep watch.",
    );
  });

  test("describes reasoning-only controller responses without model-specific advice", () => {
    const message = describeEmptyControllerResponse({
      choices: [{ message: { content: "", reasoning_content: "analysis only" }, finish_reason: "stop" }],
      usage: { completion_tokens_details: { reasoning_tokens: 820 } },
    });

    expect(message).toContain("reasoning-only output");
    expect(message).toContain("820 reasoning tokens");
    expect(message).not.toContain("/no_think");
    expect(message).not.toContain("model-specific");
  });

  test("describes reasoning-only World Agent responses without model-specific advice", () => {
    const message = describeEmptyWorldAgentResponse({
      choices: [{ message: { content: "", reasoning_content: "analysis only" }, finish_reason: "stop" }],
      usage: { completion_tokens_details: { reasoning_tokens: 820 } },
    });

    expect(message).toContain("World Agent returned reasoning-only output");
    expect(message).toContain("820 reasoning tokens");
    expect(message).toContain("final response content");
    expect(message).not.toContain("/no_think");
    expect(message).not.toContain("model-specific");
  });

  test("builds private injected directive block", () => {
    const injected = buildInjectedDirective("The lock clicks from the other side.");
    expect(injected).toContain("[LumiWorld Director]");
    expect(injected).toContain("Do not mention LumiWorld");
    expect(injected).toContain("The lock clicks");
  });
});

describe("run log retention", () => {
  test("prepends and trims run logs", () => {
    const oldRun: RunLogEntry = {
      id: "old",
      timestamp: 1,
      status: "success",
    };
    const nextRun: RunLogEntry = {
      id: "next",
      timestamp: 2,
      status: "error",
    };

    expect(appendRunLog([oldRun], nextRun, 1)).toEqual([nextRun]);
    expect(appendRunLog([oldRun], nextRun, 0)).toEqual([]);
  });

  test("retains only privacy-safe World Info diagnostics", () => {
    const runs = normalizeRunLog([
      {
        id: "run-1",
        timestamp: 10,
        status: "success",
        directivePreview: "A private directive preview.",
        worldInfoActivatedCount: 4,
        worldInfoFetchedCount: 3,
        worldInfoFallbackTaggedCount: 1,
        worldInfoFetchError: "one entry was missing",
        worldInfoContent: "must not survive normalization",
      },
    ]);

    expect(runs[0]).toMatchObject({
      worldInfoActivatedCount: 4,
      worldInfoFetchedCount: 3,
      worldInfoFallbackTaggedCount: 1,
      worldInfoFetchError: "one entry was missing",
    });
    expect("worldInfoContent" in (runs[0] as unknown as Record<string, unknown>)).toBe(false);
  });
});
