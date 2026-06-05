'use client'

import { Checkbox } from '@/components/ui/checkbox'
import type { NavSection, NavAction } from '@/shared/permissions/nav-registry'

type Props = {
  sections: NavSection[]
  permissions: Record<string, string[]>
  onChange: (next: Record<string, string[]>) => void
  disabled?: boolean
}

const ACTION_LABELS: Record<NavAction, string> = {
  view:     'Visualizar',
  create:   'Criar',
  edit:     'Editar',
  delete:   'Excluir',
  view_all: 'Ver todos',
}

const ALL_ACTIONS: NavAction[] = ['view', 'create', 'edit', 'delete', 'view_all']

export function RolePermissionMatrix({ sections, permissions, onChange, disabled }: Props) {
  function toggle(sectionKey: string, action: NavAction, checked: boolean) {
    const current = permissions[sectionKey] ?? []
    let next: string[]

    if (action === 'view' && !checked) {
      next = []
    } else if (action !== 'view' && checked) {
      next = [...new Set([...current, 'view', action])]
    } else if (checked) {
      next = [...new Set([...current, action])]
    } else {
      next = current.filter((a) => a !== action)
    }

    onChange({ ...permissions, [sectionKey]: next })
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-100">
            <th className="pb-2 text-left font-medium text-slate-500">Tela</th>
            {ALL_ACTIONS.map((action) => (
              <th key={action} className="pb-2 text-center font-medium text-slate-500 w-24">
                {ACTION_LABELS[action]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sections.map((section) => {
            const sectionActions = permissions[section.key] ?? []
            return (
              <tr key={section.key} className="border-b border-slate-50">
                <td className="py-3 font-medium text-slate-800">{section.label}</td>
                {ALL_ACTIONS.map((action) => {
                  const exists = section.actions.includes(action)
                  const checked = sectionActions.includes(action)
                  if (!exists) {
                    return <td key={action} className="py-3 text-center text-slate-300">–</td>
                  }
                  return (
                    <td key={action} className="py-3 text-center">
                      <Checkbox
                        checked={checked}
                        disabled={disabled}
                        onCheckedChange={(v) => toggle(section.key, action, Boolean(v))}
                      />
                    </td>
                  )
                })}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
