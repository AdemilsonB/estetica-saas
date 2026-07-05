import { HelpCircle } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

export type ReportColumn = {
  key: string
  header: string
  headerHint?: string
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

  const hasManyColumns = columns.length > 3

  return (
    <div className="space-y-1.5">
      {hasManyColumns && (
        <p className="px-1 text-xs text-slate-400 sm:hidden">← arraste a tabela para o lado para ver mais →</p>
      )}
      <div className="relative overflow-hidden rounded-2xl border border-border">
        <div className="overflow-x-auto">
          <table className="min-w-120 w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                {columns.map((col, i) => (
                  <th
                    key={col.key}
                    className={`px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500 ${
                      col.align === 'right' ? 'text-right' : 'text-left'
                    } ${i === 0 ? 'sticky left-0 z-10 bg-slate-50' : ''}`}
                  >
                    <span className="inline-flex items-center gap-1">
                      {col.header}
                      {col.headerHint && (
                        <Popover>
                          <PopoverTrigger asChild>
                            <button
                              type="button"
                              aria-label={`O que é ${col.header}`}
                              className="text-slate-400 hover:text-slate-600"
                            >
                              <HelpCircle className="size-3.5" />
                            </button>
                          </PopoverTrigger>
                          <PopoverContent className="w-64 text-xs text-slate-600" side="top">
                            {col.headerHint}
                          </PopoverContent>
                        </Popover>
                      )}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {rows.map((row, i) => (
                <tr key={Object.values(row).join('-') + i} className="group bg-white transition hover:bg-slate-50">
                  {columns.map((col, j) => (
                    <td
                      key={col.key}
                      className={`px-4 py-3 text-slate-700 ${
                        col.align === 'right' ? 'text-right tabular-nums' : ''
                      } ${j === 0 ? 'sticky left-0 z-10 bg-white group-hover:bg-slate-50' : ''}`}
                    >
                      {col.format ? col.format(row[col.key]) : String(row[col.key] ?? '—')}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {hasManyColumns && (
          <div className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-white to-transparent sm:hidden" />
        )}
      </div>
    </div>
  )
}
