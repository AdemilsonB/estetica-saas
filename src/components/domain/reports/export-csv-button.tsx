'use client'

import { Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { exportCsv } from '@/lib/csv'

type Props = {
  rows: Record<string, unknown>[]
  filename: string
  isLoading: boolean
}

export function ExportCsvButton({ rows, filename, isLoading }: Props) {
  return (
    <Button
      variant="outline"
      size="sm"
      disabled={isLoading || rows.length === 0}
      onClick={() => exportCsv(rows, filename)}
      className="gap-2"
    >
      <Download className="size-3.5" />
      Exportar CSV
    </Button>
  )
}
