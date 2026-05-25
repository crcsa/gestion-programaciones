import { pgTable, uuid, text, boolean, timestamp, doublePrecision } from 'drizzle-orm/pg-core'
import { companies } from './companies'

export const locations = pgTable('locations', {
  id: uuid('id').primaryKey().defaultRandom(),
  companyId: uuid('company_id').references(() => companies.id, { onDelete: 'set null' }),
  name: text('name').notNull(),
  address: text('address').notNull(),
  municipality: text('municipality').notNull(),
  department: text('department').notNull().default('Antioquia'),
  referencePoint: text('reference_point'),
  capacity: text('capacity'),
  // Geolocalización (OpenStreetMap / Nominatim). Nullable: se llena de forma
  // perezosa al primer view del mapa o vía script de backfill.
  latitude: doublePrecision('latitude'),
  longitude: doublePrecision('longitude'),
  geocodedAt: timestamp('geocoded_at', { withTimezone: true }),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export type Location = typeof locations.$inferSelect
export type NewLocation = typeof locations.$inferInsert
