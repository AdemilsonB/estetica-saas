import { Skeleton } from '@/components/ui/skeleton'

export type ReportColumn = {
  key: string
  header: string
  align?: 'left' | 'right'
  format?: (value: unknown) => string
}

type Props = {
  columns: ReportColumn[]
  rows: Record<string, unknown>[]
  isLoading: boolean
  emptyMessage?: string
}

export function ReportTable({ columns, rows, isLoading, emptyMessage = 'Nenhum dado no período.' }: Props) {
  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full rounded-xl" />
        ))}
      </div>
    )
  }

  if (rows.length === 0) {
    return (
      <p className="rounded-2xl border border-slate-100 bg-slate-50 p-8 text-center text-sm text-slate-500">
        {emptyMessage}
      </p>
    )
  }

  return (
    <div
      className="overflow-x-auto rounded-2xl border border-border"
      style={{
        maskImage: 'linear-gradient(to right, transparent, black 16px, black calc(100% - 16px), transparent)',
        WebkitMaskImage: 'linear-gradient(to right, transparent, black 16px, black calc(100% - 16px), transparent)',
      }}
    >
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-100 bg-slate-50">
            {columns.map((col) => (
              <th
                key={col.key}
                className={`px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500 ${
                  col.align === 'right' ? 'text-right' : 'text-left'
                }`}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-50">
          {rows.map((row, i) => (
            <tr key={Object.values(row).join('-') + i} className="bg-white hover:bg-slate-50 transition">
              {columns.map((col) => (
                <td
                  key={col.key}
                  className={`px-4 py-3 text-slate-700 ${
                    col.align === 'right' ? 'text-right tabular-nums' : ''
                  }`}
                >
                  {col.format ? col.format(row[col.key]) : String(row[col.key] ?? '—')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
