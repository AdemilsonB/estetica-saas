# Aplicacao — Portabilidade, `.env` e Responsividade

> Este documento define como a aplicacao deve ser estruturada para crescer como SaaS operacional, permanecer facil de mover para outra hospedagem e continuar adequada ao uso mobile descrito na arquitetura do projeto.

---

## Objetivo

Construir uma aplicacao que seja:

- modular
- portavel
- configuravel por ambiente
- preparada para operacao maior no futuro
- responsiva com foco real em uso mobile

---

## Principio central da aplicacao

A aplicacao nao pode depender estruturalmente da hospedagem atual.

Hoje podemos usar:

- Vercel
- Supabase
- servicos gerenciados simples

Mas o codigo deve continuar apto a rodar depois em:

- VPS
- Docker
- ECS
- Kubernetes
- outro provedor de Postgres, Auth, Storage ou Realtime

Em resumo:

**Dominios de negocio nao podem ficar presos ao fornecedor.**

---

## Regras obrigatorias de arquitetura

### 1. Dominios desacoplados

- toda logica de negocio fica em `src/domains`
- componentes React nao carregam regra de negocio
- API Routes continuam finas
- repositories lidam com dados
- services lidam com regras e eventos

### 2. Integracoes isoladas

Tudo que for especifico de plataforma deve viver em adapters ou integrations.

Exemplos desejados:

- `src/integrations/supabase/auth`
- `src/integrations/supabase/storage`
- `src/integrations/supabase/realtime`
- `src/integrations/whatsapp/evolution`

Nunca espalhar:

- SDK do Supabase dentro de dominios
- acesso direto a storage em componentes aleatorios
- dependencia de provider em services centrais sem interface clara

### 3. Aplicacao stateless

A aplicacao deve ser facil de replicar horizontalmente.

Portanto:

- nao guardar estado critico em memoria local
- nao depender de instancia unica
- nao usar memoria do processo como fonte oficial de verdade
- usar banco, fila e providers externos para persistencia real

### 4. Configuracao 100% por ambiente

- toda configuracao vem de `.env`
- nada de URL fixa no codigo
- nada de segredo hardcodado
- nada de comportamento especial escondido por ambiente

---

## Uso de `.env`

O `.env` e parte da arquitetura, nao apenas conveniencia local.

Ele existe para:

- facilitar onboarding
- separar ambientes
- permitir troca de provedor
- centralizar configuracao operacional

### Regras obrigatorias

- commitar `.env.example`
- nunca commitar `.env`
- documentar toda variavel nova
- manter nomes semanticos e estaveis
- validar configuracao ao subir a aplicacao

### Estrutura sugerida

```env
# App
NODE_ENV=development
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Database
DATABASE_URL=postgresql://user:password@host:5432/database
DIRECT_URL=postgresql://user:password@host:5432/database

# Supabase
SUPABASE_URL=https://project-ref.supabase.co
SUPABASE_ANON_KEY=public-anon-key
SUPABASE_SERVICE_ROLE_KEY=service-role-key

# Auth
AUTH_JWT_SECRET=change-me

# Queue / jobs
PG_BOSS_SCHEMA=pgboss

# Integracoes
EVOLUTION_API_URL=https://provider.example.com
EVOLUTION_API_KEY=secret
```

### Conduta esperada

- variaveis `NEXT_PUBLIC_*` apenas para o que realmente precisa ir ao client
- segredos ficam apenas no servidor
- toda integracao externa deve depender de env vars
- se trocarmos de fornecedor, trocamos configuracao e adapter antes de pensar em reescrever dominio

---

## Portabilidade de hospedagem

Para facilitar mudanca futura de infraestrutura, devemos preparar:

### 1. Execucao padrao Node

- o projeto deve rodar fora da Vercel
- evitar dependencias desnecessarias de runtime exclusivo
- preferir APIs compativeis com ambiente Node padrao

### 2. Preparacao para container

Mesmo que nao usemos Docker imediatamente, a estrutura deve permitir:

- criar `Dockerfile`
- subir em ambiente containerizado
- configurar env vars externamente
- escalar horizontalmente

### 3. Dependencias substituiveis

Precisamos pensar nos providers como pecas trocaveis:

- Auth provider
- Storage provider
- Realtime provider
- Job queue provider
- Notification provider

Os dominios devem depender de contrato, nao do SDK concreto.

---

## Responsividade e uso mobile

Esta parte e obrigatoria desde agora.

Os documentos do projeto deixam claro:

- profissionais usam muito no mobile
- gestores usam mais no desktop

Isso significa que o produto nao pode ser apenas “desktop encolhido”.

### Regra principal

**Fluxos operacionais devem nascer mobile-first.**

Especialmente:

- agenda
- criar agendamento
- confirmar atendimento
- concluir atendimento
- consultar cliente
- registrar observacoes rapidas

### O que isso significa na pratica

- comecar layout pelo menor breakpoint
- priorizar acoes de alto uso no rodape ou area de facil toque
- reduzir numero de toques por fluxo
- transformar tabelas complexas em cards/listas no mobile
- usar formularios curtos e objetivos
- evitar modais pesados em telas pequenas
- garantir leitura, contraste e targets de toque adequados

### Shell de navegacao recomendado

Para a aplicacao principal:

- mobile: bottom navigation ou drawer simples
- tablet: navegação adaptativa
- desktop: sidebar fixa com area de trabalho ampla

### Prioridade de experiencia

1. agenda semanal e diaria
2. fluxo de criacao de agendamento
3. consulta de clientes
4. atualizacao de status do atendimento
5. financeiro simplificado

Dashboard com muitos graficos vem depois da operacao principal estar excelente no mobile.

---

## Diretrizes de UX responsiva

- loading states claros
- empty states uteis
- error states acionaveis
- formularios com labels claras
- componentes com toque confortavel
- tipografia legivel em telas pequenas
- filtros compactos e expandiveis
- acoes criticas com confirmacao explicita

### Metas praticas do produto

- criar agendamento em ate 3 passos
- confirmar atendimento com poucos toques
- concluir atendimento sem navegar por varias telas
- encontrar um cliente rapidamente no mobile

---

## Checklist de implementacao para novas features

Antes de subir qualquer feature nova, validar:

- [ ] dominio sem acoplamento ao fornecedor
- [ ] configuracao por `.env`
- [ ] segredos fora do codigo
- [ ] service separado de component
- [ ] fluxo mobile-first pensado desde o inicio
- [ ] layout funcional em mobile e desktop
- [ ] estados de loading, error e empty previstos
- [ ] integracao externa encapsulada em adapter

---

## Resumo executivo

A aplicacao deve crescer com tres compromissos:

1. **Portabilidade**
   codigo preparado para mudar de hospedagem e fornecedor sem reescrever os dominios

2. **Configuracao limpa**
   uso consistente de `.env` para banco, auth, filas, URLs e integracoes

3. **Responsividade real**
   operacao principal desenhada para mobile, sem sacrificar a experiencia desktop

Se seguirmos isso desde agora, o SaaS fica mais robusto, mais facil de operar e muito mais simples de escalar no futuro.
