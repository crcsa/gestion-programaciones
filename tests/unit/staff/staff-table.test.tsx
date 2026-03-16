import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { StaffTable } from '@/features/staff/components/staff-table'
import type { StaffMember } from '@/lib/db/schema/staff-members'

// Mock next/link to a simple anchor
vi.mock('next/link', () => ({
  default: ({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) => (
    <a href={href} className={className}>{children}</a>
  ),
}))

const mockStaff: StaffMember[] = [
  {
    id: 'id-1',
    profileId: null,
    firstName: 'Carlos',
    lastName: 'Pérez',
    cedula: '12345678',
    phone: null,
    email: 'carlos@example.com',
    staffProfile: 'bacteriologo',
    contractType: 'indefinido',
    weeklyHours: 44,
    defaultShift: 'diurno_completo',
    hireDate: null,
    isActive: true,
    notes: null,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  },
  {
    id: 'id-2',
    profileId: null,
    firstName: 'María',
    lastName: 'López',
    cedula: '87654321',
    phone: null,
    email: 'maria@example.com',
    staffProfile: 'tecnico',
    contractType: 'fijo',
    weeklyHours: 40,
    defaultShift: 'noche',
    hireDate: null,
    isActive: false,
    notes: null,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  },
]

describe('StaffTable', () => {
  it('renders table rows for each staff member', () => {
    render(
      <StaffTable
        data={mockStaff}
        total={2}
        page={1}
        onPageChange={vi.fn()}
      />
    )

    expect(screen.getByText('Carlos Pérez')).toBeDefined()
    expect(screen.getByText('María López')).toBeDefined()
  })

  it('shows cedula for each staff member', () => {
    render(
      <StaffTable
        data={mockStaff}
        total={2}
        page={1}
        onPageChange={vi.fn()}
      />
    )

    expect(screen.getByText('12345678')).toBeDefined()
    expect(screen.getByText('87654321')).toBeDefined()
  })

  it('shows profile labels in Spanish', () => {
    render(
      <StaffTable
        data={mockStaff}
        total={2}
        page={1}
        onPageChange={vi.fn()}
      />
    )

    expect(screen.getByText('Bacteriólogo')).toBeDefined()
    expect(screen.getByText('Técnico')).toBeDefined()
  })

  it('shows status badges', () => {
    render(
      <StaffTable
        data={mockStaff}
        total={2}
        page={1}
        onPageChange={vi.fn()}
      />
    )

    expect(screen.getByText('Activo')).toBeDefined()
    expect(screen.getByText('Inactivo')).toBeDefined()
  })

  it('renders action links for each row', () => {
    render(
      <StaffTable
        data={mockStaff}
        total={2}
        page={1}
        onPageChange={vi.fn()}
      />
    )

    const verLinks = screen.getAllByText('Ver')
    const editLinks = screen.getAllByText('Editar')

    expect(verLinks).toHaveLength(2)
    expect(editLinks).toHaveLength(2)

    expect(verLinks[0].getAttribute('href')).toBe('/personal/id-1')
    expect(editLinks[0].getAttribute('href')).toBe('/personal/id-1/editar')
  })

  it('shows empty state when no data', () => {
    render(
      <StaffTable
        data={[]}
        total={0}
        page={1}
        onPageChange={vi.fn()}
      />
    )

    expect(screen.getByText('No hay personal registrado')).toBeDefined()
  })

  it('does not show pagination when total fits in one page', () => {
    render(
      <StaffTable
        data={mockStaff}
        total={2}
        page={1}
        onPageChange={vi.fn()}
      />
    )

    expect(screen.queryByText('Anterior')).toBeNull()
    expect(screen.queryByText('Siguiente')).toBeNull()
  })

  it('shows pagination when there are multiple pages', () => {
    render(
      <StaffTable
        data={mockStaff}
        total={50}
        page={2}
        onPageChange={vi.fn()}
      />
    )

    expect(screen.getByText('Anterior')).toBeDefined()
    expect(screen.getByText('Siguiente')).toBeDefined()
  })

  it('calls onPageChange when Anterior is clicked', () => {
    const onPageChange = vi.fn()

    render(
      <StaffTable
        data={mockStaff}
        total={50}
        page={2}
        onPageChange={onPageChange}
      />
    )

    fireEvent.click(screen.getByText('Anterior'))
    expect(onPageChange).toHaveBeenCalledWith(1)
  })

  it('calls onPageChange when Siguiente is clicked', () => {
    const onPageChange = vi.fn()

    render(
      <StaffTable
        data={mockStaff}
        total={50}
        page={1}
        onPageChange={onPageChange}
      />
    )

    fireEvent.click(screen.getByText('Siguiente'))
    expect(onPageChange).toHaveBeenCalledWith(2)
  })

  it('disables Anterior button on first page', () => {
    render(
      <StaffTable
        data={mockStaff}
        total={50}
        page={1}
        onPageChange={vi.fn()}
      />
    )

    const anteriorBtn = screen.getByText('Anterior').closest('button')
    expect(anteriorBtn?.disabled).toBe(true)
  })

  it('disables Siguiente button on last page', () => {
    render(
      <StaffTable
        data={mockStaff}
        total={40}
        page={2}
        onPageChange={vi.fn()}
      />
    )

    const siguienteBtn = screen.getByText('Siguiente').closest('button')
    expect(siguienteBtn?.disabled).toBe(true)
  })
})
