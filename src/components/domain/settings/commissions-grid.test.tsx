// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'

const upsertMutate = vi.fn()
const applyToRoleMutate = vi.fn()

vi.mock('@/hooks/settings/use-commissions', () => ({
  useCommissions: () => ({ data: [{ serviceId: 's1', professionalId: 'p1', rate: 10 }] }),
  useUpsertCommission: () => ({ mutate: upsertMutate }),
  useApplyCommissionToRole: () => ({ mutate: applyToRoleMutate }),
}))
vi.mock('@/hooks/iam/use-roles', () => ({
  useRoles: () => ({ data: [{ id: 'r1', name: 'Profissional' }] }),
}))

const services = [{ id: 's1', name: 'Corte' }, { id: 's2', name: 'Barba' }]
const professionals = [{ id: 'p1', name: 'Ana', role: 'PROFESSIONAL' }]

vi.mock('@tanstack/react-query', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-query')>()
  return {
    ...actual,
    useQuery: ({ queryKey }: { queryKey: unknown[] }) => {
      if (queryKey[0] === 'services') return { data: services }
      if (queryKey[0] === 'professionals') return { data: professionals }
      return { data: undefined }
    },
  }
})

import { CommissionsGrid } from './commissions-grid'

afterEach(cleanup)

describe('CommissionsGrid — layout dual mobile/desktop', () => {
  beforeEach(() => {
    upsertMutate.mockReset()
    applyToRoleMutate.mockReset()
  })

  it('renderiza cards por profissional (mobile) e a tabela (desktop) com o mesmo dado', () => {
    render(<CommissionsGrid />)

    // Nome do profissional aparece nos dois layouts (card mobile + linha da tabela desktop)
    expect(screen.getAllByText('Ana')).toHaveLength(2)
    // Todos os inputs de comissão (2 serviços × 1 profissional × 2 layouts = 4)
    expect(screen.getAllByDisplayValue('10')).toHaveLength(2)
  })

  it('salva a comissão ao editar um input e sair do campo (layout mobile, primeiro input encontrado)', () => {
    render(<CommissionsGrid />)
    const inputs = screen.getAllByPlaceholderText('—')
    fireEvent.change(inputs[0], { target: { value: '25' } })
    fireEvent.blur(inputs[0], { target: { value: '25' } })
    expect(upsertMutate).toHaveBeenCalledWith(
      expect.objectContaining({ rate: 25 }),
      expect.anything(),
    )
  })
})
