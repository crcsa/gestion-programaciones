import { pgTable, uuid, text, timestamp } from 'drizzle-orm/pg-core'
import { campaigns } from './campaigns'
import { users } from './users'

export const campaignTimeline = pgTable('campaign_timeline', {
  id: uuid('id').primaryKey().defaultRandom(),
  campaignId: uuid('campaign_id')
    .references(() => campaigns.id)
    .notNull()
    .unique(),
  departureFromSede: timestamp('departure_from_sede', { withTimezone: true }),
  arrivalAtPoint: timestamp('arrival_at_point', { withTimezone: true }),
  campaignStart: timestamp('campaign_start', { withTimezone: true }),
  lunchStart: timestamp('lunch_start', { withTimezone: true }),
  lunchEnd: timestamp('lunch_end', { withTimezone: true }),
  campaignEnd: timestamp('campaign_end', { withTimezone: true }),
  pickupTime: timestamp('pickup_time', { withTimezone: true }),
  arrivalAtSede: timestamp('arrival_at_sede', { withTimezone: true }),
  departureFromSedeEnd: timestamp('departure_from_sede_end', { withTimezone: true }),
  observations: text('observations'),
  loggedById: uuid('logged_by_id').references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})
