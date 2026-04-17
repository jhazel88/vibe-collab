// Sanity-check pathways.json: parses, required fields present, 20 countries,
// unique ISO codes, typical_months strings (not numbers), income_group valid.
//
// Run: node validate.mjs

import { readFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const raw = await readFile(resolve(__dirname, "pathways.json"), "utf8");

let data;
try {
  data = JSON.parse(raw);
} catch (err) {
  console.error("FAIL: JSON.parse failed —", err.message);
  process.exit(1);
}

let failed = 0;
function check(label, cond, info = "") {
  const ok = !!cond;
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${label}${info ? "  " + info : ""}`);
  if (!ok) failed++;
}

check("root is array", Array.isArray(data));
check("exactly 20 countries", data.length === 20, `(got ${data.length})`);

const validIncome = new Set(["HIC", "UMIC", "LMIC", "LIC"]);
const validRoles = new Set(["assessment", "decision", "payer", "regulator", "advisory"]);
const isoSeen = new Set();
const requiredTopKeys = [
  "country",
  "iso_code",
  "income_group",
  "has_formal_hta",
  "hta_bodies",
  "pathway_steps",
  "notes",
  "sources",
];

let rowIdx = 0;
for (const row of data) {
  const ctx = `[${rowIdx}] ${row.country || "?"}`;
  for (const k of requiredTopKeys) {
    check(`${ctx} has key '${k}'`, k in row);
  }
  check(`${ctx} iso_code length 2`, typeof row.iso_code === "string" && row.iso_code.length === 2);
  check(`${ctx} iso unique`, !isoSeen.has(row.iso_code), `(${row.iso_code})`);
  isoSeen.add(row.iso_code);
  check(`${ctx} income_group valid`, validIncome.has(row.income_group), `(${row.income_group})`);
  check(`${ctx} has_formal_hta is boolean`, typeof row.has_formal_hta === "boolean");
  check(`${ctx} hta_bodies non-empty array`, Array.isArray(row.hta_bodies) && row.hta_bodies.length > 0);
  for (const [i, body] of (row.hta_bodies || []).entries()) {
    check(
      `${ctx} hta_bodies[${i}] role valid`,
      validRoles.has(body.role),
      `(${body.role})`,
    );
    check(
      `${ctx} hta_bodies[${i}] name string`,
      typeof body.name === "string" && body.name.length > 0,
    );
    check(
      `${ctx} hta_bodies[${i}] website https`,
      typeof body.website === "string" && body.website.startsWith("https://"),
    );
  }
  check(`${ctx} pathway_steps non-empty array`, Array.isArray(row.pathway_steps) && row.pathway_steps.length > 0);
  for (const [i, step] of (row.pathway_steps || []).entries()) {
    check(`${ctx} step[${i}] has step number`, typeof step.step === "number");
    check(`${ctx} step[${i}] has label`, typeof step.label === "string" && step.label.length > 0);
    check(
      `${ctx} step[${i}] typical_months is string-or-null`,
      step.typical_months === null || typeof step.typical_months === "string",
      `(got ${JSON.stringify(step.typical_months)})`,
    );
  }
  check(`${ctx} notes is string`, typeof row.notes === "string" && row.notes.length > 0);
  check(`${ctx} sources non-empty array of https`, Array.isArray(row.sources) && row.sources.every((s) => typeof s === "string" && s.startsWith("https://")));
  rowIdx++;
}

// Distribution checks
const byIncome = data.reduce((acc, r) => {
  acc[r.income_group] = (acc[r.income_group] || 0) + 1;
  return acc;
}, {});
console.log("\n  income_group distribution:", byIncome);
check("HIC count 14", byIncome.HIC === 14, `(got ${byIncome.HIC})`);
check("UMIC count 3", byIncome.UMIC === 3, `(got ${byIncome.UMIC})`);
check("LMIC count 3", byIncome.LMIC === 3, `(got ${byIncome.LMIC})`);

const hasHta = data.filter((r) => r.has_formal_hta).length;
const noHta = data.length - hasHta;
console.log(`  has_formal_hta: ${hasHta} yes, ${noHta} no`);

console.log(`\n${failed === 0 ? "ALL OK" : `${failed} FAILED`}`);
process.exit(failed === 0 ? 0 : 1);
