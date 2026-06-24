'use client'

import { use } from 'react'
import { useRouter } from 'next/navigation'
import { IdentificationStep } from '@/components/domain/booking/identification-step'

export default function EntrarPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params)
  const router = useRouter()

  return (
    <div className="mx-auto max-w-sm px-4 py-10">
      <div className="space-y-1 mb-8 text-center">
        <h1 className="text-2xl font-semibold">Acesse sua conta</h1>
        <p className="text-sm text-muted-foreground">
          Consulte seu histórico, próximos agendamentos e seus dados
        </p>
      </div>

      <IdentificationStep
        tenantSlug={slug}
        gateMode
        primaryColor="#7C3AED"
        onBack={() => {}}
        onIdentified={() => router.replace(`/${slug}/cliente`)}
      />
    </div>
  )
}
