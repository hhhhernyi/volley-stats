import { AllStatsView } from '@/components/all-stats/AllStatsView'
import { PLAYERS, CLUBS, getAllSeasonStats } from '@/lib/seed-data'

export default function AllStatsPage() {
  const allStats = getAllSeasonStats()

  return (
    <AllStatsView
      players={PLAYERS}
      clubs={CLUBS}
      allStats={allStats}
    />
  )
}
