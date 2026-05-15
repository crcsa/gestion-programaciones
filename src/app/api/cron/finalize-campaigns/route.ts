import { NextResponse } from 'next/server'
import { sql, and, eq, lt, notInArray } from 'drizzle-orm'
import { db } from '@/lib/db'
import { campaigns } from '@/lib/db/schema/campaigns'
import { campaignAssignments } from '@/lib/db/schema/campaign-assignments'
import { logAudit } from '@/lib/audit/log-audit'
import { recalcStaffAggregatesBatch } from '@/features/hours/lib/aggregate-staff-data'

export const dynamic = 'force-dynamic'

function isAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  const header = request.headers.get('authorization')
  return header === `Bearer ${secret}`
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  try {
    const today = new Date().toISOString().slice(0, 10)

    const finalized = await db
      .update(campaigns)
      .set({ status: 'ejecutada', updatedAt: new Date() })
      .where(
        and(
          lt(campaigns.campaignDate, today),
          notInArray(campaigns.status, ['ejecutada', 'cancelada']),
          eq(campaigns.isDeleted, false),
        ),
      )
      .returning({ id: campaigns.id, campaignDate: campaigns.campaignDate })

    let recalcFailed = 0

    for (const c of finalized) {
      try {
        await logAudit({
          profileId: null,
          action: 'update',
          tableName: 'campaigns',
          recordId: c.id,
          newData: { status: 'ejecutada', source: 'cron_auto_finalize' },
        })
      } catch (err) {
        recalcFailed++
        console.error('[cron/finalize-campaigns] logAudit', c.id, err)
      }

      const assigned = await db
        .select({ staffId: campaignAssignments.staffId })
        .from(campaignAssignments)
        .where(
          and(
            eq(campaignAssignments.campaignId, c.id),
            eq(campaignAssignments.isActive, true),
          ),
        )

      if (assigned.length > 0) {
        try {
          await recalcStaffAggregatesBatch(
            assigned.map((a) => a.staffId),
            c.campaignDate,
          )
        } catch (err) {
          recalcFailed++
          console.error('[cron/finalize-campaigns] recalc', c.id, err)
        }
      }
    }

    const body = {
      ok: recalcFailed === 0,
      finalized: finalized.length,
      recalcFailed,
    }
    // 207 Multi-Status si hay errores parciales para que monitoring dispare.
    const status = recalcFailed === 0 ? 200 : 207
    return NextResponse.json(body, { status })
  } catch (error) {
    console.error('[cron/finalize-campaigns] fatal', error)
    return NextResponse.json({ ok: false, error: 'internal error' }, { status: 500 })
  }
}

// Suprime warning de variables no usadas en runtime
void sql
