# Agent: Hotfix
> Pipeline reduzido para correções pontuais. Custo estimado: ~12–15k tokens.

## Quando usar esta skill

Use `agent-hotfix` (não o pipeline completo) quando:
- Corrigindo bug reportado em produção
- Ajuste de comportamento sem nova funcionalidade
- Fix de UI/UX sem mudança de domínio
- Correção de validação ou mensagem de erro

NÃO use para: features novas, mudanças de schema, novas integrações.

---

## Pipeline hotfix (ordem obrigatória)

### 1. Diagnóstico rápido
- Ler apenas os arquivos diretamente relacionados ao bug
- Identificar causa raiz antes de qualquer mudança
- Confirmar no chat: "Bug identificado em [arquivo]. Causa: [causa]. Fix: [fix]"

### 2. Fix cirúrgico
- Alterar apenas o necessário para corrigir o bug
- Sem refatorações oportunistas
- Sem "melhorias" não relacionadas ao bug

### 3. Verificação mobile (obrigatória se o fix afeta UI)
- O fix afeta algum componente de UI?
  - SIM → verificar comportamento em viewport 375px e 390px
  - SIM → verificar touch targets (mínimo 44×44px)
  - SIM → verificar ausência de scroll horizontal
  - NÃO → pular esta etapa

### 4. Security check (apenas se relevante)
- O fix envolve autenticação, autorização ou dados do usuário?
  - SIM → invocar `agent-security.md` apenas para a mudança feita
  - NÃO → pular esta etapa

### 5. Review gate
- Executar: `npx tsc --noEmit`
- Executar: `npm run lint` (se configurado)
- Verificar: nenhuma importação quebrada
- NÃO é necessário rodar suite completa de testes para hotfix

### 6. Documentação mínima
- Atualizar APENAS `memory/project-state.md`
- Registro: "Fix [descrição] em [data] — arquivo: [arquivo]"
- NÃO atualizar CLAUDE.md, ROADMAP.md ou DOMAIN.md
