# Design: Equipe — Vínculo de Serviços, Edição Completa e Foto do Profissional

**Data:** 2026-06-06  
**Autor:** Ademilson Bertolin  
**Status:** Aprovado

---

## Contexto

A aba de Equipe hoje permite apenas trocar o cargo de um colaborador. A seleção de profissional nos agendamentos não filtra por capacidade — qualquer profissional aparece para qualquer serviço. Não há foto de profissional nem edição completa de perfil.

Este design adiciona:
1. Vínculo profissional ↔ serviço (quem pode fazer o quê)
2. Edição completa do colaborador (nome, e-mail, cargo, serviços, foto)
3. Filtro de profissionais por serviço nos agendamentos (interno e online)
4. Upload de foto do profissional exibida na página pública de agendamento

---

## Decisões de Design

| Decisão | Escolha | Razão |
|---|---|---|
| Modelo de vínculo | Nova tabela `ProfessionalService` | Separa capacidade operacional de comissão financeira |
| Sincronização com comissão | Auto-cria `ServiceCommission` com `rate=0` | Facilita configuração financeira posterior sem retrabalho |
| Serviços no convite | Não — só após aceite | Convite não tem User ID; serviços são configurados na edição |
| Campos editáveis | Nome + e-mail + cargo + serviços + foto | Controle total do gestor sobre o perfil do membro |
| Fallback sem vínculo | Mostra todos + banner informativo | Nunca bloqueia agendamento; educa sem travar o fluxo |
| Storage de foto | Supabase Storage | Já utilizado no projeto; URL pública salva em `User.avatarUrl` |

---

## Modelo de Dados

### Nova tabela `ProfessionalService`

```prisma
model ProfessionalService {
  id        String   @id @default(cuid())
  tenantId  String
  userId    String
  serviceId String
  createdAt DateTime @default(now())

  tenant  Tenant  @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  user    User    @relation(fields: [userId], references: [id], onDelete: Cascade)
  service Service @relation(fields: [serviceId], references: [id], onDelete: Cascade)

  @@unique([tenantId, userId, serviceId])
  @@index([tenantId])
  @@index([tenantId, serviceId])
  @@index([tenantId, userId])
}
```

### Alterações no `User`

```prisma
avatarUrl            String?
professionalServices ProfessionalService[]
```

### Alterações no `Service`

```prisma
professionalServices ProfessionalService[]
```

### Invariantes

- `ServiceCommission` **não é deletado** ao remover `ProfessionalService` — pode conter histórico financeiro.
- Ao criar `ProfessionalService`, o service faz upsert de `ServiceCommission` com `rate=0` apenas se não existir — nunca sobrescreve comissão já configurada.

---

## Backend

### IAM Repository — métodos novos

```
updateUser(tenantId, userId, data)
  → data: { name?, email?, role?, avatarUrl? }

findUserServices(tenantId, userId)
  → ProfessionalService[] com Service incluído

setUserServices(tenantId, userId, serviceIds[])
  → deleta ProfessionalService existentes do user
  → createMany com os novos serviceIds
  → retorna lista atualizada

findProfessionalsByService(tenantId, serviceId)
  → User[] que têm ProfessionalService para o serviceId
  → retorna [] se nenhum vinculado (frontend decide o fallback)
```

### IAM Service — métodos novos

```
updateMember(tenantId, requesterId, targetId, input)
  → OWNER pode editar qualquer membro, inclusive si mesmo
  → MANAGER pode editar PROFESSIONAL e RECEPTIONIST; não pode editar OWNER ou outros MANAGER
  → valida que email não colide com outro usuário do tenant
  → chama repo.updateUser

setMemberServices(tenantId, userId, serviceIds[])
  → chama repo.setUserServices
  → para cada serviceId novo: upsert ServiceCommission com rate=0
```

### API Routes

| Método | Rota | Autorização | Corpo / Query |
|---|---|---|---|
| `PATCH` | `/api/iam/users/[userId]` | MANAGER+ | `{ name?, email?, role? }` |
| `GET` | `/api/iam/users/[userId]/services` | MANAGER+ | — |
| `PUT` | `/api/iam/users/[userId]/services` | MANAGER+ | `{ serviceIds: string[] }` |
| `POST` | `/api/iam/users/[userId]/avatar` | MANAGER+ (próprio) | `multipart/form-data` |
| `GET` | `/api/iam/users?serviceId=<id>` | autenticado | query param opcional |

### Upload de foto

- Bucket Supabase Storage: `professional-avatars`
- Path: `{tenantId}/{userId}/avatar.{ext}`
- Formatos aceitos: `jpg`, `png`, `webp`
- Tamanho máximo: 2 MB
- Ao fazer upload: salva URL pública em `User.avatarUrl`
- URL pública — sem expiração, acessível pelo cliente na página de agendamento online

### Filtro de profissionais em `/api/iam/users`

Query param `?serviceId=<cuid>`:
- Com `serviceId`: join com `ProfessionalService`, retorna só usuários vinculados + campo `filtered: true`
- Sem profissionais vinculados para o serviço: retorna `{ professionals: [], filtered: false }` → frontend aplica fallback

---

## Frontend

### Componentes modificados

**`team-member-card.tsx`**
- Adiciona botão "Editar" (visível para OWNER e MANAGER; OWNER vê no próprio card)
- Adiciona badges dos serviços vinculados abaixo do e-mail
- Remove dropdown de cargo inline (a edição migra para o modal)

**`create-appointment-modal.tsx`**
- Ao selecionar serviço: chama `GET /api/iam/users?serviceId=<id>`
- Se `filtered: true`: renderiza profissionais normalmente
- Se `filtered: false` (nenhum vínculo): renderiza todos os profissionais + banner amarelo

### Componentes novos

**`edit-member-modal.tsx`**
```
- Campo: Nome (text input)
- Campo: E-mail (text input)
- Campo: Cargo (select: MANAGER / PROFESSIONAL / RECEPTIONIST; OWNER não aparece)
- Seção: Foto (AvatarUpload — só no modal de edição, não no convite)
- Seção: Serviços que realiza (MemberServicesSelector — checkboxes)
- Ações: Cancelar | Salvar alterações
```

**`avatar-upload.tsx`**
- File picker nativo (jpg/png/webp, max 2 MB)
- Preview imediato após seleção
- Ao salvar o modal: POST para `/api/iam/users/[userId]/avatar`
- Fallback: iniciais do nome quando `avatarUrl` é null

**`member-services-selector.tsx`**
- Lista todos os serviços ativos do tenant (via `GET /api/catalog/services`)
- Checkbox por serviço
- Estado inicial carregado de `GET /api/iam/users/[userId]/services`

### Hooks novos/atualizados

| Hook | Arquivo | Mudança |
|---|---|---|
| `use-team.ts` | existente | adiciona `updateMember`, `uploadAvatar` |
| `use-member-services.ts` | novo | `useGetMemberServices(userId)`, `useSetMemberServices()` |

### Página pública de agendamento

Duas mudanças cirúrgicas:
1. Profissionais carregados com `?serviceId=` — aplicar mesmo filtro + fallback
2. Card do profissional: exibe `<img src={avatarUrl}>` se disponível, fallback para iniciais

---

## Fluxo de Permissões

| Ação | OWNER | MANAGER | PROFESSIONAL | RECEPTIONIST |
|---|---|---|---|---|
| Editar qualquer membro | ✅ | ✅ (exceto OWNER/MANAGER) | ❌ | ❌ |
| Editar a si mesmo | ✅ | ✅ | ❌ | ❌ |
| Vincular serviços | ✅ | ✅ | ❌ | ❌ |
| Fazer upload de foto | ✅ | ✅ (membros que pode editar) | ❌ | ❌ |

---

## Fora do Escopo

- Refatoração geral da página pública de agendamento online
- Ordenação/prioridade de profissionais por serviço
- Foto no fluxo de convite
- Remoção de membros da equipe
- Gestão de comissões (já existe, não é afetada)
