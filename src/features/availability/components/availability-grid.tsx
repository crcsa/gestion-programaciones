import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { AvailabilityCell } from './availability-cell'
import type { AvailabilityGridRow } from '../actions/availability-types'

interface AvailabilityGridProps {
  rows: AvailabilityGridRow[]
  weekStart: string
}

function getWeekDates(weekStart: string): string[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(`${weekStart}T00:00:00`)
    d.setDate(d.getDate() + i)
    return d.toISOString().slice(0, 10)
  })
}

const DAY_NAMES = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

export function AvailabilityGrid({ rows, weekStart }: AvailabilityGridProps) {
  const weekDates = getWeekDates(weekStart)

  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-border p-4 text-sm text-muted-foreground">
        No hay colaboradores para mostrar.
      </div>
    )
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/50">
            <th className="sticky left-0 z-10 bg-muted/50 px-4 py-2 text-left font-medium text-muted-foreground min-w-[180px]">
              Colaborador
            </th>
            {weekDates.map((date, i) => (
              <th key={date} className="px-2 py-2 text-center font-medium text-muted-foreground min-w-[80px]">
                <div>{DAY_NAMES[i]}</div>
                <div className="text-xs font-normal">
                  {format(new Date(`${date}T00:00:00`), 'd/M', { locale: es })}
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.staffId} className="border-b border-border last:border-0 hover:bg-muted/20">
              <td className="sticky left-0 bg-background px-4 py-2">
                <div className="font-medium">{row.lastName}, {row.firstName}</div>
                <div className="text-xs text-muted-foreground capitalize">{row.staffProfile}</div>
              </td>
              {weekDates.map((date) => (
                <td key={date} className="px-2 py-1 text-center">
                  <AvailabilityCell data={row.days[date] ?? { status: 'libre' }} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
