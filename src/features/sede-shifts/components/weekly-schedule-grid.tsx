'use client'

import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import { ShiftCell } from './shift-cell'
import { STAFF_PROFILE_LABELS } from '@/features/staff/lib/constants'
import type { StaffMember } from '@/lib/db/schema/staff-members'
import type { SedeShift } from '@/lib/db/schema/sede-shifts'
import type { UpsertShiftInput } from '../schemas/shift-schemas'

interface WeeklyScheduleGridProps {
  staff: StaffMember[]
  shifts: Record<string, SedeShift[]>
  weekDays: string[]
  onUpsert: (data: UpsertShiftInput) => Promise<void>
  onDelete: (shiftId: string) => Promise<void>
  isEditable: boolean
}

function formatDayHeader(dateStr: string): string {
  const date = parseISO(dateStr)
  const dayName = format(date, 'EEE', { locale: es })
  const dayNum = format(date, 'dd/MM')
  const capitalized = dayName.charAt(0).toUpperCase() + dayName.slice(1)
  return `${capitalized} ${dayNum}`
}

function findShiftForDay(
  staffShifts: SedeShift[] | undefined,
  day: string,
): SedeShift | undefined {
  if (!staffShifts) return undefined
  return staffShifts.find((s) => s.shiftDate === day)
}

export function WeeklyScheduleGrid({
  staff,
  shifts,
  weekDays,
  onUpsert,
  onDelete,
  isEditable,
}: WeeklyScheduleGridProps) {
  if (staff.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-8">
        No hay personal activo registrado
      </p>
    )
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-sm">
        <thead className="bg-muted/50">
          <tr>
            <th className="sticky left-0 z-10 bg-muted/50 px-3 py-2 text-left font-medium text-muted-foreground min-w-[180px]">
              Funcionario
            </th>
            {weekDays.map((day) => (
              <th
                key={day}
                className="px-2 py-2 text-center font-medium text-muted-foreground min-w-[140px]"
              >
                {formatDayHeader(day)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {staff.map((member) => (
            <tr key={member.id} className="hover:bg-muted/30 transition-colors">
              <td className="sticky left-0 z-10 bg-background px-3 py-2 border-r border-border">
                <div className="flex flex-col">
                  <span className="font-medium text-sm">
                    {member.firstName} {member.lastName}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {STAFF_PROFILE_LABELS[member.staffProfile] ?? member.staffProfile}
                  </span>
                </div>
              </td>
              {weekDays.map((day) => (
                <td key={day} className="border-l border-border p-0">
                  <ShiftCell
                    staffId={member.id}
                    shiftDate={day}
                    shift={findShiftForDay(shifts[member.id], day)}
                    onSave={onUpsert}
                    onDelete={onDelete}
                    isEditable={isEditable}
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
