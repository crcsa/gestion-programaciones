import { pgTable, uuid, date, text, boolean } from 'drizzle-orm/pg-core'

export const colombianHolidays = pgTable('colombian_holidays', {
  id: uuid('id').primaryKey().defaultRandom(),
  holidayDate: date('holiday_date').notNull().unique(),
  name: text('name').notNull(),
  isNational: boolean('is_national').notNull().default(true),
  description: text('description'),
})

export type ColombianHoliday = typeof colombianHolidays.$inferSelect
export type NewColombianHoliday = typeof colombianHolidays.$inferInsert
