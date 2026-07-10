// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import type { ReactElement } from 'react'
import { TooltipProvider } from '@/components/ui/tooltip'
import type { TeamMember } from '@/hooks/iam/use-team'

vi.mock('@/hooks/use-current-user', () => ({ useCurrentUser: () => ({ data: { id: 'other' } }) }))
vi.mock('@/hooks/iam/use-roles', () => ({
  useRoles: () => ({
    data: [{ id: 'r1', name: 'Recepção', permissions: { agenda: ['view'], clientes: ['view', 'edit'] }, _count: { users: 1 } }],
  }),
}))
vi.mock('@/hooks/iam/use-nav-sections', () => ({
  useNavSections: () => ({
    data: [
      { key: 'agenda', label: 'Agenda', actions: ['view'] },
      { key: 'clientes', label: 'Clientes', actions: ['view', 'edit'] },
    ],
  }),
}))
vi.mock('./edit-member-modal', () => ({ EditMemberModal: () => null }))

import { TeamMemberCard } from './team-member-card'

const member: TeamMember = {
  id: 'm1',
  name: 'Ana Silva',
  email: 'ana@x.com',
  role: 'RECEPTIONIST',
  isOwner: false,
  roleId: 'r1',
  roleName: 'Recepção',
  avatarUrl: null,
  avatarCropX: null,
  avatarCropY: null,
  avatarCropZoom: null,
  bio: null,
  services: [],
  createdAt: '2026-01-01',
}

afterEach(cleanup)

function renderWithTooltip(ui: ReactElement) {
  return render(<TooltipProvider>{ui}</TooltipProvider>)
}

describe('TeamMemberCard — resumo de permissões', () => {
  it('mostra o resumo textual calculado do cargo', () => {
    renderWithTooltip(<TeamMemberCard member={member} canManage />)
    expect(screen.getByText('Pode ver Agenda, Clientes; pode editar Clientes')).toBeInTheDocument()
  })

  it('chama onViewRolePermissions com o roleId ao clicar em "Ver permissões"', () => {
    const onView = vi.fn()
    renderWithTooltip(<TeamMemberCard member={member} canManage onViewRolePermissions={onView} />)
    fireEvent.click(screen.getByRole('button', { name: 'Ver permissões' }))
    expect(onView).toHaveBeenCalledWith('r1')
  })

  it('para o dono, mostra "Acesso total" e não exibe link', () => {
    const owner: TeamMember = { ...member, isOwner: true, roleId: null, roleName: 'Dono' }
    const onView = vi.fn()
    renderWithTooltip(<TeamMemberCard member={owner} canManage onViewRolePermissions={onView} />)
    expect(screen.getByText('Acesso total a todas as telas')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Ver permissões' })).not.toBeInTheDocument()
  })
})
