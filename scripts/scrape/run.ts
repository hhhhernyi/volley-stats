/**
 * run.ts — CLI entry point for the SuperLega scraper.
 *
 * Usage:
 *   npx tsx scripts/scrape/run.ts --phase fetch [--season 2024-2025] [--force-refresh]
 *   npx tsx scripts/scrape/run.ts --phase parse [--season 2024-2025]
 *   npx tsx scripts/scrape/run.ts --phase load  [--season 2024-2025] [--dry-run]
 *   npx tsx scripts/scrape/run.ts                   (all phases, all seasons)
 *
 * (A past SSL issue with volleyballworld.com's certificate chain resolved
 * itself — fetch verified working with normal TLS verification on 2026-07-05.)
 */

import { fetchAll } from './fetch.js'
import { parseAll } from './parse.js'
import { loadAll }  from './load.js'

// ---------------------------------------------------------------------------
// Arg parsing
// ---------------------------------------------------------------------------

function getArg(flag: string): string | undefined {
  const idx = process.argv.indexOf(flag)
  if (idx === -1) return undefined
  return process.argv[idx + 1]
}

function hasFlag(flag: string): boolean {
  return process.argv.includes(flag)
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const phase        = getArg('--phase')
  const seasonSlug   = getArg('--season')
  const forceRefresh = hasFlag('--force-refresh')
  const dryRun       = hasFlag('--dry-run')

  const runFetch = !phase || phase === 'fetch'
  const runParse = !phase || phase === 'parse'
  const runLoad  = !phase || phase === 'load'

  if (phase && !['fetch', 'parse', 'load'].includes(phase)) {
    console.error(`Unknown phase "${phase}". Use: fetch | parse | load`)
    process.exit(1)
  }

  if (runFetch) {
    console.log('\n══ PHASE 1: FETCH ══')
    await fetchAll({ seasonSlug, forceRefresh })
  }

  if (runParse) {
    console.log('\n══ PHASE 2: PARSE ══')
    await parseAll({ seasonSlug })
  }

  if (runLoad) {
    console.log('\n══ PHASE 3: LOAD ══')
    await loadAll({ seasonSlug, dryRun })
  }

  console.log('\n✓ Done.')
}

main().catch((err) => {
  console.error('\n✗ Scraper error:', err)
  process.exit(1)
})
