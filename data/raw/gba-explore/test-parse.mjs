// Fixture-based smoke test for the G-BA scraper.
//
// Exercises selector candidates, extractRow, parseGermanDate,
// classifyRating, and findNextLink against a synthetic but plausible
// G-BA listing + detail page. Catches obvious bugs before Kasper
// burns HTTP requests on the live site.
//
// Run: node test-parse.mjs
// Exits 0 on pass, 1 on fail.

import * as cheerio from "cheerio";
import {
  extractRow,
  findListingRows,
  parseGermanDate,
  classifyRating,
  findNextLink,
} from "./scrape-decisions.js";

// ── Listing fixture ───────────────────────────────────────────────────────
//
// Mirrors a plausible TYPO3-rendered G-BA listing: <ul class="teaser-list">
// with <li> rows, each showing drug name as the anchor text, labelled
// Wirkstoff / Beschluss fields, and a PDF link.

const listingFixture = `
<!doctype html>
<html lang="de">
<body>
  <main>
    <ul class="teaser-list">
      <li>
        <h3><a href="/bewertungsverfahren/nutzenbewertung/1234/">Pembrolizumab (Keytruda) - Melanom</a></h3>
        <dl>
          <dt>Wirkstoff</dt><dd>Pembrolizumab</dd>
          <dt>Anwendungsgebiet</dt><dd>Fortgeschrittenes Melanom</dd>
          <dt>Beschluss</dt><dd>15.03.2025</dd>
        </dl>
        <a href="/downloads/39-261-1234/2025-03-15_Beschluss_Pembrolizumab.pdf">PDF</a>
      </li>
      <li>
        <h3><a href="/bewertungsverfahren/nutzenbewertung/1235/">Futurabin (Futurix) - DLBCL</a></h3>
        <dl>
          <dt>Wirkstoff</dt><dd>Futurabin</dd>
          <dt>Anwendungsgebiet</dt><dd>Diffus grosszelliges B-Zell-Lymphom</dd>
          <dt>Beschluss</dt><dd>22. Februar 2025</dd>
        </dl>
        <a href="/downloads/39-261-1235/2025-02-22_Beschluss_Futurabin.pdf">PDF</a>
      </li>
      <li>
        <h3><a href="/bewertungsverfahren/nutzenbewertung/1236/">Ribociclib - Mammakarzinom</a></h3>
        <dl>
          <dt>Wirkstoff</dt><dd>Ribociclib</dd>
          <dt>Anwendungsgebiet</dt><dd>HR+/HER2- Mammakarzinom</dd>
          <dt>Beschluss</dt><dd>08.01.2025</dd>
        </dl>
      </li>
    </ul>
    <nav class="pagination">
      <a class="pagination-next" href="/bewertungsverfahren/nutzenbewertung/?page=2">Weiter</a>
    </nav>
  </main>
</body>
</html>`;

// ── Detail-page fixtures ──────────────────────────────────────────────────

const detailRecommended = `
<main>
  <h1>Beschluss zu Pembrolizumab</h1>
  <p>Der G-BA hat einen beträchtlichen Zusatznutzen festgestellt gegenüber der zweckmäßigen Vergleichstherapie.</p>
</main>`;

const detailNotRecommended = `
<main>
  <h1>Beschluss zu Futurabin</h1>
  <p>Ein Zusatznutzen von Futurabin ist nicht belegt (kein Zusatznutzen).</p>
</main>`;

const detailSubstantial = `
<main>
  <h1>Beschluss zu Ribociclib</h1>
  <p>Der Zusatznutzen wird als geringer Zusatznutzen bewertet.</p>
</main>`;

const detailUnknown = `
<main>
  <h1>Beschluss zu Drug X</h1>
  <p>Die Stellungnahme wird veröffentlicht.</p>
</main>`;

// ── Run ───────────────────────────────────────────────────────────────────

const $ = cheerio.load(listingFixture);
const { candidate, $rows } = findListingRows($);

let failed = 0;
function expect(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${label}  (got: ${JSON.stringify(actual)})`);
  if (!ok) failed++;
}

// Listing-level
expect("listing selector matched", candidate?.container, "ul.teaser-list");
expect("3 rows found", $rows.length, 3);

const rows = $rows.toArray().map((el) => extractRow($, el));

// Row 0
expect("row 0 drug name", rows[0].drug_name, "Pembrolizumab (Keytruda) - Melanom");
expect("row 0 active substance", rows[0].active_substance, "Pembrolizumab");
expect("row 0 indication", rows[0].indication, "Fortgeschrittenes Melanom");
expect("row 0 decision date parsed", rows[0].decision_date, "2025-03-15");
expect(
  "row 0 detail url absolute",
  rows[0].detail_url,
  "https://www.g-ba.de/bewertungsverfahren/nutzenbewertung/1234/",
);
expect(
  "row 0 pdf url absolute",
  rows[0].pdf_url,
  "https://www.g-ba.de/downloads/39-261-1234/2025-03-15_Beschluss_Pembrolizumab.pdf",
);

// Row 1 — German month-name date
expect("row 1 named-month date parsed", rows[1].decision_date, "2025-02-22");

// Row 2 — no PDF link present
expect("row 2 pdf null when absent", rows[2].pdf_url, null);

// Next-page link
const next = findNextLink($, "https://www.g-ba.de/bewertungsverfahren/nutzenbewertung/");
expect(
  "next page link resolved",
  next,
  "https://www.g-ba.de/bewertungsverfahren/nutzenbewertung/?page=2",
);

// Rating classifier
expect("rating: beträchtlich", classifyRating(detailRecommended), "beträchtlich");
expect("rating: kein", classifyRating(detailNotRecommended), "kein");
expect("rating: gering", classifyRating(detailSubstantial), "gering");
expect("rating: null for unknown", classifyRating(detailUnknown), null);

// parseGermanDate direct
expect("parseGermanDate DD.MM.YYYY", parseGermanDate("15.03.2025"), "2025-03-15");
expect("parseGermanDate DD. Month YYYY", parseGermanDate("22. Februar 2025"), "2025-02-22");
expect("parseGermanDate ISO pass-through", parseGermanDate("2024-12-01"), "2024-12-01");
expect("parseGermanDate null for junk", parseGermanDate("keine Angabe"), null);

console.log(`\n${failed === 0 ? "ALL OK" : `${failed} FAILED`}`);
process.exit(failed === 0 ? 0 : 1);
