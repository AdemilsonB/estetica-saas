// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { Building2 } from 'lucide-react'
import { SettingsCard } from './settings-card'

afterEach(cleanup)

describe('SettingsCard', () => {
  it('mostra a bolinha de pendência quando pending=true', () => {
    render(
      <SettingsCard icon={Building2} title="Dados do negócio" subtitle="sub" pending>
        <p>conteúdo</p>
      </SettingsCard>,
    )
    expect(screen.getByLabelText('Dados do negócio pendente')).toBeInTheDocument()
  })

  it('não mostra a bolinha quando pending é falso/ausente', () => {
    render(
      <SettingsCard icon={Building2} title="Dados do negócio" subtitle="sub">
        <p>conteúdo</p>
      </SettingsCard>,
    )
    expect(screen.queryByLabelText('Dados do negócio pendente')).not.toBeInTheDocument()
  })

  it('chama onExpand ao expandir, mas não ao recolher em seguida', () => {
    const onExpand = vi.fn()
    render(
      <SettingsCard icon={Building2} title="Dados do negócio" subtitle="sub" pending onExpand={onExpand}>
        <p>conteúdo</p>
      </SettingsCard>,
    )
    const trigger = screen.getByRole('button')
    fireEvent.click(trigger)
    expect(onExpand).toHaveBeenCalledTimes(1)
    fireEvent.click(trigger)
    expect(onExpand).toHaveBeenCalledTimes(1)
  })
})
