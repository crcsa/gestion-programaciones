import { pgTable, uuid, text, boolean, timestamp, uniqueIndex } from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'
import { companies } from './companies'

export const companyContacts = pgTable(
  'company_contacts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id, { onDelete: 'cascade' }),
    fullName: text('full_name').notNull(),
    position: text('position'),
    email: text('email'),
    phone: text('phone'),
    isPrimary: boolean('is_primary').notNull().default(false),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    onlyOnePrimaryPerCompany: uniqueIndex('company_contacts_primary_unique')
      .on(table.companyId)
      .where(sql`${table.isPrimary} = true`),
  }),
)

export type CompanyContact = typeof companyContacts.$inferSelect
export type NewCompanyContact = typeof companyContacts.$inferInsert
