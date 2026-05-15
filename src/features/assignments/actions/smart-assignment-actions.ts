'use server'

import { and, eq, inArray } from 'drizzle-orm'
import { NotFoundError, ValidationError } from '@/lib/errors/app-errors'
import { rethrowOrLog } from '@/lib/errors/rethrow'
import { db } from '@/lib/db'
import { campaigns, campaignDays } from '@/lib/db/schema/campaigns'
import { staffMembers, staffTrainingAreas } from '@/lib/db/schema/staff-members'
import { campaignAssignments } from '@/lib/db/schema/campaign-assignments'
import { staffAvailability } from '@/lib/db/schema/staff-availability'
import { sedeShifts } from '@/lib/db/schema/sede-shifts'
import { weeklyBalance } from '@/lib/db/schema/weekly-balance'
import { monthlyCounters } from '@/lib/db/schema/monthly-counters'
import { requireAccess } from '@/features/auth/lib/require-access'
import {
  runAllValidations,
  getHoursTrafficColor,
  type ValidationResult,
  type StaffValidationContext,
  type CampaignDayContext,
} from '../lib/validation-engine'
import { loadValidationRuntimeConfig } from '@/features/configuration/lib/runtime-config'
import {
  assignWithValidationSchema,
  assignBatchWithValidationSchema,
} from '../schemas/smart-assignment-schemas'
import { assignStaff } from './assignment-actions'

// ---- Types ----------------------------------------------------------------

export interface StaffAssignmentStatus {
  staffId: string
  firstName: string
  lastName: string
  cedula: string
  staffProfile: string
  trafficColor: 'green' | 'yellow' | 'red'
  canAssign: boolean
  validationResults: ValidationResult[]
}

// ---- Helpers --------------------------------------------------------------

function getMondayOfWeek(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00`)
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  return d.toISOString().slice(0, 10)
}

function getPreviousDay(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00`)
  d.setDate(d.getDate() - 1)
  return d.toISOString().slice(0, 10)
}

// ---- Actions --------------------------------------------------------------

export async function getStaffAssignmentStatuses(
  campaignId: string,
): Promise<StaffAssignmentStatus[]> {
  await requireAccess({ roles: ['admin', 'admin_area'], areas: ['banco_sangre'] })

  try {
    const [campaign] = await db
      .select()
      .from(campaigns)
      .where(eq(campaigns.id, campaignId))
      .limit(1)

    if (!campaign) throw new NotFoundError('Campaña no encontrada')

    const campaignDate = campaign.campaignDate
    const weekStart = getMondayOfWeek(campaignDate)
    const prevDay = getPreviousDay(campaignDate)
    const campaignMonth = new Date(`${campaignDate}T00:00:00`).getMonth() + 1
    const campaignYear = new Date(`${campaignDate}T00:00:00`).getFullYear()

    // Build campaign days context (multi-day support)
    const campaignDayRows = await db
      .select()
      .from(campaignDays)
      .where(eq(campaignDays.campaignId, campaignId))

    const campaignDayContexts: CampaignDayContext[] =
      campaignDayRows.length > 0
        ? campaignDayRows.map((d) => ({
            dayDate: d.dayDate,
            startTime: d.startTime,
            endTime: d.endTime,
            isOvernight: d.isOvernight,
          }))
        : [
            {
              dayDate: campaignDate,
              startTime: campaign.startTime ?? '08:00',
              endTime: campaign.endTime ?? '16:00',
              isOvernight: false,
            },
          ]

    const allDayDates = campaignDayContexts.map((d) => d.dayDate)

    // Get already-assigned staff IDs to exclude them
    const alreadyAssigned = await db
      .select({ staffId: campaignAssignments.staffId })
      .from(campaignAssignments)
      .where(
        and(
          eq(campaignAssignments.campaignId, campaignId),
          eq(campaignAssignments.isActive, true),
        ),
      )
    const assignedIds = new Set(alreadyAssigned.map((a) => a.staffId))

    // Get all active staff
    const allStaff = await db
      .select({
        id: staffMembers.id,
        firstName: staffMembers.firstName,
        lastName: staffMembers.lastName,
        cedula: staffMembers.cedula,
        staffProfile: staffMembers.staffProfile,
      })
      .from(staffMembers)
      .where(
        and(
          eq(staffMembers.isActive, true),
          // Solo staff de banco_sangre puede asignarse a campañas vía este flujo.
          eq(staffMembers.area, 'banco_sangre'),
        ),
      )

    const candidateStaff = allStaff.filter((s) => !assignedIds.has(s.id))
    const staffIds = candidateStaff.map((s) => s.id)

    if (staffIds.length === 0) return []

    const runtimeConfig = await loadValidationRuntimeConfig()

    // Batch fetch: training areas
    const trainingAreaRows = await db
      .select({ staffId: staffTrainingAreas.staffId, trainingAreaId: staffTrainingAreas.trainingAreaId })
      .from(staffTrainingAreas)

    const trainingAreasByStaff = trainingAreaRows.reduce<Record<string, string[]>>(
      (acc, row) => ({
        ...acc,
        [row.staffId]: [...(acc[row.staffId] ?? []), row.trainingAreaId],
      }),
      {},
    )

    // Batch fetch: availability overrides for ANY day of the campaign
    const availabilityRows = await db
      .select({
        staffId: staffAvailability.staffId,
        availabilityDate: staffAvailability.availabilityDate,
        status: staffAvailability.status,
      })
      .from(staffAvailability)
      .where(inArray(staffAvailability.availabilityDate, allDayDates))

    // Use the most restrictive (any unavailable on any day blocks)
    const UNAVAILABLE = new Set(['vacaciones', 'incapacidad', 'licencia'])
    const availabilityByStaff: Record<string, string> = {}
    for (const row of availabilityRows) {
      if (UNAVAILABLE.has(row.status)) {
        availabilityByStaff[row.staffId] = row.status
      } else if (!availabilityByStaff[row.staffId]) {
        availabilityByStaff[row.staffId] = row.status
      }
    }

    // Batch fetch: sede shifts en TODOS los días de la campaña
    const sameDayShiftRows = await db
      .select({
        staffId: sedeShifts.staffId,
        shiftDate: sedeShifts.shiftDate,
        startTime: sedeShifts.startTime,
        endTime: sedeShifts.endTime,
      })
      .from(sedeShifts)
      .where(inArray(sedeShifts.shiftDate, allDayDates))

    // Batch fetch: otras campañas que solapan algún día de esta campaña
    // (otra campaña con cualquier día en allDayDates)
    const overlappingCampaignDays = await db
      .select({
        staffId: campaignAssignments.staffId,
        dayDate: campaignDays.dayDate,
        startTime: campaignDays.startTime,
        endTime: campaignDays.endTime,
        campaignId: campaigns.id,
      })
      .from(campaignAssignments)
      .leftJoin(campaigns, eq(campaignAssignments.campaignId, campaigns.id))
      .leftJoin(campaignDays, eq(campaignDays.campaignId, campaigns.id))
      .where(
        and(
          eq(campaignAssignments.isActive, true),
          inArray(campaignDays.dayDate, allDayDates),
        ),
      )

    // Fallback legacy: campañas sin campaign_days, identifica por campaigns.campaignDate
    const legacyOverlapping = await db
      .select({
        staffId: campaignAssignments.staffId,
        campaignDate: campaigns.campaignDate,
        startTime: campaigns.startTime,
        endTime: campaigns.endTime,
        campaignId: campaigns.id,
      })
      .from(campaignAssignments)
      .leftJoin(campaigns, eq(campaignAssignments.campaignId, campaigns.id))
      .where(
        and(
          eq(campaignAssignments.isActive, true),
          inArray(campaigns.campaignDate, allDayDates),
        ),
      )

    // Excluye la campaña actual de los conflictos
    const otherSameDayCampaigns = [
      ...overlappingCampaignDays
        .filter((c) => c.campaignId !== null && c.campaignId !== campaignId && c.startTime && c.endTime && c.dayDate)
        .map((c) => ({
          staffId: c.staffId,
          date: c.dayDate!,
          startTime: c.startTime!,
          endTime: c.endTime!,
        })),
      ...legacyOverlapping
        .filter(
          (c) =>
            c.campaignId !== null &&
            c.campaignId !== campaignId &&
            c.startTime &&
            c.endTime &&
            c.campaignDate,
        )
        .map((c) => ({
          staffId: c.staffId,
          date: c.campaignDate!,
          startTime: c.startTime!,
          endTime: c.endTime!,
        })),
    ]

    // Batch fetch: previous day activities (day before campaign's first day)
    const prevDayShifts = await db
      .select({ staffId: sedeShifts.staffId, endTime: sedeShifts.endTime })
      .from(sedeShifts)
      .where(eq(sedeShifts.shiftDate, prevDay))

    // Batch fetch: weekly balances (extra + worked para distintos usos)
    const weeklyBalanceRows = await db
      .select({
        staffId: weeklyBalance.staffId,
        extraHours: weeklyBalance.extraHours,
        workedHours: weeklyBalance.workedHours,
      })
      .from(weeklyBalance)
      .where(eq(weeklyBalance.weekStart, weekStart))

    const weeklyExtraByStaff = weeklyBalanceRows.reduce<Record<string, number>>(
      (acc, row) => ({ ...acc, [row.staffId]: row.extraHours }),
      {},
    )

    const weeklyWorkedRows = weeklyBalanceRows.reduce<Record<string, number>>(
      (acc, row) => ({ ...acc, [row.staffId]: row.workedHours }),
      {},
    )

    // Batch fetch: monthly counters
    const monthlyRows = await db
      .select({
        staffId: monthlyCounters.staffId,
        sundayCount: monthlyCounters.sundayCount,
        overnightCount: monthlyCounters.overnightCount,
      })
      .from(monthlyCounters)
      .where(
        and(
          eq(monthlyCounters.year, campaignYear),
          eq(monthlyCounters.month, campaignMonth),
        ),
      )

    const monthlyByStaff = monthlyRows.reduce<
      Record<string, { sundayCount: number; overnightCount: number }>
    >(
      (acc, row) => ({
        ...acc,
        [row.staffId]: { sundayCount: row.sundayCount, overnightCount: row.overnightCount },
      }),
      {},
    )

    return candidateStaff.map((staff) => {
      // Actividades existentes en CUALQUIER día de la campaña
      const sameDayActivities = [
        ...sameDayShiftRows
          .filter((s) => s.staffId === staff.id)
          .map((s) => ({
            date: s.shiftDate,
            startTime: s.startTime,
            endTime: s.endTime,
          })),
        ...otherSameDayCampaigns
          .filter((c) => c.staffId === staff.id)
          .map((c) => ({
            date: c.date,
            startTime: c.startTime,
            endTime: c.endTime,
          })),
      ]

      const prevDayActivities = prevDayShifts.filter((s) => s.staffId === staff.id)
      const prevDayLastEnd =
        prevDayActivities.length > 0
          ? prevDayActivities.reduce((latest, s) =>
              s.endTime > latest ? s.endTime : latest,
            prevDayActivities[0].endTime,
            )
          : null

      const weeklyWorked = weeklyWorkedRows[staff.id] ?? 0

      const ctx: StaffValidationContext = {
        staffId: staff.id,
        campaignDays: campaignDayContexts,
        // Legacy (back-compat) — primer día
        campaignDate,
        campaignStartTime: campaign.startTime ?? campaignDayContexts[0].startTime,
        campaignEndTime: campaign.endTime ?? campaignDayContexts[0].endTime,
        campaignMunicipality: campaign.municipality,
        campaignTrainingAreaId: campaign.trainingAreaId,
        staffTrainingAreaIds: trainingAreasByStaff[staff.id] ?? [],
        staffAvailabilityStatus: availabilityByStaff[staff.id] ?? null,
        existingActivities: sameDayActivities,
        weeklyExtraHours: weeklyExtraByStaff[staff.id] ?? 0,
        monthlyCounters: monthlyByStaff[staff.id] ?? { sundayCount: 0, overnightCount: 0 },
        previousDayLastEndTime: prevDayLastEnd,
      }

      const { results, canAssign } = runAllValidations(ctx, runtimeConfig)
      const trafficColor = getHoursTrafficColor(weeklyWorked, runtimeConfig)

      return {
        staffId: staff.id,
        firstName: staff.firstName,
        lastName: staff.lastName,
        cedula: staff.cedula,
        staffProfile: staff.staffProfile,
        trafficColor,
        canAssign,
        validationResults: results,
      }
    })
  } catch (error) {
    rethrowOrLog(error, 'getStaffAssignmentStatuses', 'Error al obtener el estado de asignación del personal')
  }
}

export async function assignStaffWithValidation(data: {
  campaignId: string
  staffId: string
  forceOverride?: boolean
}): Promise<{ success: true } | { requiresConfirmation: true; warnings: ValidationResult[] }> {
  await requireAccess({ roles: ['admin', 'admin_area'], areas: ['banco_sangre'] })

  const validated = assignWithValidationSchema.safeParse(data)
  if (!validated.success) {
    throw new ValidationError(validated.error.issues[0].message)
  }

  const { campaignId, staffId, forceOverride } = validated.data

  try {
    const statuses = await getStaffAssignmentStatuses(campaignId)
    const staffStatus = statuses.find((s) => s.staffId === staffId)

    // staffStatus puede ser undefined por tres razones distintas:
    //   1. El staff YA está asignado a esta campaña (no aparece en el pool).
    //   2. El staff está desactivado.
    //   3. El staff pertenece a otra área.
    // En los 3 casos delegamos a assignStaff que aplica las validaciones
    // canónicas (deduplica si ya estaba, rechaza si no es elegible). Loggeamos
    // un warning porque normalmente este path indica un estado UI inconsistente.
    if (!staffStatus) {
      console.warn('[assignStaffWithValidation] staff no está en el pool', {
        campaignId,
        staffId,
      })
      await assignStaff({ campaignId, staffIds: [staffId] })
      return { success: true }
    }

    if (!staffStatus.canAssign) {
      const blockMessages = staffStatus.validationResults
        .filter((r) => r.severity === 'block')
        .map((r) => r.message)
        .join(' | ')
      throw new ValidationError(`No se puede asignar: ${blockMessages}`)
    }

    const warnings = staffStatus.validationResults.filter((r) => r.severity === 'warn')

    if (warnings.length > 0 && !forceOverride) {
      return { requiresConfirmation: true, warnings }
    }

    await assignStaff({ campaignId, staffIds: [staffId] })
    return { success: true }
  } catch (error) {
    rethrowOrLog(error, 'assignStaffWithValidation', 'Error al asignar el colaborador')
  }
}

export interface BatchAssignWarning {
  staffId: string
  staffName: string
  warnings: ValidationResult[]
}

export async function assignStaffBatchWithValidation(data: {
  campaignId: string
  staffIds: string[]
  forceOverride?: boolean
}): Promise<{ success: true; assigned: number } | { requiresConfirmation: true; warningsByStaff: BatchAssignWarning[] }> {
  await requireAccess({ roles: ['admin', 'admin_area'], areas: ['banco_sangre'] })

  const validated = assignBatchWithValidationSchema.safeParse(data)
  if (!validated.success) {
    throw new ValidationError(validated.error.issues[0].message)
  }

  const { campaignId, staffIds, forceOverride } = validated.data
  const requested = new Set(staffIds)

  try {
    const statuses = await getStaffAssignmentStatuses(campaignId)
    const selected = statuses.filter((s) => requested.has(s.staffId))

    const blocked = selected.filter((s) => !s.canAssign)
    if (blocked.length > 0) {
      const names = blocked.map((s) => `${s.firstName} ${s.lastName}`).join(', ')
      throw new ValidationError(`No se puede asignar: ${names}`)
    }

    const warningsByStaff: BatchAssignWarning[] = selected
      .map((s) => ({
        staffId: s.staffId,
        staffName: `${s.firstName} ${s.lastName}`,
        warnings: s.validationResults.filter((r) => r.severity === 'warn'),
      }))
      .filter((w) => w.warnings.length > 0)

    if (warningsByStaff.length > 0 && !forceOverride) {
      return { requiresConfirmation: true, warningsByStaff }
    }

    await assignStaff({ campaignId, staffIds })
    return { success: true, assigned: staffIds.length }
  } catch (error) {
    rethrowOrLog(error, 'assignStaffBatchWithValidation', 'Error al asignar los colaboradores')
  }
}
