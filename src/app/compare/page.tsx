import { CompareView } from '@/components/compare/CompareView'
import { PLAYERS, CLUBS, getAllSeasonStats } from '@/lib/seed-data'

/**
 * Compare page — server component that supplies initial data.
 * All interactivity (player selection, source checkboxes, radars) runs
 * inside the CompareView client component.
 */
export default function ComparePage() {
  const allStats = getAllSeasonStats()

  return (
    <CompareView
      players={PLAYERS}
      clubs={CLUBS}
      allStats={allStats}
    />
  )
}
