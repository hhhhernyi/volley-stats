import type { Player, Club, AggregatedStats } from '@/lib/types'
import { initials, fmtDob, computeAge } from '@/lib/stats'
import { POS_LABEL, natInfo } from '@/lib/helpers'

interface Props {
  player: Player
  aggregated: AggregatedStats
  club: Club | null
  ntEvent: string | null
  /** 1 = red, 2 = blue */
  slot: 1 | 2
}

export function BioCard({ player, aggregated: agg, club, ntEvent, slot }: Props) {
  const accent = slot === 1 ? 'var(--p1)' : 'var(--p2)'
  const softBg = slot === 1 ? 'var(--p1-soft)' : 'var(--p2-soft)'
  const nat = natInfo(player.nationality)

  return (
    <div
      className="rounded-[var(--radius)] p-4 flex gap-3.5"
      style={{
        background:   'var(--surface)',
        border:       '1px solid var(--border)',
        borderLeft:   `3px solid ${accent}`,
        alignItems:   'flex-start',
      }}
    >
      {/* Avatar */}
      <div
        className="w-14 h-14 rounded-full flex items-center justify-center font-bold text-lg tracking-tight flex-shrink-0"
        style={{ background: softBg, color: accent, border: `1.5px solid ${accent}` }}
      >
        {player.image_url
          ? <img src={player.image_url} alt={player.name} className="w-full h-full rounded-full object-cover" />
          : initials(player.name)
        }
      </div>

      {/* Bio info */}
      <div className="flex-1 min-w-0">
        <div className="text-[17px] font-bold tracking-tight leading-tight" style={{ color: 'var(--text)' }}>
          {player.name}
        </div>
        <span
          className="inline-block text-[11px] font-semibold px-1.5 py-0.5 rounded mt-1"
          style={{ background: 'var(--surface-2)', color: 'var(--text-dim)' }}
        >
          {player.primary_position ? POS_LABEL[player.primary_position] : 'Position unknown'}
        </span>

        {/* Stats grid */}
        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-[12.5px]">
          {player.height_cm && (
            <span className="flex gap-1">
              <span style={{ color: 'var(--text-faint)' }}>Height</span>
              <span className="font-semibold" style={{ color: 'var(--text)' }}>{player.height_cm} cm</span>
            </span>
          )}
          {player.weight_kg && (
            <span className="flex gap-1">
              <span style={{ color: 'var(--text-faint)' }}>Weight</span>
              <span className="font-semibold" style={{ color: 'var(--text)' }}>{player.weight_kg} kg</span>
            </span>
          )}
          {player.birthday && (
            <>
              <span className="flex gap-1">
                <span style={{ color: 'var(--text-faint)' }}>Born</span>
                <span className="font-semibold" style={{ color: 'var(--text)' }}>{fmtDob(player.birthday)}</span>
              </span>
              <span className="flex gap-1">
                <span style={{ color: 'var(--text-faint)' }}>Age</span>
                <span className="font-semibold" style={{ color: 'var(--text)' }}>{computeAge(player.birthday)}</span>
              </span>
            </>
          )}
        </div>

        {/* Affiliations */}
        <div className="flex flex-col gap-1.5 mt-2.5">
          {club && (
            <div className="flex items-center gap-2 text-[12.5px]">
              {/* Monogram crest */}
              <span
                className="w-[22px] h-[22px] rounded-[5px] flex items-center justify-center text-[10px] font-extrabold flex-shrink-0 text-white"
                style={{ background: club.brand_color ?? '#666' }}
              >
                {club.short_name.replace('Cucine ', '').slice(0, 2).toUpperCase()}
              </span>
              <span className="font-medium" style={{ color: 'var(--text)' }}>{club.full_name}</span>
              <span
                className="text-[10.5px] uppercase tracking-widest ml-auto"
                style={{ color: 'var(--text-faint)', letterSpacing: '.05em' }}
              >
                Club
              </span>
            </div>
          )}
          <div className="flex items-center gap-2 text-[12.5px]">
            <span className="text-[17px] leading-none w-[22px] text-center flex-shrink-0">{nat.flag}</span>
            <span className="font-medium" style={{ color: 'var(--text)' }}>{nat.full}</span>
            {ntEvent && (
              <span
                className="text-[10.5px] uppercase tracking-widest ml-auto"
                style={{ color: 'var(--text-faint)', letterSpacing: '.05em' }}
              >
                {ntEvent}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
