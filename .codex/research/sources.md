# Data Sources — R&D Tracker, HTA/Market Access, Treatment Guidelines

_Last updated: 2026-04-17 · Owner: Kasper_

Research on the primary public sources we'll pull from for the three modules Kasper owns inside the global health dashboard. Scope: overview per source — what it is, what it covers, how to access it, and licensing/cadence notes where known. Depth is deliberately shallow; this is a map, not an integration spec. When a module moves to build, spin up a task spec in `.codex/tasks/` that drills into the chosen source(s).

HTA section is global, but the Netherlands sources are called out explicitly since that's our evaluation/testing geography.

---

## 1. R&D Tracker

Goal: surface who is developing what, where it is in the development lifecycle, and what changed recently.

### 1.1 ClinicalTrials.gov (US, global reach)

The default first source for any R&D tracker. Despite being US-run, sponsors across the world register here because FDA and many journals require it.

- **URL:** https://clinicaltrials.gov
- **API:** REST, v2, OpenAPI 3.0 spec. Docs at https://clinicaltrials.gov/data-api/api. Returns JSON or CSV. Classic API v1 was retired June 2024 — ignore old tutorials.
- **Coverage:** ~500k studies, interventional + observational, global. Fields include sponsor, phase, condition, intervention, locations, status, start/primary completion dates, results (where posted).
- **Cadence:** Near-real-time; studies update whenever sponsors edit them.
- **Licensing:** US public domain, free, no key needed.
- **Gotcha:** Data quality is uneven — sponsor-reported, so "status" and "completion date" drift. Normalise phase and condition fields on ingest.

### 1.2 EU Clinical Trials Register (legacy) + CTIS

The EU has migrated. As of 31 January 2025, all EU/EEA clinical trials run through the **Clinical Trials Information System (CTIS)** under Regulation 536/2014. The old EudraCT-based register is still online for pre-2025 trials but is frozen.

- **CTIS public portal:** https://euclinicaltrials.eu
- **Legacy EudraCT register:** https://www.clinicaltrialsregister.eu (read-only for historical data)
- **EMA CTIS hub:** https://www.ema.europa.eu/en/human-regulatory-overview/research-development/clinical-trials-human-medicines/clinical-trials-information-system
- **Access:** Public searchable web portal. No official JSON API for bulk download as of mid-2026 — EMA has a FAQ on how to search, view, and download individual trial dossiers (PDFs). Scraping is feasible but fragile.
- **2026 updates to watch:** Secure Workspaces rollout and new Annual Safety Report module in early 2026 — may change what's public vs. redacted.
- **Gotcha:** Many 2021-2024 trials exist in both EudraCT and CTIS during the transition. Deduplicate by EU trial number.

### 1.3 WHO ICTRP (aggregator of national registries)

Useful as a fallback for trials registered in national registries that don't flow into ClinicalTrials.gov or CTIS (e.g. Chinese, Indian, Japanese registries).

- **URL:** https://www.who.int/observatories/global-observatory-on-health-research-and-development/resources/databases/databases-on-processes-for-r-d/health-products-in-the-pipeline
- **Access:** Weekly XML dumps, free. Registration may be required for bulk.
- **Coverage:** Aggregates ~17 primary registries worldwide.

### 1.4 FDA — openFDA + Drugs@FDA

Not a pipeline source exactly, but an essential signal for "has this drug actually crossed the finish line?" Useful to cross-reference a trial/pipeline entry against real approvals.

- **URL:** https://open.fda.gov
- **API:** REST, JSON. Bulk JSON zip downloads also available at https://download.open.fda.gov. No key needed for low-volume use; key bumps rate limits.
- **Coverage:** Drugs@FDA (approvals since 1939), adverse events, labels, NDC directory.
- **Licensing:** US public domain.

### 1.5 Company Investor Relations — Pipeline Pages

Per Kasper's direction, we scrape these directly for the canonical "what the company says is in its pipeline" view. Most top-20 pharmas publish a dedicated pipeline page and refresh it quarterly around earnings. Below are the pages to seed with; add/remove as the dashboard's target company list solidifies.

| Company | Pipeline page (start here) |
|---|---|
| Pfizer | https://www.pfizer.com/science/drug-product-pipeline |
| Roche | https://www.roche.com/solutions/pipeline |
| Novartis | https://www.novartis.com/research-development/novartis-pipeline |
| Merck & Co. (MSD) | https://www.merck.com/research/product-pipeline/ |
| AstraZeneca | https://www.astrazeneca.com/our-therapy-areas/pipeline.html |
| Johnson & Johnson | https://www.jnj.com/innovative-medicine/pipeline |
| AbbVie | https://www.abbvie.com/science/pipeline.html |
| Bristol Myers Squibb | https://www.bms.com/researchers-and-partners/in-the-pipeline.html |
| Eli Lilly | https://www.lilly.com/discovery/pipeline |
| GSK | https://www.gsk.com/en-gb/innovation/pipeline/ |
| Sanofi | https://www.sanofi.com/en/our-science/our-pipeline |
| Takeda | https://www.takeda.com/what-we-do/research-and-development/pipeline/ |
| Bayer | https://www.bayer.com/en/pharma/development-pipeline |
| Boehringer Ingelheim | https://www.boehringer-ingelheim.com/human-health/our-research/pipeline |
| Amgen | https://www.amgen.com/science/pipeline |

**Access strategy:** Most pages are JS-rendered SPAs. Options, cheapest first:
1. Check the investor-relations PDF of the quarterly pipeline chart — often a stable URL per quarter, parse with pdfplumber.
2. Headless browser (Playwright) + DOM snapshot, re-run weekly.
3. A handful (Roche, Novartis) expose a JSON backing the filter UI — inspect network tab.

**Gotchas:** Definitions of "phase" vary by company; "filed" and "approved" sometimes collapse into one node; therapeutic-area taxonomies are bespoke. Build a normalisation layer.

**Cadence:** Typically quarterly refresh tied to earnings; some update on press releases. Re-scrape weekly to catch intermediate changes.

### 1.6 Free Aggregators & News Feeds

- **AMCP Pipeline Portal** — https://www.amcp.org/resources/drug-product-pipeline-resources — curated aggregator drawing from gov + public sources.
- **Wikipedia "Drug pipeline" articles** — https://en.wikipedia.org/wiki/Drug_pipeline and company-specific pages. Surprisingly well-maintained for top 20 drugs; good sanity check.
- **Industry news RSS (free tier):** FierceBiotech, Endpoints News, BioCentury, STAT Pharmalot — RSS or email-to-parser for trial start, readout, and filing signals.
- **Press release wires:** Business Wire, PR Newswire, GlobeNewswire health-sector RSS — first place sponsors publish readouts. Noisy, but timely.

**Paid aggregators (out of scope per your answer, but noted for reference):** Citeline Pharmaprojects, GlobalData, Evaluate, BiomedTracker. Re-evaluate if the free-tier approach leaves too many gaps.

---

## 2. HTA / Market Access

Goal: track reimbursement, pricing, and access decisions across geographies. Primary evaluation set is the Netherlands; structure the schema so other countries plug in cleanly.

### 2.1 Netherlands (primary test geography)

**Zorginstituut Nederland (ZIN)** — the national HTA body, issues `pakketadvies` for inclusion in the basic insurance package.
- Main site: https://www.zorginstituutnederland.nl (EN version: https://english.zorginstituutnederland.nl)
- Publications & advice portal: https://www.zorginstituutnederland.nl/publicaties
- No formal public API; advice reports are published as PDFs plus structured metadata on the publications pages. Scrape the publications index filtered by "Advies" and document-type "Pakketadvies" / "Standpunt".
- Process uses severity-of-illness-linked willingness-to-pay thresholds (published since 2015).

**Nederlandse Zorgautoriteit (NZa)** — regulator; sets tariffs (`beleidsregels`), monitors market.
- Documents: https://www.nza.nl/documenten
- Open data via https://data.overheid.nl (the Dutch gov open-data portal). Key dataset: "Open DIS data" (hospital tariff/diagnosis info). Look up "Nederlandse Zorgautoriteit (Rijk)" as data publisher.

**College ter Beoordeling van Geneesmiddelen (CBG-MEB)** — Dutch medicines agency; runs the `geneesmiddeleninformatiebank`.
- Medicines database: https://www.geneesmiddeleninformatiebank.nl
- Search-only public UI; no public API. Most European-authorised medicines duplicate into EMA's EPAR database anyway, so CBG-MEB is primarily useful for nationally authorised products.

**Legal sources (NL):**
- **wetten.overheid.nl** — canonical text of all Dutch law. Search: https://wetten.overheid.nl/zoeken
- **Basis Wetten Bestand (BWB)** — all laws as open XML, downloadable over HTTPS: https://data.overheid.nl/dataset/basis-wetten-bestand
- **data.overheid.nl API** — CKAN-based metadata API: https://data.overheid.nl/en/ondersteuning/data-publiceren/api
- Key healthcare laws to index: Zorgverzekeringswet (Zvw), Wet langdurige zorg (Wlz), Geneesmiddelenwet, Wet marktordening gezondheidszorg (Wmg), Wet BIG, Wpg.
- Licence: CC-0 for open-data portal content.

### 2.2 EU-level

**European Medicines Agency (EMA) — EPAR**
- Portal: https://www.ema.europa.eu/en/medicines
- Data download: https://www.ema.europa.eu/en/medicines/download-medicine-data — EMA publishes an entire-website JSON feed updated overnight, plus table exports to Excel.
- Open-data dataset on EU Open Data Portal: https://data.europa.eu/data/datasets/epar-human-medicines
- Coverage: every centrally authorised medicine's EPAR (full scientific assessment report).
- Cadence: nightly table refresh.
- Licence: Free reuse per EMA terms.

**EUnetHTA / Joint Clinical Assessment (JCA)** — the new EU HTA regulation (2021/2282) in force since Jan 2025.
- Commission page: https://health.ec.europa.eu/health-technology-assessment/implementation-regulation-health-technology-assessment/joint-clinical-assessments_en
- Ongoing JCA list is published as an Excel file on that page, refreshed periodically (e.g. updated 2 Sep 2025).
- Scope 2025: oncology + ATMPs. Expands to orphans in 2028, all medicines in 2030.
- First JCA reports land in 2026 — this section will need reshaping once the report format stabilises.

### 2.3 Key HTA Bodies Globally

| Body | Country | Primary portal | Access notes |
|---|---|---|---|
| **NICE** | UK | https://www.nice.org.uk | All TA guidance is free, web-published. No official API but pages are well-structured and scrapable. Methods manual: PMG36. |
| **SMC** | Scotland | https://www.scottishmedicines.org.uk | Parallel to NICE for Scotland; public detailed advice documents. |
| **G-BA** | Germany | https://www.g-ba.de/bewertungsverfahren/nutzenbewertung/ | Final decisions + dossiers + IQWiG assessments all public. German-only. |
| **IQWiG** | Germany | https://www.iqwig.de | Benefit assessments (Nutzenbewertung) prepared for G-BA; English summaries available. |
| **HAS (Commission de la Transparence)** | France | https://www.has-sante.fr | CT appraisals (avis) published per drug. French; some EN abstracts. |
| **TLV** | Sweden | https://www.tlv.se | Decisions on pharmaceutical reimbursement. |
| **ICER** | US | https://icer.org | Independent (non-government) US HTA. Reports and scorecards public. |
| **CDA-AMC** (formerly CADTH) | Canada | https://www.cda-amc.ca/reports | Reimbursement review, health tech review, horizon scan reports, all public. |
| **PBAC** | Australia | https://www.pbs.gov.au/info/industry/listing/elements/pbac-meetings/psd | Public Summary Documents (PSDs) per submission — accept/reject/defer + ICER + financial impact. Searchable. |

Common pattern across all: HTML + PDF, no formal public APIs, but predictable URL structures that a scraper can handle. ICER, NICE, CDA-AMC released a joint transparency position in recent years — worth tracking as it affects what clinical data is visible.

**Cross-reference:** INAHTA (https://database.inahta.org) is the international HTA database — aggregated index across member agencies. Useful as a belt-and-suspenders "did we miss an assessment?" check.

---

## 3. Treatment Guidelines (Netherlands)

Goal: pull canonical treatment recommendations so users can see "what's the current standard of care for X in NL?"

### 3.1 Richtlijnendatabase (Federatie Medisch Specialisten)

The primary source for Dutch medical-specialist guidelines.

- **URL:** https://richtlijnendatabase.nl (English landing: https://richtlijnendatabase.nl/en/about_this_site.html)
- **Owner:** Kennisinstituut of the Federatie Medisch Specialisten (FMS), with IKNL contributing oncology content.
- **Coverage:** 600+ multidisciplinary evidence-based guidelines across specialist care.
- **Access:** Public web UI with search and guideline modules. **No public API** — confirmed via public docs; contact info@richtlijnendatabase.nl if we need bulk. Structure is consistent enough that scraping per-guideline pages is viable, but ToS should be checked before we go wide.
- **Companion app:** "Richtlijnendatabase app" exists for clinicians — signal that mobile/responsive view is officially supported.

### 3.2 NHG Richtlijnen (Huisartsen — primary care)

Counterpart to Richtlijnendatabase for general practice.

- **URL:** https://richtlijnen.nhg.org
- **Owner:** Nederlands Huisartsen Genootschap (NHG).
- **Coverage:** NHG-Standaarden (the core product), behandelrichtlijnen, standpunten, LESA's (local first-line cooperation agreements), LTA's (national transmural agreements).
- **Access:** Public web, no API. Scraping feasible. Guideline per condition, well-structured HTML.
- **Publication:** Monthly updates surfaced via Huisarts & Wetenschap (https://www.henw.org).

### 3.3 IKNL — Oncoline & Pallialine

Oncology and palliative-care guidelines. Technically part of the Richtlijnendatabase ecosystem now, but Oncoline/Pallialine remain the branded entry points.

- **Oncoline:** oncology guidelines.
- **Pallialine:** palliative-care guidelines; growing number translated into English.
- **Entry:** https://iknl.nl/en/guidelines
- **Additional data asset:** Netherlands Cancer Registry (NCR) — epidemiology, not guidelines, but useful for contextualising guideline applicability. https://iknl.nl/en/ncr

### 3.4 Specialty-Specific Guideline Sources

- **NVAB** (occupational medicine) — https://nvab-online.nl/kennisbank
- **Trimbos** (mental health) — https://www.trimbos.nl — national institute for mental health; publishes guidelines + epidemiology.
- **NICTIZ / Zorginzicht** — https://www.zorginzicht.nl/ondersteuning/overige-bronnen-met-richtlijnen — meta-index of other Dutch guideline sources; a good starting point to discover speciality registries we haven't hit yet.
- **Nivel** — https://www.nivel.nl — research institute, often publishes the evaluation studies that feed into guideline revisions.

### 3.5 Cross-check: EU & Global Guidelines

Not in scope for MVP, but common fallbacks if a NL guideline is missing: ESMO (oncology), ESC (cardiology), EASL (hepatology), ERS (respiratory), UpToDate (paid). Worth a note in the UI: "NL guideline not available — linking EU guideline instead."

---

## 4. Cross-Cutting Notes

**Licensing.** Government and EMA data is generally free to reuse (CC-0 or equivalent). ClinicalTrials.gov and openFDA are US public domain. Professional society guidelines (Richtlijnendatabase, NHG, IKNL) are copyrighted to the issuing society — linking and excerpting is fine, wholesale copying is not. Store references and snippets, not full text.

**Update cadence summary.**
- Near-real-time: ClinicalTrials.gov, CTIS, EMA.
- Daily/overnight: EMA website tables, openFDA.
- Weekly: WHO ICTRP dumps.
- Quarterly: company pipeline pages (tied to earnings).
- As-needed: HTA decisions (monthly at most), treatment guidelines (yearly revisions typical).

**Technical posture.** Most of these have no formal API. A uniform ingest layer with three modes — (1) REST API, (2) RSS/feed, (3) scrape-with-Playwright — plus a per-source adapter pattern will cover the whole set. Cache aggressively; most sources don't need hourly freshness.

**Legal/ethical:**
- Respect `robots.txt` and ToS on every scraped source.
- Rate-limit politely (no more than ~1 req/sec per domain unless the site explicitly says otherwise).
- Store provenance (source URL, fetch timestamp, publication date) on every record — essential for HTA and guideline data where citing the exact version matters.

---

## 5. Suggested Next Steps

1. **Pick one source per module** to build a vertical slice against: probably ClinicalTrials.gov v2, ZIN pakketadvies, and NHG Standaarden. Each has different access patterns (REST / PDF-scrape / HTML-scrape), so the slice exercises the whole ingest layer.
2. **Define a common normalised schema** — drug identifier (ATC, RxNorm, or CAS), condition (ICD-10 / SNOMED), date, status, source-ref. Before writing adapters.
3. **Draft task specs in `.codex/tasks/`** for each module owner (you), one per source integration.
4. **Check ToS / robots** for every scraped source before hitting it at scale; flag any that require formal permission in `decisions.md`.
