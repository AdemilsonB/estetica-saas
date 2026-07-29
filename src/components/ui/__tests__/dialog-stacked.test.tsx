// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'

afterEach(cleanup)

/**
 * Um Dialog aberto sobre outro precisa de `modal={false}` para não deixar
 * `aria-hidden` preso na raiz do app, mas o Radix não renderiza `DialogOverlay`
 * nesse modo — o de cima ficava sem fundo nenhum e os dois formulários apareciam
 * igualmente nítidos. `stacked` devolve o fundo escurecido.
 */
describe('DialogContent empilhado', () => {
  it('renderiza um fundo escurecido próprio quando modal={false}', () => {
    render(
      <Dialog open modal={false}>
        <DialogContent stacked>
          <DialogHeader>
            <DialogTitle>Novo cliente</DialogTitle>
          </DialogHeader>
        </DialogContent>
      </Dialog>,
    )

    const backdrop = document.querySelector('[data-slot="dialog-stacked-backdrop"]')
    expect(backdrop).not.toBeNull()
    expect(backdrop?.className).toContain('bg-black/40')
    expect(backdrop?.className).toContain('backdrop-blur-sm')
  })

  it('fica acima do dialog de baixo', () => {
    render(
      <Dialog open modal={false}>
        <DialogContent stacked>
          <DialogHeader>
            <DialogTitle>Novo cliente</DialogTitle>
          </DialogHeader>
        </DialogContent>
      </Dialog>,
    )

    const content = document.querySelector('[data-slot="dialog-content"]')
    expect(content?.className).toContain('z-60')
  })

  it('sem stacked, mantém o overlay padrão e não cria o fundo extra', () => {
    render(
      <Dialog open>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo agendamento</DialogTitle>
          </DialogHeader>
        </DialogContent>
      </Dialog>,
    )

    expect(document.querySelector('[data-slot="dialog-stacked-backdrop"]')).toBeNull()
    expect(document.querySelector('[data-slot="dialog-overlay"]')).not.toBeNull()
    expect(screen.getByText('Novo agendamento')).toBeInTheDocument()
  })
})
