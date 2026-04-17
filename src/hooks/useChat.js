import { useState, useCallback, useRef } from "react";
import { chat } from "../lib/api-client.js";

/**
 * useChat — manages chat state, session persistence, and message sending.
 *
 * @param {object} [context] — optional page context {asset_id, country_iso, mode}
 * @returns {{ messages, sending, error, sendMessage, clearChat }}
 */
export function useChat(context = null) {
  const [messages, setMessages] = useState([]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  const sessionTokenRef = useRef(null);

  const sendMessage = useCallback(async (text) => {
    if (!text?.trim() || sending) return;

    const userMessage = {
      id: Date.now(),
      role: "user",
      content: text.trim(),
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setSending(true);
    setError(null);

    try {
      const res = await chat(text.trim(), sessionTokenRef.current, context);

      // Store session token for multi-turn
      if (res.session_token) {
        sessionTokenRef.current = res.session_token;
      }

      const assistantMessage = {
        id: Date.now() + 1,
        role: "assistant",
        content: res.answer,
        citations: res.citations || [],
        confidence: res.confidence,
        follow_ups: res.follow_ups || [],
        metadata: res.metadata || {},
        timestamp: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err) {
      setError(err.message || "Failed to get response");

      // Add error message to chat
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 1,
          role: "assistant",
          content: "Sorry, I encountered an error. Please try again.",
          citations: [],
          isError: true,
          timestamp: new Date().toISOString(),
        },
      ]);
    } finally {
      setSending(false);
    }
  }, [sending, context]);

  const clearChat = useCallback(() => {
    setMessages([]);
    setError(null);
    sessionTokenRef.current = null;
  }, []);

  return { messages, sending, error, sendMessage, clearChat };
}
