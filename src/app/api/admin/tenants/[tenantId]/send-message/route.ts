import { z } from 'zod'
import { NotificationChannel } from '@prisma/client'
import { getAdminContext } from '@/shared/auth/admin-context'
import { handleApiError } from '@/shared/http/handle-api-error'
import { validateInput } from '@/shared/http/validate-input'
import { DomainError } from '@/shared/errors'
import { prisma } from '@/shared/database/prisma'
import { notificationService } from '@/domains/notifications/notification.service'
import { logAdminAction } from '@/shared/audit/admin-audit'
import { initializeDomainRuntime } from '@/app/api/_lib/runtime'

const sendMessageSchema = z.object({
  message: z.string().min(1).max(1000),
})

export async function POST(
  request: Request,
  { params }: { params: Promise<{ tenantId: string }> },
) {
  initializeDomainRuntime()
  try {
    const session = await getAdminContext(request)
    const { tenantId } = await params
    const { message } = await validateInput(request, sendMessageSchema)

    const [tenant, ownerUser] = await Promise.all([
      prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { evolutionInstanceId: true, evolutionConnected: true, phone: true },
      }),
      prisma.user.findFirst({
        where: { tenantId, role: 'OWNER' },
        select: { email: true },
      }),
    ])

    if (!tenant?.evolutionConnected || !tenant.evolutionInstanceId) {
      throw new DomainError('WhatsApp não está conectado neste tenant.', 'WHATSAPP_NOT_CONNECTED', 400)
    }

    const recipient = ownerUser?.email
      ? await prisma.customer.findFirst({
          where: { tenantId, email: ownerUser.email },
          select: { id: true, phone: true, name: true },
        })
      : null

    const phone = recipient?.phone ?? tenant.phone
    if (!phone) {
      throw new DomainError('Destinatário sem telefone cadastrado.', 'NO_PHONE', 400)
    }

    await notificationService.logAndDispatch({
      tenantId,
      customerId: recipient?.id ?? undefined,
      channel: NotificationChannel.WHATSAPP,
      template: 'admin-system-message',
      recipient: phone,
      provider: 'evolution',
      payload: { message },
    })

    await logAdminAction({
      adminUserId: session.userId,
      action: 'tenant.message_sent',
      targetType: 'Tenant',
      targetId: tenantId,
      request,
    })

    return Response.json({ ok: true })
  } catch (error) {
    return handleApiError(error)
  }
}
