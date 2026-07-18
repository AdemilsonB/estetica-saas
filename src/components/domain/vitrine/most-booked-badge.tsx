import { Flame } from 'lucide-react'

export function MostBookedBadge({ primaryColor }: { primaryColor: string }) {
  return (
    <span
      className="inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[9px] font-medium text-white"
      style={{ backgroundColor: primaryColor }}
      title="Serviço mais agendado"
    >
      <Flame className="size-2.5" />
      Mais procurado
    </span>
  )
}
