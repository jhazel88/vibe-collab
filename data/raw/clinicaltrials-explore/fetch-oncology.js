#!/usr/bin/env node
/**
 * Task 1 — ClinicalTrials.gov API Explorer
 * fetch-oncology.js
 *
 * Fetches Phase 2 and Phase 3 oncology trials that are currently recruiting or
 * active-not-recruiting, using the ClinicalTrials.gov v2 REST API.
 *
 * Output: raw-response.json  (verbatim JSON returned by the API)
 *
 * Usage:
 *   node fetch-oncology.js [pageSize]
 *
 * Notes:
 * - No auth required. v2 API is free and keyless.
 * - Default pageSize 100 (the brief asked for up to 100 results).
 * - The v2 endpoint is GET /api/v2/studies?<query params>
 * - See https://clinicaltrials.gov/data-api/api for the full param reference.
 */

import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const BASE_URL = 'https://clinicaltrials.gov/api/v2/studies'
const OUT_FILE = path.join(__dirname, 'raw-response.json')

const pageSize = Number(process.argv[2] ?? 100)

const params = new URLSearchParams({
  // Condition filter: cancer (fuzzy MeSH match)
  'query.cond': 'cancer',
  // Compound advanced filter — phase AND last-updated window.
  // v2 only accepts ONE filter.advanced param; combine with AND inside.
  'filter.advanced':
    'AREA[Phase](PHASE2 OR PHASE3) AND AREA[LastUpdatePostDate]RANGE[2024-04-01,MAX]',
  // Status filter: recruiting or active-not-recruiting (comma-separated = OR)
  'filter.overallStatus': 'RECRUITING,ACTIVE_NOT_RECRUITING',
  pageSize: String(pageSize),
  format: 'json',
  // Explicit field selection keeps payload size manageable and makes the
  // transform step deterministic. Leaving this off gives you EVERYTHING
  // (protocol + results + annotations + derived). We do that in a second run.
  fields: [
    'NCTId',
    'BriefTitle',
    'OfficialTitle',
    'Phase',
    'OverallStatus',
    'LeadSponsorName',
    'LeadSponsorClass',
    'Condition',
    'InterventionName',
    'InterventionType',
    'StartDate',
    'PrimaryCompletionDate',
    'EnrollmentCount',
    'LocationCountry',
    'StudyType',
    'LastUpdatePostDate',
  ].join('|'),
})

// NOTE: the v2 API uses AREA[...]  expressions for typed filters.
// The `query.cond=cancer` param uses the cond-term parser (fuzzy match + MeSH).
// Docs: https://clinicaltrials.gov/data-api/about-api/search-areas
const url = `${BASE_URL}?${params.toString()}`

console.log(`→ Fetching ${url}`)

const res = await fetch(url, {
  headers: { 'User-Agent': 'vibe-collab/0.0 (kasperblom@gmail.com)' },
})

if (!res.ok) {
  console.error(`HTTP ${res.status} ${res.statusText}`)
  console.error(await res.text())
  process.exit(1)
}

const data = await res.json()

console.log(`✓ Fetched ${data.studies?.length ?? 0} studies`)
console.log(`  totalCount: ${data.totalCount ?? '(not returned)'}`)
if (data.nextPageToken) {
  console.log(`  nextPageToken: ${data.nextPageToken}  (pagination available)`)
}

await fs.writeFile(OUT_FILE, JSON.stringify(data, null, 2))
console.log(`✓ Wrote ${OUT_FILE}`)
