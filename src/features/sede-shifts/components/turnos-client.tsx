'use client'

import { useState, useCallback, useEffect } from 'react'
import { format, addDays, startOfWeek } from 'date-fns'
import { toast } from 'sonner'
import { Skeleton } from '@/components/ui/skeleton'
import { WeekNavigator } from './week-navigator'
import { WeeklyScheduleGrid } from './weekly-schedule-grid'
import { getWeeklyShifts, upsertShift, deleteShift } from '../actions/shift-actions'
import type { UpsertShiftInput } from '../schemas/shift-schemas'
import type { StaffMember } from '@/lib/db/schema/staff-members'
import type { SedeShift } from '@/lib/db/schema/sede-shifts'
import type { Role } from '@/types/roles'

interface TurnosClientProps {
  currentRole: Role | null
}

function getDefaultWeekStart(): string {
  const monday = startOfWeek(new Date(), { weekStartsOn: 1 })
  return format(monday, 'yyyy-MM-dd')
}

function buildWeekDays(weekStart: string): string[] {
  const start = new Date(weekStart + 'T00:00:00')
  return Array.from({ length: 7 }, (_, i) => format(addDays(start, i), 'yyyy-MM-dd'))
}

export function TurnosClient({ currentRole }: TurnosClientProps) {
  const [weekStart, setWeekStart] = useState(getDefaultWeekStart)
  const [weekDays, setWeekDays] = useState(() => buildWeekDays(getDefaultWeekStart()))
  const [staffData, setStaffData] = useState<StaffMember[]>([])
  const [shiftsData, setShiftsData] = useState<Record<string, SedeShift[]>>({})
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const isEditable = currentRole === 'admin' || currentRole === 'banco_sangre'

  const fetchWeek = useCallback(async (start: string) => {
    setIsLoading(true)
    setError(null)
    try {
      const result = await getWeeklyShifts(start)
      setStaffData(result.staff)
      setShiftsData(result.shifts)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar los turnos')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchWeek(weekStart)
  }, [weekStart, fetchWeek])

  const handleWeekChange = useCallback((newWeekStart: string) => {
    setWeekStart(newWeekStart)
    setWeekDays(buildWeekDays(newWeekStart))
  }, [])

  const handleUpsert = useCallback(
    async (data: UpsertShiftInput) => {
      try {
        await upsertShift(data)
        toast.success('Turno guardado correctamente')
        await fetchWeek(weekStart)
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Error al guardar el turno')
      }
    },
    [fetchWeek, weekStart],
  )

  const handleDelete = useCallback(
    async (id: string) => {
      try {
        await deleteShift(id)
        toast.success('Turno eliminado correctamente')
        await fetchWeek(weekStart)
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Error al eliminar el turno')
      }
    },
    [fetchWeek, weekStart],
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Turnos en Sede</h1>
          <p className="text-muted-foreground text-sm">
            Programacion semanal de turnos
          </p>
        </div>
      </div>

      <WeekNavigator weekStart={weekStart} onChange={handleWeekChange} />

      {error !== null && (
        <p className="text-sm text-destructive">{error}</p>
      )}

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : (
        <WeeklyScheduleGrid
          staff={staffData}
          shifts={shiftsData}
          weekDays={weekDays}
          onUpsert={handleUpsert}
          onDelete={handleDelete}
          isEditable={isEditable}
        />
      )}
    </div>
  )
}
