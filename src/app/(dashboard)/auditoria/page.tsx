import { requireAccess } from '@/features/auth/lib/require-access'
import { getAuditLog } from '@/features/audit/actions/audit-actions'
import { AuditClient } from '@/features/audit/components/audit-client'

export const metadata = {
  title: 'Auditoria',
}

export default async function AuditoriaPage() {
  await requireAccess({ roles: ['admin'] })

  const { data, total } = await getAuditLog({ limit: 50 })

  return <AuditClient initialData={data} initialTotal={total} />
}
