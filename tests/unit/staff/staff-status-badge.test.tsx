import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { StaffStatusBadge } from '@/features/staff/components/staff-status-badge'

describe('StaffStatusBadge', () => {
  it('renders "Activo" when isActive is true', () => {
    render(<StaffStatusBadge isActive={true} />)
    expect(screen.getByText('Activo')).toBeDefined()
  })

  it('renders "Inactivo" when isActive is false', () => {
    render(<StaffStatusBadge isActive={false} />)
    expect(screen.getByText('Inactivo')).toBeDefined()
  })

  it('applies green styling when active', () => {
    const { container } = render(<StaffStatusBadge isActive={true} />)
    const badge = container.firstChild as HTMLElement
    expect(badge.className).toContain('green')
  })

  it('applies red styling when inactive', () => {
    const { container } = render(<StaffStatusBadge isActive={false} />)
    const badge = container.firstChild as HTMLElement
    expect(badge.className).toContain('red')
  })

  it('does not show "Activo" when inactive', () => {
    render(<StaffStatusBadge isActive={false} />)
    expect(screen.queryByText('Activo')).toBeNull()
  })

  it('does not show "Inactivo" when active', () => {
    render(<StaffStatusBadge isActive={true} />)
    expect(screen.queryByText('Inactivo')).toBeNull()
  })
})
