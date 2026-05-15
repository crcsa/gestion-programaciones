import { pgTable, uuid, text, timestamp, index } from 'drizzle-orm/pg-core'

export const systemConfigHistory = pgTable(
  'system_config_history',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    key: text('key').notNull(),
    value: text('value').notNull(),
    effectiveFrom: timestamp('effective_from', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('system_config_history_key_from_idx').on(t.key, t.effectiveFrom)],
)

export type SystemConfigHistory = typeof systemConfigHistory.$inferSelect
export type NewSystemConfigHistory = typeof systemConfigHistory.$inferInsert
