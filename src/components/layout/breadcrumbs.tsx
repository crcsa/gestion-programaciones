'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ChevronRight } from 'lucide-react'

const SEGMENT_LABELS: Record<string, string> = {
  personal: 'Personal',
  campanas: 'Campañas',
  nueva: 'Nueva',
  nuevo: 'Nuevo',
  importar: 'Importar',
  sede: 'Sede',
  semanal: 'Semanal',
  programacion: 'Programación',
  reportes: 'Reportes',
  horas: 'Horas',
  mensuales: 'Mensuales',
  directorio: 'Directorio',
  configuracion: 'Configuración',
  roles: 'Roles',
  parametros: 'Parámetros',
  disponibilidad: 'Disponibilidad',
}

export function Breadcrumbs() {
  const pathname = usePathname()

  if (pathname === '/') return null

  const segments = pathname.split('/').filter(Boolean)

  return (
    <nav className="flex items-center gap-1 text-sm text-muted-foreground">
      <Link href="/" className="hover:text-foreground">
        Inicio
      </Link>
      {segments.map((segment, index) => {
        const href = '/' + segments.slice(0, index + 1).join('/')
        const isLast = index === segments.length - 1
        const label = SEGMENT_LABELS[segment] ?? segment

        return (
          <span key={href} className="flex items-center gap-1">
            <ChevronRight className="h-3 w-3" />
            {isLast ? (
              <span className="font-medium text-foreground">{label}</span>
            ) : (
              <Link href={href} className="hover:text-foreground">
                {label}
              </Link>
            )}
          </span>
        )
      })}
    </nav>
  )
}
