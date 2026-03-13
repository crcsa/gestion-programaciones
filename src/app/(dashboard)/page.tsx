import { createClient } from '@/lib/supabase/server'
import { db } from '@/lib/db'
import { profiles } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { StatCard } from '@/components/data-display/stat-card'
import { Users, Megaphone, CalendarDays, Clock } from 'lucide-react'
import type { Role } from '@/types/roles'
import { ROLE_LABELS } from '@/types/roles'

export default async function DashboardPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  let role: Role | null = null
  if (user) {
    const [profile] = await db
      .select({ role: profiles.role })
      .from(profiles)
      .where(eq(profiles.id, user.id))
      .limit(1)
    role = (profile?.role as Role) ?? null
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        {role && (
          <p className="text-muted-foreground">Bienvenido — Vista de {ROLE_LABELS[role]}</p>
        )}
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Personal Activo"
          value="—"
          icon={Users}
          description="Módulo pendiente"
        />
        <StatCard
          title="Campañas esta semana"
          value="—"
          icon={Megaphone}
          description="Módulo pendiente"
        />
        <StatCard
          title="Turnos programados"
          value="—"
          icon={CalendarDays}
          description="Módulo pendiente"
        />
        <StatCard
          title="Horas extra pendientes"
          value="—"
          icon={Clock}
          description="Módulo pendiente"
        />
      </div>
    </div>
  )
}
