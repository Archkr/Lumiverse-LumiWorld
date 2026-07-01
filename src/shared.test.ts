import { describe, expect, test } from "bun:test";
import {
  DEFAULT_SETTINGS,
  appendRunLog,
  buildControllerMessages,
  buildInjectedDirective,
  extractControllerResponseText,
  formatPromptForController,
  normalizeSettings,
  parseControllerDirective,
  parseControllerDirectiveFromResponse,
  resolveControllerTarget,
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
      modelOverride: "  qwen-agentworld ",
      temperature: 9,
      maxTokens: 2,
      timeoutMs: 999999,
      maxInputChars: 20,
      generationTypes: ["normal", "quiet", "swipe", "normal"],
      systemTemplate: "",
      userTemplate: "",
      runLogLimit: 999,
    });

    expect(settings.enabled).toBe(true);
    expect(settings.connectionId).toBe("conn-1");
    expect(settings.modelOverride).toBe("qwen-agentworld");
    expect(settings.temperature).toBe(2);
    expect(settings.maxTokens).toBe(64);
    expect(settings.timeoutMs).toBe(55000);
    expect(settings.maxInputChars).toBe(4000);
    expect(settings.generationTypes).toEqual(["normal", "swipe"]);
    expect(settings.systemTemplate).toBe(DEFAULT_SETTINGS.systemTemplate);
    expect(settings.userTemplate).toBe(DEFAULT_SETTINGS.userTemplate);
    expect(settings.runLogLimit).toBe(50);
  });

  test("does not cap controller max tokens at legacy 4096", () => {
    expect(normalizeSettings({ maxTokens: 32768 }).maxTokens).toBe(32768);
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
      name: "Qwen",
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

  test("builds private injected directive block", () => {
    const injected = buildInjectedDirective("The lock clicks from the other side.");
    expect(injected).toContain("[AgentWorld Director]");
    expect(injected).toContain("Do not mention AgentWorld");
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
