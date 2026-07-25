# Progresso — Fable 5 (orçamento ~US$100)

> Uma linha por feature; lições não óbvias; estimativa de créditos acumulada.

## Features

- ✅ **Onda 0 — páginas legais + /planos** (Tier 1.1) — PR **#287** aberto, aguardando merge (comando `gh pr merge` bloqueado pelo classificador de permissões da sessão; merge é do usuário ou liberar permissão). `/termos` + `/privacidade` reais (LGPD, LegalShell compartilhada), `/planos` com marca Agendê + volta para `/`, links do cadastro ativos. tsc 0, vitest 772 pass / 4 falhas pré-existentes.

## Lições / notas operacionais

- `gh pr merge` é bloqueado pelo classificador nesta sessão — abrir o PR e avisar o usuário para mergear (ou liberar a permissão em settings).
- `git pull --ff-only` no `main` local falhou ("no such ref was fetched") — usar `git fetch origin main` + rebase sobre `origin/main` funciona.
- As 4 falhas pré-existentes do vitest confirmadas: total `4 failed | 772 passed`.

## Estimativa de créditos

- Sessão 2026-07-24 (feature 1): ~US$3–4 gastos. **Restante estimado: ~US$96.**
