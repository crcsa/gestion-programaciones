'use server'

import { eq, and, gte, lte } from 'drizzle-orm'
import { addDays, format } from 'date-fns'
import { db } from '@/lib/db'
import { sedeShifts } from '@/lib/db/schema/sede-shifts'
import { staffMembers } from '@/lib/db/schema/staff-members'
import { requireRole } from '@/features/auth/lib/require-role'
import { upsertShiftSchema } from '../schemas/shift-schemas'
import type { UpsertShiftInput } from '../schemas/shift-schemas'
import type { SedeShift } from '@/lib/db/schema/sede-shifts'
import type { StaffMember } from '@/lib/db/schema/staff-members'

// ---- Types ----------------------------------------------------------------

export interface WeeklyShiftsResult {
  staff: StaffMember[]
  shifts: Record<string, SedeShift[]>
}

export interface StaffOccupancy {
  staffId: string
  firstName: string
  lastName: string
  status: 'sede' | 'libre'
}

// ---- Helpers --------------------------------------------------------------

function getWeekEnd(weekStart: string): string {
  return format(addDays(new Date(weekStart + 'T00:00:00'), 6), 'yyyy-MM-dd')
}

function groupShiftsByStaff(shifts: SedeShift[]): Record<string, SedeShift[]> {
  const grouped: Record<string, SedeShift[]> = {}
  for (const shift of shifts) {
    const existing = grouped[shift.staffId] ?? []
    grouped[shift.staffId] = [...existing, shift]
  }
  return grouped
}

// ---- Actions --------------------------------------------------------------

export async function getWeeklyShifts(weekStart: string): Promise<WeeklyShiftsResult> {
  await requireRole(['admin', 'banco_sangre'])

  const weekEnd = getWeekEnd(weekStart)

  try {
    const [staff, shifts] = await Promise.all([
      db
        .select()
        .from(staffMembers)
        .where(eq(staffMembers.isActive, true))
        .orderBy(staffMembers.lastName),
      db
        .select()
        .from(sedeShifts)
        .where(
          and(
            gte(sedeShifts.shiftDate, weekStart),
            lte(sedeShifts.shiftDate, weekEnd),
          ),
        ),
    ])

    return { staff, shifts: groupShiftsByStaff(shifts) }
  } catch (error) {
    if (error instanceof Error && error.message.includes('permiso')) throw error
    throw new Error('Error al obtener los turnos semanales')
  }
}

export async function upsertShift(data: UpsertShiftInput): Promise<SedeShift> {
  const { userId } = await requireRole(['admin', 'banco_sangre'])

  const validated = upsertShiftSchema.safeParse(data)
  if (!validated.success) {
    throw new Error(validated.error.issues[0].message)
  }

  const input = validated.data

  if (input.totalHours > 12) {
    throw new Error('Maximo 12 horas por turno')
  }

  try {
    const existing = await db
      .select({ id: sedeShifts.id })
      .from(sedeShifts)
      .where(
        and(
          eq(sedeShifts.staffId, input.staffId),
          eq(sedeShifts.shiftDate, input.shiftDate),
        ),
      )
      .limit(1)

    if (existing.length > 0) {
      const [updated] = await db
        .update(sedeShifts)
        .set({
          shiftType: input.shiftType,
          startTime: input.startTime,
          endTime: input.endTime,
          totalHours: input.totalHours,
          isOvernight: input.isOvernight,
          notes: input.notes ?? null,
          updatedAt: new Date(),
        })
        .where(eq(sedeShifts.id, existing[0].id))
        .returning()

      return updated
    }

    const [created] = await db
      .insert(sedeShifts)
      .values({
        staffId: input.staffId,
        shiftDate: input.shiftDate,
        shiftType: input.shiftType,
        startTime: input.startTime,
        endTime: input.endTime,
        totalHours: input.totalHours,
        isOvernight: input.isOvernight,
        notes: input.notes ?? null,
        createdById: userId,
      })
      .returning()

    return created
  } catch (error) {
    if (error instanceof Error && (
      error.message.includes('permiso') ||
      error.message.includes('Maximo')
    )) {
      throw error
    }
    throw new Error('Error al guardar el turno')
  }
}

export async function deleteShift(id: string): Promise<void> {
  await requireRole(['admin', 'banco_sangre'])

  try {
    await db
      .delete(sedeShifts)
      .where(eq(sedeShifts.id, id))
  } catch (error) {
    if (error instanceof Error && error.message.includes('permiso')) throw error
    throw new Error('Error al eliminar el turno')
  }
}

export async function getStaffOccupancy(date: string): Promise<StaffOccupancy[]> {
  await requireRole(['admin', 'banco_sangre'])

  try {
    const staff = await db
      .select()
      .from(staffMembers)
      .where(eq(staffMembers.isActive, true))
      .orderBy(staffMembers.lastName)

    const shifts = await db
      .select({ staffId: sedeShifts.staffId })
      .from(sedeShifts)
      .where(eq(sedeShifts.shiftDate, date))

    const staffWithShift = new Set(shifts.map((s) => s.staffId))

    return staff.map((s) => ({
      staffId: s.id,
      firstName: s.firstName,
      lastName: s.lastName,
      status: staffWithShift.has(s.id) ? 'sede' as const : 'libre' as const,
    }))
  } catch (error) {
    if (error instanceof Error && error.message.includes('permiso')) throw error
    throw new Error('Error al obtener la ocupacion del personal')
  }
}
