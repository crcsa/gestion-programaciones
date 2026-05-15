import { listUsers, listUnlinkedStaff } from '@/features/users/actions/user-actions'
import { UsersListClient } from '@/features/users/components/users-list-client'
import { requireUserContext } from '@/features/auth/lib/user-context'

export default async function UsuariosPage() {
  const [users, unlinkedStaff, ctx] = await Promise.all([
    listUsers(),
    listUnlinkedStaff(),
    requireUserContext(),
  ])

  return (
    <UsersListClient
      users={users}
      unlinkedStaff={unlinkedStaff}
      callerRole={ctx.role}
      callerArea={ctx.area}
    />
  )
}
