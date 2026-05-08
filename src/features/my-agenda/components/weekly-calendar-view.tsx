'use client'

import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type { MyAgendaData } from '../actions/my-agenda-actions'

interface WeeklyCalendarViewProps {
  shifts: MyAgendaData['sedeShiftsThisWeek']
  campaigns: MyAgendaData['upcomingCampaigns']
  coordinatorIds: string[]
}

interface CalendarItem {
  kind: 'shift' | 'campaign'
  title: string
  subtitle: string
  startTime: string | null
  endTime: string | null
  href?: string
  isCoordinator?: boolean
  isOvernight?: boolean
}

const DAY_LABELS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

function getMondayOfWeek(d: Date): Date {
  const copy = new Date(d)
  const day = copy.getDay()
  const diff = day === 0 ? -6 : 1 - day
  copy.setDate(copy.getDate() + diff)
  copy.setHours(0, 0, 0, 0)
  return copy
}

function toIsoDate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function compareTime(a: string | null, b: string | null): number {
  if (!a && !b) return 0
  if (!a) return 1
  if (!b) return -1
  return a.localeCompare(b)
}

export function WeeklyCalendarView({
  shifts,
  campaigns,
  coordinatorIds,
}: WeeklyCalendarViewProps) {
  const monday = getMondayOfWeek(new Date())
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday)
    d.setDate(d.getDate() + i)
    return d
  })

  const itemsByDate = new Map<string, CalendarItem[]>()
  for (const day of days) itemsByDate.set(toIsoDate(day), [])

  for (const shift of shifts) {
    const list = itemsByDate.get(shift.shiftDate)
    if (!list) continue
    list.push({
      kind: 'shift',
      title: 'Turno sede',
      subtitle: `${shift.shiftType.replace('_', ' ')}${shift.isOvernight ? ' · pernocta' : ''}`,
      startTime: shift.startTime,
      endTime: shift.endTime,
      isOvernight: shift.isOvernight,
    })
  }

  for (const c of campaigns) {
    const list = itemsByDate.get(c.campaignDate)
    if (!list) continue
    list.push({
      kind: 'campaign',
      title: c.code,
      subtitle: c.municipality,
      startTime: c.startTime,
      endTime: c.endTime,
      href: coordinatorIds.includes(c.campaignId) ? `/campanas/${c.campaignId}` : undefined,
      isCoordinator: c.isCoordinator,
    })
  }

  for (const list of itemsByDate.values()) {
    list.sort((a, b) => compareTime(a.startTime, b.startTime))
  }

  const todayIso = toIsoDate(new Date())

  return (
    <Card>
      <CardHeader>
        <CardTitle>Calendario de la semana</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-7">
          {days.map((day, i) => {
            const iso = toIsoDate(day)
            const items = itemsByDate.get(iso) ?? []
            const isToday = iso === todayIso

            return (
              <div
                key={iso}
                className={`rounded-md border p-2 min-h-32 ${
                  isToday ? 'border-primary bg-primary/5' : 'border-border'
                }`}
              >
                <div className="mb-2 flex items-baseline justify-between">
                  <span className="text-xs font-semibold uppercase text-muted-foreground">
                    {DAY_LABELS[i]}
                  </span>
                  <span
                    className={`text-sm font-bold ${isToday ? 'text-primary' : ''}`}
                  >
                    {day.getDate()}
                  </span>
                </div>

                {items.length === 0 ? (
                  <p className="text-xs text-muted-foreground/60">Sin actividades</p>
                ) : (
                  <ul className="space-y-1.5">
                    {items.map((it, idx) => {
                      const colorClass =
                        it.kind === 'shift'
                          ? 'border-blue-500/40 bg-blue-500/10 text-blue-900 dark:text-blue-200'
                          : 'border-red-500/40 bg-red-500/10 text-red-900 dark:text-red-200'

                      const body = (
                        <div className={`rounded border px-1.5 py-1 ${colorClass}`}>
                          <div className="flex items-baseline justify-between gap-1">
                            <span className="text-xs font-semibold truncate">{it.title}</span>
                            {it.isCoordinator && (
                              <Badge variant="secondary" className="text-[10px] py-0 px-1 h-4">
                                Coord
                              </Badge>
                            )}
                          </div>
                          <p className="text-[11px] opacity-80 truncate">{it.subtitle}</p>
                          {it.startTime && it.endTime && (
                            <p className="text-[11px] font-medium">
                              {it.startTime}–{it.endTime}
                            </p>
                          )}
                        </div>
                      )

                      return (
                        <li key={`${it.kind}-${idx}`}>
                          {it.href ? (
                            <Link
                              href={it.href}
                              className="block hover:opacity-80 transition-opacity"
                            >
                              {body}
                            </Link>
                          ) : (
                            body
                          )}
                        </li>
                      )
                    })}
                  </ul>
                )}
              </div>
            )
          })}
        </div>

        {/* Legend */}
        <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded border border-blue-500/40 bg-blue-500/10" />
            Turno sede
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded border border-red-500/40 bg-red-500/10" />
            Campaña
          </span>
        </div>
      </CardContent>
    </Card>
  )
}
