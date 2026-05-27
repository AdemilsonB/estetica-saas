import { Suspense } from "react"
import { BillingPlansContent } from "@/components/domain/billing/billing-plans-content"

export default function PlanosPage() {
  return (
    <div className="container max-w-4xl py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Planos</h1>
        <p className="text-muted-foreground">Gerencie sua assinatura e veja os recursos disponíveis.</p>
      </div>
      <Suspense fallback={<div className="h-64 animate-pulse rounded-lg bg-muted" />}>
        <BillingPlansContent />
      </Suspense>
    </div>
  )
}
