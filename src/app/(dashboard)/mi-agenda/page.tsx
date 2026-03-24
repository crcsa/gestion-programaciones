import { requireRole } from '@/features/auth/lib/require-role'
import { getMyAgendaData } from '@/features/my-agenda/actions/my-agenda-actions'
import { MyAgendaClient } from '@/features/my-agenda/components/my-agenda-client'

export default async function MiAgendaPage() {
  const { role } = await requireRole(['operativo', 'admin', 'banco_sangre', 'comercial'])
  const data = await getMyAgendaData()
  return <MyAgendaClient data={data} currentRole={role} />
}
