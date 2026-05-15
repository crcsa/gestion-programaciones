import { requireAccess } from '@/features/auth/lib/require-access'
import {
  getWeeklySedeShifts,
  getActiveStaffList,
  getMonthlyShiftCounts,
} from '@/features/sede/actions/sede-shift-actions'
import { SedeShiftsClient } from '@/features/sede/components/sede-shifts-client'
import { getCurrentMondayIso } from '@/lib/date/week'

interface TurnosPageProps {
  searchParams: Promise<{ semana?: string }>
}

export default async function TurnosPage({ searchParams }: TurnosPageProps) {
  const { role } = await requireAccess({ roles: ['admin', 'admin_area'] })

  const params = await searchParams
  const weekStart = params.semana ?? getCurrentMondayIso()
  // Year/month locales (no UTC) — al usuario le importa "este mes en su huso".
  const today = new Date()
  const year = today.getFullYear()
  const month = today.getMonth() + 1

  const [initialData, staffList, monthlyCounts] = await Promise.all([
    getWeeklySedeShifts(weekStart),
    getActiveStaffList(),
    getMonthlyShiftCounts(year, month),
  ])

  return (
    <SedeShiftsClient
      initialData={initialData}
      initialWeekStart={weekStart}
      initialMonthlyCounts={monthlyCounts}
      initialYear={year}
      initialMonth={month}
      staffList={staffList}
      currentRole={role}
    />
  )
}
