'use client'

import { useEffect, useState } from 'react'
import { Clock } from 'lucide-react'

type Slot = { time: string; available: boolean }

function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

type Props = {
  slug: string
  serviceId: string
  primaryColor: string
}

export function VitrineNextSlotBadge({ slug, serviceId, primaryColor }: Props) {
  const [nextTime, setNextTime] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    fetch(
      `/api/public/${encodeURIComponent(slug)}/availability?date=${todayISO()}&serviceId=${encodeURIComponent(serviceId)}`,
    )
      .then((res) => (res.ok ? (res.json() as Promise<{ slots?: Slot[] }>) : null))
      .then((data) => setNextTime(data?.slots?.find((s) => s.available)?.time ?? null))
      .catch(() => setNextTime(null))
      .finally(() => setLoading(false))
  }, [slug, serviceId])

  if (loading || !nextTime) return null

  return (
    <div
      className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold"
      style={{ borderColor: `${primaryColor}40`, color: primaryColor }}
    >
      <Clock className="size-3" />
      Próximo horário livre: hoje às {nextTime}
    </div>
  )
}
