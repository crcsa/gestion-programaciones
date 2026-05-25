import { describe, it, expect } from 'vitest'
import {
  normalize,
  mapSize,
  mapModality,
  parseCrmDate,
  parseCrmTime,
  splitDateTime,
  detectHeaderRow,
  mapCrmRow,
} from '@/features/campaigns/lib/crm-excel-parser'

describe('crm-excel-parser', () => {
  describe('normalize', () => {
    it('trims, lowercases and collapses whitespace', () => {
      expect(normalize('  Corporativa   -  Móvil ')).toBe('corporativa - móvil')
      expect(normalize(null)).toBe('')
    })
  })

  describe('mapSize', () => {
    it('maps known sizes and falls back to S', () => {
      expect(mapSize('S')).toBe('S')
      expect(mapSize('m')).toBe('M')
      expect(mapSize('S+')).toBe('S_plus')
      expect(mapSize('splus')).toBe('S_plus')
      expect(mapSize('???')).toBe('S')
    })
  })

  describe('mapModality', () => {
    it('maps CRM modality strings to enum values', () => {
      expect(mapModality('Corporativa - Móvil')).toBe('unidad_movil')
      expect(mapModality('Corporativa - Carpa')).toBe('carpa')
      expect(mapModality('Corporativa')).toBe('corporativa')
      expect(mapModality('Municipal')).toBe('municipal')
      expect(mapModality('Centro comercial')).toBe('corporativa')
    })

    it('uses substring fallback for unlisted combos', () => {
      expect(mapModality('Corporativa - Carpa grande')).toBe('carpa')
      expect(mapModality('Empresarial - Unidad Móvil')).toBe('unidad_movil')
      expect(mapModality('algo raro')).toBe('corporativa')
    })
  })

  describe('parseCrmDate', () => {
    it('parses DD/MM/YYYY with a time suffix', () => {
      expect(parseCrmDate('25/05/2026 08:00 AM')).toBe('2026-05-25')
    })
    it('parses ISO and bare DD/MM/YYYY', () => {
      expect(parseCrmDate('2026-05-25')).toBe('2026-05-25')
      expect(parseCrmDate('5/5/2026')).toBe('2026-05-05')
    })
    it('parses Excel serial numbers', () => {
      // 2026-05-25 serial
      const serial = 46167
      const out = parseCrmDate(serial)
      expect(out).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    })
  })

  describe('parseCrmTime', () => {
    it('converts AM/PM to 24h', () => {
      expect(parseCrmTime('25/05/2026 08:00 AM')).toBe('08:00')
      expect(parseCrmTime('25/05/2026 03:00 PM')).toBe('15:00')
      expect(parseCrmTime('12:00 PM')).toBe('12:00')
      expect(parseCrmTime('12:30 AM')).toBe('00:30')
    })
    it('returns undefined when there is no time', () => {
      expect(parseCrmTime('25/05/2026')).toBeUndefined()
      expect(parseCrmTime('')).toBeUndefined()
    })
    it('extracts time from an Excel datetime serial and ignores date-only serials', () => {
      // 46167.333333 ≈ 2026-05-25 08:00
      expect(parseCrmTime(46167 + 8 / 24)).toBe('08:00')
      // integer serial = date only → no time
      expect(parseCrmTime(46167)).toBeUndefined()
    })
  })

  describe('splitDateTime', () => {
    it('returns both date and time', () => {
      expect(splitDateTime('25/05/2026 03:30 PM')).toEqual({ date: '2026-05-25', time: '15:30' })
    })
  })

  describe('detectHeaderRow', () => {
    it('skips the CRM preamble and finds the real header', () => {
      const matrix = [
        ['  PLATAFORMA'],
        ['Generado por 22/05/2026 03:34 PM …'],
        [],
        ['Cantidad de registros : 21'],
        [],
        ['Codigo de actividad', 'Estado Campaña', 'Empresa', 'Municipio'],
        ['C11635', 'Confirmación', 'ACME', 'Medellin'],
      ]
      expect(detectHeaderRow(matrix)).toBe(5)
    })
    it('returns 0 for a generic sheet with header on row 1', () => {
      const matrix = [
        ['Código', 'Empresa', 'Municipio', 'Fecha'],
        ['C1', 'ACME', 'Medellin', '25/05/2026'],
      ]
      expect(detectHeaderRow(matrix)).toBe(0)
    })
  })

  describe('mapCrmRow', () => {
    const crmRow = {
      'Codigo de actividad': 'C11635',
      'Estado Campaña': 'Confirmación',
      Empresa: 'Fundacion Jardin Botanico',
      Dirección: 'Calle 73 # 51d - 14',
      Municipio: 'Medellin',
      Mix: 'S',
      'Modalidad de campaña': 'Corporativa - Móvil',
      'Ubicación de la campaña': 'Orquideorama',
      'Contacto de la campaña': 'Stiven Álvarez Álvarez',
      Celular: '301 1866134',
      'Fecha/hora de inicio campaña': '25/05/2026 08:00 AM',
      'Fecha y hora de final campaña': '25/05/2026 03:00 PM',
      'Hora de recogida': '25/05/2026 03:30 PM',
      'Hora de salida Sede': '25/05/2026 07:00 AM',
      'Observaciones alistamiento': 'Equilibrar extra',
      'Observaciones Banco de Sangre': 'CAMPAÑA 3',
    }

    it('maps all CRM columns to ImportExcelRow fields', () => {
      const row = mapCrmRow(crmRow)
      expect(row.code).toBe('C11635')
      expect(row.companyName).toBe('Fundacion Jardin Botanico')
      expect(row.municipality).toBe('Medellin')
      expect(row.size).toBe('S')
      expect(row.modality).toBe('unidad_movil')
      expect(row.campaignDate).toBe('2026-05-25')
      expect(row.startTime).toBe('08:00')
      expect(row.endTime).toBe('15:00')
      expect(row.endDate).toBeUndefined() // same day → no endDate
      expect(row.contactName).toBe('Stiven Álvarez Álvarez')
      expect(row.contactPhone).toBe('301 1866134')
      expect(row.address).toBe('Calle 73 # 51d - 14')
      expect(row.locationName).toBe('Orquideorama')
    })

    it('combines observation columns and logistic times', () => {
      const row = mapCrmRow(crmRow)
      expect(row.observations).toContain('Alistamiento: Equilibrar extra')
      expect(row.observations).toContain('Banco de Sangre: CAMPAÑA 3')
      expect(row.observations).toContain('Recogida: 15:30')
      expect(row.observations).toContain('Salida sede: 07:00')
    })

    it('sets endDate only for multi-day campaigns', () => {
      const multi = {
        ...crmRow,
        'Fecha y hora de final campaña': '27/05/2026 03:00 PM',
      }
      expect(mapCrmRow(multi).endDate).toBe('2026-05-27')
    })

    it('still maps a legacy generic row', () => {
      const legacy = {
        Código: 'C9',
        Empresa: 'ACME',
        Municipio: 'Bello',
        Fecha: '2026-06-01',
        Mix: 'M',
        Modalidad: 'carpa',
        Observaciones: 'nota libre',
      }
      const row = mapCrmRow(legacy)
      expect(row.code).toBe('C9')
      expect(row.size).toBe('M')
      expect(row.modality).toBe('carpa')
      expect(row.campaignDate).toBe('2026-06-01')
      expect(row.observations).toBe('nota libre')
      expect(row.startTime).toBeUndefined()
    })
  })
})
