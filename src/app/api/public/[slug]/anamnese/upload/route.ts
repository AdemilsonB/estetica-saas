import { publicBookingRepository } from '@/domains/scheduling/public-booking.repository'
import { supabaseAdmin } from '@/integrations/supabase/admin'
import { handleApiError } from '@/shared/http/handle-api-error'
import { checkRateLimit } from '@/shared/rate-limit/public-rate-limit'

const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])
const MAX_SIZE = 5 * 1024 * 1024

export async function POST(
  req: Request,
  context: { params: Promise<{ slug: string }> },
) {
  try {
    const ip =
      req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
    const ipLimit = await checkRateLimit({
      ip,
      action: 'anamnese_upload',
      maxPerWindow: 10,
      windowMs: 15 * 60 * 1000,
    })
    if (!ipLimit.allowed) {
      return Response.json(
        { error: { code: 'RATE_LIMIT_EXCEEDED', message: 'Muitas tentativas. Aguarde 15 minutos.' } },
        { status: 429 },
      )
    }

    const { slug } = await context.params
    const tenant = await publicBookingRepository.findTenantBySlug(slug)

    const formData = await req.formData()
    const file = formData.get('file') as File | null

    if (!file) return Response.json({ error: 'Arquivo não informado' }, { status: 400 })
    if (!ALLOWED_TYPES.has(file.type)) {
      return Response.json({ error: 'Use JPEG, PNG ou WebP.' }, { status: 400 })
    }
    if (file.size > MAX_SIZE) {
      return Response.json({ error: 'Arquivo excede 5 MB.' }, { status: 400 })
    }

    const ext = file.name.split('.').pop() ?? 'jpg'
    const path = `${tenant.id}/${Date.now()}.${ext}`
    const bytes = await file.arrayBuffer()

    let { error } = await supabaseAdmin.storage
      .from('anamnese-photos')
      .upload(path, bytes, { contentType: file.type, upsert: false })

    if (error) {
      // Bucket pode não existir no ambiente — tenta criar e repete uma vez
      await supabaseAdmin.storage.createBucket('anamnese-photos', {
        public: true,
        fileSizeLimit: 5 * 1024 * 1024,
      }).catch(() => {})
      const retry = await supabaseAdmin.storage
        .from('anamnese-photos')
        .upload(path, bytes, { contentType: file.type, upsert: false })
      error = retry.error
    }

    if (error) {
      console.error('[anamnese/upload] Supabase error:', error.message)
      return Response.json({ error: 'Falha no upload.' }, { status: 500 })
    }

    const { data: { publicUrl } } = supabaseAdmin.storage
      .from('anamnese-photos')
      .getPublicUrl(path)

    return Response.json({ url: publicUrl })
  } catch (error) {
    return handleApiError(error)
  }
}
