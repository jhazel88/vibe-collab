// ═══════════════════════════════════════════════════════════════════════════
// LLM Gateway — Vendor-neutral interface with policy controls
// Supports Anthropic Claude and OpenAI with task-model mapping,
// rate limiting, retries, and audit logging.
//
// Donor: EU Digital Strategy Tracker api/lib/llm-gateway.js
// Changes: task map updated for HTA domain, removed EHDS-specific tasks
// ═══════════════════════════════════════════════════════════════════════════

// ── Configuration ──────────────────────────────────────────────────────────

const PROVIDERS = {
  anthropic: {
    name: "Anthropic",
    models: {
      fast:   "claude-haiku-3-5-20241022",
      strong: "claude-sonnet-4-20250514",
      deep:   "claude-sonnet-4-20250514",
    },
    maxTokens: { fast: 1024, strong: 2048, deep: 4096 },
  },
  openai: {
    name: "OpenAI",
    models: {
      fast:   "gpt-4o-mini",
      strong: "gpt-4o",
      deep:   "gpt-4o",
    },
    maxTokens: { fast: 1024, strong: 2048, deep: 4096 },
  },
};

// Task → model tier mapping for HTA market access domain
const TASK_MODEL_MAP = {
  // Classification & routing
  intent_classification: "fast",
  entity_extraction:     "fast",

  // Core chat & retrieval
  copilot_chat:          "strong",
  citation_matching:     "strong",
  summarization:         "fast",

  // HTA-specific tasks
  trial_extraction:      "strong",
  hta_report_parsing:    "strong",
  pathway_comparison:    "strong",
  sponsor_analysis:      "strong",

  // Deep analysis
  deep_research:         "deep",
  market_access_analysis:"deep",

  // Quality
  hallucination_check:   "strong",
  verification:          "strong",
};

// ── Rate Limiter ───────────────────────────────────────────────────────────

class RateLimiter {
  constructor({ rpm = 60, tpm = 100000 } = {}) {
    this.rpm = rpm;
    this.tpm = tpm;
    this._requests = [];
    this._tokens = [];
  }

  _prune(arr, windowMs = 60000) {
    const cutoff = Date.now() - windowMs;
    while (arr.length && arr[0] < cutoff) arr.shift();
  }

  canProceed(estimatedTokens = 0) {
    this._prune(this._requests);
    this._prune(this._tokens);
    const currentRPM = this._requests.length;
    const currentTPM = this._tokens.reduce((a, b) => a + b, 0);
    return currentRPM < this.rpm && (currentTPM + estimatedTokens) < this.tpm;
  }

  record(tokens = 0) {
    this._requests.push(Date.now());
    if (tokens > 0) this._tokens.push(tokens);
  }

  async waitForSlot(estimatedTokens = 0, maxWaitMs = 30000) {
    const start = Date.now();
    while (!this.canProceed(estimatedTokens)) {
      if (Date.now() - start > maxWaitMs) {
        throw new Error("Rate limit wait timeout exceeded");
      }
      await new Promise(r => setTimeout(r, 1000));
    }
  }
}

const rateLimiters = {
  anthropic: new RateLimiter({ rpm: 50, tpm: 80000 }),
  openai:    new RateLimiter({ rpm: 60, tpm: 100000 }),
};

// ── Retry Logic ────────────────────────────────────────────────────────────

async function withRetry(fn, { maxRetries = 3, baseDelay = 1000 } = {}) {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      const isRetryable = err.status === 429 || err.status === 529 || err.status >= 500;
      if (!isRetryable || attempt === maxRetries) throw err;

      const retryAfter = err.headers?.["retry-after"];
      const delay = retryAfter
        ? parseInt(retryAfter, 10) * 1000
        : baseDelay * Math.pow(2, attempt) + Math.random() * 500;

      console.warn(`[llm-gateway] Retry ${attempt + 1}/${maxRetries} after ${Math.round(delay)}ms: ${err.message}`);
      await new Promise(r => setTimeout(r, delay));
    }
  }
}

// ── Provider Adapters ──────────────────────────────────────────────────────

async function callAnthropic({ model, system, messages, maxTokens, tools }) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not configured");

  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  const client = new Anthropic({ apiKey });

  const params = {
    model,
    max_tokens: maxTokens,
    system,
    messages,
  };

  if (tools?.length) {
    params.tools = tools.map(t => ({
      name: t.name,
      description: t.description,
      input_schema: t.schema,
    }));
  }

  const response = await client.messages.create(params);

  return {
    provider: "anthropic",
    model,
    content: response.content,
    text: response.content.find(c => c.type === "text")?.text || "",
    toolCalls: response.content.filter(c => c.type === "tool_use"),
    usage: {
      input: response.usage?.input_tokens || 0,
      output: response.usage?.output_tokens || 0,
      cached: response.usage?.cache_read_input_tokens || 0,
    },
    stopReason: response.stop_reason,
  };
}

async function callOpenAI({ model, system, messages, maxTokens, tools, responseFormat }) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY not configured");

  const { default: OpenAI } = await import("openai");
  const client = new OpenAI({ apiKey });

  const params = {
    model,
    max_tokens: maxTokens,
    messages: [
      { role: "system", content: system },
      ...messages,
    ],
  };

  if (responseFormat) params.response_format = responseFormat;

  if (tools?.length) {
    params.tools = tools.map(t => ({
      type: "function",
      function: { name: t.name, description: t.description, parameters: t.schema },
    }));
  }

  const response = await client.chat.completions.create(params);
  const choice = response.choices[0];

  return {
    provider: "openai",
    model,
    content: [{ type: "text", text: choice.message.content || "" }],
    text: choice.message.content || "",
    toolCalls: (choice.message.tool_calls || []).map(tc => ({
      type: "tool_use",
      name: tc.function.name,
      input: JSON.parse(tc.function.arguments),
    })),
    usage: {
      input: response.usage?.prompt_tokens || 0,
      output: response.usage?.completion_tokens || 0,
      cached: response.usage?.prompt_tokens_details?.cached_tokens || 0,
    },
    stopReason: choice.finish_reason,
  };
}

// ── Mock Adapter ───────────────────────────────────────────────────────────

async function callMock({ system, messages, tools }) {
  const lastMessage = messages[messages.length - 1]?.content || "";

  if (tools?.length) {
    return {
      provider: "mock",
      model: "mock-v1",
      content: [{ type: "tool_use", name: tools[0].name, input: {} }],
      text: "",
      toolCalls: [{ type: "tool_use", name: tools[0].name, input: {} }],
      usage: { input: 0, output: 0, cached: 0 },
      stopReason: "end_turn",
    };
  }

  return {
    provider: "mock",
    model: "mock-v1",
    content: [{ type: "text", text: `[Mock] Received: "${lastMessage.slice(0, 80)}..."` }],
    text: `[Mock] Configure ANTHROPIC_API_KEY or OPENAI_API_KEY to enable real LLM responses.`,
    toolCalls: [],
    usage: { input: 0, output: 0, cached: 0 },
    stopReason: "end_turn",
  };
}

// ── Public API ─────────────────────────────────────────────────────────────

function getActiveProvider(preferred) {
  if (preferred === "anthropic" && process.env.ANTHROPIC_API_KEY) return "anthropic";
  if (preferred === "openai" && process.env.OPENAI_API_KEY) return "openai";
  if (process.env.ANTHROPIC_API_KEY) return "anthropic";
  if (process.env.OPENAI_API_KEY) return "openai";
  return "mock";
}

export async function call(opts) {
  const {
    task = "copilot_chat",
    system = "",
    messages = [],
    tools,
    responseFormat,
    preferProvider,
    maxTokens: maxTokensOverride,
  } = opts;

  const provider = getActiveProvider(preferProvider);
  const tier = TASK_MODEL_MAP[task] || "strong";
  const config = PROVIDERS[provider] || PROVIDERS.anthropic;
  const model = config?.models?.[tier] || "mock";
  const maxTokens = maxTokensOverride || config?.maxTokens?.[tier] || 2048;

  const limiter = rateLimiters[provider];
  if (limiter) await limiter.waitForSlot(maxTokens);

  const start = Date.now();

  const result = await withRetry(async () => {
    switch (provider) {
      case "anthropic": return callAnthropic({ model, system, messages, maxTokens, tools });
      case "openai":    return callOpenAI({ model, system, messages, maxTokens, tools, responseFormat });
      default:          return callMock({ system, messages, tools });
    }
  });

  const latency_ms = Date.now() - start;

  if (limiter) limiter.record(result.usage.input + result.usage.output);

  return { ...result, task, latency_ms };
}

export function status() {
  return {
    anthropic: !!process.env.ANTHROPIC_API_KEY,
    openai: !!process.env.OPENAI_API_KEY,
    active: getActiveProvider(),
    mode: getActiveProvider() === "mock" ? "mock" : "live",
  };
}

export { PROVIDERS, TASK_MODEL_MAP };
