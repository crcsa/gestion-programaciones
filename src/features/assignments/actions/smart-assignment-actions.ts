'use server'

import { and, eq, gte, lte } from 'drizzle-orm'
import { db } from '@/lib/db'
import { campaigns } from '@/lib/db/schema/campaigns'
import { staffMembers, staffTrainingAreas } from '@/lib/db/schema/staff-members'
import { campaignAssignments } from '@/lib/db/schema/campaign-assignments'
import { staffAvailability } from '@/lib/db/schema/staff-availability'
import { sedeShifts } from '@/lib/db/schema/sede-shifts'
import { weeklyBalance } from '@/lib/db/schema/weekly-balance'
import { monthlyCounters } from '@/lib/db/schema/monthly-counters'
import { requireRole } from '@/features/auth/lib/require-role'
import {
  runAllValidations,
  getHoursTrafficColor,
  type ValidationResult,
  type StaffValidationContext,
} from '../lib/validation-engine'
import { assignWithValidationSchema } from '../schemas/smart-assignment-schemas'
import { assignStaff } from './assignment-actions'

// ---- Types ----------------------------------------------------------------

export interface StaffAssignmentStatus {
  staffId: string
  firstName: string
  lastName: string
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
  await requireRole(['admin', 'banco_sangre'])

  try {
    const [campaign] = await db
      .select()
      .from(campaigns)
      .where(eq(campaigns.id, campaignId))
      .limit(1)

    if (!campaign) throw new Error('Campaña no encontrada')

    const campaignDate = campaign.campaignDate
    const weekStart = getMondayOfWeek(campaignDate)
    const prevDay = getPreviousDay(campaignDate)
    const campaignMonth = new Date(`${campaignDate}T00:00:00`).getMonth() + 1
    const campaignYear = new Date(`${campaignDate}T00:00:00`).getFullYear()

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
        staffProfile: staffMembers.staffProfile,
      })
      .from(staffMembers)
      .where(eq(staffMembers.isActive, true))

    const candidateStaff = allStaff.filter((s) => !assignedIds.has(s.id))
    const staffIds = candidateStaff.map((s) => s.id)

    if (staffIds.length === 0) return []

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

    // Batch fetch: availability overrides for campaign date
    const availabilityRows = await db
      .select({ staffId: staffAvailability.staffId, status: staffAvailability.status })
      .from(staffAvailability)
      .where(eq(staffAvailability.availabilityDate, campaignDate))

    const availabilityByStaff = availabilityRows.reduce<Record<string, string>>(
      (acc, row) => ({ ...acc, [row.staffId]: row.status }),
      {},
    )

    // Batch fetch: activities on campaign date (sede shifts)
    const sameDayShifts = await db
      .select({
        staffId: sedeShifts.staffId,
        startTime: sedeShifts.startTime,
        endTime: sedeShifts.endTime,
      })
      .from(sedeShifts)
      .where(eq(sedeShifts.shiftDate, campaignDate))

    // Batch fetch: campaign assignments on same date (other campaigns)
    const sameDayCampaigns = await db
      .select({
        staffId: campaignAssignments.staffId,
        startTime: campaigns.startTime,
        endTime: campaigns.endTime,
      })
      .from(campaignAssignments)
      .leftJoin(campaigns, eq(campaignAssignments.campaignId, campaigns.id))
      .where(
        and(
          eq(campaigns.campaignDate, campaignDate),
          eq(campaignAssignments.isActive, true),
        ),
      )

    // Batch fetch: previous day activities
    const prevDayShifts = await db
      .select({ staffId: sedeShifts.staffId, endTime: sedeShifts.endTime })
      .from(sedeShifts)
      .where(eq(sedeShifts.shiftDate, prevDay))

    // Batch fetch: weekly balances
    const weeklyBalanceRows = await db
      .select({ staffId: weeklyBalance.staffId, extraHours: weeklyBalance.extraHours })
      .from(weeklyBalance)
      .where(eq(weeklyBalance.weekStart, weekStart))

    const weeklyExtraByStaff = weeklyBalanceRows.reduce<Record<string, number>>(
      (acc, row) => ({ ...acc, [row.staffId]: row.extraHours }),
      {},
    )

    // Batch fetch: weekly worked hours for traffic light
    const weeklyWorkedRows = weeklyBalanceRows.reduce<Record<string, number>>(
      (acc, row) => ({ ...acc, [row.staffId]: row.extraHours }),
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
      const sameDayActivities = [
        ...sameDayShifts
          .filter((s) => s.staffId === staff.id)
          .map((s) => ({ date: campaignDate, startTime: s.startTime, endTime: s.endTime })),
        ...sameDayCampaigns
          .filter((c) => c.staffId === staff.id && c.startTime && c.endTime)
          .map((c) => ({
            date: campaignDate,
            startTime: c.startTime!,
            endTime: c.endTime!,
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
        campaignDate,
        campaignStartTime: campaign.startTime ?? '08:00',
        campaignEndTime: campaign.endTime ?? '16:00',
        campaignMunicipality: campaign.municipality,
        campaignTrainingAreaId: campaign.trainingAreaId,
        staffTrainingAreaIds: trainingAreasByStaff[staff.id] ?? [],
        staffAvailabilityStatus: availabilityByStaff[staff.id] ?? null,
        existingActivities: sameDayActivities,
        weeklyExtraHours: weeklyExtraByStaff[staff.id] ?? 0,
        monthlyCounters: monthlyByStaff[staff.id] ?? { sundayCount: 0, overnightCount: 0 },
        previousDayLastEndTime: prevDayLastEnd,
      }

      const { results, canAssign } = runAllValidations(ctx)
      const trafficColor = getHoursTrafficColor(weeklyWorked)

      return {
        staffId: staff.id,
        firstName: staff.firstName,
        lastName: staff.lastName,
        staffProfile: staff.staffProfile,
        trafficColor,
        canAssign,
        validationResults: results,
      }
    })
  } catch (error) {
    if (error instanceof Error && error.message.includes('permiso')) throw error
    if (error instanceof Error && error.message === 'Campaña no encontrada') throw error
    throw new Error('Error al obtener el estado de asignación del personal')
  }
}

export async function assignStaffWithValidation(data: {
  campaignId: string
  staffId: string
  forceOverride?: boolean
}): Promise<{ success: true } | { requiresConfirmation: true; warnings: ValidationResult[] }> {
  await requireRole(['admin', 'banco_sangre'])

  const validated = assignWithValidationSchema.safeParse(data)
  if (!validated.success) {
    throw new Error(validated.error.issues[0].message)
  }

  const { campaignId, staffId, forceOverride } = validated.data

  try {
    const statuses = await getStaffAssignmentStatuses(campaignId)
    const staffStatus = statuses.find((s) => s.staffId === staffId)

    // If already assigned, just try to assign (will be deduplicated in assignStaff)
    if (!staffStatus) {
      await assignStaff({ campaignId, staffIds: [staffId] })
      return { success: true }
    }

    if (!staffStatus.canAssign) {
      const blockMessages = staffStatus.validationResults
        .filter((r) => r.severity === 'block')
        .map((r) => r.message)
        .join(' | ')
      throw new Error(`No se puede asignar: ${blockMessages}`)
    }

    const warnings = staffStatus.validationResults.filter((r) => r.severity === 'warn')

    if (warnings.length > 0 && !forceOverride) {
      return { requiresConfirmation: true, warnings }
    }

    await assignStaff({ campaignId, staffIds: [staffId] })
    return { success: true }
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message.includes('permiso') ||
        error.message.startsWith('No se puede asignar'))
    ) {
      throw error
    }
    throw new Error('Error al asignar el funcionario')
  }
}
