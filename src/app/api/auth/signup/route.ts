import { z } from 'zod'
import { supabaseAdmin } from '@/integrations/supabase/admin'
import { validateInput } from '@/shared/http/validate-input'
import { handleApiError } from '@/shared/http/handle-api-error'
import { prisma } from '@/shared/database/prisma'
import { createClient } from '@supabase/supabase-js'
import { env } from '@/shared/config/env'

const Schema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  nomeCompleto: z.string().min(2).optional(),
  cpf: z.string().optional(),
})

async function getRequireEmailVerification() {
  try {
    const settings = await prisma.platformSettings.findUnique({ where: { id: 'singleton' } })
    return settings?.requireEmailVerification ?? false
  } catch {
    return false
  }
}

function buildUserMetadata(input: z.infer<typeof Schema>) {
  const meta: Record<string, string> = {}
  if (input.nomeCompleto) meta.full_name = input.nomeCompleto
  if (input.cpf) meta.cpf = input.cpf
  return meta
}

export async function POST(req: Request) {
  try {
    const input = await validateInput(req, Schema)

    const requireEmailVerification = await getRequireEmailVerification()
    const userMetadata = buildUserMetadata(input)

    if (requireEmailVerification) {
      const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY)
      const { error } = await supabase.auth.signUp({
        email: input.email,
        password: input.password,
        options: {
          emailRedirectTo: `${env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'}/auth/callback`,
          data: userMetadata,
        },
      })
      if (error) {
        const alreadyExists =
          error.message.toLowerCase().includes('already been registered') ||
          error.message.toLowerCase().includes('already exists') ||
          error.message.toLowerCase().includes('already registered')
        return Response.json(
          { error: alreadyExists ? 'email_taken' : error.message },
          { status: 400 },
        )
      }
      return Response.json({ requiresConfirmation: true })
    }

    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email: input.email,
      password: input.password,
      email_confirm: true,
      user_metadata: userMetadata,
    })

    if (!error) {
      return Response.json({ requiresConfirmation: false, userId: data.user.id })
    }

    const alreadyExists =
      error.message.toLowerCase().includes('already been registered') ||
      error.message.toLowerCase().includes('already exists') ||
      error.message.toLowerCase().includes('already registered')

    if (!alreadyExists) {
      return Response.json({ error: error.message }, { status: 400 })
    }

    const { data: listData } = await supabaseAdmin.auth.admin.listUsers()
    const existing = listData?.users?.find(
      (u) => u.email?.toLowerCase() === input.email.toLowerCase(),
    )

    if (!existing) {
      return Response.json({ error: 'email_taken' }, { status: 400 })
    }

    if (existing.email_confirmed_at) {
      return Response.json({ error: 'email_taken' }, { status: 400 })
    }

    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(existing.id, {
      email_confirm: true,
      password: input.password,
      user_metadata: { ...existing.user_metadata, ...userMetadata },
    })

    if (updateError) {
      return Response.json({ error: updateError.message }, { status: 400 })
    }

    return Response.json({ requiresConfirmation: false, userId: existing.id })
  } catch (error) {
    return handleApiError(error)
  }
}
