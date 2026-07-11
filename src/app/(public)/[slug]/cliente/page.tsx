import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { verifyPublicSession, COOKIE_NAME } from '@/shared/auth/public-session'
import { prisma } from '@/shared/database/prisma'
import { publicBookingRepository } from '@/domains/scheduling/public-booking.repository'
import { isOpenNow, getWeekdayIndex } from '@/lib/business-hours'
import { CustomerHistoryClient } from './customer-history-client'

function maskCpf(cpf: string | null): string {
  if (!cpf) return '—'
  const d = cpf.replace(/\D/g, '')
  return `***.***.${d.slice(6, 9)}-${d.slice(9, 11)}`
}

export default async function ClientePage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const cookieStore = await cookies()
  const token = cookieStore.get(COOKIE_NAME)?.value ?? null
  const session = token ? verifyPublicSession(token) : null

  if (!session) {
    redirect(`/${slug}/entrar`)
  }

  let tenant: Awaited<ReturnType<typeof publicBookingRepository.findTenantBySlug>>
  try {
    tenant = await publicBookingRepository.findTenantBySlug(slug)
  } catch {
    redirect(`/${slug}/entrar`)
  }

  if (session.tenantId !== tenant.id) {
    redirect(`/${slug}/entrar`)
  }

  const customer = await prisma.customer.findFirst({
    where: { id: session.customerId, tenantId: tenant.id },
    select: {
      id: true,
      name: true,
      cpf: true,
      phone: true,
      email: true,
      birthDate: true,
      appointments: {
        where: { tenantId: tenant.id },
        orderBy: { startsAt: 'desc' },
        take: 20,
        select: {
          id: true,
          startsAt: true,
          status: true,
          price: true,
          service: { select: { name: true } },
          package: { select: { name: true } },
          professional: { select: { name: true } },
        },
      },
    },
  })

  if (!customer) {
    redirect(`/${slug}/entrar`)
  }

  const now = new Date()
  const upcoming = customer.appointments.filter(
    (a) => new Date(a.startsAt) >= now && (a.status === 'SCHEDULED' || a.status === 'CONFIRMED'),
  )
  const history = customer.appointments.filter(
    (a) => new Date(a.startsAt) < now || (a.status !== 'SCHEDULED' && a.status !== 'CONFIRMED'),
  )

  const whatsappUrl =
    tenant.whatsappContactEnabled && tenant.phone
      ? `https://wa.me/55${tenant.phone.replace(/\D/g, '')}`
      : null
  const primary = tenant.brandingConfig?.primaryColor ?? '#7C3AED'
  const timezone = tenant.timezone ?? 'America/Sao_Paulo'

  return (
    <CustomerHistoryClient
      customer={{
        id: customer.id,
        name: customer.name,
        cpf: maskCpf(customer.cpf),
        phone: customer.phone,
        email: customer.email,
        birthDate: customer.birthDate?.toISOString() ?? null,
      }}
      upcoming={upcoming.map((a) => ({
        id: a.id,
        startsAt: a.startsAt.toISOString(),
        status: a.status,
        price: Number(a.price),
        serviceName: a.service?.name ?? a.package?.name ?? '—',
        professionalName: a.professional.name,
      }))}
      history={history.map((a) => ({
        id: a.id,
        startsAt: a.startsAt.toISOString(),
        status: a.status,
        price: Number(a.price),
        serviceName: a.service?.name ?? a.package?.name ?? '—',
        professionalName: a.professional.name,
      }))}
      slug={slug}
      whatsappUrl={whatsappUrl}
      primaryColor={primary}
      business={{
        address: tenant.address,
        businessHours: tenant.businessHours,
        todayWeekdayIndex: getWeekdayIndex(timezone),
        isOpenNow: isOpenNow(tenant.businessHours, timezone),
      }}
    />
  )
}
