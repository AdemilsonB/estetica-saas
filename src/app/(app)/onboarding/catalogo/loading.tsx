import { Skeleton } from '@/components/ui/skeleton'

export default function OnboardingCatalogoLoading() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-8 space-y-8">
      {/* Stepper placeholder */}
      <div className="flex items-center gap-2">
        {[1, 2, 3, 4].map((n) => (
          <div key={n} className="flex items-center gap-2 flex-1 last:flex-none">
            <Skeleton className="size-8 rounded-full shrink-0" />
            {n < 4 && <Skeleton className="h-0.5 flex-1" />}
          </div>
        ))}
      </div>

      {/* Título e descrição */}
      <div className="space-y-2">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </div>

      {/* Grid de cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="rounded-lg border p-4 space-y-3">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-5 w-full" />
            <Skeleton className="h-4 w-3/4" />
            <div className="flex items-center justify-between pt-2">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-8 w-16" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
