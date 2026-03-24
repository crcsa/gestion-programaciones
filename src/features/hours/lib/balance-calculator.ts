/**
 * Pure DB calculation — no 'use server', no auth checks.
 * Imported by server actions that have already authenticated.
 */
import { eq, and } from 'drizzle-orm'
import { db } from '@/lib/db'
import { sedeShifts } from '@/lib/db/schema/sede-shifts'
import { campaignAssignments } from '@/lib/db/schema/campaign-assignments'
import { campaigns } from '@/lib/db/schema/campaigns'
import { weeklyBalance } from '@/lib/db/schema/weekly-balance'
import { WEEKLY_HOURS_CONTRACT } from '@/features/assignments/lib/validation-constants'

function addDays(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T00:00:00`)
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

function calcCampaignMins(startTime: string, endTime: string): number {
  const [sh, sm] = startTime.split(':').map(Number)
  const [eh, em] = endTime.split(':').map(Number)
  let mins = eh * 60 + em - (sh * 60 + sm)
  if (mins < 0) mins += 24 * 60
  return mins
}

export async function computeAndSaveWeeklyBalance(
  staffId: string,
  weekStart: string,
): Promise<void> {
  const weekEnd = addDays(weekStart, 6)

  const [allShifts, campaignRows] = await Promise.all([
    db
      .select({
        totalHours: sedeShifts.totalHours,
        shiftDate: sedeShifts.shiftDate,
        isOvernight: sedeShifts.isOvernight,
      })
      .from(sedeShifts)
      .where(eq(sedeShifts.staffId, staffId)),
    db
      .select({
        campaignDate: campaigns.campaignDate,
        startTime: campaigns.startTime,
        endTime: campaigns.endTime,
      })
      .from(campaignAssignments)
      .leftJoin(campaigns, eq(campaignAssignments.campaignId, campaigns.id))
      .where(
        and(
          eq(campaignAssignments.staffId, staffId),
          eq(campaignAssignments.isActive, true),
        ),
      ),
  ])

  const weekShifts = allShifts.filter(
    (s) => s.shiftDate >= weekStart && s.shiftDate <= weekEnd,
  )
  const weekCampaigns = campaignRows.filter(
    (c) => c.campaignDate !== null && c.campaignDate >= weekStart && c.campaignDate <= weekEnd,
  )

  const sedeHours = weekShifts.reduce((sum, s) => sum + s.totalHours, 0)
  const campaignHoursFloat = weekCampaigns.reduce((sum, c) => {
    // No times → assume standard 8h campaign day
    if (!c.startTime || !c.endTime) return sum + 8
    return sum + calcCampaignMins(c.startTime, c.endTime) / 60
  }, 0)
  const campaignHours = Math.round(campaignHoursFloat)

  const workedHours = sedeHours + campaignHours
  const extraHours = Math.max(0, workedHours - WEEKLY_HOURS_CONTRACT)
  const sundayCount = weekShifts.filter(
    (s) => new Date(`${s.shiftDate}T00:00:00`).getDay() === 0,
  ).length
  const overnightCount = weekShifts.filter((s) => s.isOvernight).length

  await db
    .insert(weeklyBalance)
    .values({
      staffId,
      weekStart,
      scheduledHours: WEEKLY_HOURS_CONTRACT,
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
