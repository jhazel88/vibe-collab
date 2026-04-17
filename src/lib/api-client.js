// ═══════════════════════════════════════════════════════════════════════════
// API Client — fetch wrapper for the HTA Market Access backend
// ═══════════════════════════════════════════════════════════════════════════

const BASE_URL = "/api";

class APIError extends Error {
  constructor(status, body) {
    super(body?.error || `API error ${status}`);
    this.status = status;
    this.body = body;
  }
}

async function request(path, opts = {}) {
  const { method = "GET", body, params } = opts;

  let url = `${BASE_URL}${path}`;
  if (params) {
    const qs = new URLSearchParams(
      Object.entries(params).filter(([, v]) => v != null && v !== "")
    );
    if (qs.toString()) url += `?${qs}`;
  }

  const fetchOpts = {
    method,
    headers: { "Content-Type": "application/json" },
    credentials: "include",
  };

  if (body && method !== "GET") {
    fetchOpts.body = JSON.stringify(body);
  }

  const res = await fetch(url, fetchOpts);

  if (!res.ok) {
    const errBody = await res.json().catch(() => null);
    throw new APIError(res.status, errBody);
  }

  return res.json();
}

// ── Sponsors ─────────────────────────────────────────────────────────────

export function getSponsors(params) {
  return request("/sponsors", { params });
}

export function getSponsor(slug) {
  return request(`/sponsors/${slug}`);
}

// ── Assets ───────────────────────────────────────────────────────────────

export function getAssets(params) {
  return request("/assets", { params });
}

export function getAsset(slug) {
  return request(`/assets/${slug}`);
}

// ── Trials ───────────────────────────────────────────────────────────────

export function getTrials(params) {
  return request("/trials", { params });
}

export function getTrial(nctId) {
  return request(`/trials/${nctId}`);
}

// ── Countries ────────────────────────────────────────────────────────────

export function getCountries(params) {
  return request("/countries", { params });
}

export function getCountry(iso) {
  return request(`/countries/${iso}`);
}

// ── Search ───────────────────────────────────────────────────────────────

export function search(q, params = {}) {
  return request("/search", { params: { q, ...params } });
}

// ── Brain / Chat ─────────────────────────────────────────────────────────

export function chat(message, sessionToken = null, context = null) {
  return request("/brain/chat", {
    method: "POST",
    body: { message, session_token: sessionToken, context },
  });
}
