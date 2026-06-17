import { COOKIE_NAME } from '@/shared/auth/public-session'

export async function POST() {
  return new Response(null, {
    status: 204,
    headers: {
      'Set-Cookie': `${COOKIE_NAME}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0`,
    },
  })
}
