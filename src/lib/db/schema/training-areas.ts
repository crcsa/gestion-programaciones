import { pgTable, uuid, text, boolean, timestamp } from 'drizzle-orm/pg-core'

export const trainingAreas = pgTable('training_areas', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull().unique(),
  description: text('description'),
  forProfiles: text('for_profiles').array().notNull().default([]),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export type TrainingArea = typeof trainingAreas.$inferSelect
export type NewTrainingArea = typeof trainingAreas.$inferInsert
