import { pgTable, uuid, integer, date, timestamp, uniqueIndex, index } from 'drizzle-orm/pg-core'
import { staffMembers } from './staff-members'

/**
 * Balance semanal precomputado por staff.
 *
 * Campos del **banco de horas** (`bank_delta`, `bank_balance_month`,
 * `bank_month_key`) implementan la regla:
 *
 *   * worked < 44       → bank_delta = worked - 44 (deuda)
 *   * 44 <= worked <= 56 → bank_delta = 0
 *     (las primeras 12h sobre 44 son extras normales y NO van al banco)
 *   * worked > 56       → bank_delta = worked - 56 (crédito)
 *
 * `bank_month_key` es el **primer día del mes que contiene el lunes**
 * (`week_start`). Convención: una semana pertenece al mes de su lunes, y las
 * semanas que cruzan meses no se parten. `bank_balance_month` es la suma
 * acumulada de `bank_delta` dentro del mismo (staff_id, bank_month_key)
 * para todas las semanas con `week_start <=` la actual, INCLUYENDO esta.
 *
 * Reset mensual: al primer lunes de cada mes el acumulado arranca en el
 * `bank_delta` de esa semana.
 *
 * Detalle de migraciones:
 *   - 0031 introduce los tres campos. Existe un sentinel `'1970-01-01'` en
 *     `bank_month_key` solo durante el backfill — el código TS no lo usa.
 */
export const weeklyBalance = pgTable('weekly_balance', {
  id: uuid('id').primaryKey().defaultRandom(),
  staffId: uuid('staff_id').notNull().references(() => staffMembers.id, { onDelete: 'cascade' }),
  weekStart: date('week_start').notNull(),
  scheduledHours: integer('scheduled_hours').notNull().default(0),
  workedHours: integer('worked_hours').notNull().default(0),
  campaignHours: integer('campaign_hours').notNull().default(0),
  sedeHours: integer('sede_hours').notNull().default(0),
  extraHours: integer('extra_hours').notNull().default(0),
  sundayCount: integer('sunday_count').notNull().default(0),
  overnightCount: integer('overnight_count').notNull().default(0),
  /** Saldo neto semanal del banco de horas. Ver doc de la tabla. */
  bankDelta: integer('bank_delta').notNull().default(0),
  /** Acumulado del mes-staff hasta esta semana inclusive. */
  bankBalanceMonth: integer('bank_balance_month').notNull().default(0),
  /** Primer día del mes que contiene `weekStart` (convención mes-del-lunes). */
  bankMonthKey: date('bank_month_key').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex('weekly_balance_staff_week_idx').on(t.staffId, t.weekStart),
  index('weekly_balance_staff_bank_month_idx').on(t.staffId, t.bankMonthKey),
])

export type WeeklyBalance = typeof weeklyBalance.$inferSelect
export type NewWeeklyBalance = typeof weeklyBalance.$inferInsert
