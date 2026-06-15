import Link from 'next/link'
import { CheckCircle } from 'lucide-react'
import { Badge } from '@/components/ui/badge'

interface ActivationBadgeProps {
  href: string
}

export function ActivationBadge({ href }: ActivationBadgeProps) {
  return (
    <Link href={href}>
      <Badge
        variant="secondary"
        className="cursor-pointer gap-1 bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900/30 dark:text-green-400 dark:hover:bg-green-900/50"
      >
        <CheckCircle className="size-3" />
        Ativo
      </Badge>
    </Link>
  )
}
