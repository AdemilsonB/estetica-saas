import { prisma } from '@/shared/database/prisma'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const phone = searchParams.get('phone')

  if (!phone || phone.replace(/\D/g, '').length < 10) {
    return Response.json({ name: null })
  }

  const digits = phone.replace(/\D/g, '')

  const customer = await prisma.customer.findFirst({
    where: { phone: digits, isBlocked: false },
    select: { name: true },
    orderBy: { createdAt: 'desc' },
  })

  return Response.json({ name: customer?.name ?? null })
}
