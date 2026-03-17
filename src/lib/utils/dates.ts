import {
  startOfWeek,
  endOfWeek,
  addWeeks,
  subWeeks,
  format,
  eachDayOfInterval,
  isWeekend,
  isSunday,
  parseISO,
  isValid,
} from 'date-fns'
import { es } from 'date-fns/locale'

export function getWeekBounds(date: Date): { start: Date; end: Date } {
  return {
    start: startOfWeek(date, { weekStartsOn: 1 }),
    end: endOfWeek(date, { weekStartsOn: 1 }),
  }
}

export function getWeekDays(weekStart: Date): Date[] {
  const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 })
  return eachDayOfInterval({ start: weekStart, end: weekEnd })
}

export function nextWeek(date: Date): Date {
  return addWeeks(date, 1)
}

export function prevWeek(date: Date): Date {
  return subWeeks(date, 1)
}

export function formatWeekLabel(weekStart: Date): string {
  const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 })
  return `${format(weekStart, 'd MMM', { locale: es })} – ${format(weekEnd, 'd MMM yyyy', { locale: es })}`
}

export function isWeekendDay(date: Date): boolean {
  return isWeekend(date)
}

export function isSundayDate(date: Date): boolean {
  return isSunday(date)
}

export function safeParse(dateString: string): Date | null {
  const parsed = parseISO(dateString)
  return isValid(parsed) ? parsed : null
}

export function toDateString(date: Date): string {
  return format(date, 'yyyy-MM-dd')
}
