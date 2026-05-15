'use server'

import { eq, and, sql } from 'drizzle-orm'
import { AppError } from '@/lib/errors/app-errors'
import { db } from '@/lib/db'
import { monthlyCounters } from '@/lib/db/schema/monthly-counters'
import { requireAccess } from '@/features/auth/lib/require-access'

// ---- Actions --------------------------------------------------------------

export async function incrementMonthlyCounters(data: {
  staffId: string
  year: number
  month: number
  isSunday: boolean
  isOvernight: boolean
}): Promise<void> {
  await requireAccess({ roles: ['admin', 'admin_area'] })

  const { staffId, year, month, isSunday, isOvernight } = data

  try {
    await db
      .insert(monthlyCounters)
      .values({
        staffId,
        year,
        month,
        sundayCount: isSunday ? 1 : 0,
        overnightCount: isOvernight ? 1 : 0,
      })
      .onConflictDoUpdate({
        target: [monthlyCounters.staffId, monthlyCounters.year, monthlyCounters.month],
        set: {
          sundayCount: isSunday
            ? sql`${monthlyCounters.sundayCount} + 1`
            : monthlyCounters.sundayCount,
          overnightCount: isOvernight
            ? sql`${monthlyCounters.overnightCount} + 1`
            : monthlyCounters.overnightCount,
          updatedAt: sql`now()`,
        },
      })
  } catch (error) {
    if (error instanceof AppError) throw error
    throw new Error('Error al incrementar contadores mensuales')
  }
}

export async function decrementMonthlyCounters(data: {
  staffId: string
  year: number
  month: number
  isSunday: boolean
  isOvernight: boolean
}): Promise<void> {
  await requireAccess({ roles: ['admin', 'admin_area'] })

  const { staffId, year, month, isSunday, isOvernight } = data

  try {
    const [existing] = await db
      .select()
      .from(monthlyCounters)
      .where(
        and(
          eq(monthlyCounters.staffId, staffId),
          eq(monthlyCounters.year, year),
          eq(monthlyCounters.month, month),
        ),
      )
      .limit(1)

    if (!existing) return

    await db
      .update(monthlyCounters)
      .set({
        sundayCount: isSunday
          ? sql`GREATEST(0, ${monthlyCounters.sundayCount} - 1)`
          : monthlyCounters.sundayCount,
        overnightCount: isOvernight
          ? sql`GREATEST(0, ${monthlyCounters.overnightCount} - 1)`
          : monthlyCounters.overnightCount,
        updatedAt: sql`now()`,
      })
      .where(
        and(
          eq(monthlyCounters.staffId, staffId),
          eq(monthlyCounters.year, year),
          eq(monthlyCounters.month, month),
        ),
      )
  } catch (error) {
    if (error instanceof AppError) throw error
    throw new Error('Error al decrementar contadores mensuales')
  }
}
