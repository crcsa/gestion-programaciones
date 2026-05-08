'use server'

import { requireRole } from '@/features/auth/lib/require-role'
import {
  getMonthlyCapacity as queryMonthlyCapacity,
  type CapacityProfile,
  type DayCapacity,
} from '../lib/capacity-query'

export type { CapacityProfile, DayCapacity }

export interface MonthlyCapacityInput {
  year: number
  month: number
  profile?: CapacityProfile
}

export async function getMonthlyCapacity(
  params: MonthlyCapacityInput,
): Promise<DayCapacity[]> {
  await requireRole(['admin', 'banco_sangre', 'comercial'])

  try {
    return await queryMonthlyCapacity(params)
  } catch (error) {
    if (error instanceof Error && error.message.includes('permiso')) throw error
    if (error instanceof Error && error.message === 'Mes inválido') throw error
    throw new Error('Error al calcular la capacidad mensual')
  }
}
