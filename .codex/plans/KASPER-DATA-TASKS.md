# Kasper — Independent Data Curation Tasks

**Context:** We're building an R&D Pipeline + HTA Market Access intelligence product. Your job is to explore the data sources and produce clean seed data files that we'll wire into the app later. Work in the shared repo under `data/raw/`. Push early, push often.

**Rules:**
- All output goes into `data/raw/<task-name>/` in the shared repo
- Every task gets a `README.md` explaining what you did, what worked, what didn't
- JSON files should be pretty-printed (2-space indent)
- If a field is empty or unknown, use `null` — never make up data
- Commit after each task is done, not in one big lump

---

## Task 1: ClinicalTrials.gov API Explorer (days 1–3)

**Goal:** Learn the ClinicalTrials.gov API and produce sample pipeline data for oncology.

**Steps:**

1. Read the API docs: https://clinicaltrials.gov/data-api/api
2. Write a script (Node or Python, your choice) that:
   - Searches for Phase 2 and Phase 3 oncology trials from the last 2 years
   - Uses `query.cond=cancer&filter.phase=PHASE2,PHASE3&filter.overallStatus=RECRUITING,ACTIVE_NOT_RECRUITING`
   - Fetches up to 100 results
   - Saves the raw JSON response
3. Then write a second script that takes the raw response and extracts a simplified record per trial:

```json
{
  "nct_id": "NCT12345678",
  "title": "...",
  "phase": "Phase 3",
  "status": "RECRUITING",
  "sponsor": "Pfizer",
  "sponsor_class": "INDUSTRY",
  "conditions": ["Breast Cancer"],
  "interventions": [{"name": "Palbociclib", "type": "DRUG"}],
  "start_date": "2024-03-01",
  "primary_completion_date": "2026-06-01",
  "enrollment": 450,
  "countries": ["United States", "Germany", "France"]
}
```

4. Write a `README.md` documenting:
   - Which API fields are reliably populated
   - Which fields are often empty or inconsistent
   - Rate limit behavior you observed
   - Any gotchas

**Deliverables:**
- `data/raw/clinicaltrials-explore/fetch-oncology.js` (or .py)
- `data/raw/clinicaltrials-explore/transform.js` (or .py)
- `data/raw/clinicaltrials-explore/raw-response.json`
- `data/raw/clinicaltrials-explore/oncology-trials-simplified.json`
- `data/raw/clinicaltrials-explore/README.md`

---

## Task 2: NICE API Exploration (days 3–5)

**Goal:** Explore the NICE syndication API and pull technology appraisal decisions.

**Steps:**

1. Register for a NICE API key at https://www.nice.org.uk/syndication (free)
2. Read the syndication guide: https://www.nice.org.uk/corporate/ecd10
3. Write a script that:
   - Fetches technology appraisal (TA) guidance
   - Extracts: guidance ID, title, date published, date last modified, recommendation status (recommended/not recommended/optimised), URL
   - Saves as structured JSON
4. If the API doesn't give you everything, note what's missing in the README

**Deliverables:**
- `data/raw/nice-explore/fetch-ta-decisions.js` (or .py)
- `data/raw/nice-explore/ta-decisions.json`
- `data/raw/nice-explore/README.md` — document the API shape, what's available, what's missing

---

## Task 3: G-BA Decisions Scraper (days 5–7)

**Goal:** Scrape the German G-BA AMNOG benefit assessment decisions page.

**Steps:**

1. Go to https://www.g-ba.de/bewertungsverfahren/nutzenbewertung/
2. Inspect the page structure (look at the HTML table of decisions)
3. Write a scraper (Python with requests + BeautifulSoup, or Node with cheerio) that:
   - Fetches the main listing page
   - Extracts: drug name, active substance, indication, decision date, benefit rating, PDF link
   - Saves as JSON
4. Do NOT download the PDFs, just save the links
5. Note: the page is in German. That's fine — save the German text, don't try to translate

**Deliverables:**
- `data/raw/gba-explore/scrape-decisions.py` (or .js)
- `data/raw/gba-explore/gba-decisions.json`
- `data/raw/gba-explore/README.md` — document what worked, what was hard, any anti-scraping behavior

---

## Task 4: Country Pathway Curation (ongoing, parallel with above)

**Goal:** Manually research and document the HTA/market access pathway for 20 countries.

**Steps:**

1. Create a JSON file with one entry per country. Structure per country:

```json
{
  "country": "Germany",
  "iso_code": "DE",
  "income_group": "HIC",
  "has_formal_hta": true,
  "hta_bodies": [
    {
      "name": "Gemeinsamer Bundesausschuss (G-BA)",
      "abbreviation": "G-BA",
      "role": "decision",
      "website": "https://www.g-ba.de"
    },
    {
      "name": "Institut fuer Qualitaet und Wirtschaftlichkeit im Gesundheitswesen",
      "abbreviation": "IQWiG",
      "role": "assessment",
      "website": "https://www.iqwig.de"
    }
  ],
  "pathway_steps": [
    {"step": 1, "label": "Marketing Authorization (EMA centralized)", "typical_months": "12-15"},
    {"step": 2, "label": "Free pricing at launch (AMNOG)", "typical_months": "0"},
    {"step": 3, "label": "Benefit assessment dossier submission", "typical_months": "0-1"},
    {"step": 4, "label": "IQWiG assessment", "typical_months": "3"},
    {"step": 5, "label": "G-BA decision", "typical_months": "3"},
    {"step": 6, "label": "Price negotiation (GKV-SV)", "typical_months": "6"},
    {"step": 7, "label": "Negotiated price effective", "typical_months": "12"}
  ],
  "notes": "Germany is unique: free pricing at launch, mandatory assessment within 12 months. Fastest initial access in EU.",
  "sources": ["https://www.g-ba.de/english/", "https://www.iqwig.de/en/"]
}
```

2. Research these 20 countries (use HTA body websites, WHO reports, ISPOR resources):

   **EU/EEA:** UK, Germany, France, Netherlands, Sweden, Italy, Spain, Belgium
   **Other HIC:** US, Canada, Australia, Japan, South Korea, New Zealand
   **LMIC:** Thailand, Brazil, South Africa, India, Kenya, Nigeria

3. For LMICs without formal HTA, describe the actual pathway (ministry of health, WHO PQ, donor procurement, etc.)

**Deliverables:**
- `data/raw/country-pathways/pathways.json`
- `data/raw/country-pathways/README.md` — note which countries were easy vs. hard to research, which sources were most useful

---

## Task 5 (if time): WHO Essential Medicines List (bonus)

**Goal:** Convert the WHO EML into structured JSON.

1. Download the latest WHO EML from https://list.essentialmeds.org/ (or the Excel/PDF from WHO)
2. Parse it into JSON with: medicine name, ATC code, formulations, whether it's core or complementary, section/category
3. Note any medicines where the data is ambiguous

**Deliverables:**
- `data/raw/who-eml/who-eml.json`
- `data/raw/who-eml/README.md`

---

## What NOT to do

- Don't set up the project (Express, React, database). James is doing that.
- Don't install anything project-wide (no package.json changes outside your `data/raw/` folders)
- Don't touch any files outside `data/raw/`
- Don't make up data. If you can't find it, put `null` and note it in the README.
- Don't worry about code quality — working scripts that produce clean output is the goal
