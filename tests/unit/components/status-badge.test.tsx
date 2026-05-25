import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { StatusBadge } from '@/components/ui/status-badge'

describe('StatusBadge', () => {
  it('muestra verde y label por defecto cuando está activo', () => {
    const { container } = render(<StatusBadge isActive />)
    expect(screen.getByText('Activo')).toBeInTheDocument()
    expect(container.querySelector('.bg-green-100')).not.toBeNull()
  })

  it('muestra rojo y label por defecto cuando está inactivo', () => {
    const { container } = render(<StatusBadge isActive={false} />)
    expect(screen.getByText('Inactivo')).toBeInTheDocument()
    expect(container.querySelector('.bg-red-100')).not.toBeNull()
  })

  it('respeta labels personalizados (género femenino)', () => {
    const { rerender } = render(
      <StatusBadge isActive activeLabel="Activa" inactiveLabel="Inactiva" />,
    )
    expect(screen.getByText('Activa')).toBeInTheDocument()
    rerender(<StatusBadge isActive={false} activeLabel="Activa" inactiveLabel="Inactiva" />)
    expect(screen.getByText('Inactiva')).toBeInTheDocument()
  })
})
