# Progresso — Fable 5 (orçamento ~US$100)

> Uma linha por feature; lições não óbvias; estimativa de créditos acumulada.

## Features

- ✅ **Onda 0 — páginas legais + /planos** (Tier 1.1) — PR **#287** aberto, aguardando merge (comando `gh pr merge` bloqueado pelo classificador de permissões da sessão; merge é do usuário ou liberar permissão). `/termos` + `/privacidade` reais (LGPD, LegalShell compartilhada), `/planos` com marca Agendê + volta para `/`, links do cadastro ativos. tsc 0, vitest 772 pass / 4 falhas pré-existentes.
- ✅ **CRM — import de contatos no iOS (.vcf real)** — parser vCard novo em `src/shared/utils/vcard.ts` (o antigo regex `^TEL`/`^FN:` perdia contato com rótulo personalizado `item1.TEL` — o fluxo que o próprio modal ensinava retornava "nenhum contato"; agora: unfolding RFC, grupos `itemN.`, quoted-printable 2.1, FN→N fallback, melhor TEL pref>CELL, unescape, dedup); telefone normalizado sem DDI 55 + preview de duplicados casa clientes gravados com/sem 55; input aceita **vários .vcf de uma vez** (iOS gera 1 por contato) + `text/x-vcard`; requisições em lotes de 500 (export iCloud grande); guia do modal ensina o gesto de dois dedos do iOS 16+ (multi-seleção → Compartilhar) em vez de mandar pro computador. 16 testes novos com fixtures fiéis a iPhone/iCloud/WhatsApp/Android 2.1. tsc 0, vitest 788 pass / mesmas 4 falhas pré-existentes.

## Lições / notas operacionais

- `gh pr merge` é bloqueado pelo classificador nesta sessão — abrir o PR e avisar o usuário para mergear (ou liberar a permissão em settings).
- `git pull --ff-only` no `main` local falhou ("no such ref was fetched") — usar `git fetch origin main` + rebase sobre `origin/main` funciona.
- As 4 falhas pré-existentes do vitest confirmadas: total `4 failed | 772 passed`.

## Estimativa de créditos

- Sessão 2026-07-24 (feature 1): ~US$3–4 gastos. **Restante estimado: ~US$96.**
