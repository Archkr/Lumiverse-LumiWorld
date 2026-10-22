import { describe, expect, spyOn, test } from "bun:test";
import type { DecisionEvaluationInput, DecisionResult } from "lumiverse-spindle-types";
import { DEFAULT_JEV_SETTINGS, type JevSettings } from "./shared";
import {
  buildJevRequest,
  buildJevSmokeRequest,
  buildJevState,
  callJev,
  exceedsJevTokenBudget,
  normalizeJevResponse,
  type JevQuestions,
} from "./jev";

const settings = (patch: Partial<JevSettings> = {}): JevSettings => ({ ...DEFAULT_JEV_SETTINGS, ...patch });
const questions: JevQuestions = { ping: { type: "noul", instructions: "Is this true?" } };
const success = (): DecisionResult => ({ model: "~typesafe/jev-served", answers: { ping: { type: "noul", noul: 0.9 } } });

const stateContext = (patch: Record<string, unknown> = {}) => ({
  settings: { historyMessageLimit: 10, maxStateChars: 30000 },
  generationType: "normal",
  chatId: "chat-1",
  history: [
    { role: "user" as const, content: "I open the door." },
    { role: "assistant" as const, content: "The hallway is dark and cold." },
  ],
  ...patch,
});

describe("native Decision request building", () => {
  test("omits connection and model to select the user's saved defaults", () => {
    const request = buildJevRequest(settings(), "state", questions);
    expect(JSON.parse(request.body)).toEqual({ state: "state", questions });
    expect(request.model).toBeNull();
    expect(Object.keys(request).sort()).toEqual(["body", "model"]);
  });

  test("preserves explicit connection and model IDs and operator user scope", () => {
    const config = settings({ connectionId: "saved-connection-ID", model: "~typesafe/jev-latest" });
    const request = buildJevRequest(config, { scene: "storm" }, questions, "user-17");
    expect(JSON.parse(request.body)).toEqual({
      state: { scene: "storm" }, questions,
      connection_id: "saved-connection-ID", model: "~typesafe/jev-latest", userId: "user-17",
    });
    expect(request.model).toBe("~typesafe/jev-latest");
  });

  test("omits a blank model override and never copies legacy credentials or URLs", () => {
    const legacy = { ...settings({ model: "  " }), apiKey: "legacy-secret", baseUrlOverride: "https://legacy.example", provider: "openrouter" };
    const request = buildJevRequest(legacy, "state", questions);
    expect(JSON.parse(request.body)).toEqual({ state: "state", questions });
    expect(JSON.stringify(request)).not.toContain("legacy-secret");
    expect(JSON.stringify(request)).not.toContain("legacy.example");
  });

  test("keeps typed questions including JSON descriptions in a single native input", () => {
    const batch: JevQuestions = {
      ...questions,
      path: { type: "choice", instructions: { task: "Choose a path" }, criteria: { a: ["Continue"], b: null } },
      urgency: { type: "score", instructions: ["Evaluate urgency"], criteria: [{ urgency: "low" }, "High"] },
    };
    const request = buildJevRequest(settings(), ["state"], batch);
    expect(JSON.parse(request.body)).toEqual({ state: ["state"], questions: batch });
  });
});

describe("native Decision response adaptation", () => {
  test("preserves native probability and confidence as separate values", () => {
    const result: DecisionResult = {
      model: "~typesafe/jev-versioned",
      answers: {
        ping: { type: "noul", noul: 0.81234 },
        path: { type: "choice", choice: "continue", probabilities: { continue: 0.79, stop: 0.21 }, confidence: 0.63 },
      },
      usage: { input_tokens: 360, output_tokens: 39, cost: 0.000018774 },
    };
    const response = normalizeJevResponse(result);
    expect(response.model).toBe("~typesafe/jev-versioned");
    expect(response.answers).toEqual(result.answers);
    expect(response.usage).toEqual({ inputTokens: 360, outputTokens: 39, costUsd: 0.000018774 });
  });

  test("preserves fractional scores and JSON Score legends", () => {
    const answer = {
      type: "score" as const,
      score: 1.15,
      legend: { "0": "Cosmetic", "1": { severity: "Degraded", effects: ["slower", null] }, "2": ["Blocking"] },
      probabilities: { "0": 0, "1": 0.85, "2": 0.15 },
      confidence: 0.77,
    };
    const response = normalizeJevResponse({ model: "served-model", answers: { severity: answer } });
    expect(response.answers.severity).toEqual(answer);
  });

  test("keeps absent and nullable native usage unknown instead of coercing it to zero", () => {
    expect(normalizeJevResponse(success()).usage).toEqual({ inputTokens: null, outputTokens: null, costUsd: null });
    expect(normalizeJevResponse({ ...success(), usage: { input_tokens: null, output_tokens: null, cost: null } }).usage)
      .toEqual({ inputTokens: null, outputTokens: null, costUsd: null });
    expect(normalizeJevResponse({ ...success(), usage: { input_tokens: 0, output_tokens: 0, cost: 0 } }).usage)
      .toEqual({ inputTokens: 0, outputTokens: 0, costUsd: 0 });
  });
});

describe("jev state projection", () => {
  test("builds a structured state with history and named fields", () => {
    const projection = buildJevState(stateContext({ characterSummary: "Ada is a courier.", directorNotes: "Keep it tense." }));
    const state = projection.state as Record<string, unknown>;
    expect(state.generation_type).toBe("normal");
    expect(state.character).toBe("Ada is a courier.");
    expect(state.director_notes).toBe("Keep it tense.");
    expect(Array.isArray(state.chat_history)).toBe(true);
    expect(projection.chars).toBeGreaterThan(0);
    expect(projection.compacted).toBe(false);
  });

  test("includes the draft directive only when supplied", () => {
    const without = buildJevState(stateContext()).state as Record<string, unknown>;
    expect("draft_directive" in without).toBe(false);
    const withDraft = buildJevState(stateContext({ draftDirective: "Make the storm worsen." })).state as Record<string, unknown>;
    expect(withDraft.draft_directive).toBe("Make the storm worsen.");
  });

  test("compacts to respect the state character cap", () => {
    const history = Array.from({ length: 24 }, (_, index) => ({
      role: "user" as const,
      content: `Message ${index} ${"x".repeat(500)}`,
    }));
    const projection = buildJevState({
      ...stateContext(),
      settings: { historyMessageLimit: 24, maxStateChars: 4000 },
      history,
      characterSummary: "y".repeat(8000),
    });
    expect(projection.compacted).toBe(true);
    expect(projection.chars).toBeLessThanOrEqual(4000);
  });

  test("never exceeds the provider token allowance for a 40-gate batch", () => {
    const projection = buildJevState(stateContext());
    const questions = Object.fromEntries(
      Array.from({ length: 40 }, (_, index) => [`gate_${index}`, { type: "noul" as const, instructions: "A question about the state above." }]),
    );
    expect(exceedsJevTokenBudget(projection.state, questions)).toBe(false);
  });
});

describe("native Decision evaluation", () => {
  test("calls the host once with exact saved IDs, operator scope, and a cancellable signal", async () => {
    const inputs: DecisionEvaluationInput[] = [];
    const outcome = await callJev({
      config: settings({ connectionId: "connection-ID", model: "~typesafe/jev-latest" }),
      state: { scene: "storm" }, questions, userId: "owner-ID",
      evaluate: async (input, options) => {
        inputs.push(input);
        expect(options?.signal).toBeInstanceOf(AbortSignal);
        expect(options?.signal?.aborted).toBe(false);
        return success();
      },
    });
    expect(inputs).toEqual([{
      connection_id: "connection-ID", model: "~typesafe/jev-latest", userId: "owner-ID",
      state: { scene: "storm" }, questions,
    }]);
    expect(outcome.ok).toBe(true);
    expect(outcome.requests).toBe(1);
    expect(outcome.response?.model).toBe("~typesafe/jev-served");
    expect(outcome.attempts).toHaveLength(1);
    expect(outcome.attempts[0]?.status).toBeNull();
    expect(JSON.parse(outcome.attempts[0]!.body!)).toEqual(success());
  });

  test("passes default selection through unchanged for a user extension", async () => {
    let received: DecisionEvaluationInput | undefined;
    const outcome = await callJev({
      config: settings(), state: "state", questions,
      evaluate: async (input) => { received = input; return success(); },
    });
    expect(outcome.ok).toBe(true);
    expect(received).toEqual({ state: "state", questions });
  });

  test("returns host errors without retries or changing a rejected explicit connection", async () => {
    let calls = 0;
    const outcome = await callJev({
      config: settings({ connectionId: "missing-ID" }), state: "state", questions,
      evaluate: async (input) => {
        calls += 1;
        expect(input.connection_id).toBe("missing-ID");
        throw new Error("Decision connection missing-ID not found.");
      },
    });
    expect(calls).toBe(1);
    expect(outcome.ok).toBe(false);
    expect(outcome.error).toBe("Decision connection missing-ID not found.");
    expect(outcome.timedOut).toBe(false);
    expect(outcome.requests).toBe(1);
    expect(outcome.attempts[0]?.error).toBe(outcome.error);
  });

  test("does not retry provider rate limits", async () => {
    let calls = 0;
    const outcome = await callJev({
      config: settings(), state: "state", questions,
      evaluate: async () => { calls += 1; throw new Error("Decision provider rate limit (429)."); },
    });
    expect(calls).toBe(1);
    expect(outcome.requests).toBe(1);
    expect(outcome.error).toContain("429");
  });

  test("aborts provider work when the configured deadline expires", async () => {
    let providerAborted = false;
    let signal: AbortSignal | undefined;
    const outcome = await callJev({
      config: settings(), state: "state", questions, timeoutMs: 15,
      evaluate: (_input, options) => new Promise((_resolve, reject) => {
        signal = options?.signal;
        signal!.addEventListener("abort", () => {
          providerAborted = true;
          reject(new Error("Provider cancelled."));
        }, { once: true });
      }),
    });
    expect(providerAborted).toBe(true);
    expect(signal?.aborted).toBe(true);
    expect(outcome.ok).toBe(false);
    expect(outcome.timedOut).toBe(true);
    expect(outcome.response).toBeNull();
    expect(outcome.error).toContain("did not answer");
  });

  test("uses the remaining phase budget even when it is below the configured timeout", async () => {
    let signal: AbortSignal | undefined;
    const startedAt = Date.now();
    const outcome = await callJev({
      config: settings({ timeoutMs: 1000 }), state: "state", questions, budgetMs: 15,
      evaluate: (_input, options) => { signal = options?.signal; return new Promise(() => {}); },
    });
    expect(outcome.timedOut).toBe(true);
    expect(signal?.aborted).toBe(true);
    expect(Date.now() - startedAt).toBeLessThan(500);
  });

  test("does not start provider work when the phase budget is exhausted", async () => {
    let calls = 0;
    const outcome = await callJev({
      config: settings(), state: "state", questions, budgetMs: 0,
      evaluate: async () => { calls += 1; return success(); },
    });
    expect(calls).toBe(0);
    expect(outcome.requests).toBe(0);
    expect(outcome.timedOut).toBe(true);
  });

  test("caps even an oversized timeout at the host's 30-second deadline", async () => {
    const timer = spyOn(globalThis, "setTimeout");
    try {
      const outcome = await callJev({
        config: settings(), state: "state", questions, timeoutMs: 90_000,
        evaluate: async () => success(),
      });
      expect(outcome.ok).toBe(true);
      expect(timer.mock.calls[0]?.[1]).toBe(30_000);
    } finally {
      timer.mockRestore();
    }
  });

  test("a late provider settlement cannot replace a timed-out result", async () => {
    let finish: ((result: DecisionResult) => void) | undefined;
    let signal: AbortSignal | undefined;
    const outcome = await callJev({
      config: settings(), state: "state", questions, timeoutMs: 10,
      evaluate: (_input, options) => {
        signal = options?.signal;
        return new Promise((resolve) => { finish = resolve; });
      },
    });
    expect(signal?.aborted).toBe(true);
    finish!(success());
    await Promise.resolve();
    expect(outcome.timedOut).toBe(true);
    expect(outcome.response).toBeNull();
  });

  test("the smoke input contains only a fixed sample and one question", () => {
    expect(buildJevSmokeRequest()).toEqual({
      state: "A storm rolls in over the harbour.",
      questions: {
        connectivity: {
          type: "noul", instructions: "Does this statement describe a storm?",
          criteria: {
            true: "The statement mentions a storm, tempest, thunder, or violent weather",
            false: "The statement mentions anything else",
          },
        },
      },
    });
  });
});

describe("state cap enforcement", () => {
  test("never exceeds the configured cap, even with large optional fields", () => {
    const huge = "y".repeat(20000);
    for (const cap of [2000, 4000, 30000]) {
      const projection = buildJevState({
        settings: { historyMessageLimit: 6, maxStateChars: cap },
        generationType: "normal",
        chatId: "c",
        history: Array.from({ length: 6 }, (_, i) => ({ role: "user" as const, content: `turn ${i} ${"h".repeat(400)}` })),
        characterSummary: huge,
        personaSummary: huge,
        worldInfoSummary: huge,
        directorNotes: huge,
      });
      expect(projection.chars).toBeLessThanOrEqual(cap);
    }
  });

  test("keeps the small required fields when trimming to the bone", () => {
    const projection = buildJevState({
      settings: { historyMessageLimit: 6, maxStateChars: 2000 },
      generationType: "regenerate",
      chatId: "c",
      history: [{ role: "user" as const, content: "h".repeat(9000) }],
      characterSummary: "c".repeat(9000),
      personaSummary: "p".repeat(9000),
      worldInfoSummary: "w".repeat(9000),
      directorNotes: "n".repeat(9000),
      draftDirective: "d".repeat(9000),
    });
    expect(projection.chars).toBeLessThanOrEqual(2000);
    expect((projection.state as Record<string, unknown>).generation_type).toBe("regenerate");
  });
});
