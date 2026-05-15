import { AlertTriangle } from 'lucide-react'
import type { CriticalAlerts } from '../lib/dashboard-queries'

interface DashboardAlertBarProps {
  alerts: CriticalAlerts
}

export function DashboardAlertBar({ alerts }: DashboardAlertBarProps) {
  const total =
    alerts.overExtras +
    alerts.nearSundayLimit +
    alerts.nearOvernightLimit +
    alerts.campaignsWithoutCoordinator

  if (total === 0) return null

  const segments: string[] = []
  if (alerts.overExtras > 0) {
    segments.push(
      `${alerts.overExtras} con horas extra en el periodo`,
    )
  }
  if (alerts.nearSundayLimit > 0) {
    segments.push(
      `${alerts.nearSundayLimit} cerca de tope de domingos`,
    )
  }
  if (alerts.nearOvernightLimit > 0) {
    segments.push(
      `${alerts.nearOvernightLimit} cerca de tope de pernoctas`,
    )
  }
  if (alerts.campaignsWithoutCoordinator > 0) {
    segments.push(
      `${alerts.campaignsWithoutCoordinator} campañas próximas sin coordinador`,
    )
  }

  return (
    <div className="flex items-start gap-3 rounded-lg border border-yellow-500/40 bg-yellow-500/10 px-4 py-3 text-sm text-yellow-700 dark:text-yellow-400">
      <AlertTriangle className="mt-0.5 size-5 shrink-0 text-yellow-500" />
      <div className="flex-1">
        <p className="font-medium">
          {total} alerta{total === 1 ? '' : 's'} operativa{total === 1 ? '' : 's'}
        </p>
        <p className="text-xs opacity-90">{segments.join(' · ')}</p>
      </div>
    </div>
  )
}
