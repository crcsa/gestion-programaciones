'use server'

import { eq, and, asc } from 'drizzle-orm'
import { AppError } from '@/lib/errors/app-errors'
import { db } from '@/lib/db'
import { staffMembers } from '@/lib/db/schema/staff-members'
import { weeklyBalance } from '@/lib/db/schema/weekly-balance'
import { requireAccess } from '@/features/auth/lib/require-access'
import { loadValidationRuntimeConfigAt } from '@/features/configuration/lib/runtime-config'
import { computeAndSaveWeeklyBalance } from '../lib/balance-calculator'
import { getPreviousMonday, getSundayOfWeek } from '@/lib/date/week'
import type { Area } from '@/types/areas'

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
  errors: { staffId: string; message: string }[]
}

// ---- Helpers --------------------------------------------------------------

function deriveBalanceState(
  workedHours: number,
  weeklyHours: number,
): 'cumplió' | 'horas_extras' | 'debe_horas' {
  if (workedHours === weeklyHours) return 'cumplió'
  if (workedHours > weeklyHours) return 'horas_extras'
  return 'debe_horas'
}

// Helpers timezone-safe — usan exclusivamente strings ISO (`YYYY-MM-DD`) para
// evitar shifts de zona horaria (Node local UTC-5 vs Vercel UTC).
function getPrevWeekMonday(weekStart: string): string {
  return getPreviousMonday(weekStart)
}

function getWeekEnd(weekStart: string): string {
  return getSundayOfWeek(weekStart)
}

// ---- Actions --------------------------------------------------------------

export async function getWeeklyBalances(
  weekStart: string,
  areaOverride?: Area | null,
): Promise<WeeklyBalanceRow[]> {
  const { scope } = await requireAccess({
    roles: ['admin', 'admin_area', 'comercial'],
    allowCrossArea: true,
  })
  // Admin global y comercial (cross-area) respetan el override; admin de área
  // queda anclado a su scope.area.
  const areaScope: Area | null =
    scope.kind === 'global' ? areaOverride ?? null : scope.area

  try {
    const prevWeekStart = getPrevWeekMonday(weekStart)
    // Each week is rendered with the rules that were active during that week.
    const [cfg, prevCfg] = await Promise.all([
      loadValidationRuntimeConfigAt(getWeekEnd(weekStart)),
      loadValidationRuntimeConfigAt(getWeekEnd(prevWeekStart)),
    ])
    const weeklyHours = cfg.weeklyHours
    const prevWeeklyHours = prevCfg.weeklyHours

    const staffWhere = [eq(staffMembers.isActive, true)]
    if (areaScope) staffWhere.push(eq(staffMembers.area, areaScope))

    const activeStaff = await db
      .select({
        id: staffMembers.id,
        firstName: staffMembers.firstName,
        lastName: staffMembers.lastName,
        staffProfile: staffMembers.staffProfile,
      })
      .from(staffMembers)
      .where(and(...staffWhere))
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
      const extraHours = Math.max(0, workedHours - weeklyHours)
      const sundayCount = balance?.sundayCount ?? 0
      const overnightCount = balance?.overnightCount ?? 0
      const prevWorked = prevMap[staff.id]
      const carryOverHours = prevWorked !== undefined ? prevWorked - prevWeeklyHours : 0

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
        balanceState: deriveBalanceState(workedHours, weeklyHours),
        carryOverHours,
      }
    })
  } catch (error) {
    if (error instanceof AppError) throw error
    throw new Error('Error al obtener los balances semanales')
  }
}

export async function getStaffWeeklyBalance(
  staffId: string,
  weekStart: string,
): Promise<WeeklyBalanceRow | null> {
  await requireAccess({ roles: ['admin', 'admin_area'] })

  try {
    const prevWeekStart = getPrevWeekMonday(weekStart)
    const [cfg, prevCfg] = await Promise.all([
      loadValidationRuntimeConfigAt(getWeekEnd(weekStart)),
      loadValidationRuntimeConfigAt(getWeekEnd(prevWeekStart)),
    ])
    const weeklyHours = cfg.weeklyHours
    const prevWeeklyHours = prevCfg.weeklyHours
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
      extraHours: Math.max(0, workedHours - weeklyHours),
      sundayCount: balance?.sundayCount ?? 0,
      overnightCount: balance?.overnightCount ?? 0,
      balanceState: deriveBalanceState(workedHours, weeklyHours),
      carryOverHours: prevWorked !== undefined ? prevWorked - prevWeeklyHours : 0,
    }
  } catch (error) {
    if (error instanceof AppError) throw error
    throw new Error('Error al obtener el balance semanal del colaborador')
  }
}

export async function recalculateWeeklyBalance(
  staffId: string,
  weekStart: string,
): Promise<void> {
  await requireAccess({ roles: ['admin', 'admin_area'] })
  try {
    await computeAndSaveWeeklyBalance(staffId, weekStart)
  } catch (error) {
    if (error instanceof AppError) throw error
    throw new Error('Error al recalcular el balance semanal')
  }
}

/** Recalculates weekly balance for ALL active staff members in a given week. */
export async function recalculateAllWeeklyBalances(
  weekStart: string,
  areaOverride?: Area | null,
): Promise<RecalculateResult> {
  // Comercial puede recalcular cross-área: el recalc es un refresh de cache
  // derivado de fuentes inmutables (sede_shifts, campaign_assignments,
  // campaign_vehicles). No modifica datos de usuario. Admin_area de banco o
  // logística sigue acotado a su propia área.
  const { scope } = await requireAccess({
    roles: ['admin', 'admin_area', 'comercial'],
    allowCrossArea: true,
  })
  const areaScope: Area | null =
    scope.kind === 'global' ? areaOverride ?? null : scope.area

  const staffWhere = [eq(staffMembers.isActive, true)]
  if (areaScope) staffWhere.push(eq(staffMembers.area, areaScope))

  const activeStaff = await db
    .select({ id: staffMembers.id })
    .from(staffMembers)
    .where(and(...staffWhere))
    .orderBy(asc(staffMembers.lastName))

  let updated = 0
  const errors: { staffId: string; message: string }[] = []

  for (const s of activeStaff) {
    try {
      await computeAndSaveWeeklyBalance(s.id, weekStart)
      updated++
    } catch (err) {
      console.error('[recalculateWeeklyBalances]', s.id, err)
      errors.push({
        staffId: s.id,
        message: err instanceof Error ? err.message : String(err),
      })
    }
  }

  return { updated, errors }
}
