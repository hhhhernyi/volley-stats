/**
 * constants.ts — URL builders, season config, and mapping overrides.
 * All scraped data for SuperLega maps to COMPETITION_ID = 1.
 */

export const BASE_URL = 'https://en.volleyballworld.com'
export const COMPETITION_SLUG = 'superlega'
export const COMPETITION_ID = 1        // matches supabase competitions.id
export const STAT_SYSTEM   = 'fivb'   // matches stat_system_enum

/** Landing-layer root (relative to project root) */
export const LANDING_ROOT = 'data/landing'

/** Delay between HTTP requests in ms */
export const REQUEST_DELAY_MS = 1_500

/** User-agent to identify ourselves */
export const USER_AGENT = 'VolleyStat-personal-stats-research/1.0'

/** legavolley.it returns 403 to non-browser user agents */
export const BROWSER_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36'

// ---------------------------------------------------------------------------
// Season config
// ---------------------------------------------------------------------------

export interface SeasonConfig {
  /** Human-readable: '2024-2025' — used in URLs */
  urlSlug: string
  /** DB season format: '2024/25' */
  dbSeason: string
  /** Set to true once the season is finished (no more matches → cache forever) */
  isFinished: boolean
}

export const SEASONS: SeasonConfig[] = [
  { urlSlug: '2024-2025', dbSeason: '2024/25', isFinished: false },
  { urlSlug: '2023-2024', dbSeason: '2023/24', isFinished: true },
  { urlSlug: '2022-2023', dbSeason: '2022/23', isFinished: true },
  { urlSlug: '2021-2022', dbSeason: '2021/22', isFinished: true },
]

// ---------------------------------------------------------------------------
// URL builders
// ---------------------------------------------------------------------------

export function teamsListUrl(season: string): string {
  return `${BASE_URL}/volleyball/competitions/${COMPETITION_SLUG}/${season}/teams/`
}

export function teamRosterUrl(season: string, teamId: number): string {
  return `${BASE_URL}/volleyball/competitions/${COMPETITION_SLUG}/${season}/teams/${teamId}/players/`
}

export function playerPageUrl(season: string, playerId: number): string {
  return `${BASE_URL}/volleyball/competitions/${COMPETITION_SLUG}/${season}/players/${playerId}`
}

export function teamScheduleUrl(season: string, teamId: number): string {
  return `${BASE_URL}/volleyball/competitions/${COMPETITION_SLUG}/${season}/teams/${teamId}/schedule/`
}

/**
 * Live-matches API — returns JSON with every match of the tournament:
 * match no (joins to data-match-no on player rows) + set score (matchPointsA/B).
 * The tournament number is embedded in each season's schedule page HTML.
 */
export function matchesApiUrl(tournamentNo: number): string {
  return `https://en-live.volleyballworld.com/api/v1/live/matches/bytournaments/${tournamentNo};${tournamentNo}`
}

// ---------------------------------------------------------------------------
// File-path builders (landing layer)
// ---------------------------------------------------------------------------

export function teamsListPath(season: string): string {
  return `${LANDING_ROOT}/${COMPETITION_SLUG}/${season}/teams.html`
}

export function teamRosterPath(season: string, teamId: number): string {
  return `${LANDING_ROOT}/${COMPETITION_SLUG}/${season}/teams/${teamId}-players.html`
}

export function playerHtmlPath(season: string, playerId: number): string {
  return `${LANDING_ROOT}/${COMPETITION_SLUG}/${season}/players/${playerId}.html`
}

export function teamSchedulePath(season: string, teamId: number): string {
  return `${LANDING_ROOT}/${COMPETITION_SLUG}/${season}/teams/${teamId}-schedule.html`
}

export function matchesJsonPath(season: string): string {
  return `${LANDING_ROOT}/${COMPETITION_SLUG}/${season}/matches.json`
}

// ---------------------------------------------------------------------------
// legavolley.it (official Lega Pallavolo Serie A) — authoritative stats source
// ---------------------------------------------------------------------------

export const LEGAVOLLEY_BASE = 'https://www.legavolley.it'

/** First year of a season url slug: '2024-2025' → 2024 (= AnnoInizio) */
export function seasonStartYear(seasonSlug: string): number {
  return parseInt(seasonSlug.split('-')[0], 10)
}

/**
 * All players of one team for a season.
 * TipoStat 1.1 = "SQUADRA - Atleta per Atleta"; Fase 3 = RS + Play Off;
 * Serie 1 = A1 (SuperLega).
 */
export function legavolleyTeamStatsUrl(year: number, teamCode: string): string {
  return `${LEGAVOLLEY_BASE}/statistiche/?TipoStat=1.1&Serie=1&AnnoInizio=${year}&Fase=3&Squadra=${encodeURIComponent(teamCode)}&Giornata=0`
}

/** Any season-scoped stats page — used only to read the team-code dropdown */
export function legavolleyIndexUrl(year: number): string {
  return `${LEGAVOLLEY_BASE}/statistiche/?TipoStat=1.1&Serie=1&AnnoInizio=${year}&Fase=3&Giornata=0`
}

export function legavolleyIndexPath(season: string): string {
  return `${LANDING_ROOT}/legavolley/${season}/index.html`
}

export function legavolleyTeamStatsPath(season: string, teamCode: string): string {
  return `${LANDING_ROOT}/legavolley/${season}/${teamCode}.html`
}

/**
 * Maps legavolley team-dropdown labels (short: "Lube", "Milano", …) to the
 * canonical club full_name used by the volleyballworld side, where plain
 * normalized-name containment wouldn't land.
 */
export const LEGAVOLLEY_CLUB_OVERRIDES: Record<string, string> = {
  'Lube':          'Cucine Lube Civitanova',
  'Milano':        'Allianz Milano',
  'Monza':         'Vero Volley Monza',
  'Cisterna':      'Cisterna Volley',
  'Grottazzolina': 'Yuasa Battery Grottazzolina',
  'Trentino':      'Itas Trentino',
  'Trento':        'Itas Trentino',
  'Perugia':       'Sir Susa Vim Perugia',
  'Piacenza':      'Gas Sales Bluenergy Piacenza',
  'Modena':        'Valsa Group Modena',
  'Padova':        'Sonepar Padova',
  'Verona':        'Rana Verona',
  'Taranto':       'Gioiella Prisma Taranto',
  'Acicastello':   'Farmitalia Catania',
  'Siena':         'Emma Villas Siena',
  'Ravenna':       'Consar Ravenna',
  'Vibo Valentia': 'Tonno Callipo Vibo Valentia',
}

export function parsedJsonPath(season: string): string {
  return `${LANDING_ROOT}/${COMPETITION_SLUG}/${season}/parsed.json`
}

export function warningsJsonPath(season: string): string {
  return `${LANDING_ROOT}/${COMPETITION_SLUG}/${season}/parse-warnings.json`
}

export function manifestPath(): string {
  return `${LANDING_ROOT}/${COMPETITION_SLUG}/cache-manifest.json`
}

// ---------------------------------------------------------------------------
// Club name overrides
// Maps site name → canonical DB full_name so the same club resolves to one
// clubs row across seasons despite sponsor-driven renames; resolveClub falls
// back to the site name for clubs without an override.
// ---------------------------------------------------------------------------

export const CLUB_NAME_OVERRIDES: Record<string, string> = {
  'Allianz Milano':             'Allianz Powervolley Milano',
  'Sir Safety Umbria Volley':   'Sir Susa Perugia',
  'Sir Susa Vim Perugia':       'Sir Susa Perugia',
  'Sir Susa Scai Perugia':      'Sir Susa Perugia',
  'Gas Sales Bluenergy Piacenza': 'Gas Sales Piacenza',
  'Modena Volley':              'Valsa Group Modena',
  'Leo Shoes Modena':           'Valsa Group Modena',
  'Sonepar Padova':             'Pallavolo Padova',
  'Taranto':                    'Gioiella Prisma Taranto',
  'Grottazzolina':              'Yuasa Battery Grottazzolina',
}

/**
 * Short display name per canonical full_name (clubs.short_name is NOT NULL).
 * Clubs not listed fall back to the last word of the full name.
 */
export const CLUB_SHORT_NAMES: Record<string, string> = {
  'Allianz Powervolley Milano':   'Milano',
  'Valsa Group Modena':           'Modena',
  'Rana Verona':                  'Verona',
  'Itas Trentino':                'Trento',
  'Gas Sales Piacenza':           'Piacenza',
  'Sir Susa Perugia':             'Perugia',
  'Pallavolo Padova':             'Padova',
  'Cucine Lube Civitanova':       'Cucine Lube',
  'Vero Volley Monza':            'Monza',
  'Cisterna Volley':              'Cisterna',
  'Top Volley Cisterna':          'Cisterna',
  'Gioiella Prisma Taranto':      'Taranto',
  'Yuasa Battery Grottazzolina':  'Grottazzolina',
}
