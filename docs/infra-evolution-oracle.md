# Runbook — Evolution API na Oracle Cloud (Always Free)

> Como subir **um** servidor Evolution API (que atende todos os tenants do Agendê,
> 1 instância por tenant) de graça na Oracle Cloud, e conectá-lo ao app.
>
> ⚠️ **Versões mudam.** O `docker-compose` e as variáveis do Evolution abaixo são
> um ponto de partida testado com a v2; **confirme sempre com a doc oficial**
> (`https://doc.evolution-api.com`) a tag de imagem e o schema de env da versão atual.
> As partes **específicas da Oracle** (rede/firewall) são estáveis e são o que
> mais dá dor de cabeça — foque nelas.

---

## Visão geral (o que você vai ter no fim)

```
Internet ──HTTPS──> [ Oracle VM (ARM, Ubuntu) ]
                      ├─ Caddy (443)  → reverse proxy → Evolution API (8080)
                      ├─ Evolution API (Docker)
                      ├─ PostgreSQL (Docker)
                      └─ Redis (Docker)
Agendê (Vercel) ──> EVOLUTION_API_URL = https://evolution.seudominio.com
Evolution ──webhooks──> https://seu-agende.vercel.app/api/webhooks/evolution/*
```

Custo de infra: **R$0** (Oracle Always Free) + o domínio (se ainda não tiver).

---

## Parte A — Criar a VM gratuita na Oracle

1. Crie conta em `https://www.oracle.com/cloud/free/` (pede cartão só para
   verificação; **Always Free não cobra**). Escolha a **home region** com cuidado
   (não dá pra mudar depois) — prefira uma com capacidade ARM (ex.: São Paulo,
   ou US East).
2. Menu → **Compute → Instances → Create instance**.
3. **Image and shape:**
   - Image: **Canonical Ubuntu 22.04**.
   - Shape: **Ampere (ARM) — VM.Standard.A1.Flex**. Ajuste para **2 OCPU / 12 GB**
     (dentro do Always Free; 1 OCPU/6 GB também roda). *Evite* o E2.1.Micro (1 GB,
     pouco pra Evolution + Postgres).
   - Se aparecer "Out of capacity" no ARM, tente outra Availability Domain ou
     outra região, ou repita mais tarde (é comum no free ARM).
4. **Add SSH keys:** gere um par e **guarde a chave privada** (você vai usar pra
   entrar). Se não tiver, use "Generate a key pair for me" e baixe as duas.
5. Deixe rede padrão (cria uma VCN + subnet pública + IP público). **Create.**
6. Quando ficar "Running", anote o **Public IP address**.
7. Entre por SSH:
   ```bash
   ssh -i caminho/para/sua-chave.key ubuntu@SEU_IP_PUBLICO
   ```

---

## Parte B — Firewall (⚠️ a pegadinha da Oracle: são DOIS firewalls)

A Oracle bloqueia tudo por padrão em **duas camadas**. Você precisa abrir as portas
**80 e 443** nas duas, senão o HTTPS nunca conecta.

**B.1 — Firewall da nuvem (Security List da VCN):**
1. Console → **Networking → Virtual Cloud Networks →** sua VCN **→ Subnet →
   Security Lists → Default Security List**.
2. **Add Ingress Rules** (Source CIDR `0.0.0.0/0`, IP Protocol TCP):
   - Destination Port **80**
   - Destination Port **443**
   (A 22/SSH já vem aberta.)

**B.2 — Firewall do sistema operacional (a imagem Ubuntu da Oracle bloqueia por iptables):**
```bash
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 80 -j ACCEPT
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 443 -j ACCEPT
sudo netfilter-persistent save
```
> Sem o B.2, o ping/porta parece "aberto" na Oracle mas o SO derruba a conexão —
> é o erro nº1 de quem sobe VM na Oracle.

---

## Parte C — Domínio + DNS

O Evolution precisa ser HTTPS com domínio (o app o consome e os webhooks exigem).
1. Num domínio seu, crie um registro **A**: `evolution.seudominio.com.br → SEU_IP_PUBLICO`.
2. Espere propagar (minutos). Teste: `ping evolution.seudominio.com.br` deve
   resolver para o IP.

---

## Parte D — Instalar Docker

```bash
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker ubuntu
# saia e entre de novo no SSH para o grupo valer
exit
```

---

## Parte E — Subir Evolution + Postgres + Redis + Caddy (HTTPS automático)

Crie uma pasta e dois arquivos:

```bash
mkdir ~/evolution && cd ~/evolution
```

**`docker-compose.yml`** (confirme a tag da imagem e as envs na doc oficial):
```yaml
services:
  evolution-api:
    image: atendai/evolution-api:v2.1.1   # <-- confira a versão atual na doc
    restart: always
    depends_on: [postgres, redis]
    environment:
      - SERVER_URL=https://evolution.seudominio.com.br
      - AUTHENTICATION_API_KEY=TROQUE_POR_UMA_CHAVE_FORTE   # = seu EVOLUTION_API_KEY
      - DATABASE_ENABLED=true
      - DATABASE_PROVIDER=postgresql
      - DATABASE_CONNECTION_URI=postgresql://evo:evo_pass@postgres:5432/evolution
      - DATABASE_CONNECTION_CLIENT_NAME=evolution
      - CACHE_REDIS_ENABLED=true
      - CACHE_REDIS_URI=redis://redis:6379/6
      - CACHE_REDIS_PREFIX_KEY=evolution
      - CACHE_LOCAL_ENABLED=false
    expose: ["8080"]

  postgres:
    image: postgres:15
    restart: always
    environment:
      - POSTGRES_USER=evo
      - POSTGRES_PASSWORD=evo_pass
      - POSTGRES_DB=evolution
    volumes: [postgres_data:/var/lib/postgresql/data]

  redis:
    image: redis:7
    restart: always
    volumes: [redis_data:/data]

  caddy:
    image: caddy:2
    restart: always
    ports: ["80:80", "443:443"]
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile
      - caddy_data:/data
    depends_on: [evolution-api]

volumes:
  postgres_data:
  redis_data:
  caddy_data:
```

**`Caddyfile`** (Caddy pega o certificado Let's Encrypt sozinho):
```
evolution.seudominio.com.br {
    reverse_proxy evolution-api:8080
}
```

Suba:
```bash
docker compose up -d
docker compose logs -f evolution-api   # acompanhe até subir; Ctrl+C pra sair
```

Teste no navegador: `https://evolution.seudominio.com.br` deve responder (cadeado
verde). Se der erro de porta/HTTPS → revise a **Parte B** (os dois firewalls).

> 🔐 Troque `AUTHENTICATION_API_KEY` e a senha do Postgres por valores fortes
> (ex.: `openssl rand -hex 24`). A `AUTHENTICATION_API_KEY` é o seu `EVOLUTION_API_KEY`.

---

## Parte F — Conectar ao Agendê (Vercel)

Na Vercel → **Settings → Environment Variables** (Production), adicione:
| Variável | Valor |
|---|---|
| `EVOLUTION_API_URL` | `https://evolution.seudominio.com.br` |
| `EVOLUTION_API_KEY` | a mesma `AUTHENTICATION_API_KEY` do compose |
| `EVOLUTION_WEBHOOK_SECRET` | um segredo seu novo — `openssl rand -hex 32` |

**Redeploy** o app. Depois, no Agendê: **Configurações → WhatsApp → Conectar** →
aparece o QR Code → escaneie com o **número dedicado** do negócio (não o pessoal).
Em seguida teste **Importar contatos**.

---

## Parte G — Cuidados e manutenção

- **Número dedicado + sem spam.** Modo QR é não-oficial; risco de ban é real.
  Respeite opt-in, evite disparo em massa. Migre para a Cloud API oficial quando
  o volume crescer.
- **Backup do Postgres do Evolution** (as sessões/instâncias vivem nele):
  `docker compose exec postgres pg_dump -U evo evolution > backup.sql` periodicamente.
- **Atualizar Evolution:** troque a tag da imagem, `docker compose pull && docker compose up -d`.
- **Always Free não pausa** por inatividade (diferente do free do Supabase), mas a
  Oracle pode reclamar capacidade ARM raramente — monitore.
- Mantenha o SO atualizado: `sudo apt update && sudo apt upgrade -y`.

---

## Se travar

- **HTTPS não conecta / timeout:** 99% é a **Parte B** (faltou abrir 80/443 na
  Security List *ou* no iptables do SO). Confira as duas.
- **Caddy não pega certificado:** o domínio precisa apontar pro IP **antes** de
  subir o Caddy, e a porta 80 precisa estar aberta (Let's Encrypt usa a 80).
- **App não conecta no Evolution:** teste `curl https://evolution.seudominio.com.br`
  de fora; confira `EVOLUTION_API_URL` (sem barra no fim) e a `EVOLUTION_API_KEY`.
