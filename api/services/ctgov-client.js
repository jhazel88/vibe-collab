// ═══════════════════════════════════════════════════════════════════════════
// ClinicalTrials.gov API v2 Client
//
// Wraps the public REST API at clinicaltrials.gov/api/v2/studies.
// Handles pagination, rate limiting (~10 req/sec), field selection.
//
// API docs: https://clinicaltrials.gov/data-api/api
// ═══════════════════════════════════════════════════════════════════════════

const BASE_URL = "https://clinicaltrials.gov/api/v2/studies";

// Fields we actually need — keep the payload small
const DEFAULT_FIELDS = [
  "NCTId",
  "BriefTitle",
  "OfficialTitle",
  "OverallStatus",
  "Phase",
  "StudyType",
  "EnrollmentCount",
  "StartDate",
  "PrimaryCompletionDate",
  "CompletionDate",
  "LeadSponsorName",
  "LeadSponsorClass",
  "Condition",
  "InterventionName",
  "InterventionType",
  "LocationCountry",
  "ResultsFirstSubmitDate",
  "HasResults",
].join("|");

const RATE_LIMIT_MS = 110; // ~9 req/sec, stays under 10/sec limit

/**
 * Sleep helper for rate limiting
 */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Build the query URL for a single page.
 *
 * @param {object} opts
 * @param {string} opts.condition   - Condition/disease filter (e.g. "cancer")
 * @param {string} opts.phase       - Phase filter (e.g. "PHASE2|PHASE3")
 * @param {string} opts.dateRange   - Posted date range filter "MM/DD/YYYY,MM/DD/YYYY"
 * @param {string} opts.sponsorType - Lead sponsor class filter (e.g. "INDUSTRY")
 * @param {number} opts.pageSize    - Results per page (max 1000, default 100)
 * @param {string} opts.pageToken   - Next page token from previous response
 * @param {string} opts.fields      - Pipe-separated field list
 * @returns {string}
 */
function buildURL(opts = {}) {
  const params = new URLSearchParams();

  // Query filter — uses the AREA[] syntax
  const queryParts = [];
  if (opts.condition) {
    queryParts.push(`AREA[Condition]${opts.condition}`);
  }
  if (opts.phase) {
    queryParts.push(`AREA[Phase](${opts.phase})`);
  }
  if (opts.sponsorType) {
    queryParts.push(`AREA[LeadSponsorClass]${opts.sponsorType}`);
  }

  if (queryParts.length) {
    params.set("query.term", queryParts.join(" AND "));
  }

  if (opts.dateRange) {
    params.set("filter.advanced", `AREA[StartDate]RANGE[${opts.dateRange}]`);
  }

  params.set("pageSize", String(opts.pageSize || 100));
  params.set("fields", opts.fields || DEFAULT_FIELDS);
  params.set("format", "json");

  if (opts.pageToken) {
    params.set("pageToken", opts.pageToken);
  }

  return `${BASE_URL}?${params.toString()}`;
}

/**
 * Fetch a single page of results from ClinicalTrials.gov.
 *
 * @param {object} opts - Same options as buildURL
 * @returns {Promise<{studies: object[], nextPageToken: string|null, totalCount: number}>}
 */
export async function fetchPage(opts = {}) {
  const url = buildURL(opts);

  const res = await fetch(url, {
    headers: {
      Accept: "application/json",
      "User-Agent": "HTA-Market-Access-Tracker/0.1 (research; contact: jhazel.3@gmail.com)",
    },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`ClinicalTrials.gov API error ${res.status}: ${body.slice(0, 200)}`);
  }

  const data = await res.json();

  return {
    studies: data.studies || [],
    nextPageToken: data.nextPageToken || null,
    totalCount: data.totalCount || 0,
  };
}

/**
 * Fetch ALL pages for a given query, respecting rate limits.
 * Yields pages as they arrive for memory-efficient processing.
 *
 * @param {object} opts - Same options as fetchPage (minus pageToken)
 * @param {number} [maxPages=50] - Safety cap on pages to fetch
 * @returns {AsyncGenerator<{studies: object[], page: number, totalCount: number}>}
 */
export async function* fetchAll(opts = {}, maxPages = 50) {
  let pageToken = null;
  let page = 0;

  do {
    const result = await fetchPage({ ...opts, pageToken });
    page++;

    yield {
      studies: result.studies,
      page,
      totalCount: result.totalCount,
    };

    pageToken = result.nextPageToken;

    if (pageToken && page < maxPages) {
      await sleep(RATE_LIMIT_MS);
    }
  } while (pageToken && page < maxPages);

  if (pageToken) {
    console.warn(`[ctgov] Stopped after ${maxPages} pages — more results available`);
  }
}

/**
 * Convenience: fetch all studies for a query and return as a flat array.
 * Use fetchAll() generator for large result sets.
 *
 * @param {object} opts
 * @param {number} [maxPages=50]
 * @returns {Promise<{studies: object[], totalCount: number}>}
 */
export async function fetchAllFlat(opts = {}, maxPages = 50) {
  const allStudies = [];
  let totalCount = 0;

  for await (const page of fetchAll(opts, maxPages)) {
    allStudies.push(...page.studies);
    totalCount = page.totalCount;
  }

  return { studies: allStudies, totalCount };
}
