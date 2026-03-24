import { redirect } from 'next/navigation'
import { requireRole } from '@/features/auth/lib/require-role'
import { getTrainingAreas } from '@/features/staff/actions/staff-actions'
import { StaffFormClient } from '@/features/staff/components/staff-form-client'

export default async function NuevoFuncionarioPage() {
  try {
    await requireRole(['admin', 'banco_sangre'])
  } catch {
    redirect('/')
  }

  const areas = await getTrainingAreas()

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Nuevo Funcionario</h1>
        <p className="text-muted-foreground text-sm">
          Complete los datos para registrar un nuevo funcionario.
        </p>
      </div>

      <StaffFormClient mode="create" areas={areas} />
    </div>
  )
}
