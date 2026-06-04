'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { RoleEditor } from './role-editor'
import { RoleDeleteButton } from './role-delete-button'
import { useRoles, useCreateRole } from '@/hooks/iam/use-roles'
import { useNavSections } from '@/hooks/iam/use-nav-sections'
import type { NavSection } from '@/shared/permissions/nav-registry'

export function RolesManager() {
  const { data: roles, isLoading: loadingRoles } = useRoles()
  const { data: sections = [], isLoading: loadingSections } = useNavSections()
  const createRole = useCreateRole()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [creatingNew, setCreatingNew] = useState(false)
  const [newName, setNewName] = useState('')

  function handleCreateSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!newName.trim()) return
    createRole.mutate(
      { name: newName.trim(), permissions: {} },
      {
        onSuccess: (created) => {
          toast.success(`Cargo "${created.name}" criado`)
          setCreatingNew(false)
          setNewName('')
          setEditingId(created.id)
        },
        onError: (err) => toast.error(err instanceof Error ? err.message : 'Erro ao criar cargo'),
      },
    )
  }

  const editingRole = roles?.find((r) => r.id === editingId)

  if (loadingRoles || loadingSections) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-14 w-full rounded-xl" />
        ))}
      </div>
    )
  }

  return (
    <div className="flex gap-6">
      {/* Lista de cargos */}
      <div className="w-56 shrink-0 space-y-2">
        {roles?.map((role) => (
          <div
            key={role.id}
            className={`flex items-center justify-between rounded-xl border p-3 cursor-pointer transition ${
              editingId === role.id
                ? 'border-slate-950 bg-slate-50'
                : 'border-slate-200 hover:border-slate-300'
            }`}
            onClick={() => { setEditingId(role.id); setCreatingNew(false) }}
          >
            <div>
              <p className="text-sm font-medium text-slate-900">{role.name}</p>
              <p className="text-xs text-slate-400">{role._count.users} usuário(s)</p>
            </div>
            <RoleDeleteButton
              roleId={role.id}
              roleName={role.name}
              userCount={role._count.users}
              onDeleted={() => { if (editingId === role.id) setEditingId(null) }}
            />
          </div>
        ))}

        {creatingNew ? (
          <form onSubmit={handleCreateSubmit} className="space-y-2 rounded-xl border border-slate-300 p-3">
            <Label className="text-xs">Nome do cargo</Label>
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Ex: Esteticista"
              autoFocus
              maxLength={50}
            />
            <div className="flex gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => { setCreatingNew(false); setNewName('') }}>
                Cancelar
              </Button>
              <Button type="submit" size="sm" disabled={!newName.trim() || createRole.isPending}>
                {createRole.isPending ? '...' : 'Criar'}
              </Button>
            </div>
          </form>
        ) : (
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={() => { setCreatingNew(true); setEditingId(null) }}
          >
            <Plus className="size-3.5" />
            Novo cargo
          </Button>
        )}
      </div>

      {/* Painel de edição */}
      <div className="flex-1">
        {editingRole ? (
          <RoleEditor
            key={editingRole.id}
            role={editingRole}
            sections={sections as NavSection[]}
            onCancel={() => setEditingId(null)}
          />
        ) : (
          <div className="flex h-40 items-center justify-center rounded-xl border border-dashed border-slate-200">
            <p className="text-sm text-slate-400">Selecione um cargo para editar</p>
          </div>
        )}
      </div>
    </div>
  )
}
