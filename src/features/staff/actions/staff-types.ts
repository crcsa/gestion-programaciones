import type { StaffMember } from '@/lib/db/schema/staff-members'
import type { Area } from '@/types/areas'

export interface StaffListFilters {
  search?: string
  perfil?: 'bacteriologo' | 'tecnico' | 'medico' | 'auxiliar' | 'comercial' | 'conductor'
  estado?: 'activo' | 'inactivo'
  /**
   * Área a filtrar. Para admins de área (banco_sangre con area=X) se fuerza
   * forzosamente a su área, ignorando lo recibido. Solo admin global puede
   * usar un valor explícito o null.
   */
  area?: Area | null
  page?: number
  limit?: number
}

export type StaffListRow = StaffMember & {
  trainingAreaNames: string[]
  trainingAreaIds: string[]
}

export interface StaffListResult {
  data: StaffListRow[]
  total: number
}
