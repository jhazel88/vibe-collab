# Task 3 — G-BA Decisions Scraper

Owner: Kasper · Spec: `.codex/plans/KASPER-DATA-TASKS.md` → Task 3

Scrape the G-BA AMNOG benefit-assessment (Nutzenbewertung) decisions listing. German text preserved verbatim — no translation.

## Status

Scripts written, fixture-based smoke test passes 19/19. **Not yet run against the live site** — sandbox egress to `g-ba.de` is blocked, so you'll run it from your Mac.

## What AMNOG is

Since 2011, every new pharmaceutical launched in Germany is subject to an early benefit assessment (§ 35a SGB V). The G-BA (Gemeinsamer Bundesausschuss), supported by IQWiG, decides whether the drug shows added benefit (Zusatznutzen) over the appropriate comparator therapy. That decision drives GKV-SV price negotiations.

### Zusatznutzen rating scale

| German | English | Notes |
|---|---|---|
| erheblicher Zusatznutzen | considerable | Highest, awarded rarely |
| beträchtlicher Zusatznutzen | substantial | |
| geringer Zusatznutzen | minor | |
| nicht quantifizierbarer Zusatznutzen | non-quantifiable | Evidence insufficient for extent |
| kein Zusatznutzen belegt | no added benefit proven | Drops drug into price cap vs. comparator |
| geringerer Nutzen | lesser benefit | Very rare — worse than comparator |

The script's `classifyRating` returns the lowercase German stem (`erheblich`, `beträchtlich`, `gering`, `nicht_quantifizierbar`, `kein`, `geringerer`) or `null` if no pattern matched.

## Source page

- Listing: <https://www.g-ba.de/bewertungsverfahren/nutzenbewertung/>
- Process overview: <https://www.g-ba.de/themen/arzneimittel/arzneimittel-richtlinie-anlagen/nutzenbewertung-35a/>
- Rating categories: <https://www.g-ba.de/themen/arzneimittel/arzneimittel-richtlinie-anlagen/nutzenbewertung-35a/zusatznutzen/>

## Run it

```bash
cd data/raw/gba-explore
npm install           # cheerio only, local to this folder

# Stage 0 — probe. Hit the listing once, save raw HTML for inspection.
#           Do this FIRST so you can confirm the selectors match the real DOM.
npm run probe

# If the probe's raw-listing.html uses different classes than CONFIG.listingCandidates
# in scrape-decisions.js, update that array and re-probe.

# Stage 1 — small listing scrape (1 page) to sanity-check output
npm run scrape:small

# Stage 2 — full listing scrape, all pages
npm run scrape

# Stage 3 — also fetch each decision's detail page to enrich the Zusatznutzen rating
#           (does NOT download PDFs — only the detail HTML)
npm run scrape:enrich
# or cap detail enrichment: node scrape-decisions.js --enrich --max-detail=50
```

Node 18+ (native `fetch`).

## Output schema — `gba-decisions.json`

One object per decision. `null` where the field wasn't present on the source:

```json
{
  "drug_name": "Pembrolizumab (Keytruda) - Melanom",
  "active_substance": "Pembrolizumab",
  "indication": "Fortgeschrittenes Melanom",
  "decision_date": "2025-03-15",
  "decision_date_raw": "15.03.2025",
  "detail_url": "https://www.g-ba.de/bewertungsverfahren/nutzenbewertung/1234/",
  "pdf_url": "https://www.g-ba.de/downloads/39-261-1234/2025-03-15_Beschluss_Pembrolizumab.pdf",
  "benefit_rating": "beträchtlich",
  "benefit_rating_source": "detail-html-heuristic"
}
```

- `decision_date` is ISO-normalised (`YYYY-MM-DD`); `decision_date_raw` keeps the German surface form for auditing.
- `benefit_rating` and `benefit_rating_source` are only populated if you ran `--enrich`. Otherwise `null`.
- German drug names / indications retained verbatim, no translation attempted.

## Design notes

### Two-stage scrape

The main listing typically shows drug + Wirkstoff + Beschluss date + links, but **not** the Zusatznutzen rating — that lives in each decision's Beschluss PDF or in the detail sub-page HTML. Since the brief says not to download PDFs, `--enrich` fetches the detail page HTML and runs `classifyRating` against the body text. This is heuristic (keyword match on canonical German phrases), so treat `benefit_rating` as best-effort — cross-check against the official Beschluss before using in the UI.

### Selector resilience

TYPO3 sites change class names periodically. Rather than one hard-coded selector, `CONFIG.listingCandidates` is a small ordered list of plausible patterns; the scraper tries each until one returns rows. If all fail, you'll get a clear error pointing at `--probe`. Adjust the list, re-run — much easier than editing the whole extractor.

### Polite pacing

- 800ms throttle between page fetches and between detail-page requests
- `User-Agent` identifies the project + your contact email
- `Accept-Language: de-DE` to ensure we get the German page (G-BA has an English version at `/english/` with fewer decisions)

## Gotchas to watch for on first run

- **TYPO3 class changes.** G-BA has periodically tweaked its CMS theme. If `--probe` shows the listing is, e.g., `<ol class="news-list">` or uses AJAX to populate after load, update `CONFIG.listingCandidates` — or, in the AJAX case, find the JSON endpoint in the Network tab and hit that directly (simpler).
- **Pagination.** G-BA's listings typically use `?page=N` params. The script follows `<a rel="next">`, `.pagination-next`, or anchors containing "Weiter" / "Nächste". If pagination is client-side JS only, the script stops at page 1; you'd need to iterate `?page=N` manually until a page returns 0 rows.
- **Encoding.** The page is UTF-8 and German umlauts round-trip through `fetch().text()` correctly on Node 18+. If you see mojibake in the JSON (`\u00fc` etc. is fine — that's just JSON escaping for `ü`), that's expected. If you see actually-broken bytes, check the response `Content-Type`.
- **Indication field.** Sometimes it's on the listing, often it's only on the detail page. If many rows come back with `indication: null`, that's expected — consider whether to pull it from detail pages during `--enrich`.
- **PDF links.** G-BA PDFs live under `/downloads/39-261-XXX/`. The script follows `a[href$=".pdf"]`. If a row has no PDF link at all (occasional, for in-progress Beschlüsse), the field is `null`.
- **Anti-scraping.** G-BA doesn't block scrapers but does serve from a Drupal/TYPO3 backend that can 503 under pressure. 800ms throttle is conservative. If you see 429/503, bump it.

## Files

| File | Committed? | Purpose |
|---|---|---|
| `scrape-decisions.js` | ✅ | Main scraper + optional detail enrichment |
| `test-parse.mjs` | ✅ | Fixture-based smoke test — `node test-parse.mjs` |
| `package.json` | ✅ | `cheerio` only, local to this folder |
| `.gitignore` | ✅ | Ignores `node_modules/`, raw HTML dumps, probe dumps |
| `README.md` | ✅ | This file |
| `gba-decisions.json` | ✅ (after run) | Simplified records — the deliverable |
| `scrape.log.json` | ✅ (after run) | Run metadata: pages, counts, selector that matched, enrichment stats |
| `raw-listing.html` | ❌ ignored | Raw first-page dump for debugging |
| `probe-response.txt` | ❌ ignored | First 8kB of the probe response |
| `node_modules/` | ❌ ignored | Local install of `cheerio` |

## What we know won't work (be honest)

- **Single-listing assumption.** The G-BA site has several overlapping listings (AMNOG Beschlüsse, Verfahren laufend, Beratungen, etc.). This scraper targets the main `/bewertungsverfahren/nutzenbewertung/` index. If the brief later wants the "laufende Verfahren" (in-progress procedures) or archived decisions, a second target URL will be needed.
- **Authoritative ratings still come from PDFs.** Even with `--enrich`, the detail-page heuristic is a guide; the Beschluss PDF is canonical. Eventually, a follow-up task should parse the PDFs (they're well-structured, fixed template) to extract rating + Verfahren details + endpoint-specific Zusatznutzen levels.
- **No sub-group ratings.** A single Beschluss often assigns different Zusatznutzen to different patient sub-groups (age, prior treatment, biomarker). The current scraper collapses to a single field. The PDF-parsing follow-up task should handle sub-groups.
