"use client"

import { Suspense, useEffect } from "react"
import { useRouter } from "next/navigation"
import { BillingPlansContent } from "@/components/domain/billing/billing-plans-content"
import { usePermissions } from "@/hooks/use-permissions"

export default function PlanosPage() {
  const router = useRouter()
  const { user, isLoading } = usePermissions()

  useEffect(() => {
    if (!isLoading && !user?.isOwner) {
      router.replace("/agenda")
    }
  }, [isLoading, user, router])

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-rose-200 border-t-rose-600" />
      </div>
    )
  }

  if (!user?.isOwner) return null

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
