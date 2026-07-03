'use client'

import { useState, useMemo } from 'react'
import dynamic from 'next/dynamic'
import type { Player, Club, PlayerSeasonStats, AggregatedStats, SourceSelection } from '@/lib/types'
import {
  SEASONS,
  seasonsForPlayer,
  getClubForSeason,
  getNtEventForSeason,
  getCompetitionTypeMap,
  getClubMap,
} from '@/lib/seed-data'
import { aggregateStats, lastName } from '@/lib/stats'
import { PlayerPicker }  from './PlayerPicker'
import { BioCard }       from './BioCard'
import { StatTable }     from './StatTable'

// Radar chart uses canvas — SSR must be disabled
const RadarChart = dynamic(
  () => import('./RadarChart').then((m) => ({ default: m.RadarChart })),
  { ssr: false },
)

interface Props {
  players:  Player[]
  clubs:    Club[]
  allStats: PlayerSeasonStats[]
}

// Default to Ishikawa (id=1) earliest vs latest — a meaningful self-comparison
const DEFAULT_P1_ID     = 1
const DEFAULT_P1_SEASON = '2018/19'
const DEFAULT_P2_ID     = 1
const DEFAULT_P2_SEASON = '2023/24'

export function CompareView({ players, clubs, allStats }: Props) {
  const [p1Id,     setP1Id]     = useState(DEFAULT_P1_ID)
  const [p1Season, setP1Season] = useState(DEFAULT_P1_SEASON)
  const [p2Id,     setP2Id]     = useState(DEFAULT_P2_ID)
  const [p2Season, setP2Season] = useState(DEFAULT_P2_SEASON)
  const [sources,  setSources]  = useState<SourceSelection>({ club: true, nt: true })
  const [overlay,  setOverlay]  = useState(false)

  const compTypeMap = useMemo(() => getCompetitionTypeMap(), [])
  const clubMap     = useMemo(() => getClubMap(), [])

  // Aggregate stats for each slot
  const d1 = useMemo(
    () => aggregateStats(allStats, p1Id, p1Season, sources.club, sources.nt, compTypeMap),
    [allStats, p1Id, p1Season, sources, compTypeMap],
  )
  const d2 = useMemo(
    () => aggregateStats(allStats, p2Id, p2Season, sources.club, sources.nt, compTypeMap),
    [allStats, p2Id, p2Season, sources, compTypeMap],
  )

  const p1 = players.find((p) => p.id === p1Id)!
  const p2 = players.find((p) => p.id === p2Id)!

  const club1 = getClubForSeason(p1Id, p1Season, allStats, clubMap)
  const club2 = getClubForSeason(p2Id, p2Season, allStats, clubMap)
  const nt1   = getNtEventForSeason(p1Id, p1Season, allStats)
  const nt2   = getNtEventForSeason(p2Id, p2Season, allStats)

  const selfMode  = p1Id === p2Id
  const sameGroup = p1.position_group === p2.position_group

  // When player changes, pick their latest available season
  function handleP1Change(id: number) {
    setP1Id(id)
    const seasons = seasonsForPlayer(id, allStats)
    setP1Season(seasons[seasons.length - 1] ?? SEASONS[SEASONS.length - 1])
    setOverlay(false)
  }
  function handleP2Change(id: number) {
    setP2Id(id)
    const seasons = seasonsForPlayer(id, allStats)
    setP2Season(seasons[seasons.length - 1] ?? SEASONS[SEASONS.length - 1])
    setOverlay(false)
  }

  if (!d1 || !d2) return null

  const sourcesLabel =
    sources.club && sources.nt ? 'club + country (weighted)' :
    sources.club ? 'club only' : 'country only'

  return (
    <div>
      <h1
        className="text-2xl font-bold tracking-tight mt-8 mb-1"
        style={{ color: 'var(--text)' }}
      >
        Compare players
      </h1>
      <p className="text-sm mb-6" style={{ color: 'var(--text-dim)' }}>
        Pick two players and a season for each. Tick club and/or country to choose which
        competitions feed the numbers. Combined uses a volume-weighted average, never a naive mean.
      </p>

      {/* ── Pickers ────────────────────────────────────────────────────────── */}
      <div className="grid gap-4 mb-5 max-sm:grid-cols-1" style={{ gridTemplateColumns: '1fr 1fr' }}>
        <PlayerPicker
          slot={1} players={players} clubs={clubs} allStats={allStats}
          selectedPlayerId={p1Id} selectedSeason={p1Season}
          onPlayerChange={handleP1Change} onSeasonChange={setP1Season}
        />
        <PlayerPicker
          slot={2} players={players} clubs={clubs} allStats={allStats}
          selectedPlayerId={p2Id} selectedSeason={p2Season}
          onPlayerChange={handleP2Change} onSeasonChange={setP2Season}
        />
      </div>

      {/* ── Info board ─────────────────────────────────────────────────────── */}
      <div className="grid gap-4 mb-3.5 max-sm:grid-cols-1" style={{ gridTemplateColumns: '1fr 1fr' }}>
        <BioCard player={p1} aggregated={d1} club={club1} ntEvent={nt1} slot={1} />
        <BioCard player={p2} aggregated={d2} club={club2} ntEvent={nt2} slot={2} />
      </div>

      {/* ── Source checkboxes ──────────────────────────────────────────────── */}
      <div
        className="flex items-center gap-4 mb-5 rounded-[var(--radius-sm)] px-4 py-3 flex-wrap"
        style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
      >
        <span className="text-[12px] font-semibold uppercase" style={{ color: 'var(--text-faint)', letterSpacing: '.06em' }}>
          Include
        </span>
        {[
          { key: 'club' as const, label: 'Club', badge: '(league)' },
          { key: 'nt'   as const, label: 'Country', badge: '(VNL / Olympics / Worlds)' },
        ].map(({ key, label, badge }) => (
          <label key={key} className="inline-flex items-center gap-2 cursor-pointer text-[13.5px] font-medium select-none">
            <input
              type="checkbox"
              checked={sources[key]}
              onChange={(e) => setSources((s) => ({ ...s, [key]: e.target.checked }))}
              className="w-4 h-4 cursor-pointer"
              style={{ accentColor: 'var(--accent)' }}
            />
            {label}
            <span className="text-[10.5px]" style={{ color: 'var(--text-faint)' }}>{badge}</span>
          </label>
        ))}
        <span className="text-[12.5px] ml-auto" style={{ color: 'var(--text-dim)' }}>
          {(!sources.club && !sources.nt)
            ? 'Pick at least one source — showing all by default.'
            : `Showing ${sourcesLabel}. P1 ${d1.sets_played} sets · P2 ${d2.sets_played} sets`}
        </span>
      </div>

      {/* ── VS band ────────────────────────────────────────────────────────── */}
      <div className="grid items-center gap-3 mb-4" style={{ gridTemplateColumns: '1fr auto 1fr' }}>
        <span className="text-sm" style={{ color: 'var(--text-dim)' }}>
          {lastName(p1.name)}{' '}
          <span
            className="inline-block text-[11px] font-bold px-1.5 py-0.5 rounded"
            style={{ background: 'var(--p1-soft)', color: 'var(--p1)' }}
          >
            {p1Season}
          </span>
        </span>
        <span className="text-sm font-bold" style={{ color: 'var(--text-faint)' }}>VS</span>
        <span className="text-sm text-right" style={{ color: 'var(--text-dim)' }}>
          <span
            className="inline-block text-[11px] font-bold px-1.5 py-0.5 rounded"
            style={{ background: 'var(--p2-soft)', color: 'var(--p2)' }}
          >
            {p2Season}
          </span>{' '}
          {lastName(p2.name)}
        </span>
      </div>

      {selfMode && (
        <p className="text-center text-sm mb-4" style={{ color: 'var(--accent)' }}>
          Same player across seasons — {
            SEASONS.indexOf(p1Season) < SEASONS.indexOf(p2Season)
              ? `${p1Season} → ${p2Season}`
              : `${p2Season} → ${p1Season}`
          }. Δ shows raw change.
        </p>
      )}

      {/* ── Overlay toggle ─────────────────────────────────────────────────── */}
      <div
        className="flex items-center gap-3 mb-4 rounded-[var(--radius-sm)] px-3.5 py-2.5"
        style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
      >
        <label
          className={`inline-flex items-center gap-2 text-[13px] font-medium select-none ${sameGroup ? 'cursor-pointer' : 'opacity-40 cursor-not-allowed'}`}
        >
          {/* Custom toggle switch */}
          <span className="relative inline-block w-[38px] h-[22px] flex-shrink-0">
            <input
              type="checkbox"
              className="sr-only"
              checked={overlay}
              disabled={!sameGroup}
              onChange={(e) => setOverlay(e.target.checked)}
            />
            <span
              className="block w-full h-full rounded-full transition-colors duration-150"
              style={{ background: (overlay && sameGroup) ? 'var(--accent)' : 'var(--border-2)' }}
            />
            <span
              className="absolute top-0.5 left-0.5 w-[18px] h-[18px] rounded-full bg-white transition-transform duration-150"
              style={{ transform: (overlay && sameGroup) ? 'translateX(16px)' : 'translateX(0)' }}
            />
          </span>
          Overlay on one chart
        </label>
        <span className="text-[13px]" style={{ color: 'var(--text-dim)' }}>
          {sameGroup
            ? selfMode
              ? 'Same player — axes match, overlay shows both seasons.'
              : `Both are ${p1.position_group}s — axes match, can share a radar.`
            : `Different position types (${p1.position_group} vs ${p2.position_group}) — axes differ, shown separately.`}
        </span>
      </div>

      {/* ── Radar charts ───────────────────────────────────────────────────── */}
      {overlay && sameGroup ? (
        // Overlay: full-width single chart
        <div
          className="rounded-[var(--radius)] p-4 mb-5 col-span-2"
          style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
        >
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[13px] font-semibold" style={{ color: 'var(--text)' }}>
              {RADAR_CONFIGS[p1.position_group]?.label} — overlay
            </span>
            <span className="text-[11px]" style={{ color: 'var(--text-faint)' }}>
              raw values on fixed scale
            </span>
          </div>
          <RadarChart
            datasets={[
              { d: d1, player: p1, borderColor: '#e2483f', bgColor: 'rgba(226,72,63,.25)' },
              { d: d2, player: p2, borderColor: '#3787dd', bgColor: 'rgba(55,135,221,.25)' },
            ]}
            positionGroup={p1.position_group}
            allStats={allStats}
            allPlayers={players}
            competitionTypes={compTypeMap}
          />
          {/* Legend */}
          <div className="flex gap-4 justify-center mt-2 text-xs" style={{ color: 'var(--text-dim)' }}>
            {[
              { color: '#e2483f', label: `${lastName(p1.name)} ${p1Season}` },
              { color: '#3787dd', label: `${lastName(p2.name)} ${p2Season}` },
            ].map(({ color, label }) => (
              <span key={label} className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm" style={{ background: color }} />
                {label}
              </span>
            ))}
          </div>
          <p className="text-[11px] text-center mt-2" style={{ color: 'var(--text-faint)' }}>
            Hover a point for raw value + season percentile.
          </p>
        </div>
      ) : (
        // Side-by-side individual charts
        <div className="grid gap-4 mb-5 max-sm:grid-cols-1" style={{ gridTemplateColumns: '1fr 1fr' }}>
          {[
            { d: d1, p: p1, season: p1Season, borderColor: '#e2483f', bgColor: 'rgba(226,72,63,.22)' },
            { d: d2, p: p2, season: p2Season, borderColor: '#3787dd', bgColor: 'rgba(55,135,221,.22)' },
          ].map(({ d, p, season, borderColor, bgColor }) => (
            <div
              key={p.id + season}
              className="rounded-[var(--radius)] p-4"
              style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[13px] font-semibold" style={{ color: 'var(--text)' }}>
                  {lastName(p.name)} {season}
                </span>
                <span className="text-[11px]" style={{ color: 'var(--text-faint)' }}>
                  {RADAR_CONFIGS[p.position_group]?.label}
                </span>
              </div>
              <RadarChart
                datasets={[{ d, player: p, borderColor, bgColor }]}
                positionGroup={p.position_group}
                allStats={allStats}
                allPlayers={players}
                competitionTypes={compTypeMap}
              />
              <p className="text-[11px] text-center mt-2" style={{ color: 'var(--text-faint)' }}>
                Hover: raw value + season percentile
              </p>
            </div>
          ))}
        </div>
      )}

      {/* ── Stat table ─────────────────────────────────────────────────────── */}
      <StatTable
        d1={d1} d2={d2} p1={p1} p2={p2}
        allStats={allStats} allPlayers={players}
        competitionTypes={compTypeMap}
      />

      {/* ── Reading note ───────────────────────────────────────────────────── */}
      <p className="text-xs leading-relaxed mt-3.5" style={{ color: 'var(--text-faint)' }}>
        {selfMode ? (
          <>
            <b style={{ color: 'var(--text-dim)' }}>Reading it:</b>{' '}
            the radar shape is built from <em>raw values on a fixed scale</em>, so a shrinking shape
            means real decline — not just a weaker field. Hover any point for the raw value and that
            season's percentile, which can move the other way. The Δ in the table is the raw change.
          </>
        ) : sameGroup ? (
          <>
            <b style={{ color: 'var(--text-dim)' }}>Reading it:</b>{' '}
            radar shape = raw values on fixed axes; hover for percentile-vs-peers context. Pick each
            player's peak season and overlay to settle who was better at their best.
          </>
        ) : (
          <>
            <b style={{ color: 'var(--text-dim)' }}>Why no overlay:</b>{' '}
            a {p1.primary_position} and a {p2.primary_position} use different radar axes,
            so each keeps its own chart.
          </>
        )}
      </p>
    </div>
  )
}

// Re-export for the dynamic import access in RadarChart
import { RADAR_CONFIGS } from '@/lib/radar-config'
