import { pgTable, uuid, text, integer, boolean, timestamp, index } from 'drizzle-orm/pg-core'

export const vehicles = pgTable(
  'vehicles',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    plate: text('plate').notNull().unique(),
    /** Número interno (móvil) que identifica al vehículo dentro de la flota. */
    mobileNumber: text('mobile_number'),
    model: text('model'),
    year: integer('year'),
    capacity: integer('capacity'),
    notes: text('notes'),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('vehicles_active_idx').on(t.isActive)],
)

export type Vehicle = typeof vehicles.$inferSelect
export type NewVehicle = typeof vehicles.$inferInsert
