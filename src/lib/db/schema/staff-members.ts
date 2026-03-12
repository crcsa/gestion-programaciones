import {
  pgTable,
  uuid,
  varchar,
  boolean,
  integer,
  timestamp,
} from 'drizzle-orm/pg-core'
import { profileTypeEnum, shiftTypeEnum } from './enums'
import { users } from './users'

export const staffMembers = pgTable('staff_members', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id),
  documentNumber: varchar('document_number', { length: 20 }).notNull().unique(),
  firstName: varchar('first_name', { length: 100 }).notNull(),
  lastName: varchar('last_name', { length: 100 }).notNull(),
  phone: varchar('phone', { length: 20 }),
  profileType: profileTypeEnum('profile_type').notNull(),
  contractType: varchar('contract_type', { length: 50 }),
  weeklyContractHours: integer('weekly_contract_hours').notNull().default(44),
  maxOvertimeWeekly: integer('max_overtime_weekly').notNull().default(12),
  maxShiftHours: integer('max_shift_hours').notNull().default(12),
  defaultShiftType: shiftTypeEnum('default_shift_type'),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})
