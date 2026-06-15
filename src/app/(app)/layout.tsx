import type { ReactNode } from 'react'
import { cookies, headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { createServerClient } from '@supabase/ssr'
import { unstable_cache } from 'next/cache'
import { AppShell } from '@/components/app/app-shell'
import { ImpersonationBanner } from '@/components/admin/impersonation-banner'
import { brandingRepository } from '@/domains/iam/branding.repository'
import { buildCssVariables } from '@/lib/branding/build-css-variables'
import { iamRepository } from '@/domains/iam/iam.repository'
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

async function getTenantCached(tenantId: string) {
  const cached = unstable_cache(
    () => iamRepository.findTenant(tenantId),
    [`tenant-${tenantId}`],
    { tags: [`tenant-${tenantId}`], revalidate: 3600 },
  )
  return cached()
}

async function getTenantOnboardingStatus(tenantId: string): Promise<boolean> {
  try {
    const result = await iamRepository.findTenantOnboardingStatus(tenantId)
    return result?.onboardingCompleted ?? false
  } catch {
    return false
  }
}

export default async function AppLayout({ children }: { children: ReactNode }) {
  const tenantId = await getTenantIdFromSession()

  // Lê o pathname injetado pelo middleware via header x-pathname
  const headersList = await headers()
  const pathname = headersList.get('x-pathname') ?? ''

  let brandingCss = ''
  let logoUrl: string | null = null
  let businessName = ''

  if (tenantId) {
    const [config, tenant, onboardingCompleted] = await Promise.all([
      getBrandingCached(tenantId),
      getTenantCached(tenantId),
      getTenantOnboardingStatus(tenantId),
    ])

    logoUrl = config?.logoUrl ?? null
    businessName = tenant?.name ?? ''

    if (!onboardingCompleted && pathname !== '/onboarding/catalogo') {
      redirect('/onboarding/catalogo')
    }
    if (onboardingCompleted && pathname === '/onboarding/catalogo') {
      redirect('/agenda')
    }

    if (config) {
      const { styleTag } = buildCssVariables({
        primaryColor: config.primaryColor,
        accentColor: config.accentColor,
        backgroundColor: config.backgroundColor,
        borderColor: config.borderColor ?? '#e8ddd3',
        foregroundColor: config.foregroundColor ?? '#3d2b1f',
        mutedColor: config.mutedColor ?? '#8a7060',
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
      <ImpersonationBanner />
      <AppShell logoUrl={logoUrl} businessName={businessName}>
        {children}
      </AppShell>
    </>
  )
}
