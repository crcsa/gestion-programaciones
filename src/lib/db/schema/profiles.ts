import { pgTable, uuid, text, timestamp, boolean } from 'drizzle-orm/pg-core'
import { roleEnum } from './enums'

export const profiles = pgTable('profiles', {
  id: uuid('id').primaryKey(), // references auth.users(id)
  email: text('email').notNull(),
  fullName: text('full_name').notNull(),
  role: roleEnum('role').notNull().default('operativo'),
  avatarUrl: text('avatar_url'),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export type Profile = typeof profiles.$inferSelect
export type NewProfile = typeof profiles.$inferInsert
