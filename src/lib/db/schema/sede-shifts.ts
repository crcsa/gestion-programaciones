import {
  pgTable,
  uuid,
  date,
  time,
  numeric,
  text,
  timestamp,
} from 'drizzle-orm/pg-core'
import { shiftTypeEnum } from './enums'
import { staffMembers } from './staff-members'
import { users } from './users'

export const sedeShifts = pgTable('sede_shifts', {
  id: uuid('id').primaryKey().defaultRandom(),
  staffId: uuid('staff_id')
    .references(() => staffMembers.id)
    .notNull(),
  date: date('date').notNull(),
  shiftType: shiftTypeEnum('shift_type').notNull(),
  startTime: time('start_time').notNull(),
  endTime: time('end_time').notNull(),
  totalHours: numeric('total_hours', { precision: 5, scale: 2 }).notNull(),
  notes: text('notes'),
  createdById: uuid('created_by_id')
    .references(() => users.id)
    .notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})
