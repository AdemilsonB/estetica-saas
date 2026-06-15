import Link from 'next/link'
import { CheckCircle } from 'lucide-react'
import { Badge } from '@/components/ui/badge'

interface ActivationBadgeProps {
  href?: string
}

const badgeClass =
  'gap-1 bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'

export function ActivationBadge({ href }: ActivationBadgeProps) {
  const badge = (
    <Badge variant="secondary" className={href ? `cursor-pointer ${badgeClass} hover:bg-green-200 dark:hover:bg-green-900/50` : badgeClass}>
      <CheckCircle className="size-3" aria-hidden />
      Ativo
    </Badge>
  )

  if (!href) return badge

  return (
    <Link href={href} aria-label="Ver item ativado">
      {badge}
    </Link>
  )
}
