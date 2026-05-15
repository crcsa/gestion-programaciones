import { requireAccess } from '@/features/auth/lib/require-access'
import { getCampaignsReport } from '@/features/reports/actions/report-actions'
import { getWeeklyBalances } from '@/features/hours/actions/hours-actions'
import { ReportsClient } from '@/features/reports/components/reports-client'
import { loadValidationRuntimeConfig } from '@/features/configuration/lib/runtime-config'
import { getCurrentMondayIso } from '@/lib/date/week'

export default async function ReportesPage() {
  await requireAccess({ roles: ['admin', 'admin_area', 'comercial'] })

  // Timezone-safe: monday-de-esta-semana sin shifts UTC.
  const weekStart = getCurrentMondayIso()

  // Month range: usamos LOCAL components para que "este mes" coincida con la
  // percepción del usuario en su huso (Colombia UTC-5). El día 1 y el último
  // día son strings YYYY-MM-DD construidos manualmente para evitar volver a
  // pasar por toISOString() (UTC).
  const today = new Date()
  const yearLocal = today.getFullYear()
  const monthLocal = today.getMonth() + 1
  const lastDayLocal = new Date(yearLocal, monthLocal, 0).getDate()
  const mm = String(monthLocal).padStart(2, '0')
  const monthStart = `${yearLocal}-${mm}-01`
  const monthEnd = `${yearLocal}-${mm}-${String(lastDayLocal).padStart(2, '0')}`

  const [initialCampaigns, initialHoursRows, cfg] = await Promise.all([
    getCampaignsReport({ dateFrom: monthStart, dateTo: monthEnd }),
    getWeeklyBalances(weekStart),
    loadValidationRuntimeConfig(),
  ])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Reportes</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Consulta y exporta datos operativos
        </p>
      </div>
      <ReportsClient
        initialCampaigns={initialCampaigns}
        initialHoursRows={initialHoursRows}
        contractHours={cfg.weeklyHours}
        extraHoursLimit={cfg.maxExtraHoursWeek}
      />
    </div>
  )
}
