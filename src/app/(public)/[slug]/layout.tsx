import type { ReactNode } from 'react'
import { notFound } from 'next/navigation'

import { getPublicVitrine } from '@/domains/scheduling/public-booking.service'

export default async function SlugLayout({
  children,
  params,
}: {
  children: ReactNode
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  // Mesma entrada de cache da página: o tenant é resolvido uma única vez por render.
  const data = await getPublicVitrine(slug)
  if (!data) notFound()

  const bg = data.tenant.branding?.backgroundColor ?? '#fafafa'
  const fg = data.tenant.branding?.foregroundColor ?? '#1a1a1a'

  return (
    <div className="min-h-dvh" style={{ backgroundColor: bg, color: fg }}>
      {children}
    </div>
  )
}
