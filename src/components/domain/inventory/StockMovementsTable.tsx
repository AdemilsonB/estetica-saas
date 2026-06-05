'use client'

export type StockMovement = {
  id: string
  createdAt: string
  product: { name: string }
  quantity: number
  unitPrice: string | null
  totalAmount: string | null
  notes: string | null
}

type Props = {
  movements: StockMovement[]
  mode: 'purchase' | 'sale'
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatCurrency(value: string | null): string {
  if (!value) return '—'
  const num = parseFloat(value)
  if (isNaN(num)) return '—'
  return num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export function StockMovementsTable({ movements, mode }: Props) {
  if (movements.length === 0) {
    return (
      <div className="flex items-center justify-center rounded-lg border border-dashed py-12 text-sm text-slate-400">
        Nenhuma movimentação encontrada
      </div>
    )
  }

  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
            <th className="px-4 py-3">Data</th>
            <th className="px-4 py-3">Produto</th>
            <th className="px-4 py-3 text-right">Quantidade</th>
            <th className="px-4 py-3 text-right">Valor Unitário</th>
            <th className="px-4 py-3 text-right">Total</th>
            {mode === 'purchase' && <th className="px-4 py-3">Observações</th>}
          </tr>
        </thead>
        <tbody className="divide-y">
          {movements.map((m) => (
            <tr key={m.id} className="hover:bg-slate-50">
              <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                {formatDate(m.createdAt)}
              </td>
              <td className="px-4 py-3 font-medium text-slate-800">{m.product.name}</td>
              <td className="px-4 py-3 text-right">
                <span
                  className={
                    mode === 'sale' ? 'font-medium text-rose-600' : 'font-medium text-emerald-600'
                  }
                >
                  {mode === 'sale' ? '-' : '+'}
                  {m.quantity}
                </span>
              </td>
              <td className="px-4 py-3 text-right text-slate-600">{formatCurrency(m.unitPrice)}</td>
              <td className="px-4 py-3 text-right font-medium text-slate-800">
                {formatCurrency(m.totalAmount)}
              </td>
              {mode === 'purchase' && (
                <td className="px-4 py-3 text-slate-500">{m.notes ?? '—'}</td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
