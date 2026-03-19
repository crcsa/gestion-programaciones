'use server'

import { eq, and, gte, lte } from 'drizzle-orm'
import { db } from '@/lib/db'
import { staffMembers, staffTrainingAreas } from '@/lib/db/schema/staff-members'
import { staffAvailability } from '@/lib/db/schema/staff-availability'
import { sedeShifts } from '@/lib/db/schema/sede-shifts'
import { campaignAssignments } from '@/lib/db/schema/campaign-assignments'
import { campaigns } from '@/lib/db/schema/campaigns'
import { requireRole } from '@/features/auth/lib/require-role'
import { setAvailabilityOverrideSchema, weeklyAvailabilityGridSchema } from '../schemas/availability-schemas'

// ---- Types ----------------------------------------------------------------

export type AvailabilityCellStatus =
  | 'libre'
  | 'en_sede'
  | 'en_campana'
  | 'vacaciones'
  | 'incapacidad'
  | 'licencia'

export interface AvailabilityCellData {
  status: AvailabilityCellStatus
  referenceCode?: string
}

export interface AvailabilityGridRow {
  staffId: string
  firstName: string
  lastName: string
  staffProfile: string
  days: Record<string, AvailabilityCellData>  // key: 'YYYY-MM-DD'
}

// ---- Helpers --------------------------------------------------------------

function getWeekDates(weekStart: string): string[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(`${weekStart}T00:00:00`)
    d.setDate(d.getDate() + i)
    return d.toISOString().slice(0, 10)
  })
}

// ---- Actions --------------------------------------------------------------

export async function getWeeklyAvailabilityGrid(params: {
  weekStart: string
  staffProfile?: string
  trainingAreaId?: string
}): Promise<AvailabilityGridRow[]> {
  await requireRole(['admin', 'banco_sangre'])

  const validated = weeklyAvailabilityGridSchema.safeParse(params)
  if (!validated.success) {
    throw new Error(validated.error.issues[0].message)
  }

  const { weekStart, staffProfile, trainingAreaId } = validated.data
  const weekDates = getWeekDates(weekStart)
  const weekEnd = weekDates[6]

  try {
    let staffQuery = db
      .select({
        id: staffMembers.id,
        firstName: staffMembers.firstName,
        lastName: staffMembers.lastName,
        staffProfile: staffMembers.staffProfile,
      })
      .from(staffMembers)
      .where(eq(staffMembers.isActive, true))
      .$dynamic()

    if (staffProfile) {
      staffQuery = staffQuery.where(
        and(
          eq(staffMembers.isActive, true),
          eq(staffMembers.staffProfile, staffProfile as 'bacteriologo' | 'tecnico' | 'medico' | 'auxiliar' | 'coordinador'),
        ),
      )
    }

    let allStaff = await staffQuery

    // Filter by training area if provided
    if (trainingAreaId) {
      const areaStaff = await db
        .select({ staffId: staffTrainingAreas.staffId })
        .from(staffTrainingAreas)
        .where(eq(staffTrainingAreas.trainingAreaId, trainingAreaId))
      const areaStaffIds = new Set(areaStaff.map((a) => a.staffId))
      allStaff = allStaff.filter((s) => areaStaffIds.has(s.id))
    }

    // Batch fetch overrides for the week
    const overrides = await db
      .select({
        staffId: staffAvailability.staffId,
        date: staffAvailability.availabilityDate,
        status: staffAvailability.status,
      })
      .from(staffAvailability)
      .where(
        and(
          gte(staffAvailability.availabilityDate, weekStart),
          lte(staffAvailability.availabilityDate, weekEnd),
        ),
      )

    const overrideMap = overrides.reduce<Record<string, Record<string, string>>>(
      (acc, row) => ({
        ...acc,
        [row.staffId]: { ...(acc[row.staffId] ?? {}), [row.date]: row.status },
      }),
      {},
    )

    // Batch fetch sede shifts for the week
    const shifts = await db
      .select({ staffId: sedeShifts.staffId, shiftDate: sedeShifts.shiftDate })
      .from(sedeShifts)
      .where(
        and(
          gte(sedeShifts.shiftDate, weekStart),
          lte(sedeShifts.shiftDate, weekEnd),
        ),
      )

    const shiftMap = shifts.reduce<Record<string, Set<string>>>((acc, row) => {
      const existing = acc[row.staffId] ?? new Set<string>()
      existing.add(row.shiftDate)
      return { ...acc, [row.staffId]: existing }
    }, {})

    // Batch fetch campaign assignments for the week
    const campaignRows = await db
      .select({
        staffId: campaignAssignments.staffId,
        campaignDate: campaigns.campaignDate,
        campaignCode: campaigns.code,
      })
      .from(campaignAssignments)
      .leftJoin(campaigns, eq(campaignAssignments.campaignId, campaigns.id))
      .where(
        and(
          eq(campaignAssignments.isActive, true),
          gte(campaigns.campaignDate, weekStart),
          lte(campaigns.campaignDate, weekEnd),
        ),
      )

    const campaignMap = campaignRows.reduce<
      Record<string, Record<string, string>>
    >((acc, row) => {
      if (!row.campaignDate) return acc
      const date = row.campaignDate
      return {
        ...acc,
        [row.staffId]: {
          ...(acc[row.staffId] ?? {}),
          [date]: row.campaignCode ?? '',
        },
      }
    }, {})

    return allStaff.map((staff) => {
      const days = weekDates.reduce<Record<string, AvailabilityCellData>>(
        (acc, date) => {
          const override = overrideMap[staff.id]?.[date]
          const hasCampaign = campaignMap[staff.id]?.[date]
          const hasShift = shiftMap[staff.id]?.has(date)

          let cellData: AvailabilityCellData

          if (override && ['vacaciones', 'incapacidad', 'licencia'].includes(override)) {
            cellData = { status: override as AvailabilityCellStatus }
          } else if (hasCampaign) {
            cellData = { status: 'en_campana', referenceCode: hasCampaign }
          } else if (hasShift) {
            cellData = { status: 'en_sede' }
          } else {
            cellData = { status: 'libre' }
          }

          return { ...acc, [date]: cellData }
        },
        {},
      )

      return {
        staffId: staff.id,
        firstName: staff.firstName,
        lastName: staff.lastName,
        staffProfile: staff.staffProfile,
        days,
      }
    })
  } catch (error) {
    if (error instanceof Error && error.message.includes('permiso')) throw error
    throw new Error('Error al obtener la grilla de disponibilidad')
  }
}

export async function setStaffAvailabilityOverride(data: {
  staffId: string
  availabilityDate: string
  status: 'vacaciones' | 'incapacidad' | 'licencia'
  notes?: string
}): Promise<void> {
  await requireRole(['admin', 'banco_sangre'])

  const validated = setAvailabilityOverrideSchema.safeParse(data)
  if (!validated.success) {
    throw new Error(validated.error.issues[0].message)
  }

  const { staffId, availabilityDate, status, notes } = validated.data

  try {
    await db
      .insert(staffAvailability)
      .values({
        staffId,
        availabilityDate,
        status,
        notes: notes ?? null,
        referenceType: 'manual',
      })
      .onConflictDoNothing()

    // If already exists, update it
    const [existing] = await db
      .select({ id: staffAvailability.id })
      .from(staffAvailability)
      .where(
        and(
          eq(staffAvailability.staffId, staffId),
          eq(staffAvailability.availabilityDate, availabilityDate),
        ),
      )
      .limit(1)

    if (existing) {
      await db
        .update(staffAvailability)
        .set({ status, notes: notes ?? null, updatedAt: new Date() })
        .where(eq(staffAvailability.id, existing.id))
    }
  } catch (error) {
    if (error instanceof Error && error.message.includes('permiso')) throw error
    throw new Error('Error al actualizar la disponibilidad del funcionario')
  }
}
