import { cn } from '@/lib/utils'
import type { AvailabilityCellData, AvailabilityCellStatus } from '../actions/availability-types'

interface AvailabilityCellProps {
  data: AvailabilityCellData
}

const STATUS_STYLES: Record<AvailabilityCellStatus, string> = {
  libre:       'bg-background text-muted-foreground',
  en_sede:     'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
  en_campana:  'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
  vacaciones:  'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300',
  incapacidad: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
  licencia:    'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
}

const STATUS_LABELS: Record<AvailabilityCellStatus, string> = {
  libre:       '—',
  en_sede:     'Sede',
  en_campana:  'Campaña',
  vacaciones:  'Vacac.',
  incapacidad: 'Incap.',
  licencia:    'Licencia',
}

export function AvailabilityCell({ data }: AvailabilityCellProps) {
  const label = data.referenceCode ?? STATUS_LABELS[data.status]

  return (
    <div
      className={cn(
        'flex items-center justify-center rounded px-1 py-0.5 text-xs font-medium h-7 min-w-[64px]',
        STATUS_STYLES[data.status],
      )}
      title={data.referenceCode ? `Campaña ${data.referenceCode}` : undefined}
    >
      {label}
    </div>
  )
}
