import { requireAccess } from '@/features/auth/lib/require-access'
import { getMyAgendaData } from '@/features/my-agenda/actions/my-agenda-actions'
import { MyAgendaClient } from '@/features/my-agenda/components/my-agenda-client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default async function MiAgendaPage() {
  const { role } = await requireAccess({ roles: ['operativo', 'admin', 'admin_area', 'comercial'] })
  const data = await getMyAgendaData()

  if (!data) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Mi agenda</h1>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Sin perfil de colaborador asociado</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>
              Tu cuenta no esta vinculada a un colaborador en el directorio. Esta vista
              solo aplica a usuarios que ejecutan campanas o turnos en sede.
            </p>
            <p>
              Si crees que es un error, contacta al administrador para vincular tu
              perfil con un registro de colaborador.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return <MyAgendaClient data={data} currentRole={role} />
}
