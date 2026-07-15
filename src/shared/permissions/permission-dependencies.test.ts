import { describe, it, expect } from 'vitest'
import {
  expandPermissionsWithDependencies,
  diffAddedPermissions,
  describeDependency,
} from './permission-dependencies'

describe('expandPermissionsWithDependencies', () => {
  it('adiciona clientes:view e servicos:view quando agenda:create está presente', () => {
    const { permissions, added } = expandPermissionsWithDependencies({ agenda: ['view', 'create'] })
    expect(permissions.clientes).toEqual(['view'])
    expect(permissions.servicos).toEqual(['view'])
    expect(added).toEqual(
      expect.arrayContaining([
        { section: 'clientes', action: 'view' },
        { section: 'servicos', action: 'view' },
      ]),
    )
  })

  it('adiciona descontos:view quando financeiro:edit está presente', () => {
    const { permissions } = expandPermissionsWithDependencies({ financeiro: ['view', 'edit'] })
    expect(permissions.descontos).toEqual(['view'])
  })

  it('não duplica ação já concedida', () => {
    const { permissions, added } = expandPermissionsWithDependencies({
      agenda: ['view', 'create'],
      clientes: ['view', 'create'],
      servicos: ['view'],
    })
    expect(permissions.clientes).toEqual(['view', 'create'])
    expect(permissions.servicos).toEqual(['view'])
    expect(added).toEqual([])
  })

  it('não altera permissões sem dependência conhecida', () => {
    const input = { relatorios: ['view'] }
    const { permissions, added } = expandPermissionsWithDependencies(input)
    expect(permissions).toEqual({ relatorios: ['view'] })
    expect(added).toEqual([])
  })

  it('é idempotente — aplicar duas vezes dá o mesmo resultado', () => {
    const first = expandPermissionsWithDependencies({ agenda: ['view', 'create'] })
    const second = expandPermissionsWithDependencies(first.permissions)
    expect(second.permissions).toEqual(first.permissions)
    expect(second.added).toEqual([])
  })
})

describe('diffAddedPermissions', () => {
  it('retorna apenas as ações novas por seção', () => {
    const before = { agenda: ['view', 'create'] }
    const after = { agenda: ['view', 'create'], clientes: ['view'], servicos: ['view'] }
    const added = diffAddedPermissions(before, after)
    expect(added).toEqual(
      expect.arrayContaining([
        { section: 'clientes', action: 'view' },
        { section: 'servicos', action: 'view' },
      ]),
    )
  })

  it('retorna vazio quando nada mudou', () => {
    const before = { agenda: ['view'] }
    const after = { agenda: ['view'] }
    expect(diffAddedPermissions(before, after)).toEqual([])
  })
})

describe('describeDependency', () => {
  it('descreve a dependência com o rótulo da seção e a ação em português', () => {
    expect(describeDependency({ section: 'clientes', action: 'view' })).toBe('Clientes (visualizar)')
    expect(describeDependency({ section: 'descontos', action: 'view' })).toBe('Descontos (visualizar)')
  })
})
