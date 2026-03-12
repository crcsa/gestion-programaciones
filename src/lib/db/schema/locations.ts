import { pgTable, uuid, varchar, text, timestamp } from 'drizzle-orm/pg-core'
import { companies } from './companies'

export const locations = pgTable('locations', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }).notNull(),
  address: text('address'),
  city: varchar('city', { length: 100 }),
  municipality: varchar('municipality', { length: 100 }),
  hexabankCode: varchar('hexabank_code', { length: 50 }),
  companyId: uuid('company_id').references(() => companies.id),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})
