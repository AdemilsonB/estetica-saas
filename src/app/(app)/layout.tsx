import type { ReactNode } from 'react'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { unstable_cache } from 'next/cache'
import { AppShell } from '@/components/app/app-shell'
import { brandingRepository } from '@/domains/iam/branding.repository'
import { buildCssVariables } from '@/lib/branding/build-css-variables'
import { env } from '@/shared/config/env'

async function getTenantIdFromSession(): Promise<string | null> {
  try {
    const cookieStore = await cookies()
    const supabase = createServerClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll() {},
      },
    })
    const { data: { user } } = await supabase.auth.getUser()
    return user?.app_metadata?.tenantId ?? null
  } catch {
    return null
  }
}

async function getBrandingCached(tenantId: string) {
  const cached = unstable_cache(
    () => brandingRepository.findByTenant(tenantId),
    [`branding-${tenantId}`],
    { tags: [`branding-${tenantId}`], revalidate: 3600 },
  )
  return cached()
}

export default async function AppLayout({ children }: { children: ReactNode }) {
  const tenantId = await getTenantIdFromSession()

  let brandingCss = ''

  if (tenantId) {
    const config = await getBrandingCached(tenantId)
    if (config) {
      const { styleTag } = buildCssVariables({
        primaryColor: config.primaryColor,
        secondaryColor: config.secondaryColor,
        accentColor: config.accentColor,
        backgroundColor: config.backgroundColor,
        fontFamily: config.fontFamily as 'inter' | 'manrope' | 'geist' | 'dm-sans' | 'plus-jakarta-sans' | 'lato',
        borderRadius: config.borderRadius as 'none' | 'medium' | 'full',
        colorScheme: config.colorScheme as 'light' | 'dark',
        logoUrl: config.logoUrl,
      })
      brandingCss = styleTag
    }
  }

  return (
    <>
      {brandingCss && (
        <style dangerouslySetInnerHTML={{ __html: `:root { ${brandingCss} }` }} />
      )}
      <AppShell>{children}</AppShell>
    </>
  )
}
