import { db } from '@/lib/db'
import { auditLog } from '@/lib/db/schema/audit-log'

export interface AuditParams {
  profileId: string | null
  action: 'create' | 'update' | 'delete' | 'login' | 'logout'
  tableName: string
  recordId: string
  oldData?: Record<string, unknown>
  newData?: Record<string, unknown>
}

/** Fire-and-forget audit logger -- never throws to caller */
export async function logAudit(params: AuditParams): Promise<void> {
  await db
    .insert(auditLog)
    .values({
      profileId: params.profileId,
      action: params.action,
      tableName: params.tableName,
      recordId: params.recordId,
      oldData: params.oldData ?? null,
      newData: params.newData ?? null,
    })
    .catch((err: unknown) => console.error('[audit] failed to write log:', err))
}
