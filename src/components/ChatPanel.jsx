import { useState, useRef, useEffect } from "react";
import { useChat } from "../hooks/useChat.js";
import CitationBadge from "./CitationBadge.jsx";

/**
 * ChatPanel — collapsible side panel with message bubbles and citation badges.
 */
export default function ChatPanel({ context }) {
  const { messages, sending, error, sendMessage, clearChat } = useChat(context);
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Focus input when panel opens
  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!input.trim()) return;
    sendMessage(input);
    setInput("");
  };

  const handleFollowUp = (question) => {
    setInput(question);
    sendMessage(question);
  };

  return (
    <>
      {/* Toggle button */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-6 right-6 w-14 h-14 bg-indigo-600 text-white rounded-full
                     shadow-lg hover:bg-indigo-700 transition-all flex items-center justify-center
                     cursor-pointer z-50"
          title="Open chat"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
        </button>
      )}

      {/* Panel */}
      {open && (
        <div className="fixed bottom-0 right-0 w-full sm:w-96 h-[70vh] sm:h-[600px] sm:bottom-6 sm:right-6
                        bg-white border border-gray-200 rounded-t-xl sm:rounded-xl shadow-2xl
                        flex flex-col z-50">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-gray-50 rounded-t-xl">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-500 rounded-full" />
              <h3 className="text-sm font-semibold text-gray-900">HTA Assistant</h3>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={clearChat}
                className="p-1.5 text-gray-400 hover:text-gray-600 transition-colors cursor-pointer"
                title="Clear chat"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
              <button
                onClick={() => setOpen(false)}
                className="p-1.5 text-gray-400 hover:text-gray-600 transition-colors cursor-pointer"
                title="Close"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
            {messages.length === 0 && (
              <div className="text-center py-8">
                <p className="text-sm text-gray-500 mb-3">
                  Ask about sponsors, trials, or market access pathways.
                </p>
                <div className="space-y-2">
                  {[
                    "What's the HTA pathway in Germany?",
                    "Show me Pfizer's oncology trials",
                    "Compare UK and France market access",
                  ].map((q) => (
                    <button
                      key={q}
                      onClick={() => handleFollowUp(q)}
                      className="block w-full text-left text-xs px-3 py-2 bg-gray-50 rounded-lg
                                 text-gray-600 hover:bg-indigo-50 hover:text-indigo-700
                                 transition-colors cursor-pointer"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((msg) => (
              <div key={msg.id} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                    msg.role === "user"
                      ? "bg-indigo-600 text-white"
                      : msg.isError
                        ? "bg-red-50 text-red-700 border border-red-200"
                        : "bg-gray-100 text-gray-900"
                  }`}
                >
                  {/* Message content */}
                  <div className="whitespace-pre-wrap break-words">{msg.content}</div>

                  {/* Citations */}
                  {msg.citations?.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {msg.citations.map((c, i) => (
                        <CitationBadge key={i} citation={c} index={i} />
                      ))}
                    </div>
                  )}

                  {/* Confidence indicator */}
                  {msg.role === "assistant" && msg.confidence && !msg.isError && (
                    <div className="mt-1.5 flex items-center gap-1">
                      <div className={`w-1.5 h-1.5 rounded-full ${
                        msg.confidence === "high" ? "bg-green-500" :
                        msg.confidence === "medium" ? "bg-yellow-500" : "bg-red-500"
                      }`} />
                      <span className="text-xs text-gray-400">{msg.confidence} confidence</span>
                    </div>
                  )}

                  {/* Follow-up suggestions */}
                  {msg.follow_ups?.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {msg.follow_ups.map((q, i) => (
                        <button
                          key={i}
                          onClick={() => handleFollowUp(q)}
                          className="block w-full text-left text-xs px-2 py-1 bg-white rounded
                                     text-gray-600 hover:bg-indigo-50 hover:text-indigo-700
                                     transition-colors cursor-pointer border border-gray-200"
                        >
                          {q}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}

            {/* Sending indicator */}
            {sending && (
              <div className="flex justify-start">
                <div className="bg-gray-100 rounded-lg px-3 py-2 text-sm text-gray-500">
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                    Thinking...
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <form onSubmit={handleSubmit} className="px-4 py-3 border-t border-gray-200 bg-gray-50 rounded-b-xl">
            {error && (
              <p className="text-xs text-red-500 mb-2">{error}</p>
            )}
            <div className="flex items-center gap-2">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask about HTA, trials, pathways..."
                disabled={sending}
                className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg
                           focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent
                           disabled:opacity-50 disabled:cursor-not-allowed bg-white"
              />
              <button
                type="submit"
                disabled={sending || !input.trim()}
                className="px-3 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium
                           hover:bg-indigo-700 transition-colors disabled:opacity-50
                           disabled:cursor-not-allowed cursor-pointer"
              >
                Send
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
