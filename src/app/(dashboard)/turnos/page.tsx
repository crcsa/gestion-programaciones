import { requireRole } from '@/features/auth/lib/require-role'
import {
  getWeeklySedeShifts,
  getActiveStaffList,
} from '@/features/sede/actions/sede-shift-actions'
import { SedeShiftsClient } from '@/features/sede/components/sede-shifts-client'

interface TurnosPageProps {
  searchParams: Promise<{ semana?: string }>
}

function getCurrentWeekMonday(): string {
  const d = new Date()
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  return d.toISOString().slice(0, 10)
}

export default async function TurnosPage({ searchParams }: TurnosPageProps) {
  const { role } = await requireRole(['admin', 'banco_sangre'])

  const params = await searchParams
  const weekStart = params.semana ?? getCurrentWeekMonday()

  const [initialData, staffList] = await Promise.all([
    getWeeklySedeShifts(weekStart),
    getActiveStaffList(),
  ])

  return (
    <SedeShiftsClient
      initialData={initialData}
      initialWeekStart={weekStart}
      staffList={staffList}
      currentRole={role}
    />
  )
}
