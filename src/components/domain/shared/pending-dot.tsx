import { cn } from '@/lib/utils'

interface PendingDotProps {
  label?: string
  className?: string
}

/** Bolinha âmbar de pendência de ativação. Não é dispensável — reflete estado real. */
export function PendingDot({ label = 'Pendente', className }: PendingDotProps) {
  return (
    <span
      role="status"
      aria-label={label}
      title={label}
      className={cn('inline-block size-2 shrink-0 rounded-full bg-amber-500', className)}
    />
  )
}
