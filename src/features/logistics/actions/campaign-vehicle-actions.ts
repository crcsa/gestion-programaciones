'use server'

import { and, eq, gte, inArray, lte, ne, notInArray } from 'drizzle-orm'
import { NotFoundError, ValidationError } from '@/lib/errors/app-errors'
import { rethrowOrLog } from '@/lib/errors/rethrow'
import { dateRangeOverlapSql } from '@/lib/date/date-range-overlap'
import { revalidatePath } from 'next/cache'
import { db } from '@/lib/db'
import { campaigns } from '@/lib/db/schema/campaigns'
import { campaignVehicles } from '@/lib/db/schema/campaign-vehicles'
import { vehicles } from '@/lib/db/schema/vehicles'
import { staffMembers } from '@/lib/db/schema/staff-members'
import { campaignAssignments } from '@/lib/db/schema/campaign-assignments'
import { sedeShifts } from '@/lib/db/schema/sede-shifts'
import { requireAccess } from '@/features/auth/lib/require-access'
import { logAudit } from '@/lib/audit/log-audit'
import { recalcAggregatesForCampaign } from '@/features/hours/lib/aggregate-staff-data'
import {
  assignVehicleSchema,
  setDriverSchema,
} from '../schemas/campaign-vehicle-schemas'
import type {
  AssignVehicleInput,
  SetDriverInput,
} from '../schemas/campaign-vehicle-schemas'
import type { Role } from '@/types/roles'
import type { Area } from '@/types/areas'

const LOGISTICS_ACCESS: { roles: Role[]; areas: Area[] } = {
  roles: ['admin', 'admin_area'],
  areas: ['logistica'],
}

const READ_ACCESS: { roles: Role[] } = {
  roles: ['admin', 'admin_area', 'comercial', 'operativo'],
}

export interface AssignedVehicleRow {
  id: string
  vehicleId: string
  plate: string
  mobileNumber: string | null
  model: string | null
  capacity: number | null
  driverStaffId: string | null
  driverFullName: string | null
  driverCedula: string | null
  assignedAt: Date
}

export async function getAssignedVehicles(
  campaignId: string,
): Promise<AssignedVehicleRow[]> {
  await requireAccess(READ_ACCESS)
  const rows = await db
    .select({
      id: campaignVehicles.id,
      vehicleId: campaignVehicles.vehicleId,
      plate: vehicles.plate,
      mobileNumber: vehicles.mobileNumber,
      model: vehicles.model,
      capacity: vehicles.capacity,
      driverStaffId: campaignVehicles.driverStaffId,
      driverFirstName: staffMembers.firstName,
      driverLastName: staffMembers.lastName,
      driverCedula: staffMembers.cedula,
      assignedAt: campaignVehicles.assignedAt,
    })
    .from(campaignVehicles)
    .innerJoin(vehicles, eq(campaignVehicles.vehicleId, vehicles.id))
    .leftJoin(staffMembers, eq(campaignVehicles.driverStaffId, staffMembers.id))
    .where(
      and(
        eq(campaignVehicles.campaignId, campaignId),
        eq(campaignVehicles.isActive, true),
      ),
    )
    .orderBy(campaignVehicles.assignedAt)
  return rows.map((r) => ({
    id: r.id,
    vehicleId: r.vehicleId,
    plate: r.plate,
    mobileNumber: r.mobileNumber,
    model: r.model,
    capacity: r.capacity,
    driverStaffId: r.driverStaffId,
    driverFullName: r.driverFirstName && r.driverLastName
      ? `${r.driverLastName}, ${r.driverFirstName}`
      : null,
    driverCedula: r.driverCedula ?? null,
    assignedAt: r.assignedAt,
  }))
}

export interface AvailableVehicleRow {
  id: string
  plate: string
  mobileNumber: string | null
  model: string | null
  capacity: number | null
}

async function getCampaignDateRange(
  campaignId: string,
): Promise<{ start: string; end: string } | null> {
  const [campaign] = await db
    .select({
      campaignDate: campaigns.campaignDate,
      endDate: campaigns.endDate,
    })
    .from(campaigns)
    .where(eq(campaigns.id, campaignId))
    .limit(1)
  if (!campaign) return null
  return {
    start: campaign.campaignDate,
    end: campaign.endDate ?? campaign.campaignDate,
  }
}

export async function getAvailableVehicles(
  campaignId: string,
): Promise<AvailableVehicleRow[]> {
  await requireAccess(LOGISTICS_ACCESS)

  const range = await getCampaignDateRange(campaignId)
  if (!range) return []

  // Vehículos ocupados: ya asignados activamente a una campaña (la actual o
  // cualquier otra) cuyo rango se solapa con el rango de la campaña actual.
  // Incluimos la campaña actual para que un vehículo ya asignado a ella NO
  // reaparezca como disponible en el dropdown.
  const overlapping = await db
    .selectDistinct({ vehicleId: campaignVehicles.vehicleId })
    .from(campaignVehicles)
    .innerJoin(campaigns, eq(campaignVehicles.campaignId, campaigns.id))
    .where(
      and(
        eq(campaignVehicles.isActive, true),
        dateRangeOverlapSql(campaigns.campaignDate, campaigns.endDate, range),
      ),
    )

  const busyIds = overlapping.map((r) => r.vehicleId)

  return await db
    .select({
      id: vehicles.id,
      plate: vehicles.plate,
      mobileNumber: vehicles.mobileNumber,
      model: vehicles.model,
      capacity: vehicles.capacity,
    })
    .from(vehicles)
    .where(
      busyIds.length > 0
        ? and(eq(vehicles.isActive, true), notInArray(vehicles.id, busyIds))
        : eq(vehicles.isActive, true),
    )
    .orderBy(vehicles.plate)
}

export interface AvailableDriverRow {
  id: string
  firstName: string
  lastName: string
  cedula: string
}

export async function getAvailableDrivers(
  campaignId: string,
): Promise<AvailableDriverRow[]> {
  await requireAccess(LOGISTICS_ACCESS)

  const range = await getCampaignDateRange(campaignId)
  if (!range) return []

  // Conductores activos en logística.
  const drivers = await db
    .select({
      id: staffMembers.id,
      firstName: staffMembers.firstName,
      lastName: staffMembers.lastName,
      cedula: staffMembers.cedula,
    })
    .from(staffMembers)
    .where(
      and(
        eq(staffMembers.isActive, true),
        eq(staffMembers.area, 'logistica'),
        eq(staffMembers.staffProfile, 'conductor'),
      ),
    )
    .orderBy(staffMembers.lastName)

  if (drivers.length === 0) return []
  const driverIds = drivers.map((d) => d.id)

  // Conductores ya asignados como driver en alguna campaña (incluyendo la
  // actual) cuyo rango se solapa. El panel reinyecta al conductor actual del
  // row al editar, así que excluirlos del pool no rompe la edición — solo
  // evita re-asignar el mismo conductor a dos vehículos de la misma campaña.
  const otherCampaignDrivers = await db
    .selectDistinct({ driverStaffId: campaignVehicles.driverStaffId })
    .from(campaignVehicles)
    .innerJoin(campaigns, eq(campaignVehicles.campaignId, campaigns.id))
    .where(
      and(
        eq(campaignVehicles.isActive, true),
        inArray(campaignVehicles.driverStaffId, driverIds),
        dateRangeOverlapSql(campaigns.campaignDate, campaigns.endDate, range),
      ),
    )

  // Conductores también pueden estar en sede shift solapado.
  const sedeBusy = await db
    .selectDistinct({ staffId: sedeShifts.staffId })
    .from(sedeShifts)
    .where(
      and(
        inArray(sedeShifts.staffId, driverIds),
        gte(sedeShifts.shiftDate, range.start),
        lte(sedeShifts.shiftDate, range.end),
      ),
    )

  // Conductores también pueden estar asignados como staff a otra campaña en el rango.
  const campaignBusy = await db
    .selectDistinct({ staffId: campaignAssignments.staffId })
    .from(campaignAssignments)
    .innerJoin(campaigns, eq(campaignAssignments.campaignId, campaigns.id))
    .where(
      and(
        eq(campaignAssignments.isActive, true),
        ne(campaignAssignments.campaignId, campaignId),
        inArray(campaignAssignments.staffId, driverIds),
        dateRangeOverlapSql(campaigns.campaignDate, campaigns.endDate, range),
      ),
    )

  const busy = new Set<string>()
  for (const r of otherCampaignDrivers) {
    if (r.driverStaffId) busy.add(r.driverStaffId)
  }
  for (const r of sedeBusy) busy.add(r.staffId)
  for (const r of campaignBusy) busy.add(r.staffId)

  return drivers.filter((d) => !busy.has(d.id))
}

export async function assignVehicle(input: AssignVehicleInput): Promise<void> {
  const ctx = await requireAccess(LOGISTICS_ACCESS)
  const validated = assignVehicleSchema.safeParse(input)
  if (!validated.success) throw new ValidationError(validated.error.issues[0].message)
  const { campaignId, vehicleId, driverStaffId } = validated.data

  try {
    // Verifica disponibilidad
    const available = await getAvailableVehicles(campaignId)
    if (!available.some((v) => v.id === vehicleId)) {
      throw new ValidationError('Este vehículo no está disponible para las fechas de la campaña.')
    }

    if (driverStaffId) {
      const availableDrivers = await getAvailableDrivers(campaignId)
      if (!availableDrivers.some((d) => d.id === driverStaffId)) {
        throw new ValidationError('El conductor no está disponible para las fechas de la campaña.')
      }
    }

    // Existe ya una asignación inactiva para este par (campaign,vehicle)? Reactivamos.
    const [existing] = await db
      .select({ id: campaignVehicles.id })
      .from(campaignVehicles)
      .where(
        and(
          eq(campaignVehicles.campaignId, campaignId),
          eq(campaignVehicles.vehicleId, vehicleId),
        ),
      )
      .limit(1)

    // Si reactivamos, capturamos el driver anterior para recalc si cambia.
    let previousDriverStaffId: string | null = null
    if (existing) {
      const [prev] = await db
        .select({ driverStaffId: campaignVehicles.driverStaffId })
        .from(campaignVehicles)
        .where(eq(campaignVehicles.id, existing.id))
        .limit(1)
      previousDriverStaffId = prev?.driverStaffId ?? null

      await db
        .update(campaignVehicles)
        .set({
          driverStaffId: driverStaffId ?? null,
          assignedAt: new Date(),
          removedAt: null,
          isActive: true,
        })
        .where(eq(campaignVehicles.id, existing.id))
    } else {
      await db.insert(campaignVehicles).values({
        campaignId,
        vehicleId,
        driverStaffId: driverStaffId ?? null,
      })
    }

    await logAudit({
      profileId: ctx.userId,
      action: 'create',
      tableName: 'campaign_vehicles',
      recordId: vehicleId,
      newData: { campaignId, vehicleId, driverStaffId: driverStaffId ?? null },
    })

    // Recalcular agregados de las personas afectadas (driver nuevo y anterior).
    const toRecalc = new Set<string>()
    if (driverStaffId) toRecalc.add(driverStaffId)
    if (previousDriverStaffId && previousDriverStaffId !== driverStaffId) {
      toRecalc.add(previousDriverStaffId)
    }
    await recalcAggregatesForCampaign(campaignId, toRecalc, 'assignVehicle')

    revalidatePath(`/campanas/${campaignId}`)
  } catch (error) {
    rethrowOrLog(error, 'assignVehicle', 'Error al asignar el vehículo a la campaña')
  }
}

export async function removeVehicleAssignment(
  campaignVehicleId: string,
): Promise<void> {
  const ctx = await requireAccess(LOGISTICS_ACCESS)

  try {
    const [row] = await db
      .select({
        id: campaignVehicles.id,
        campaignId: campaignVehicles.campaignId,
        driverStaffId: campaignVehicles.driverStaffId,
      })
      .from(campaignVehicles)
      .where(eq(campaignVehicles.id, campaignVehicleId))
      .limit(1)
    if (!row) throw new NotFoundError('Asignación no encontrada')

    await db
      .update(campaignVehicles)
      .set({ isActive: false, removedAt: new Date() })
      .where(eq(campaignVehicles.id, campaignVehicleId))

    await logAudit({
      profileId: ctx.userId,
      action: 'delete',
      tableName: 'campaign_vehicles',
      recordId: campaignVehicleId,
    })

    if (row.driverStaffId) {
      await recalcAggregatesForCampaign(row.campaignId, row.driverStaffId, 'removeVehicleAssignment')
    }

    revalidatePath(`/campanas/${row.campaignId}`)
  } catch (error) {
    rethrowOrLog(error, 'removeVehicleAssignment', 'Error al eliminar la asignación del vehículo')
  }
}

export async function setDriver(input: SetDriverInput): Promise<void> {
  const ctx = await requireAccess(LOGISTICS_ACCESS)
  const validated = setDriverSchema.safeParse(input)
  if (!validated.success) throw new ValidationError(validated.error.issues[0].message)
  const { campaignVehicleId, driverStaffId } = validated.data

  try {
    const [row] = await db
      .select({
        id: campaignVehicles.id,
        campaignId: campaignVehicles.campaignId,
        previousDriverStaffId: campaignVehicles.driverStaffId,
      })
      .from(campaignVehicles)
      .where(eq(campaignVehicles.id, campaignVehicleId))
      .limit(1)
    if (!row) throw new NotFoundError('Asignación no encontrada')

    // Verifica que el conductor sea válido (logística + conductor).
    const [driver] = await db
      .select({
        id: staffMembers.id,
        area: staffMembers.area,
        staffProfile: staffMembers.staffProfile,
      })
      .from(staffMembers)
      .where(eq(staffMembers.id, driverStaffId))
      .limit(1)
    if (!driver) throw new NotFoundError('Conductor no encontrado')
    if (driver.area !== 'logistica' || driver.staffProfile !== 'conductor') {
      throw new ValidationError('Solo se admiten conductores del área de logística.')
    }

    await db
      .update(campaignVehicles)
      .set({ driverStaffId })
      .where(eq(campaignVehicles.id, campaignVehicleId))

    await logAudit({
      profileId: ctx.userId,
      action: 'update',
      tableName: 'campaign_vehicles',
      recordId: campaignVehicleId,
      newData: { driverStaffId },
    })

    // Recalcular: conductor anterior (si existía) y nuevo.
    const toRecalc = new Set<string>([driverStaffId])
    if (row.previousDriverStaffId && row.previousDriverStaffId !== driverStaffId) {
      toRecalc.add(row.previousDriverStaffId)
    }
    await recalcAggregatesForCampaign(row.campaignId, toRecalc, 'setDriver')

    revalidatePath(`/campanas/${row.campaignId}`)
  } catch (error) {
    rethrowOrLog(error, 'setDriver', 'Error al asignar el conductor')
  }
}
