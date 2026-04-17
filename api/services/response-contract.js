// ═══════════════════════════════════════════════════════════════════════════
// Response Contract
//
// Defines the canonical shape for brain/chat responses.
// Every answer must conform to this contract for consistent frontend rendering.
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Build a well-formed response object.
 *
 * @param {object} opts
 * @param {string} opts.answer       — the main answer text (markdown OK)
 * @param {Array}  opts.citations    — [{source_url, source_label, excerpt}]
 * @param {string} opts.confidence   — "high" | "medium" | "low"
 * @param {string[]} opts.follow_ups — suggested follow-up questions
 * @param {object} opts.metadata     — {intent, lanes_used, model_used, latency_ms}
 * @returns {object}
 */
export function buildResponse({
  answer,
  citations = [],
  confidence = "medium",
  follow_ups = [],
  metadata = {},
}) {
  return {
    answer: answer || "",
    citations: citations.map((c) => ({
      source_url: c.source_url || null,
      source_label: c.source_label || "Source",
      excerpt: c.excerpt || null,
    })),
    confidence,
    follow_ups: follow_ups.slice(0, 3),
    metadata: {
      intent: metadata.intent || null,
      lanes_used: metadata.lanes_used || [],
      model_used: metadata.model_used || null,
      latency_ms: metadata.latency_ms || null,
      snippet_count: metadata.snippet_count || 0,
    },
  };
}

/**
 * Build an error response that still conforms to the contract shape.
 */
export function buildErrorResponse(message, metadata = {}) {
  return buildResponse({
    answer: message || "I'm sorry, I encountered an error processing your question.",
    citations: [],
    confidence: "low",
    follow_ups: ["Could you rephrase your question?"],
    metadata,
  });
}
