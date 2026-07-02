import { describe, expect, test } from "bun:test";
import {
  DEFAULT_SETTINGS,
  PREVIOUS_DEFAULT_SYSTEM_TEMPLATE,
  PREVIOUS_DEFAULT_USER_TEMPLATE,
  PRE_REBRAND_DEFAULT_SYSTEM_TEMPLATE,
  appendRunLog,
  buildControllerMessages,
  buildInjectedDirective,
  describeEmptyControllerResponse,
  extractControllerResponseText,
  formatPromptForController,
  normalizeSettings,
  parseControllerDirective,
  parseControllerDirectiveFromResponse,
  resolveControllerTarget,
  selectChatHistoryMessagesForController,
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
    });

    expect(settings.systemTemplate).toBe(DEFAULT_SETTINGS.systemTemplate);
  });

  test("does not cap controller max tokens at legacy 4096", () => {
    expect(normalizeSettings({ maxTokens: 32768 }).maxTokens).toBe(32768);
  });

  test("does not cap controller timeout at legacy 55 seconds", () => {
    expect(normalizeSettings({ timeoutMs: 600000 }).timeoutMs).toBe(600000);
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
});

describe("controller prompt and directive parsing", () => {
  test("renders controller templates", () => {
    const messages = buildControllerMessages(
      normalizeSettings({
        systemTemplate: "System sees {{generationType}}",
        userTemplate: "Prompt={{prompt}} Chat={{chatId}} Max={{maxDirectiveChars}}",
      }),
      { prompt: "hello", truncated: false, originalChars: 5, includedChars: 5, messageCount: 1 },
      { generationType: "swipe", chatId: "chat-1", connectionId: "conn-1", timestamp: "now" },
    );

    expect(messages[0].content).toBe("System sees swipe");
    expect(messages[1].content).toContain("Prompt=hello");
    expect(messages[1].content).toContain("Chat=chat-1");
  });

  test("adds controller-only additional notes when templates do not place them", () => {
    const messages = buildControllerMessages(
      normalizeSettings({ additionalNotes: "The tower bell is already cracked." }),
      { prompt: "hello", truncated: false, originalChars: 5, includedChars: 5, messageCount: 1 },
      { generationType: "normal", chatId: "chat-1", connectionId: "conn-1", timestamp: "now" },
    );

    expect(messages).toHaveLength(3);
    expect(messages[1].role).toBe("system");
    expect(messages[1].content).toContain("The tower bell is already cracked.");
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
});
