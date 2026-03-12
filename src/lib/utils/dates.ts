import {
  format,
  startOfWeek,
  endOfWeek,
  getISOWeek,
  isSunday as dfnIsSunday,
} from 'date-fns'
import { es } from 'date-fns/locale'

export const COLOMBIA_TIMEZONE = 'America/Bogota'

export function formatDate(date: Date | string): string {
  return format(new Date(date), 'dd/MM/yyyy', { locale: es })
}

export function formatTime(date: Date | string): string {
  return format(new Date(date), 'HH:mm')
}

export function formatDateTime(date: Date | string): string {
  return format(new Date(date), 'dd/MM/yyyy HH:mm', { locale: es })
}

export function getWeekRange(date: Date): { start: Date; end: Date } {
  return {
    start: startOfWeek(date, { weekStartsOn: 1 }),
    end: endOfWeek(date, { weekStartsOn: 1 }),
  }
}

export function isSunday(date: Date): boolean {
  return dfnIsSunday(date)
}

export function getWeekNumber(date: Date): number {
  return getISOWeek(date)
}
