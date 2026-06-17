import type { ReactNode } from 'react'
import { notFound } from 'next/navigation'
import { AtSign, MessageCircle } from 'lucide-react'
import { HamburgerMenuButton } from '@/components/domain/vitrine/hamburger-menu-button'

type TenantMeta = {
  name: string
  slug: string
  instagramUrl?: string | null
  phone?: string | null
  whatsappEnabled?: boolean
  branding?: {
    logoUrl?: string | null
    primaryColor?: string | null
    accentColor?: string | null
    backgroundColor?: string | null
    foregroundColor?: string | null
  } | null
}

async function fetchTenantMeta(slug: string): Promise<TenantMeta | null> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  try {
    const res = await fetch(`${baseUrl}/api/public/${encodeURIComponent(slug)}`, {
      next: { revalidate: 300 },
    })
    if (!res.ok) return null
    return res.json() as Promise<TenantMeta>
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
  const tenant = await fetchTenantMeta(slug)
  if (!tenant) notFound()

  const bg = tenant.branding?.backgroundColor ?? '#fafafa'
  const primary = tenant.branding?.primaryColor ?? '#7C3AED'
  const fg = tenant.branding?.foregroundColor ?? '#1a1a1a'
  const whatsappUrl =
    tenant.whatsappEnabled && tenant.phone
      ? `https://wa.me/55${tenant.phone.replace(/\D/g, '')}`
      : null

  return (
    <div style={{ backgroundColor: bg, color: fg, minHeight: '100vh' }}>
      <header
        className="sticky top-0 z-40 border-b"
        style={{ backgroundColor: bg, borderColor: tenant.branding?.accentColor ?? '#e5e5e5' }}
      >
        <div className="mx-auto flex max-w-3xl items-center gap-2 px-3 py-2.5">
          {/* Hambúrguer */}
          <HamburgerMenuButton />

          {/* Logo */}
          {tenant.branding?.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={tenant.branding.logoUrl}
              alt={tenant.name}
              className="size-8 rounded-lg object-contain"
            />
          ) : (
            <div
              className="flex size-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold text-white"
              style={{ backgroundColor: primary }}
            >
              {tenant.name[0]?.toUpperCase()}
            </div>
          )}

          <span className="flex-1 truncate text-sm font-semibold">{tenant.name}</span>

          {/* Links sociais */}
          <div className="flex items-center gap-1">
            {tenant.instagramUrl && (
              <a
                href={tenant.instagramUrl}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Instagram"
                className="flex size-9 items-center justify-center rounded-full hover:bg-black/5 transition-colors"
              >
                <AtSign className="size-4" />
              </a>
            )}
            {whatsappUrl && (
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="WhatsApp"
                className="flex size-9 items-center justify-center rounded-full hover:bg-black/5 transition-colors"
              >
                <MessageCircle className="size-4" />
              </a>
            )}
          </div>
        </div>
      </header>

      {children}
    </div>
  )
}
