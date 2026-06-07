'use client'

import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { useServices } from '@/hooks/scheduling/use-services'

type Props = {
  selectedIds: string[]
  onChange: (ids: string[]) => void
}

export function MemberServicesSelector({ selectedIds, onChange }: Props) {
  const { data: services = [], isLoading } = useServices()
  const activeServices = services.filter((s) => s.active)

  function toggle(serviceId: string) {
    if (selectedIds.includes(serviceId)) {
      onChange(selectedIds.filter((id) => id !== serviceId))
    } else {
      onChange([...selectedIds, serviceId])
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-6 w-full" />
        ))}
      </div>
    )
  }

  if (activeServices.length === 0) {
    return (
      <p className="text-sm text-slate-400">
        Nenhum serviço ativo cadastrado. Crie serviços em{' '}
        <span className="font-medium">Serviços</span>.
      </p>
    )
  }

  return (
    <div className="max-h-52 overflow-y-auto rounded-xl border border-slate-200 divide-y divide-slate-100">
      {activeServices.map((service) => (
        <label
          key={service.id}
          className="flex cursor-pointer items-center gap-3 px-4 py-2.5 hover:bg-slate-50"
        >
          <Checkbox
            id={`svc-${service.id}`}
            checked={selectedIds.includes(service.id)}
            onCheckedChange={() => toggle(service.id)}
          />
          <span className="text-sm text-slate-800">{service.name}</span>
        </label>
      ))}
    </div>
  )
}
