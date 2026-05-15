/**
 * Recalcula `weekly_balance` y `monthly_counters` para todos los pares
 * (staff_id, weekStart) y (staff_id, year, month) que tienen turnos sede.
 *
 * Cuándo correrlo: después de aplicar la migración 0028 (descuento de almuerzo
 * en `diurno_completo`). El UPDATE de SQL ya modificó `sede_shifts.total_hours`
 * pero los agregados precomputados (`weekly_balance` y `monthly_counters`) aún
 * apuntan a los valores viejos hasta que se reescriben.
 *
 * Uso:
 *   pnpm tsx scripts/recalc-sede-balances.ts
 *
 * Idempotente: ejecutar varias veces produce el mismo resultado final. El
 * script imprime progreso por staff y reporta errores parciales sin abortar.
 */

import { db } from '../src/lib/db'
import { sedeShifts } from '../src/lib/db/schema/sede-shifts'
import {
  computeAndSaveWeeklyBalance,
} from '../src/features/hours/lib/balance-calculator'
import {
  computeAndSaveMonthlyCounters,
} from '../src/features/hours/lib/aggregate-staff-data'
import { getMondayOfIsoDate } from '../src/lib/date/week'

async function main() {
  const start = Date.now()

  // 1) Pares (staffId, weekStart) — derivamos weekStart desde shift_date.
  const allShifts = await db
    .select({
      staffId: sedeShifts.staffId,
      shiftDate: sedeShifts.shiftDate,
    })
    .from(sedeShifts)

  const weekPairs = new Set<string>()
  const monthPairs = new Set<string>()
  for (const s of allShifts) {
    const weekStart = getMondayOfIsoDate(s.shiftDate)
    weekPairs.add(`${s.staffId}|${weekStart}`)
    const [y, m] = s.shiftDate.split('-')
    monthPairs.add(`${s.staffId}|${y}|${m}`)
  }

  console.log(
    `[recalc] ${weekPairs.size} (staff,semana) y ${monthPairs.size} (staff,mes) por recalcular`,
  )

  // 2) Recalcular weekly_balance.
  let okWeeks = 0
  let failWeeks = 0
  for (const key of weekPairs) {
    const [staffId, weekStart] = key.split('|')
    try {
      await computeAndSaveWeeklyBalance(staffId, weekStart)
      okWeeks++
    } catch (err) {
      failWeeks++
      console.error('[recalc][week]', staffId, weekStart, err)
    }
  }
  console.log(`[recalc] weekly_balance: ${okWeeks} OK, ${failWeeks} fallos`)

  // 3) Recalcular monthly_counters.
  let okMonths = 0
  let failMonths = 0
  for (const key of monthPairs) {
    const [staffId, y, m] = key.split('|')
    try {
      await computeAndSaveMonthlyCounters(staffId, Number(y), Number(m))
      okMonths++
    } catch (err) {
      failMonths++
      console.error('[recalc][month]', staffId, y, m, err)
    }
  }
  console.log(`[recalc] monthly_counters: ${okMonths} OK, ${failMonths} fallos`)

  console.log(`[recalc] done en ${((Date.now() - start) / 1000).toFixed(1)}s`)

  // Forzamos exit: el `client` de postgres-js mantiene el pool abierto y el
  // process no terminaría solo. Sin esto, una corrida del script deja
  // conexiones en uso ocupando slots del pooler de Supabase, lo que ralentiza
  // o cuelga el dev server hasta que el pool libere.
  process.exit(failWeeks > 0 || failMonths > 0 ? 1 : 0)
}

main().catch((err) => {
  console.error('[recalc] error fatal:', err)
  process.exit(1)
})
