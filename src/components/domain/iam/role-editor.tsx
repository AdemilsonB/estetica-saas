'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RolePermissionMatrix } from './role-permission-matrix'
import { RoleFilterPermissions } from './role-filter-permissions'
import { useUpdateRole, type Role } from '@/hooks/iam/use-roles'
import { useExtraPermissions } from '@/hooks/iam/use-extra-permissions'
import type { NavSection } from '@/shared/permissions/nav-registry'

type Props = {
  role: Role
  sections: NavSection[]
  onCancel: () => void
}

export function RoleEditor({ role, sections, onCancel }: Props) {
  const [name, setName] = useState(role.name)
  const [permissions, setPermissions] = useState<Record<string, string[]>>(role.permissions)
  const updateRole = useUpdateRole()
  const { data: extraSections = [] } = useExtraPermissions()

  function handleSave() {
    updateRole.mutate(
      { id: role.id, name, permissions },
      {
        onSuccess: () => {
          toast.success('Cargo atualizado')
          onCancel()
        },
        onError: (err) => toast.error(err instanceof Error ? err.message : 'Erro ao salvar'),
      },
    )
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1.5">
        <Label>Nome do cargo</Label>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={50}
          disabled={updateRole.isPending}
        />
      </div>

      <div>
        <p className="mb-3 text-sm font-medium text-slate-700">Permissões por tela</p>
        <RolePermissionMatrix
          sections={sections}
          permissions={permissions}
          onChange={setPermissions}
          disabled={updateRole.isPending}
        />
      </div>

      {extraSections.length > 0 && (
        <div>
          <p className="mb-3 text-sm font-medium text-slate-700">Permissões extras</p>
          <RolePermissionMatrix
            sections={extraSections}
            permissions={permissions}
            onChange={setPermissions}
            disabled={updateRole.isPending}
          />
        </div>
      )}

      {sections.some((s) => s.filterLabel) && (
        <div>
          <p className="mb-3 text-sm font-medium text-slate-700">Permissões de filtro</p>
          <RoleFilterPermissions
            sections={sections}
            permissions={permissions}
            onChange={setPermissions}
            disabled={updateRole.isPending}
          />
        </div>
      )}

      <div className="flex gap-2 justify-end pt-2">
        <Button variant="outline" onClick={onCancel} disabled={updateRole.isPending}>
          Cancelar
        </Button>
        <Button
          onClick={handleSave}
          disabled={!name.trim() || updateRole.isPending}
          className="bg-primary text-primary-foreground hover:bg-primary/90"
        >
          {updateRole.isPending ? 'Salvando...' : 'Salvar'}
        </Button>
      </div>
    </div>
  )
}
