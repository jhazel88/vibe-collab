# Task 2 — NICE Technology Appraisals

Owner: Kasper · Spec: `.codex/plans/KASPER-DATA-TASKS.md` → Task 2

Pull the NICE syndication API and produce a simplified feed of Technology Appraisal (TA) guidance decisions. English text preserved verbatim.

## Status

Scripts written, fixture-based smoke test passes 21/21. **Not yet run against the live API** — requires a free NICE syndication key, and the sandbox this was authored in can't reach `api.nice.org.uk`. You'll run it from your Mac.

## What NICE TA guidance is

NICE (the National Institute for Health and Care Excellence, England & Wales) publishes Technology Appraisals that decide whether the NHS can use a given medicine or device — essentially England's HTA Beschluss. Each TA has a guidance ID (`TA<nnn>`), a published date, a last-modified date, and a recommendation that collapses to one of five canonical outcomes.

### Recommendation categories

| Stem | Plain English | Notes |
|---|---|---|
| `recommended` | Recommended without restriction | Available as an NHS option |
| `optimised` | Recommended with restriction | Only certain patients/subgroups qualify |
| `not_recommended` | Not recommended | NHS won't routinely fund |
| `only_in_research` | Only in research | Available only within a research context |
| `terminated` | Appraisal terminated | Company non-submission, withdrawal, etc. |

The script's `classifyRecommendation` returns the stem or `null` if no pattern matched. The heuristic runs over `title + summary + content` — check the NICE page for the authoritative wording before using it in the UI.

## Source

- Syndication sign-up: <https://www.nice.org.uk/syndication>
- Syndication guide: <https://www.nice.org.uk/corporate/ecd10>
- Public TA catalogue (for sanity-checking output): <https://www.nice.org.uk/guidance/published?type=ta>

## Run it

```bash
cd data/raw/nice-explore
npm install                         # fast-xml-parser, local to this folder

cp .env.example .env
# Edit .env and paste your NICE_API_KEY

# Stage 0 — probe. Hits each candidate endpoint × Accept type until one
#           returns XML/JSON. Dumps first 8kB of the chosen response so
#           you can confirm the feed shape matches what we expect.
npm run probe
# Inspect probe-response.txt — it lists every attempt (status + shape)
# and shows the chosen endpoint.

# Stage 1 — fetch the first page only, for sanity-checking
npm run fetch:small

# Stage 2 — fetch all pages (follows <link rel="next">)
npm run fetch
```

Node 18+ (native `fetch`).

## Output schema — `ta-decisions.json`

One object per TA guidance entry. `null` where the field wasn't present:

```json
{
  "guidance_id": "TA812",
  "title": "Pembrolizumab for adjuvant treatment of renal cell carcinoma (TA812)",
  "date_published": "2024-11-02",
  "date_last_modified": "2025-03-15",
  "recommendation": "recommended",
  "recommendation_source": "title-summary-heuristic",
  "url": "https://www.nice.org.uk/guidance/ta812",
  "atom_id": "https://www.nice.org.uk/guidance/ta812"
}
```

- `guidance_id` extracted via `\b(TA\d{1,4})\b` regex against title + atom id. Should be populated for all modern TAs; older format numbers (TAG, pre-TA) will come back as `null`.
- `date_published` / `date_last_modified` are ISO date-only (`YYYY-MM-DD`); Atom provides full timestamps but the date is what anyone will actually query on.
- `recommendation` only populated if the classifier matched one of the canonical phrases. Watch the miss rate on the first run — if lots of entries come back `null`, the heuristic needs more patterns.
- `atom_id` is kept for debugging/deduplication even when equal to `url`.

## Field reliability — expected

Based on NICE's published API docs and the shape of their public TA pages:

| Field | Reliability | Notes |
|---|---|---|
| `guidance_id` | High | TA-number is in every modern title |
| `title` | High | Always present |
| `date_published` | High | Atom `<published>` |
| `date_last_modified` | High | Atom `<updated>` |
| `url` | High | Either `<link rel="alternate">` or the id itself |
| `recommendation` | **Medium** | Heuristic; expect 5–15% `null` until we iterate keywords against real data |

Actual reliability will be measured on first run — update this table once you have real numbers.

## Design notes

### Endpoint negotiation

NICE has reorganised syndication routes over the years and the published docs don't always match what the server returns. Rather than hard-coding one URL, `CONFIG.endpointCandidates` lists three plausible paths, and `CONFIG.acceptCandidates` lists four Accept types (Atom XML preferred, JSON as fallback). `negotiateEndpoint` probes each combination until one returns a 200 with a well-formed XML or JSON body. The chosen endpoint is logged in `fetch.log.json` for auditing and in `probe-response.txt` for visual inspection.

If all 12 attempts fail, you'll see `endpoint negotiation failed` and exit code 2. Run `npm run probe` to see each attempt's status + body shape and work out whether the issue is auth, path, or content-type.

### XML parser config

We use `fast-xml-parser` with:

- `ignoreAttributes: false` — we need `@_rel`, `@_href` for link discovery
- `parseTagValue: false` — dates come through as strings, not coerced to JS `Date`

### Polite pacing

- 800 ms throttle between probe attempts and between page fetches
- `User-Agent` identifies the project + contact email
- `API-Key` header on every request

NICE syndication doesn't publish a rate limit, but it's a small public service — don't hammer it.

## Gotchas to watch for on first run

- **API key required.** The endpoint returns 401 without `API-Key`. Free to register but requires an email confirmation; the key arrives by email.
- **Feed shape drift.** If `--probe` shows the chosen endpoint returns HTML (shape `html`), you're getting the NICE website's HTML portal, not the syndication API. That usually means the key is wrong or the route has moved. Check the attempts log.
- **TA vs TAG numbering.** Pre-2012 guidance used `TAG<nnn>`; modern is `TA<nnn>`. The extractor only matches `TA\d+`; TAG records come back with `guidance_id: null`. Not worth the regex complexity until someone actually needs the old records.
- **Recommendation heuristic misses.** Some TAs use unusual phrasings ("is an option within its marketing authorisation") that don't match our patterns. Scan the first-run output for `recommendation: null` and add patterns to `CONFIG.recommendationKeywords` as needed.
- **Pagination.** The feed uses `<link rel="next">`. If a response omits it, we stop there — meaning a truncated-but-valid feed will look like a complete one. Sanity-check the entry count against the public TA catalogue.
- **Encoding.** Feed is UTF-8. Umlauts and special characters round-trip correctly through Node 18+ `fetch().text()`.

## Files

| File | Committed? | Purpose |
|---|---|---|
| `fetch-ta-decisions.js` | yes | Main fetcher + endpoint negotiation + Atom parser |
| `test-parse.mjs` | yes | Fixture-based smoke test — `node test-parse.mjs` |
| `package.json` | yes | `fast-xml-parser` only, local to this folder |
| `.gitignore` | yes | Ignores `node_modules/`, raw XML dumps, probe dump, `.env` |
| `.env.example` | yes | Template — copy to `.env` and fill in your key |
| `README.md` | yes | This file |
| `ta-decisions.json` | yes (after run) | Simplified records — the deliverable |
| `fetch.log.json` | yes (after run) | Run metadata: endpoint, pages, counts, negotiation attempts |
| `raw-response-*.xml` | ignored | Per-page raw XML for debugging |
| `probe-response.txt` | ignored | Probe attempts log + first 8kB of chosen response |
| `.env` | ignored | Your API key — never commit |
| `node_modules/` | ignored | Local install of `fast-xml-parser` |

## What we know won't work (be honest)

- **Single-feed assumption.** This fetches the TA feed only. NICE also publishes HST (highly specialised technologies), CG (clinical guidelines), NG (NICE guidelines), IPG, MTG, DG, etc. If the brief later wants any of those, each is a separate feed — probably another `endpointCandidates` entry.
- **Recommendation from title/summary.** The full reasoning lives in the TA's final guidance document. Our classifier is a keyword match and should be treated as best-effort. Budget for a follow-up task that pulls the guidance HTML and extracts the authoritative recommendation text.
- **No sub-population ratings.** A TA can recommend a drug for one subgroup and decline it for another; we collapse to a single field. Same caveat as the G-BA scraper — handle properly when parsing the full guidance document.
- **No price data.** NICE decisions don't include negotiated prices; those are separate and not published.
