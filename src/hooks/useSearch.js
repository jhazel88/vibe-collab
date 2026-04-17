import { useState, useEffect, useRef } from "react";
import { search } from "../lib/api-client.js";

/**
 * Debounced search hook.
 *
 * @param {number} debounceMs — debounce delay in ms (default 300)
 * @returns {{ query, setQuery, results, loading, error }}
 */
export function useSearch(debounceMs = 300) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const timerRef = useRef(null);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);

    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setResults(null);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    timerRef.current = setTimeout(async () => {
      try {
        const data = await search(trimmed);
        setResults(data);
      } catch (err) {
        setError(err.message || "Search failed");
        setResults(null);
      } finally {
        setLoading(false);
      }
    }, debounceMs);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [query, debounceMs]);

  return { query, setQuery, results, loading, error };
}
