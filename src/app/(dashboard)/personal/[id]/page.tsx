import { notFound } from 'next/navigation'
import Link from 'next/link'
import { format } from 'date-fns'
import { getStaffById } from '@/features/staff/actions/staff-actions'
import { StaffStatusBadge } from '@/features/staff/components/staff-status-badge'
import { Button } from '@/components/ui/button'
import { STAFF_PROFILE_LABELS } from '@/features/staff/lib/constants'

interface StaffDetailPageProps {
  params: Promise<{ id: string }>
}

export default async function StaffDetailPage({ params }: StaffDetailPageProps) {
  const { id } = await params

  let staff
  try {
    staff = await getStaffById(id)
  } catch {
    notFound()
  }

  if (!staff) {
    notFound()
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {staff.firstName} {staff.lastName}
          </h1>
          <p className="text-muted-foreground text-sm">Cédula: {staff.cedula}</p>
        </div>

        <div className="flex items-center gap-2">
          <StaffStatusBadge isActive={staff.isActive} />
          <Button variant="outline" nativeButton={false} render={<Link href={`/personal/${id}/editar`} />}>
            Editar
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 rounded-lg border border-border p-4">
        <DetailRow label="Perfil" value={STAFF_PROFILE_LABELS[staff.staffProfile] ?? staff.staffProfile} />
        <DetailRow label="Horas semanales" value={`${staff.weeklyHours}h`} />
        {staff.email && <DetailRow label="Correo" value={staff.email} />}
        {staff.phone && <DetailRow label="Teléfono" value={staff.phone} />}
        {staff.hireDate && <DetailRow label="Fecha de ingreso" value={format(new Date(staff.hireDate), 'dd/MM/yyyy')} />}
      </div>

      {staff.trainingAreaIds.length > 0 && (
        <div className="rounded-lg border border-border p-4">
          <h2 className="font-semibold mb-2">Áreas de entrenamiento</h2>
          <p className="text-sm text-muted-foreground">
            {staff.trainingAreaIds.length} área(s) asignada(s)
          </p>
        </div>
      )}

      <div className="pt-2">
        <Button variant="outline" nativeButton={false} render={<Link href="/personal" />}>
          Volver al listado
        </Button>
      </div>
    </div>
  )
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</p>
      <p className="text-sm mt-0.5">{value}</p>
    </div>
  )
}
