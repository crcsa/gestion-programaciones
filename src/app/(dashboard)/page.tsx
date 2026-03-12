import { StatCard } from '@/components/data-display/stat-card'
import { Users, Megaphone, Calendar, Clock } from 'lucide-react'

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Dashboard</h1>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Personal Activo"
          value="0"
          icon={<Users className="h-5 w-5" />}
          description="Empleados registrados"
        />
        <StatCard
          title="Campañas del Mes"
          value="0"
          icon={<Megaphone className="h-5 w-5" />}
          description="Campañas programadas"
        />
        <StatCard
          title="Turnos Sede"
          value="0"
          icon={<Calendar className="h-5 w-5" />}
          description="Turnos esta semana"
        />
        <StatCard
          title="Horas Extras"
          value="0h"
          icon={<Clock className="h-5 w-5" />}
          description="Promedio semanal"
        />
      </div>
    </div>
  )
}
