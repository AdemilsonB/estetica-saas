'use client'

import { useState, useEffect } from 'react'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import {
  useAutomations,
  useUpdateAutomations,
  type AutomationsConfig,
} from '@/hooks/settings/use-automations'
import { useServices } from '@/hooks/scheduling/use-services'

const REMINDER_OPTIONS = [
  { value: 1,  label: '1 hora antes' },
  { value: 2,  label: '2 horas antes' },
  { value: 3,  label: '3 horas antes' },
  { value: 6,  label: '6 horas antes' },
  { value: 12, label: '12 horas antes' },
  { value: 24, label: '24 horas antes (padrão)' },
  { value: 48, label: '48 horas antes' },
]

const INTERVAL_OPTIONS = [
  { value: 1,  label: '1 hora' },
  { value: 2,  label: '2 horas' },
  { value: 3,  label: '3 horas' },
  { value: 6,  label: '6 horas' },
  { value: 12, label: '12 horas' },
  { value: 24, label: '24 horas' },
]

const HOUR_OPTIONS = Array.from({ length: 17 }, (_, i) => i + 7).map(h => ({
  value: h,
  label: `${String(h).padStart(2, '0')}:00`,
}))

export function WhatsAppAutomationsForm() {
  const { data, isLoading } = useAutomations()
  const { data: services = [] } = useServices()
  const { mutate, isPending } = useUpdateAutomations()
  const { toast } = useToast()

  const [form, setForm] = useState<Partial<AutomationsConfig>>({})
  const isDirty = Object.keys(form).length > 0

  useEffect(() => {
    if (data) setForm({})
  }, [data])

  function set<K extends keyof AutomationsConfig>(key: K, value: AutomationsConfig[K]) {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  function get<K extends keyof AutomationsConfig>(key: K): AutomationsConfig[K] | undefined {
    if (key in form) return (form as AutomationsConfig)[key]
    return data?.[key]
  }

  function handleSave() {
    mutate(form, {
      onSuccess: () => {
        setForm({})
        toast({ title: 'Automações salvas com sucesso.' })
      },
      onError: () =>
        toast({ title: 'Erro ao salvar automações.', variant: 'destructive' }),
    })
  }

  if (isLoading) {
    return <div className="text-sm text-muted-foreground">Carregando configurações...</div>
  }

  const activeServices = services.filter(s => s.active)

  return (
    <div className="space-y-8">

      {/* Lembrete de agendamento */}
      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-foreground">Lembrete de agendamento</h3>
        <p className="text-xs text-muted-foreground">
          Mensagem enviada automaticamente antes do horário marcado do cliente.
        </p>
        <div className="flex items-center gap-3">
          <Label className="text-xs text-muted-foreground">Antecedência do lembrete</Label>
          <Select
            value={String(get('reminderLeadHours') ?? 24)}
            onValueChange={v => set('reminderLeadHours', Number(v))}
          >
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {REMINDER_OPTIONS.map(o => (
                <SelectItem key={o.value} value={String(o.value)}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </section>

      <div className="border-t border-border" />

      {/* Resposta automática */}
      <section className="space-y-3">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-foreground">Resposta automática</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Responde automaticamente quando alguém envia mensagem.
              Use <code className="rounded bg-muted px-1">{'{booking_link}'}</code> para incluir o link de agendamento.
            </p>
          </div>
          <Switch
            checked={get('autoReplyEnabled') ?? false}
            onCheckedChange={v => set('autoReplyEnabled', v)}
          />
        </div>
        {(get('autoReplyEnabled') ?? false) && (
          <div className="space-y-3 pl-1">
            <div className="space-y-1.5">
              <Label className="text-xs">Mensagem</Label>
              <Textarea
                value={get('autoReplyMessage') ?? ''}
                onChange={e => set('autoReplyMessage', e.target.value || null)}
                placeholder="Olá! Para agendar, acesse: {booking_link}"
                rows={3}
                maxLength={500}
              />
              <p className="text-[11px] text-muted-foreground text-right">
                {(get('autoReplyMessage') ?? '').length}/500
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Label className="text-xs text-muted-foreground whitespace-nowrap">
                Intervalo mínimo entre respostas
              </Label>
              <Select
                value={String(get('autoReplyIntervalHours') ?? 6)}
                onValueChange={v => set('autoReplyIntervalHours', Number(v))}
              >
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {INTERVAL_OPTIONS.map(o => (
                    <SelectItem key={o.value} value={String(o.value)}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}
      </section>

      <div className="border-t border-border" />

      {/* Fora do expediente */}
      <section className="space-y-3">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-foreground">Mensagem fora do expediente</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Enviada quando alguém escreve fora do horário de funcionamento configurado.
            </p>
          </div>
          <Switch
            checked={get('offHoursEnabled') ?? false}
            onCheckedChange={v => set('offHoursEnabled', v)}
          />
        </div>
        {(get('offHoursEnabled') ?? false) && (
          <div className="space-y-1.5 pl-1">
            <Label className="text-xs">Mensagem</Label>
            <Textarea
              value={get('offHoursMessage') ?? ''}
              onChange={e => set('offHoursMessage', e.target.value || null)}
              placeholder="Olá! No momento estamos fora do expediente. Retornaremos em breve!"
              rows={3}
              maxLength={500}
            />
          </div>
        )}
      </section>

      <div className="border-t border-border" />

      {/* Parabéns de aniversário */}
      <section className="space-y-3">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-foreground">Parabéns de aniversário</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Mensagem enviada no dia do aniversário dos clientes (requer data de nascimento no cadastro e
              consentimento).
            </p>
          </div>
          <Switch
            checked={get('birthdayEnabled') ?? false}
            onCheckedChange={v => set('birthdayEnabled', v)}
          />
        </div>
        {(get('birthdayEnabled') ?? false) && (
          <div className="space-y-3 pl-1">
            <div className="space-y-1.5">
              <Label className="text-xs">Mensagem</Label>
              <Textarea
                value={get('birthdayMessage') ?? ''}
                onChange={e => set('birthdayMessage', e.target.value || null)}
                placeholder="Feliz aniversário! Temos um presente especial para você 🎂"
                rows={3}
                maxLength={300}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Serviço de brinde (opcional)</Label>
              <Select
                value={get('birthdayGiftServiceId') ?? '__none__'}
                onValueChange={v =>
                  set('birthdayGiftServiceId', v === '__none__' ? null : v)
                }
              >
                <SelectTrigger className="w-64">
                  <SelectValue placeholder="Sem brinde" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Sem brinde</SelectItem>
                  {activeServices.map(s => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground">
                Quando configurado, o nome do serviço de brinde é mencionado na mensagem.
              </p>
            </div>
          </div>
        )}
      </section>

      <div className="border-t border-border" />

      {/* Resumo diário */}
      <section className="space-y-3">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-foreground">Resumo diário no WhatsApp</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Receba um resumo dos agendamentos do dia no WhatsApp do negócio.
              Requer <strong>Telefone do negócio</strong> preenchido nas configurações.
            </p>
          </div>
          <Switch
            checked={get('dailyStatusEnabled') ?? false}
            onCheckedChange={v => set('dailyStatusEnabled', v)}
          />
        </div>
        {(get('dailyStatusEnabled') ?? false) && (
          <div className="flex items-center gap-3 pl-1">
            <Label className="text-xs text-muted-foreground whitespace-nowrap">
              Horário de envio
            </Label>
            <Select
              value={String(get('dailyStatusHour') ?? 9)}
              onValueChange={v => set('dailyStatusHour', Number(v))}
            >
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {HOUR_OPTIONS.map(o => (
                  <SelectItem key={o.value} value={String(o.value)}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </section>

      <Button
        onClick={handleSave}
        disabled={!isDirty || isPending}
        className="w-full sm:w-auto"
      >
        {isPending ? 'Salvando...' : 'Salvar automações'}
      </Button>
    </div>
  )
}
