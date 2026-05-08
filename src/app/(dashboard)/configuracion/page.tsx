import { redirect } from 'next/navigation'
import { getConfigItems } from '@/features/configuration/actions/config-actions'
import { ConfigFormClient } from '@/features/configuration/components/config-form-client'

export default async function ConfiguracionPage() {
  let items
  try {
    items = await getConfigItems()
  } catch {
    redirect('/')
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Configuración</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Parametros laborales y reglas de negocio del sistema. Cambios se aplican a las
          próximas validaciones de asignación.
        </p>
      </div>

      <ConfigFormClient initialItems={items} />
    </div>
  )
}
