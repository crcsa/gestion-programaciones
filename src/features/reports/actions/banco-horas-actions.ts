'use server'

import { z } from 'zod'
import { and, asc, eq, gte, lte, inArray, sql, desc } from 'drizzle-orm'
import { db } from '@/lib/db'
import { weeklyBalance } from '@/lib/db/schema/weekly-balance'
import { staffMembers } from '@/lib/db/schema/staff-members'
import { requireAccess } from '@/features/auth/lib/require-access'
import { ValidationError } from '@/lib/errors/app-errors'
import { rethrowOrLog } from '@/lib/errors/rethrow'
import { VALID_AREAS, type Area } from '@/types/areas'
import type { StaffProfile } from '@/features/staff/lib/constants'

/**
 * Estado del banco de horas al cierre del periodo.
 *
 *   - `cumplio`         : -1 < bankBalanceMonth < 1
 *   - `debe`            : bankBalanceMonth <= -1 (deuda con el banco)
 *   - `compensatorio`   : bankBalanceMonth >= 1 (crédito de horas)
 */
export type BancoHorasState = 'cumplio' | 'debe' | 'compensatorio'

export interface BancoHorasReportRow {
  staffId: string
  firstName: string
  lastName: string
  staffProfile: StaffProfile | string
  area: Area
  /** Suma de horas trabajadas en las semanas del periodo. */
  workedHours: number
  /** Suma de bank_delta de las semanas del periodo. */
  bankDelta: number
  /** Acumulado del bank_balance_month en la ULTIMA semana del periodo
   *  (proxy del saldo al cierre). */
  bankBalanceMonth: number
  /** Cuántas semanas contribuyeron al periodo. */
  weeksCount: number
  state: BancoHorasState
}

const PARAMS_SCHEMA = z.object({
  year: z.number().int().min(2000).max(2100),
  month: z.number().int().min(1).max(12),
  granularity: z.enum(['mensual', 'quincenal_q1', 'quincenal_q2']),
  area: z.enum(VALID_AREAS as readonly [Area, ...Area[]]).nullable().optional(),
})

export type BancoHorasReportParams = z.infer<typeof PARAMS_SCHEMA>

function deriveState(balance: number): BancoHorasState {
  if (balance >= 1) return 'compensatorio'
  if (balance <= -1) return 'debe'
  return 'cumplio'
}

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

/**
 * Calcula el rango [weekStartMin, weekStartMax] (inclusive, ambos lados) de
 * lunes que califican para la granularidad pedida. Filtra por `weekStart`
 * porque la convención mes-del-lunes usa esa columna como pivote.
 *
 *   - mensual      : lunes con bank_month_key = primer dia del mes.
 *   - quincenal_q1 : weekStart entre dia 1 y 14 del mes.
 *   - quincenal_q2 : weekStart entre dia 15 y ultimo dia del mes.
 */
function buildPeriodRange(
  year: number,
  month: number,
  granularity: BancoHorasReportParams['granularity'],
): { weekStartMin: string; weekStartMax: string; bankMonthKey: string } {
  const monthKey = `${year}-${pad(month)}-01`
  const lastDay = new Date(year, month, 0).getDate()

  if (granularity === 'quincenal_q1') {
    return {
      weekStartMin: `${year}-${pad(month)}-01`,
      weekStartMax: `${year}-${pad(month)}-14`,
      bankMonthKey: monthKey,
    }
  }
  if (granularity === 'quincenal_q2') {
    return {
      weekStartMin: `${year}-${pad(month)}-15`,
      weekStartMax: `${year}-${pad(month)}-${pad(lastDay)}`,
      bankMonthKey: monthKey,
    }
  }
  // mensual: todo el mes (cualquier lunes del mes)
  return {
    weekStartMin: `${year}-${pad(month)}-01`,
    weekStartMax: `${year}-${pad(month)}-${pad(lastDay)}`,
    bankMonthKey: monthKey,
  }
}

/**
 * Reporte del banco de horas por staff para un mes/quincena.
 *
 * Permisos:
 *   - admin (global)       : ve todos; respeta `area` si se pasa.
 *   - admin_area           : queda anclado a `scope.area`; ignora `area`.
 *   - operativo / comercial: rechazado por requireAccess (no listados).
 *
 * NO usa allowCrossArea: las áreas operativas (banco_sangre, logistica)
 * deben gestionar su propio banco. Para una vista global, usar el super-admin.
 */
export async function getBancoHorasReport(
  params: BancoHorasReportParams,
): Promise<BancoHorasReportRow[]> {
  const { scope } = await requireAccess({ roles: ['admin', 'admin_area'] })

  const parsed = PARAMS_SCHEMA.safeParse(params)
  if (!parsed.success) {
    throw new ValidationError(parsed.error.issues[0].message)
  }

  const areaScope: Area | null =
    scope.kind === 'global' ? parsed.data.area ?? null : scope.area

  try {
    const { weekStartMin, weekStartMax, bankMonthKey } = buildPeriodRange(
      parsed.data.year,
      parsed.data.month,
      parsed.data.granularity,
    )

    // 1) Staff activo en el área seleccionada (si aplica).
    const staffWhere = [eq(staffMembers.isActive, true)]
    if (areaScope) staffWhere.push(eq(staffMembers.area, areaScope))

    const activeStaff = await db
      .select({
        id: staffMembers.id,
        firstName: staffMembers.firstName,
        lastName: staffMembers.lastName,
        staffProfile: staffMembers.staffProfile,
        area: staffMembers.area,
      })
      .from(staffMembers)
      .where(and(...staffWhere))
      .orderBy(asc(staffMembers.lastName))

    if (activeStaff.length === 0) return []

    const staffIds = activeStaff.map((s) => s.id)

    // 2) Sumar workedHours + bankDelta + contar semanas en el periodo.
    const aggregates = await db
      .select({
        staffId: weeklyBalance.staffId,
        workedSum: sql<number>`COALESCE(SUM(${weeklyBalance.workedHours}), 0)::int`,
        bankDeltaSum: sql<number>`COALESCE(SUM(${weeklyBalance.bankDelta}), 0)::int`,
        weeksCount: sql<number>`COUNT(*)::int`,
      })
      .from(weeklyBalance)
      .where(
        and(
          inArray(weeklyBalance.staffId, staffIds),
          eq(weeklyBalance.bankMonthKey, bankMonthKey),
          gte(weeklyBalance.weekStart, weekStartMin),
          lte(weeklyBalance.weekStart, weekStartMax),
        ),
      )
      .groupBy(weeklyBalance.staffId)

    // 3) Último bank_balance_month dentro del periodo (proxy del cierre).
    const lastBalances = await db
      .select({
        staffId: weeklyBalance.staffId,
        bankBalanceMonth: weeklyBalance.bankBalanceMonth,
        weekStart: weeklyBalance.weekStart,
      })
      .from(weeklyBalance)
      .where(
        and(
          inArray(weeklyBalance.staffId, staffIds),
          eq(weeklyBalance.bankMonthKey, bankMonthKey),
          gte(weeklyBalance.weekStart, weekStartMin),
          lte(weeklyBalance.weekStart, weekStartMax),
        ),
      )
      .orderBy(desc(weeklyBalance.weekStart))

    // Quedarse con el primer (más reciente) row por staff.
    const lastBalanceByStaff = new Map<string, number>()
    for (const row of lastBalances) {
      if (!lastBalanceByStaff.has(row.staffId)) {
        lastBalanceByStaff.set(row.staffId, row.bankBalanceMonth)
      }
    }

    const aggByStaff = new Map<
      string,
      { workedSum: number; bankDeltaSum: number; weeksCount: number }
    >()
    for (const a of aggregates) {
      aggByStaff.set(a.staffId, {
        workedSum: a.workedSum,
        bankDeltaSum: a.bankDeltaSum,
        weeksCount: a.weeksCount,
      })
    }

    return activeStaff.map((s) => {
      const agg = aggByStaff.get(s.id)
      const bankBalanceMonth = lastBalanceByStaff.get(s.id) ?? 0
      return {
        staffId: s.id,
        firstName: s.firstName,
        lastName: s.lastName,
        staffProfile: s.staffProfile as StaffProfile | string,
        area: s.area as Area,
        workedHours: agg?.workedSum ?? 0,
        bankDelta: agg?.bankDeltaSum ?? 0,
        bankBalanceMonth,
        weeksCount: agg?.weeksCount ?? 0,
        state: deriveState(bankBalanceMonth),
      }
    })
  } catch (error) {
    rethrowOrLog(error, 'getBancoHorasReport', 'Error al obtener el reporte de banco de horas')
  }
}
