import { z } from 'zod'

export const assignVehicleSchema = z.object({
  campaignId: z.string().uuid('ID de campaña no válido'),
  vehicleId: z.string().uuid('ID de vehículo no válido'),
  driverStaffId: z.string().uuid('ID de conductor no válido').optional(),
})

export const setDriverSchema = z.object({
  campaignVehicleId: z.string().uuid('ID de asignación no válido'),
  driverStaffId: z.string().uuid('ID de conductor no válido'),
})

export type AssignVehicleInput = z.infer<typeof assignVehicleSchema>
export type SetDriverInput = z.infer<typeof setDriverSchema>
