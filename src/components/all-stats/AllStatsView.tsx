'use client'

import { useState, useMemo } from 'react'
import type { Player, Club, Competition, PlayerSeasonStats } from '@/lib/types'
import { distinctSeasons, getClubMap, leagueCompetitionIds } from '@/lib/helpers'
import { aggregateStats, fmtVal } from '@/lib/stats'
import {
  LEAD_COLS_DEFAULT,
  LEAD_COLS_LIBERO,
  LEAD_COLS_SETTER,
} from '@/lib/radar-config'

const POS_TAG_STYLE: Record<string, { bg: string; color: string }> = {
  OH:  { bg: 'rgba(55,135,221,.16)',  color: '#2f7bcf' },
  OPP: { bg: 'rgba(226,72,63,.16)',   color: '#cf3d34' },
  MB:  { bg: 'rgba(29,158,117,.16)',  color: '#178c66' },
  S:   { bg: 'rgba(186,117,23,.18)',  color: '#9c6213' },
  L:   { bg: 'rgba(127,119,221,.18)', color: '#6a62cc' },
}

const selectStyle: React.CSSProperties = {
  background:   'var(--surface-2)',
  color:        'var(--text)',
  border:       '1px solid var(--border-2)',
  borderRadius: 'var(--radius-sm)',
  padding:      '7px 10px',
  fontSize:     '13px',
  fontFamily:   'inherit',
  cursor:       'pointer',
  minWidth:     '120px',
}

interface Props {
  players:      Player[]
  clubs:        Club[]
  competitions: Competition[]
  allStats:     PlayerSeasonStats[]
}

export function AllStatsView({ players, clubs, competitions, allStats }: Props) {
  const seasons = useMemo(() => distinctSeasons(allStats), [allStats])

  const [season,   setSeason]   = useState(() => seasons[seasons.length - 1] ?? '')
  const [posFilter, setPosFilter] = useState('')
  const [clubFilter, setClubFilter] = useState('')
  const [sortField, setSortField] = useState<string>('points_per_set')
  const [sortDir,  setSortDir]  = useState<-1 | 1>(-1)

  const leagueIds = useMemo(() => leagueCompetitionIds(competitions), [competitions])
  const clubMap   = useMemo(() => getClubMap(clubs), [clubs])

  // Pick columns based on position filter
  const cols = posFilter === 'L' ? LEAD_COLS_LIBERO
             : posFilter === 'S' ? LEAD_COLS_SETTER
             : LEAD_COLS_DEFAULT

  // Build leaderboard rows
  const rows = useMemo(() => {
    const data = players
      .filter((p) => !posFilter || p.primary_position === posFilter)
      .map((p) => {
        const d = aggregateStats(allStats, p.id, season, leagueIds, false)
        if (!d) return null
        // Find club for this player/season
        const statsRow = allStats.find(
          (r) => r.player_id === p.id && r.season === season && r.club_id != null,
        )
        const club = statsRow?.club_id ? clubMap.get(statsRow.club_id) : undefined
        return { d, player: p, club }
      })
      .filter((x): x is NonNullable<typeof x> => x !== null)
      .filter(({ club }) => {
        if (!clubFilter) return true
        return club?.short_name === clubFilter
      })

    // Sort
    if (!cols.some((c) => c.key === sortField) && sortField !== 'name') {
      // sortField no longer in current column set — reset
    }
    return [...data].sort((a, b) => {
      if (sortField === 'name') {
        return sortDir * a.player.name.localeCompare(b.player.name)
      }
      const av = (a.d[sortField as keyof typeof a.d] as number | null) ?? -Infinity
      const bv = (b.d[sortField as keyof typeof b.d] as number | null) ?? -Infinity
      return sortDir * (av - bv)
    })
  }, [players, allStats, season, posFilter, clubFilter, sortField, sortDir, leagueIds, clubMap, cols])

  function handleSortClick(field: string) {
    if (sortField === field) {
      setSortDir((d) => (d === -1 ? 1 : -1))
    } else {
      setSortField(field)
      setSortDir(field === 'name' ? 1 : -1)
    }
  }

  const arrow = (key: string) =>
    sortField === key
      ? <span style={{ color: 'var(--accent)', marginLeft: '3px' }}>{sortDir < 0 ? '▼' : '▲'}</span>
      : null

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight mt-8 mb-1" style={{ color: 'var(--text)' }}>
        All stats
      </h1>
      <p className="text-sm mb-6" style={{ color: 'var(--text-dim)' }}>
        Filter and sort the full pool for one season (club league stats). Click any header to sort.
      </p>

      {/* ── Filters ────────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-2.5 mb-4 items-center">
        {[
          {
            label: 'Season',
            node: (
              <select style={selectStyle} value={season} onChange={(e) => setSeason(e.target.value)}>
                {[...seasons].reverse().map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            ),
          },
          {
            label: 'Position',
            node: (
              <select style={selectStyle} value={posFilter} onChange={(e) => { setPosFilter(e.target.value); setSortField('points_per_set') }}>
                <option value="">All positions</option>
                <option value="OH">Outside (OH)</option>
                <option value="OPP">Opposite (OPP)</option>
                <option value="MB">Middle (MB)</option>
                <option value="S">Setter (S)</option>
                <option value="L">Libero (L)</option>
              </select>
            ),
          },
          {
            label: 'Club',
            node: (
              <select style={selectStyle} value={clubFilter} onChange={(e) => setClubFilter(e.target.value)}>
                <option value="">All clubs</option>
                {clubs.map((c) => (
                  <option key={c.id} value={c.short_name}>{c.full_name}</option>
                ))}
              </select>
            ),
          },
        ].map(({ label, node }) => (
          <div key={label} className="flex flex-col gap-1">
            <label
              className="text-[10.5px] font-semibold uppercase"
              style={{ color: 'var(--text-faint)', letterSpacing: '.06em' }}
            >
              {label}
            </label>
            {node}
          </div>
        ))}

        {/* Count pill */}
        <span
          className="ml-auto text-[12.5px] px-3 py-1.5 rounded-full"
          style={{
            color:       'var(--text-dim)',
            background:  'var(--surface)',
            border:      '1px solid var(--border)',
          }}
        >
          {rows.length} players · {season}
        </span>
      </div>

      {/* ── Table ──────────────────────────────────────────────────────────── */}
      <div
        className="rounded-[var(--radius)] overflow-x-auto"
        style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
      >
        <table className="w-full border-collapse text-[13px] whitespace-nowrap">
          <thead>
            <tr>
              <th
                className="text-left px-3 py-2.5 text-[11px] font-semibold uppercase cursor-pointer sticky top-0"
                style={{ background: 'var(--surface-2)', color: 'var(--text-dim)', letterSpacing: '.06em' }}
                onClick={() => handleSortClick('name')}
              >
                Player {arrow('name')}
              </th>
              <th
                className="text-left px-3 py-2.5 text-[11px] font-semibold uppercase sticky top-0"
                style={{ background: 'var(--surface-2)', color: 'var(--text-dim)', letterSpacing: '.06em' }}
              >
                Pos
              </th>
              {cols.map((col) => (
                <th
                  key={col.key}
                  className="text-right px-3 py-2.5 text-[11px] font-semibold cursor-pointer select-none sticky top-0"
                  style={{ background: 'var(--surface-2)', color: 'var(--text-dim)', letterSpacing: '.06em' }}
                  onClick={() => handleSortClick(col.key)}
                  title={col.key}
                >
                  {col.label} {arrow(col.key)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td
                  colSpan={2 + cols.length}
                  className="text-center py-8 text-sm"
                  style={{ color: 'var(--text-faint)', borderTop: '1px solid var(--border)' }}
                >
                  No players match the current filters.
                </td>
              </tr>
            )}
            {rows.map(({ d, player, club }) => {
              const posStyle = POS_TAG_STYLE[player.primary_position] ?? {}
              return (
                <tr
                  key={player.id}
                  className="transition-colors duration-100"
                  style={{ ['--hover-bg' as string]: 'var(--surface-2)' }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--surface-2)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  <td
                    className="px-3 py-2.5 text-left"
                    style={{ borderTop: '1px solid var(--border)' }}
                  >
                    <div className="font-semibold" style={{ color: 'var(--text)' }}>
                      {player.name}
                    </div>
                    <div className="text-[11.5px]" style={{ color: 'var(--text-faint)' }}>
                      {club?.full_name ?? '—'} · {player.nationality}
                    </div>
                  </td>
                  <td
                    className="px-3 py-2.5 text-left"
                    style={{ borderTop: '1px solid var(--border)' }}
                  >
                    <span
                      className="inline-block text-[10.5px] font-bold px-1.5 py-0.5 rounded"
                      style={{ background: posStyle.bg, color: posStyle.color }}
                    >
                      {player.primary_position}
                    </span>
                  </td>
                  {cols.map((col) => {
                    const val = d[col.key as keyof typeof d] as number | null
                    return (
                      <td
                        key={col.key}
                        className="px-3 py-2.5 text-right tabular-nums"
                        style={{ borderTop: '1px solid var(--border)', color: val != null ? 'var(--text)' : 'var(--text-faint)' }}
                      >
                        {val != null ? fmtVal(val, col.fmt ?? 'num') : '—'}
                      </td>
                    )
                  })}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <p className="text-xs mt-3.5 leading-relaxed" style={{ color: 'var(--text-faint)' }}>
        Columns adapt to position — pick <b style={{ color: 'var(--text-dim)' }}>Libero</b> and
        attack columns give way to reception and digs.
      </p>
    </div>
  )
}
