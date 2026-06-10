import { createHmac } from 'crypto'
import { prisma } from '@/shared/database/prisma'
import { env } from '@/shared/config/env'
import { classifyIntent } from '@/domains/notifications/chatbot/intent-classifier'
import { evolutionProvider } from '@/domains/notifications/providers/evolution.provider'

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
  if (env.EVOLUTION_WEBHOOK_SECRET) {
    const signature = request.headers.get('x-evolution-signature') ?? ''
    const body = await request.text()
    const expected = createHmac('sha256', env.EVOLUTION_WEBHOOK_SECRET).update(body).digest('hex')
    if (signature !== expected) return null
    try {
      return JSON.parse(body) as EvolutionMessageEvent
    } catch {
      return null
    }
  }
  try {
    return (await request.json()) as EvolutionMessageEvent
  } catch {
    return null
  }
}

export async function POST(request: Request): Promise<Response> {
  const event = await parseBody(request)
  if (!event) return new Response(null, { status: 401 })

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
      offHoursEnabled: true,
      offHoursMessage: true,
      evolutionInstanceId: true,
    },
  })

  if (!tenant || !tenant.autoReplyEnabled) return new Response(null, { status: 200 })

  const phone = event.data.key.remoteJid.replace('@s.whatsapp.net', '')
  const instanceName = tenant.evolutionInstanceId!

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
    const msg = tenant.autoReplyMessage ?? 'Olá! Para agendar seu horário, acesse: {booking_link}'
    response = msg.replace('{booking_link}', bookingLink)
  }

  if (intent === 'CANCEL') {
    response = `Para cancelar seu agendamento acesse: ${bookingLink} ou ligue para o salão.`
  }

  if (intent === 'PRICE') {
    const svcs = await prisma.service.findMany({
      where: { tenantId: tenant.id, active: true },
      select: { name: true, price: true, priceType: true },
      orderBy: { name: 'asc' },
      take: 10,
    })
    const lines = svcs.map(s =>
      s.priceType === 'ON_CONSULTATION'
        ? `• ${s.name}: Sob consulta`
        : `• ${s.name}: R$ ${Number(s.price).toFixed(2).replace('.', ',')}`
    )
    response = lines.length > 0
      ? `Nossos serviços:\n${lines.join('\n')}`
      : 'Entre em contato para conhecer nossos serviços.'
  }

  if (intent === 'HOURS') {
    if (!businessHours) {
      response = 'Entre em contato para saber nosso horário de funcionamento.'
    } else {
      const dayNames: Record<string, string> = {
        sun: 'Dom', mon: 'Seg', tue: 'Ter', wed: 'Qua',
        thu: 'Qui', fri: 'Sex', sat: 'Sáb',
      }
      const lines = Object.entries(businessHours)
        .filter(([, v]) => v.enabled)
        .map(([k, v]) => `${dayNames[k] ?? k}: ${v.open}–${v.close}`)
      response = lines.length > 0
        ? `Nosso horário de funcionamento:\n${lines.join('\n')}`
        : 'Entre em contato para saber nosso horário.'
    }
  }

  if (!response) return new Response(null, { status: 200 })

  await evolutionProvider.sendRawText(instanceName, phone, response).catch(() => {})

  await prisma.whatsAppAutoReplyLog.create({
    data: { tenantId: tenant.id, phone, intent },
  })

  return new Response(null, { status: 200 })
}
