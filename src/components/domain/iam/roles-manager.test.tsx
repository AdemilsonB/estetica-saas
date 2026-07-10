// @vitest-environment jsdom
import { describe, it, expect, vi, beforeAll, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock('@/hooks/iam/use-roles', () => ({
  useRoles: () => ({
    data: [
      { id: 'r1', name: 'Recepção', permissions: { agenda: ['view'] }, _count: { users: 1 } },
      { id: 'r2', name: 'Esteticista', permissions: { agenda: ['view', 'edit'] }, _count: { users: 0 } },
    ],
    isLoading: false,
  }),
  useCreateRole: () => ({ mutate: vi.fn(), isPending: false }),
}))
vi.mock('@/hooks/iam/use-nav-sections', () => ({
  useNavSections: () => ({ data: [{ key: 'agenda', label: 'Agenda', actions: ['view', 'edit'] }], isLoading: false }),
}))
// RoleEditor tem muitas dependências — stub para focar no comportamento do initialRoleId.
vi.mock('./role-editor', () => ({
  RoleEditor: ({ role }: { role: { name: string } }) => <div>editor:{role.name}</div>,
}))
vi.mock('./role-delete-button', () => ({ RoleDeleteButton: () => <button>del</button> }))

import { RolesManager } from './roles-manager'

beforeAll(() => {
  global.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver
})

afterEach(cleanup)

describe('RolesManager — initialRoleId', () => {
  it('abre já editando o cargo indicado por initialRoleId', () => {
    render(<RolesManager initialRoleId="r2" />)
    expect(screen.getByText('editor:Esteticista')).toBeInTheDocument()
  })

  it('sem initialRoleId, não abre nenhum editor de cargo', () => {
    render(<RolesManager />)
    expect(screen.queryByText(/^editor:/)).not.toBeInTheDocument()
  })
})
