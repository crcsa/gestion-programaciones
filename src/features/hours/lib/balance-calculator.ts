/**
 * Pure DB calculation — no 'use server', no auth checks.
 * Imported by server actions that have already authenticated.
 */
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { sedeShifts } from '@/lib/db/schema/sede-shifts'
import { weeklyBalance } from '@/lib/db/schema/weekly-balance'
import { loadValidationRuntimeConfigAt } from '@/features/configuration/lib/runtime-config'
import { getStaffCampaignDayPoints } from './aggregate-staff-data'
import { getSundayOfWeek } from '@/lib/date/week'

export async function computeAndSaveWeeklyBalance(
  staffId: string,
  weekStart: string,
): Promise<void> {
  const weekEnd = getSundayOfWeek(weekStart)
  // Use the rules that were active at the END of the week being calculated.
  // Past weeks keep their period's rules; the current week uses current rules.
  const cfg = await loadValidationRuntimeConfigAt(weekEnd)

  const [allShifts, campaignPoints] = await Promise.all([
    db
      .select({
        totalHours: sedeShifts.totalHours,
        shiftDate: sedeShifts.shiftDate,
        isOvernight: sedeShifts.isOvernight,
        extraHours: sedeShifts.extraHours,
      })
      .from(sedeShifts)
      .where(eq(sedeShifts.staffId, staffId)),
    getStaffCampaignDayPoints(staffId),
  ])

  const weekShifts = allShifts.filter(
    (s) => s.shiftDate >= weekStart && s.shiftDate <= weekEnd,
  )
  const weekPoints = campaignPoints.filter(
    (p) => p.dayDate >= weekStart && p.dayDate <= weekEnd,
  )

  const sedeHours = weekShifts.reduce((sum, s) => sum + s.totalHours, 0)
  const campaignHoursFloat = weekPoints.reduce((sum, p) => sum + p.hours, 0)
  const campaignHours = Math.round(campaignHoursFloat)

  const workedHours = sedeHours + campaignHours
  const sedeExtras = weekShifts.reduce((sum, s) => sum + (s.extraHours ?? 0), 0)
  const baseExtras = Math.max(0, workedHours - cfg.weeklyHours)
  const extraHours = baseExtras + sedeExtras

  const sundayShifts = weekShifts.filter(
    (s) => new Date(`${s.shiftDate}T00:00:00`).getDay() === 0,
  ).length
  const sundayCampaigns = weekPoints.filter(
    (p) => new Date(`${p.dayDate}T00:00:00`).getDay() === 0,
  ).length
  const sundayCount = sundayShifts + sundayCampaigns

  const overnightShifts = weekShifts.filter((s) => s.isOvernight).length
  const overnightCampaigns = weekPoints.filter((p) => p.isOvernight).length
  const overnightCount = overnightShifts + overnightCampaigns

  await db
    .insert(weeklyBalance)
    .values({
      staffId,
      weekStart,
      scheduledHours: cfg.weeklyHours,
      workedHours,
      sedeHours,
      campaignHours,
      extraHours,
      sundayCount,
      overnightCount,
    })
    .onConflictDoUpdate({
      target: [weeklyBalance.staffId, weeklyBalance.weekStart],
      set: {
        workedHours,
        sedeHours,
        campaignHours,
        extraHours,
        sundayCount,
        overnightCount,
        updatedAt: new Date(),
      },
    })
}
