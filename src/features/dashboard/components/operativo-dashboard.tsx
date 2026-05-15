import type { Area } from '@/types/areas'
import { BancoSangreOperativoDashboard } from './operativo/banco-sangre-operativo-dashboard'
import { ComercialOperativoDashboard } from './operativo/comercial-operativo-dashboard'
import { ConductorDashboard } from './operativo/conductor-dashboard'

interface Props {
  staffId: string
  area: Area
}

/**
 * Router del dashboard operativo: según el área del colaborador renderiza el
 * variant diferenciado por perfil. Cada variant es async y carga sus propios
 * datos por-staff.
 */
export function OperativoDashboard({ staffId, area }: Props) {
  switch (area) {
    case 'banco_sangre':
      return <BancoSangreOperativoDashboard staffId={staffId} />
    case 'comercial':
      return <ComercialOperativoDashboard staffId={staffId} />
    case 'logistica':
      return <ConductorDashboard staffId={staffId} />
  }
}
