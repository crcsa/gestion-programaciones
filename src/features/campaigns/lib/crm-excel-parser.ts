import * as XLSX from 'xlsx'
import type { ImportExcelRow } from '../schemas/campaign-schemas'

// ---------------------------------------------------------------------------
// Parser del Excel exportado por el CRM institucional (Donación Sangre
// Empresarial). El export trae filas de preámbulo antes de la cabecera real y
// columnas ricas (fecha+hora combinadas, contacto, ubicación, varias notas).
// Estas funciones son puras y testeables; las consume el diálogo de import.
// ---------------------------------------------------------------------------

type Size = ImportExcelRow['size']
type Modality = ImportExcelRow['modality']

export function normalize(v: unknown): string {
  return String(v ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
}

// ---- Mapas de valores -----------------------------------------------------

export const SIZE_MAP: Record<string, Size> = {
  s: 'S',
  's+': 'S_plus',
  splus: 'S_plus',
  's plus': 'S_plus',
  m: 'M',
  l: 'L',
}

export const MODALITY_MAP: Record<string, Modality> = {
  corporativa: 'corporativa',
  presencial: 'corporativa',
  'corporativa - movil': 'unidad_movil',
  'corporativa - móvil': 'unidad_movil',
  'corporativa - carpa': 'carpa',
  carpa: 'carpa',
  'unidad movil': 'unidad_movil',
  'unidad móvil': 'unidad_movil',
  movil: 'unidad_movil',
  móvil: 'unidad_movil',
  unidad_movil: 'unidad_movil',
  municipal: 'municipal',
  institucional: 'municipal',
  'centro comercial': 'corporativa',
  combinada: 'combinada',
  mixta: 'combinada',
  virtual: 'combinada',
}

export function mapSize(raw: unknown): Size {
  return SIZE_MAP[normalize(raw)] ?? 'S'
}

export function mapModality(raw: unknown): Modality {
  const n = normalize(raw)
  if (MODALITY_MAP[n]) return MODALITY_MAP[n]
  // Fallback robusto ante combinaciones no listadas ("Corporativa - X").
  if (n.includes('carpa')) return 'carpa'
  if (n.includes('móvil') || n.includes('movil') || n.includes('unidad')) return 'unidad_movil'
  if (n.includes('municipal')) return 'municipal'
  if (n.includes('combinada') || n.includes('mixta')) return 'combinada'
  return 'corporativa'
}

// ---- Fechas y horas -------------------------------------------------------

/** Extrae la parte de fecha (YYYY-MM-DD) de un serial Excel, DD/MM/YYYY o ISO,
 *  tolerando un sufijo de hora ("25/05/2026 08:00 AM"). */
export function parseCrmDate(v: unknown): string {
  if (typeof v === 'number') {
    const date = XLSX.SSF.parse_date_code(v)
    if (date) {
      const y = date.y
      const m = String(date.m).padStart(2, '0')
      const d = String(date.d).padStart(2, '0')
      return `${y}-${m}-${d}`
    }
  }
  const s = String(v ?? '').trim()
  const datePart = s.split(/\s+/)[0] ?? ''
  const ddmm = datePart.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (ddmm) return `${ddmm[3]}-${ddmm[2].padStart(2, '0')}-${ddmm[1].padStart(2, '0')}`
  if (/^\d{4}-\d{2}-\d{2}$/.test(datePart)) return datePart
  return datePart
}

/** Extrae "HH:MM" en 24h de un string que contenga "hh:mm AM/PM" (o 24h).
 *  Devuelve undefined si no hay hora reconocible. */
export function parseCrmTime(v: unknown): string | undefined {
  if (typeof v === 'number') {
    // Serial Excel: la parte fraccionaria codifica la hora.
    const date = XLSX.SSF.parse_date_code(v)
    if (!date || (date.H === 0 && date.M === 0 && Number(v) % 1 === 0)) return undefined
    return `${String(date.H).padStart(2, '0')}:${String(date.M).padStart(2, '0')}`
  }
  const s = String(v ?? '').trim()
  const m = s.match(/(\d{1,2}):(\d{2})\s*([AaPp][Mm])?/)
  if (!m) return undefined
  let h = parseInt(m[1], 10)
  const min = m[2]
  const ap = m[3]?.toUpperCase()
  if (ap === 'AM') {
    if (h === 12) h = 0
  } else if (ap === 'PM') {
    if (h !== 12) h += 12
  }
  if (h > 23 || Number(min) > 59) return undefined
  return `${String(h).padStart(2, '0')}:${min}`
}

export function splitDateTime(v: unknown): { date: string; time: string | undefined } {
  return { date: parseCrmDate(v), time: parseCrmTime(v) }
}

// ---- Detección de cabecera ------------------------------------------------

/** Localiza la fila de cabecera dentro de un array-of-arrays. El export del CRM
 *  tiene 6 filas de preámbulo; un Excel genérico la tiene en la fila 0. */
export function detectHeaderRow(rows: unknown[][]): number {
  const limit = Math.min(rows.length, 25)
  for (let i = 0; i < limit; i++) {
    const cells = (rows[i] ?? []).map(normalize)
    if (cells.includes('codigo de actividad') || cells.includes('código de actividad')) return i
    if (cells.includes('empresa') && cells.includes('municipio')) return i
    if (
      (cells.includes('código') || cells.includes('codigo') || cells.includes('code')) &&
      cells.includes('empresa')
    ) {
      return i
    }
  }
  return 0
}

// ---- Mapeo de fila --------------------------------------------------------

/** Mapea una fila cruda (cabecera CRM o genérica) a ImportExcelRow. */
export function mapCrmRow(raw: Record<string, unknown>): ImportExcelRow {
  const key = (candidates: string[]): unknown => {
    for (const c of candidates) {
      for (const k of Object.keys(raw)) {
        if (normalize(k) === c) return raw[k]
      }
    }
    return undefined
  }

  const startRaw = key([
    'fecha/hora de inicio campaña',
    'fecha/hora de inicio campana',
    'fecha',
    'date',
    'campaigndate',
    'campaign date',
  ])
  const endRaw = key([
    'fecha y hora de final campaña',
    'fecha y hora de final campana',
    'fecha fin',
    'enddate',
    'end date',
  ])

  const campaignDate = parseCrmDate(startRaw)
  const startTime = parseCrmTime(startRaw)
  const endTime = parseCrmTime(endRaw)
  const endRawStr = String(endRaw ?? '').trim()
  const endDateParsed = endRawStr ? parseCrmDate(endRaw) : ''
  const endDate = endDateParsed && endDateParsed !== campaignDate ? endDateParsed : undefined

  // Observaciones: combinar las 4 columnas del CRM + horas logísticas.
  const obsParts: string[] = []
  const pushLabeled = (label: string, val: unknown) => {
    const s = String(val ?? '').trim()
    if (s) obsParts.push(`${label}: ${s}`)
  }
  pushLabeled('Alistamiento', key(['observaciones alistamiento']))
  pushLabeled('Banco de Sangre', key(['observaciones banco de sangre']))
  pushLabeled('Campaña realizada', key(['observaciones campaña realizada', 'observaciones campana realizada']))
  pushLabeled('Previas promotor', key(['observaciones previas promotor']))

  const generic = String(key(['observaciones', 'observations', 'notas', 'notes']) ?? '').trim()
  if (generic) obsParts.push(generic)

  const pickup = parseCrmTime(key(['hora de recogida']))
  const sede = parseCrmTime(key(['hora de salida sede']))
  if (pickup) obsParts.push(`Recogida: ${pickup}`)
  if (sede) obsParts.push(`Salida sede: ${sede}`)

  const contactName = String(key(['contacto de la campaña', 'contacto de la campana', 'contacto']) ?? '').trim()
  const contactPhone = String(key(['celular', 'teléfono', 'telefono', 'phone']) ?? '').trim()
  const address = String(key(['dirección', 'direccion', 'address']) ?? '').trim()
  const locationName = String(
    key(['ubicación de la campaña', 'ubicacion de la campana', 'ubicación', 'ubicacion']) ?? '',
  ).trim()

  return {
    code: String(key(['codigo de actividad', 'código', 'codigo', 'code', 'id']) ?? '').trim(),
    companyName: String(
      key(['empresa', 'nombre empresa', 'nombre de la empresa', 'company', 'companyname']) ?? '',
    ).trim(),
    municipality: String(key(['municipio', 'municipality', 'ciudad']) ?? '').trim(),
    campaignDate,
    size: mapSize(key(['mix', 'tamaño', 'tamano', 'size'])),
    modality: mapModality(key(['modalidad de campaña', 'modalidad de campana', 'modalidad', 'modality', 'tipo'])),
    expectedDonations: Number(key(['donaciones', 'meta', 'expecteddonations', 'expected donations'])) || undefined,
    observations: obsParts.length ? obsParts.join('\n') : undefined,
    startTime,
    endTime,
    endDate,
    contactName: contactName || undefined,
    contactPhone: contactPhone || undefined,
    address: address || undefined,
    locationName: locationName || undefined,
  }
}

/** Parsea un workbook completo: detecta la cabecera, salta el preámbulo y mapea. */
export function parseCrmWorkbook(workbook: XLSX.WorkBook): ImportExcelRow[] {
  const sheet = workbook.Sheets[workbook.SheetNames[0]]
  if (!sheet) return []
  // blankrows:true (default) preserva los índices de fila reales de la hoja, de
  // modo que el índice detectado coincide con `range` en la segunda lectura.
  const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, blankrows: true })
  const headerRow = detectHeaderRow(matrix)
  const records = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { range: headerRow })
  return records.map(mapCrmRow).filter((r) => r.code || r.companyName)
}
