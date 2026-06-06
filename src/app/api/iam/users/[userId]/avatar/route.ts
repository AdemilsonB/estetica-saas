import { iamService } from '@/domains/iam/iam.service'
import { ensurePermission, PERMISSIONS } from '@/shared/auth/permissions'
import { getSessionContext } from '@/shared/auth/session'
import { handleApiError } from '@/shared/http/handle-api-error'
import { initializeDomainRuntime } from '@/app/api/_lib/runtime'
import { supabaseAdmin } from '@/integrations/supabase/admin'
import { ValidationError } from '@/shared/errors'

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const MAX_SIZE_BYTES = 2 * 1024 * 1024 // 2 MB
const BUCKET = 'professional-avatars'

type Params = { params: Promise<{ userId: string }> }

export async function POST(request: Request, { params }: Params) {
  initializeDomainRuntime()
  try {
    const session = await getSessionContext(request)
    ensurePermission(session, PERMISSIONS.users.manage)

    const { userId } = await params

    const formData = await request.formData()
    const file = formData.get('file')

    if (!(file instanceof File)) {
      throw new ValidationError('Campo "file" obrigatório.')
    }
    if (!ALLOWED_TYPES.includes(file.type)) {
      throw new ValidationError('Formato inválido. Use jpg, png ou webp.')
    }
    if (file.size > MAX_SIZE_BYTES) {
      throw new ValidationError('Arquivo muito grande. Máximo 2 MB.')
    }

    const ext = file.type.split('/')[1]!.replace('jpeg', 'jpg')
    const path = `${session.tenantId}/${userId}/avatar.${ext}`

    const arrayBuffer = await file.arrayBuffer()
    const { error: uploadError } = await supabaseAdmin.storage
      .from(BUCKET)
      .upload(path, arrayBuffer, { contentType: file.type, upsert: true })

    if (uploadError) throw new Error(`Erro no upload: ${uploadError.message}`)

    const { data: publicUrlData } = supabaseAdmin.storage.from(BUCKET).getPublicUrl(path)
    const avatarUrl = publicUrlData.publicUrl

    await iamService.updateMember(session.tenantId, session.userId, userId, { avatarUrl })

    return Response.json({ avatarUrl })
  } catch (error) {
    return handleApiError(error)
  }
}
