# Banco de Dados — Portabilidade, Escala e Migracao

> Este documento define como devemos tratar a camada de dados para que o SaaS consiga crescer no Supabase agora, mas permaneça facil de migrar no futuro para outra hospedagem ou operacao propria.

---

## Objetivo

Usar o Supabase hoje como acelerador de MVP e operacao inicial, sem criar dependencias desnecessarias que dificultem migracao futura.

O principio central e:

**Nosso banco e Postgres primeiro. Supabase e a plataforma gerenciada atual.**

---

## Leitura estrategica sobre o Supabase

O Supabase e uma boa escolha para o inicio porque entrega:

- PostgreSQL gerenciado
- Auth
- Realtime
- Storage
- painel administrativo
- operacao simplificada

Para o MVP e fase inicial de crescimento isso reduz custo, tempo de setup e carga operacional.

Ao mesmo tempo, precisamos assumir desde o inicio que:

- o banco deve continuar sendo tratado como PostgreSQL padrao
- a modelagem nao pode depender de truques inseguros de fornecedor
- toda decisao critica de negocio deve continuar portavel

---

## O que queremos preservar no futuro

Se o projeto crescer e precisarmos sair do Supabase, a migracao ideal deve permitir:

1. mover schema e dados com baixo risco
2. mover autenticacao com o menor atrito possivel
3. trocar hospedagem sem reescrever os dominios
4. manter o modelo multi-tenant intacto
5. preservar historico transacional, auditoria e operacao

---

## Regras obrigatorias para o banco

### 1. Modelagem sempre portavel

- Toda entidade de negocio deve usar `tenantId`
- Toda tabela de negocio deve possuir `@@index([tenantId])`
- Toda chave primaria deve ser explicita e estavel
- Evitar modelagem dependente de recursos exclusivos do painel do fornecedor
- Preferir tipos SQL e modelagem comuns ao ecossistema Postgres

### 2. Prisma como contrato principal da persistencia

- O schema oficial do dominio vive em `prisma/schema.prisma`
- Toda mudanca estrutural deve virar migration versionada
- Nao depender de alteracoes manuais feitas apenas no painel do Supabase
- O estado do banco deve ser reproduzivel localmente e em qualquer ambiente

### 3. Multi-tenancy obrigatoria

- `tenantId` nunca pode ser opcional nas entidades de negocio
- repositories sempre filtram por `tenantId`
- `tenantId` nunca vem do body ou da URL
- `tenantId` sempre vem da sessao autenticada

### 4. RLS com cautela

O Supabase oferece RLS e isso pode ser muito util, mas devemos usar com disciplina.

Diretriz:

- a seguranca principal da regra de negocio continua existindo na aplicacao
- RLS deve reforcar isolamento, nao substituir arquitetura
- evitar acoplamento excessivo a policies impossiveis de reproduzir fora do ambiente atual

Em outras palavras:

**RLS e camada adicional de protecao, nao o unico lugar onde a regra vive.**

### 5. Nada de logica critica espalhada no banco sem necessidade

- Evitar triggers complexas que escondem comportamento de negocio
- Evitar procedures que virem dependencia de produto
- Se algo for critico para o dominio, a regra deve estar visivel na camada de service

Podemos usar recursos SQL quando fizer sentido tecnico, mas a logica principal precisa continuar clara e portavel.

---

## O que e facil migrar no futuro

Se mantivermos essa disciplina, tende a ser simples migrar:

- schema Postgres
- dados de negocio
- historico transacional
- migrations
- boa parte da estrutura multi-tenant

---

## O que costuma dar mais trabalho na migracao

Precisamos minimizar dependencia nestes pontos:

- policies RLS muito acopladas ao Supabase Auth
- uso direto e espalhado do SDK do Supabase para acesso critico aos dados
- storage fortemente acoplado ao fornecedor
- realtime essencial para fluxo central sem adapter
- configuracoes feitas manualmente e nao documentadas
- auth e claims sem padronizacao clara

---

## Medidas preventivas desde agora

### Estrutura

- manter `Prisma` como camada oficial de persistencia
- centralizar acesso ao banco em repositories
- centralizar sessao e tenant em adapters de auth
- versionar migrations desde o primeiro ciclo

### Governanca

- nunca alterar schema apenas pelo painel
- nunca confiar em conhecimento implicito sobre configuracoes remotas
- documentar qualquer extensao, policy ou dependencia especial
- revisar impacto de portabilidade antes de adotar recurso novo do fornecedor

### Dados

- ter rotina de backup/export documentada
- garantir que restauracao seja testavel
- prever seeds minimos para ambiente local e homologacao

---

## Variaveis de ambiente do banco

Toda conexao e configuracao deve vir por `.env`.

Exemplo minimo:

```env
DATABASE_URL=postgresql://user:password@host:5432/database
DIRECT_URL=postgresql://user:password@host:5432/database
SUPABASE_URL=https://project-ref.supabase.co
SUPABASE_ANON_KEY=public-anon-key
SUPABASE_SERVICE_ROLE_KEY=service-role-key
```

Diretrizes:

- nunca hardcodar credenciais
- nunca commitar `.env`
- commitar apenas `.env.example`
- separar variaveis por responsabilidade
- manter nomes consistentes entre local, preview e producao

`DATABASE_URL`:
- usada pelo Prisma e pela aplicacao para acesso principal

`DIRECT_URL`:
- usada quando precisarmos de conexao direta para migration, introspection ou tarefas administrativas

`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`:
- usadas pelos adapters de integracao com Supabase

---

## Estrategia futura de migracao

Se houver necessidade de sair do Supabase, a ordem ideal e:

1. congelar dependencias especificas do fornecedor
2. exportar schema e dados do Postgres
3. restaurar em novo Postgres gerenciado ou self-hosted
4. migrar Auth e revisar JWT/claims
5. trocar adapters de auth, storage, realtime e jobs
6. validar aplicacao sem mexer nos dominios

O objetivo e que a migracao seja principalmente:

- infra
- configuracao
- adapters

e nao reescrita de regra de negocio.

---

## Resumo executivo

O banco deve ser desenhado para:

- crescer bem no Supabase agora
- continuar sendo PostgreSQL padrao
- manter multi-tenancy desde o inicio
- permitir exportacao, restauracao e troca de hospedagem
- evitar lock-in arquitetural

Se precisarmos escalar depois, queremos trocar a plataforma com o minimo possivel de mudanca nos dominios e services.
