import { pgTable, uuid, integer, date, text, timestamp } from 'drizzle-orm/pg-core'
import { staffMembers } from './staff-members'
import { profiles } from './profiles'

export const hoursLog = pgTable('hours_log', {
  id: uuid('id').primaryKey().defaultRandom(),
  staffId: uuid('staff_id').notNull().references(() => staffMembers.id, { onDelete: 'cascade' }),
  logDate: date('log_date').notNull(),
  hoursWorked: integer('hours_worked').notNull(),
  sourceType: text('source_type').notNull(), // 'sede_shift' | 'campaign'
  sourceId: uuid('source_id').notNull(),
  notes: text('notes'),
  createdById: uuid('created_by_id').references(() => profiles.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export type HoursLog = typeof hoursLog.$inferSelect
export type NewHoursLog = typeof hoursLog.$inferInsert
