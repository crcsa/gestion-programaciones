import { requireRole } from '@/features/auth/lib/require-role'
import { getCampaignsReport } from '@/features/reports/actions/report-actions'
import { getWeeklyBalances } from '@/features/hours/actions/hours-actions'
import { ReportsClient } from '@/features/reports/components/reports-client'

export default async function ReportesPage() {
  await requireRole(['admin', 'banco_sangre', 'comercial'])

  const today = new Date()

  // Get current week Monday
  const day = today.getDay()
  const diff = today.getDate() - day + (day === 0 ? -6 : 1)
  const monday = new Date(today)
  monday.setDate(diff)
  const weekStart = monday.toISOString().slice(0, 10)

  // Get first and last day of current month
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1)
    .toISOString()
    .slice(0, 10)
  const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0)
    .toISOString()
    .slice(0, 10)

  const [initialCampaigns, initialHoursRows] = await Promise.all([
    getCampaignsReport({ dateFrom: monthStart, dateTo: monthEnd }),
    getWeeklyBalances(weekStart),
  ])

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Reportes</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Consulta y exporta datos operativos
        </p>
      </div>
      <ReportsClient
        initialCampaigns={initialCampaigns}
        initialHoursRows={initialHoursRows}
      />
    </div>
  )
}
