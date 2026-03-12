import { describe, it, expect } from 'vitest'
import {
  formatDate,
  formatTime,
  isSunday,
  getWeekRange,
  getWeekNumber,
} from '@/lib/utils/dates'

describe('formatDate', () => {
  it('formats date as dd/MM/yyyy', () => {
    expect(formatDate(new Date(2026, 2, 12))).toBe('12/03/2026')
  })
})

describe('formatTime', () => {
  it('formats time as HH:mm', () => {
    const date = new Date(2026, 2, 12, 14, 30)
    expect(formatTime(date)).toBe('14:30')
  })
})

describe('isSunday', () => {
  it('returns true for Sunday', () => {
    expect(isSunday(new Date(2026, 2, 15))).toBe(true)
  })

  it('returns false for Monday', () => {
    expect(isSunday(new Date(2026, 2, 16))).toBe(false)
  })
})

describe('getWeekRange', () => {
  it('returns Monday to Sunday range', () => {
    const { start, end } = getWeekRange(new Date(2026, 2, 12))
    expect(start.getDay()).toBe(1)
    expect(end.getDay()).toBe(0)
  })
})

describe('getWeekNumber', () => {
  it('returns ISO week number', () => {
    const week = getWeekNumber(new Date(2026, 0, 5))
    expect(week).toBe(2)
  })
})
