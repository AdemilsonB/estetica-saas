// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import type { ReactElement } from 'react'
import { TooltipProvider } from '@/components/ui/tooltip'
import type { TeamMember } from '@/hooks/iam/use-team'

vi.mock('@/hooks/use-current-user', () => ({ useCurrentUser: () => ({ data: { id: 'other' } }) }))
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

describe('TeamMemberCard — links de permissões e serviços', () => {
  it('mostra apenas os links "Ver permissões" e "Configurar Serviços", sem prévia de texto', () => {
    renderWithTooltip(<TeamMemberCard member={member} canManage onViewRolePermissions={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'Ver permissões' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Configurar Serviços' })).toBeInTheDocument()
    expect(screen.queryByText('Pode ver Agenda, Clientes; pode editar Clientes')).not.toBeInTheDocument()
  })

  it('chama onViewRolePermissions com o roleId ao clicar em "Ver permissões"', () => {
    const onView = vi.fn()
    renderWithTooltip(<TeamMemberCard member={member} canManage onViewRolePermissions={onView} />)
    fireEvent.click(screen.getByRole('button', { name: 'Ver permissões' }))
    expect(onView).toHaveBeenCalledWith('r1')
  })

  it('para o dono, não exibe "Ver permissões" mas exibe "Configurar Serviços"', () => {
    const owner: TeamMember = { ...member, isOwner: true, roleId: null, roleName: 'Dono' }
    const onView = vi.fn()
    renderWithTooltip(<TeamMemberCard member={owner} canManage onViewRolePermissions={onView} />)
    expect(screen.queryByRole('button', { name: 'Ver permissões' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Configurar Serviços' })).toBeInTheDocument()
  })

  it('sem permissão de gestão e não sendo o próprio usuário, não exibe "Configurar Serviços"', () => {
    renderWithTooltip(<TeamMemberCard member={member} canManage={false} onViewRolePermissions={vi.fn()} />)
    expect(screen.queryByRole('button', { name: 'Configurar Serviços' })).not.toBeInTheDocument()
  })
})
