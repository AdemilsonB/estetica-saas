// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { ReportProfessionalFilter } from '../report-professional-filter'

vi.mock('@/hooks/iam/use-team', () => ({
  useTeamMembers: () => ({
    data: [
      { id: 'u1', name: 'Ana' },
      { id: 'u2', name: 'Bruno' },
    ],
  }),
}))

describe('ReportProfessionalFilter', () => {
  it('mostra o rótulo padrão "Todos os profissionais" quando value = all', () => {
    render(<ReportProfessionalFilter value="all" onChange={() => {}} />)
    expect(screen.getByText('Todos os profissionais')).toBeInTheDocument()
  })
})
