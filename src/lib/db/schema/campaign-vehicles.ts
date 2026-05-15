import { pgTable, uuid, boolean, timestamp, unique } from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'
import { campaigns } from './campaigns'
import { vehicles } from './vehicles'
import { staffMembers } from './staff-members'

export const campaignVehicles = pgTable(
  'campaign_vehicles',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    campaignId: uuid('campaign_id')
      .notNull()
      .references(() => campaigns.id, { onDelete: 'cascade' }),
    vehicleId: uuid('vehicle_id')
      .notNull()
      .references(() => vehicles.id, { onDelete: 'restrict' }),
    driverStaffId: uuid('driver_staff_id').references(() => staffMembers.id, {
      onDelete: 'set null',
    }),
    assignedAt: timestamp('assigned_at', { withTimezone: true }).notNull().defaultNow(),
    removedAt: timestamp('removed_at', { withTimezone: true }),
    isActive: boolean('is_active').notNull().default(true),
  },
  (t) => [unique('campaign_vehicles_campaign_vehicle_unique').on(t.campaignId, t.vehicleId)],
)

export const campaignVehiclesRelations = relations(campaignVehicles, ({ one }) => ({
  campaign: one(campaigns, {
    fields: [campaignVehicles.campaignId],
    references: [campaigns.id],
  }),
  vehicle: one(vehicles, {
    fields: [campaignVehicles.vehicleId],
    references: [vehicles.id],
  }),
  driver: one(staffMembers, {
    fields: [campaignVehicles.driverStaffId],
    references: [staffMembers.id],
  }),
}))

export type CampaignVehicle = typeof campaignVehicles.$inferSelect
export type NewCampaignVehicle = typeof campaignVehicles.$inferInsert
