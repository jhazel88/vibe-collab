// NICE syndication API — Technology Appraisal (TA) guidance fetcher.
//
// Usage:
//   cp .env.example .env && echo "NICE_API_KEY=xxx" > .env
//   npm install
//   npm run probe          # negotiate endpoint/Accept, dump first response
//   npm run fetch:small    # first page of TA feed → ta-decisions.json
//   npm run fetch          # all pages
//
// The NICE syndication API is Atom-style XML. We negotiate across a few
// plausible endpoint paths and Accept types because NICE has rearranged
// its syndication routes a couple of times and the published docs lag.
// On your first real run, do --probe and inspect probe-response.txt to
// confirm you're hitting the right feed.
//
// Output: `ta-decisions.json` (simplified records) + `fetch.log.json`
//         (run metadata).  Raw XML dumps are gitignored.
//
// No translation. No PDF download. Recommendation classification is a
// keyword heuristic — treat it as best-effort until the PDF Beschluss-
// equivalent is parsed.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { XMLParser } from "fast-xml-parser";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ── Config ────────────────────────────────────────────────────────────────

const CONFIG = {
  // NICE has published syndication under a few paths over the years. Probe
  // each and use the first one that returns a well-formed feed.
  endpointCandidates: [
    "https://api.nice.org.uk/services/TA",
    "https://api.nice.org.uk/services/Guidance/TA",
    "https://api.nice.org.uk/syndication/ta",
  ],
  // Accept types in preference order. XML first — the syndication API is
  // Atom-native; JSON is sometimes available via a `.json` transform but
  // its schema has drifted.
  acceptCandidates: [
    "application/atom+xml",
    "application/xml",
    "text/xml",
    "application/json",
  ],
  throttleMs: 800,
  userAgent:
    "vibe-collab/nice-explore (+https://github.com/jhazel88/vibe-collab; contact: kasperblom@gmail.com)",
  acceptLanguage: "en-GB,en;q=0.9",
  outputJson: path.join(__dirname, "ta-decisions.json"),
  logJson: path.join(__dirname, "fetch.log.json"),
  probeDump: path.join(__dirname, "probe-response.txt"),
  rawDumpPrefix: path.join(__dirname, "raw-response-"),
  // Recommendation classifier — keyword heuristic over the entry <summary>
  // and <content> text. Returns the matched stem or null.
  recommendationKeywords: [
    { stem: "recommended", patterns: [/\bis recommended\b/i, /\brecommends?\b/i, /\bshould be made available\b/i] },
    { stem: "optimised", patterns: [/\boptimised\b/i, /\boptimized\b/i, /\brestricted use\b/i, /\bonly recommended\b/i] },
    { stem: "not_recommended", patterns: [/\bnot recommended\b/i, /\bdoes not recommend\b/i, /\bcannot be recommended\b/i] },
    { stem: "only_in_research", patterns: [/\bonly in research\b/i, /\bonly in the context of research\b/i] },
    { stem: "terminated", patterns: [/\bterminated\b/i, /\bwithdrew\b/i, /\bnon-submission\b/i] },
  ],
};

// ── Minimal dotenv loader ─────────────────────────────────────────────────

function loadDotenv(file = path.join(__dirname, ".env")) {
  if (!fs.existsSync(file)) return {};
  const env = {};
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
    if (!m) continue;
    let [, key, val] = m;
    // Strip surrounding quotes if present
    val = val.replace(/^["']|["']$/g, "");
    env[key] = val;
    if (process.env[key] === undefined) process.env[key] = val;
  }
  return env;
}

// ── CLI ───────────────────────────────────────────────────────────────────

function parseArgs(argv) {
  const args = { probe: false, maxPages: Infinity };
  for (const a of argv.slice(2)) {
    if (a === "--probe") args.probe = true;
    else if (a.startsWith("--max-pages=")) args.maxPages = Number(a.split("=")[1]) || 1;
  }
  return args;
}

// ── HTTP ──────────────────────────────────────────────────────────────────

async function fetchWithKey(url, apiKey, accept) {
  const res = await fetch(url, {
    headers: {
      "API-Key": apiKey,
      Accept: accept,
      "User-Agent": CONFIG.userAgent,
      "Accept-Language": CONFIG.acceptLanguage,
    },
  });
  const body = await res.text();
  return { status: res.status, headers: Object.fromEntries(res.headers), body };
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// ── Parsing ───────────────────────────────────────────────────────────────

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  textNodeName: "#text",
  trimValues: true,
  parseTagValue: false,
});

/**
 * Detect whether a response body looks like an Atom feed, an arbitrary XML
 * document, JSON, or an error page (HTML).  Used by probe + feed parser.
 */
function detectBodyShape(body) {
  const head = body.trim().slice(0, 200).toLowerCase();
  if (head.startsWith("<?xml") || head.startsWith("<feed") || head.startsWith("<rss")) return "xml";
  if (head.startsWith("{") || head.startsWith("[")) return "json";
  if (head.startsWith("<!doctype html") || head.startsWith("<html")) return "html";
  return "unknown";
}

/**
 * Parse an Atom feed body into an array of simplified TA records.
 * Exported so the fixture test can exercise it without HTTP.
 */
export function parseFeedEntries(xmlBody) {
  const parsed = xmlParser.parse(xmlBody);
  const feed = parsed?.feed;
  if (!feed) return { entries: [], nextLink: null };
  const rawEntries = feed.entry ? (Array.isArray(feed.entry) ? feed.entry : [feed.entry]) : [];
  const entries = rawEntries.map(simplifyEntry);
  const nextLink = findAtomLink(feed.link, "next");
  return { entries, nextLink };
}

function findAtomLink(link, rel) {
  if (!link) return null;
  const arr = Array.isArray(link) ? link : [link];
  for (const l of arr) {
    if (l?.["@_rel"] === rel && l?.["@_href"]) return l["@_href"];
  }
  return null;
}

function textOf(node) {
  if (node == null) return null;
  if (typeof node === "string") return node.trim() || null;
  if (typeof node === "object") {
    if (typeof node["#text"] === "string") return node["#text"].trim() || null;
    // Nested text wrapped in CDATA or with attributes
    const values = Object.values(node).filter((v) => typeof v === "string");
    if (values.length) return values.join(" ").trim() || null;
  }
  return null;
}

function simplifyEntry(entry) {
  const id = textOf(entry.id);
  const title = textOf(entry.title);
  const updated = textOf(entry.updated);
  const published = textOf(entry.published);
  const summary = textOf(entry.summary);
  const content = textOf(entry.content);

  // URL — prefer rel="alternate" link; fall back to id if it looks like a URL
  let url = null;
  if (entry.link) {
    const links = Array.isArray(entry.link) ? entry.link : [entry.link];
    const alt = links.find((l) => !l["@_rel"] || l["@_rel"] === "alternate");
    url = alt?.["@_href"] || null;
    if (!url && links[0]) url = links[0]["@_href"] || null;
  }
  if (!url && id && /^https?:\/\//.test(id)) url = id;

  // Guidance ID — prefer NICE's TA-number if we can find it in title or id
  const taMatch = (title || "").match(/\b(TA\d{1,4})\b/i) || (id || "").match(/\b(TA\d{1,4})\b/i);
  const guidanceId = taMatch ? taMatch[1].toUpperCase() : null;

  const haystack = [title, summary, content].filter(Boolean).join(" ");
  const recommendation = classifyRecommendation(haystack);

  return {
    guidance_id: guidanceId,
    title: title,
    date_published: isoDate(published),
    date_last_modified: isoDate(updated),
    recommendation,
    recommendation_source: recommendation ? "title-summary-heuristic" : null,
    url,
    atom_id: id,
  };
}

/**
 * Normalize various date formats the NICE feed emits to ISO (YYYY-MM-DD).
 * Atom dates are usually already ISO-8601; this trims to date-only.
 */
export function isoDate(str) {
  if (!str) return null;
  const m = str.match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : null;
}

/**
 * Classify a TA decision recommendation from free-text title/summary/content.
 * Returns one of: recommended | optimised | not_recommended | only_in_research
 *                 | terminated | null
 */
export function classifyRecommendation(text) {
  if (!text) return null;
  // Order matters — "not recommended" must beat "recommended".
  const ordered = [
    "not_recommended",
    "only_in_research",
    "terminated",
    "optimised",
    "recommended",
  ];
  for (const stem of ordered) {
    const entry = CONFIG.recommendationKeywords.find((e) => e.stem === stem);
    if (!entry) continue;
    if (entry.patterns.some((p) => p.test(text))) return stem;
  }
  return null;
}

// ── Endpoint negotiation ──────────────────────────────────────────────────

async function negotiateEndpoint(apiKey) {
  const attempts = [];
  for (const endpoint of CONFIG.endpointCandidates) {
    for (const accept of CONFIG.acceptCandidates) {
      const res = await fetchWithKey(endpoint, apiKey, accept);
      const shape = detectBodyShape(res.body);
      attempts.push({ endpoint, accept, status: res.status, shape });
      const ok = res.status === 200 && (shape === "xml" || shape === "json");
      if (ok) return { endpoint, accept, body: res.body, attempts };
      await sleep(CONFIG.throttleMs);
    }
  }
  return { endpoint: null, accept: null, body: null, attempts };
}

// ── Main ──────────────────────────────────────────────────────────────────

async function runProbe(apiKey) {
  console.log("[nice-explore] probing endpoints…");
  const result = await negotiateEndpoint(apiKey);
  const dump = [
    `Probe at ${new Date().toISOString()}`,
    `Attempts:`,
    ...result.attempts.map(
      (a) => `  - ${a.status}  ${a.shape.padEnd(7)}  ${a.accept.padEnd(22)}  ${a.endpoint}`,
    ),
    "",
    `Chosen endpoint: ${result.endpoint || "NONE"}`,
    `Chosen accept:   ${result.accept || "NONE"}`,
    "",
    `--- First 8kB of response ---`,
    (result.body || "").slice(0, 8000),
  ].join("\n");
  fs.writeFileSync(CONFIG.probeDump, dump);
  console.log(`[nice-explore] wrote ${CONFIG.probeDump}`);
  if (!result.endpoint) {
    console.error(
      "[nice-explore] no endpoint responded with XML/JSON — check your API key + registration status",
    );
    process.exitCode = 2;
  }
}

async function runFetch(apiKey, maxPages) {
  console.log(`[nice-explore] started ${new Date().toISOString()}`);
  const nego = await negotiateEndpoint(apiKey);
  if (!nego.endpoint) {
    console.error("[nice-explore] endpoint negotiation failed — run --probe for details");
    process.exitCode = 2;
    return;
  }
  console.log(`[nice-explore] endpoint: ${nego.endpoint}  (accept: ${nego.accept})`);

  const all = [];
  let url = nego.endpoint;
  let pageNum = 0;
  let firstBody = nego.body;

  while (url && pageNum < maxPages) {
    pageNum++;
    const body =
      pageNum === 1 && firstBody
        ? firstBody
        : (await fetchWithKey(url, apiKey, nego.accept)).body;
    fs.writeFileSync(`${CONFIG.rawDumpPrefix}${pageNum}.xml`, body);
    const { entries, nextLink } = parseFeedEntries(body);
    console.log(`[nice-explore] page ${pageNum}: ${entries.length} entries`);
    all.push(...entries);
    url = nextLink;
    if (url) await sleep(CONFIG.throttleMs);
  }

  fs.writeFileSync(CONFIG.outputJson, JSON.stringify(all, null, 2));
  fs.writeFileSync(
    CONFIG.logJson,
    JSON.stringify(
      {
        run_at: new Date().toISOString(),
        endpoint: nego.endpoint,
        accept: nego.accept,
        pages_fetched: pageNum,
        entries: all.length,
        negotiation_attempts: nego.attempts,
      },
      null,
      2,
    ),
  );
  console.log(
    `[nice-explore] wrote ${all.length} entries across ${pageNum} page(s) → ${path.basename(CONFIG.outputJson)}`,
  );
}

async function main() {
  loadDotenv();
  const apiKey = process.env.NICE_API_KEY;
  if (!apiKey) {
    console.error(
      "[nice-explore] NICE_API_KEY not set. Copy .env.example → .env and add your key.",
    );
    process.exit(2);
  }
  const args = parseArgs(process.argv);
  if (args.probe) return runProbe(apiKey);
  return runFetch(apiKey, args.maxPages);
}

// Direct-execution guard — so importing from tests doesn't fire a live request.
const invokedDirectly =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (invokedDirectly) {
  main().catch((err) => {
    console.error("[nice-explore] fatal:", err);
    process.exit(1);
  });
}
