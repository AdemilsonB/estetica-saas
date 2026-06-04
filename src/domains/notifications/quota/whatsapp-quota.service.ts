import { prisma } from '@/shared/database/prisma'
import { planLimitsService } from '@/domains/billing/plan-limits.service'

export class WhatsAppQuotaService {
  async checkAndIncrement(tenantId: string): Promise<boolean> {
    const limit = await planLimitsService.get(tenantId, 'max_whatsapp_month')

    const now = new Date()
    const year = now.getFullYear()
    const month = now.getMonth() + 1

    const record = await prisma.whatsAppMonthlyUsage.upsert({
      where: { tenantId_year_month: { tenantId, year, month } },
      create: { tenantId, year, month, count: 1 },
      update: { count: { increment: 1 } },
    })

    if (limit !== 999999 && record.count > limit) {
      await prisma.whatsAppMonthlyUsage.update({
        where: { tenantId_year_month: { tenantId, year, month } },
        data: { count: { decrement: 1 } },
      })
      return false
    }

    return true
  }

  async decrement(tenantId: string): Promise<void> {
    const now = new Date()
    const year = now.getFullYear()
    const month = now.getMonth() + 1
    await prisma.whatsAppMonthlyUsage.updateMany({
      where: { tenantId, year, month, count: { gt: 0 } },
      data: { count: { decrement: 1 } },
    })
  }

  async getUsage(tenantId: string): Promise<{ used: number; limit: number; resetDate: string }> {
    const limit = await planLimitsService.get(tenantId, 'max_whatsapp_month')

    const now = new Date()
    const year = now.getFullYear()
    const month = now.getMonth() + 1

    const record = await prisma.whatsAppMonthlyUsage.findUnique({
      where: { tenantId_year_month: { tenantId, year, month } },
    })

    const nextMonth = month === 12 ? 1 : month + 1
    const nextYear = month === 12 ? year + 1 : year
    const resetDate = `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`

    return { used: record?.count ?? 0, limit, resetDate }
  }
}

export const whatsAppQuotaService = new WhatsAppQuotaService()
