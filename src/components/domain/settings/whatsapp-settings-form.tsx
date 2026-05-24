'use client'

import { useEffect, useState } from 'react'
import { MessageCircle } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  useNotificationSettings,
  useUpdateNotificationSettings,
} from '@/hooks/settings/use-notification-settings'

export function WhatsAppSettingsForm() {
  const { data, isLoading } = useNotificationSettings()
  const { mutate, isPending } = useUpdateNotificationSettings()

  const [instanceId, setInstanceId] = useState('')
  const [token, setToken] = useState('')
  const [enabled, setEnabled] = useState(false)

  useEffect(() => {
    if (data) {
      setInstanceId(data.zApiInstanceId ?? '')
      setToken(data.zApiToken ?? '')
      setEnabled(data.whatsappEnabled)
    }
  }, [data])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    mutate({
      zApiInstanceId: instanceId.trim() || null,
      zApiToken: token.trim() || null,
      whatsappEnabled: enabled,
    })
  }

  function handleToggle() {
    const next = !enabled
    setEnabled(next)
    mutate({ whatsappEnabled: next })
  }

  if (isLoading) {
    return <div className="h-48 animate-pulse rounded-2xl bg-slate-100" />
  }

  const isConfigured = !!(data?.zApiInstanceId && data?.zApiToken)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between rounded-2xl border border-white/80 bg-white/85 px-5 py-4 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="inline-flex size-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
            <MessageCircle className="size-5" />
          </div>
          <div>
            <p className="font-medium text-slate-950">Notificações WhatsApp</p>
            <p className="text-xs text-slate-500">
              Confirmações automáticas via Z-API
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {isConfigured ? (
            <Badge className={enabled ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}>
              {enabled ? 'Ativo' : 'Pausado'}
            </Badge>
          ) : (
            <Badge variant="secondary">Não configurado</Badge>
          )}
          <Button
            variant={enabled ? 'destructive' : 'default'}
            size="sm"
            onClick={handleToggle}
            disabled={!isConfigured || isPending}
          >
            {enabled ? 'Desativar' : 'Ativar'}
          </Button>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <p className="text-sm font-medium text-slate-700">Credenciais Z-API</p>

        <div className="space-y-2">
          <Label htmlFor="zapi-instance">Instance ID</Label>
          <Input
            id="zapi-instance"
            value={instanceId}
            onChange={(e) => setInstanceId(e.target.value)}
            placeholder="Ex: 3B1E9CE0F90A8D4C7F2"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="zapi-token">Token da instância</Label>
          <Input
            id="zapi-token"
            type="password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="Token de segurança da instância"
          />
        </div>

        <p className="text-xs text-slate-400">
          Obtenha o Instance ID e Token no painel da{' '}
          <span className="font-medium">Z-API</span>. A variável de ambiente{' '}
          <code className="rounded bg-slate-100 px-1 py-0.5">ZAPI_CLIENT_TOKEN</code>{' '}
          deve estar configurada no servidor.
        </p>

        <Button type="submit" disabled={isPending} className="w-full sm:w-auto">
          {isPending ? 'Salvando...' : 'Salvar credenciais'}
        </Button>
      </form>
    </div>
  )
}
