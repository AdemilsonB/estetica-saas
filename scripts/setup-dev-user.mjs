/**
 * Script de setup do usuario de desenvolvimento.
 * Cria o tenant e usuario no banco, e atualiza o app_metadata no Supabase.
 *
 * Uso: node scripts/setup-dev-user.mjs
 */

import { createClient } from '@supabase/supabase-js'
import pg from 'pg'
import { randomUUID } from 'crypto'
import { readFileSync } from 'fs'

// Carregar .env.local manualmente
const envLocal = readFileSync('.env.local', 'utf-8')
const env = {}
for (const line of envLocal.split('\n')) {
  const [key, ...rest] = line.split('=')
  if (key && rest.length) env[key.trim()] = rest.join('=').trim()
}

const SUPABASE_URL = env.SUPABASE_URL || 'https://vcbkcwcgejukjjagcleh.supabase.co'
const SUPABASE_SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_KEY
const DATABASE_URL = env.DATABASE_URL

const TARGET_EMAIL = 'ademilsonbertolin2002@gmail.com'
const BUSINESS_NAME = 'SaaS Estética Dev'
const USER_NAME = 'Ademilson Bertolin'

if (!SUPABASE_SERVICE_KEY) {
  console.error('SUPABASE_SERVICE_ROLE_KEY nao encontrado no .env.local')
  process.exit(1)
}

const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
})

// 1. Buscar usuario no Supabase Auth
console.log(`\n1. Buscando usuario ${TARGET_EMAIL} no Supabase Auth...`)
const { data: { users }, error: listErr } = await admin.auth.admin.listUsers()
if (listErr) { console.error('Erro ao listar users:', listErr.message); process.exit(1) }

const authUser = users.find(u => u.email === TARGET_EMAIL)
if (!authUser) { console.error('Usuario nao encontrado no Supabase Auth. Verifique o email.'); process.exit(1) }

console.log(`   ✓ userId = ${authUser.id}`)
console.log(`   ✓ app_metadata atual = ${JSON.stringify(authUser.app_metadata)}`)

// Verificar se ja tem tenant
if (authUser.app_metadata?.tenantId) {
  console.log('\n⚠️  Usuario ja tem tenantId:', authUser.app_metadata.tenantId)
  console.log('Nenhuma acao necessaria.')
  process.exit(0)
}

// 2. Criar tenant e usuario no banco via SQL direto
console.log('\n2. Criando tenant e usuario no banco Prisma...')

const client = new pg.Client({ connectionString: DATABASE_URL })
await client.connect()

// Gerar IDs estilo cuid (simplificado para o script)
function cuid() {
  const timestamp = Date.now().toString(36)
  const random = Math.random().toString(36).substring(2, 15)
  return `c${timestamp}${random}`
}

const tenantId = cuid()
const slug = BUSINESS_NAME.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').slice(0, 60)
const brandingConfig = JSON.stringify({ primaryColor: '#191919', logoUrl: null, displayName: BUSINESS_NAME })

// Criar Tenant
const tenantRes = await client.query(
  `INSERT INTO "Tenant" (id, name, slug, plan, "brandingConfig", "createdAt", "updatedAt")
   VALUES ($1, $2, $3, 'free', $4::jsonb, NOW(), NOW())
   ON CONFLICT (slug) DO UPDATE SET "updatedAt" = NOW()
   RETURNING id`,
  [tenantId, BUSINESS_NAME, slug, brandingConfig]
)
const actualTenantId = tenantRes.rows[0].id
console.log(`   ✓ Tenant criado: id=${actualTenantId}, slug=${slug}`)

// Permissoes de OWNER
const ownerPermissions = JSON.stringify([
  'appointments:view','appointments:create','appointments:edit','appointments:delete',
  'customers:view','customers:create','customers:edit','customers:delete',
  'financial:view','financial:create','financial:edit',
  'users:view','users:manage',
  'settings:view','settings:edit'
])

// Criar User (id = UUID do Supabase Auth)
await client.query(
  `INSERT INTO "User" (id, "tenantId", email, name, role, permissions, "createdAt", "updatedAt")
   VALUES ($1, $2, $3, $4, 'OWNER', $5::text[], NOW(), NOW())
   ON CONFLICT (id) DO UPDATE SET "tenantId" = EXCLUDED."tenantId", "updatedAt" = NOW()`,
  [authUser.id, actualTenantId, authUser.email, USER_NAME, [
    'appointments:view','appointments:create','appointments:edit','appointments:delete',
    'customers:view','customers:create','customers:edit','customers:delete',
    'financial:view','financial:create','financial:edit',
    'users:view','users:manage',
    'settings:view','settings:edit'
  ]]
)
console.log(`   ✓ User criado: id=${authUser.id}, tenantId=${actualTenantId}, role=OWNER`)

await client.end()

// 3. Atualizar app_metadata no Supabase
console.log('\n3. Atualizando app_metadata no Supabase...')
const { error: updateErr } = await admin.auth.admin.updateUserById(authUser.id, {
  app_metadata: {
    tenantId: actualTenantId,
    role: 'OWNER',
    permissions: [
      'appointments:view','appointments:create','appointments:edit','appointments:delete',
      'customers:view','customers:create','customers:edit','customers:delete',
      'financial:view','financial:create','financial:edit',
      'users:view','users:manage',
      'settings:view','settings:edit'
    ]
  }
})
if (updateErr) {
  console.error('Erro ao atualizar app_metadata:', updateErr.message)
  process.exit(1)
}
console.log('   ✓ app_metadata atualizado com sucesso')

// 4. Verificar resultado
console.log('\n4. Verificando resultado final...')
const { data: { user: updated } } = await admin.auth.admin.getUserById(authUser.id)
console.log('   app_metadata agora:', JSON.stringify(updated.app_metadata))

console.log('\n✅ Usuario configurado com sucesso!')
console.log(`   Email: ${TARGET_EMAIL}`)
console.log(`   TenantId: ${actualTenantId}`)
console.log(`   Role: OWNER`)
console.log('\n⚠️  IMPORTANTE: Faca logout e login novamente no navegador para atualizar o JWT.')
