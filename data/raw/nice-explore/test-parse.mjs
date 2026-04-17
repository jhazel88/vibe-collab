// Fixture-based smoke test for the NICE syndication parser.
//
// Exercises parseFeedEntries, classifyRecommendation, and isoDate against
// a synthetic Atom feed that mirrors NICE's published shape. Catches
// obvious bugs before Kasper burns API calls on the live service.
//
// Run: node test-parse.mjs
// Exits 0 on pass, 1 on fail.

import {
  parseFeedEntries,
  classifyRecommendation,
  isoDate,
} from "./fetch-ta-decisions.js";

// ── Atom fixture ──────────────────────────────────────────────────────────
//
// Three entries covering the main recommendation outcomes + a next-page
// link. Titles include the TA-number format NICE uses (e.g. TA812) so
// the guidance_id extractor has something to match.

const feedFixture = `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>NICE Technology Appraisals</title>
  <updated>2025-03-20T09:00:00Z</updated>
  <link rel="self" href="https://api.nice.org.uk/services/TA"/>
  <link rel="next" href="https://api.nice.org.uk/services/TA?page=2"/>
  <entry>
    <id>https://www.nice.org.uk/guidance/ta812</id>
    <title>Pembrolizumab for adjuvant treatment of renal cell carcinoma (TA812)</title>
    <updated>2025-03-15T12:00:00Z</updated>
    <published>2024-11-02T00:00:00Z</published>
    <link rel="alternate" href="https://www.nice.org.uk/guidance/ta812"/>
    <summary>Pembrolizumab is recommended as an option for adjuvant treatment of renal cell carcinoma in adults.</summary>
  </entry>
  <entry>
    <id>https://www.nice.org.uk/guidance/ta799</id>
    <title>Futurabin for diffuse large B-cell lymphoma (TA799)</title>
    <updated>2025-02-10T00:00:00Z</updated>
    <published>2025-02-10T00:00:00Z</published>
    <link rel="alternate" href="https://www.nice.org.uk/guidance/ta799"/>
    <summary>Futurabin is not recommended for treating diffuse large B-cell lymphoma in adults.</summary>
  </entry>
  <entry>
    <id>https://www.nice.org.uk/guidance/ta755</id>
    <title>Ribociclib for HR-positive early breast cancer (TA755)</title>
    <updated>2025-01-08T00:00:00Z</updated>
    <published>2025-01-08T00:00:00Z</published>
    <link rel="alternate" href="https://www.nice.org.uk/guidance/ta755"/>
    <summary>Ribociclib is recommended, with restrictions — only recommended for a subset of patients.</summary>
  </entry>
</feed>`;

// ── Run ───────────────────────────────────────────────────────────────────

let failed = 0;
function expect(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${label}  (got: ${JSON.stringify(actual)})`);
  if (!ok) failed++;
}

const { entries, nextLink } = parseFeedEntries(feedFixture);

// Top-level shape
expect("3 entries parsed", entries.length, 3);
expect(
  "next-page link resolved",
  nextLink,
  "https://api.nice.org.uk/services/TA?page=2",
);

// Entry 0 — recommended
expect("entry 0 guidance id", entries[0].guidance_id, "TA812");
expect(
  "entry 0 title",
  entries[0].title,
  "Pembrolizumab for adjuvant treatment of renal cell carcinoma (TA812)",
);
expect("entry 0 date_published", entries[0].date_published, "2024-11-02");
expect("entry 0 date_last_modified", entries[0].date_last_modified, "2025-03-15");
expect("entry 0 recommendation", entries[0].recommendation, "recommended");
expect("entry 0 url", entries[0].url, "https://www.nice.org.uk/guidance/ta812");

// Entry 1 — not recommended (must beat "recommended")
expect("entry 1 guidance id", entries[1].guidance_id, "TA799");
expect("entry 1 recommendation", entries[1].recommendation, "not_recommended");

// Entry 2 — optimised / restricted
expect("entry 2 guidance id", entries[2].guidance_id, "TA755");
expect("entry 2 recommendation", entries[2].recommendation, "optimised");

// classifyRecommendation direct
expect(
  "classify: plain recommended",
  classifyRecommendation("NICE recommends this treatment"),
  "recommended",
);
expect(
  "classify: not recommended",
  classifyRecommendation("NICE does not recommend the drug"),
  "not_recommended",
);
expect(
  "classify: only in research",
  classifyRecommendation("Use only in the context of research"),
  "only_in_research",
);
expect(
  "classify: terminated",
  classifyRecommendation("Appraisal terminated due to non-submission"),
  "terminated",
);
expect("classify: null for unrelated", classifyRecommendation("Stellungnahme wird veröffentlicht"), null);

// isoDate direct
expect("isoDate full ISO", isoDate("2025-03-15T12:00:00Z"), "2025-03-15");
expect("isoDate date-only", isoDate("2024-11-02"), "2024-11-02");
expect("isoDate empty", isoDate(null), null);
expect("isoDate junk", isoDate("not-a-date"), null);

console.log(`\n${failed === 0 ? "ALL OK" : `${failed} FAILED`}`);
process.exit(failed === 0 ? 0 : 1);
