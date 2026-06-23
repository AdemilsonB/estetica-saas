// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { Suspense, act } from 'react'
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, afterEach } from 'vitest'
import EntrarPage from './page'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const replaceMock = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: replaceMock }),
}))

afterEach(() => {
  cleanup()
  replaceMock.mockClear()
  vi.unstubAllGlobals()
})

describe('EntrarPage', () => {
  it('ao logar com sucesso, redireciona para a página completa do cliente (/[slug]/cliente)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }))
    const user = userEvent.setup()

    await act(async () => {
      render(
        <Suspense fallback={null}>
          <EntrarPage params={Promise.resolve({ slug: 'salao-teste' })} />
        </Suspense>,
      )
    })

    await user.type(screen.getByLabelText('CPF'), '12345678901')
    fireEvent.change(screen.getByLabelText('Data de nascimento'), { target: { value: '1990-01-01' } })
    await user.click(screen.getByRole('button', { name: /entrar/i }))

    await waitFor(() => expect(replaceMock).toHaveBeenCalledWith('/salao-teste/cliente'))
  })
})
