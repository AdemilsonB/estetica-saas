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

function mockFetch() {
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string, init?: RequestInit) => {
      if (url.includes('/me')) {
        return Promise.resolve({ ok: false, json: () => Promise.resolve(null) })
      }
      if (url.includes('/auth') && init?.method === 'POST') {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ id: 'cust-1', name: 'Ana Souza' }) })
      }
      if (url.includes('/customers') && init?.method === 'POST') {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ id: 'cust-2', name: 'Beatriz Lima' }) })
      }
      return Promise.resolve({ ok: false, json: () => Promise.resolve(null) })
    }),
  )
}

async function renderEntrar() {
  await act(async () => {
    render(
      <Suspense fallback={null}>
        <EntrarPage params={Promise.resolve({ slug: 'salao-teste' })} />
      </Suspense>,
    )
  })
}

describe('EntrarPage', () => {
  it('ao logar com sucesso, redireciona para a vitrine pública (/[slug])', async () => {
    mockFetch()
    const user = userEvent.setup()

    await renderEntrar()

    await user.type(await screen.findByLabelText('CPF'), '12345678901')
    await user.click(screen.getByRole('button', { name: /^entrar$/i }))

    await waitFor(() => expect(replaceMock).toHaveBeenCalledWith('/salao-teste'))
  })

  it('oferece a opção de criar conta nova, e ao cadastrar redireciona para a vitrine pública', async () => {
    mockFetch()
    const user = userEvent.setup()

    await renderEntrar()

    await user.click(await screen.findByRole('tab', { name: /primeira vez aqui/i }))

    await user.type(screen.getByLabelText(/nome completo/i), 'Beatriz Lima')
    await user.type(screen.getByLabelText('CPF *'), '98765432100')
    await user.type(screen.getByLabelText(/telefone/i), '11999998888')
    await user.type(screen.getByLabelText(/e-mail/i), 'bia@example.com')
    fireEvent.change(screen.getByLabelText(/data de nascimento \*/i), { target: { value: '1995-05-05' } })

    await user.click(screen.getByRole('button', { name: /cadastrar e continuar/i }))

    await waitFor(() => expect(replaceMock).toHaveBeenCalledWith('/salao-teste'))
  })
})
