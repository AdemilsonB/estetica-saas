import { getSessionContext } from '@/shared/auth/session'
import { handleApiError } from '@/shared/http/handle-api-error'
import { supabaseAdmin } from '@/integrations/supabase/admin'

const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])
const ALLOWED_ENTITY_TYPES = new Set(['services', 'packages', 'promotions', 'products'])
const MAX_SIZE = 5 * 1024 * 1024 // 5 MB

export async function POST(request: Request) {
  try {
    const session = await getSessionContext(request)
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const entityType = formData.get('entityType') as string | null
    const entityId = formData.get('entityId') as string | null

    if (!file) {
      return Response.json({ error: 'Arquivo não informado' }, { status: 400 })
    }
    if (!ALLOWED_TYPES.has(file.type)) {
      return Response.json({ error: 'Formato não suportado. Use JPEG, PNG ou WebP.' }, { status: 400 })
    }
    if (file.size > MAX_SIZE) {
      return Response.json({ error: 'Arquivo excede o limite de 5 MB.' }, { status: 400 })
    }
    if (!entityType || !ALLOWED_ENTITY_TYPES.has(entityType)) {
      return Response.json({ error: 'entityType inválido' }, { status: 400 })
    }
    if (!entityId) {
      return Response.json({ error: 'entityId não informado' }, { status: 400 })
    }

    const ext = file.name.split('.').pop() ?? 'jpg'
    const path = `${session.tenantId}/${entityType}/${entityId}/${Date.now()}.${ext}`
    const bytes = await file.arrayBuffer()

    const { error } = await supabaseAdmin.storage
      .from('service-images')
      .upload(path, bytes, { contentType: file.type, upsert: true })

    if (error) {
      return Response.json({ error: 'Falha no upload. Tente novamente.' }, { status: 500 })
    }

    const { data: { publicUrl } } = supabaseAdmin.storage
      .from('service-images')
      .getPublicUrl(path)

    return Response.json({ url: publicUrl })
  } catch (error) {
    return handleApiError(error)
  }
}
