import Link from 'next/link'
import { redirect } from 'next/navigation'
import { listUnlinkedStaff } from '@/features/users/actions/user-actions'
import { UserFormClient } from '@/features/users/components/user-form-client'
import { requireUserContext } from '@/features/auth/lib/user-context'
import { Button } from '@/components/ui/button'

export default async function NuevoUsuarioPage() {
  let ctx
  try {
    ctx = await requireUserContext()
  } catch {
    redirect('/login')
  }

  // Solo admin global y admin de área pueden crear usuarios.
  if (ctx.role !== 'admin' && ctx.role !== 'admin_area') {
    redirect('/')
  }

  const unlinkedStaff = await listUnlinkedStaff()

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Nuevo usuario</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          {ctx.role === 'admin_area'
            ? 'Crea otro admin de tu área o dale credenciales de acceso a tu staff operativo (creado previamente en /personal).'
            : 'Crea credenciales de acceso. Para roles distintos de admin, vincula a un colaborador.'}
        </p>
      </div>

      <UserFormClient
        unlinkedStaff={unlinkedStaff}
        callerRole={ctx.role}
        callerArea={ctx.area}
      />

      <div>
        <Button variant="outline" nativeButton={false} render={<Link href="/usuarios" />}>
          ← Usuarios
        </Button>
      </div>
    </div>
  )
}
