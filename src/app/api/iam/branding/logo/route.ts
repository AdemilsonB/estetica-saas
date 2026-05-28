import { supabaseAdmin } from '@/integrations/supabase/admin'
import { getSessionContext } from '@/shared/auth/session'
import { ValidationError } from '@/shared/errors'
import { handleApiError } from '@/shared/http/handle-api-error'

const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/svg+xml']
const MAX_BYTES = 2 * 1024 * 1024 // 2MB

export async function POST(req: Request) {
  try {
    const session = await getSessionContext(req)

    const formData = await req.formData()
    const file = formData.get('logo')

    if (!(file instanceof File)) {
      throw new ValidationError('Campo logo ausente ou inválido.')
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      throw new ValidationError('Formato não suportado. Use PNG, JPG ou SVG.')
    }

    if (file.size > MAX_BYTES) {
      throw new ValidationError('Arquivo excede 2MB.')
    }

    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    const ext =
      file.type === 'image/svg+xml' ? 'svg' : file.type === 'image/png' ? 'png' : 'jpg'
    const path = `${session.tenantId}/logo.${ext}`

    const { error } = await supabaseAdmin.storage.from('logos').upload(path, buffer, {
      contentType: file.type,
      upsert: true,
    })

    if (error) throw new Error(`Upload falhou: ${error.message}`)

    const { data } = supabaseAdmin.storage.from('logos').getPublicUrl(path)

    return Response.json({ logoUrl: data.publicUrl }, { status: 201 })
  } catch (error) {
    return handleApiError(error)
  }
}
