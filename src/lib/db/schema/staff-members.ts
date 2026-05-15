import { pgTable, uuid, text, integer, boolean, timestamp, date, primaryKey } from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'
import { staffProfileEnum, contractTypeEnum, shiftTypeEnum, areaEnum } from './enums'
import { profiles } from './profiles'
import { trainingAreas } from './training-areas'

export const staffMembers = pgTable('staff_members', {
  id: uuid('id').primaryKey().defaultRandom(),
  profileId: uuid('profile_id').references(() => profiles.id, { onDelete: 'set null' }),
  firstName: text('first_name').notNull(),
  lastName: text('last_name').notNull(),
  cedula: text('cedula').notNull().unique(),
  phone: text('phone'),
  email: text('email'),
  staffProfile: staffProfileEnum('staff_profile').notNull(),
  // NOT NULL sin DEFAULT: cada INSERT debe elegir el área conscientemente.
  // Ver migración 0021_drop_staff_area_default.sql.
  area: areaEnum('area').notNull(),
  contractType: contractTypeEnum('contract_type'),
  weeklyHours: integer('weekly_hours').notNull().default(44),
  defaultShift: shiftTypeEnum('default_shift'),
  hireDate: date('hire_date'),
  isActive: boolean('is_active').notNull().default(true),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const staffTrainingAreas = pgTable('staff_training_areas', {
  staffId: uuid('staff_id').notNull().references(() => staffMembers.id, { onDelete: 'cascade' }),
  trainingAreaId: uuid('training_area_id').notNull().references(() => trainingAreas.id, { onDelete: 'cascade' }),
}, (t) => [
  primaryKey({ columns: [t.staffId, t.trainingAreaId] }),
])

export const staffMembersRelations = relations(staffMembers, ({ many }) => ({
  trainingAreas: many(staffTrainingAreas),
}))

export const staffTrainingAreasRelations = relations(staffTrainingAreas, ({ one }) => ({
  staff: one(staffMembers, { fields: [staffTrainingAreas.staffId], references: [staffMembers.id] }),
  trainingArea: one(trainingAreas, { fields: [staffTrainingAreas.trainingAreaId], references: [trainingAreas.id] }),
}))

export type StaffMember = typeof staffMembers.$inferSelect
export type NewStaffMember = typeof staffMembers.$inferInsert
