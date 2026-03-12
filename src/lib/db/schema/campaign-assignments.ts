import {
  pgTable,
  uuid,
  varchar,
  boolean,
  numeric,
  timestamp,
  unique,
} from 'drizzle-orm/pg-core'
import { assignmentStatusEnum } from './enums'
import { campaigns } from './campaigns'
import { staffMembers } from './staff-members'
import { users } from './users'

export const campaignAssignments = pgTable(
  'campaign_assignments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    campaignId: uuid('campaign_id')
      .references(() => campaigns.id)
      .notNull(),
    staffId: uuid('staff_id')
      .references(() => staffMembers.id)
      .notNull(),
    roleInCampaign: varchar('role_in_campaign', { length: 50 }),
    status: assignmentStatusEnum('status').notNull().default('asignado'),
    actualHours: numeric('actual_hours', { precision: 5, scale: 2 }),
    overtimeHours: numeric('overtime_hours', { precision: 5, scale: 2 }),
    hasOvernight: boolean('has_overnight').notNull().default(false),
    assignedById: uuid('assigned_by_id')
      .references(() => users.id)
      .notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [unique().on(table.campaignId, table.staffId)],
)
