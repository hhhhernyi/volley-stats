/**
 * parse.ts — Phase 2: read landing HTML → emit parsed.json + parse-warnings.json.
 *
 * Must be run after fetch phase completes.
 * Output consumed by load phase.
 *
 * sets_played: the player page has no per-match set scores, so we join each
 * stat row's data-match-no against matches.json (live-matches API) and sum
 * the sets of every match the player appeared in. This assumes the player
 * was on court for all sets of those matches — the site publishes no
 * per-set participation, so this is the best available approximation.
 */

import fs from 'fs/promises'
import path from 'path'
import {
  SEASONS,
  LANDING_ROOT, COMPETITION_SLUG,
  teamsListPath, teamRosterPath, playerHtmlPath,
  parsedJsonPath, warningsJsonPath, matchesJsonPath,
  type SeasonConfig,
} from './lib/constants.js'
import { readLanding, readJson, writeJson, fileExists } from './lib/http-client.js'
import {
  parseTeamsPage, parseRosterPage, parsePlayerPage,
  type ParsedTeam,
} from './lib/html-parser.js'
import type { ApiMatch, ParsedPlayerSeason } from './lib/types.js'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** List all numeric player IDs from the players/ directory under a season */
async function listPlayerFiles(season: string): Promise<number[]> {
  const dir = path.join(process.cwd(), LANDING_ROOT, COMPETITION_SLUG, season, 'players')
  try {
    const entries = await fs.readdir(dir)
    return entries
      .filter((e) => e.endsWith('.html'))
      .map((e) => parseInt(e.replace('.html', ''), 10))
      .filter((n) => !isNaN(n))
  } catch {
    return []
  }
}

/** Find which team a player belongs to by scanning roster files */
async function buildPlayerTeamMap(
  season: string,
  teams: ParsedTeam[],
): Promise<Map<number, number>> {
  const map = new Map<number, number>()

  for (const team of teams) {
    const rosterPath = teamRosterPath(season, team.volleyballworld_id)
    if (!(await fileExists(rosterPath))) continue

    const html = await readLanding(rosterPath)
    const stubs = parseRosterPage(html, team.volleyballworld_id)
    for (const s of stubs) {
      map.set(s.volleyballworld_id, team.volleyballworld_id)
    }
  }

  return map
}

/**
 * Build matchNo → sets-in-match from matches.json.
 * Only finished matches with a valid volleyball score (3-0/3-1/3-2) count.
 */
async function buildMatchSetsMap(season: string): Promise<Map<number, number>> {
  const map = new Map<number, number>()
  if (!(await fileExists(matchesJsonPath(season)))) return map

  const matches = await readJson<ApiMatch[]>(matchesJsonPath(season))
  for (const m of matches) {
    const total = (m.matchPointsA ?? 0) + (m.matchPointsB ?? 0)
    if (total >= 3 && total <= 5) map.set(m.no, total)
  }
  return map
}

// ---------------------------------------------------------------------------
// Parse one season
// ---------------------------------------------------------------------------

export async function parseSeason(
  season: SeasonConfig,
): Promise<ParsedPlayerSeason[]> {
  const { urlSlug, dbSeason } = season
  console.log(`\n── Parsing ${urlSlug} ──`)

  // Teams list
  const teamsHtml = await readLanding(teamsListPath(urlSlug))
  const teams     = parseTeamsPage(teamsHtml)
  const teamById  = new Map(teams.map((t) => [t.volleyballworld_id, t]))
  console.log(`  Teams found: ${teams.length}`)

  // Match set counts (from live-matches API)
  const matchSets = await buildMatchSetsMap(urlSlug)
  console.log(`  Matches with set scores: ${matchSets.size}`)
  if (matchSets.size === 0) {
    console.warn('  ⚠ matches.json missing or empty — re-run fetch phase; sets_played cannot be computed')
  }

  // Build player → team mapping from roster files
  const playerTeamMap = await buildPlayerTeamMap(urlSlug, teams)

  // List all player HTML files
  const playerIds = await listPlayerFiles(urlSlug)
  console.log(`  Player HTML files: ${playerIds.length}`)

  const results: ParsedPlayerSeason[] = []
  const allWarnings: { playerId: number; warnings: string[] }[] = []

  for (const playerId of playerIds) {
    const filePath = playerHtmlPath(urlSlug, playerId)
    if (!(await fileExists(filePath))) continue

    const html   = await readLanding(filePath)
    const parsed = parsePlayerPage(html)
    const { info, matchRows, warnings } = parsed

    // Skip players with no usable name
    if (!info.name) {
      allWarnings.push({ playerId, warnings: ['No player name found — skipped'] })
      continue
    }

    // Team association
    const teamId = playerTeamMap.get(playerId)
    if (!teamId) {
      warnings.push(`Player ${playerId} not found in any team roster — skipped`)
      allWarnings.push({ playerId, warnings })
      continue
    }

    if (matchRows.length === 0) {
      warnings.push('No match stats on page — skipped (player likely never appeared)')
      allWarnings.push({ playerId, warnings })
      continue
    }

    // ── Sets played: sum sets of every match the player actually played ──
    // The site emits a row for every match the player was in the squad for,
    // including matches he never entered (all stats zero) — counting those
    // would wildly inflate sets_played for bench players. A match counts
    // only if at least one stat is non-zero.
    const playedRows = matchRows.filter((r) =>
      Object.entries(r).some(([k, v]) => k !== 'matchNo' && v !== 0),
    )

    let sets_played = 0
    let missingMatches = 0
    for (const row of playedRows) {
      const sets = matchSets.get(row.matchNo)
      if (sets === undefined) {
        missingMatches++
      } else {
        sets_played += sets
      }
    }
    if (missingMatches > 0) {
      warnings.push(`${missingMatches}/${playedRows.length} played matches missing from matches.json — sets_played undercounts`)
    }
    if (sets_played === 0) {
      warnings.push('sets_played=0 (no matches with any recorded stat) — skipped')
      allWarnings.push({ playerId, warnings })
      continue
    }

    // ── Sum per-match rows into season totals ──
    const sum = (f: (r: typeof matchRows[number]) => number) =>
      matchRows.reduce((acc, r) => acc + f(r), 0)

    const assists = sum((r) => r.assists)

    const stats: ParsedPlayerSeason['stats'] = {
      sets_played,
      atk_attempts: sum((r) => r.atkAttempts),
      atk_kills:    sum((r) => r.atkKills),
      atk_errors:   sum((r) => r.atkErrors),
      total_points: sum((r) => r.totalPoints),
      aces:         sum((r) => r.aces),
      serve_errors: sum((r) => r.serveErrors),
      blocks:       sum((r) => r.blocks),
      digs:         sum((r) => r.digs),
      rec_attempts: sum((r) => r.recAttempts),
      // Site only publishes perfect ("successful") receptions — positive
      // (non-perfect good) receptions are not tracked. Stored as 0.
      rec_positive: 0,
      rec_perfect:  sum((r) => r.recPerfect),
      rec_errors:   sum((r) => r.recErrors),
      assists:      assists > 0 ? assists : null,
    }

    results.push({
      season: dbSeason,
      teamVolleyballworldId: teamId,
      teamName: teamById.get(teamId)?.name ?? `team-${teamId}`,
      player: {
        volleyballworld_id: playerId,
        name:          info.name,
        position:      info.position,
        nationality:   info.nationality,
        height_cm:     info.height_cm,
        date_of_birth: info.date_of_birth,
      },
      stats,
      warnings,
    })

    if (warnings.length > 0) {
      allWarnings.push({ playerId, warnings })
    }
  }

  // Write outputs
  await writeJson(parsedJsonPath(urlSlug), results)
  await writeJson(warningsJsonPath(urlSlug), allWarnings)

  const warnCount = allWarnings.length
  console.log(`  ✓ ${urlSlug}: ${results.length} players parsed, ${warnCount} with warnings`)
  if (warnCount > 0) {
    console.log(`    Warnings written to ${warningsJsonPath(urlSlug)}`)
  }

  return results
}

// ---------------------------------------------------------------------------
// Parse all seasons
// ---------------------------------------------------------------------------

export async function parseAll(options: { seasonSlug?: string }): Promise<ParsedPlayerSeason[]> {
  const targets = options.seasonSlug
    ? SEASONS.filter((s) => s.urlSlug === options.seasonSlug)
    : SEASONS

  if (targets.length === 0) {
    throw new Error(`No season found matching slug: ${options.seasonSlug}`)
  }

  const all: ParsedPlayerSeason[] = []
  for (const season of targets) {
    const results = await parseSeason(season)
    all.push(...results)
  }
  return all
}
