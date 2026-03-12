import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  date,
  time,
  timestamp,
} from 'drizzle-orm/pg-core'
import { campaignSizeEnum, campaignModalityEnum, campaignStatusEnum } from './enums'
import { companies } from './companies'
import { locations } from './locations'
import { staffMembers } from './staff-members'
import { users } from './users'

export const campaigns = pgTable('campaigns', {
  id: uuid('id').primaryKey().defaultRandom(),
  code: varchar('code', { length: 50 }).notNull().unique(),
  companyId: uuid('company_id').references(() => companies.id),
  locationId: uuid('location_id').references(() => locations.id),
  campaignSize: campaignSizeEnum('campaign_size').notNull(),
  modality: campaignModalityEnum('modality').notNull(),
  date: date('date').notNull(),
  startTime: time('start_time').notNull(),
  estimatedEndTime: time('estimated_end_time'),
  requiresOvernight: boolean('requires_overnight').notNull().default(false),
  hexabankLocationCode: varchar('hexabank_location_code', { length: 50 }),
  coordinatorId: uuid('coordinator_id').references(() => staffMembers.id),
  status: campaignStatusEnum('status').notNull().default('tentativa'),
  cancellationReason: text('cancellation_reason'),
  observations: text('observations'),
  confirmedById: uuid('confirmed_by_id').references(() => users.id),
  createdById: uuid('created_by_id')
    .references(() => users.id)
    .notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})
