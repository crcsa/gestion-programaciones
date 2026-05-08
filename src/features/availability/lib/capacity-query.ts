import { eq, and, gte, lte, inArray } from 'drizzle-orm'
import { db } from '@/lib/db'
import { staffMembers } from '@/lib/db/schema/staff-members'
import { staffAvailability } from '@/lib/db/schema/staff-availability'
import { sedeShifts } from '@/lib/db/schema/sede-shifts'
import { campaignAssignments } from '@/lib/db/schema/campaign-assignments'
import { campaigns } from '@/lib/db/schema/campaigns'

export type CapacityProfile = 'bacteriologo' | 'tecnico' | 'medico' | 'auxiliar'

export interface DayCapacity {
  date: string
  totalStaff: number
  assignedToCampaign: number
  onSedeShift: number
  unavailable: number
  free: number
}

export interface MonthlyCapacityParams {
  year: number
  month: number // 1-12
  profile?: CapacityProfile
}

const UNAVAILABLE_STATUSES = ['vacaciones', 'incapacidad', 'licencia', 'no_disponible']

function buildMonthDates(year: number, month: number): string[] {
  const lastDay = new Date(year, month, 0).getDate()
  const mm = String(month).padStart(2, '0')
  return Array.from({ length: lastDay }, (_, i) => {
    const dd = String(i + 1).padStart(2, '0')
    return `${year}-${mm}-${dd}`
  })
}

export async function getMonthlyCapacity(
  params: MonthlyCapacityParams,
): Promise<DayCapacity[]> {
  const { year, month, profile } = params

  if (month < 1 || month > 12) {
    throw new Error('Mes inválido')
  }

  const dates = buildMonthDates(year, month)
  const monthStart = dates[0]
  const monthEnd = dates[dates.length - 1]

  const staffConditions = [eq(staffMembers.isActive, true)]
  if (profile) {
    staffConditions.push(eq(staffMembers.staffProfile, profile))
  }

  const staff = await db
    .select({ id: staffMembers.id })
    .from(staffMembers)
    .where(and(...staffConditions))

  const totalStaff = staff.length
  const staffIds = staff.map((s) => s.id)

  if (totalStaff === 0 || staffIds.length === 0) {
    return dates.map((date) => ({
      date,
      totalStaff: 0,
      assignedToCampaign: 0,
      onSedeShift: 0,
      unavailable: 0,
      free: 0,
    }))
  }

  const [assignments, shifts, overrides] = await Promise.all([
    db
      .select({
        staffId: campaignAssignments.staffId,
        campaignDate: campaigns.campaignDate,
      })
      .from(campaignAssignments)
      .leftJoin(campaigns, eq(campaignAssignments.campaignId, campaigns.id))
      .where(
        and(
          eq(campaignAssignments.isActive, true),
          inArray(campaignAssignments.staffId, staffIds),
          gte(campaigns.campaignDate, monthStart),
          lte(campaigns.campaignDate, monthEnd),
        ),
      ),
    db
      .select({
        staffId: sedeShifts.staffId,
        shiftDate: sedeShifts.shiftDate,
      })
      .from(sedeShifts)
      .where(
        and(
          inArray(sedeShifts.staffId, staffIds),
          gte(sedeShifts.shiftDate, monthStart),
          lte(sedeShifts.shiftDate, monthEnd),
        ),
      ),
    db
      .select({
        staffId: staffAvailability.staffId,
        availabilityDate: staffAvailability.availabilityDate,
        status: staffAvailability.status,
      })
      .from(staffAvailability)
      .where(
        and(
          inArray(staffAvailability.staffId, staffIds),
          gte(staffAvailability.availabilityDate, monthStart),
          lte(staffAvailability.availabilityDate, monthEnd),
        ),
      ),
  ])

  const assignedByDate = new Map<string, Set<string>>()
  for (const a of assignments) {
    if (!a.campaignDate) continue
    const set = assignedByDate.get(a.campaignDate) ?? new Set()
    set.add(a.staffId)
    assignedByDate.set(a.campaignDate, set)
  }

  const shiftsByDate = new Map<string, Set<string>>()
  for (const s of shifts) {
    const set = shiftsByDate.get(s.shiftDate) ?? new Set()
    set.add(s.staffId)
    shiftsByDate.set(s.shiftDate, set)
  }

  const unavailableByDate = new Map<string, Set<string>>()
  for (const o of overrides) {
    if (!UNAVAILABLE_STATUSES.includes(o.status)) continue
    const set = unavailableByDate.get(o.availabilityDate) ?? new Set()
    set.add(o.staffId)
    unavailableByDate.set(o.availabilityDate, set)
  }

  return dates.map((date) => {
    const assigned = assignedByDate.get(date)?.size ?? 0
    const onShift = shiftsByDate.get(date)?.size ?? 0
    const unavailable = unavailableByDate.get(date)?.size ?? 0

    // staff occupied = union of these three sets — but counting per category
    // for display. Free = total - busy where busy is union.
    const busyIds = new Set<string>()
    assignedByDate.get(date)?.forEach((id) => busyIds.add(id))
    shiftsByDate.get(date)?.forEach((id) => busyIds.add(id))
    unavailableByDate.get(date)?.forEach((id) => busyIds.add(id))

    return {
      date,
      totalStaff,
      assignedToCampaign: assigned,
      onSedeShift: onShift,
      unavailable,
      free: Math.max(0, totalStaff - busyIds.size),
    }
  })
}
