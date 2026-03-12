import { pgTable, uuid, date, varchar, integer } from 'drizzle-orm/pg-core'

export const colombianHolidays = pgTable('colombian_holidays', {
  id: uuid('id').primaryKey().defaultRandom(),
  date: date('date').notNull().unique(),
  name: varchar('name', { length: 100 }).notNull(),
  year: integer('year').notNull(),
})
