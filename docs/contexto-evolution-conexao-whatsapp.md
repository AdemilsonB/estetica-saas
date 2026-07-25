# Contexto — Conexão do WhatsApp (Evolution API) não completa

> Documento de handoff para retomar/resolver o problema de conexão do WhatsApp via
> Evolution API. Escrito em 2026-07-25 (Opus 4.8) após sessão de `systematic-debugging`.
> **Objetivo:** dar ao próximo agente (Fable 5) todo o contexto para investigar com o
> mínimo de exploração — hipóteses já ranqueadas, com arquivo:linha e como confirmar cada uma.

---

## 1. Resumo executivo

O dono conecta o WhatsApp em **Configurações → WhatsApp → Conectar**. O fluxo:
`POST /connect` cria uma instância na Evolution (1 por tenant, nome = `tenantId`) → devolve o QR
→ dono escaneia → a Evolution chama um **webhook** de volta no app pra marcar `CONNECTED`.

**Sintoma:** o QR "só gerava uma vez e ficava carregando"; depois passou a dar **HTTP 422** no
`/connect`; e agora, com as env vars setadas, o QR **gera mas a conexão nunca completa**
(a instância na Evolution fica em `NOT CONNECTION` após ~30 regenerações de QR).

**Estado atual (o que já foi resolvido):**
- **Bug de UI** (QR não renovava, spinner infinito ao recarregar) → **PR #290 MERGEADA** em produção.
- **Erro engolido** (o "Conectar" não mostrava o motivo da falha) → **PR #291 MERGEADA** (toast).
- **422 no /connect** = env vars da Evolution faltavam no ambiente do deploy → **setadas em Production**
  (`EVOLUTION_API_URL`, `EVOLUTION_API_KEY`, `EVOLUTION_WEBHOOK_SECRET`) e redeploy feito. Após isso a
  Evolution passou a criar a instância e gerar QR (confirmado nos logs da Railway).

**O que falta (o problema aberto):** a instância gera QR mas **nunca pareia** (`NOT CONNECTION`).
As duas causas mais prováveis são **de configuração/integração do webhook**, detalhadas na seção 4.

---

## 2. Evidências coletadas (não re-derivar)

### 2.1 Logs da Vercel
- `POST /api/whatsapp/evolution/connect` → **422** às 11:43 (antes do redeploy com as env vars).
- **Deployment Information: `Environment: production`, `Branch: main`.** Ou seja, apesar da URL ter
  hash (`estetica-saas-product-kbzraytfp-...vercel.app`), **é o deployment de produção**.
- Vários `GET /api/whatsapp/evolution/status` → 200 (polling do painel, ok).

### 2.2 Environment Variables (Vercel)
- `EVOLUTION_API_URL`, `EVOLUTION_WEBHOOK_SECRET`, `EVOLUTION_API_KEY` presentes, escopo **Production**,
  "Updated 11m ago". **⚠️ Só marcadas para Production** — deploys de Preview não as recebem
  (o deploy de Preview do branch #291 deu **Error**, provavelmente por env inválido em Preview).
- **`APP_URL` não apareceu na lista visível** — precisa confirmar se existe (ver Hipótese H1, é crítico).

### 2.3 Logs da Railway (Evolution API v2.3.7)
```
[ChannelStartupService] { instance: cmr44kq4s000204iiq9ua1kc3, pairingCode: null, qrcodeCount: 30 }
<QR ASCII>
Browser: Evolution API,Chrome...   Baileys version: 2.3000.1043850389
[WAMonitoringService] Instance "cmr44kq4s000204iiq9ua1kc3" - NOT CONNECTION
```
Leitura: a Evolula **está acessível e funcionando** (instância criada, gerando QR). `qrcodeCount: 30`
= o QR foi regenerado ~30 vezes sem ninguém parear → o Baileys está prestes a desistir / já desistiu
(`NOT CONNECTION`). **O `tenantId` real observado é `cmr44kq4s000204iiq9ua1kc3`** (útil pra testes curl).

---

## 3. O que o código faz hoje (mapa rápido)

| Arquivo | Papel |
|---|---|
| `src/components/domain/settings/evolution-connection.tsx` | UI do card "Conectar WhatsApp". Já corrigida (#290/#291): busca/renova QR a cada 20s quando `CONNECTING`, botão "Gerar novo QR", toast de erro. |
| `src/hooks/settings/use-evolution-status.ts` | Hooks React Query: status (polling 3s em CONNECTING), connect, disconnect, qrcode (polling 20s). |
| `src/app/api/whatsapp/evolution/connect/route.ts` | `POST /connect`: valida env, deleta instância antiga, `createInstance`, **configura 2 webhooks**, grava `evolutionStatus=CONNECTING`. **Fonte dos 422** (linhas 19-24). Monta a URL do webhook com `process.env.APP_URL` (linhas 46, 53). |
| `src/app/api/whatsapp/evolution/qrcode/route.ts` | `GET /qrcode`: `getQrCode(instanceId)`. |
| `src/app/api/whatsapp/evolution/status/route.ts` | `GET /status`: lê `evolutionStatus` do tenant no banco. |
| `src/app/api/webhooks/evolution/connection/route.ts` | Recebe `connection.update` da Evolution e grava `CONNECTED`/`DISCONNECTED` no tenant. **É isso que precisa ser chamado pra sair de CONNECTING.** |
| `src/domains/notifications/providers/evolution.provider.ts` | Cliente HTTP da Evolution: `createInstance`, `configureWebhook`, `configureMessagesWebhook`, `getQrCode`, `getStatus`, `deleteInstance`. |
| `src/shared/config/env.ts` | Schema Zod das env. **`APP_URL` NÃO está aqui** (só `NEXT_PUBLIC_APP_URL`). |

Fluxo de status: `connection webhook` grava no banco → `GET /status` lê do banco → painel faz polling.
**Se o webhook não chega, o status fica preso em CONNECTING pra sempre**, mesmo que o celular tenha pareado.

---

## 4. Hipóteses ranqueadas (com como confirmar e corrigir)

### H1 — `APP_URL` não configurada na Vercel → webhook de conexão nunca é registrado  ⭐ mais provável
`connect/route.ts:46` monta:
```ts
const webhookUrl = `${process.env.APP_URL}/api/webhooks/evolution/connection?token=${webhookToken}`;
```
`APP_URL` **não está no `env.ts`** e é lida direto de `process.env`. Se não existir na Vercel, a URL vira
`undefined/api/webhooks/...` — inválida. A chamada `configureWebhook` é **best-effort** (o erro é
`catch`-ado em `connect/route.ts:47-50`), então o `/connect` **continua devolvendo o QR normalmente**,
mas **o webhook nunca é registrado** → a Evolution não tem pra onde avisar que conectou → status eterno
em CONNECTING.
- **Confirmar:** Vercel → Settings → Environment Variables → existe `APP_URL`? Valor esperado = o domínio
  público do app (ex.: `https://estetica-saas-product.vercel.app` ou o custom domain), **sem barra no fim**.
- **Confirmar no lado Evolution:** `GET {EVOLUTION_API_URL}/webhook/find/{tenantId}` (header `apikey`) —
  deve retornar a URL do webhook. Se vier vazio/errado, o webhook não foi registrado.
- **Corrigir:** setar `APP_URL` em **todos os ambientes** + redeploy. **Melhor ainda** (fix de código):
  adicionar `APP_URL` ao `env.ts` e **validar cedo** — hoje uma env crítica falha em silêncio.

### H2 — Formato do payload de webhook incompatível com Evolution API v2.3.7  ⭐ muito provável
`evolution.provider.ts:180-191` (`configureWebhook`) envia o formato **flat (v1.x)**:
```ts
POST /webhook/set/{instance}
{ url, webhook_by_events: true, webhook_base64: false, events: ["CONNECTION_UPDATE"] }
```
A Railway roda **Evolution v2.3.7**. No **v2** o endpoint `/webhook/set/{instance}` espera o payload
**aninhado**:
```jsonc
{ "webhook": { "enabled": true, "url": "...", "webhookByEvents": true, "webhookBase64": false, "events": ["CONNECTION_UPDATE"] } }
```
Se o formato estiver errado, a Evolution **ignora ou rejeita** o registro (e o erro é engolido pelo
`catch` do `/connect`). Note que `createInstance` (`evolution.provider.ts:160-178`) **já usa formato v2**
(`integration: "WHATSAPP-BAILEYS"`) e funciona — só o `configureWebhook`/`configureMessagesWebhook`
ficaram no formato antigo. **Inconsistência = forte suspeita.**
- **Confirmar:** rodar o `POST /webhook/set` manual nos dois formatos contra a API e ver qual retorna 200;
  depois `GET /webhook/find/{tenantId}` pra ver se persistiu.
- **Confirmar na doc:** `https://doc.evolution-api.com` (Webhook) na versão v2.
- **Corrigir:** trocar o payload de `configureWebhook`/`configureMessagesWebhook` pro formato aninhado v2.
  **Alternativa mais robusta:** registrar o webhook **inline no `createInstance`** (o v2 aceita `webhook`
  no corpo do `/instance/create`), eliminando as 2 chamadas separadas e o problema de ordem.

### H3 — Limite de QR do Baileys atingido (`qrcodeCount: 30`) → instância "morre"
O Baileys emite o QR um número limitado de vezes; ao estourar, fecha a conexão (`NOT CONNECTION`) e
**QRs novos não pareiam mais** até a instância ser recriada. Com o QR antigo travado na tela (bug já
corrigido no #290) o dono escaneava um código **expirado** repetidamente.
- **Mitigado por #290** (o painel agora renova o QR a cada 20s) e pelo botão **"Gerar novo QR"** (que faz
  `deleteInstance` + `createInstance`, zerando o `qrcodeCount`).
- **Ação:** ao testar, clicar em **"Gerar novo QR"** pra começar do zero e escanear em <20s.

### H4 — Deployment Protection da Vercel bloqueia o callback do webhook
O console mostra `manifest.json` sendo 307-redirecionado pra `vercel.com/sso-api` (CORS) — sinal de que
**Vercel Deployment Protection está ligada** no domínio acessado. Se `APP_URL` apontar pra um domínio
protegido, o `POST /api/webhooks/evolution/connection` **também** é redirecionado pro SSO e nunca chega
no app → status nunca vira CONNECTED (mesmo com H1/H2 corretos).
- **Confirmar:** Vercel → Settings → Deployment Protection. Testar `curl -i {APP_URL}/api/webhooks/evolution/connection`
  de fora — se responder 307 pra `vercel.com/sso`, está protegido.
- **Corrigir:** usar um domínio **sem** proteção pro app (custom domain / alias de produção) e apontar
  `APP_URL` pra ele; ou desligar a proteção; ou configurar Protection Bypass for Automation.

### H5 — Frontend mostrando QR estático (já resolvido, confirmar em produção)
Antes do #290 o QR era buscado uma única vez e não renovava. **Já corrigido e em produção.** Só validar
que, na tela atual, o QR troca sozinho a cada ~20s.

---

## 5. Roteiro de diagnóstico (rápido, com curl)

Com `EVOLUTION_API_URL`, `EVOLUTION_API_KEY` e o `tenantId` (`cmr44kq4s000204iiq9ua1kc3`) em mãos:

```bash
API=https://evolution-api-production-bccf.up.railway.app
KEY=<EVOLUTION_API_KEY>
INST=cmr44kq4s000204iiq9ua1kc3

# 1) Estado da instância (open = conectado; connecting; close)
curl -s -H "apikey: $KEY" "$API/instance/connectionState/$INST"

# 2) Webhook registrado? (H1/H2) — se vier vazio/errado, é aqui que quebra
curl -s -H "apikey: $KEY" "$API/webhook/find/$INST"

# 3) QR atual (o painel usa isto)
curl -s -H "apikey: $KEY" "$API/instance/connect/$INST" | head -c 300

# 4) Testar registro de webhook no formato v2 (H2)
curl -s -X POST -H "apikey: $KEY" -H "Content-Type: application/json" \
  "$API/webhook/set/$INST" \
  -d '{"webhook":{"enabled":true,"url":"https://SEU_APP/api/webhooks/evolution/connection?token=TESTE","webhookByEvents":true,"webhookBase64":false,"events":["CONNECTION_UPDATE"]}}'
```

E do lado da Vercel: `curl -i {APP_URL}/api/webhooks/evolution/connection` — deve responder **200/401**
do app (não 307 pra `vercel.com/sso`). Se der 307, é a H4.

---

## 6. Checklist de infra (ação do usuário, fora do código)

- [ ] `APP_URL` existe na Vercel, aponta pro domínio público do app, **sem barra no fim**, em **todos os ambientes**.
- [ ] `EVOLUTION_API_URL` (sem barra no fim), `EVOLUTION_API_KEY`, `EVOLUTION_WEBHOOK_SECRET` em **todos os ambientes** (hoje só Production).
- [ ] **Redeploy** após qualquer mudança de env.
- [ ] Acessar o app pelo **domínio de produção limpo** (sem hash), com **Deployment Protection OFF** nesse domínio.
- [ ] Testar com um **número de WhatsApp dedicado** do negócio (não o pessoal — risco de ban no modo QR).

---

## 7. Definição de "resolvido"

1. `POST /connect` retorna 200 com QR (sem 422).
2. O painel exibe QR que **renova sozinho**.
3. Ao escanear, em segundos o card vira **"WhatsApp conectado"** (status `CONNECTED`) — o que só acontece
   se o **webhook de conexão chegar no app** (H1/H2/H4 resolvidas).
4. `GET {EVOLUTION_API_URL}/instance/connectionState/{tenantId}` retorna `state: "open"`.
5. Bônus: **"Importar contatos"** funciona (usa a mesma instância).

---

## 8. Sugestão de ordem de ataque (menor custo primeiro)

1. **H1 + H4 (infra, sem código):** conferir `APP_URL` e Deployment Protection. Barato e resolve a maioria
   dos casos de "status preso em CONNECTING".
2. **H2 (código):** corrigir o formato do webhook pro v2 (ou registrar inline no `createInstance`). É o
   candidato de código mais provável e tem correção pequena e localizada em `evolution.provider.ts`.
3. Validar ponta a ponta com o roteiro da seção 5, clicando em **"Gerar novo QR"** (H3) antes de escanear.
4. Endurecer: adicionar `APP_URL` ao `env.ts` pra essa env crítica não falhar mais em silêncio.

---

## 9. Referências

- Código: ver o mapa da seção 3.
- Runbook de infra da Evolution (Oracle/Railway, docker-compose, env): `docs/infra-evolution-oracle.md`.
- Doc oficial Evolution API (confirmar schema de webhook da v2): `https://doc.evolution-api.com`.
- PRs desta investigação: **#290** (renovação do QR), **#291** (toast de erro no Conectar).
