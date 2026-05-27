import { createClient } from '@supabase/supabase-js'

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

// Verificar todos os users no Supabase Auth
const { data: { users }, error } = await admin.auth.admin.listUsers()
if (error) { console.log('ERRO listUsers:', error.message); process.exit(1) }

console.log('=== TODOS OS USERS SUPABASE AUTH ===')
for (const u of users) {
  console.log(`${u.email} | id=${u.id} | tenantId=${u.app_metadata?.tenantId ?? 'AUSENTE'} | role=${u.app_metadata?.role ?? 'AUSENTE'}`)
}

// Query SQL direta no banco para ver users do Prisma
const { data: prismaUsers, error: sqlErr } = await admin
  .from('User')
  .select('id, email, tenantId, role')

if (sqlErr) {
  console.log('\nSQL ERRO:', sqlErr.message)
  // Tentar com nome lowercase
  const { data: users2, error: sqlErr2 } = await admin
    .from('users')
    .select('id, email, "tenantId", role')
  if (sqlErr2) { console.log('SQL ERRO (lowercase):', sqlErr2.message) }
  else { console.log('\n=== PRISMA USERS (users) ===', JSON.stringify(users2, null, 2)) }
} else {
  console.log('\n=== PRISMA USERS (User) ===', JSON.stringify(prismaUsers, null, 2))
}
