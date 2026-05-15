'use client'

import { usePathname } from 'next/navigation'
import Link from 'next/link'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { useBreadcrumbOverrides } from './breadcrumb-context'

const ROUTE_LABELS: Record<string, string> = {
  personal: 'Personal',
  campanas: 'Campañas',
  turnos: 'Turnos en Sede',
  configuracion: 'Configuración',
  usuarios: 'Usuarios',
  nuevo: 'Nuevo',
  editar: 'Editar',
  'mi-agenda': 'Mi Agenda',
  'mi-calendario': 'Mi Calendario',
  empresas: 'Empresas',
  horas: 'Horas',
  reportes: 'Reportes',
  disponibilidad: 'Disponibilidad',
  auditoria: 'Auditoría',
  vehiculos: 'Vehículos',
}

export function Breadcrumbs() {
  const pathname = usePathname()
  const segments = pathname.split('/').filter(Boolean)
  const ctx = useBreadcrumbOverrides()
  const overrides = ctx?.overrides ?? {}

  if (segments.length === 0) {
    return (
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbPage>Gestión de Programaciones CRCSA</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
    )
  }

  return (
    <Breadcrumb>
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbLink render={<Link href="/" />}>Inicio</BreadcrumbLink>
        </BreadcrumbItem>
        {segments.map((segment, index) => {
          const href = '/' + segments.slice(0, index + 1).join('/')
          const isLast = index === segments.length - 1
          const label = overrides[segment] ?? ROUTE_LABELS[segment] ?? segment

          return (
            <span key={href} className="flex items-center gap-2">
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                {isLast ? (
                  <BreadcrumbPage>{label}</BreadcrumbPage>
                ) : (
                  <BreadcrumbLink render={<Link href={href} />}>{label}</BreadcrumbLink>
                )}
              </BreadcrumbItem>
            </span>
          )
        })}
      </BreadcrumbList>
    </Breadcrumb>
  )
}
