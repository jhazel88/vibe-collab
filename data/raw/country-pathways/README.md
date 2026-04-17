# Task 4 — Country Pathway Curation

Owner: Kasper · Spec: `.codex/plans/KASPER-DATA-TASKS.md` → Task 4

Structured reference data for the 20 countries listed in James's brief, covering HTA / market access pathways from marketing authorisation through funding and uptake. Designed to feed directly into `src/components/PathwayTimeline.jsx`.

## Coverage

| Group | Count | Countries |
|---|---|---|
| EU / EEA | 8 | UK, Germany, France, Netherlands, Sweden, Italy, Spain, Belgium |
| Other HIC | 6 | US, Canada, Australia, Japan, South Korea, New Zealand |
| UMIC | 3 | Thailand, Brazil, South Africa |
| LMIC | 3 | India, Kenya, Nigeria |

Distribution: **14 HIC / 3 UMIC / 3 LMIC · 15 with formal HTA · 5 without (US, ZA, IN, KE, NG)**.

## Schema

One object per country; all fields present, `null` where unknown (never fabricated):

```json
{
  "country": "Germany",
  "iso_code": "DE",
  "income_group": "HIC",
  "has_formal_hta": true,
  "hta_bodies": [
    { "name": "...", "abbreviation": "...", "role": "assessment|decision|payer|regulator|advisory", "website": "https://..." }
  ],
  "pathway_steps": [
    { "step": 1, "label": "...", "typical_months": "3-6" }
  ],
  "notes": "...",
  "sources": ["https://..."]
}
```

`typical_months` is always a **string** (range like `"6-12"`, single value like `"3"`, or `"variable"`) or `null` — never a number, so the front-end can render ranges directly.

## Roles used

- `regulator` — grants marketing authorisation (FDA, EMA, MHRA, PMDA, SAHPRA …)
- `assessment` — produces the clinical/economic evaluation (IQWiG, NICE, HAS CT, CDA-AMC …)
- `decision` — formally decides inclusion / reimbursement (G-BA, Chuikyo, NLEM committees …)
- `payer` — negotiates price / manages reimbursement (GKV-SV, pCPA, CEPS, NHSO …)
- `advisory` — provides non-binding input (ICER in the US, HTAIn in India, KCE in Belgium …)

Some bodies wear two hats (e.g. TLV in Sweden both assesses and decides) — in those cases I've picked the dominant role and mentioned the other in `notes`.

## What was easy vs. hard

**Easy:**
- **EU4 + UK** — well-documented pathways, clear timing norms, ISPOR and HAS/NICE/G-BA English publications extensive. UK post-Brexit route had to be checked carefully (MHRA now distinct from EMA centralised).
- **Australia, Canada, New Zealand** — PBAC, CDA-AMC, and Pharmac publish process documents that map 1:1 onto pathway steps.
- **Thailand** — HITAP is genuinely exemplary in transparency; written up extensively in WHO / Lancet reports.

**Medium:**
- **Belgium, Netherlands, Sweden** — secondary sources (Beneluxa, NT-council reporting, TLV regional implementation) required to capture the full pathway beyond the headline body.
- **Japan, South Korea** — English documentation uneven; timing norms for C2H (Japan) post-launch CEA still settling after 2019 introduction.
- **Italy** — 2023-2024 CSE reform (merging CTS + CPR) is in transition; steps reflect the pre-reform structure with a note flagging change.

**Hard:**
- **South Africa** — NHI Bill (May 2024) proposes an HTA function but implementation is pending. Current pathway reflects the de-facto EML/SEP split.
- **India** — HTAIn advisory-only; most access decisions happen via NLEM + state procurement, which is genuinely decentralised. Pathway steps use `variable` for timing.
- **Kenya, Nigeria** — no formal HTA; pathway captures regulatory + EML + procurement + donor channels, with explicit `typical_months: "variable"` for most steps.
- **US** — deliberately called out as `has_formal_hta: false`. ICER is advisory; the true "HTA" is fragmented across CMS, PBMs, employer plans, and (post-IRA) Medicare negotiation.

## Data quality caveats

1. **Timing windows are norms, not SLAs.** Stated months reflect typical recent practice (2022-2025). Statutory clocks (e.g. Belgium 180 days, Sweden 180 days) are noted in the step label; actual end-to-end access delays are often longer.
2. **LMIC pathways have donor-procurement parallel tracks** (Global Fund, Gavi, PEPFAR). Captured as an explicit step where it's a primary pathway (KE, NG) but not exhaustive for every disease area.
3. **Post-reform drift.** Several systems are mid-reform: Italy CSE merger, UK VPAG 2024, Japan NHI price revisions, Australia HTA Review 2023-24, Kenya SHA replacing NHIF 2024, South Africa NHI Bill 2024. The `notes` field flags each; re-review before going to production UI.
4. **No financial thresholds committed as numeric fields.** Where a willingness-to-pay figure is known (Thailand 160k THB/QALY, Australia 40-80k AUD/QALY, Sweden ~500k SEK/QALY) it sits in `notes` as a string, not a structured field. Happy to promote to a structured field if the front-end wants to filter/sort by it.
5. **I did NOT verify every website URL is currently live** — they're taken from the canonical domain and the known path. If any 404 in the UI, flag them and I'll chase.

## Most useful sources (primary research)

- **ISPOR PE Guidelines Around The World** — <https://tools.ispor.org/PEguidelines/> — single best overview per country.
- **WHO HTA country resources** — <https://www.who.int/health-technology-assessment>
- **Beneluxa initiative** — for BE/NL/LU/AT/IE cross-border HTA work.
- **EUnetHTA / EU JCA** (in force Jan 2025) — starting to reshape EU national HTA.
- **HITAP LMIC HTA Roadmap** reports.
- **National HTA body websites** — each country's entry lists the ones I used directly.

## Known gaps / follow-ups

- No data on **combination-therapy rules** (Germany GKV-FinStG, France combo discounts). Could be a per-country nested field later.
- **Early-access / compassionate-use pathways** only captured where they're distinct (France AAP) — others have them but they're not on the main pathway.
- **Sub-national variation** (Italy regional, Canada provincial, India state, Nigeria state, US state Medicaid) is flagged in `notes` but not structured.
- Should eventually add **`access_delay_days_p50`** (median from MA to first reimbursement) per IQVIA / EFPIA patient access reports — useful for sorting/filtering.
- `notes` is free text — a future enhancement could parse it into structured `reform_status`, `wtp_threshold_currency_amount`, `key_gotcha` fields.

## Files

| File | Committed? | Purpose |
|---|---|---|
| `pathways.json` | ✅ | The deliverable — 20 countries, full schema |
| `validate.mjs` | ✅ | Fixture-free structural validator — `node validate.mjs` |
| `README.md` | ✅ | This file |

No dependencies, no API keys, no network calls required to run `validate.mjs`. Native Node 18+.

## How to regenerate / extend

To add a country: append one object to the array following the same shape, re-run `node validate.mjs` until it reports `ALL OK`, update the coverage table above. The validator enforces: 2-letter ISO, income group in `{HIC, UMIC, LMIC, LIC}`, role in the defined set, all websites `https://`, `typical_months` is string-or-null.
