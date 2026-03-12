import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  timestamp,
  unique,
} from 'drizzle-orm/pg-core'
import { staffMembers } from './staff-members'

export const trainingAreas = pgTable('training_areas', {
  id: uuid('id').primaryKey().defaultRandom(),
  code: varchar('code', { length: 20 }).notNull().unique(),
  name: varchar('name', { length: 100 }).notNull(),
  description: text('description'),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const staffTrainingAreas = pgTable(
  'staff_training_areas',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    staffId: uuid('staff_id')
      .references(() => staffMembers.id)
      .notNull(),
    trainingAreaId: uuid('training_area_id')
      .references(() => trainingAreas.id)
      .notNull(),
    isActive: boolean('is_active').notNull().default(true),
  },
  (table) => [unique().on(table.staffId, table.trainingAreaId)],
)
