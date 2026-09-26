import { describe, expect, test } from "bun:test";
import { DEFAULT_JEV_SETTINGS, type JevSettings } from "./shared";
import {
  buildJevRequest,
  buildJevSmokeRequest,
  buildJevState,
  callJev,
  exceedsJevTokenBudget,
  jevEndpoint,
  normalizeJevResponse,
  parseJevBody,
  readCorsResult,
} from "./jev";

const settings = (patch: Partial<JevSettings> = {}): JevSettings => ({ ...DEFAULT_JEV_SETTINGS, ...patch });

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

describe("jev request building", () => {
  test("targets the TypeSafe endpoint by default", () => {
    const request = buildJevRequest({ ...settings(), apiKey: "key-123" }, "state", {
      ping: { type: "noul", instructions: "Is this true?" },
    });
    expect(request.url).toBe("https://api.typesafe.ai/v1/systemone");
    expect(request.headers.Authorization).toBe("Bearer key-123");
    expect(request.model).toBe("jev-latest");
    const body = JSON.parse(request.body);
    expect(body.model).toBe("jev-latest");
    expect(body.state).toBe("state");
    expect(body.questions.ping.type).toBe("noul");
  });

  test("targets the OpenRouter decisions endpoint when selected", () => {
    const request = buildJevRequest(
      { ...settings({ provider: "openrouter" }), apiKey: "key-456" },
      { a: 1 },
      { ping: { type: "choice", instructions: "Pick one", criteria: { a: "A", b: "B" } } },
    );
    expect(request.url).toBe("https://openrouter.ai/api/alpha/decisions");
    expect(request.model).toBe("typesafe/jev-1.13");
  });

  test("honours a base URL override and trims trailing slashes", () => {
    expect(jevEndpoint(settings({ baseUrlOverride: "https://example.test/api/" }))).toBe("https://example.test/api/v1/systemone");
    expect(jevEndpoint(settings({ provider: "openrouter", baseUrlOverride: "https://example.test/api/" })))
      .toBe("https://example.test/api/alpha/decisions");
  });

  test("uses an explicit model over the provider default", () => {
    const request = buildJevRequest({ ...settings({ model: "jev-1.13.0" }), apiKey: "k" }, "s", {
      ping: { type: "noul", instructions: "?" },
    });
    expect(request.model).toBe("jev-1.13.0");
  });

  test("keeps every question in a single request body", () => {
    const questions = Object.fromEntries(
      Array.from({ length: 40 }, (_, index) => [`gate_${index}`, { type: "noul" as const, instructions: `Question ${index}` }]),
    );
    const request = buildJevRequest({ ...settings(), apiKey: "k" }, "s", questions);
    expect(Object.keys(JSON.parse(request.body).questions)).toHaveLength(40);
  });
});

describe("jev response normalization", () => {
  test("reads a noul answer", () => {
    const response = normalizeJevResponse({
      model: "jev-1.13.0",
      answers: { urgency: { type: "noul", noul: 0.99 } },
      usage: { input_tokens: 360, output_tokens: 39 },
    });
    expect(response.model).toBe("jev-1.13.0");
    expect(response.usage.inputTokens).toBe(360);
    expect(response.usage.outputTokens).toBe(39);
    expect(response.answers.urgency).toEqual({ type: "noul", noul: 0.99 });
  });

  test("reads a choice answer with its distribution and confidence", () => {
    const response = normalizeJevResponse({
      answers: {
        department: {
          type: "choice",
          choice: "billing",
          probabilities: { account: 0.02, technical: 0.19, billing: 0.79 },
          confidence: 0.69,
        },
      },
    });
    expect(response.answers.department).toEqual({
      type: "choice",
      choice: "billing",
      probabilities: { account: 0.02, technical: 0.19, billing: 0.79 },
      confidence: 0.69,
    });
  });

  test("reads a score answer with its legend", () => {
    const response = normalizeJevResponse({
      answers: {
        severity: {
          type: "score",
          score: 1.15,
          legend: { "0": "Cosmetic", "1": "Degraded", "2": "Blocking" },
          probabilities: { "0": 0, "1": 0.85, "2": 0.15 },
          confidence: 0.77,
        },
      },
    });
    const answer = response.answers.severity;
    expect(answer?.type).toBe("score");
    if (answer?.type === "score") {
      expect(answer.score).toBe(1.15);
      expect(answer.legend["1"]).toBe("Degraded");
      expect(answer.confidence).toBe(0.77);
    }
  });

  test("accepts the OpenRouter envelope extras", () => {
    const response = normalizeJevResponse({
      model: "typesafe/jev-1.13-20260917",
      answers: { refund: { type: "noul", noul: 0.82 } },
      usage: { input_tokens: 447, output_tokens: 69, cost: 0.000018774 },
      id: "gen-dec-1790013867",
      provider: "TypeSafe",
    });
    expect(response.usage.costUsd).toBeCloseTo(0.000018774, 9);
    expect(response.model).toBe("typesafe/jev-1.13-20260917");
  });

  test("drops a malformed answer without failing the whole response", () => {
    const response = normalizeJevResponse({
      answers: {
        good: { type: "noul", noul: 0.4 },
        missing_value: { type: "choice" },
        wrong_type: { type: "prose", text: "hello" },
        bad_number: { type: "noul", noul: "not a number" },
      },
    });
    expect(Object.keys(response.answers)).toEqual(["good"]);
  });

  test("clamps out-of-range probabilities", () => {
    const response = normalizeJevResponse({ answers: { a: { type: "noul", noul: 1.7 } } });
    expect(response.answers.a).toEqual({ type: "noul", noul: 1 });
  });

  test("rejects an empty answer set and an error envelope", () => {
    expect(() => normalizeJevResponse({ answers: {} })).toThrow(/no answers/i);
    expect(() => normalizeJevResponse({ error: "quota exceeded" })).toThrow(/quota exceeded/);
    expect(() => normalizeJevResponse("nope")).toThrow(/not a JSON object/i);
  });

  test("rejects a body that is not JSON", () => {
    expect(() => parseJevBody("")).toThrow(/empty/i);
    expect(() => parseJevBody("<html>502</html>")).toThrow(/valid JSON/i);
    expect(parseJevBody('{"answers":{"a":{"type":"noul","noul":1}}}')).toBeTruthy();
  });
});

describe("cors result narrowing", () => {
  test("accepts the documented {status, statusText, headers, body} shape", () => {
    const result = readCorsResult({ status: 429, statusText: "Too Many Requests", headers: { "retry-after": "2" }, body: "slow down" });
    expect(result.status).toBe(429);
    expect(result.headers["retry-after"]).toBe("2");
  });

  test("accepts a bare string body", () => {
    expect(readCorsResult('{"ok":true}').body).toBe('{"ok":true}');
  });

  test("rejects a missing response", () => {
    expect(() => readCorsResult(null)).toThrow(/no response/i);
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

describe("jev transport", () => {
  test("sends only cloneable options across the host proxy", async () => {
    const outcome = await callJev({
      config: { ...settings(), apiKey: "k" },
      state: "s",
      questions: { ping: { type: "noul", instructions: "?" } },
      cors: async (_url, options) => {
        const forwarded = structuredClone(options) as Record<string, unknown>;
        expect(Object.keys(forwarded).sort()).toEqual(["body", "headers", "method"]);
        return { status: 200, statusText: "OK", headers: {}, body: JSON.stringify({ answers: { ping: { type: "noul", noul: 0.9 } } }) };
      },
    });
    expect(outcome.ok).toBe(true);
  });

  test("returns a normalized response on success", async () => {
    const outcome = await callJev({
      config: { ...settings(), apiKey: "k" },
      state: "s",
      questions: { ping: { type: "noul", instructions: "?" } },
      cors: async () => ({ status: 200, statusText: "OK", headers: {}, body: JSON.stringify({ answers: { ping: { type: "noul", noul: 0.9 } } }) }),
    });
    expect(outcome.ok).toBe(true);
    expect(outcome.requests).toBe(1);
    expect(outcome.response?.answers.ping).toEqual({ type: "noul", noul: 0.9 });
  });

  test("retries once on a rate limit and honours retry-after", async () => {
    let attempts = 0;
    const outcome = await callJev({
      config: { ...settings(), apiKey: "k" },
      state: "s",
      questions: { ping: { type: "noul", instructions: "?" } },
      budgetMs: 5000,
      timeoutMs: 4000,
      cors: async () => {
        attempts += 1;
        if (attempts === 1) {
          return { status: 429, statusText: "Too Many Requests", headers: { "retry-after": "0" }, body: "slow down" };
        }
        return { status: 200, statusText: "OK", headers: {}, body: JSON.stringify({ answers: { ping: { type: "noul", noul: 0.7 } } }) };
      },
    });
    expect(attempts).toBe(2);
    expect(outcome.ok).toBe(true);
    expect(outcome.requests).toBe(2);
  });

  test("does not retry when retries are disabled", async () => {
    let attempts = 0;
    const outcome = await callJev({
      config: { ...settings({ retryOnRateLimit: false }), apiKey: "k" },
      state: "s",
      questions: { ping: { type: "noul", instructions: "?" } },
      cors: async () => {
        attempts += 1;
        return { status: 429, statusText: "Too Many Requests", headers: {}, body: "slow down" };
      },
    });
    expect(attempts).toBe(1);
    expect(outcome.ok).toBe(false);
    expect(outcome.error).toMatch(/429/);
  });

  test("reports a 401 without retrying", async () => {
    let attempts = 0;
    const outcome = await callJev({
      config: { ...settings(), apiKey: "bad" },
      state: "s",
      questions: { ping: { type: "noul", instructions: "?" } },
      cors: async () => {
        attempts += 1;
        return { status: 401, statusText: "Unauthorized", headers: {}, body: '{"error":"invalid key"}' };
      },
    });
    expect(attempts).toBe(1);
    expect(outcome.ok).toBe(false);
    expect(outcome.error).toMatch(/401/);
  });

  test("fails safely when the proxy throws", async () => {
    const outcome = await callJev({
      config: { ...settings(), apiKey: "k" },
      state: "s",
      questions: { ping: { type: "noul", instructions: "?" } },
      cors: async () => { throw new Error("network unreachable"); },
    });
    expect(outcome.ok).toBe(false);
    expect(outcome.error).toMatch(/network unreachable/);
    expect(outcome.timedOut).toBe(false);
  });

  test("times out and reports it", async () => {
    const outcome = await callJev({
      config: { ...settings(), apiKey: "k" },
      state: "s",
      questions: { ping: { type: "noul", instructions: "?" } },
      timeoutMs: 1000,
      budgetMs: 1000,
      retryOnRateLimit: false,
      cors: () => new Promise(() => {}),
    });
    expect(outcome.ok).toBe(false);
    expect(outcome.timedOut).toBe(true);
    expect(outcome.error).toMatch(/did not answer/i);
  });

  test("a malformed body is a protocol failure, not a crash", async () => {
    const outcome = await callJev({
      config: { ...settings(), apiKey: "k" },
      state: "s",
      questions: { ping: { type: "noul", instructions: "?" } },
      cors: async () => ({ status: 200, statusText: "OK", headers: {}, body: "<html>nope</html>" }),
    });
    expect(outcome.ok).toBe(false);
    expect(outcome.error).toMatch(/valid JSON/i);
  });

  test("the smoke request carries no chat content", () => {
    const smoke = buildJevSmokeRequest({ ...settings(), apiKey: "k" });
    expect(Object.keys(smoke.questions)).toEqual(["connectivity"]);
    expect(smoke.request.url).toBe("https://api.typesafe.ai/v1/systemone");
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

describe("timeout honesty", () => {
  test("returns when the deadline fires, not when the proxy finally answers", async () => {
    // The host CORS proxy uses its own 30s budget and ignores the abort signal, so
    // awaiting it directly would block for up to 30s regardless of the timeout.
    const started = Date.now();
    const outcome = await callJev({
      config: { ...settings(), apiKey: "k" },
      state: "s",
      questions: { ping: { type: "noul", instructions: "?" } },
      timeoutMs: 1000,
      budgetMs: 5000,
      retryOnRateLimit: false,
      cors: async () => {
        await new Promise((resolve) => setTimeout(resolve, 1300));
        return { status: 200, statusText: "OK", headers: {}, body: JSON.stringify({ answers: { ping: { type: "noul", noul: 0.9 } } }) };
      },
    });
    const waited = Date.now() - started;
    expect(outcome.ok).toBe(false);
    expect(outcome.timedOut).toBe(true);
    expect(outcome.response).toBeNull();
    // The caller must not wait for the slow proxy. Generous bound: the point is
    // that it is nowhere near the 1.3s response.
    expect(waited).toBeLessThan(1200);
  });

  test("a slow success after the deadline cannot arrive late", async () => {
    let resolvedLate = false;
    const outcome = await callJev({
      config: { ...settings(), apiKey: "k" },
      state: "s",
      questions: { ping: { type: "noul", instructions: "?" } },
      timeoutMs: 1000,
      budgetMs: 5000,
      retryOnRateLimit: false,
      cors: async () => {
        await new Promise((resolve) => setTimeout(resolve, 1600));
        resolvedLate = true;
        return { status: 200, statusText: "OK", headers: {}, body: JSON.stringify({ answers: { ping: { type: "noul", noul: 0.9 } } }) };
      },
    });
    expect(outcome.timedOut).toBe(true);
    // Let the abandoned request settle; it must not throw or change the outcome.
    await new Promise((resolve) => setTimeout(resolve, 800));
    expect(resolvedLate).toBe(true);
    expect(outcome.response).toBeNull();
  });
});
