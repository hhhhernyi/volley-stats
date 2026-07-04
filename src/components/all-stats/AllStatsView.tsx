'use client'

import { useState, useMemo } from 'react'
import { Select } from '@base-ui/react/select'
import type { Player, Club, Competition, PlayerSeasonStats } from '@/lib/types'
import { POS_LABEL, distinctSeasons, getClubMap, leagueCompetitionIds } from '@/lib/helpers'
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

// ── Multi-select filter dropdown (tick any number of options) ────────────────

interface MultiSelectProps {
  options: { value: string; label: string }[]
  selected: string[]
  onChange: (values: string[]) => void
  /** Trigger text when nothing is ticked (= no filtering) */
  allLabel: string
}

function MultiSelect({ options, selected, onChange, allLabel }: MultiSelectProps) {
  const summary =
    selected.length === 0 ? allLabel :
    selected.length === 1 ? (options.find((o) => o.value === selected[0])?.label ?? selected[0]) :
    `${selected.length} selected`

  return (
    <Select.Root
      multiple
      value={selected}
      onValueChange={(values: string[]) => onChange(values)}
    >
      <Select.Trigger
        className="flex items-center justify-between gap-2 cursor-pointer min-w-[140px]"
        style={{
          background:   'var(--surface-2)',
          color:        'var(--text)',
          border:       '1px solid var(--border-2)',
          borderRadius: 'var(--radius-sm)',
          padding:      '7px 10px',
          fontSize:     '13px',
          fontFamily:   'inherit',
        }}
      >
        <span className={selected.length > 0 ? '' : 'opacity-80'}>{summary}</span>
        <svg width="10" height="10" viewBox="0 0 16 16" fill="currentColor" aria-hidden
          style={{ color: 'var(--text-faint)', flexShrink: 0 }}>
          <path d="M12 6H4l4 4.5z" />
        </svg>
      </Select.Trigger>
      <Select.Portal>
        <Select.Positioner className="isolate z-50 outline-none" sideOffset={4} alignItemWithTrigger={false}>
          <Select.Popup
            className="max-h-[min(20rem,var(--available-height))] min-w-(--anchor-width) overflow-y-auto overscroll-contain rounded-[var(--radius-sm)] py-1 shadow-lg"
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--border-2)',
              color: 'var(--text)',
            }}
          >
            {options.map((o) => (
              <Select.Item
                key={o.value}
                value={o.value}
                className="grid grid-cols-[16px_1fr] items-center gap-2 px-3 py-1.5 text-[13px] cursor-pointer select-none outline-none data-highlighted:bg-(--surface-2)"
              >
                <Select.ItemIndicator className="col-start-1">
                  <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                    <path d="m2.5 8.5 4 4 7-9" />
                  </svg>
                </Select.ItemIndicator>
                <Select.ItemText className="col-start-2">{o.label}</Select.ItemText>
              </Select.Item>
            ))}
          </Select.Popup>
        </Select.Positioner>
      </Select.Portal>
    </Select.Root>
  )
}

interface Props {
  players:      Player[]
  clubs:        Club[]
  competitions: Competition[]
  allStats:     PlayerSeasonStats[]
}

export function AllStatsView({ players, clubs, competitions, allStats }: Props) {
  const allSeasons = useMemo(() => distinctSeasons(allStats), [allStats])

  const [seasons,     setSeasons]     = useState<string[]>(() => allSeasons.slice(-1))
  const [positions,   setPositions]   = useState<string[]>([])
  const [clubFilters, setClubFilters] = useState<string[]>([])
  const [sortField, setSortField] = useState<string>('points_per_set')
  const [sortDir,  setSortDir]  = useState<-1 | 1>(-1)

  const leagueIds = useMemo(() => leagueCompetitionIds(competitions), [competitions])
  const clubMap   = useMemo(() => getClubMap(clubs), [clubs])

  // Empty selection = no filtering
  const effectiveSeasons = seasons.length > 0 ? seasons : allSeasons
  const multiSeason = effectiveSeasons.length > 1

  // Pick columns based on position filter (specialised sets only when
  // exactly that one position is ticked)
  const cols = positions.length === 1 && positions[0] === 'L' ? LEAD_COLS_LIBERO
             : positions.length === 1 && positions[0] === 'S' ? LEAD_COLS_SETTER
             : LEAD_COLS_DEFAULT

  // Build leaderboard rows — one row per player per selected season
  const rows = useMemo(() => {
    const data = players
      .filter((p) => positions.length === 0 || positions.includes(p.primary_position))
      .flatMap((p) =>
        effectiveSeasons.map((season) => {
          const d = aggregateStats(allStats, p.id, season, leagueIds, false)
          if (!d) return null
          // Find club for this player/season
          const statsRow = allStats.find(
            (r) => r.player_id === p.id && r.season === season && r.club_id != null,
          )
          const club = statsRow?.club_id ? clubMap.get(statsRow.club_id) : undefined
          return { d, player: p, club, season }
        }),
      )
      .filter((x): x is NonNullable<typeof x> => x !== null)
      .filter(({ club }) => {
        if (clubFilters.length === 0) return true
        return club != null && clubFilters.includes(club.short_name)
      })

    return [...data].sort((a, b) => {
      if (sortField === 'name') {
        return sortDir * a.player.name.localeCompare(b.player.name)
      }
      const av = (a.d[sortField as keyof typeof a.d] as number | null) ?? -Infinity
      const bv = (b.d[sortField as keyof typeof b.d] as number | null) ?? -Infinity
      return sortDir * (av - bv)
    })
  }, [players, allStats, effectiveSeasons, positions, clubFilters, sortField, sortDir, leagueIds, clubMap])

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

  const seasonsLabel =
    seasons.length === 0 ? 'all seasons' :
    [...seasons].sort().join(', ')

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight mt-8 mb-1" style={{ color: 'var(--text)' }}>
        All stats
      </h1>
      <p className="text-sm mb-6" style={{ color: 'var(--text-dim)' }}>
        Filter and sort the full pool (club league stats). Tick any combination of seasons,
        positions, and clubs — leaving a filter empty includes everything. Click any header to sort.
      </p>

      {/* ── Filters ────────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-2.5 mb-4 items-center">
        {[
          {
            label: 'Seasons',
            node: (
              <MultiSelect
                options={[...allSeasons].reverse().map((s) => ({ value: s, label: s }))}
                selected={seasons}
                onChange={setSeasons}
                allLabel="All seasons"
              />
            ),
          },
          {
            label: 'Positions',
            node: (
              <MultiSelect
                options={Object.entries(POS_LABEL).map(([k, v]) => ({ value: k, label: `${v} (${k})` }))}
                selected={positions}
                onChange={(v) => { setPositions(v); setSortField('points_per_set') }}
                allLabel="All positions"
              />
            ),
          },
          {
            label: 'Clubs',
            node: (
              <MultiSelect
                options={clubs.map((c) => ({ value: c.short_name, label: c.full_name }))}
                selected={clubFilters}
                onChange={setClubFilters}
                allLabel="All clubs"
              />
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
          {rows.length} rows · {seasonsLabel}
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
            {rows.map(({ d, player, club, season }) => {
              const posStyle = POS_TAG_STYLE[player.primary_position] ?? {}
              return (
                <tr
                  key={`${player.id}-${season}`}
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
                      {multiSeason && (
                        <span
                          className="inline-block text-[10.5px] font-bold px-1.5 py-0.5 rounded ml-2 align-middle"
                          style={{ background: 'var(--surface-2)', color: 'var(--text-dim)' }}
                        >
                          {season}
                        </span>
                      )}
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
        Columns adapt to position — tick only <b style={{ color: 'var(--text-dim)' }}>Libero</b> and
        attack columns give way to reception and digs. With multiple seasons ticked, each
        player-season is its own row.
      </p>
    </div>
  )
}
