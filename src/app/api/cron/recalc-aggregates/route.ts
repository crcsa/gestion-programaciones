import { NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { staffMembers } from '@/lib/db/schema/staff-members'
import { recalcStaffAggregates } from '@/features/hours/lib/aggregate-staff-data'

export const dynamic = 'force-dynamic'

function isAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  const header = request.headers.get('authorization')
  return header === `Bearer ${secret}`
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

function previousWeekISO(): string {
  const d = new Date()
  d.setDate(d.getDate() - 7)
  return d.toISOString().slice(0, 10)
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  try {
    const active = await db
      .select({ id: staffMembers.id })
      .from(staffMembers)
      .where(eq(staffMembers.isActive, true))

    const today = todayISO()
    const previousWeek = previousWeekISO()

    let success = 0
    let failed = 0

    for (const s of active) {
      try {
        await recalcStaffAggregates(s.id, today)
        await recalcStaffAggregates(s.id, previousWeek)
        success++
      } catch (err) {
        failed++
        // Detalles internos (cause.code/detail) van solo al log server-side;
        // la respuesta del cron evita filtrar info de schema/constraints.
        console.error('[cron/recalc-aggregates] staffId', s.id, err)
      }
    }

    const body = {
      ok: failed === 0,
      reconciled: success,
      total: active.length,
      failed,
    }
    // 207 Multi-Status si hay errores parciales para que monitoring dispare.
    const status = failed === 0 ? 200 : 207
    return NextResponse.json(body, { status })
  } catch (error) {
    console.error('[cron/recalc-aggregates] fatal', error)
    return NextResponse.json({ ok: false, error: 'internal error' }, { status: 500 })
  }
}
