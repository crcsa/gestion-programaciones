import { StaffFormClient } from '@/features/staff/components/staff-form-client'

export default function NuevoFuncionarioPage() {
  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Nuevo Funcionario</h1>
        <p className="text-muted-foreground text-sm">
          Complete los datos para registrar un nuevo funcionario.
        </p>
      </div>

      <StaffFormClient mode="create" />
    </div>
  )
}
