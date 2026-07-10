/**
 * Gera um resumo textual curto do que um cargo pode fazer, a partir das permissões
 * reais (`Record<sectionKey, action[]>`) e da lista de seções (com labels).
 * Função pura — usada no card de membro da equipe.
 */
export function describeRolePermissions(
  permissions: Record<string, string[]>,
  sections: { key: string; label: string }[],
): string {
  const viewable = sections.filter((s) => (permissions[s.key] ?? []).includes('view'))
  if (viewable.length === 0) return 'Sem acesso a nenhuma tela'

  const editable = sections.filter((s) => {
    const actions = permissions[s.key] ?? []
    return actions.includes('create') || actions.includes('edit') || actions.includes('delete')
  })

  const viewLabels = viewable.map((s) => s.label).join(', ')
  if (editable.length === 0) {
    return `Pode ver ${viewLabels} — não pode editar nem excluir`
  }

  const editLabels = editable.map((s) => s.label).join(', ')
  return `Pode ver ${viewLabels}; pode editar ${editLabels}`
}
