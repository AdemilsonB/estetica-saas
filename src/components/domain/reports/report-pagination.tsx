'use client'

import { Button } from '@/components/ui/button'

type Props = {
  page: number
  pageSize: number
  total: number
  onPageChange: (page: number) => void
  isLoading?: boolean
}

export function ReportPagination({ page, pageSize, total, onPageChange, isLoading }: Props) {
  if (total <= pageSize) return null
  const inicio = (page - 1) * pageSize + 1
  const fim = Math.min(page * pageSize, total)
  const ultimaPagina = Math.ceil(total / pageSize)

  return (
    <div className="flex items-center justify-between gap-3">
      <p className="text-xs text-slate-500">
        {inicio}–{fim} de {total}
      </p>
      <div className="flex gap-2">
        <Button
          variant="outline" size="sm"
          disabled={page <= 1 || isLoading}
          onClick={() => onPageChange(page - 1)}
        >
          Anterior
        </Button>
        <Button
          variant="outline" size="sm"
          disabled={page >= ultimaPagina || isLoading}
          onClick={() => onPageChange(page + 1)}
        >
          Próxima
        </Button>
      </div>
    </div>
  )
}
