'use server'

import { eq, and, asc, gte, lte } from 'drizzle-orm'
import { db } from '@/lib/db'
import { sedeShifts } from '@/lib/db/schema/sede-shifts'
import { staffMembers } from '@/lib/db/schema/staff-members'
import { requireRole } from '@/features/auth/lib/require-role'
import {
  createSedeShiftSchema,
  updateSedeShiftSchema,
} from '@/features/sede/schemas/sede-shift-schemas'
import type { CreateSedeShiftInput, UpdateSedeShiftInput } from '@/features/sede/schemas/sede-shift-schemas'

// ---- Types ----------------------------------------------------------------

export interface SedeShiftRow {
  id: string
  staffId: string
  firstName: string
  lastName: string
  staffProfile: string
  shiftDate: string
  shiftType: 'diurno_completo' | 'noche' | 'posturno'
  startTime: string
  endTime: string
  totalHours: number
  isOvernight: boolean
  notes: string | null
}

export interface StaffListItem {
  id: string
  firstName: string
  lastName: string
  staffProfile: string
}

// ---- Constants ------------------------------------------------------------

const MAX_SHIFT_HOURS = 12
const MINUTES_PER_HOUR = 60
const HOURS_PER_DAY = 24
const DAYS_IN_WEEK = 6

// ---- Helpers --------------------------------------------------------------

function calcHours(startTime: string, endTime: string, isOvernight: boolean): number {
  const [sh, sm] = startTime.split(':').map(Number)
  const [eh, em] = endTime.split(':').map(Number)
  let mins = eh * MINUTES_PER_HOUR + em - (sh * MINUTES_PER_HOUR + sm)
  if (mins < 0 || isOvernight) {
    mins += HOURS_PER_DAY * MINUTES_PER_HOUR
  }
  return Math.min(MAX_SHIFT_HOURS, Math.round(mins / MINUTES_PER_HOUR))
}

function getWeekEnd(weekStart: string): string {
  const d = new Date(`${weekStart}T00:00:00`)
  d.setDate(d.getDate() + DAYS_IN_WEEK)
  return d.toISOString().slice(0, 10)
}

// ---- Actions --------------------------------------------------------------

export async function getActiveStaffList(): Promise<StaffListItem[]> {
  await requireRole(['admin', 'banco_sangre'])

  try {
    return await db
      .select({
        id: staffMembers.id,
        firstName: staffMembers.firstName,
        lastName: staffMembers.lastName,
        staffProfile: staffMembers.staffProfile,
      })
      .from(staffMembers)
      .where(eq(staffMembers.isActive, true))
      .orderBy(asc(staffMembers.lastName))
  } catch (error) {
    if (error instanceof Error && error.message.includes('permiso')) throw error
    throw new Error('Error al obtener la lista de funcionarios')
  }
}

export async function getWeeklySedeShifts(weekStart: string): Promise<SedeShiftRow[]> {
  await requireRole(['admin', 'banco_sangre'])

  try {
    const weekEnd = getWeekEnd(weekStart)

    const rows = await db
      .select({
        id: sedeShifts.id,
        staffId: sedeShifts.staffId,
        firstName: staffMembers.firstName,
        lastName: staffMembers.lastName,
        staffProfile: staffMembers.staffProfile,
        shiftDate: sedeShifts.shiftDate,
        shiftType: sedeShifts.shiftType,
        startTime: sedeShifts.startTime,
        endTime: sedeShifts.endTime,
        totalHours: sedeShifts.totalHours,
        isOvernight: sedeShifts.isOvernight,
        notes: sedeShifts.notes,
      })
      .from(sedeShifts)
      .leftJoin(staffMembers, eq(sedeShifts.staffId, staffMembers.id))
      .where(
        and(
          gte(sedeShifts.shiftDate, weekStart),
          lte(sedeShifts.shiftDate, weekEnd),
        ),
      )
      .orderBy(asc(sedeShifts.shiftDate), asc(staffMembers.lastName))

    return rows.map((r) => ({
      id: r.id,
      staffId: r.staffId,
      firstName: r.firstName ?? '',
      lastName: r.lastName ?? '',
      staffProfile: r.staffProfile ?? '',
      shiftDate: r.shiftDate,
      shiftType: r.shiftType,
      startTime: r.startTime,
      endTime: r.endTime,
      totalHours: r.totalHours,
      isOvernight: r.isOvernight,
      notes: r.notes,
    }))
  } catch (error) {
    if (error instanceof Error && error.message.includes('permiso')) throw error
    throw new Error('Error al obtener los turnos de la semana')
  }
}

export async function createSedeShift(data: CreateSedeShiftInput): Promise<void> {
  const { userId } = await requireRole(['admin', 'banco_sangre'])

  try {
    const parsed = createSedeShiftSchema.parse(data)
    const totalHours = calcHours(parsed.startTime, parsed.endTime, parsed.isOvernight)

    await db.insert(sedeShifts).values({
      staffId: parsed.staffId,
      shiftDate: parsed.shiftDate,
      shiftType: parsed.shiftType,
      startTime: parsed.startTime,
      endTime: parsed.endTime,
      totalHours,
      isOvernight: parsed.isOvernight,
      notes: parsed.notes ?? null,
      createdById: userId,
    })
  } catch (error) {
    if (error instanceof Error && error.message.includes('permiso')) throw error
    if (error instanceof Error && error.name === 'ZodError') {
      throw new Error('Datos de turno inválidos')
    }
    throw new Error('Error al crear el turno')
  }
}

export async function updateSedeShift(id: string, data: UpdateSedeShiftInput): Promise<void> {
  await requireRole(['admin', 'banco_sangre'])

  try {
    const parsed = updateSedeShiftSchema.parse(data)

    const updateValues: Record<string, unknown> = {
      ...parsed,
      updatedAt: new Date(),
    }

    if (parsed.startTime && parsed.endTime) {
      updateValues.totalHours = calcHours(
        parsed.startTime,
        parsed.endTime,
        parsed.isOvernight ?? false,
      )
    }

    const result = await db
      .update(sedeShifts)
      .set(updateValues)
      .where(eq(sedeShifts.id, id))
      .returning({ id: sedeShifts.id })

    if (result.length === 0) {
      throw new Error('Turno no encontrado')
    }
  } catch (error) {
    if (error instanceof Error && error.message === 'Turno no encontrado') throw error
    if (error instanceof Error && error.message.includes('permiso')) throw error
    if (error instanceof Error && error.name === 'ZodError') {
      throw new Error('Datos de turno inválidos')
    }
    throw new Error('Error al actualizar el turno')
  }
}

export async function deleteSedeShift(id: string): Promise<void> {
  await requireRole(['admin', 'banco_sangre'])

  try {
    const result = await db
      .delete(sedeShifts)
      .where(eq(sedeShifts.id, id))
      .returning({ id: sedeShifts.id })

    if (result.length === 0) {
      throw new Error('Turno no encontrado')
    }
  } catch (error) {
    if (error instanceof Error && error.message === 'Turno no encontrado') throw error
    if (error instanceof Error && error.message.includes('permiso')) throw error
    throw new Error('Error al eliminar el turno')
  }
}
