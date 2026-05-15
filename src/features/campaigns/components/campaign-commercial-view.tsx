import { getAssignedStaffForCommercial } from '../actions/campaign-actions'
import { CAMPAIGN_SIZE_COMPOSITION } from '../lib/constants'

interface CampaignCommercialViewProps {
  campaignId: string
  size: 'S' | 'S_plus' | 'M' | 'L'
}

const PROFILE_LABELS: Record<string, string> = {
  bacteriologo: 'Bacteriólogo',
  tecnico:      'Técnico',
  medico:       'Médico',
  auxiliar:     'Auxiliar',
}

export async function CampaignCommercialView({ campaignId, size }: CampaignCommercialViewProps) {
  const staff = await getAssignedStaffForCommercial(campaignId)
  const composition = CAMPAIGN_SIZE_COMPOSITION[size]
  const required = composition.bacteriologos + composition.tecnicos

  const bacteriologos = staff.filter((s) => s.staffProfile === 'bacteriologo')
  const tecnicos = staff.filter((s) => s.staffProfile === 'tecnico')

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Personal asignado (vista comercial)</h3>
        <span className="text-sm text-muted-foreground">
          {staff.length} / {required} asignados
        </span>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <CoverageBlock
          label="Bacteriólogos"
          assigned={bacteriologos.length}
          required={composition.bacteriologos}
        />
        <CoverageBlock
          label="Técnicos"
          assigned={tecnicos.length}
          required={composition.tecnicos}
        />
      </div>

      {staff.length === 0 ? (
        <p className="text-sm text-muted-foreground">No hay personal asignado aún.</p>
      ) : (
        <div className="rounded-lg border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="px-4 py-2 text-left font-medium text-muted-foreground">Nombre</th>
                <th className="px-4 py-2 text-left font-medium text-muted-foreground">Cédula</th>
                <th className="px-4 py-2 text-left font-medium text-muted-foreground">Cargo</th>
                <th className="px-4 py-2 text-center font-medium text-muted-foreground">Coord.</th>
              </tr>
            </thead>
            <tbody>
              {staff.map((s) => (
                <tr key={s.staffId} className="border-b border-border last:border-0">
                  <td className="px-4 py-2 font-medium">{s.firstName} {s.lastName}</td>
                  <td className="px-4 py-2 font-mono text-xs">{s.cedula}</td>
                  <td className="px-4 py-2 text-muted-foreground">
                    {PROFILE_LABELS[s.staffProfile] ?? s.staffProfile}
                  </td>
                  <td className="px-4 py-2 text-center">
                    {s.isCoordinator ? (
                      <span className="text-green-500 text-xs font-medium">Sí</span>
                    ) : (
                      <span className="text-muted-foreground text-xs">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

function CoverageBlock({
  label,
  assigned,
  required,
}: {
  label: string
  assigned: number
  required: number
}) {
  const complete = assigned >= required

  return (
    <div className="flex items-center justify-between rounded-md border border-border px-3 py-2">
      <span className="text-sm">{label}</span>
      <span
        className={`text-sm font-semibold ${complete ? 'text-green-600 dark:text-green-400' : 'text-yellow-600 dark:text-yellow-400'}`}
      >
        {assigned} / {required}
      </span>
    </div>
  )
}
