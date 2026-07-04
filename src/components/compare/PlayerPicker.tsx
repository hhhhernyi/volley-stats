'use client'

import React from 'react'
import type { Player, Club, PlayerSeasonStats } from '@/lib/types'
import { POS_LABEL, seasonsForPlayer } from '@/lib/helpers'

interface Props {
  slot: 1 | 2
  players: Player[]
  clubs: Club[]
  allStats: PlayerSeasonStats[]
  selectedPlayerId: number
  selectedSeason: string
  onPlayerChange: (playerId: number) => void
  onSeasonChange: (season: string) => void
}

const selectStyle: React.CSSProperties = {
  width: '100%',
  background: 'var(--surface-2)',
  color: 'var(--text)',
  border: '1px solid var(--border-2)',
  borderRadius: 'var(--radius-sm)',
  padding: '9px 11px',
  fontSize: '14px',
  cursor: 'pointer',
  fontFamily: 'inherit',
}

const filterSelectStyle: React.CSSProperties = {
  ...selectStyle,
  fontSize: '12.5px',
  padding: '7px 9px',
}

export function PlayerPicker({
  slot,
  players,
  clubs,
  allStats,
  selectedPlayerId,
  selectedSeason,
  onPlayerChange,
  onSeasonChange,
}: Props) {
  const color = slot === 1 ? 'var(--p1)' : 'var(--p2)'

  // Local filter state
  const [posFilter, setPosFilter] = React.useState('')
  const [clubFilter, setClubFilter] = React.useState('')

  const filteredPlayers = players.filter((p) => {
    if (posFilter && p.primary_position !== posFilter) return false
    if (clubFilter) {
      const club = clubs.find((c) => c.short_name === clubFilter)
      if (!club) return false
      const hasClubRow = allStats.some((r) => r.player_id === p.id && r.club_id === club.id)
      if (!hasClubRow) return false
    }
    return true
  })

  const availableSeasons = seasonsForPlayer(selectedPlayerId, allStats)

  return (
    <div
      className="rounded-[var(--radius)] p-4"
      style={{
        background: 'var(--surface)',
        border: `1px solid var(--border)`,
        borderTop: `3px solid ${color}`,
      }}
    >
      <div
        className="text-[11px] font-semibold uppercase tracking-widest mb-2"
        style={{ color: 'var(--text-faint)', letterSpacing: '.08em' }}
      >
        Player {slot}
      </div>

      {/* Position + club filters */}
      <div className="flex gap-2 mb-2">
        <select
          style={filterSelectStyle}
          value={posFilter}
          onChange={(e) => {
            setPosFilter(e.target.value)
            setClubFilter('')
          }}
        >
          <option value="">All positions</option>
          {Object.entries(POS_LABEL).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
        <select
          style={filterSelectStyle}
          value={clubFilter}
          onChange={(e) => setClubFilter(e.target.value)}
        >
          <option value="">All clubs</option>
          {clubs.map((c) => (
            <option key={c.id} value={c.short_name}>{c.full_name}</option>
          ))}
        </select>
      </div>

      {/* Player + season row */}
      <div className="grid gap-2" style={{ gridTemplateColumns: '1fr 110px' }}>
        <select
          style={selectStyle}
          value={selectedPlayerId}
          onChange={(e) => onPlayerChange(Number(e.target.value))}
        >
          {filteredPlayers.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} · {p.primary_position}
            </option>
          ))}
        </select>
        <select
          style={{ ...selectStyle, fontSize: '13px' }}
          value={selectedSeason}
          onChange={(e) => onSeasonChange(e.target.value)}
        >
          {[...availableSeasons].reverse().map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>
    </div>
  )
}
