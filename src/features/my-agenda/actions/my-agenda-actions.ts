'use server'

import { eq, and, asc } from 'drizzle-orm'
import { db } from '@/lib/db'
import { profiles } from '@/lib/db/schema/profiles'
import { staffMembers } from '@/lib/db/schema/staff-members'
import { campaignAssignments } from '@/lib/db/schema/campaign-assignments'
import { campaigns } from '@/lib/db/schema/campaigns'
import { sedeShifts } from '@/lib/db/schema/sede-shifts'
import { weeklyBalance } from '@/lib/db/schema/weekly-balance'
import { monthlyCounters } from '@/lib/db/schema/monthly-counters'
import { staffAvailability } from '@/lib/db/schema/staff-availability'
import { requireRole } from '@/features/auth/lib/require-role'
import { WEEKLY_HOURS_CONTRACT } from '@/features/assignments/lib/validation-constants'

// ---- Types ----------------------------------------------------------------

export interface MyUpcomingCampaign {
  campaignId: string
  assignmentId: string
  code: string
  campaignDate: string
  startTime: string | null
  endTime: string | null
  municipality: string
  status: string
  size: string
  modality: string
  isCoordinator: boolean
}

export interface MySedeShift {
  id: string
  shiftDate: string
  shiftType: string
  startTime: string
  endTime: string
  totalHours: number
  isOvernight: boolean
}

export interface MyMonthlyCounters {
  sundayCount: number
  overnightCount: number
}

export interface MyWeeklyBalance {
  workedHours: number
  sedeHours: number
  campaignHours: number
  extraHours: number
  balanceState: 'cumplio' | 'horas_extras' | 'debe_horas'
}

export interface MyAgendaData {
  staffMemberId: string
  firstName: string
  lastName: string
  staffProfile: string
  upcomingCampaigns: MyUpcomingCampaign[]
  sedeShiftsThisWeek: MySedeShift[]
  weeklyBalance: MyWeeklyBalance | null
  monthlyCounters: MyMonthlyCounters
  coordinatorCampaignIds: string[]
}

// ---- Helpers --------------------------------------------------------------

function getCurrentMondayISO(): string {
  const d = new Date()
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  return d.toISOString().slice(0, 10)
}

function getWeekEndISO(weekStart: string): string {
  const d = new Date(`${weekStart}T00:00:00`)
  d.setDate(d.getDate() + 6)
  return d.toISOString().slice(0, 10)
}

function getThirtyDaysFromNow(): string {
  const d = new Date()
  d.setDate(d.getDate() + 30)
  return d.toISOString().slice(0, 10)
}

function getTodayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

function deriveBalanceState(
  workedHours: number,
): 'cumplio' | 'horas_extras' | 'debe_horas' {
  if (workedHours === WEEKLY_HOURS_CONTRACT) return 'cumplio'
  if (workedHours > WEEKLY_HOURS_CONTRACT) return 'horas_extras'
  return 'debe_horas'
}

// ---- Fetch staff member from auth -----------------------------------------

async function getStaffMemberFromAuth(userId: string) {
  const [profile] = await db
    .select({ id: profiles.id })
    .from(profiles)
    .where(eq(profiles.id, userId))
    .limit(1)

  if (!profile) return null

  const [staff] = await db
    .select({
      id: staffMembers.id,
      firstName: staffMembers.firstName,
      lastName: staffMembers.lastName,
      staffProfile: staffMembers.staffProfile,
    })
    .from(staffMembers)
    .where(eq(staffMembers.profileId, profile.id))
    .limit(1)

  return staff ?? null
}

// ---- Fetch upcoming campaigns ---------------------------------------------

async function fetchUpcomingCampaigns(staffId: string): Promise<MyUpcomingCampaign[]> {
  const today = getTodayISO()
  const endDate = getThirtyDaysFromNow()

  const rows = await db
    .select({
      campaignId: campaigns.id,
      assignmentId: campaignAssignments.id,
      code: campaigns.code,
      campaignDate: campaigns.campaignDate,
      startTime: campaigns.startTime,
      endTime: campaigns.endTime,
      municipality: campaigns.municipality,
      status: campaigns.status,
      size: campaigns.size,
      modality: campaigns.modality,
      isCoordinator: campaignAssignments.isCoordinator,
    })
    .from(campaignAssignments)
    .leftJoin(campaigns, eq(campaignAssignments.campaignId, campaigns.id))
    .where(
      and(
        eq(campaignAssignments.staffId, staffId),
        eq(campaignAssignments.isActive, true),
      ),
    )
    .orderBy(asc(campaigns.campaignDate))

  return rows
    .filter(
      (r) =>
        r.campaignId !== null &&
        r.campaignDate !== null &&
        r.campaignDate >= today &&
        r.campaignDate <= endDate,
    )
    .map((r) => ({
      campaignId: r.campaignId!,
      assignmentId: r.assignmentId,
      code: r.code ?? '',
      campaignDate: r.campaignDate ?? '',
      startTime: r.startTime,
      endTime: r.endTime,
      municipality: r.municipality ?? '',
      status: r.status ?? '',
      size: r.size ?? '',
      modality: r.modality ?? '',
      isCoordinator: r.isCoordinator,
    }))
}

// ---- Fetch sede shifts for current week -----------------------------------

async function fetchSedeShiftsThisWeek(staffId: string): Promise<MySedeShift[]> {
  const weekStart = getCurrentMondayISO()
  const weekEnd = getWeekEndISO(weekStart)

  const allShifts = await db
    .select({
      id: sedeShifts.id,
      shiftDate: sedeShifts.shiftDate,
      shiftType: sedeShifts.shiftType,
      startTime: sedeShifts.startTime,
      endTime: sedeShifts.endTime,
      totalHours: sedeShifts.totalHours,
      isOvernight: sedeShifts.isOvernight,
    })
    .from(sedeShifts)
    .where(eq(sedeShifts.staffId, staffId))
    .orderBy(asc(sedeShifts.shiftDate))

  return allShifts.filter(
    (s) => s.shiftDate >= weekStart && s.shiftDate <= weekEnd,
  )
}

// ---- Fetch weekly balance -------------------------------------------------

async function fetchWeeklyBalance(staffId: string): Promise<MyWeeklyBalance | null> {
  const weekStart = getCurrentMondayISO()

  const [balance] = await db
    .select({
      workedHours: weeklyBalance.workedHours,
      sedeHours: weeklyBalance.sedeHours,
      campaignHours: weeklyBalance.campaignHours,
      extraHours: weeklyBalance.extraHours,
    })
    .from(weeklyBalance)
    .where(
      and(
        eq(weeklyBalance.staffId, staffId),
        eq(weeklyBalance.weekStart, weekStart),
      ),
    )
    .limit(1)

  if (!balance) return null

  return {
    ...balance,
    balanceState: deriveBalanceState(balance.workedHours),
  }
}

// ---- Fetch monthly counters -----------------------------------------------

async function fetchMonthlyCounters(staffId: string): Promise<MyMonthlyCounters> {
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth() + 1

  const [counters] = await db
    .select({
      sundayCount: monthlyCounters.sundayCount,
      overnightCount: monthlyCounters.overnightCount,
    })
    .from(monthlyCounters)
    .where(
      and(
        eq(monthlyCounters.staffId, staffId),
        eq(monthlyCounters.year, year),
        eq(monthlyCounters.month, month),
      ),
    )
    .limit(1)

  return {
    sundayCount: counters?.sundayCount ?? 0,
    overnightCount: counters?.overnightCount ?? 0,
  }
}

// ---- Fetch coordinator campaign ids ---------------------------------------

function extractCoordinatorCampaignIds(
  upcomingCampaigns: MyUpcomingCampaign[],
): string[] {
  return upcomingCampaigns
    .filter((c) => c.isCoordinator && c.status === 'confirmada')
    .map((c) => c.campaignId)
}

// ---- Public actions -------------------------------------------------------

export async function getMyAgendaData(): Promise<MyAgendaData> {
  const { userId } = await requireRole(['operativo', 'admin', 'banco_sangre', 'comercial'])

  try {
    const staff = await getStaffMemberFromAuth(userId)

    if (!staff) {
      throw new Error('No tiene un perfil de funcionario asociado')
    }

    const [upcomingCampaigns, sedeShiftsThisWeek, balance, counters] =
      await Promise.all([
        fetchUpcomingCampaigns(staff.id),
        fetchSedeShiftsThisWeek(staff.id),
        fetchWeeklyBalance(staff.id),
        fetchMonthlyCounters(staff.id),
      ])

    const coordinatorCampaignIds = extractCoordinatorCampaignIds(upcomingCampaigns)

    return {
      staffMemberId: staff.id,
      firstName: staff.firstName,
      lastName: staff.lastName,
      staffProfile: staff.staffProfile,
      upcomingCampaigns,
      sedeShiftsThisWeek,
      weeklyBalance: balance,
      monthlyCounters: counters,
      coordinatorCampaignIds,
    }
  } catch (error) {
    if (error instanceof Error && error.message.includes('permiso')) throw error
    if (error instanceof Error && error.message.includes('perfil de funcionario')) throw error
    throw new Error('Error al obtener los datos de mi agenda')
  }
}

export async function setMyAvailability(data: {
  availabilityDate: string
  status: 'vacaciones' | 'incapacidad' | 'licencia' | 'disponible'
  notes?: string
}): Promise<void> {
  const { userId } = await requireRole(['operativo', 'admin', 'banco_sangre', 'comercial'])

  try {
    const staff = await getStaffMemberFromAuth(userId)

    if (!staff) {
      throw new Error('No tiene un perfil de funcionario asociado')
    }

    const [existing] = await db
      .select({ id: staffAvailability.id })
      .from(staffAvailability)
      .where(
        and(
          eq(staffAvailability.staffId, staff.id),
          eq(staffAvailability.availabilityDate, data.availabilityDate),
        ),
      )
      .limit(1)

    if (existing) {
      await db
        .update(staffAvailability)
        .set({
          status: data.status,
          notes: data.notes ?? null,
          updatedAt: new Date(),
        })
        .where(eq(staffAvailability.id, existing.id))
    } else {
      await db.insert(staffAvailability).values({
        staffId: staff.id,
        availabilityDate: data.availabilityDate,
        status: data.status,
        notes: data.notes ?? null,
      })
    }
  } catch (error) {
    if (error instanceof Error && error.message.includes('permiso')) throw error
    if (error instanceof Error && error.message.includes('perfil de funcionario')) throw error
    throw new Error('Error al registrar la disponibilidad')
  }
}
