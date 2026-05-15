'use server'

import { eq, and, asc } from 'drizzle-orm'
import { AppError, ValidationError } from '@/lib/errors/app-errors'
import { db } from '@/lib/db'
import { profiles } from '@/lib/db/schema/profiles'
import { staffMembers } from '@/lib/db/schema/staff-members'
import { sedeShifts } from '@/lib/db/schema/sede-shifts'
import { weeklyBalance } from '@/lib/db/schema/weekly-balance'
import { monthlyCounters } from '@/lib/db/schema/monthly-counters'
import { staffAvailability } from '@/lib/db/schema/staff-availability'
import { requireAccess } from '@/features/auth/lib/require-access'
import { loadValidationRuntimeConfig } from '@/features/configuration/lib/runtime-config'
import { getCurrentMondayIso, getSundayOfWeek } from '@/lib/date/week'
import {
  getMyUpcomingCampaigns,
  type MyUpcomingCampaign,
} from '@/features/dashboard/lib/operativo-queries'

// ---- Types ----------------------------------------------------------------

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
  contractWeeklyHours: number
  maxSundaysMonth: number
  maxOvernightsMonth: number
}

// ---- Helpers --------------------------------------------------------------

function getCurrentMondayISO(): string {
  return getCurrentMondayIso()
}

function getWeekEndISO(weekStart: string): string {
  return getSundayOfWeek(weekStart)
}

function getTodayISO(): string {
  // Local components — "hoy" según el huso del usuario, no UTC.
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function getCurrentHHMM(): string {
  const now = new Date()
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
}

function deriveBalanceState(
  workedHours: number,
  weeklyHours: number,
): 'cumplio' | 'horas_extras' | 'debe_horas' {
  if (workedHours === weeklyHours) return 'cumplio'
  if (workedHours > weeklyHours) return 'horas_extras'
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

async function fetchWeeklyBalance(
  staffId: string,
  weeklyHours: number,
  /**
   * Turnos de sede de la semana ya cargados arriba — los reusamos para no
   * golpear la DB dos veces. Solo los pasamos para el cálculo progresivo.
   */
  weekShifts: { shiftDate: string; endTime: string; totalHours: number }[],
): Promise<MyWeeklyBalance | null> {
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

  // Cálculo PROGRESIVO de "horas trabajadas hasta ahora":
  // - turnos cuyo shiftDate ya pasó → suman completos.
  // - turno de HOY → suma si su endTime ya pasó (HH:MM <= now local).
  // - turnos futuros (shiftDate > hoy, o hoy con endTime > now) → 0.
  //
  // Por qué no usar `weeklyBalance.workedHours` directamente: ese campo refleja
  // el TOTAL programado para la semana (planeación), no lo cumplido al momento.
  // El usuario espera ver una barra que crece a medida que avanzan los días.
  const today = getTodayISO()
  const nowHHMM = getCurrentHHMM()
  const workedSoFar = weekShifts.reduce((sum, s) => {
    if (s.shiftDate < today) return sum + s.totalHours
    if (s.shiftDate === today && s.endTime <= nowHHMM) return sum + s.totalHours
    return sum
  }, 0)

  // Sin row en weekly_balance: si tampoco hay shifts en la semana, conservamos
  // null (no hay nada que mostrar). Si hay shifts pero el recalc no ha corrido
  // aún, sintetizamos un balance progresivo derivado SOLO de los shifts ya
  // completados (sedeHours) — la UI muestra "12h" en vez de "0h" engañoso.
  // Las horas de campaña entran cuando el cron de recalc-aggregates corre y
  // crea el row real, prevaleciendo a partir de ese momento.
  if (!balance) {
    if (weekShifts.length === 0) return null
    return {
      workedHours: workedSoFar,
      sedeHours: workedSoFar,
      campaignHours: 0,
      extraHours: Math.max(0, workedSoFar - weeklyHours),
      balanceState: deriveBalanceState(workedSoFar, weeklyHours),
    }
  }

  return {
    ...balance,
    // Sobrescribimos workedHours con el valor progresivo. sedeHours y
    // campaignHours mantienen el total de la semana (para mostrar "scheduled")
    // si hace falta más adelante.
    workedHours: workedSoFar,
    balanceState: deriveBalanceState(workedSoFar, weeklyHours),
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

export async function getMyAgendaData(): Promise<MyAgendaData | null> {
  const { userId } = await requireAccess({ roles: ['operativo', 'admin', 'admin_area', 'comercial'] })

  try {
    const staff = await getStaffMemberFromAuth(userId)

    if (!staff) {
      return null
    }

    const cfg = await loadValidationRuntimeConfig()

    // Cargamos los shifts ANTES del balance para poder pasárselos y calcular
    // horas trabajadas progresivas sin un segundo round-trip a DB.
    const [upcomingCampaigns, sedeShiftsThisWeek, counters] = await Promise.all([
      getMyUpcomingCampaigns(staff.id),
      fetchSedeShiftsThisWeek(staff.id),
      fetchMonthlyCounters(staff.id),
    ])
    const balance = await fetchWeeklyBalance(staff.id, cfg.weeklyHours, sedeShiftsThisWeek)

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
      contractWeeklyHours: cfg.weeklyHours,
      maxSundaysMonth: cfg.maxSundaysMonth,
      maxOvernightsMonth: cfg.maxOvernightsMonth,
    }
  } catch (error) {
    if (error instanceof AppError) throw error
    throw new Error('Error al obtener los datos de mi agenda')
  }
}

export async function setMyAvailability(data: {
  availabilityDate: string
  status: 'vacaciones' | 'incapacidad' | 'licencia' | 'disponible'
  notes?: string
}): Promise<void> {
  const { userId } = await requireAccess({ roles: ['operativo', 'admin', 'admin_area', 'comercial'] })

  try {
    const staff = await getStaffMemberFromAuth(userId)

    if (!staff) {
      throw new ValidationError('No tiene un perfil de colaborador asociado')
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
    if (error instanceof AppError) throw error
    console.error('[setAvailability]', error)
    throw new Error('Error al registrar la disponibilidad')
  }
}
