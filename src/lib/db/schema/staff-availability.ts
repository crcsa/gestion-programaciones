import { pgTable, uuid, date, time, text, timestamp } from 'drizzle-orm/pg-core'
import { availabilityTypeEnum } from './enums'
import { staffMembers } from './staff-members'

export const staffAvailability = pgTable('staff_availability', {
  id: uuid('id').primaryKey().defaultRandom(),
  staffId: uuid('staff_id')
    .references(() => staffMembers.id)
    .notNull(),
  date: date('date').notNull(),
  startTime: time('start_time'),
  endTime: time('end_time'),
  type: availabilityTypeEnum('type').notNull(),
  reason: text('reason'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})
