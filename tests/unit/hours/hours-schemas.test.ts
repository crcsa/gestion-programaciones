import { describe, it, expect } from 'vitest'
import { weekStartSchema, registerTimelineEventSchema } from '@/features/hours/schemas/hours-schemas'

describe('weekStartSchema', () => {
  it('accepts a valid Monday date', () => {
    // 2026-03-16 is a Monday
    const result = weekStartSchema.safeParse('2026-03-16')
    expect(result.success).toBe(true)
  })

  it('rejects a non-Monday date', () => {
    // 2026-03-17 is Tuesday
    const result = weekStartSchema.safeParse('2026-03-17')
    expect(result.success).toBe(false)
    expect(result.error?.issues[0].message).toContain('lunes')
  })

  it('rejects wrong format', () => {
    expect(weekStartSchema.safeParse('16/03/2026').success).toBe(false)
    expect(weekStartSchema.safeParse('2026/03/16').success).toBe(false)
  })

  it('rejects empty string', () => {
    expect(weekStartSchema.safeParse('').success).toBe(false)
  })

  it('accepts another valid Monday', () => {
    // 2026-03-23 is also a Monday
    expect(weekStartSchema.safeParse('2026-03-23').success).toBe(true)
  })
})

describe('registerTimelineEventSchema', () => {
  const validCampaignId = '550e8400-e29b-41d4-a716-446655440000'

  it('accepts valid event registration', () => {
    const result = registerTimelineEventSchema.safeParse({
      campaignId: validCampaignId,
      eventType: 'salida_sede',
      eventTime: '2026-03-18T08:00:00.000Z',
    })
    expect(result.success).toBe(true)
  })

  it('accepts all 9 valid event types', () => {
    const types = [
      'salida_sede', 'llegada_punto', 'inicio_donaciones',
      'salida_almuerzo', 'regreso_almuerzo', 'fin_donaciones',
      'recogida', 'llegada_sede', 'fin',
    ]
    for (const eventType of types) {
      const result = registerTimelineEventSchema.safeParse({
        campaignId: validCampaignId,
        eventType,
        eventTime: '2026-03-18T08:00:00.000Z',
      })
      expect(result.success).toBe(true)
    }
  })

  it('rejects invalid event type', () => {
    const result = registerTimelineEventSchema.safeParse({
      campaignId: validCampaignId,
      eventType: 'inicio',  // old value, no longer valid
      eventTime: '2026-03-18T08:00:00.000Z',
    })
    expect(result.success).toBe(false)
  })

  it('rejects invalid campaignId (not UUID)', () => {
    const result = registerTimelineEventSchema.safeParse({
      campaignId: 'not-a-uuid',
      eventType: 'salida_sede',
      eventTime: '2026-03-18T08:00:00.000Z',
    })
    expect(result.success).toBe(false)
    expect(result.error?.issues[0].message).toContain('campaña')
  })

  it('rejects invalid datetime format', () => {
    const result = registerTimelineEventSchema.safeParse({
      campaignId: validCampaignId,
      eventType: 'salida_sede',
      eventTime: '08:00',  // not an ISO datetime
    })
    expect(result.success).toBe(false)
  })

  it('accepts optional notes within 500 chars', () => {
    const result = registerTimelineEventSchema.safeParse({
      campaignId: validCampaignId,
      eventType: 'fin',
      eventTime: '2026-03-18T18:00:00.000Z',
      notes: 'Todo salió bien',
    })
    expect(result.success).toBe(true)
  })

  it('rejects notes longer than 500 chars', () => {
    const result = registerTimelineEventSchema.safeParse({
      campaignId: validCampaignId,
      eventType: 'fin',
      eventTime: '2026-03-18T18:00:00.000Z',
      notes: 'x'.repeat(501),
    })
    expect(result.success).toBe(false)
  })
})
