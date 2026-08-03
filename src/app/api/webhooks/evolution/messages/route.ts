import { prisma } from '@/shared/database/prisma'
import { env } from '@/shared/config/env'
import { classifyIntent } from '@/domains/notifications/chatbot/intent-classifier'
import { evolutionProvider } from '@/domains/notifications/providers/evolution.provider'
import { isValidEvolutionWebhookToken } from '@/shared/auth/evolution-webhook-token'
import { ehPedidoDeDescadastro } from '@/domains/notifications/opt-out/opt-out-keywords'
import { optOutService } from '@/domains/crm/opt-out.service'
import {
  montarRespostaBook,
  montarRespostaCancel,
  montarRespostaPrecos,
  montarRespostaHorarios,
} from '@/domains/notifications/auto-reply/auto-reply-messages'

const OPT_OUT_CONFIRMACAO =
  'Pronto! Você não receberá mais nossas promoções. ' +
  'Avisos sobre os seus horários agendados continuam chegando normalmente.'

type EvolutionMessageEvent = {
  event: string
  instance: string
  data: {
    key: {
      remoteJid: string
      fromMe: boolean
      id: string
    }
    message?: {
      conversation?: string
      extendedTextMessage?: { text: string }
    }
    messageType?: string
  }
}

type BusinessHoursEntry = { open: string; close: string; enabled: boolean }
type BusinessHours = Record<string, BusinessHoursEntry>

function extractText(event: EvolutionMessageEvent): string | null {
  const msg = event.data.message
  if (!msg) return null
  return msg.conversation ?? msg.extendedTextMessage?.text ?? null
}

function isWithinBusinessHours(businessHours: BusinessHours | null, timezone: string): boolean {
  if (!businessHours) return true

  const now = new Date()
  const dayKey = new Intl.DateTimeFormat('en-US', { weekday: 'short', timeZone: timezone })
    .format(now)
    .toLowerCase()

  const todayHours = businessHours[dayKey]
  if (!todayHours?.enabled) return false

  const timeStr = new Intl.DateTimeFormat('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: timezone,
  }).format(now)

  return timeStr >= todayHours.open && timeStr < todayHours.close
}

async function parseBody(request: Request): Promise<EvolutionMessageEvent | null> {
  try {
    return (await request.json()) as EvolutionMessageEvent
  } catch {
    return null
  }
}

export async function POST(request: Request): Promise<Response> {
  const event = await parseBody(request)
  if (!event) return new Response(null, { status: 401 })

  const token = new URL(request.url).searchParams.get('token') ?? ''
  if (!isValidEvolutionWebhookToken(event.instance, token)) {
    return new Response(null, { status: 401 })
  }

  if (event.event !== 'messages.upsert') return new Response(null, { status: 200 })
  if (event.data.key.fromMe) return new Response(null, { status: 200 })

  const text = extractText(event)
  if (!text) return new Response(null, { status: 200 })

  const tenant = await prisma.tenant.findFirst({
    where: { evolutionInstanceId: event.instance, evolutionConnected: true },
    select: {
      id: true,
      slug: true,
      timezone: true,
      businessHours: true,
      autoReplyEnabled: true,
      autoReplyIntervalHours: true,
      autoReplyMessage: true,
      autoReplyCancelMessage: true,
      autoReplyPriceIntro: true,
      autoReplyHoursIntro: true,
      offHoursEnabled: true,
      offHoursMessage: true,
      evolutionInstanceId: true,
    },
  })

  if (!tenant) return new Response(null, { status: 200 })

  const phone = event.data.key.remoteJid.replace('@s.whatsapp.net', '')
  const instanceName = tenant.evolutionInstanceId!

  // ── 1. Opt-out ───────────────────────────────────────────────────────────
  // Roda antes do gate de `autoReplyEnabled` e antes do throttle de anti-flood,
  // de propósito: descadastro não pode ser engolido por uma janela desenhada
  // para outra finalidade, nem depender de o tenant ter chatbot ligado.
  // A confirmação enviada aqui também não conta para o throttle do passo 3.
  if (ehPedidoDeDescadastro(text)) {
    await optOutService.marcarPorTelefone(tenant.id, phone, 'whatsapp_reply')
    await evolutionProvider
      .sendRawText(instanceName, phone, OPT_OUT_CONFIRMACAO)
      .catch(() => {})
    return new Response(null, { status: 200 })
  }

  // ── 2. Confirmação por resposta (1/2) ────────────────────────────────────
  // Entra aqui na Etapa 2, entre o opt-out e o chatbot.

  // ── 3. Auto-resposta / chatbot ───────────────────────────────────────────
  if (!tenant.autoReplyEnabled) return new Response(null, { status: 200 })

  const businessHours = tenant.businessHours as BusinessHours | null
  const withinHours = isWithinBusinessHours(businessHours, tenant.timezone)

  if (!withinHours) {
    if (tenant.offHoursEnabled && tenant.offHoursMessage) {
      await evolutionProvider.sendRawText(instanceName, phone, tenant.offHoursMessage).catch(() => {})
    }
    return new Response(null, { status: 200 })
  }

  const cutoff = new Date(Date.now() - tenant.autoReplyIntervalHours * 3_600_000)
  const recentLog = await prisma.whatsAppAutoReplyLog.findFirst({
    where: { tenantId: tenant.id, phone, repliedAt: { gte: cutoff } },
  })
  if (recentLog) return new Response(null, { status: 200 })

  const intent = classifyIntent(text)
  const bookingLink = `${env.NEXT_PUBLIC_APP_URL ?? ''}/agendar/${tenant.slug}`

  let response: string | null = null

  if (intent === 'BOOK' || intent === 'FALLBACK') {
    response = montarRespostaBook(tenant, bookingLink)
  }

  if (intent === 'CANCEL') {
    response = montarRespostaCancel(tenant, bookingLink)
  }

  if (intent === 'PRICE') {
    const svcs = await prisma.service.findMany({
      where: { tenantId: tenant.id, active: true },
      select: { name: true, price: true, priceType: true },
      orderBy: { name: 'asc' },
      take: 10,
    })
    response = montarRespostaPrecos(tenant, svcs)
  }

  if (intent === 'HOURS') {
    response = montarRespostaHorarios(tenant, businessHours)
  }

  if (!response) return new Response(null, { status: 200 })

  await evolutionProvider.sendRawText(instanceName, phone, response).catch(() => {})

  await prisma.whatsAppAutoReplyLog.create({
    data: { tenantId: tenant.id, phone, intent },
  })

  return new Response(null, { status: 200 })
}
