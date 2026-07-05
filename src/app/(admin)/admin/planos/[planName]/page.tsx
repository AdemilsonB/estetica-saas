'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { toast } from 'sonner'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Skeleton } from '@/components/ui/skeleton'
import { usePlans, useUpdatePlan } from '@/hooks/admin/use-plans'
import { usePlanFeatures, useUpdatePlanFeatures } from '@/hooks/admin/use-plan-features'
import { usePlanLimits, useUpdatePlanLimits } from '@/hooks/admin/use-plan-limits'
import { CAPABILITY_REGISTRY } from '@/shared/permissions/capability-registry'
import { getLimitsByGroup } from '@/shared/permissions/limit-registry'

export default function PlanEditorPage() {
  const { planName } = useParams<{ planName: string }>()
  const { data: plans, isLoading: loadingPlans } = usePlans()
  const { data: features = [], isLoading: loadingFeatures } = usePlanFeatures(planName)
  const { data: limits = [], isLoading: loadingLimits } = usePlanLimits(planName)
  const updatePlan = useUpdatePlan()
  const updateFeatures = useUpdatePlanFeatures()
  const updateLimits = useUpdatePlanLimits()

  const plan = plans?.find((p) => p.name === planName)

  const [displayName, setDisplayName] = useState('')
  const [price, setPrice] = useState('0')
  const [description, setDescription] = useState('')
  const [trialDays, setTrialDays] = useState('14')
  const [stripePriceId, setStripePriceId] = useState('')
  const [isActive, setIsActive] = useState(true)
  const [featureState, setFeatureState] = useState<Record<string, boolean>>({})
  const [limitState, setLimitState] = useState<Record<string, number>>({})

  useEffect(() => {
    if (plan) {
      setDisplayName(plan.displayName)
      setPrice(String(plan.price))
      setDescription(plan.description ?? '')
      setTrialDays(String(plan.trialDays))
      setStripePriceId(plan.stripePriceId ?? '')
      setIsActive(plan.isActive)
    }
  }, [plan])

  useEffect(() => {
    if (features.length > 0) {
      const next = Object.fromEntries(features.map((f) => [f.sectionKey, f.enabled]))
      for (const c of CAPABILITY_REGISTRY) if (c.essential) next[c.key] = true
      setFeatureState(next)
    }
  }, [features])

  useEffect(() => {
    if (limits.length > 0) {
      setLimitState(Object.fromEntries(limits.map((l) => [l.limitKey, l.value])))
    }
  }, [limits])

  if (loadingPlans || loadingFeatures || loadingLimits) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-96 w-full rounded-xl" />
      </div>
    )
  }

  if (!plan) return <p className="text-slate-500">Plano não encontrado.</p>

  const navCaps = CAPABILITY_REGISTRY.filter((c) => c.category === 'nav')
  const otherCaps = CAPABILITY_REGISTRY.filter((c) => c.category === 'capability')

  function handleSaveMetadata() {
    updatePlan.mutate(
      { name: planName, displayName, price: parseFloat(price) || 0, description: description || null, trialDays: parseInt(trialDays) || 0, stripePriceId: stripePriceId.trim() || null, isActive },
      {
        onSuccess: () => toast.success('Metadados salvos'),
        onError: (err) => toast.error(err instanceof Error ? err.message : 'Erro'),
      }
    )
  }

  function handleSaveFeatures() {
    updateFeatures.mutate(
      { planName, features: Object.entries(featureState).map(([sectionKey, enabled]) => ({ sectionKey, enabled })) },
      {
        onSuccess: () => toast.success('Funcionalidades salvas'),
        onError: (err) => toast.error(err instanceof Error ? err.message : 'Erro'),
      }
    )
  }

  function handleSaveLimits() {
    updateLimits.mutate(
      { planName, limits: Object.entries(limitState).map(([limitKey, value]) => ({ limitKey, value })) },
      {
        onSuccess: () => toast.success('Limites salvos'),
        onError: (err) => toast.error(err instanceof Error ? err.message : 'Erro'),
      }
    )
  }

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-slate-950">Plano {plan.displayName}</h1>

      <Tabs defaultValue="metadata">
        <TabsList>
          <TabsTrigger value="metadata">Metadados</TabsTrigger>
          <TabsTrigger value="features">Funcionalidades</TabsTrigger>
          <TabsTrigger value="limits">Limites</TabsTrigger>
        </TabsList>

        <TabsContent value="metadata" className="mt-6">
          <div className="max-w-md space-y-4 rounded-xl border border-slate-200 bg-white p-6">
            <div className="space-y-1.5">
              <Label>Nome de exibição</Label>
              <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} maxLength={50} />
            </div>
            <div className="space-y-1.5">
              <Label>Preço mensal (R$)</Label>
              <Input type="number" min={0} step={0.01} value={price} onChange={(e) => setPrice(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Benefícios do plano</Label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={5}
                placeholder={'5 profissionais\n300 agendamentos/mês\nWhatsApp automático'}
                className="resize-none font-mono text-sm"
              />
              <p className="text-xs text-slate-400">Um benefício por linha — exibido como bullets no onboarding e na página de planos.</p>
            </div>
            <div className="space-y-1.5">
              <Label>Dias de trial grátis</Label>
              <Input
                type="number"
                min={0}
                max={365}
                value={trialDays}
                onChange={(e) => setTrialDays(e.target.value)}
              />
              <p className="text-xs text-slate-400">0 = sem trial. O Stripe cobrará imediatamente ao assinar.</p>
            </div>
            <div className="space-y-1.5">
              <Label>Stripe Price ID</Label>
              <Input
                value={stripePriceId}
                onChange={(e) => setStripePriceId(e.target.value)}
                placeholder="price_xxxxxxxxxxxxxxxxxxxx"
                className="font-mono text-sm"
              />
              <p className="text-xs text-slate-400">
                ID do preço no Stripe (começa com <code className="font-mono">price_</code>).
                Encontre em: Catálogo de produtos → produto → seção Preços.
                Deixe vazio para planos sem cobrança (Free).
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Switch checked={isActive} onCheckedChange={setIsActive} />
              <Label>Plano ativo</Label>
            </div>
            <Button onClick={handleSaveMetadata} disabled={updatePlan.isPending} className="bg-slate-950 text-white hover:bg-slate-800">
              {updatePlan.isPending ? 'Salvando...' : 'Salvar metadados'}
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="features" className="mt-6">
          <div className="max-w-lg rounded-xl border border-slate-200 bg-white p-6">
            <div className="space-y-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Navegação</p>
              {navCaps.map((cap) => (
                <div key={cap.key} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Label>{cap.label}</Label>
                    {cap.essential && (
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                        Essencial
                      </span>
                    )}
                  </div>
                  <Switch
                    checked={cap.essential ? true : (featureState[cap.key] ?? false)}
                    disabled={cap.essential}
                    onCheckedChange={(v) => setFeatureState((s) => ({ ...s, [cap.key]: v }))}
                  />
                </div>
              ))}
              <p className="mt-4 text-xs font-semibold uppercase tracking-wider text-slate-400">Capacidades</p>
              {otherCaps.map((cap) => (
                <div key={cap.key} className="flex items-center justify-between">
                  <Label>{cap.label}</Label>
                  <Switch
                    checked={featureState[cap.key] ?? false}
                    onCheckedChange={(v) => setFeatureState((s) => ({ ...s, [cap.key]: v }))}
                  />
                </div>
              ))}
            </div>
            <Button onClick={handleSaveFeatures} disabled={updateFeatures.isPending} className="mt-6 bg-slate-950 text-white hover:bg-slate-800">
              {updateFeatures.isPending ? 'Salvando...' : 'Salvar funcionalidades'}
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="limits" className="mt-6">
          <div className="max-w-lg space-y-6 rounded-xl border border-slate-200 bg-white p-6">
            {Object.entries(getLimitsByGroup()).map(([group, entries]) => (
              <div key={group} className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">{group}</p>
                {entries.map(([key, meta]) => (
                  <div key={key} className="flex flex-wrap items-center gap-2 sm:gap-4">
                    <Label className="w-full sm:w-48 sm:shrink-0">{meta.label}</Label>
                    <Input
                      type="number"
                      min={0}
                      className="w-28"
                      value={limitState[key] ?? 0}
                      onChange={(e) => setLimitState((s) => ({ ...s, [key]: parseInt(e.target.value) || 0 }))}
                    />
                    <span className="text-xs text-slate-400">{meta.unit} · {meta.unlimitedThreshold} = ilimitado</span>
                  </div>
                ))}
              </div>
            ))}
            <Button onClick={handleSaveLimits} disabled={updateLimits.isPending} className="bg-slate-950 text-white hover:bg-slate-800">
              {updateLimits.isPending ? 'Salvando...' : 'Salvar limites'}
            </Button>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
