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
  /** Human-readable: '2024-2025' — used in URLs and as the landing-dir name */
  urlSlug: string
  /** DB season format: '2024/25' */
  dbSeason: string
  /** Set to true once the season is finished (no more matches → cache forever) */
  isFinished: boolean
  /**
   * volleyballworld serves the season in progress at season-less URLs
   * (/superlega/teams/) and only archives it under its slug once the next
   * season starts. Flip to false (and set isFinished) when that happens.
   */
  isCurrent?: boolean
  /**
   * 'hybrid' (default): volleyballworld + legavolley overlay — 2021/22 onward.
   * 'lega-only': legavolley.it stats tables only (volleyballworld has no
   * SuperLega before 2021/22) — names + counting stats, no bios/digs/assists.
   */
  source?: 'hybrid' | 'lega-only'
}

export const SEASONS: SeasonConfig[] = [
  { urlSlug: '2025-2026', dbSeason: '2025/26', isFinished: false, isCurrent: true },
  { urlSlug: '2024-2025', dbSeason: '2024/25', isFinished: true },
  { urlSlug: '2023-2024', dbSeason: '2023/24', isFinished: true },
  { urlSlug: '2022-2023', dbSeason: '2022/23', isFinished: true },
  { urlSlug: '2021-2022', dbSeason: '2021/22', isFinished: true },
  // legavolley.it archive only — per-player stats start in 1998/99
  // (1997/98 and earlier return no data; 1998/99 has an extra PUNTI CP column)
  { urlSlug: '2020-2021', dbSeason: '2020/21', isFinished: true, source: 'lega-only' },
  { urlSlug: '2019-2020', dbSeason: '2019/20', isFinished: true, source: 'lega-only' },
  { urlSlug: '2018-2019', dbSeason: '2018/19', isFinished: true, source: 'lega-only' },
  { urlSlug: '2017-2018', dbSeason: '2017/18', isFinished: true, source: 'lega-only' },
  { urlSlug: '2016-2017', dbSeason: '2016/17', isFinished: true, source: 'lega-only' },
  { urlSlug: '2015-2016', dbSeason: '2015/16', isFinished: true, source: 'lega-only' },
  { urlSlug: '2014-2015', dbSeason: '2014/15', isFinished: true, source: 'lega-only' },
  { urlSlug: '2013-2014', dbSeason: '2013/14', isFinished: true, source: 'lega-only' },
  { urlSlug: '2012-2013', dbSeason: '2012/13', isFinished: true, source: 'lega-only' },
  { urlSlug: '2011-2012', dbSeason: '2011/12', isFinished: true, source: 'lega-only' },
  { urlSlug: '2010-2011', dbSeason: '2010/11', isFinished: true, source: 'lega-only' },
  { urlSlug: '2009-2010', dbSeason: '2009/10', isFinished: true, source: 'lega-only' },
  { urlSlug: '2008-2009', dbSeason: '2008/09', isFinished: true, source: 'lega-only' },
  { urlSlug: '2007-2008', dbSeason: '2007/08', isFinished: true, source: 'lega-only' },
  { urlSlug: '2006-2007', dbSeason: '2006/07', isFinished: true, source: 'lega-only' },
  { urlSlug: '2005-2006', dbSeason: '2005/06', isFinished: true, source: 'lega-only' },
  { urlSlug: '2004-2005', dbSeason: '2004/05', isFinished: true, source: 'lega-only' },
  { urlSlug: '2003-2004', dbSeason: '2003/04', isFinished: true, source: 'lega-only' },
  { urlSlug: '2002-2003', dbSeason: '2002/03', isFinished: true, source: 'lega-only' },
  { urlSlug: '2001-2002', dbSeason: '2001/02', isFinished: true, source: 'lega-only' },
  { urlSlug: '2000-2001', dbSeason: '2000/01', isFinished: true, source: 'lega-only' },
  { urlSlug: '1999-2000', dbSeason: '1999/00', isFinished: true, source: 'lega-only' },
  { urlSlug: '1998-1999', dbSeason: '1998/99', isFinished: true, source: 'lega-only' },
]

// ---------------------------------------------------------------------------
// URL builders
// ---------------------------------------------------------------------------

/**
 * Season path segment for volleyballworld URLs. The season in progress lives
 * at season-less URLs (/superlega/teams/); archived seasons keep their slug.
 */
function vwSeasonSegment(season: SeasonConfig): string {
  return season.isCurrent ? '' : `${season.urlSlug}/`
}

export function teamsListUrl(season: SeasonConfig): string {
  return `${BASE_URL}/volleyball/competitions/${COMPETITION_SLUG}/${vwSeasonSegment(season)}teams/`
}

export function teamRosterUrl(season: SeasonConfig, teamId: number): string {
  return `${BASE_URL}/volleyball/competitions/${COMPETITION_SLUG}/${vwSeasonSegment(season)}teams/${teamId}/players/`
}

export function playerPageUrl(season: SeasonConfig, playerId: number): string {
  return `${BASE_URL}/volleyball/competitions/${COMPETITION_SLUG}/${vwSeasonSegment(season)}players/${playerId}`
}

export function teamScheduleUrl(season: SeasonConfig, teamId: number): string {
  return `${BASE_URL}/volleyball/competitions/${COMPETITION_SLUG}/${vwSeasonSegment(season)}teams/${teamId}/schedule/`
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

/**
 * Any ATLETA-stat page — used only to read the per-season athlete dropdown,
 * whose option values are player profile codes ('BOY-STE-96').
 */
export function legavolleyAtletaIndexUrl(year: number): string {
  return `${LEGAVOLLEY_BASE}/statistiche/?TipoStat=2.3&Serie=1&AnnoInizio=${year}&Fase=3&Giornata=0`
}

export function legavolleyAtletaIndexPath(season: string): string {
  return `${LANDING_ROOT}/legavolley/${season}/atleti.html`
}

/** Player profile page: title "Cognome Nome", Ruolo, Nascita, Altezza, Naz.Sportiva */
export function legavolleyPlayerProfileUrl(code: string): string {
  return `${LEGAVOLLEY_BASE}/player/${encodeURIComponent(code)}`
}

/** Season-independent cache — profiles change rarely, cache forever */
export function legavolleyPlayerProfilePath(code: string): string {
  return `${LANDING_ROOT}/legavolley/players/${code}.html`
}

/** legavolley Ruolo → DB position_enum. Unknown roles are skipped with a warning. */
export const LEGA_ROLE_TO_POSITION: Record<string, string> = {
  'Schiacciatore': 'OH',
  'Opposto':       'OPP',
  'Centrale':      'MB',
  'Palleggiatore': 'S',
  'Libero':        'L',
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
  'Cuneo':         'MA Acqua S.Bernardo Cuneo',
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
  'Mint Vero Volley Monza':     'Vero Volley Monza',
  'MINT Vero Volley Monza':     'Vero Volley Monza',
  // historical label of the same franchise (Top Volley Latina/Cisterna)
  'Cisterna Top Volley':        'Cisterna Volley',
  'Top Volley Cisterna':        'Cisterna Volley',
  // sponsor-era names → one canonical club row per franchise
  'Sir Safety Susa Perugia':    'Sir Susa Perugia',
  'Sir Safety Conad Perugia':   'Sir Susa Perugia',
  'WithU Verona':               'Rana Verona',
  'Verona Volley':              'Rana Verona',
  'Leo Shoes PerkinElmer Modena': 'Valsa Group Modena',
  'Kioene Padova':              'Pallavolo Padova',
  'Consar RCM Ravenna':         'Consar Ravenna',
  'Tonno Callipo Calabria Vibo Valentia': 'Tonno Callipo Vibo Valentia',
  'Emma Villas Aubay Siena':    'Emma Villas Siena',
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
  'MA Acqua S.Bernardo Cuneo':    'Cuneo',
  'Tonno Callipo Vibo Valentia':  'Vibo Valentia',
  'Santa Croce':                  'Santa Croce',
  'San Giustino':                 'San Giustino',
  // lega-only era clubs whose last-word fallback would be wrong
  'Castellana Grotte New Mater':  'Castellana',
  'Cuneo Volley':                 'Cuneo',        // Piemonte Volley, folded 2014 (≠ modern Cuneo club)
  'Gioia Del Colle VolleyGioia':  'Gioia del Colle',
  'Milano Volley':                'Milano',
  'Milano Sparkling':             'Sparkling',
  'Palermo Domino':               'Palermo',
  'Perugia Umbria':               'RPA Perugia',  // ≠ Sir Susa Perugia
  'Roma M.':                      'M. Roma',
  'Roma Piaggio':                 'Piaggio Roma',
  'Trieste Adriavolley':          'Trieste',
  'Ancona Dorica':                'Ancona',
}
