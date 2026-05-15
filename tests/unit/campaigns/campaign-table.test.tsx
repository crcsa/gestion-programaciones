import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { CampaignTable } from '@/features/campaigns/components/campaign-table'
import type { CampaignListItem } from '@/features/campaigns/actions/campaign-actions'

// Mock next/link to a simple anchor
vi.mock('next/link', () => ({
  default: ({
    href,
    children,
    className,
    'aria-label': ariaLabel,
  }: {
    href: string
    children: React.ReactNode
    className?: string
    'aria-label'?: string
  }) => (
    <a href={href} className={className} aria-label={ariaLabel}>
      {children}
    </a>
  ),
}))

// Mock tooltip to avoid portal issues in jsdom
vi.mock('@/components/ui/tooltip', () => ({
  Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipTrigger: ({
    children,
    render,
  }: {
    children: React.ReactNode
    render?: React.ReactElement
  }) => {
    if (render) return <>{render}{children}</>
    return <>{children}</>
  },
  TooltipContent: () => null,
  TooltipProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

const makeCampaign = (overrides: Partial<CampaignListItem> = {}): CampaignListItem => ({
  id: 'id-1',
  code: 'CMP-001',
  municipality: 'Bogotá',
  campaignDate: '2026-03-17',
  size: 'M',
  modality: 'corporativa',
  status: 'tentativa',
  expectedDonations: 50,
  companyName: 'Empresa SA',
  createdAt: new Date('2026-01-01'),
  ...overrides,
})

const mockData: CampaignListItem[] = [
  makeCampaign({ id: 'id-1', code: 'CMP-001', municipality: 'Bogotá' }),
  makeCampaign({
    id: 'id-2',
    code: 'CMP-002',
    municipality: 'Medellín',
    status: 'confirmada',
  }),
]

describe('CampaignTable', () => {
  it('renders table rows for each campaign item', () => {
    render(
      <CampaignTable
        data={mockData}
        total={2}
        page={1}
        onPageChange={vi.fn()}
        onEdit={vi.fn()}
      />
    )

    expect(screen.getByText('CMP-001')).toBeDefined()
    expect(screen.getByText('CMP-002')).toBeDefined()
  })

  it('shows code for each campaign', () => {
    render(
      <CampaignTable
        data={mockData}
        total={2}
        page={1}
        onPageChange={vi.fn()}
        onEdit={vi.fn()}
      />
    )

    expect(screen.getByText('CMP-001')).toBeDefined()
    expect(screen.getByText('CMP-002')).toBeDefined()
  })

  it('shows municipality for each campaign', () => {
    render(
      <CampaignTable
        data={mockData}
        total={2}
        page={1}
        onPageChange={vi.fn()}
        onEdit={vi.fn()}
      />
    )

    expect(screen.getByText('Bogotá')).toBeDefined()
    expect(screen.getByText('Medellín')).toBeDefined()
  })

  it('shows CampaignStatusBadge for each row', () => {
    render(
      <CampaignTable
        data={mockData}
        total={2}
        page={1}
        onPageChange={vi.fn()}
        onEdit={vi.fn()}
      />
    )

    expect(screen.getByText('Tentativa')).toBeDefined()
    expect(screen.getByText('Confirmada')).toBeDefined()
  })

  it('renders Ver links for each row', () => {
    render(
      <CampaignTable
        data={mockData}
        total={2}
        page={1}
        onPageChange={vi.fn()}
        onEdit={vi.fn()}
      />
    )

    const verLinks = screen.getAllByRole('link', { name: 'Ver detalle' })
    expect(verLinks).toHaveLength(2)
    expect(verLinks[0].getAttribute('href')).toBe('/campanas/id-1')
  })

  it('calls onEdit when Editar is clicked (only for tentativa)', () => {
    const onEdit = vi.fn()

    render(
      <CampaignTable
        data={mockData}
        total={2}
        page={1}
        onPageChange={vi.fn()}
        onEdit={onEdit}
      />
    )

    // Only CMP-001 has status tentativa
    const editButtons = screen.getAllByRole('button', { name: 'Editar' })
    expect(editButtons).toHaveLength(1)

    fireEvent.click(editButtons[0])
    expect(onEdit).toHaveBeenCalledWith(mockData[0])
  })

  it('shows empty state when no data', () => {
    render(
      <CampaignTable
        data={[]}
        total={0}
        page={1}
        onPageChange={vi.fn()}
        onEdit={vi.fn()}
      />
    )

    expect(screen.getByText('No hay campañas registradas')).toBeDefined()
  })

  it('shows pagination when there are multiple pages', () => {
    render(
      <CampaignTable
        data={mockData}
        total={50}
        page={2}
        onPageChange={vi.fn()}
        onEdit={vi.fn()}
      />
    )

    expect(screen.getByRole('button', { name: 'Página anterior' })).toBeDefined()
    expect(screen.getByRole('button', { name: 'Página siguiente' })).toBeDefined()
  })

  it('calls onPageChange when Siguiente is clicked', () => {
    const onPageChange = vi.fn()

    render(
      <CampaignTable
        data={mockData}
        total={50}
        page={1}
        onPageChange={onPageChange}
        onEdit={vi.fn()}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: 'Página siguiente' }))
    expect(onPageChange).toHaveBeenCalledWith(2)
  })

  it('disables Anterior button on first page', () => {
    render(
      <CampaignTable
        data={mockData}
        total={50}
        page={1}
        onPageChange={vi.fn()}
        onEdit={vi.fn()}
      />
    )

    const anteriorBtn = screen.getByRole('button', { name: 'Página anterior' }) as HTMLButtonElement
    expect(anteriorBtn.disabled).toBe(true)
  })

  it('does not show pagination when total fits in one page', () => {
    render(
      <CampaignTable
        data={mockData}
        total={2}
        page={1}
        onPageChange={vi.fn()}
        onEdit={vi.fn()}
      />
    )

    expect(screen.queryByRole('button', { name: 'Página anterior' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Página siguiente' })).toBeNull()
  })

  it('shows dash when companyName is null', () => {
    const dataWithNull = [makeCampaign({ companyName: null })]

    render(
      <CampaignTable
        data={dataWithNull}
        total={1}
        page={1}
        onPageChange={vi.fn()}
        onEdit={vi.fn()}
      />
    )

    expect(screen.getByText('—')).toBeDefined()
  })
})
