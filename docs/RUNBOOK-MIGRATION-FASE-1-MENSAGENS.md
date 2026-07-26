# ⚠️ AÇÃO PENDENTE EM PRODUÇÃO — migration da Fase 1 do motor de mensagens

**Criado em:** 2026-07-26
**Status:** 🔴 **NÃO APLICADO**
**Contexto:** ADR-017, PR #300 (mergeada em `058ccad`), PR #301 (mergeada em `95b4918`)

---

## Por que isso é urgente

A PR #300 foi mergeada e a Vercel já fez deploy do código novo. Mas **a Vercel não roda
migrations no build** (o `buildCommand` é `prisma generate && next build`), então a tabela
`CustomerMessageTemplate` **não existe em produção**.

Enquanto ela não existir, toda tentativa de enviar mensagem ao cliente falha na resolução
do template:

| Canal | Comportamento sem a tabela |
|---|---|
| WhatsApp | `FAILED` registrado no `NotificationLog` com o motivo, cota devolvida |
| E-mail | `FAILED` registrado no `NotificationLog` com o motivo (corrigido na PR #301) |
| Aba Configurações › Notificações › Mensagens ao cliente | erro 500 |

**Nenhuma notificação ao cliente está saindo** — confirmação de agendamento, cancelamento,
lembrete, no-show. Falha de forma controlada e registrada, mas falha.

---

## O que rodar

Precisa das credenciais de produção. Na ordem, na mesma janela:

```bash
cd c:/dev/estetica-saas

# 1. Credenciais de produção
vercel env pull .env.local --environment=production --yes

# 2. Cria a tabela — ISTO PARA O SANGRAMENTO
npx prisma migrate deploy

# 3. Confere o que seria migrado, sem gravar nada
npm run messages:backfill -- --dry-run

# 4. Migra os textos que os tenants já customizaram
npm run messages:backfill
```

### O que esperar de cada passo

**Passo 2** deve imprimir `Applying migration 20260726120000_add_customer_message_template`
e terminar com as migrations em dia. Confirme depois com `npx prisma migrate status`.
Assim que ele terminar, as mensagens voltam a sair, usando os textos padrão do catálogo.

**Passo 3** lista tenant por tenant quais eventos seriam migrados, sem escrever nada.
Serve para você conferir o volume antes.

**Passo 4** grava. É idempotente — rodar duas vezes não duplica nem sobrescreve.

---

## Se o passo 2 falhar

O caminho mais rápido de volta é **rollback do deploy na Vercel** para o commit anterior
(`8ade22c`), que é o último que não conhece a tabela nova. Isso restaura o envio de
mensagens no comportamento antigo enquanto o problema da migration é investigado.

---

## Ressalva honesta sobre esta migration

Ela foi **gerada offline** com `prisma migrate diff`, porque o banco local esteve
indisponível durante toda a implementação. **Nunca rodou contra um Postgres real.**

O SQL foi revisado e é puramente aditivo — só `CREATE TYPE`, `CREATE TABLE`,
`CREATE INDEX`, `CREATE UNIQUE INDEX` e `ALTER TABLE ... ADD CONSTRAINT`. Nenhum `DROP`.
Mas é a primeira execução dela em qualquer lugar.

Se quiser reduzir o risco, aplique antes num projeto Supabase de teste apontando o
`DATABASE_URL` para lá. Considerando que as notificações já estão paradas, o custo de
esperar provavelmente supera o de aplicar.

---

## Ordem de grandeza do dano por passo pulado

- **Sem o passo 2:** nenhuma mensagem ao cliente sai. Grave.
- **Sem o passo 4:** as mensagens saem, mas todo tenant que tinha texto customizado
  recebe o padrão do sistema. O cliente final recebe algo diferente do que o dono do
  salão escreveu, e ninguém vai reportar — vai parecer que "mudou sozinho". Menos grave,
  mas não deixe pendente.

---

## Depois de aplicar

1. Apague este arquivo — ele existe só para sinalizar a pendência.
2. Remova o aviso `⚠️ 2026-07-26` da seção "Próximo passo crítico" do `CLAUDE.md`.
3. Valide abrindo Configurações › Notificações › "Mensagens ao cliente" (a aba deve
   carregar os 10 eventos) e conferindo um agendamento de teste ponta a ponta.
