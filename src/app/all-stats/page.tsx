import { AllStatsView } from '@/components/all-stats/AllStatsView'
import { getAppData } from '@/lib/data'

export default async function AllStatsPage() {
  const { players, clubs, competitions, allStats } = await getAppData()

  return (
    <AllStatsView
      players={players}
      clubs={clubs}
      competitions={competitions}
      allStats={allStats}
    />
  )
}
