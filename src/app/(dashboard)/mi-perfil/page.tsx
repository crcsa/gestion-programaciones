import { requireUserContext } from '@/features/auth/lib/user-context'
import { ProfileFormClient } from '@/features/users/components/profile-form-client'

export default async function MiPerfilPage() {
  const ctx = await requireUserContext()

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Mi perfil</h1>
        <p className="text-muted-foreground text-sm mt-0.5">
          Gestiona tu nombre, correo y contraseña.
        </p>
      </div>

      <ProfileFormClient
        fullName={ctx.fullName}
        email={ctx.email}
        role={ctx.role}
        area={ctx.area}
      />
    </div>
  )
}
