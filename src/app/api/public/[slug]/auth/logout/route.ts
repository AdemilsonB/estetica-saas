import { COOKIE_NAME } from '@/shared/auth/public-session'

export async function POST() {
  const isProduction = process.env.NODE_ENV === 'production'
  const secureFlag = isProduction ? '; Secure' : ''
  return new Response(null, {
    status: 204,
    headers: {
      'Set-Cookie': `${COOKIE_NAME}=; HttpOnly; SameSite=Strict; Path=/${secureFlag}; Max-Age=0`,
    },
  })
}
