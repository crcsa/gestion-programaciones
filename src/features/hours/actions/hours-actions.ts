'use server'

import { eq, and, asc } from 'drizzle-orm'
import { db } from '@/lib/db'
import { staffMembers } from '@/lib/db/schema/staff-members'
import { weeklyBalance } from '@/lib/db/schema/weekly-balance'
import { sedeShifts } from '@/lib/db/schema/sede-shifts'
import { campaignAssignments } from '@/lib/db/schema/campaign-assignments'
import { campaigns } from '@/lib/db/schema/campaigns'
import { requireRole } from '@/features/auth/lib/require-role'
import { WEEKLY_HOURS_CONTRACT } from '@/features/assignments/lib/validation-constants'

// ---- Types ----------------------------------------------------------------

export interface WeeklyBalanceRow {
  staffId: string
  firstName: string
  lastName: string
  staffProfile: string
  weekStart: string
  sedeHours: number
  campaignHours: number
  workedHours: number
  extraHours: number
  sundayCount: number
  overnightCount: number
  balanceState: 'cumplió' | 'horas_extras' | 'debe_horas'
  carryOverHours: number
}

// ---- Helpers --------------------------------------------------------------

function deriveBalanceState(
  workedHours: number,
): 'cumplió' | 'horas_extras' | 'debe_horas' {
  if (workedHours === WEEKLY_HOURS_CONTRACT) return 'cumplió'
  if (workedHours > WEEKLY_HOURS_CONTRACT) return 'horas_extras'
  return 'debe_horas'
}

function getPrevWeekMonday(weekStart: string): string {
  const d = new Date(`${weekStart}T00:00:00`)
  d.setDate(d.getDate() - 7)
  return d.toISOString().slice(0, 10)
}

// ---- Actions --------------------------------------------------------------

export async function getWeeklyBalances(weekStart: string): Promise<WeeklyBalanceRow[]> {
  await requireRole(['admin', 'banco_sangre'])

  try {
    const prevWeekStart = getPrevWeekMonday(weekStart)

    const activeStaff = await db
      .select({
        id: staffMembers.id,
        firstName: staffMembers.firstName,
        lastName: staffMembers.lastName,
        staffProfile: staffMembers.staffProfile,
      })
      .from(staffMembers)
      .where(eq(staffMembers.isActive, true))
      .orderBy(asc(staffMembers.lastName))

    const currentBalances = await db
      .select()
      .from(weeklyBalance)
      .where(eq(weeklyBalance.weekStart, weekStart))

    const prevBalances = await db
      .select({ staffId: weeklyBalance.staffId, workedHours: weeklyBalance.workedHours })
      .from(weeklyBalance)
      .where(eq(weeklyBalance.weekStart, prevWeekStart))

    const currentMap = currentBalances.reduce<Record<string, typeof currentBalances[0]>>(
      (acc, b) => ({ ...acc, [b.staffId]: b }),
      {},
    )
    const prevMap = prevBalances.reduce<Record<string, number>>(
      (acc, b) => ({ ...acc, [b.staffId]: b.workedHours }),
      {},
    )

    return activeStaff.map((staff) => {
      const balance = currentMap[staff.id]
      const workedHours = balance?.workedHours ?? 0
      const sedeHours = balance?.sedeHours ?? 0
      const campaignHours = balance?.campaignHours ?? 0
      const extraHours = Math.max(0, workedHours - WEEKLY_HOURS_CONTRACT)
      const sundayCount = balance?.sundayCount ?? 0
      const overnightCount = balance?.overnightCount ?? 0
      const prevWorked = prevMap[staff.id] ?? 0
      const carryOverHours = prevWorked - WEEKLY_HOURS_CONTRACT

      return {
        staffId: staff.id,
        firstName: staff.firstName,
        lastName: staff.lastName,
        staffProfile: staff.staffProfile,
        weekStart,
        sedeHours,
        campaignHours,
        workedHours,
        extraHours,
        sundayCount,
        overnightCount,
        balanceState: deriveBalanceState(workedHours),
        carryOverHours,
      }
    })
  } catch (error) {
    if (error instanceof Error && error.message.includes('permiso')) throw error
    throw new Error('Error al obtener los balances semanales')
  }
}

export async function getStaffWeeklyBalance(
  staffId: string,
  weekStart: string,
): Promise<WeeklyBalanceRow | null> {
  await requireRole(['admin', 'banco_sangre'])

  try {
    const [staff] = await db
      .select({
        id: staffMembers.id,
        firstName: staffMembers.firstName,
        lastName: staffMembers.lastName,
        staffProfile: staffMembers.staffProfile,
      })
      .from(staffMembers)
      .where(eq(staffMembers.id, staffId))
      .limit(1)

    if (!staff) return null

    const [balance] = await db
      .select()
      .from(weeklyBalance)
      .where(
        and(
          eq(weeklyBalance.staffId, staffId),
          eq(weeklyBalance.weekStart, weekStart),
        ),
      )
      .limit(1)

    const prevWeekStart = getPrevWeekMonday(weekStart)
    const [prevBalance] = await db
      .select({ workedHours: weeklyBalance.workedHours })
      .from(weeklyBalance)
      .where(
        and(
          eq(weeklyBalance.staffId, staffId),
          eq(weeklyBalance.weekStart, prevWeekStart),
        ),
      )
      .limit(1)

    const workedHours = balance?.workedHours ?? 0
    const prevWorked = prevBalance?.workedHours ?? 0

    return {
      staffId: staff.id,
      firstName: staff.firstName,
      lastName: staff.lastName,
      staffProfile: staff.staffProfile,
      weekStart,
      sedeHours: balance?.sedeHours ?? 0,
      campaignHours: balance?.campaignHours ?? 0,
      workedHours,
      extraHours: Math.max(0, workedHours - WEEKLY_HOURS_CONTRACT),
      sundayCount: balance?.sundayCount ?? 0,
      overnightCount: balance?.overnightCount ?? 0,
      balanceState: deriveBalanceState(workedHours),
      carryOverHours: prevWorked - WEEKLY_HOURS_CONTRACT,
    }
  } catch (error) {
    if (error instanceof Error && error.message.includes('permiso')) throw error
    throw new Error('Error al obtener el balance semanal del funcionario')
  }
}

export async function recalculateWeeklyBalance(
  staffId: string,
  weekStart: string,
): Promise<void> {
  await requireRole(['admin', 'banco_sangre'])

  try {
    const weekEnd = (() => {
      const d = new Date(`${weekStart}T00:00:00`)
      d.setDate(d.getDate() + 6)
      return d.toISOString().slice(0, 10)
    })()

    const shifts = await db
      .select({ totalHours: sedeShifts.totalHours, shiftDate: sedeShifts.shiftDate, isOvernight: sedeShifts.isOvernight })
      .from(sedeShifts)
      .where(
        and(
          eq(sedeShifts.staffId, staffId),
          eq(sedeShifts.shiftDate, weekStart),
        ),
      )

    // Get all sede shifts in the week range
    const allShifts = await db
      .select({ totalHours: sedeShifts.totalHours, shiftDate: sedeShifts.shiftDate, isOvernight: sedeShifts.isOvernight })
      .from(sedeShifts)
      .where(eq(sedeShifts.staffId, staffId))

    const weekShifts = allShifts.filter(
      (s) => s.shiftDate >= weekStart && s.shiftDate <= weekEnd,
    )

    // Get campaign assignments with campaign data in the week range
    const campaignRows = await db
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
      )

    const weekCampaigns = campaignRows.filter(
      (c) =>
        c.campaignDate !== null &&
        c.campaignDate >= weekStart &&
        c.campaignDate <= weekEnd,
    )

    const sedeHours = weekShifts.reduce((sum, s) => sum + s.totalHours, 0)
    const campaignHours = weekCampaigns.reduce((sum, c) => {
      if (!c.startTime || !c.endTime) return sum
      const [sh, sm] = c.startTime.split(':').map(Number)
      const [eh, em] = c.endTime.split(':').map(Number)
      let mins = eh * 60 + em - (sh * 60 + sm)
      if (mins < 0) mins += 24 * 60
      return sum + mins / 60
    }, 0)

    const workedHours = sedeHours + Math.round(campaignHours)
    const extraHours = Math.max(0, workedHours - WEEKLY_HOURS_CONTRACT)

    const sundayCount = weekShifts.filter((s) => new Date(`${s.shiftDate}T00:00:00`).getDay() === 0).length
    const overnightCount = weekShifts.filter((s) => s.isOvernight).length

    void shifts  // suppress unused var

    await db
      .insert(weeklyBalance)
      .values({
        staffId,
        weekStart,
        scheduledHours: WEEKLY_HOURS_CONTRACT,
        workedHours,
        sedeHours,
        campaignHours: Math.round(campaignHours),
        extraHours,
        sundayCount,
        overnightCount,
      })
      .onConflictDoUpdate({
        target: [weeklyBalance.staffId, weeklyBalance.weekStart],
        set: {
          workedHours,
          sedeHours,
          campaignHours: Math.round(campaignHours),
          extraHours,
          sundayCount,
          overnightCount,
          updatedAt: new Date(),
        },
      })
  } catch (error) {
    if (error instanceof Error && error.message.includes('permiso')) throw error
    throw new Error('Error al recalcular el balance semanal')
  }
}
