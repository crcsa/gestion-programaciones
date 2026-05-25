'use client'

import Link from 'next/link'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

const BASE =
  'inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4'

interface IconButtonProps {
  label: string
  children: React.ReactNode
  onClick?: () => void
  href?: string
  disabled?: boolean
  /** Clases extra (p.ej. hover destructivo/verde). Sobrescriben el hover base. */
  className?: string
}

/**
 * Botón de acción cuadrado (icono) con tooltip, patrón único para las tablas.
 * Renderiza un `<Link>` si se pasa `href`, o un `<button>` con `onClick`.
 * El caller debe envolver el grupo en un `<TooltipProvider>`.
 */
export function IconButton({ label, children, onClick, href, disabled, className }: IconButtonProps) {
  const trigger = href ? (
    <Link href={href} aria-label={label} className={cn(BASE, className)} />
  ) : (
    <button type="button" onClick={onClick} disabled={disabled} aria-label={label} className={cn(BASE, className)} />
  )

  return (
    <Tooltip>
      <TooltipTrigger render={trigger}>{children}</TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}
