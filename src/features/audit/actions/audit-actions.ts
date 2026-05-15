'use server'

import { eq, and, desc, gte, lte, sql } from 'drizzle-orm'
import { AppError } from '@/lib/errors/app-errors'
import { db } from '@/lib/db'
import { auditLog } from '@/lib/db/schema/audit-log'
import { profiles } from '@/lib/db/schema/profiles'
import { requireAccess } from '@/features/auth/lib/require-access'

export interface AuditLogRow {
  id: string
  profileId: string | null
  userEmail: string | null
  userFullName: string | null
  action: 'create' | 'update' | 'delete' | 'login' | 'logout'
  tableName: string | null
  recordId: string | null
  oldData: Record<string, unknown> | null
  newData: Record<string, unknown> | null
  createdAt: Date
}

export interface AuditLogFilters {
  tableName?: string
  action?: string
  dateFrom?: string
  dateTo?: string
  page?: number
  limit?: number
}

export async function getAuditLog(
  filters: AuditLogFilters = {},
): Promise<{ data: AuditLogRow[]; total: number }> {
  await requireAccess({ roles: ['admin'] })

  const { page = 1, limit = 50, tableName, action, dateFrom, dateTo } = filters
  const offset = (page - 1) * limit

  try {
    const conditions: ReturnType<typeof eq>[] = []

    if (tableName) conditions.push(eq(auditLog.tableName, tableName))
    if (action) {
      conditions.push(
        eq(auditLog.action, action as 'create' | 'update' | 'delete' | 'login' | 'logout'),
      )
    }
    if (dateFrom) conditions.push(gte(auditLog.createdAt, new Date(dateFrom)))
    if (dateTo) {
      const endDate = new Date(dateTo)
      endDate.setDate(endDate.getDate() + 1)
      conditions.push(lte(auditLog.createdAt, endDate))
    }

    const where =
      conditions.length === 1
        ? conditions[0]
        : conditions.length > 1
          ? and(...(conditions as [ReturnType<typeof eq>, ...ReturnType<typeof eq>[]]))
          : undefined

    const [rows, countRows] = await Promise.all([
      db
        .select({
          id: auditLog.id,
          profileId: auditLog.profileId,
          userEmail: profiles.email,
          userFullName: profiles.fullName,
          action: auditLog.action,
          tableName: auditLog.tableName,
          recordId: auditLog.recordId,
          oldData: auditLog.oldData,
          newData: auditLog.newData,
          createdAt: auditLog.createdAt,
        })
        .from(auditLog)
        .leftJoin(profiles, eq(auditLog.profileId, profiles.id))
        .where(where)
        .limit(limit)
        .offset(offset)
        .orderBy(desc(auditLog.createdAt)),

      db
        .select({ count: sql<number>`count(*)::int` })
        .from(auditLog)
        .where(where),
    ])

    return {
      data: rows as AuditLogRow[],
      total: countRows[0]?.count ?? 0,
    }
  } catch (error) {
    if (error instanceof AppError) throw error
    throw new Error('Error al obtener el log de auditoria')
  }
}
