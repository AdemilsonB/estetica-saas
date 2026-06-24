import type { ReactNode } from 'react'
import { notFound } from 'next/navigation'

type TenantBranding = {
  branding?: {
    backgroundColor?: string | null
    foregroundColor?: string | null
  } | null
}

async function fetchTenantBranding(slug: string): Promise<TenantBranding | null> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  try {
    const res = await fetch(`${baseUrl}/api/public/${encodeURIComponent(slug)}`, {
      next: { revalidate: 300 },
    })
    if (!res.ok) return null
    return res.json() as Promise<TenantBranding>
  } catch {
    return null
  }
}

export default async function SlugLayout({
  children,
  params,
}: {
  children: ReactNode
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const data = await fetchTenantBranding(slug)
  if (!data) notFound()

  const bg = data.branding?.backgroundColor ?? '#fafafa'
  const fg = data.branding?.foregroundColor ?? '#1a1a1a'

  return (
    <div className="min-h-dvh" style={{ backgroundColor: bg, color: fg }}>
      {children}
    </div>
  )
}
