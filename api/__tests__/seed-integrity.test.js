import { describe, it, expect } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SEED_DIR = path.join(__dirname, "../db/seed-json");

async function loadJSON(filename) {
  const raw = await fs.readFile(path.join(SEED_DIR, filename), "utf-8");
  return JSON.parse(raw);
}

describe("Seed data integrity", () => {
  let sponsors, assets, htaBodies, countrySystems;

  // Load all seed files once
  it("loads all seed JSON files without error", async () => {
    sponsors = await loadJSON("sponsors.json");
    assets = await loadJSON("assets.json");
    htaBodies = await loadJSON("hta-bodies.json");
    countrySystems = await loadJSON("country-systems.json");

    expect(sponsors.length).toBeGreaterThan(0);
    expect(assets.length).toBeGreaterThan(0);
    expect(htaBodies.length).toBeGreaterThan(0);
    expect(countrySystems.countries.length).toBeGreaterThan(0);
    expect(countrySystems.pathways.length).toBeGreaterThan(0);
  });

  describe("Sponsors", () => {
    it("every sponsor has slug and name", async () => {
      if (!sponsors) sponsors = await loadJSON("sponsors.json");
      for (const s of sponsors) {
        expect(s.slug, `Sponsor missing slug: ${JSON.stringify(s)}`).toBeTruthy();
        expect(s.name, `Sponsor missing name: ${s.slug}`).toBeTruthy();
      }
    });

    it("slugs are unique", async () => {
      if (!sponsors) sponsors = await loadJSON("sponsors.json");
      const slugs = sponsors.map((s) => s.slug);
      expect(new Set(slugs).size).toBe(slugs.length);
    });
  });

  describe("Assets", () => {
    it("every asset has slug, name, and valid sponsor_slug", async () => {
      if (!sponsors) sponsors = await loadJSON("sponsors.json");
      if (!assets) assets = await loadJSON("assets.json");
      const sponsorSlugs = new Set(sponsors.map((s) => s.slug));

      for (const a of assets) {
        expect(a.slug, `Asset missing slug`).toBeTruthy();
        expect(a.name, `Asset ${a.slug} missing name`).toBeTruthy();
        expect(
          sponsorSlugs.has(a.sponsor_slug),
          `Asset ${a.slug} references unknown sponsor "${a.sponsor_slug}"`
        ).toBe(true);
      }
    });

    it("slugs are unique", async () => {
      if (!assets) assets = await loadJSON("assets.json");
      const slugs = assets.map((a) => a.slug);
      expect(new Set(slugs).size).toBe(slugs.length);
    });
  });

  describe("HTA bodies", () => {
    it("every body has slug, name, and country_iso", async () => {
      if (!htaBodies) htaBodies = await loadJSON("hta-bodies.json");
      for (const b of htaBodies) {
        expect(b.slug, `HTA body missing slug`).toBeTruthy();
        expect(b.name, `HTA body ${b.slug} missing name`).toBeTruthy();
        expect(b.country_iso, `HTA body ${b.slug} missing country_iso`).toBeTruthy();
      }
    });

    it("country_iso values exist in country-systems", async () => {
      if (!htaBodies) htaBodies = await loadJSON("hta-bodies.json");
      if (!countrySystems) countrySystems = await loadJSON("country-systems.json");
      const countryIsos = new Set(countrySystems.countries.map((c) => c.country_iso));

      for (const b of htaBodies) {
        expect(
          countryIsos.has(b.country_iso),
          `HTA body ${b.slug} has country_iso "${b.country_iso}" not in country-systems`
        ).toBe(true);
      }
    });
  });

  describe("Country systems", () => {
    it("every country has country_iso and country_name", async () => {
      if (!countrySystems) countrySystems = await loadJSON("country-systems.json");
      for (const c of countrySystems.countries) {
        expect(c.country_iso, `Country missing ISO`).toBeTruthy();
        expect(c.country_name, `Country ${c.country_iso} missing name`).toBeTruthy();
      }
    });

    it("every country has a source_url", async () => {
      if (!countrySystems) countrySystems = await loadJSON("country-systems.json");
      for (const c of countrySystems.countries) {
        expect(
          c.source_url,
          `Country ${c.country_iso} missing source_url`
        ).toBeTruthy();
      }
    });
  });

  describe("Pathway steps", () => {
    it("every pathway has sequential step_order with no gaps", async () => {
      if (!countrySystems) countrySystems = await loadJSON("country-systems.json");

      for (const pw of countrySystems.pathways) {
        const orders = pw.steps.map((s) => s.step_order).sort((a, b) => a - b);
        for (let i = 0; i < orders.length; i++) {
          expect(
            orders[i],
            `Pathway ${pw.country_iso}: expected step ${i + 1} but found ${orders[i]}`
          ).toBe(i + 1);
        }
      }
    });

    it("every pathway step has a source_url", async () => {
      if (!countrySystems) countrySystems = await loadJSON("country-systems.json");

      for (const pw of countrySystems.pathways) {
        for (const step of pw.steps) {
          expect(
            step.source_url,
            `Pathway ${pw.country_iso} step ${step.step_order} (${step.label}) missing source_url`
          ).toBeTruthy();
        }
      }
    });

    it("pathway country_iso values match countries list", async () => {
      if (!countrySystems) countrySystems = await loadJSON("country-systems.json");
      const countryIsos = new Set(countrySystems.countries.map((c) => c.country_iso));

      for (const pw of countrySystems.pathways) {
        expect(
          countryIsos.has(pw.country_iso),
          `Pathway for ${pw.country_iso} has no matching country`
        ).toBe(true);
      }
    });
  });
});
