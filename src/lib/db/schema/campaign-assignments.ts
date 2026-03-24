import { pgTable, uuid, boolean, timestamp, unique } from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'
import { campaigns } from './campaigns'
import { staffMembers } from './staff-members'

export const campaignAssignments = pgTable('campaign_assignments', {
  id: uuid('id').primaryKey().defaultRandom(),
  campaignId: uuid('campaign_id').notNull().references(() => campaigns.id, { onDelete: 'cascade' }),
  staffId: uuid('staff_id').notNull().references(() => staffMembers.id, { onDelete: 'cascade' }),
  isCoordinator: boolean('is_coordinator').notNull().default(false),
  assignedAt: timestamp('assigned_at', { withTimezone: true }).notNull().defaultNow(),
  removedAt: timestamp('removed_at', { withTimezone: true }),
  isActive: boolean('is_active').notNull().default(true),
}, (t) => [
  unique('campaign_assignments_campaign_staff_unique').on(t.campaignId, t.staffId),
])

export const campaignAssignmentsRelations = relations(campaignAssignments, ({ one }) => ({
  campaign: one(campaigns, { fields: [campaignAssignments.campaignId], references: [campaigns.id] }),
  staff: one(staffMembers, { fields: [campaignAssignments.staffId], references: [staffMembers.id] }),
}))

export type CampaignAssignment = typeof campaignAssignments.$inferSelect
export type NewCampaignAssignment = typeof campaignAssignments.$inferInsert
