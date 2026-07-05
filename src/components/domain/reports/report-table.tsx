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

function HeaderHint({ header, hint }: { header: string; hint: string }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`O que é ${header}`}
          className="text-slate-400 hover:text-slate-600"
        >
          <HelpCircle className="size-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-64 text-xs text-slate-600" side="top">
        {hint}
      </PopoverContent>
    </Popover>
  )
}

function cellValue(col: ReportColumn, row: Record<string, unknown>) {
  return col.format ? col.format(row[col.key]) : String(row[col.key] ?? '—')
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

  const [firstCol, ...restCols] = columns

  return (
    <>
      {/* Mobile — cards empilhados, sem depender de scroll horizontal */}
      <div className="space-y-2 sm:hidden">
        {rows.map((row, i) => (
          <div key={Object.values(row).join('-') + i} className="rounded-2xl border border-border bg-white p-3">
            <p className="text-sm font-semibold text-slate-900">{cellValue(firstCol, row)}</p>
            <dl className="mt-2 space-y-1">
              {restCols.map((col) => (
                <div key={col.key} className="flex items-center justify-between text-xs">
                  <dt className="inline-flex items-center gap-1 text-slate-500">
                    {col.header}
                    {col.headerHint && <HeaderHint header={col.header} hint={col.headerHint} />}
                  </dt>
                  <dd className="tabular-nums font-medium text-slate-700">{cellValue(col, row)}</dd>
                </div>
              ))}
            </dl>
          </div>
        ))}
      </div>

      {/* Desktop/tablet — tabela tradicional */}
      <div className="hidden overflow-x-auto rounded-2xl border border-border sm:block">
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
                  <span className="inline-flex items-center gap-1">
                    {col.header}
                    {col.headerHint && <HeaderHint header={col.header} hint={col.headerHint} />}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {rows.map((row, i) => (
              <tr key={Object.values(row).join('-') + i} className="bg-white transition hover:bg-slate-50">
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={`px-4 py-3 text-slate-700 ${col.align === 'right' ? 'text-right tabular-nums' : ''}`}
                  >
                    {cellValue(col, row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}
