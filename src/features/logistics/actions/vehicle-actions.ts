'use server'

import { and, eq, ilike, or, sql } from 'drizzle-orm'
import { ConflictError, NotFoundError, ValidationError } from '@/lib/errors/app-errors'
import { rethrowOrLog } from '@/lib/errors/rethrow'
import { revalidatePath } from 'next/cache'
import { db } from '@/lib/db'
import { vehicles } from '@/lib/db/schema/vehicles'
import { requireAccess } from '@/features/auth/lib/require-access'
import { logAudit } from '@/lib/audit/log-audit'
import {
  createVehicleSchema,
  updateVehicleSchema,
} from '../schemas/vehicle-schemas'
import type {
  CreateVehicleInput,
  UpdateVehicleInput,
} from '../schemas/vehicle-schemas'
import type { Vehicle } from '@/lib/db/schema/vehicles'
import type { Role } from '@/types/roles'
import type { Area } from '@/types/areas'

export interface VehicleListFilters {
  search?: string
  estado?: 'activo' | 'inactivo'
  page?: number
  limit?: number
}

export interface VehicleListResult {
  data: Vehicle[]
  total: number
}

/**
 * Acceso a vehículos: admin global o admins de área operativa logística.
 */
const VEHICLE_ACCESS: { roles: Role[]; areas: Area[] } = {
  roles: ['admin', 'admin_area'],
  areas: ['logistica'],
}

export async function getVehicleList(
  filters: VehicleListFilters = {},
): Promise<VehicleListResult> {
  await requireAccess(VEHICLE_ACCESS)

  const { search, estado, page = 1, limit = 20 } = filters
  const offset = (page - 1) * limit
  const where = []
  if (search) {
    where.push(
      or(
        ilike(vehicles.plate, `%${search}%`),
        ilike(vehicles.model, `%${search}%`),
      ),
    )
  }
  if (estado === 'activo') where.push(eq(vehicles.isActive, true))
  if (estado === 'inactivo') where.push(eq(vehicles.isActive, false))

  const conditions = where.length === 0 ? undefined : and(...where)

  const [rows, countRows] = await Promise.all([
    db
      .select()
      .from(vehicles)
      .where(conditions)
      .limit(limit)
      .offset(offset)
      .orderBy(vehicles.plate),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(vehicles)
      .where(conditions),
  ])

  return { data: rows, total: countRows[0]?.count ?? 0 }
}

export async function getVehicleById(id: string): Promise<Vehicle> {
  await requireAccess(VEHICLE_ACCESS)
  const [v] = await db.select().from(vehicles).where(eq(vehicles.id, id)).limit(1)
  if (!v) throw new NotFoundError('Vehículo no encontrado')
  return v
}

export async function createVehicle(input: CreateVehicleInput): Promise<Vehicle> {
  const ctx = await requireAccess(VEHICLE_ACCESS)
  const validated = createVehicleSchema.safeParse(input)
  if (!validated.success) throw new ValidationError(validated.error.issues[0].message)
  const data = validated.data

  try {
    const existing = await db
      .select({ id: vehicles.id })
      .from(vehicles)
      .where(eq(vehicles.plate, data.plate.toUpperCase()))
      .limit(1)
    if (existing.length > 0) {
      throw new ConflictError('Ya existe un vehículo con esa placa.')
    }

    const [created] = await db
      .insert(vehicles)
      .values({
        plate: data.plate.toUpperCase(),
        mobileNumber: data.mobileNumber ?? null,
        model: data.model ?? null,
        year: data.year ?? null,
        capacity: data.capacity ?? null,
        notes: data.notes ?? null,
      })
      .returning()

    await logAudit({
      profileId: ctx.userId,
      action: 'create',
      tableName: 'vehicles',
      recordId: created.id,
      newData: {
        plate: created.plate,
        mobileNumber: created.mobileNumber,
        model: created.model,
      },
    })

    revalidatePath('/vehiculos')
    return created
  } catch (error) {
    rethrowOrLog(error, 'createVehicle', 'Error al crear el vehículo')
  }
}

export async function updateVehicle(
  id: string,
  input: Omit<UpdateVehicleInput, 'id'>,
): Promise<Vehicle> {
  const ctx = await requireAccess(VEHICLE_ACCESS)
  const validated = updateVehicleSchema.safeParse({ id, ...input })
  if (!validated.success) throw new ValidationError(validated.error.issues[0].message)
  const { id: _, ...rawFields } = validated.data
  const fields = rawFields.plate
    ? { ...rawFields, plate: rawFields.plate.toUpperCase() }
    : rawFields

  try {
    if (fields.plate) {
      const existing = await db
        .select({ id: vehicles.id })
        .from(vehicles)
        .where(
          and(eq(vehicles.plate, fields.plate), sql`${vehicles.id} != ${id}`),
        )
        .limit(1)
      if (existing.length > 0) {
        throw new ConflictError('Ya existe otro vehículo con esa placa.')
      }
    }

    const [updated] = await db
      .update(vehicles)
      .set({ ...fields, updatedAt: new Date() })
      .where(eq(vehicles.id, id))
      .returning()
    if (!updated) throw new NotFoundError('Vehículo no encontrado')

    await logAudit({
      profileId: ctx.userId,
      action: 'update',
      tableName: 'vehicles',
      recordId: updated.id,
    })

    revalidatePath('/vehiculos')
    return updated
  } catch (error) {
    rethrowOrLog(error, 'updateVehicle', 'Error al actualizar el vehículo')
  }
}

export async function toggleVehicleStatus(id: string): Promise<Vehicle> {
  const ctx = await requireAccess(VEHICLE_ACCESS)

  try {
    const [current] = await db
      .select({ id: vehicles.id, isActive: vehicles.isActive })
      .from(vehicles)
      .where(eq(vehicles.id, id))
      .limit(1)
    if (!current) throw new NotFoundError('Vehículo no encontrado')

    const [updated] = await db
      .update(vehicles)
      .set({ isActive: !current.isActive, updatedAt: new Date() })
      .where(eq(vehicles.id, id))
      .returning()

    await logAudit({
      profileId: ctx.userId,
      action: 'update',
      tableName: 'vehicles',
      recordId: updated.id,
    })

    revalidatePath('/vehiculos')
    return updated
  } catch (error) {
    rethrowOrLog(error, 'toggleVehicleStatus', 'Error al cambiar el estado del vehículo')
  }
}

export async function deleteVehicle(id: string): Promise<void> {
  const ctx = await requireAccess({ roles: ['admin'] })

  try {
    const [v] = await db.select({ id: vehicles.id }).from(vehicles).where(eq(vehicles.id, id)).limit(1)
    if (!v) throw new NotFoundError('Vehículo no encontrado')
    await db.delete(vehicles).where(eq(vehicles.id, id))
    await logAudit({
      profileId: ctx.userId,
      action: 'delete',
      tableName: 'vehicles',
      recordId: id,
    })
    revalidatePath('/vehiculos')
  } catch (error) {
    rethrowOrLog(error, 'deleteVehicle', 'Error al eliminar el vehículo')
  }
}
