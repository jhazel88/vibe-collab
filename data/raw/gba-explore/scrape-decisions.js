// ═══════════════════════════════════════════════════════════════════════════
// scrape-decisions.js
//
// Scrape G-BA AMNOG benefit assessment (Nutzenbewertung) decisions.
//
// Source: https://www.g-ba.de/bewertungsverfahren/nutzenbewertung/
// Docs:   https://www.g-ba.de/themen/arzneimittel/arzneimittel-richtlinie-anlagen/nutzenbewertung-35a/
//
// No API key. Just polite HTTP requests with cheerio for HTML parsing.
//
// Two stages:
//   1. Listing scrape — drug, active substance, indication (if shown), decision date, detail URL, PDF link
//   2. Optional enrichment (--enrich) — follow each detail page to extract the
//      Zusatznutzen rating text. We do NOT download PDFs per the brief.
//
// Usage:
//   node scrape-decisions.js --probe            # save raw HTML of first page, exit
//   node scrape-decisions.js                    # full listing scrape
//   node scrape-decisions.js --max-pages=2
//   node scrape-decisions.js --enrich            # listing + detail page rating enrichment
//   node scrape-decisions.js --enrich --max-detail=50    # cap enrichment to control runtime
//
// Output (in this folder):
//   raw-listing.html           — first listing page, unmodified (gitignored)
//   gba-decisions.json         — simplified records, COMMITTED
//   scrape.log.json            — run metadata (timestamps, pages, counts, errors)
// ═══════════════════════════════════════════════════════════════════════════

import { writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import * as cheerio from "cheerio";

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── CONFIG (adjust after first --probe once we see the real DOM) ─────────

const CONFIG = {
  origin: "https://www.g-ba.de",
  listingPath: "/bewertungsverfahren/nutzenbewertung/",

  // Candidate selectors for the listing. G-BA's CMS (TYPO3) wraps lists in
  // styled <ul>/<div> constructs rather than a classic <table>. We try the
  // most common patterns in order. Update after --probe if none match.
  listingCandidates: [
    { container: "ul.teaser-list", row: "li", kind: "list" },
    { container: "ul.results-list", row: "li", kind: "list" },
    { container: "div.results", row: "div.result", kind: "divs" },
    { container: "table.listing", row: "tbody tr", kind: "table" },
    { container: "div.content-main", row: "article", kind: "articles" },
  ],

  // Candidate selectors for pagination next-link. Again, fallback chain.
  nextLinkCandidates: [
    "a.pagination-next",
    "li.pagination-next a",
    "a[rel=next]",
    'a:contains("Weiter")',
    'a:contains("Nächste")',
  ],

  // Detail-page rating extraction: G-BA Beschlüsse surface the Ausmaß des
  // Zusatznutzens in the page body. We search for canonical phrases.
  ratingKeywords: [
    { kw: "erheblicher zusatznutzen", rating: "erheblich" },
    { kw: "beträchtlicher zusatznutzen", rating: "beträchtlich" },
    { kw: "beträchtlich", rating: "beträchtlich" }, // looser fallback
    { kw: "geringer zusatznutzen", rating: "gering" },
    { kw: "nicht quantifizierbarer zusatznutzen", rating: "nicht_quantifizierbar" },
    { kw: "nicht quantifizierbar", rating: "nicht_quantifizierbar" },
    { kw: "kein zusatznutzen", rating: "kein" },
    { kw: "geringerer nutzen", rating: "geringerer" },
  ],

  throttleMs: 800, // be polite to a German government site
  userAgent: "vibe-collab/gba-explore (research; contact: kasperblom@pm.me)",
  defaultMaxPages: 20,
  defaultMaxDetailEnrich: 50,
};

// ── CLI args ──────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const PROBE = args.includes("--probe");
const ENRICH = args.includes("--enrich");
const MAX_PAGES = parseIntArg("--max-pages", CONFIG.defaultMaxPages);
const MAX_DETAIL = parseIntArg("--max-detail", CONFIG.defaultMaxDetailEnrich);

function parseIntArg(flag, fallback) {
  const raw = args.find((a) => a.startsWith(`${flag}=`));
  if (!raw) return fallback;
  const n = parseInt(raw.split("=")[1], 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

// ── Fetch helper ──────────────────────────────────────────────────────────

async function get(url) {
  const res = await fetch(url, {
    headers: {
      "User-Agent": CONFIG.userAgent,
      Accept: "text/html,application/xhtml+xml",
      "Accept-Language": "de-DE,de;q=0.9,en;q=0.5",
    },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status} for ${url}\n${body.slice(0, 500)}`);
  }
  return res.text();
}

// ── Parsing ───────────────────────────────────────────────────────────────

function absolutise(href, baseOrigin = CONFIG.origin) {
  if (!href) return null;
  if (href.startsWith("http")) return href;
  if (href.startsWith("//")) return `https:${href}`;
  if (href.startsWith("/")) return `${baseOrigin}${href}`;
  return `${baseOrigin}/${href}`;
}

/**
 * Try each candidate listing selector against the document; return the one
 * that produces ≥ 1 row. Helps us survive future DOM tweaks by G-BA.
 */
function findListingRows($) {
  for (const candidate of CONFIG.listingCandidates) {
    const $container = $(candidate.container);
    if (!$container.length) continue;
    const $rows = $container.find(candidate.row);
    if ($rows.length > 0) return { candidate, $rows };
  }
  return { candidate: null, $rows: $([]) };
}

/**
 * Extract a single row into our simplified record. G-BA rows typically show
 * drug name as the link text, active substance + decision date beside/under.
 * We pick defensively using multiple fallbacks per field.
 */
function extractRow($, el) {
  const $el = $(el);
  const $link = $el.find("a").first();
  const detailUrl = absolutise($link.attr("href"));
  const drugName = ($link.text() || $el.find("h3, h4, .title").first().text() || "")
    .replace(/\s+/g, " ")
    .trim() || null;

  // Active substance (Wirkstoff) — often in a .wirkstoff or .substance or dt/dd pair,
  // sometimes in a sibling paragraph. Try a few things.
  const wirkstoff =
    $el.find(".wirkstoff, .substance, [data-wirkstoff]").first().text().trim() ||
    extractLabelled($, $el, /wirkstoff/i) ||
    null;

  // Indication (Anwendungsgebiet) — sometimes as bullet, sometimes embedded
  // in title subtitles. Not always present on the listing.
  const indication =
    $el.find(".indication, .anwendungsgebiet").first().text().trim() ||
    extractLabelled($, $el, /anwendungsgebiet/i) ||
    null;

  // Decision date (Beschlussdatum) — ISO in data attr if lucky, else German format
  // parsed with a forgiving parser.
  const dateRaw =
    $el.find("[data-date], time[datetime]").attr("datetime") ||
    $el.find(".date, .beschluss-datum").first().text() ||
    extractLabelled($, $el, /beschluss|datum/i) ||
    null;
  const decisionDate = parseGermanDate(dateRaw);

  // PDF link — the brief says save links, don't download. G-BA usually shows a
  // direct .pdf link on the row; if not, we'll grab it from the detail page.
  const pdfUrl =
    absolutise($el.find('a[href$=".pdf"]').first().attr("href")) || null;

  return {
    drug_name: drugName,
    active_substance: wirkstoff,
    indication,
    decision_date: decisionDate,
    decision_date_raw: dateRaw ? dateRaw.replace(/\s+/g, " ").trim() : null,
    detail_url: detailUrl,
    pdf_url: pdfUrl,
    benefit_rating: null, // populated by --enrich
    benefit_rating_source: null,
  };
}

/**
 * Try to extract text for a labelled field like
 *   <dt>Wirkstoff</dt><dd>Pembrolizumab</dd>
 *   <strong>Wirkstoff:</strong> Pembrolizumab
 */
function extractLabelled($, $scope, labelRe) {
  let found = null;
  $scope.find("dt, strong, b, .label, th").each((_, node) => {
    const label = $(node).text().trim();
    if (labelRe.test(label)) {
      const $next = $(node).next("dd, td, span, .value");
      const val = ($next.text() || "").replace(/\s+/g, " ").trim();
      if (val) {
        found = val;
        return false; // break
      }
    }
  });
  return found;
}

/**
 * Parse German-format dates (DD.MM.YYYY or DD. Month YYYY) to ISO YYYY-MM-DD.
 * Returns null if it can't.
 */
function parseGermanDate(raw) {
  if (!raw) return null;
  const s = raw.replace(/\s+/g, " ").trim();

  const numeric = s.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/);
  if (numeric) {
    const [, d, m, y] = numeric;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }

  const months = {
    januar: "01", februar: "02", märz: "03", maerz: "03", april: "04",
    mai: "05", juni: "06", juli: "07", august: "08", september: "09",
    oktober: "10", november: "11", dezember: "12",
  };
  const named = s.match(/(\d{1,2})\.?\s+([A-Za-zäöüß]+)\s+(\d{4})/);
  if (named) {
    const [, d, monthName, y] = named;
    const m = months[monthName.toLowerCase()];
    if (m) return `${y}-${m}-${d.padStart(2, "0")}`;
  }

  // ISO already? (e.g. from datetime attribute)
  const iso = s.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;

  return null;
}

/**
 * Classify rating text found on a detail page against the known scale.
 */
function classifyRating(text) {
  if (!text) return null;
  const t = text.toLowerCase();
  for (const { kw, rating } of CONFIG.ratingKeywords) {
    if (t.includes(kw)) return rating;
  }
  return null;
}

/**
 * Follow a next-link if present.
 */
function findNextLink($, currentUrl) {
  for (const sel of CONFIG.nextLinkCandidates) {
    const href = $(sel).first().attr("href");
    if (href) {
      // Resolve relative to current URL in case pagination uses ./? syntax
      return new URL(href, currentUrl).toString();
    }
  }
  return null;
}

// ── Output helpers ────────────────────────────────────────────────────────

async function writeJson(name, data) {
  const path = resolve(__dirname, name);
  await writeFile(path, JSON.stringify(data, null, 2) + "\n", "utf8");
  return path;
}

async function writeText(name, text) {
  const path = resolve(__dirname, name);
  await writeFile(path, text, "utf8");
  return path;
}

// ── Main ──────────────────────────────────────────────────────────────────

async function main() {
  const startedAt = new Date().toISOString();
  console.log(`[gba-explore] started ${startedAt}`);

  const firstUrl = `${CONFIG.origin}${CONFIG.listingPath}`;
  const firstHtml = await get(firstUrl);
  await writeText("raw-listing.html", firstHtml);

  if (PROBE) {
    console.log("[gba-explore] --probe set, writing probe-response.txt and exiting");
    const preview = firstHtml.slice(0, 8000);
    await writeText(
      "probe-response.txt",
      `URL: ${firstUrl}\n\n--- first 8000 chars ---\n${preview}\n`,
    );
    console.log(
      "Inspect raw-listing.html and probe-response.txt. " +
        "If CONFIG.listingCandidates don't match the real DOM, update them and rerun without --probe.",
    );
    return;
  }

  const decisions = [];
  const pageMeta = [];
  let pagesFetched = 0;
  let currentUrl = firstUrl;
  let currentHtml = firstHtml;
  let usedCandidate = null;

  while (pagesFetched < MAX_PAGES) {
    const $ = cheerio.load(currentHtml);
    const { candidate, $rows } = findListingRows($);

    if (!candidate && pagesFetched === 0) {
      throw new Error(
        "Could not find listing rows on the first page with any candidate selector.\n" +
          "Run `npm run probe` and inspect raw-listing.html, then update CONFIG.listingCandidates in scrape-decisions.js.",
      );
    }

    usedCandidate = candidate || usedCandidate;
    const rows = $rows.toArray().map((el) => extractRow($, el));
    decisions.push(...rows);
    pagesFetched++;
    pageMeta.push({
      page: pagesFetched,
      url: currentUrl,
      rows: rows.length,
      selector: usedCandidate ? `${usedCandidate.container} ${usedCandidate.row}` : null,
    });
    console.log(
      `[gba-explore] page ${pagesFetched} — ${rows.length} rows (running total ${decisions.length})`,
    );

    const nextUrl = findNextLink($, currentUrl);
    if (!nextUrl || nextUrl === currentUrl) break;

    await new Promise((r) => setTimeout(r, CONFIG.throttleMs));
    currentUrl = nextUrl;
    currentHtml = await get(currentUrl);
  }

  // Dedupe by detail_url (defensive)
  const seen = new Map();
  for (const d of decisions) {
    const key = d.detail_url || `${d.drug_name}|${d.decision_date}`;
    if (!seen.has(key)) seen.set(key, d);
  }
  const unique = [...seen.values()];

  // Optional Stage 2: follow detail pages to enrich the Zusatznutzen rating.
  let enriched = 0;
  let enrichFailed = 0;
  if (ENRICH) {
    console.log(`[gba-explore] enrichment mode: up to ${MAX_DETAIL} detail pages`);
    for (const d of unique.slice(0, MAX_DETAIL)) {
      if (!d.detail_url) continue;
      try {
        await new Promise((r) => setTimeout(r, CONFIG.throttleMs));
        const html = await get(d.detail_url);
        const $d = cheerio.load(html);
        const bodyText = $d("main, article, body").first().text();
        const rating = classifyRating(bodyText);
        if (rating) {
          d.benefit_rating = rating;
          d.benefit_rating_source = "detail-html-heuristic";
          enriched++;
        }
      } catch (err) {
        enrichFailed++;
        console.warn(`[gba-explore] enrich failed for ${d.detail_url}: ${err.message}`);
      }
    }
    console.log(`[gba-explore] enriched ${enriched} / ${unique.length} (${enrichFailed} failed)`);
  }

  const decisionsPath = await writeJson("gba-decisions.json", unique);
  const logPath = await writeJson("scrape.log.json", {
    started_at: startedAt,
    finished_at: new Date().toISOString(),
    first_url: firstUrl,
    pages_fetched: pagesFetched,
    page_meta: pageMeta,
    raw_rows: decisions.length,
    unique_records: unique.length,
    enrichment: {
      enabled: ENRICH,
      max_detail: ENRICH ? MAX_DETAIL : null,
      enriched_count: enriched,
      failed_count: enrichFailed,
    },
    selector_used: usedCandidate
      ? `${usedCandidate.container} ${usedCandidate.row}`
      : null,
  });

  console.log(
    `[gba-explore] done. ${unique.length} unique decisions → ${decisionsPath}, log → ${logPath}`,
  );
}

// Only run main() when this file is invoked directly (node scrape-decisions.js),
// not when another module imports it for testing.
import { pathToFileURL } from "node:url";
const invokedDirectly =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (invokedDirectly) {
  main().catch((err) => {
    console.error("[gba-explore] FATAL:", err.message);
    if (err.stack) console.error(err.stack);
    process.exit(1);
  });
}

// ── Exports for tests ─────────────────────────────────────────────────────
export { extractRow, findListingRows, parseGermanDate, classifyRating, findNextLink };
