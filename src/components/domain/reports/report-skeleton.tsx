import { Skeleton } from '@/components/ui/skeleton'

export function ReportSkeleton() {
  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-100 bg-white p-5 space-y-4">
        <Skeleton className="h-9 w-48" />
        <div className="flex gap-3">
          <Skeleton className="h-9 w-44" />
          <Skeleton className="h-9 w-48" />
          <Skeleton className="ml-auto h-9 w-32" />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-2xl border border-white/80 bg-white/85 p-5 shadow-sm">
            <Skeleton className="h-3 w-24 mb-3" />
            <Skeleton className="h-7 w-32" />
          </div>
        ))}
      </div>
      <div className="rounded-2xl border border-slate-100 bg-white">
        <div className="p-4 border-b border-slate-100">
          <Skeleton className="h-4 w-full" />
        </div>
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 p-4 border-b border-slate-50 last:border-0">
            <Skeleton className="h-4 flex-1" />
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 w-24" />
          </div>
        ))}
      </div>
    </div>
  )
}
