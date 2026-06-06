'use client'

import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { Copy, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useSchedulingPolicy, useUpdateSchedulingPolicy } from '@/hooks/settings/use-scheduling-policy'
import { useTenantSettings } from '@/hooks/settings/use-tenant-settings'

const PADDING_OPTIONS = [
  { value: '0', label: '0 min' },
  { value: '5', label: '5 min' },
  { value: '10', label: '10 min' },
  { value: '15', label: '15 min' },
  { value: '20', label: '20 min' },
  { value: '30', label: '30 min' },
  { value: '45', label: '45 min' },
  { value: '60', label: '60 min' },
]

const MIN_ADVANCE_OPTIONS = [
  { value: '0', label: '0 min' },
  { value: '5', label: '5 min' },
  { value: '10', label: '10 min' },
  { value: '15', label: '15 min' },
  { value: '20', label: '20 min' },
  { value: '30', label: '30 min' },
  { value: '60', label: '60 min' },
  { value: '120', label: '120 min' },
]

const MAX_ADVANCE_OPTIONS = [
  { value: '15', label: '15 dias' },
  { value: '30', label: '30 dias' },
  { value: '45', label: '45 dias' },
  { value: '60', label: '60 dias' },
  { value: '90', label: '90 dias' },
]

export function SchedulingPolicyForm() {
  const { data: policy, isLoading: policyLoading } = useSchedulingPolicy()
  const { data: tenant, isLoading: tenantLoading } = useTenantSettings()
  const update = useUpdateSchedulingPolicy()

  const [allowPublicBooking, setAllowPublicBooking] = useState(false)
  const [paddingMinutes, setPaddingMinutes] = useState('0')
  const [minAdvanceMinutes, setMinAdvanceMinutes] = useState('0')
  const [maxAdvanceDays, setMaxAdvanceDays] = useState('30')
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (policy) {
      setAllowPublicBooking(policy.allowPublicBooking)
      setPaddingMinutes(String(policy.paddingMinutes))
      setMinAdvanceMinutes(String(policy.minAdvanceMinutes))
      setMaxAdvanceDays(String(policy.maxAdvanceDays))
    }
  }, [policy])

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''
  const publicLink = tenant?.slug ? `${appUrl}/agendar/${tenant.slug}` : ''

  function handleCopyLink() {
    if (!publicLink) return
    navigator.clipboard.writeText(publicLink).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  function handleSave() {
    update.mutate(
      {
        allowPublicBooking,
        paddingMinutes: parseInt(paddingMinutes, 10),
        minAdvanceMinutes: parseInt(minAdvanceMinutes, 10),
        maxAdvanceDays: parseInt(maxAdvanceDays, 10),
      },
      {
        onSuccess: () => toast.success('Configurações salvas'),
        onError: () => toast.error('Erro ao salvar configurações'),
      },
    )
  }

  if (policyLoading || tenantLoading) {
    return <div className="h-48 animate-pulse rounded-xl bg-slate-100" />
  }

  return (
    <div className="space-y-6">
      {/* Toggle de agendamento público */}
      <div className="flex items-center justify-between rounded-lg border border-slate-100 p-4">
        <div className="space-y-0.5">
          <Label className="text-sm font-medium text-slate-900">
            Aceitar agendamentos online
          </Label>
          <p className="text-xs text-slate-500">
            Permite que clientes agendem diretamente pelo link público
          </p>
        </div>
        <Switch
          checked={allowPublicBooking}
          onCheckedChange={setAllowPublicBooking}
        />
      </div>

      {/* Link público copiável */}
      {publicLink && (
        <div className="space-y-1.5">
          <Label className="text-sm font-medium text-slate-700">
            Link público de agendamento
          </Label>
          <div className="flex items-center gap-2">
            <div className="flex-1 truncate rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
              {publicLink}
            </div>
            <Button
              variant="outline"
              size="sm"
              className="shrink-0"
              onClick={handleCopyLink}
            >
              {copied ? (
                <Check className="size-4 text-green-600" />
              ) : (
                <Copy className="size-4" />
              )}
              {copied ? 'Copiado' : 'Copiar'}
            </Button>
          </div>
        </div>
      )}

      {/* Selects de política */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label className="text-sm font-medium text-slate-700">
            Intervalo entre atendimentos
          </Label>
          <Select value={paddingMinutes} onValueChange={setPaddingMinutes}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PADDING_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label className="text-sm font-medium text-slate-700">
            Antecedência mínima
          </Label>
          <Select value={minAdvanceMinutes} onValueChange={setMinAdvanceMinutes}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MIN_ADVANCE_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label className="text-sm font-medium text-slate-700">
            Janela de agendamento
          </Label>
          <Select value={maxAdvanceDays} onValueChange={setMaxAdvanceDays}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MAX_ADVANCE_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Button onClick={handleSave} disabled={update.isPending} size="sm">
        {update.isPending ? 'Salvando...' : 'Salvar'}
      </Button>
    </div>
  )
}
