/**
 * Pure DB calculation — no 'use server', no auth checks.
 * Imported by server actions that have already authenticated.
 */
import { eq, and, sql, lt } from 'drizzle-orm'
import { db } from '@/lib/db'
import { sedeShifts } from '@/lib/db/schema/sede-shifts'
import { weeklyBalance } from '@/lib/db/schema/weekly-balance'
import { loadValidationRuntimeConfigAt } from '@/features/configuration/lib/runtime-config'
import { getStaffCampaignDayPoints } from './aggregate-staff-data'
import { getSundayOfWeek } from '@/lib/date/week'

/**
 * Devuelve el primer día (YYYY-MM-01) del mes que contiene `weekStart` (un
 * lunes). Convención del banco de horas: una semana pertenece al mes que
 * contiene su lunes — las semanas que cruzan meses NO se parten.
 */
function getBankMonthKey(weekStart: string): string {
  // weekStart es ISO date-only "YYYY-MM-DD"; reemplazamos el día por "01"
  // sin tocar timezones.
  return `${weekStart.slice(0, 7)}-01`
}

/**
 * Calcula `bankDelta` semanal con la regla:
 *   - worked < weeklyHours        → bankDelta = worked - weeklyHours (deuda)
 *   - weeklyHours <= worked <= cap → bankDelta = 0 (extras normales, no van al banco)
 *   - worked > cap                → bankDelta = worked - cap (crédito)
 *   donde cap = weeklyHours + maxExtraHoursWeek (default 44 + 12 = 56h).
 *
 * Exportada para tests unitarios y para que el reporte pueda derivar el delta
 * sin tener que persistir la fila.
 */
export function computeBankDelta(
  workedHours: number,
  weeklyHours: number,
  maxExtraHoursWeek: number,
): number {
  if (workedHours < weeklyHours) return workedHours - weeklyHours
  const cap = weeklyHours + maxExtraHoursWeek
  if (workedHours <= cap) return 0
  return workedHours - cap
}

/**
 * Calcula y guarda `weekly_balance` para un staff en una semana específica.
 *
 * Convención mes-del-lunes (banco de horas): la semana pertenece al mes que
 * contiene su lunes (`weekStart`). Las semanas que cruzan meses se asignan
 * COMPLETAS al mes del lunes; el saldo no se parte. Reset mensual: en el
 * primer lunes de cada mes el acumulado arranca con el `bankDelta` de la
 * semana.
 *
 * Concurrencia: usa `pg_advisory_xact_lock(hashtext(staffId))` al inicio de
 * la transacción para serializar recalculos concurrentes del mismo staff
 * (el cron procesa varias semanas en paralelo y dos llamadas simultáneas
 * podrían leer un acumulado obsoleto y persistir dos veces el mismo delta).
 */
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

  const bankDelta = computeBankDelta(workedHours, cfg.weeklyHours, cfg.maxExtraHoursWeek)
  const bankMonthKey = getBankMonthKey(weekStart)

  // Serializamos por staffId para que recalcs paralelos del mismo mes-staff
  // no se pisen al leer/escribir el acumulado. `pg_advisory_xact_lock` libera
  // el lock al commit/rollback de la tx.
  await db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${staffId}))`)

    // Suma de bankDelta de SEMANAS ANTERIORES del mismo mes-staff
    // (estrictamente menores a weekStart). El bankDelta de ESTA semana se
    // añade abajo para llegar al acumulado final.
    const [prevRow] = await tx
      .select({
        total: sql<number>`COALESCE(SUM(${weeklyBalance.bankDelta}), 0)::int`,
      })
      .from(weeklyBalance)
      .where(
        and(
          eq(weeklyBalance.staffId, staffId),
          eq(weeklyBalance.bankMonthKey, bankMonthKey),
          lt(weeklyBalance.weekStart, weekStart),
        ),
      )

    const previousMonthTotal = Number(prevRow?.total ?? 0)
    const bankBalanceMonth = previousMonthTotal + bankDelta

    await tx
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
        bankDelta,
        bankBalanceMonth,
        bankMonthKey,
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
          bankDelta,
          bankBalanceMonth,
          bankMonthKey,
          updatedAt: new Date(),
        },
      })

    // Si esta semana NO era la última del mes, los acumulados de las semanas
    // posteriores del mismo mes-staff quedaron desactualizados. Los
    // recalculamos con la window function para mantener invariantes.
    await tx.execute(sql`
      WITH acc AS (
        SELECT
          id,
          SUM(${weeklyBalance.bankDelta}) OVER (
            PARTITION BY ${weeklyBalance.staffId}, ${weeklyBalance.bankMonthKey}
            ORDER BY ${weeklyBalance.weekStart}
            ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
          ) AS running_total
        FROM ${weeklyBalance}
        WHERE ${weeklyBalance.staffId} = ${staffId}
          AND ${weeklyBalance.bankMonthKey} = ${bankMonthKey}
      )
      UPDATE ${weeklyBalance} wb
      SET bank_balance_month = acc.running_total
      FROM acc
      WHERE wb.id = acc.id
    `)
  })
}
