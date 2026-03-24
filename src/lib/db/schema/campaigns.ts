import { pgTable, uuid, text, date, integer, timestamp, boolean } from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'
import { campaignStatusEnum, campaignSizeEnum, campaignModalityEnum } from './enums'
import { companies } from './companies'
import { locations } from './locations'
import { profiles } from './profiles'
import { trainingAreas } from './training-areas'

export const campaigns = pgTable('campaigns', {
  id: uuid('id').primaryKey().defaultRandom(),
  code: text('code').notNull().unique(),
  companyId: uuid('company_id').references(() => companies.id, { onDelete: 'set null' }),
  locationId: uuid('location_id').references(() => locations.id, { onDelete: 'set null' }),
  campaignDate: date('campaign_date').notNull(),
  startTime: text('start_time'), // e.g. "08:00"
  endTime: text('end_time'),
  size: campaignSizeEnum('size').notNull(),
  modality: campaignModalityEnum('modality').notNull(),
  status: campaignStatusEnum('status').notNull().default('tentativa'),
  municipality: text('municipality').notNull(),
  expectedDonations: integer('expected_donations'),
  trainingAreaId: uuid('training_area_id').references(() => trainingAreas.id, { onDelete: 'set null' }),
  hexabankCode: text('hexabank_code'),
  cancelReason: text('cancel_reason'),
  observations: text('observations'),
  createdById: uuid('created_by_id').references(() => profiles.id, { onDelete: 'set null' }),
  confirmedById: uuid('confirmed_by_id').references(() => profiles.id, { onDelete: 'set null' }),
  confirmedAt: timestamp('confirmed_at', { withTimezone: true }),
  isDeleted: boolean('is_deleted').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const campaignsRelations = relations(campaigns, ({ one }) => ({
  company: one(companies, { fields: [campaigns.companyId], references: [companies.id] }),
  location: one(locations, { fields: [campaigns.locationId], references: [locations.id] }),
}))

export type Campaign = typeof campaigns.$inferSelect
export type NewCampaign = typeof campaigns.$inferInsert
