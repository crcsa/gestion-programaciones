import {
  pgTable,
  uuid,
  date,
  integer,
  numeric,
  text,
  timestamp,
  unique,
} from 'drizzle-orm/pg-core'
import { staffMembers } from './staff-members'

export const weeklyBalance = pgTable(
  'weekly_balance',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    staffId: uuid('staff_id')
      .references(() => staffMembers.id)
      .notNull(),
    weekStart: date('week_start').notNull(),
    weekEnd: date('week_end').notNull(),
    contractedHours: integer('contracted_hours').notNull().default(44),
    workedHours: numeric('worked_hours', { precision: 5, scale: 2 })
      .notNull()
      .default('0'),
    overtimeHours: numeric('overtime_hours', { precision: 5, scale: 2 })
      .notNull()
      .default('0'),
    balance: numeric('balance', { precision: 5, scale: 2 }).notNull().default('0'),
    carriedFromPrevious: numeric('carried_from_previous', {
      precision: 5,
      scale: 2,
    })
      .notNull()
      .default('0'),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [unique().on(table.staffId, table.weekStart)],
)
