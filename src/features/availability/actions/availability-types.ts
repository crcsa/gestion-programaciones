export type AvailabilityCellStatus =
  | 'libre'
  | 'en_sede'
  | 'servicios_transfusionales'
  | 'en_campana'
  | 'vacaciones'
  | 'incapacidad'
  | 'licencia'

export interface AvailabilityCellData {
  status: AvailabilityCellStatus
  referenceCode?: string
}

export interface AvailabilityGridRow {
  staffId: string
  firstName: string
  lastName: string
  staffProfile: string
  days: Record<string, AvailabilityCellData>
}
