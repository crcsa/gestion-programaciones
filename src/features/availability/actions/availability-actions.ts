'use server'

import { eq, and, gte, lte } from 'drizzle-orm'
import { AppError, ValidationError } from '@/lib/errors/app-errors'
import { db } from '@/lib/db'
import { staffMembers, staffTrainingAreas } from '@/lib/db/schema/staff-members'
import { staffAvailability } from '@/lib/db/schema/staff-availability'
import { sedeShifts } from '@/lib/db/schema/sede-shifts'
import { campaignAssignments } from '@/lib/db/schema/campaign-assignments'
import { campaigns, campaignDays } from '@/lib/db/schema/campaigns'
import { campaignVehicles } from '@/lib/db/schema/campaign-vehicles'
import { requireAccess } from '@/features/auth/lib/require-access'
import { setAvailabilityOverrideSchema, weeklyAvailabilityGridSchema } from '../schemas/availability-schemas'
import type { WeeklyAvailabilityGridInput } from '../schemas/availability-schemas'
import type { Area } from '@/types/areas'
import type {
  AvailabilityCellStatus,
  AvailabilityCellData,
  AvailabilityGridRow,
} from './availability-types'

// ---- Helpers --------------------------------------------------------------

function getWeekDates(weekStart: string): string[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(`${weekStart}T00:00:00`)
    d.setDate(d.getDate() + i)
    return d.toISOString().slice(0, 10)
  })
}

// ---- Actions --------------------------------------------------------------

export async function getWeeklyAvailabilityGrid(
  params: WeeklyAvailabilityGridInput & { area?: Area | null },
): Promise<AvailabilityGridRow[]> {
  // Admin global y comercial (cross-área) ven todas las áreas; admin_area
  // queda anclado a su propia área (banco_sangre / logística solo ven la suya).
  const { scope } = await requireAccess({
    roles: ['admin', 'admin_area', 'comercial'],
    allowCrossArea: true,
  })

  const validated = weeklyAvailabilityGridSchema.safeParse(params)
  if (!validated.success) {
    throw new ValidationError(validated.error.issues[0].message)
  }

  const { weekStart, staffProfile, trainingAreaId } = validated.data
  const weekDates = getWeekDates(weekStart)
  const weekEnd = weekDates[6]
  const areaScope: Area | null =
    scope.kind === 'global' ? params.area ?? null : scope.area

  try {
    const baseWhere = [eq(staffMembers.isActive, true)]
    if (areaScope) baseWhere.push(eq(staffMembers.area, areaScope))
    if (staffProfile) {
      baseWhere.push(eq(staffMembers.staffProfile, staffProfile))
    }

    let allStaff = await db
      .select({
        id: staffMembers.id,
        firstName: staffMembers.firstName,
        lastName: staffMembers.lastName,
        staffProfile: staffMembers.staffProfile,
      })
      .from(staffMembers)
      .where(and(...baseWhere))

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

    // Batch fetch campaign assignments expandidos por día. Para campañas
    // multi-día usamos campaign_days (1 fila por día) en vez de
    // campaigns.campaign_date, que solo refleja el día de inicio. Filtramos
    // por dayDate dentro de la semana, así una campaña que arranca antes del
    // lunes pero continúa hasta el miércoles también se pinta.
    //
    // Incluye dos fuentes paralelas de "estoy en campaña":
    //   a) campaign_assignments (banco_sangre, comercial)
    //   b) campaign_vehicles.driver_staff_id (logística)
    const [assignmentRows, driverRows] = await Promise.all([
      db
        .select({
          staffId: campaignAssignments.staffId,
          dayDate: campaignDays.dayDate,
          campaignCode: campaigns.code,
        })
        .from(campaignAssignments)
        .innerJoin(campaigns, eq(campaignAssignments.campaignId, campaigns.id))
        .innerJoin(campaignDays, eq(campaignDays.campaignId, campaigns.id))
        .where(
          and(
            eq(campaignAssignments.isActive, true),
            gte(campaignDays.dayDate, weekStart),
            lte(campaignDays.dayDate, weekEnd),
          ),
        ),
      db
        .select({
          staffId: campaignVehicles.driverStaffId,
          dayDate: campaignDays.dayDate,
          campaignCode: campaigns.code,
        })
        .from(campaignVehicles)
        .innerJoin(campaigns, eq(campaignVehicles.campaignId, campaigns.id))
        .innerJoin(campaignDays, eq(campaignDays.campaignId, campaigns.id))
        .where(
          and(
            eq(campaignVehicles.isActive, true),
            gte(campaignDays.dayDate, weekStart),
            lte(campaignDays.dayDate, weekEnd),
          ),
        ),
    ])

    const campaignMap = [...assignmentRows, ...driverRows].reduce<
      Record<string, Record<string, string>>
    >((acc, row) => {
      if (!row.staffId || !row.dayDate) return acc
      return {
        ...acc,
        [row.staffId]: {
          ...(acc[row.staffId] ?? {}),
          [row.dayDate]: row.campaignCode ?? '',
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
    if (error instanceof AppError) throw error
    throw new Error('Error al obtener la grilla de disponibilidad')
  }
}

export async function setStaffAvailabilityOverride(data: {
  staffId: string
  availabilityDate: string
  status: 'vacaciones' | 'incapacidad' | 'licencia'
  notes?: string
}): Promise<void> {
  await requireAccess({ roles: ['admin', 'admin_area'] })

  const validated = setAvailabilityOverrideSchema.safeParse(data)
  if (!validated.success) {
    throw new ValidationError(validated.error.issues[0].message)
  }

  const { staffId, availabilityDate, status, notes } = validated.data

  try {
    // staff_availability NO tiene UNIQUE en (staffId, availabilityDate), por
    // lo que un onConflictDoUpdate no es válido. Hacemos select-first y
    // branch insert/update para evitar duplicar filas en cada llamada.
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
    } else {
      await db.insert(staffAvailability).values({
        staffId,
        availabilityDate,
        status,
        notes: notes ?? null,
        referenceType: 'manual',
      })
    }
  } catch (error) {
    if (error instanceof AppError) throw error
    throw new Error('Error al actualizar la disponibilidad del colaborador')
  }
}
