// ═══════════════════════════════════════════════════════════════════════════
// Intent Classifier
//
// Regex-based classification of user queries into intent categories.
// Determines which retrieval lanes to activate.
//
// Intents:
//   sponsor_lookup    — questions about a specific company
//   trial_search      — questions about clinical trials
//   pathway_question  — questions about market access / HTA pathways
//   comparison        — comparing countries, sponsors, or assets
//   general           — general HTA knowledge questions
// ═══════════════════════════════════════════════════════════════════════════

const INTENT_PATTERNS = [
  {
    intent: "sponsor_lookup",
    patterns: [
      /\b(who is|about|tell me about|what does)\b.*\b(compan|pharma|sponsor|manufacturer|biotech)/i,
      /\b(pfizer|roche|novartis|sanofi|merck|astrazeneca|johnson|abbvie|amgen|bms|bristol|lilly|gsk|bayer|gilead|takeda|novo nordisk|regeneron|biogen|moderna)\b/i,
      /\b(pipeline|portfolio|therapeutic areas?|headquarters)\b/i,
      /\b(sponsor|company|manufacturer)\b.*(detail|info|profile|overview)/i,
    ],
    lanes: ["sponsor_lane"],
  },
  {
    intent: "trial_search",
    patterns: [
      /\b(trial|clinical trial|study|studies|nct\d|phase\s*[123]|phase\s*(i|ii|iii))\b/i,
      /\b(recruiting|enrollment|enrol|efficacy|endpoint|primary completion)\b/i,
      /\b(randomized|randomised|double.blind|placebo.controlled|open.label)\b/i,
      /\b(intervention|arm|cohort)\b.*\b(trial|study)/i,
    ],
    lanes: ["trial_lane"],
  },
  {
    intent: "pathway_question",
    patterns: [
      /\b(pathway|market access|hta|reimbursement|pricing|formulary)\b/i,
      /\b(nice|g-ba|iqwig|has|ceps|smc|amnog|asmr|smr)\b/i,
      /\b(appraisal|assessment|submission|dossier|benefit rating)\b/i,
      /\b(how (long|many steps)|timeline|process|procedure)\b.*\b(approv|access|reimburse|market)/i,
      /\b(gate|blocker|bottle.?neck)\b.*\b(pathway|access|approval)/i,
    ],
    lanes: ["country_pathway_lane"],
  },
  {
    intent: "comparison",
    patterns: [
      /\b(compar|versus|vs\.?|differ|between)\b/i,
      /\b(which country|which market|faster|slower|easier|harder)\b.*\b(access|approv|reimburse)/i,
      /\b(uk|germany|france|gb|de|fr)\b.*\b(vs|versus|compared to|and)\b.*\b(uk|germany|france|gb|de|fr)\b/i,
    ],
    lanes: ["country_pathway_lane", "sponsor_lane"],
  },
];

const DEFAULT_INTENT = {
  intent: "general",
  lanes: ["sponsor_lane", "trial_lane", "country_pathway_lane"],
};

/**
 * Classify a user query into an intent with associated retrieval lanes.
 *
 * @param {string} query - The user's message
 * @returns {{ intent: string, lanes: string[], confidence: "high"|"medium"|"low" }}
 */
export function classifyIntent(query) {
  if (!query || typeof query !== "string") {
    return { ...DEFAULT_INTENT, confidence: "low" };
  }

  const text = query.trim();

  // Try each intent group
  for (const group of INTENT_PATTERNS) {
    const matchCount = group.patterns.filter((p) => p.test(text)).length;
    if (matchCount >= 2) {
      return { intent: group.intent, lanes: group.lanes, confidence: "high" };
    }
    if (matchCount === 1) {
      return { intent: group.intent, lanes: group.lanes, confidence: "medium" };
    }
  }

  // No strong match — activate all lanes with low confidence
  return { ...DEFAULT_INTENT, confidence: "low" };
}

/**
 * Extract entity hints from the query (sponsor names, NCT IDs, country codes).
 * Used by retrieval lanes to narrow their DB queries.
 *
 * @param {string} query
 * @returns {{ sponsors: string[], nctIds: string[], countries: string[] }}
 */
export function extractEntities(query) {
  if (!query) return { sponsors: [], nctIds: [], countries: [] };

  const text = query.trim();

  // NCT IDs
  const nctIds = [...text.matchAll(/NCT\d{7,8}/gi)].map((m) => m[0].toUpperCase());

  // Country codes / names → ISO
  const countryMap = {
    uk: "GB", "united kingdom": "GB", britain: "GB", england: "GB",
    germany: "DE", deutschland: "DE",
    france: "FR",
  };

  const countries = [];
  // Check explicit ISO codes
  const isoMatches = [...text.matchAll(/\b(GB|DE|FR)\b/g)];
  for (const m of isoMatches) countries.push(m[1]);
  // Check country names
  for (const [name, iso] of Object.entries(countryMap)) {
    if (text.toLowerCase().includes(name) && !countries.includes(iso)) {
      countries.push(iso);
    }
  }

  return { sponsors: [], nctIds, countries: [...new Set(countries)] };
}
