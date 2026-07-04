/**
 * fetch.ts — Phase 1: download all HTML to the landing layer.
 *
 * Execution order:
 *   1. Download teams list → extract team IDs
 *   2. For each team → download roster page → extract player IDs
 *   3. For each player → download player stats page
 *   4. Update cache-manifest.json
 *
 * Running twice is safe: cached files are returned instantly.
 */

import * as cheerio from 'cheerio'
import {
  SEASONS, BROWSER_USER_AGENT,
  teamsListUrl, teamRosterUrl, playerPageUrl, teamScheduleUrl, matchesApiUrl,
  teamsListPath, teamRosterPath, playerHtmlPath, teamSchedulePath,
  matchesJsonPath, manifestPath,
  legavolleyIndexUrl, legavolleyIndexPath,
  legavolleyTeamStatsUrl, legavolleyTeamStatsPath, seasonStartYear,
  type SeasonConfig,
} from './lib/constants.js'
import {
  fetchAndCache, writeJson, readJson, fileExists,
} from './lib/http-client.js'
import { extractTournamentNo } from './lib/html-parser.js'
import { parseTeamCodes } from './lib/legavolley-parser.js'
import type { CacheManifest, SeasonManifest, ScrapedTeam, ScrapedPlayerStub } from './lib/types.js'

// ---------------------------------------------------------------------------
// Team ID extraction
// ---------------------------------------------------------------------------

function extractTeamIds(html: string): ScrapedTeam[] {
  const $ = cheerio.load(html)
  const teams: ScrapedTeam[] = []
  const seen = new Set<number>()

  // Links like /volleyball/competitions/superlega/2024-2025/teams/7314/players/
  $('a[href*="/teams/"]').each((_, el) => {
    const href = $(el).attr('href') ?? ''
    const m = href.match(/\/teams\/(\d+)\//)
    if (!m) return
    const id = parseInt(m[1], 10)
    if (seen.has(id)) return
    seen.add(id)

    // Try to extract team name from link text or nearby element
    const name = $(el).text().trim() || `team-${id}`
    teams.push({ volleyballworld_id: id, name })
  })

  return teams
}

// ---------------------------------------------------------------------------
// Player ID extraction from roster page
// ---------------------------------------------------------------------------

function extractPlayerStubs(html: string, teamId: number): ScrapedPlayerStub[] {
  const $ = cheerio.load(html)
  const players: ScrapedPlayerStub[] = []
  const seen = new Set<number>()

  // Links like /volleyball/competitions/superlega/2024-2025/players/206635
  $('a[href*="/players/"]').each((_, el) => {
    const href = $(el).attr('href') ?? ''
    const m = href.match(/\/players\/(\d+)/)
    if (!m) return
    const id = parseInt(m[1], 10)
    if (seen.has(id)) return
    seen.add(id)

    const name = $(el).text().trim() || `player-${id}`
    players.push({
      volleyballworld_id: id,
      name,
      teamVolleyballworldId: teamId,
    })
  })

  return players
}

// ---------------------------------------------------------------------------
// Manifest helpers
// ---------------------------------------------------------------------------

async function loadManifest(): Promise<CacheManifest> {
  const path = manifestPath()
  if (await fileExists(path)) {
    return readJson<CacheManifest>(path)
  }
  return { lastUpdated: new Date().toISOString(), seasons: [] }
}

function getOrCreateSeasonManifest(
  manifest: CacheManifest,
  urlSlug: string,
): SeasonManifest {
  const existing = manifest.seasons.find((s) => s.urlSlug === urlSlug)
  if (existing) return existing
  const fresh: SeasonManifest = { urlSlug, fetchCompleted: null, playerCount: 0 }
  manifest.seasons.push(fresh)
  return fresh
}

// ---------------------------------------------------------------------------
// Main fetch function for one season
// ---------------------------------------------------------------------------

export async function fetchSeason(
  season: SeasonConfig,
  forceRefresh = false,
): Promise<void> {
  const { urlSlug, isFinished } = season
  const manifest = await loadManifest()
  const sm = getOrCreateSeasonManifest(manifest, urlSlug)

  if (!forceRefresh && sm.fetchCompleted && isFinished) {
    console.log(`[${urlSlug}] Finished season, already cached — skipping fetch.`)
    return
  }

  console.log(`\n── Fetching ${urlSlug} ──`)

  // Step 1: teams list
  const teamsHtml = await fetchAndCache(
    teamsListUrl(urlSlug),
    teamsListPath(urlSlug),
    forceRefresh,
  )

  const teams = extractTeamIds(teamsHtml)
  if (teams.length === 0) {
    throw new Error(`[${urlSlug}] No teams found in teams list page. Selector may have changed.`)
  }
  console.log(`  Found ${teams.length} teams`)

  // Step 2: matches JSON (set scores per match, keyed by match no).
  // The tournament number for the live API is embedded in any schedule page.
  const scheduleHtml = await fetchAndCache(
    teamScheduleUrl(urlSlug, teams[0].volleyballworld_id),
    teamSchedulePath(urlSlug, teams[0].volleyballworld_id),
    forceRefresh,
  )

  const tournamentNo = extractTournamentNo(scheduleHtml)
  if (!tournamentNo) {
    throw new Error(`[${urlSlug}] Could not extract tournament number from schedule page.`)
  }
  console.log(`  Tournament no: ${tournamentNo}`)

  await fetchAndCache(
    matchesApiUrl(tournamentNo),
    matchesJsonPath(urlSlug),
    forceRefresh,
  )

  // Step 3 + 4: roster → players
  const allPlayerIds = new Set<number>()

  for (const team of teams) {
    const rosterHtml = await fetchAndCache(
      teamRosterUrl(urlSlug, team.volleyballworld_id),
      teamRosterPath(urlSlug, team.volleyballworld_id),
      forceRefresh,
    )

    const stubs = extractPlayerStubs(rosterHtml, team.volleyballworld_id)
    console.log(`  ${team.name} (${team.volleyballworld_id}): ${stubs.length} players`)

    for (const stub of stubs) {
      allPlayerIds.add(stub.volleyballworld_id)
      await fetchAndCache(
        playerPageUrl(urlSlug, stub.volleyballworld_id),
        playerHtmlPath(urlSlug, stub.volleyballworld_id),
        forceRefresh,
      )
    }
  }

  // Step 5: legavolley.it official stats — one page per team (authoritative
  // for sets played, reception, attack, serve, block; see docs/DATA_SOURCES.md)
  const year = seasonStartYear(urlSlug)
  const legaIndexHtml = await fetchAndCache(
    legavolleyIndexUrl(year),
    legavolleyIndexPath(urlSlug),
    forceRefresh,
    BROWSER_USER_AGENT,
  )

  const legaTeams = parseTeamCodes(legaIndexHtml)
  if (legaTeams.length === 0) {
    throw new Error(`[${urlSlug}] No team codes found on legavolley.it stats page.`)
  }
  console.log(`  legavolley.it teams: ${legaTeams.length}`)

  for (const team of legaTeams) {
    await fetchAndCache(
      legavolleyTeamStatsUrl(year, team.code),
      legavolleyTeamStatsPath(urlSlug, team.code),
      forceRefresh,
      BROWSER_USER_AGENT,
    )
  }

  // Update manifest
  sm.fetchCompleted = new Date().toISOString()
  sm.playerCount    = allPlayerIds.size
  manifest.lastUpdated = new Date().toISOString()
  await writeJson(manifestPath(), manifest)

  console.log(`  ✓ ${urlSlug}: fetched ${allPlayerIds.size} player pages`)
}

// ---------------------------------------------------------------------------
// Fetch all seasons (or one if --season flag is set)
// ---------------------------------------------------------------------------

export async function fetchAll(options: {
  seasonSlug?: string
  forceRefresh?: boolean
}): Promise<void> {
  const targets = options.seasonSlug
    ? SEASONS.filter((s) => s.urlSlug === options.seasonSlug)
    : SEASONS

  if (targets.length === 0) {
    throw new Error(`No season found matching slug: ${options.seasonSlug}`)
  }

  for (const season of targets) {
    await fetchSeason(season, options.forceRefresh)
  }
}
