import { pgTable, uuid, date, text, timestamp } from 'drizzle-orm/pg-core'
import { availabilityStatusEnum } from './enums'
import { staffMembers } from './staff-members'

export const staffAvailability = pgTable('staff_availability', {
  id: uuid('id').primaryKey().defaultRandom(),
  staffId: uuid('staff_id').notNull().references(() => staffMembers.id, { onDelete: 'cascade' }),
  availabilityDate: date('availability_date').notNull(),
  status: availabilityStatusEnum('status').notNull().default('disponible'),
  referenceId: uuid('reference_id'), // campaign or sede shift id
  referenceType: text('reference_type'), // 'campaign' | 'sede_shift'
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export type StaffAvailability = typeof staffAvailability.$inferSelect
export type NewStaffAvailability = typeof staffAvailability.$inferInsert
