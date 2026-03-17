import { pgTable, uuid, text, boolean, timestamp } from 'drizzle-orm/pg-core'

export const companies = pgTable('companies', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  nit: text('nit').unique(),
  contactName: text('contact_name'),
  contactPhone: text('contact_phone'),
  contactEmail: text('contact_email'),
  address: text('address'),
  municipality: text('municipality'),
  department: text('department').default('Antioquia'),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export type Company = typeof companies.$inferSelect
export type NewCompany = typeof companies.$inferInsert
