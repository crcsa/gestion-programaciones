import {
  pgTable,
  uuid,
  integer,
  timestamp,
  unique,
} from 'drizzle-orm/pg-core'
import { staffMembers } from './staff-members'

export const monthlyCounters = pgTable(
  'monthly_counters',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    staffId: uuid('staff_id')
      .references(() => staffMembers.id)
      .notNull(),
    month: integer('month').notNull(),
    year: integer('year').notNull(),
    sundaysWorked: integer('sundays_worked').notNull().default(0),
    overnightsCount: integer('overnights_count').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [unique().on(table.staffId, table.month, table.year)],
)
