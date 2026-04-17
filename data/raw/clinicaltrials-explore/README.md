# Task 1 — ClinicalTrials.gov API Explorer

Owner: Kasper · Spec: `.codex/plans/KASPER-DATA-TASKS.md` → Task 1

Quick API probe of ClinicalTrials.gov v2 to confirm field availability, rate-limit behaviour, and data quality for Phase 2/3 oncology trials. Two scripts (`fetch-oncology.js`, `transform.js`) that together produce a simplified JSON dataset matching the shape the brief asked for.

## Run it

```bash
cd data/raw/clinicaltrials-explore
node fetch-oncology.js 100        # fetches 100 Phase 2/3 oncology trials → raw-response.json
node transform.js                 # reads raw-response.json → oncology-trials-simplified.json
```

Node 18+ required (uses native `fetch`). No dependencies to install, no API key.

> **Note on commit state:** `raw-response.json` and `oncology-trials-simplified.json` are **not committed** — they're build output. The scaffold was prepared in a sandbox that can't reach `clinicaltrials.gov`, so these files need to be generated on your machine. First run populates them.

## API summary

- **Base URL:** `https://clinicaltrials.gov/api/v2/studies`
- **Spec:** OpenAPI 3.0 — https://clinicaltrials.gov/data-api/api
- **Auth:** None. Keyless and free, US public domain data.
- **Formats:** JSON (default) or CSV (`format=csv`).
- **Pagination:** `pageSize` up to 1000; cursor-based with `nextPageToken`. Total count returned as `totalCount` when `countTotal=true`.
- **v1 retired June 2024** — ignore older tutorials referencing `/api/query/study_fields`.

## Query we're using

```
GET /api/v2/studies
  ?query.cond=cancer
  &filter.advanced=AREA[Phase](PHASE2 OR PHASE3)
  &filter.overallStatus=RECRUITING,ACTIVE_NOT_RECRUITING
  &filter.advanced2=AREA[LastUpdatePostDate]RANGE[2024-04-01,MAX]
  &pageSize=100
  &format=json
  &fields=<explicit field list>
```

Two filter languages are mixed here on purpose:
- `filter.overallStatus` is a typed dimension — comma-separated values = OR.
- `filter.advanced` is the generic "search area" expression language — use for phase, dates, etc. See https://clinicaltrials.gov/data-api/about-api/search-areas.
- `query.cond` uses the condition-term parser (fuzzy + MeSH) — `"cancer"` picks up oncology MeSH siblings. If you want a stricter match, use `AREA[Condition]("cancer")` inside `filter.advanced`.

## Response shape (what to expect)

Each study comes back as a nested object. The fields we care about live under `protocolSection`:

```json
{
  "totalCount": 12453,
  "studies": [
    {
      "protocolSection": {
        "identificationModule": { "nctId": "NCT01234567", "briefTitle": "...", "officialTitle": "..." },
        "statusModule": {
          "overallStatus": "RECRUITING",
          "startDateStruct": { "date": "2024-03-01", "type": "ACTUAL" },
          "primaryCompletionDateStruct": { "date": "2027-06-01", "type": "ESTIMATED" },
          "lastUpdatePostDateStruct": { "date": "2026-04-10", "type": "ACTUAL" }
        },
        "sponsorCollaboratorsModule": {
          "leadSponsor": { "name": "Pfizer", "class": "INDUSTRY" }
        },
        "conditionsModule": { "conditions": ["Breast Cancer"] },
        "designModule": {
          "phases": ["PHASE3"],
          "enrollmentInfo": { "count": 450, "type": "ESTIMATED" }
        },
        "armsInterventionsModule": {
          "interventions": [{ "name": "Palbociclib", "type": "DRUG" }]
        },
        "contactsLocationsModule": {
          "locations": [{ "country": "United States" }, { "country": "Germany" }]
        }
      }
    }
  ]
}
```

`transform.js` flattens this into the shape the brief asked for, with `null` for missing values.

## Field reliability (my expectation, to verify on first run)

Based on the v2 docs and typical CT.gov behaviour — update the table after your first real run:

| Field | Expected reliability | Notes |
|---|---|---|
| `nct_id` | ★★★★★ | Always present, canonical key. |
| `title` (BriefTitle) | ★★★★★ | Required at registration. |
| `phase` | ★★★★☆ | Missing for observational + some Phase N/A trials. Can be a multi-value array for combined phases. |
| `status` | ★★★★★ | Required; updated by sponsor. Stale "RECRUITING" entries are common — cross-check `lastUpdatePostDate`. |
| `sponsor` | ★★★★★ | Required. `leadSponsor` vs `collaborators` — we only take lead. |
| `sponsor_class` | ★★★★☆ | `INDUSTRY`/`NIH`/`OTHER_GOV`/`INDIV`/`OTHER`/`NETWORK`/`AMBIG`. Occasionally missing on very old entries. |
| `conditions` | ★★★★☆ | Free-text, not MeSH. Expect duplicates across trials ("breast cancer" vs "Breast Cancer, Metastatic"). Will need dedup later. |
| `interventions` | ★★★★☆ | Free-text. Names not normalised to INN. Generic drug names overlap with brand names. |
| `start_date` | ★★★★☆ | `ACTUAL` vs `ESTIMATED` flag in struct. Honour it. |
| `primary_completion_date` | ★★★☆☆ | Often estimated and pushed forward repeatedly. Do not trust for forecasting without the `type` flag. |
| `enrollment` | ★★★★☆ | `count` + `type` (ACTUAL/ESTIMATED). |
| `countries` | ★★★☆☆ | Derived from locations. Some studies declare locations without country, some have typo'd country names ("US" vs "United States"). Normalise later. |

## Gotchas I already know to flag

1. **Phase is an array.** `"PHASE1_PHASE2"` comes back as `["PHASE1","PHASE2"]`. `transform.js` joins with `/` for display.
2. **Status capitalisation.** v2 returns `RECRUITING` etc. in screaming snake case. v1 returned title case (`Recruiting`). Normalise for UI.
3. **The `fields` param dramatically shrinks payloads.** With our field list a 100-study response is ~200KB. Without it, ~5-10MB (full protocol + results + annotations). Use the field list unless you deliberately want everything.
4. **Pagination.** Total > pageSize → response includes `nextPageToken`. Loop using `pageToken=<token>` until absent. The current `fetch-oncology.js` stops at the first page; extend if you want the whole cohort.
5. **`query.cond=cancer` is fuzzy.** It pulls in trials where "cancer" is a MeSH sibling of the indexed condition. Usually what you want, but if you're going to build exact-match indication filtering later, switch to the advanced-area expression.
6. **No rate-limit error seen in the docs.** Unofficially: ~5 req/sec is safe; going above gets soft-throttled with 429s. Be polite, no back-off logic needed for hundreds of requests.
7. **Dates can be `YYYY-MM` (not `YYYY-MM-DD`).** For imprecise start dates. Handle both when comparing.
8. **Free-text everything.** No controlled vocabulary in `condition` or `intervention` — plan a normalisation layer (ATC for drugs, ICD-10/SNOMED for conditions) before we try to join this with HTA or guideline data.

## What's here

```
data/raw/clinicaltrials-explore/
├── fetch-oncology.js              # fetch script (no deps, Node 18+)
├── transform.js                   # simplifier
├── README.md                      # this file
├── raw-response.json              # ← output of fetch-oncology.js (not yet generated)
└── oncology-trials-simplified.json # ← output of transform.js (not yet generated)
```

## After first run — to-do for the README

Update the field reliability table with actual null-counts printed by `transform.js`, and note any rate-limit behaviour you actually observed. Then commit both JSON outputs.

## Cross-ref

- Source overview (all sources, not just this one): `.codex/research/sources.md`
- Product plan: `.codex/plans/HTA-REUSE-BACKBONE-PLAN.md`
- Task spec: `.codex/plans/KASPER-DATA-TASKS.md` (Task 1)
