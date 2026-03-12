import {
  pgTable,
  uuid,
  date,
  numeric,
  varchar,
  timestamp,
} from 'drizzle-orm/pg-core'
import { hoursEntryTypeEnum } from './enums'
import { staffMembers } from './staff-members'
import { campaignAssignments } from './campaign-assignments'
import { users } from './users'

export const hoursLog = pgTable('hours_log', {
  id: uuid('id').primaryKey().defaultRandom(),
  staffId: uuid('staff_id')
    .references(() => staffMembers.id)
    .notNull(),
  date: date('date').notNull(),
  entryType: hoursEntryTypeEnum('entry_type').notNull(),
  startTime: timestamp('start_time', { withTimezone: true }).notNull(),
  endTime: timestamp('end_time', { withTimezone: true }).notNull(),
  totalHours: numeric('total_hours', { precision: 5, scale: 2 }).notNull(),
  regularHours: numeric('regular_hours', { precision: 5, scale: 2 })
    .notNull()
    .default('0'),
  overtimeHours: numeric('overtime_hours', { precision: 5, scale: 2 })
    .notNull()
    .default('0'),
  surchargeType: varchar('surcharge_type', { length: 50 }),
  campaignAssignmentId: uuid('campaign_assignment_id').references(
    () => campaignAssignments.id,
  ),
  loggedById: uuid('logged_by_id')
    .references(() => users.id)
    .notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})
