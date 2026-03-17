import { pgTable, uuid, integer, date, timestamp, uniqueIndex } from 'drizzle-orm/pg-core'
import { staffMembers } from './staff-members'

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
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex('weekly_balance_staff_week_idx').on(t.staffId, t.weekStart),
])

export type WeeklyBalance = typeof weeklyBalance.$inferSelect
export type NewWeeklyBalance = typeof weeklyBalance.$inferInsert
