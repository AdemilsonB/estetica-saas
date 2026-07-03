import Link from 'next/link'
import { Lock } from 'lucide-react'
import { Button } from '@/components/ui/button'

type Props = {
  title: string
  description: string
}

export function LockedFeatureCard({ title, description }: Props) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-amber-200 bg-amber-50/60 p-8 text-center">
      <span className="flex size-10 items-center justify-center rounded-full bg-amber-100">
        <Lock className="size-5 text-amber-600" />
      </span>
      <p className="text-sm font-semibold text-slate-900">{title}</p>
      <p className="max-w-sm text-xs text-slate-500">{description}</p>
      <Button asChild size="sm" variant="outline" className="mt-1">
        <Link href="/configuracoes/planos">Ver planos</Link>
      </Button>
    </div>
  )
}
