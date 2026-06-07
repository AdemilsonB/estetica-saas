/**
 * Setup script para criar buckets no Supabase Storage.
 *
 * Uso:
 *   npx tsx scripts/setup-storage-buckets.ts
 *
 * Variáveis de ambiente necessárias:
 *   - SUPABASE_URL
 *   - SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient } from '@supabase/supabase-js'
import { z } from 'zod'

const envSchema = z.object({
  SUPABASE_URL: z.url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
})

const env = envSchema.parse(process.env)

const supabaseAdmin = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
})

interface BucketConfig {
  name: string
  isPublic: boolean
  fileSizeLimit: number // em bytes
}

const BUCKETS: BucketConfig[] = [
  {
    name: 'professional-avatars',
    isPublic: true,
    fileSizeLimit: 2 * 1024 * 1024, // 2 MB
  },
]

async function setupBuckets() {
  console.log('🚀 Iniciando setup de buckets no Supabase Storage...\n')

  for (const bucket of BUCKETS) {
    try {
      // Tenta listar para saber se existe
      const { data: existing, error: listError } = await supabaseAdmin.storage.listBuckets()

      if (listError) {
        console.error(`❌ Erro ao listar buckets: ${listError.message}`)
        process.exit(1)
      }

      const bucketExists = existing?.some((b) => b.name === bucket.name)

      if (bucketExists) {
        console.log(`✅ Bucket '${bucket.name}' já existe. Pulando...`)
      } else {
        console.log(`📦 Criando bucket '${bucket.name}'...`)

        const { data, error } = await supabaseAdmin.storage.createBucket(bucket.name, {
          public: bucket.isPublic,
          fileSizeLimit: bucket.fileSizeLimit,
        })

        if (error) {
          console.error(`❌ Erro ao criar bucket '${bucket.name}': ${error.message}`)
          process.exit(1)
        }

        console.log(`✅ Bucket '${bucket.name}' criado com sucesso!`)
        console.log(`   - Público: ${bucket.isPublic}`)
        console.log(`   - Limite de tamanho: ${bucket.fileSizeLimit / (1024 * 1024)} MB\n`)
      }
    } catch (error) {
      console.error(`❌ Erro inesperado:`, error)
      process.exit(1)
    }
  }

  console.log('✨ Setup concluído com sucesso!')
}

setupBuckets()
