// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { useState } from 'react'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'

import { CurrencyInput } from '@/components/ui/currency-input'
import { PercentageInput } from '@/components/ui/percentage-input'
import { NumberInput } from '@/components/ui/number-input'

afterEach(cleanup)

/** Envelope controlado: reproduz o uso real (o pai guarda o valor cru como string). */
function Controlled({
  Component,
  initial = '',
  onValue,
}: {
  Component: typeof CurrencyInput | typeof PercentageInput | typeof NumberInput
  initial?: string
  onValue?: (v: string) => void
}) {
  const [value, setValue] = useState(initial)
  return (
    <>
      <Component
        aria-label="campo"
        value={value}
        onChange={(v: string) => {
          setValue(v)
          onValue?.(v)
        }}
      />
      <span data-testid="raw">{value === '' ? '(vazio)' : value}</span>
    </>
  )
}

function type(input: HTMLElement, text: string) {
  fireEvent.change(input, { target: { value: text } })
}

describe('CurrencyInput', () => {
  it('forma o valor com os centavos primeiro conforme se digita', () => {
    render(<Controlled Component={CurrencyInput} />)
    const input = screen.getByLabelText('campo')

    type(input, '9')
    expect(input).toHaveValue('0,09')

    type(input, '0,09' + '0')
    expect(input).toHaveValue('0,90')

    type(input, '0,90' + '0')
    expect(input).toHaveValue('9,00')

    type(input, '9,00' + '0')
    expect(input).toHaveValue('90,00')
    expect(screen.getByTestId('raw')).toHaveTextContent('90.00')
  })

  it('formata milhar e centavos: 35098 vira 350,98', () => {
    render(<Controlled Component={CurrencyInput} />)
    const input = screen.getByLabelText('campo')
    type(input, '35098')
    expect(input).toHaveValue('350,98')
    expect(screen.getByTestId('raw')).toHaveTextContent('350.98')
  })

  it('esvazia por completo em vez de voltar para zero', () => {
    render(<Controlled Component={CurrencyInput} initial="90.00" />)
    const input = screen.getByLabelText('campo')
    expect(input).toHaveValue('90,00')

    type(input, '')
    expect(input).toHaveValue('')
    expect(screen.getByTestId('raw')).toHaveTextContent('(vazio)')
  })

  it('aceita zero explícito (cortesia) como valor válido', () => {
    const onValue = vi.fn()
    render(<Controlled Component={CurrencyInput} onValue={onValue} />)
    type(screen.getByLabelText('campo'), '0')
    expect(onValue).toHaveBeenLastCalledWith('0.00')
    expect(screen.getByLabelText('campo')).toHaveValue('0,00')
  })

  it('mostra o prefixo R$ fora do input, onde não pode ser apagado', () => {
    render(<Controlled Component={CurrencyInput} initial="12.34" />)
    expect(screen.getByText('R$')).toBeInTheDocument()
    // O prefixo não faz parte do conteúdo editável.
    expect(screen.getByLabelText('campo')).toHaveValue('12,34')
  })

  it('ignora qualquer caractere que não seja dígito', () => {
    render(<Controlled Component={CurrencyInput} />)
    const input = screen.getByLabelText('campo')
    type(input, 'R$ abc1,2x')
    expect(input).toHaveValue('0,12')
  })

  it('sincroniza quando o valor muda por fora do campo', () => {
    function Externo() {
      const [value, setValue] = useState('10.00')
      return (
        <>
          <CurrencyInput aria-label="campo" value={value} onChange={setValue} />
          <button type="button" onClick={() => setValue('0.00')}>
            cortesia
          </button>
        </>
      )
    }
    render(<Externo />)
    expect(screen.getByLabelText('campo')).toHaveValue('10,00')
    fireEvent.click(screen.getByText('cortesia'))
    expect(screen.getByLabelText('campo')).toHaveValue('0,00')
  })

  it('limita a quantidade de dígitos para não estourar o Decimal do banco', () => {
    render(<Controlled Component={CurrencyInput} />)
    const input = screen.getByLabelText('campo')
    type(input, '1234567890123456')
    // 12 dígitos => 10 casas inteiras + 2 decimais
    expect(screen.getByTestId('raw')).toHaveTextContent('1234567890.12')
  })
})

describe('PercentageInput', () => {
  it('aceita decimal e mantém o sufixo fora do input', () => {
    render(<Controlled Component={PercentageInput} />)
    const input = screen.getByLabelText('campo')
    type(input, '12,5')
    expect(screen.getByTestId('raw')).toHaveTextContent('12.5')
    expect(screen.getByText('%')).toBeInTheDocument()
  })

  it('esvazia por completo em vez de voltar para zero', () => {
    render(<Controlled Component={PercentageInput} initial="30" />)
    const input = screen.getByLabelText('campo')
    type(input, '')
    expect(input).toHaveValue('')
    expect(screen.getByTestId('raw')).toHaveTextContent('(vazio)')
  })

  it('recusa valor acima do teto', () => {
    render(<Controlled Component={PercentageInput} initial="50" />)
    const input = screen.getByLabelText('campo')
    type(input, '150')
    expect(screen.getByTestId('raw')).toHaveTextContent('50')
  })
})

describe('NumberInput', () => {
  it('permite limpar o campo por completo', () => {
    render(<Controlled Component={NumberInput} initial="5" />)
    const input = screen.getByLabelText('campo')
    type(input, '')
    expect(input).toHaveValue('')
    expect(screen.getByTestId('raw')).toHaveTextContent('(vazio)')
  })

  it('só aceita dígitos e remove zeros à esquerda', () => {
    render(<Controlled Component={NumberInput} />)
    const input = screen.getByLabelText('campo')
    type(input, '007a')
    expect(input).toHaveValue('7')
  })

  it('preserva o zero isolado', () => {
    render(<Controlled Component={NumberInput} />)
    type(screen.getByLabelText('campo'), '0')
    expect(screen.getByTestId('raw')).toHaveTextContent('0')
  })

  it('respeita min e max', () => {
    function ComLimites() {
      const [value, setValue] = useState('5')
      return (
        <>
          <NumberInput aria-label="campo" min={1} max={10} value={value} onChange={setValue} />
          <span data-testid="raw">{value}</span>
        </>
      )
    }
    render(<ComLimites />)
    const input = screen.getByLabelText('campo')
    type(input, '99')
    expect(screen.getByTestId('raw')).toHaveTextContent('5')
    type(input, '0')
    expect(screen.getByTestId('raw')).toHaveTextContent('5')
    type(input, '8')
    expect(screen.getByTestId('raw')).toHaveTextContent('8')
  })
})
