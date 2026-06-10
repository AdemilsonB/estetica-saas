import { unstable_cache } from 'next/cache'
import { getAdminContext } from '@/shared/auth/admin-context'
import { handleApiError } from '@/shared/http/handle-api-error'
import { prisma } from '@/shared/database/prisma'
import { initializeDomainRuntime } from '@/app/api/_lib/runtime'

async function computeMrrData() {
  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

  let mrr = 0
  let newPayingThisMonth = 0

  try {
    const { stripe } = await import('@/domains/billing/stripe.client')

    let hasMore = true
    let startingAfter: string | undefined

    while (hasMore) {
      const page = await stripe.subscriptions.list({
        status: 'active',
        limit: 100,
        ...(startingAfter ? { starting_after: startingAfter } : {}),
        expand: ['data.items.data.price'],
      })

      for (const sub of page.data) {
        for (const item of sub.items.data) {
          const price = item.price as { unit_amount?: number | null; recurring?: { interval?: string } }
          const amount = price.unit_amount ?? 0
          const interval = price.recurring?.interval
          if (interval === 'month') mrr += amount / 100
          else if (interval === 'year') mrr += (amount / 100) / 12
        }
        if (sub.start_date >= Math.floor(startOfMonth.getTime() / 1000)) {
          newPayingThisMonth++
        }
      }

      hasMore = page.has_more
      if (hasMore && page.data.length > 0) {
        startingAfter = page.data[page.data.length - 1].id
      }
    }
  } catch {
    // Stripe não configurado — retorna zeros
  }

  const [trialToActiveThisMonth, churnThisMonth, totalActivePaying, trialing] = await Promise.all([
    prisma.subscriptionHistory.count({
      where: {
        fromStatus: 'TRIALING',
        toStatus: 'ACTIVE',
        createdAt: { gte: startOfMonth },
      },
    }),
    prisma.subscriptionHistory.count({
      where: {
        toStatus: { in: ['CANCELLED', 'EXPIRED'] },
        fromStatus: { in: ['ACTIVE', 'TRIALING'] },
        createdAt: { gte: startOfMonth },
      },
    }),
    prisma.subscription.count({ where: { status: 'ACTIVE' } }),
    prisma.subscription.count({ where: { status: 'TRIALING' } }),
  ])

  const trialConversionRate =
    trialing + trialToActiveThisMonth > 0
      ? Math.round((trialToActiveThisMonth / (trialing + trialToActiveThisMonth)) * 100)
      : 0

  return {
    mrr: Math.round(mrr * 100) / 100,
    arr: Math.round(mrr * 12 * 100) / 100,
    newPayingThisMonth,
    churnThisMonth,
    trialToActiveThisMonth,
    totalActivePaying,
    trialing,
    trialConversionRate,
  }
}

const getCachedMrrData = unstable_cache(computeMrrData, ['admin-mrr'], { revalidate: 3600 })

export async function GET(request: Request) {
  initializeDomainRuntime()
  try {
    await getAdminContext(request)
    const data = await getCachedMrrData()
    return Response.json(data)
  } catch (error) {
    return handleApiError(error)
  }
}
