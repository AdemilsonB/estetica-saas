import { z } from 'zod'
import { prisma } from '@/shared/database/prisma'
import { publicBookingRepository } from '@/domains/scheduling/public-booking.repository'
import { verifyPublicSession, COOKIE_NAME } from '@/shared/auth/public-session'
import { supabaseAdmin } from '@/integrations/supabase/admin'
import { handleApiError } from '@/shared/http/handle-api-error'
import { checkRateLimit } from '@/shared/rate-limit/public-rate-limit'

const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])
const MAX_SIZE = 2 * 1024 * 1024 // 2 MB
const BUCKET = 'customer-avatars'

function getSessionFromRequest(req: Request) {
  const cookieHeader = req.headers.get('cookie') ?? ''
  const match = cookieHeader.match(new RegExp(`${COOKIE_NAME}=([^;]+)`))
  if (!match?.[1]) return null
  return verifyPublicSession(match[1])
}

type RouteContext = { params: Promise<{ slug: string }> }

function unauthorized() {
  return Response.json({ error: { code: 'UNAUTHORIZED', message: 'Sessão inválida.' } }, { status: 401 })
}

/** Upload da foto de perfil do cliente logado. Reseta o enquadramento (nova foto = crop inválido). */
export async function POST(req: Request, context: RouteContext) {
  try {
    const session = getSessionFromRequest(req)
    if (!session) return unauthorized()

    const { slug } = await context.params
    const tenant = await publicBookingRepository.findTenantBySlug(slug)
    if (session.tenantId !== tenant.id) return unauthorized()

    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
    const ipLimit = await checkRateLimit({
      ip,
      action: 'customer_avatar_upload',
      maxPerWindow: 10,
      windowMs: 15 * 60 * 1000,
    })
    if (!ipLimit.allowed) {
      return Response.json(
        { error: { code: 'RATE_LIMIT_EXCEEDED', message: 'Muitas tentativas. Aguarde 15 minutos.' } },
        { status: 429 },
      )
    }

    const formData = await req.formData()
    const file = formData.get('file')
    if (!(file instanceof File)) {
      return Response.json({ error: { code: 'VALIDATION_ERROR', message: 'Arquivo não informado.' } }, { status: 400 })
    }
    if (!ALLOWED_TYPES.has(file.type)) {
      return Response.json({ error: { code: 'VALIDATION_ERROR', message: 'Use JPEG, PNG ou WebP.' } }, { status: 400 })
    }
    if (file.size > MAX_SIZE) {
      return Response.json({ error: { code: 'VALIDATION_ERROR', message: 'Arquivo excede 2 MB.' } }, { status: 400 })
    }

    const ext = file.type.split('/')[1]!.replace('jpeg', 'jpg')
    const path = `${tenant.id}/${session.customerId}/avatar-${Date.now()}.${ext}`
    const bytes = await file.arrayBuffer()

    let { error } = await supabaseAdmin.storage
      .from(BUCKET)
      .upload(path, bytes, { contentType: file.type, upsert: true })

    if (error) {
      // Bucket pode não existir no ambiente — tenta criar e repete uma vez.
      await supabaseAdmin.storage
        .createBucket(BUCKET, { public: true, fileSizeLimit: MAX_SIZE })
        .catch(() => {})
      const retry = await supabaseAdmin.storage
        .from(BUCKET)
        .upload(path, bytes, { contentType: file.type, upsert: true })
      error = retry.error
    }

    if (error) {
      console.error('[me/avatar] Supabase error:', error.message)
      return Response.json({ error: { code: 'STORAGE_ERROR', message: 'Falha no upload.' } }, { status: 502 })
    }

    const {
      data: { publicUrl },
    } = supabaseAdmin.storage.from(BUCKET).getPublicUrl(path)

    await prisma.customer.update({
      where: { id: session.customerId, tenantId: tenant.id },
      data: { avatarUrl: publicUrl, avatarCropX: null, avatarCropY: null, avatarCropZoom: null },
    })

    return Response.json({ avatarUrl: publicUrl })
  } catch (error) {
    return handleApiError(error)
  }
}

const CropSchema = z.object({
  cropX: z.number().min(0).max(1),
  cropY: z.number().min(0).max(1),
  cropZoom: z.number().min(1).max(5),
})

/** Salva o enquadramento (zoom/posição) da foto de perfil já enviada. */
export async function PATCH(req: Request, context: RouteContext) {
  try {
    const session = getSessionFromRequest(req)
    if (!session) return unauthorized()

    const { slug } = await context.params
    const tenant = await publicBookingRepository.findTenantBySlug(slug)
    if (session.tenantId !== tenant.id) return unauthorized()

    const parsed = CropSchema.safeParse(await req.json())
    if (!parsed.success) {
      return Response.json({ error: { code: 'VALIDATION_ERROR', message: 'Dados inválidos.' } }, { status: 422 })
    }

    await prisma.customer.update({
      where: { id: session.customerId, tenantId: tenant.id },
      data: {
        avatarCropX: parsed.data.cropX,
        avatarCropY: parsed.data.cropY,
        avatarCropZoom: parsed.data.cropZoom,
      },
    })

    return Response.json({ ok: true })
  } catch (error) {
    return handleApiError(error)
  }
}
