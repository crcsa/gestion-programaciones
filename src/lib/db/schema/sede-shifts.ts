import { pgTable, uuid, date, integer, boolean, text, timestamp } from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'
import { shiftTypeEnum } from './enums'
import { staffMembers } from './staff-members'
import { profiles } from './profiles'

export const sedeShifts = pgTable('sede_shifts', {
  id: uuid('id').primaryKey().defaultRandom(),
  staffId: uuid('staff_id').notNull().references(() => staffMembers.id, { onDelete: 'cascade' }),
  shiftDate: date('shift_date').notNull(),
  shiftType: shiftTypeEnum('shift_type').notNull(),
  startTime: text('start_time').notNull(), // e.g. "07:00"
  endTime: text('end_time').notNull(),     // e.g. "19:00"
  totalHours: integer('total_hours').notNull(), // in integer hours, max 12
  isOvernight: boolean('is_overnight').notNull().default(false),
  notes: text('notes'),
  createdById: uuid('created_by_id').references(() => profiles.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const sedeShiftsRelations = relations(sedeShifts, ({ one }) => ({
  staff: one(staffMembers, { fields: [sedeShifts.staffId], references: [staffMembers.id] }),
}))

export type SedeShift = typeof sedeShifts.$inferSelect
export type NewSedeShift = typeof sedeShifts.$inferInsert
