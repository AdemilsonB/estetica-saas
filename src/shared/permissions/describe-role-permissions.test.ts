import { describe, it, expect } from 'vitest'
import { describeRolePermissions } from './describe-role-permissions'

const sections = [
  { key: 'agenda', label: 'Agenda' },
  { key: 'servicos', label: 'Serviços' },
  { key: 'clientes', label: 'Clientes' },
]

describe('describeRolePermissions', () => {
  it('informa quando o cargo não vê nenhuma tela', () => {
    expect(describeRolePermissions({}, sections)).toBe('Sem acesso a nenhuma tela')
  })

  it('lista o que pode ver e diz que não edita quando só tem view', () => {
    const perms = { agenda: ['view'], servicos: ['view'] }
    expect(describeRolePermissions(perms, sections)).toBe(
      'Pode ver Agenda, Serviços — não pode editar nem excluir',
    )
  })

  it('separa telas visíveis das editáveis', () => {
    const perms = { agenda: ['view', 'create', 'edit'], servicos: ['view'] }
    expect(describeRolePermissions(perms, sections)).toBe(
      'Pode ver Agenda, Serviços; pode editar Agenda',
    )
  })

  it('ignora chaves de seção que não estão na lista de sections', () => {
    const perms = { desconhecida: ['view', 'edit'], clientes: ['view'] }
    expect(describeRolePermissions(perms, sections)).toBe(
      'Pode ver Clientes — não pode editar nem excluir',
    )
  })
})
