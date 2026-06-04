'use client'

import { toast } from 'sonner'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { usePlatformSettings, useUpdatePlatformSettings } from '@/hooks/admin/use-platform-settings'

export default function AdminSettingsPage() {
  const { data: settings, isLoading } = usePlatformSettings()
  const update = useUpdatePlatformSettings()

  function handleToggle(value: boolean) {
    update.mutate(
      { requireEmailVerification: value },
      {
        onSuccess: () => toast.success('Configuração salva'),
        onError: () => toast.error('Erro ao salvar'),
      },
    )
  }

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-slate-950">Configurações da Plataforma</h1>

      <div className="max-w-lg rounded-xl border border-slate-200 bg-white p-6">
        <p className="mb-6 text-xs font-semibold uppercase tracking-wider text-slate-400">Autenticação</p>

        {isLoading ? (
          <Skeleton className="h-10 w-full rounded-lg" />
        ) : (
          <div className="flex items-center justify-between rounded-lg border border-slate-100 px-4 py-3">
            <div>
              <Label className="text-sm font-medium text-slate-900">
                Verificação de email ao cadastrar
              </Label>
              <p className="mt-0.5 text-xs text-slate-500">
                Se ativo, novos usuários precisam confirmar o email antes de acessar a conta.
                Se inativo, o acesso é liberado imediatamente após o cadastro.
              </p>
            </div>
            <Switch
              checked={settings?.requireEmailVerification ?? false}
              onCheckedChange={handleToggle}
              disabled={update.isPending}
              className="ml-4 shrink-0"
            />
          </div>
        )}
      </div>
    </div>
  )
}
