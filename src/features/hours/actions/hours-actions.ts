'use server'

import { eq, and, asc } from 'drizzle-orm'
import { db } from '@/lib/db'
import { staffMembers } from '@/lib/db/schema/staff-members'
import { weeklyBalance } from '@/lib/db/schema/weekly-balance'
import { requireRole } from '@/features/auth/lib/require-role'
import { WEEKLY_HOURS_CONTRACT } from '@/features/assignments/lib/validation-constants'
import { computeAndSaveWeeklyBalance } from '../lib/balance-calculator'

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

export interface RecalculateResult {
  updated: number
  errors: string[]
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
      const prevWorked = prevMap[staff.id]
      const carryOverHours = prevWorked !== undefined ? prevWorked - WEEKLY_HOURS_CONTRACT : 0

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
    const prevWorked = prevBalance?.workedHours

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
      carryOverHours: prevWorked !== undefined ? prevWorked - WEEKLY_HOURS_CONTRACT : 0,
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
    await computeAndSaveWeeklyBalance(staffId, weekStart)
  } catch (error) {
    if (error instanceof Error && error.message.includes('permiso')) throw error
    throw new Error('Error al recalcular el balance semanal')
  }
}

/** Recalculates weekly balance for ALL active staff members in a given week. */
export async function recalculateAllWeeklyBalances(
  weekStart: string,
): Promise<RecalculateResult> {
  await requireRole(['admin', 'banco_sangre'])

  const activeStaff = await db
    .select({ id: staffMembers.id })
    .from(staffMembers)
    .where(eq(staffMembers.isActive, true))
    .orderBy(asc(staffMembers.lastName))

  let updated = 0
  const errors: string[] = []

  for (const s of activeStaff) {
    try {
      await computeAndSaveWeeklyBalance(s.id, weekStart)
      updated++
    } catch (err) {
      errors.push(err instanceof Error ? err.message : String(err))
    }
  }

  return { updated, errors }
}
