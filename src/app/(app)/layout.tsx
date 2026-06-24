import type { ReactNode } from 'react'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { unstable_cache } from 'next/cache'
import { AppShell } from '@/components/app/app-shell'
import { ImpersonationBanner } from '@/components/admin/impersonation-banner'
import { SubscriptionLockedScreen } from '@/components/domain/billing/subscription-locked-screen'
import { brandingRepository } from '@/domains/iam/branding.repository'
import { buildCssVariables } from '@/lib/branding/build-css-variables'
import { iamRepository } from '@/domains/iam/iam.repository'
import { getServerSessionInfo } from '@/shared/auth/get-server-tenant-id'
import { featureGuard } from '@/domains/billing/feature-guard'

const ACTIVE_SUBSCRIPTION_STATUSES = ['TRIALING', 'ACTIVE', 'PAST_DUE']

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
  const { tenantId, isOwner } = await getServerSessionInfo()

  // Lê o pathname injetado pelo middleware via header x-pathname
  const headersList = await headers()
  const pathname = headersList.get('x-pathname') ?? ''

  let brandingCss = ''
  let logoUrl: string | null = null
  let businessName = ''
  let lockedPlan: string | null = null
  let isLocked = false

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

    if (onboardingCompleted) {
      const { plan, status } = await featureGuard.getSubscriptionState(tenantId)
      if (!ACTIVE_SUBSCRIPTION_STATUSES.includes(status)) {
        isLocked = true
        lockedPlan = plan !== 'FREE' ? plan : null
      }
    }

    if (config) {
      const { styleTag } = buildCssVariables({
        primaryColor: config.primaryColor,
        accentColor: config.accentColor,
        backgroundColor: config.backgroundColor,
        borderColor: config.borderColor ?? '#EDE9FE',
        foregroundColor: config.foregroundColor ?? '#111827',
        mutedColor: config.mutedColor ?? '#6B7280',
        fontFamily: config.fontFamily as 'inter' | 'manrope' | 'geist' | 'dm-sans' | 'plus-jakarta-sans' | 'lato',
        borderRadius: config.borderRadius as 'none' | 'medium' | 'full',
        colorScheme: config.colorScheme as 'light' | 'dark',
        logoUrl: config.logoUrl,
      })
      brandingCss = styleTag
    }
  }

  if (isLocked) {
    return (
      <>
        <ImpersonationBanner />
        <SubscriptionLockedScreen isOwner={isOwner} originalPlan={lockedPlan} />
      </>
    )
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
