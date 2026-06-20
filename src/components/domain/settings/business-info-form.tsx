'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useTenantSettings, useUpdateTenantSettings } from '@/hooks/settings/use-tenant-settings'

export function BusinessInfoForm() {
  const router = useRouter()
  const { data, isLoading } = useTenantSettings()
  const { mutate, isPending } = useUpdateTenantSettings()

  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')

  useEffect(() => {
    if (data) {
      setName(data.name)
      setPhone(data.phone ?? '')
      setAddress(data.address ?? '')
    }
  }, [data])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    mutate(
      { name: name.trim() || undefined, phone: phone.trim() || null, address: address.trim() || null },
      {
        onSuccess: () => {
          toast.success('Informações salvas com sucesso')
          router.refresh()
        },
        onError: () => toast.error('Erro ao salvar informações'),
      },
    )
  }

  if (isLoading) {
    return <div className="h-40 animate-pulse rounded-2xl bg-slate-100" />
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="business-name">Nome do negócio</Label>
        <Input
          id="business-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ex: Studio Bella"
          required
          minLength={2}
          maxLength={100}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="business-phone">Telefone de contato</Label>
        <Input
          id="business-phone"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="(11) 9 9999-9999"
          maxLength={30}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="business-address">Endereço</Label>
        <Input
          id="business-address"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="Rua das Flores, 123 — São Paulo, SP"
          maxLength={200}
        />
      </div>

      <Button type="submit" disabled={isPending} className="w-full sm:w-auto">
        {isPending ? 'Salvando...' : 'Salvar alterações'}
      </Button>
    </form>
  )
}
