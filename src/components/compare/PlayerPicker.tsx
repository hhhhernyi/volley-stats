'use client'

import React from 'react'
import { Combobox } from '@base-ui/react/combobox'
import type { Player, Club, PlayerSeasonStats } from '@/lib/types'
import { POS_LABEL, seasonsForPlayer } from '@/lib/helpers'

interface Props {
  slot: 1 | 2
  players: Player[]
  clubs: Club[]
  allStats: PlayerSeasonStats[]
  selectedPlayerId: number | null
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

/** Diacritic-insensitive lowercase for name search (Možič ↔ mozic) */
function norm(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
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

  const selected = selectedPlayerId != null
    ? players.find((p) => p.id === selectedPlayerId) ?? null
    : null

  const availableSeasons = selectedPlayerId != null
    ? seasonsForPlayer(selectedPlayerId, allStats)
    : []

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

      {/* Player combobox + season row */}
      <div className="grid gap-2" style={{ gridTemplateColumns: '1fr 110px' }}>
        <Combobox.Root
          items={filteredPlayers}
          value={selected}
          onValueChange={(p: Player | null) => {
            if (p) onPlayerChange(p.id)
          }}
          itemToStringLabel={(p: Player) => p.name}
          isItemEqualToValue={(a: Player, b: Player) => a.id === b.id}
          filter={(p: Player, query: string) => norm(p.name).includes(norm(query))}
          autoHighlight
        >
          <Combobox.InputGroup
            className="relative"
            style={{
              background: 'var(--surface-2)',
              border: '1px solid var(--border-2)',
              borderRadius: 'var(--radius-sm)',
            }}
          >
            <Combobox.Input
              placeholder="Type to search players…"
              aria-label={`Player ${slot}`}
              className="w-full bg-transparent outline-none"
              style={{
                color: 'var(--text)',
                padding: '9px 34px 9px 11px',
                fontSize: '14px',
                fontFamily: 'inherit',
              }}
            />
            <Combobox.Trigger
              aria-label="Open player list"
              className="absolute right-0 top-0 h-full w-[30px] flex items-center justify-center cursor-pointer bg-transparent border-0"
              style={{ color: 'var(--text-faint)' }}
            >
              <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
                <path d="M12 6H4l4 4.5z" />
              </svg>
            </Combobox.Trigger>
          </Combobox.InputGroup>

          <Combobox.Portal>
            <Combobox.Positioner className="isolate z-50 outline-none" sideOffset={4}>
              <Combobox.Popup
                className="max-h-[min(20rem,var(--available-height))] w-(--anchor-width) overflow-y-auto overscroll-contain rounded-[var(--radius-sm)] py-1 shadow-lg"
                style={{
                  background: 'var(--surface)',
                  border: '1px solid var(--border-2)',
                  color: 'var(--text)',
                }}
              >
                <Combobox.Empty
                  className="px-3 py-2.5 text-[13px]"
                  style={{ color: 'var(--text-faint)' }}
                >
                  No players found.
                </Combobox.Empty>
                <Combobox.List>
                  {(p: Player) => (
                    <Combobox.Item
                      key={p.id}
                      value={p}
                      className="flex items-baseline gap-2 px-3 py-1.5 text-[13.5px] cursor-pointer select-none outline-none data-highlighted:bg-(--surface-2)"
                    >
                      <span>{p.name}</span>
                      <span className="text-[11px]" style={{ color: 'var(--text-faint)' }}>
                        {p.primary_position ?? '—'}
                      </span>
                    </Combobox.Item>
                  )}
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>

        <select
          style={{ ...selectStyle, fontSize: '13px' }}
          value={selectedSeason}
          onChange={(e) => onSeasonChange(e.target.value)}
          disabled={selectedPlayerId == null}
        >
          {availableSeasons.length === 0 && <option value="">Season</option>}
          {[...availableSeasons].reverse().map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>
    </div>
  )
}
