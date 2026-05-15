import { pgTable, uuid, text, timestamp } from 'drizzle-orm/pg-core'
import { timelineEventTypeEnum } from './enums'
import { campaigns } from './campaigns'
import { profiles } from './profiles'

export const campaignTimeline = pgTable('campaign_timeline', {
  id: uuid('id').primaryKey().defaultRandom(),
  campaignId: uuid('campaign_id').notNull().references(() => campaigns.id, { onDelete: 'cascade' }),
  eventType: timelineEventTypeEnum('event_type').notNull(),
  // Hora programada/planificada (admin/banco_sangre).
  scheduledTime: timestamp('scheduled_time', { withTimezone: true }),
  // Hora real de ejecución (coordinador o admin durante la jornada).
  eventTime: timestamp('event_time', { withTimezone: true }),
  notes: text('notes'),
  registeredById: uuid('registered_by_id').references(() => profiles.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export type CampaignTimelineEvent = typeof campaignTimeline.$inferSelect
export type NewCampaignTimelineEvent = typeof campaignTimeline.$inferInsert
