import { pgTable, uuid, integer, timestamp, uniqueIndex } from 'drizzle-orm/pg-core'
import { staffMembers } from './staff-members'

export const monthlyCounters = pgTable('monthly_counters', {
  id: uuid('id').primaryKey().defaultRandom(),
  staffId: uuid('staff_id').notNull().references(() => staffMembers.id, { onDelete: 'cascade' }),
  year: integer('year').notNull(),
  month: integer('month').notNull(), // 1-12
  totalHours: integer('total_hours').notNull().default(0),
  extraHours: integer('extra_hours').notNull().default(0),
  sundayCount: integer('sunday_count').notNull().default(0),
  overnightCount: integer('overnight_count').notNull().default(0),
  campaignCount: integer('campaign_count').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex('monthly_counters_staff_year_month_idx').on(t.staffId, t.year, t.month),
])

export type MonthlyCounter = typeof monthlyCounters.$inferSelect
export type NewMonthlyCounter = typeof monthlyCounters.$inferInsert
