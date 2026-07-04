import { CompareView } from '@/components/compare/CompareView'
import { getAppData } from '@/lib/data'

/**
 * Compare page — server component that supplies data from Supabase.
 * All interactivity (player selection, source checkboxes, radars) runs
 * inside the CompareView client component.
 */
export default async function ComparePage() {
  const { players, clubs, competitions, allStats } = await getAppData()

  return (
    <CompareView
      players={players}
      clubs={clubs}
      competitions={competitions}
      allStats={allStats}
    />
  )
}
