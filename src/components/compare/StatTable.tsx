import React from 'react'
import type { AggregatedStats, Player, PlayerSeasonStats } from '@/lib/types'
import { STAT_GROUPS } from '@/lib/radar-config'
import { fmtVal, pctBg, pctText, computePercentile, lastName } from '@/lib/stats'

interface Props {
  d1: AggregatedStats
  d2: AggregatedStats
  p1: Player
  p2: Player
  allStats: PlayerSeasonStats[]
  allPlayers: Player[]
  leagueCompIds: ReadonlySet<number>
}

export function StatTable({ d1, d2, p1, p2, allStats, allPlayers, leagueCompIds }: Props) {
  const selfMode = d1.player_id === d2.player_id
  // Season strings ('2021/22') order correctly as plain string comparison
  const laterIs2 = d2.season >= d1.season

  /** Render one stat cell for a given player-season aggregate */
  function StatCell({
    d,
    player,
    val,
    otherVal,
    pct,
    fmt,
    lowGood,
    showDelta,
  }: {
    d: AggregatedStats
    player: Player
    val: number | null
    otherVal: number | null
    pct: number | null
    fmt: 'pct' | 'num'
    lowGood?: boolean
    showDelta: boolean
  }) {
    if (val == null) {
      return (
        <td className="px-3.5 py-2 text-center" style={{ borderTop: '1px solid var(--border)' }}>
          <span className="font-normal" style={{ color: 'var(--text-faint)' }}>—</span>
        </td>
      )
    }

    let deltaEl: React.ReactNode = null
    if (selfMode && showDelta && otherVal != null) {
      const diff = val - otherVal
      if (Math.abs(diff) > 1e-9) {
        const better = lowGood ? diff < 0 : diff > 0
        deltaEl = (
          <span
            className="text-[11px] font-semibold ml-1.5 tabular-nums"
            style={{ color: better ? 'var(--accent)' : 'var(--p1)' }}
          >
            {diff > 0 ? '▲' : '▼'}{fmtVal(Math.abs(diff), fmt)}
          </span>
        )
      }
    }

    return (
      <td className="px-3.5 py-2 text-center tabular-nums" style={{ borderTop: '1px solid var(--border)' }}>
        <span className="font-semibold" style={{ color: 'var(--text)' }}>
          {fmtVal(val, fmt)}
        </span>
        {pct != null && (
          <span
            className="inline-block min-w-[26px] px-1.5 py-px rounded text-[10.5px] font-semibold tabular-nums ml-1.5"
            style={{ background: pctBg(pct), color: pctText(pct) }}
          >
            {pct}
          </span>
        )}
        {deltaEl}
      </td>
    )
  }

  return (
    <div
      className="rounded-[var(--radius)] overflow-hidden mb-5"
      style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
    >
      <table className="w-full border-collapse text-[13.5px]">
        <thead>
          <tr>
            <th
              className="text-left text-[11px] uppercase font-semibold px-3.5 py-2.5"
              style={{ background: 'var(--surface-2)', color: 'var(--text-faint)', letterSpacing: '.06em' }}
            >
              Statistic
            </th>
            {([
              { d: d1, p: p1, colorVar: 'var(--p1)' },
              { d: d2, p: p2, colorVar: 'var(--p2)' },
            ] as const).map(({ d, p, colorVar }) => (
              <th
                key={`${d.player_id}-${d.season}`}
                className="text-center text-[11px] uppercase font-semibold px-3.5 py-2.5"
                style={{ background: 'var(--surface-2)', color: colorVar, letterSpacing: '.06em' }}
              >
                {lastName(p.name)}{' '}
                <span style={{ color: 'var(--text-faint)' }}>{d.season.slice(2)}</span>
                <span className="ml-1.5 text-[10px] font-normal" style={{ color: 'var(--text-faint)' }}>
                  ({d.sets_played} sets)
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {STAT_GROUPS.map((group) => {
            const anyVal = group.rows.some((r) => d1[r.key] != null || d2[r.key] != null)
            if (!anyVal) return null

            return (
              <React.Fragment key={group.title}>
                {/* Group header row */}
                <tr>
                  <td
                    colSpan={3}
                    className="text-[10.5px] font-bold uppercase px-3.5 py-1.5"
                    style={{
                      background: 'var(--surface-2)',
                      color: 'var(--text-faint)',
                      borderTop: '1px solid var(--border)',
                      letterSpacing: '.08em',
                    }}
                  >
                    {group.title}
                  </td>
                </tr>

                {/* Stat rows */}
                {group.rows.map((row) => {
                  const v1 = d1[row.key] as number | null
                  const v2 = d2[row.key] as number | null

                  const pct1 = computePercentile(
                    v1, row.key, p1.position_group, d1.season,
                    allStats, allPlayers, leagueCompIds, row.lowGood,
                  )
                  const pct2 = computePercentile(
                    v2, row.key, p2.position_group, d2.season,
                    allStats, allPlayers, leagueCompIds, row.lowGood,
                  )

                  return (
                    <tr key={row.key}>
                      <td
                        className="px-3.5 py-2 font-medium"
                        style={{ color: 'var(--text-dim)', borderTop: '1px solid var(--border)' }}
                      >
                        {row.label}
                      </td>
                      <StatCell
                        d={d1} player={p1} val={v1} otherVal={v2} pct={pct1}
                        fmt={row.fmt} lowGood={row.lowGood}
                        showDelta={selfMode && !laterIs2}
                      />
                      <StatCell
                        d={d2} player={p2} val={v2} otherVal={v1} pct={pct2}
                        fmt={row.fmt} lowGood={row.lowGood}
                        showDelta={selfMode && laterIs2}
                      />
                    </tr>
                  )
                })}
              </React.Fragment>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
