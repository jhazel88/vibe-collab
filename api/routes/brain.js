// ═══════════════════════════════════════════════════════════════════════════
// Brain Route — Chat with grounded HTA market access answers
//
// POST /api/brain/chat   — session-aware chat endpoint
// ═══════════════════════════════════════════════════════════════════════════

import { Router } from "express";
import crypto from "node:crypto";
import { query as dbQuery } from "../db/connection.js";
import { call as llmCall } from "../lib/llm-gateway.js";
import { classifyIntent, extractEntities } from "../services/intent-classifier.js";
import { retrieve } from "../services/retrieval.js";
import { buildResponse, buildErrorResponse } from "../services/response-contract.js";
import {
  systemPrompt,
  formatContext,
  buildUserMessage,
  suggestFollowUps,
} from "../services/prompt-templates.js";

const router = Router();

// ── Session management helpers ───────────────────────────────────────────

async function getOrCreateSession(sessionToken, context = {}) {
  if (sessionToken) {
    const existing = await dbQuery(
      `SELECT id, session_token, context FROM chat_sessions WHERE session_token = $1`,
      [sessionToken]
    );
    if (existing?.rows.length) {
      return existing.rows[0];
    }
  }

  // Create new session
  const token = sessionToken || crypto.randomUUID();
  const result = await dbQuery(
    `INSERT INTO chat_sessions (session_token, context) VALUES ($1, $2) RETURNING *`,
    [token, JSON.stringify(context)]
  );
  return result.rows[0];
}

async function getSessionHistory(sessionId, limit = 10) {
  const result = await dbQuery(
    `SELECT role, content, citations, metadata
     FROM chat_messages
     WHERE session_id = $1
     ORDER BY created_at DESC
     LIMIT $2`,
    [sessionId, limit]
  );
  // Reverse to get chronological order
  return result.rows.reverse();
}

async function persistMessage(sessionId, role, content, citations = null, metadata = null) {
  await dbQuery(
    `INSERT INTO chat_messages (session_id, role, content, citations, metadata)
     VALUES ($1, $2, $3, $4, $5)`,
    [
      sessionId,
      role,
      content,
      citations ? JSON.stringify(citations) : null,
      metadata ? JSON.stringify(metadata) : null,
    ]
  );
}

// ── Main chat handler ────────────────────────────────────────────────────

/**
 * POST /api/brain/chat
 *
 * Body:
 *   message       string   — user's question (required)
 *   session_token string   — session ID for conversation continuity (optional)
 *   context       object   — {asset_id, country_iso, mode} for scoped sessions (optional)
 */
router.post("/chat", async (req, res, next) => {
  try {
    const { message, session_token, context } = req.body;

    if (!message || typeof message !== "string" || message.trim().length < 2) {
      return res.status(400).json({ error: "Message is required (min 2 characters)" });
    }

    const userMessage = message.trim();
    const startTime = Date.now();

    // 1. Get or create session
    const session = await getOrCreateSession(session_token, context);

    // 2. Persist user message
    await persistMessage(session.id, "user", userMessage);

    // 3. Classify intent + extract entities
    const intent = classifyIntent(userMessage);
    const entities = extractEntities(userMessage);

    // 4. Retrieve context from DB via activated lanes
    const snippets = await retrieve({
      query: userMessage,
      lanes: intent.lanes,
      entities,
    });

    // 5. Build LLM messages
    const sysPrompt = systemPrompt({ intent: intent.intent, lanes: intent.lanes });
    const contextBlock = formatContext(snippets);
    const augmentedMessage = buildUserMessage(userMessage, contextBlock);

    // Include recent history for multi-turn
    const history = await getSessionHistory(session.id, 6);
    const llmMessages = [
      // Prior turns (excluding the message we just persisted)
      ...history.slice(0, -1).map((m) => ({
        role: m.role,
        content: m.content,
      })),
      // Current turn with context
      { role: "user", content: augmentedMessage },
    ];

    // 6. Call LLM
    const llmResult = await llmCall({
      task: "copilot_chat",
      system: sysPrompt,
      messages: llmMessages,
    });

    const answerText = llmResult.text;
    const latencyMs = Date.now() - startTime;

    // 7. Extract citations from snippets — only include those with real URLs
    const citations = snippets
      .filter((s) => s.source_url)
      .map((s) => ({
        source_url: s.source_url,
        source_label: s.source_label || s.title,
        excerpt: null,
      }));

    // 8. Build follow-up suggestions
    const followUps = suggestFollowUps(intent.intent, snippets);

    // 9. Build response
    const response = buildResponse({
      answer: answerText,
      citations,
      confidence: intent.confidence,
      follow_ups: followUps,
      metadata: {
        intent: intent.intent,
        lanes_used: intent.lanes,
        model_used: `${llmResult.provider}/${llmResult.model || "unknown"}`,
        latency_ms: latencyMs,
        snippet_count: snippets.length,
      },
    });

    // 10. Persist assistant message
    await persistMessage(session.id, "assistant", answerText, response.citations, response.metadata);

    // 11. Update session timestamp
    await dbQuery(
      `UPDATE chat_sessions SET updated_at = now() WHERE id = $1`,
      [session.id]
    );

    res.json({
      session_token: session.session_token,
      ...response,
    });
  } catch (err) {
    // Return a contract-compliant error if possible
    if (!res.headersSent) {
      const errResponse = buildErrorResponse(
        "I encountered an error processing your question. Please try again.",
        { error: err.message }
      );
      return res.status(500).json(errResponse);
    }
    next(err);
  }
});

export default router;
