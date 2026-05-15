'use server'

import { requireAccess } from '@/features/auth/lib/require-access'
import { AppError } from '@/lib/errors/app-errors'
import {
  getMonthlyCapacity as queryMonthlyCapacity,
  type CapacityProfile,
  type DayCapacity,
} from '../lib/capacity-query'
import type { Area } from '@/types/areas'

export interface MonthlyCapacityInput {
  year: number
  month: number
  profile?: CapacityProfile
  area?: Area | null
}

export async function getMonthlyCapacity(
  params: MonthlyCapacityInput,
): Promise<DayCapacity[]> {
  const { scope } = await requireAccess({
    roles: ['admin', 'admin_area', 'comercial'],
    allowCrossArea: true,
  })
  // Admin global y comercial (cross-área) reciben scope global y respetan
  // el filtro recibido; banco_sangre queda anclado a su scope.area.
  const areaScope: Area | null =
    scope.kind === 'global' ? params.area ?? null : scope.area

  try {
    return await queryMonthlyCapacity({ ...params, area: areaScope })
  } catch (error) {
    if (error instanceof AppError) throw error
    if (error instanceof Error && error.message === 'Mes inválido') throw error
    throw new Error('Error al calcular la capacidad mensual')
  }
}
