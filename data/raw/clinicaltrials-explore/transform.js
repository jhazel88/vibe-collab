#!/usr/bin/env node
/**
 * Task 1 — ClinicalTrials.gov API Explorer
 * transform.js
 *
 * Reads raw-response.json (produced by fetch-oncology.js) and writes
 * oncology-trials-simplified.json in the shape the brief asked for:
 *
 *   {
 *     nct_id, title, phase, status, sponsor, sponsor_class,
 *     conditions[], interventions[{name,type}], start_date,
 *     primary_completion_date, enrollment, countries[]
 *   }
 *
 * Null is used for missing fields (per James's rule: never make up data).
 */

import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const IN_FILE = path.join(__dirname, 'raw-response.json')
const OUT_FILE = path.join(__dirname, 'oncology-trials-simplified.json')

const raw = JSON.parse(await fs.readFile(IN_FILE, 'utf8'))
const studies = raw.studies ?? []

console.log(`→ Transforming ${studies.length} studies`)

// v2 API returns each study as a nested structure:
//   { protocolSection: { identificationModule, statusModule, sponsorCollaboratorsModule,
//                        conditionsModule, designModule, armsInterventionsModule,
//                        contactsLocationsModule, ... } }
// We only reach into the parts we actually need.

function str(value) {
  if (value == null) return null
  if (typeof value === 'string') return value.trim() || null
  return String(value)
}

function firstDate(module, key) {
  // Dates come back as { date: 'YYYY-MM-DD', type: 'ACTUAL'|'ESTIMATED' }
  // or sometimes just 'YYYY-MM' for imprecise ones.
  const entry = module?.[key]
  if (!entry) return null
  if (typeof entry === 'string') return entry
  return entry.date ?? null
}

function transform(study) {
  const p = study.protocolSection ?? {}
  const id = p.identificationModule ?? {}
  const status = p.statusModule ?? {}
  const sponsor = p.sponsorCollaboratorsModule ?? {}
  const conditions = p.conditionsModule ?? {}
  const design = p.designModule ?? {}
  const arms = p.armsInterventionsModule ?? {}
  const contacts = p.contactsLocationsModule ?? {}

  const phases = design.phases ?? [] // e.g. ["PHASE2"] or ["PHASE1","PHASE2"]
  const phaseLabel = phases.length > 0
    ? phases.map(p => p.replace('PHASE', 'Phase ')).join('/')
    : null

  const interventions = (arms.interventions ?? []).map(i => ({
    name: str(i.name),
    type: str(i.type),
  }))

  const countrySet = new Set(
    (contacts.locations ?? [])
      .map(l => str(l.country))
      .filter(Boolean)
  )

  return {
    nct_id: str(id.nctId),
    title: str(id.briefTitle) ?? str(id.officialTitle),
    phase: phaseLabel,
    status: str(status.overallStatus),
    sponsor: str(sponsor.leadSponsor?.name),
    sponsor_class: str(sponsor.leadSponsor?.class),
    conditions: (conditions.conditions ?? []).map(str).filter(Boolean),
    interventions,
    start_date: firstDate(status, 'startDateStruct'),
    primary_completion_date: firstDate(status, 'primaryCompletionDateStruct'),
    enrollment: design.enrollmentInfo?.count ?? null,
    countries: [...countrySet].sort(),
  }
}

const simplified = studies.map(transform)

await fs.writeFile(OUT_FILE, JSON.stringify(simplified, null, 2))
console.log(`✓ Wrote ${OUT_FILE} (${simplified.length} records)`)

// Quick sanity summary printed to stdout for the README "what we saw" section.
const counts = simplified.reduce((acc, t) => {
  acc[t.status ?? 'null'] = (acc[t.status ?? 'null'] ?? 0) + 1
  return acc
}, {})
console.log('Status breakdown:', counts)
const nullFields = ['phase', 'sponsor', 'start_date', 'primary_completion_date', 'enrollment']
  .map(f => ({ f, nulls: simplified.filter(t => t[f] == null).length }))
console.log('Null counts:', nullFields)
