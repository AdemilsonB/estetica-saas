# Equipe — Vínculo de Serviços, Edição Completa e Foto do Profissional

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar vínculo de serviços por profissional, edição completa de colaboradores (nome/e-mail/cargo/serviços/foto) e filtro de profissionais por serviço nos agendamentos interno e público.

**Architecture:** Nova tabela `ProfessionalService` como relação de capacidade operacional, independente da tabela `ServiceCommission` (financeiro). Ao vincular um serviço, cria `ServiceCommission` com `rate=0` via `createMany + skipDuplicates` para não sobrescrever comissões já configuradas. Filtro de profissionais por serviço com fallback permissivo (mostra todos + banner quando nenhum está vinculado).

**Tech Stack:** Next.js 15, Prisma, TypeScript strict, TanStack Query, Shadcn UI, Supabase Storage, Vitest, prismaMock (vitest-mock-extended)

**Spec:** `docs/superpowers/specs/2026-06-06-equipe-servicos-foto-design.md`

---

## Mapa de Arquivos

**Criados:**
- `prisma/migrations/[auto]/migration.sql` — gerada pelo Prisma
- `src/app/api/iam/users/[userId]/services/route.ts` — GET + PUT serviços do membro
- `src/app/api/iam/users/[userId]/avatar/route.ts` — POST upload de foto
- `src/hooks/iam/use-member-services.ts` — query + mutation de serviços por membro
- `src/components/domain/iam/edit-member-modal.tsx` — modal de edição completa
- `src/components/domain/iam/member-services-selector.tsx` — seletor de serviços (checkboxes)
- `src/components/domain/iam/avatar-upload.tsx` — upload de foto com preview

**Modificados:**
- `prisma/schema.prisma` — modelo ProfessionalService + campo avatarUrl em User
- `src/domains/iam/iam.repository.ts` — updateUser, findUserServices, setUserServices, findProfessionalsByService
- `src/domains/iam/iam.repository.test.ts` — testes dos novos métodos
- `src/domains/iam/iam.service.ts` — updateMember, setMemberServices
- `src/domains/iam/iam.service.test.ts` — testes dos novos métodos
- `src/app/api/iam/users/route.ts` — query param serviceId
- `src/app/api/iam/users/[userId]/route.ts` — PATCH estendido (name/email/avatarUrl)
- `src/hooks/iam/use-team.ts` — tipos TeamMember + mutations updateMember, uploadAvatar + hook useProfessionalsByService
- `src/components/domain/iam/team-member-card.tsx` — botão Editar + badges de serviços
- `src/components/domain/scheduling/create-appointment-modal.tsx` — filtro por serviço
- `src/app/(public)/agendar/[slug]/page.tsx` — inclui avatarUrl e serviceIds nos profissionais
- `src/app/(public)/agendar/[slug]/types.ts` — tipo PublicProfessional atualizado
- `src/app/(public)/agendar/[slug]/booking-client.tsx` — filtra profissionais por serviço

---

## Task 1: Schema Prisma — ProfessionalService + avatarUrl

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Adicionar modelo ProfessionalService e campo avatarUrl ao schema**

Abrir `prisma/schema.prisma` e fazer as seguintes adições:

No modelo `User`, após o campo `permissions`:
```prisma
avatarUrl            String?
professionalServices ProfessionalService[]
```

No modelo `Service` (encontrar o modelo), adicionar ao final antes de `@@`:
```prisma
professionalServices ProfessionalService[]
```

Adicionar o novo modelo ao final do arquivo (antes do último `}`):
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

- [ ] **Step 2: Gerar e aplicar migration**

```bash
npx prisma migrate dev --name add_professional_service_avatar
```

Saída esperada: migration aplicada, Prisma Client regenerado.

- [ ] **Step 3: Verificar que o Prisma Client reconhece o novo modelo**

```bash
npx tsc --noEmit
```

Saída esperada: 0 erros.

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat(iam): adiciona ProfessionalService e avatarUrl ao User no schema"
```

---

## Task 2: IAM Repository — novos métodos

**Files:**
- Modify: `src/domains/iam/iam.repository.ts`
- Modify: `src/domains/iam/iam.repository.test.ts`

- [ ] **Step 1: Escrever testes que falham**

Abrir `src/domains/iam/iam.repository.test.ts` e adicionar ao final do arquivo:

```typescript
import { prismaMock } from '@/shared/test/prisma-mock'
import { IamRepository } from './iam.repository'

// ... (describe blocks existentes permanecem)

const TENANT_ID = 'tenant-abc'
const USER_ID = 'user-123'
const SERVICE_ID = 'service-456'

describe('IamRepository.updateUser', () => {
  let repo: IamRepository
  beforeEach(() => { repo = new IamRepository() })

  it('chama updateMany com tenantId e userId e retorna usuário atualizado', async () => {
    prismaMock.user.updateMany.mockResolvedValue({ count: 1 })
    prismaMock.user.findFirst.mockResolvedValue({
      id: USER_ID, name: 'Novo Nome', email: 'novo@email.com',
      role: 'PROFESSIONAL', avatarUrl: null, roleId: null,
      customRole: null, createdAt: new Date(),
    } as any)

    const result = await repo.updateUser(TENANT_ID, USER_ID, { name: 'Novo Nome' })

    expect(prismaMock.user.updateMany).toHaveBeenCalledWith({
      where: { id: USER_ID, tenantId: TENANT_ID },
      data: { name: 'Novo Nome' },
    })
    expect(result?.name).toBe('Novo Nome')
  })
})

describe('IamRepository.findUserServices', () => {
  let repo: IamRepository
  beforeEach(() => { repo = new IamRepository() })

  it('retorna lista de serviços vinculados ao profissional', async () => {
    prismaMock.professionalService.findMany.mockResolvedValue([
      { id: 'ps-1', tenantId: TENANT_ID, userId: USER_ID, serviceId: SERVICE_ID,
        createdAt: new Date(), service: { id: SERVICE_ID, name: 'Corte' } },
    ] as any)

    const result = await repo.findUserServices(TENANT_ID, USER_ID)

    expect(prismaMock.professionalService.findMany).toHaveBeenCalledWith({
      where: { tenantId: TENANT_ID, userId: USER_ID },
      include: { service: { select: { id: true, name: true } } },
    })
    expect(result).toHaveLength(1)
  })
})

describe('IamRepository.setUserServices', () => {
  let repo: IamRepository
  beforeEach(() => { repo = new IamRepository() })

  it('deleta todos os vínculos atuais e cria os novos dentro de uma transaction', async () => {
    const mockTx = {
      professionalService: {
        deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
        createMany: vi.fn().mockResolvedValue({ count: 2 }),
        findMany: vi.fn().mockResolvedValue([
          { id: 'ps-1', service: { id: 'svc-1', name: 'Corte' } },
          { id: 'ps-2', service: { id: 'svc-2', name: 'Barba' } },
        ]),
      },
    }
    prismaMock.$transaction.mockImplementation((fn: any) => fn(mockTx))

    const result = await repo.setUserServices(TENANT_ID, USER_ID, ['svc-1', 'svc-2'])

    expect(mockTx.professionalService.deleteMany).toHaveBeenCalledWith({
      where: { tenantId: TENANT_ID, userId: USER_ID },
    })
    expect(mockTx.professionalService.createMany).toHaveBeenCalledWith({
      data: [
        { tenantId: TENANT_ID, userId: USER_ID, serviceId: 'svc-1' },
        { tenantId: TENANT_ID, userId: USER_ID, serviceId: 'svc-2' },
      ],
      skipDuplicates: true,
    })
    expect(result).toHaveLength(2)
  })

  it('quando serviceIds é vazio, apenas deleta os vínculos', async () => {
    const mockTx = {
      professionalService: {
        deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
        createMany: vi.fn(),
        findMany: vi.fn().mockResolvedValue([]),
      },
    }
    prismaMock.$transaction.mockImplementation((fn: any) => fn(mockTx))

    const result = await repo.setUserServices(TENANT_ID, USER_ID, [])

    expect(mockTx.professionalService.createMany).not.toHaveBeenCalled()
    expect(result).toHaveLength(0)
  })
})

describe('IamRepository.findProfessionalsByService', () => {
  let repo: IamRepository
  beforeEach(() => { repo = new IamRepository() })

  it('retorna profissionais vinculados ao serviço', async () => {
    prismaMock.user.findMany.mockResolvedValue([
      { id: USER_ID, name: 'João', email: 'joao@test.com', role: 'PROFESSIONAL',
        avatarUrl: null, roleId: null, customRole: null, createdAt: new Date() },
    ] as any)

    const result = await repo.findProfessionalsByService(TENANT_ID, SERVICE_ID)

    expect(prismaMock.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId: TENANT_ID,
          professionalServices: { some: { tenantId: TENANT_ID, serviceId: SERVICE_ID } },
        }),
      })
    )
    expect(result).toHaveLength(1)
  })

  it('retorna array vazio quando nenhum profissional está vinculado', async () => {
    prismaMock.user.findMany.mockResolvedValue([])
    const result = await repo.findProfessionalsByService(TENANT_ID, SERVICE_ID)
    expect(result).toHaveLength(0)
  })
})
```

- [ ] **Step 2: Rodar testes para verificar que falham**

```bash
npx vitest run src/domains/iam/iam.repository.test.ts
```

Saída esperada: FAIL — métodos não existem.

- [ ] **Step 3: Implementar os novos métodos no repository**

Abrir `src/domains/iam/iam.repository.ts` e adicionar os métodos abaixo dentro da classe `IamRepository`, após o método `updateUserRoleById`:

```typescript
async updateUser(
  tenantId: string,
  userId: string,
  data: { name?: string; email?: string; avatarUrl?: string | null },
) {
  await prisma.user.updateMany({ where: { id: userId, tenantId }, data })
  return prisma.user.findFirst({
    where: { id: userId, tenantId },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      avatarUrl: true,
      roleId: true,
      customRole: { select: { name: true } },
      createdAt: true,
    },
  })
}

async findUserServices(tenantId: string, userId: string) {
  return prisma.professionalService.findMany({
    where: { tenantId, userId },
    include: { service: { select: { id: true, name: true } } },
  })
}

async setUserServices(tenantId: string, userId: string, serviceIds: string[]) {
  return prisma.$transaction(async (tx) => {
    await tx.professionalService.deleteMany({ where: { tenantId, userId } })
    if (serviceIds.length > 0) {
      await tx.professionalService.createMany({
        data: serviceIds.map((serviceId) => ({ tenantId, userId, serviceId })),
        skipDuplicates: true,
      })
    }
    return tx.professionalService.findMany({
      where: { tenantId, userId },
      include: { service: { select: { id: true, name: true } } },
    })
  })
}

async findProfessionalsByService(tenantId: string, serviceId: string) {
  return prisma.user.findMany({
    where: {
      tenantId,
      role: { in: ['OWNER', 'MANAGER', 'PROFESSIONAL'] },
      professionalServices: { some: { tenantId, serviceId } },
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      avatarUrl: true,
      roleId: true,
      customRole: { select: { name: true } },
      createdAt: true,
    },
    orderBy: { name: 'asc' },
  })
}
```

Também atualizar o método `findAllUsers` para incluir `avatarUrl` e `professionalServices`:

```typescript
async findAllUsers(tenantId: string) {
  const users = await prisma.user.findMany({
    where: { tenantId },
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      roleId: true,
      avatarUrl: true,
      customRole: { select: { name: true } },
      createdAt: true,
      professionalServices: {
        select: { service: { select: { id: true, name: true } } },
      },
    },
  })
  return users.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    isOwner: u.role === 'OWNER',
    roleId: u.roleId,
    avatarUrl: u.avatarUrl,
    roleName: u.role === 'OWNER' ? 'Dono' : (u.customRole?.name ?? 'Sem cargo'),
    createdAt: u.createdAt,
    services: u.professionalServices.map((ps) => ps.service),
  }))
}
```

- [ ] **Step 4: Rodar testes para verificar que passam**

```bash
npx vitest run src/domains/iam/iam.repository.test.ts
```

Saída esperada: todos os testes PASS.

- [ ] **Step 5: Verificar tipos**

```bash
npx tsc --noEmit
```

Saída esperada: 0 erros.

- [ ] **Step 6: Commit**

```bash
git add src/domains/iam/iam.repository.ts src/domains/iam/iam.repository.test.ts
git commit -m "feat(iam): adiciona updateUser, findUserServices, setUserServices e findProfessionalsByService ao repository"
```

---

## Task 3: IAM Service — updateMember + setMemberServices

**Files:**
- Modify: `src/domains/iam/iam.service.ts`
- Modify: `src/domains/iam/iam.service.test.ts`

- [ ] **Step 1: Escrever testes que falham**

Abrir `src/domains/iam/iam.service.test.ts` e adicionar ao final, após o describe existente.  
Primeiro, estender os mocks no topo do arquivo — adicionar após os vi.mock existentes:

```typescript
// adicionar nos mocks do topo do arquivo (após os vi.mock existentes):
vi.mock('@/shared/database/prisma', () => ({
  prisma: {
    user: { findFirst: vi.fn() },
    serviceCommission: { createMany: vi.fn() },
  },
}))
```

Nota: se `vi.mock('@/shared/database/prisma', ...)` já existe no arquivo, apenas adicione `serviceCommission: { createMany: vi.fn() }` ao objeto mock.

Adicionar ao final do arquivo:

```typescript
import { ForbiddenError, ConflictError, UserNotFoundError } from '@/shared/errors'

vi.mock('./iam.repository', () => ({
  iamRepository: {
    deleteInvite: vi.fn(),
    findUserById: vi.fn(),
    updateUser: vi.fn(),
    findUserServices: vi.fn(),
    setUserServices: vi.fn(),
  },
}))

describe('IamService.updateMember', () => {
  let service: IamService

  beforeEach(() => {
    service = new IamService()
    vi.clearAllMocks()
  })

  it('OWNER pode editar qualquer membro', async () => {
    const requester = { id: 'req-1', role: 'OWNER', tenantId: 'tenant-1' }
    const target = { id: 'tgt-1', role: 'PROFESSIONAL', email: 'old@test.com', tenantId: 'tenant-1' }
    vi.mocked(iamRepository.findUserById)
      .mockResolvedValueOnce(requester as any)
      .mockResolvedValueOnce(target as any)
    vi.mocked(iamRepository.updateUser).mockResolvedValue({ ...target, name: 'Novo' } as any)

    await service.updateMember('tenant-1', 'req-1', 'tgt-1', { name: 'Novo' })

    expect(iamRepository.updateUser).toHaveBeenCalledWith('tenant-1', 'tgt-1', { name: 'Novo' })
  })

  it('OWNER pode editar a si mesmo', async () => {
    const requester = { id: 'req-1', role: 'OWNER', tenantId: 'tenant-1' }
    vi.mocked(iamRepository.findUserById)
      .mockResolvedValueOnce(requester as any)
      .mockResolvedValueOnce(requester as any)
    vi.mocked(iamRepository.updateUser).mockResolvedValue(requester as any)

    await expect(
      service.updateMember('tenant-1', 'req-1', 'req-1', { name: 'Novo' })
    ).resolves.not.toThrow()
  })

  it('MANAGER não pode editar OWNER', async () => {
    const requester = { id: 'req-1', role: 'MANAGER', tenantId: 'tenant-1' }
    const target = { id: 'tgt-1', role: 'OWNER', tenantId: 'tenant-1' }
    vi.mocked(iamRepository.findUserById)
      .mockResolvedValueOnce(requester as any)
      .mockResolvedValueOnce(target as any)

    await expect(
      service.updateMember('tenant-1', 'req-1', 'tgt-1', { name: 'Novo' })
    ).rejects.toThrow(ForbiddenError)
  })

  it('MANAGER não pode editar outro MANAGER', async () => {
    const requester = { id: 'req-1', role: 'MANAGER', tenantId: 'tenant-1' }
    const target = { id: 'tgt-1', role: 'MANAGER', tenantId: 'tenant-1' }
    vi.mocked(iamRepository.findUserById)
      .mockResolvedValueOnce(requester as any)
      .mockResolvedValueOnce(target as any)

    await expect(
      service.updateMember('tenant-1', 'req-1', 'tgt-1', { name: 'Novo' })
    ).rejects.toThrow(ForbiddenError)
  })

  it('MANAGER pode editar PROFESSIONAL', async () => {
    const requester = { id: 'req-1', role: 'MANAGER', tenantId: 'tenant-1' }
    const target = { id: 'tgt-1', role: 'PROFESSIONAL', email: 'old@test.com', tenantId: 'tenant-1' }
    vi.mocked(iamRepository.findUserById)
      .mockResolvedValueOnce(requester as any)
      .mockResolvedValueOnce(target as any)
    vi.mocked(iamRepository.updateUser).mockResolvedValue(target as any)

    await expect(
      service.updateMember('tenant-1', 'req-1', 'tgt-1', { name: 'Novo' })
    ).resolves.not.toThrow()
  })

  it('lança UserNotFoundError quando target não existe', async () => {
    const requester = { id: 'req-1', role: 'OWNER', tenantId: 'tenant-1' }
    vi.mocked(iamRepository.findUserById)
      .mockResolvedValueOnce(requester as any)
      .mockResolvedValueOnce(null)

    await expect(
      service.updateMember('tenant-1', 'req-1', 'tgt-1', { name: 'Novo' })
    ).rejects.toThrow(UserNotFoundError)
  })
})

describe('IamService.setMemberServices', () => {
  let service: IamService

  beforeEach(() => {
    service = new IamService()
    vi.clearAllMocks()
  })

  it('substitui serviços e cria ServiceCommission para novos vínculos', async () => {
    vi.mocked(iamRepository.findUserServices).mockResolvedValue([
      { serviceId: 'svc-old', service: { id: 'svc-old', name: 'Antigo' } } as any,
    ])
    vi.mocked(iamRepository.setUserServices).mockResolvedValue([
      { service: { id: 'svc-new', name: 'Novo' } } as any,
    ])
    const { prisma } = await import('@/shared/database/prisma')
    ;(prisma.serviceCommission.createMany as any).mockResolvedValue({ count: 1 })

    await service.setMemberServices('tenant-1', 'user-1', ['svc-new'])

    expect(iamRepository.setUserServices).toHaveBeenCalledWith('tenant-1', 'user-1', ['svc-new'])
    expect(prisma.serviceCommission.createMany).toHaveBeenCalledWith({
      data: [{ tenantId: 'tenant-1', serviceId: 'svc-new', professionalId: 'user-1', rate: 0 }],
      skipDuplicates: true,
    })
  })

  it('não cria ServiceCommission para serviços já existentes', async () => {
    vi.mocked(iamRepository.findUserServices).mockResolvedValue([
      { serviceId: 'svc-1', service: { id: 'svc-1', name: 'Corte' } } as any,
    ])
    vi.mocked(iamRepository.setUserServices).mockResolvedValue([
      { service: { id: 'svc-1', name: 'Corte' } } as any,
    ])
    const { prisma } = await import('@/shared/database/prisma')
    ;(prisma.serviceCommission.createMany as any).mockResolvedValue({ count: 0 })

    await service.setMemberServices('tenant-1', 'user-1', ['svc-1'])

    expect(prisma.serviceCommission.createMany).toHaveBeenCalledWith({
      data: [],
      skipDuplicates: true,
    })
  })
})
```

- [ ] **Step 2: Rodar testes para verificar que falham**

```bash
npx vitest run src/domains/iam/iam.service.test.ts
```

Saída esperada: FAIL — métodos não existem.

- [ ] **Step 3: Implementar os novos métodos no service**

Abrir `src/domains/iam/iam.service.ts` e adicionar no topo o import do prisma (se ainda não existir está `import { prisma } from "@/shared/database/prisma"`):

Adicionar os métodos abaixo na classe `IamService`, após `updateUserRoleById`:

```typescript
async updateMember(
  tenantId: string,
  requesterId: string,
  targetId: string,
  input: { name?: string; email?: string; avatarUrl?: string | null },
) {
  const requester = await iamRepository.findUserById(tenantId, requesterId)
  if (!requester) throw new UserNotFoundError()

  const target = await iamRepository.findUserById(tenantId, targetId)
  if (!target) throw new UserNotFoundError()

  const isOwner = requester.role === UserRole.OWNER
  const isManager = requester.role === UserRole.MANAGER
  const isSelf = requesterId === targetId

  if (isOwner) {
    // OWNER pode editar qualquer membro, inclusive si mesmo
  } else if (isManager) {
    if (!isSelf && (target.role === UserRole.OWNER || target.role === UserRole.MANAGER)) {
      throw new ForbiddenError('Gerentes não podem editar o dono ou outros gerentes.')
    }
  } else {
    throw new ForbiddenError('Sem permissão para editar membros.')
  }

  if (input.email && input.email !== target.email) {
    const conflict = await prisma.user.findFirst({ where: { tenantId, email: input.email } })
    if (conflict) throw new ConflictError('E-mail já cadastrado neste negócio.')
  }

  return iamRepository.updateUser(tenantId, targetId, input)
}

async setMemberServices(tenantId: string, userId: string, serviceIds: string[]) {
  const currentServices = await iamRepository.findUserServices(tenantId, userId)
  const currentServiceIds = new Set(currentServices.map((ps) => ps.serviceId))
  const newServiceIds = serviceIds.filter((id) => !currentServiceIds.has(id))

  const updated = await iamRepository.setUserServices(tenantId, userId, serviceIds)

  await prisma.serviceCommission.createMany({
    data: newServiceIds.map((serviceId) => ({
      tenantId,
      serviceId,
      professionalId: userId,
      rate: 0,
    })),
    skipDuplicates: true,
  })

  return updated
}

async getMemberServices(tenantId: string, userId: string) {
  return iamRepository.findUserServices(tenantId, userId)
}
```

Certificar que `ConflictError` está importado do `@/shared/errors` (já está no import existente).

- [ ] **Step 4: Rodar testes para verificar que passam**

```bash
npx vitest run src/domains/iam/iam.service.test.ts
```

Saída esperada: todos os testes PASS.

- [ ] **Step 5: Verificar tipos**

```bash
npx tsc --noEmit
```

Saída esperada: 0 erros.

- [ ] **Step 6: Commit**

```bash
git add src/domains/iam/iam.service.ts src/domains/iam/iam.service.test.ts
git commit -m "feat(iam): adiciona updateMember e setMemberServices ao service"
```

---

## Task 4: API Routes — GET/PUT serviços e POST avatar

**Files:**
- Create: `src/app/api/iam/users/[userId]/services/route.ts`
- Create: `src/app/api/iam/users/[userId]/avatar/route.ts`
- Modify: `src/app/api/iam/users/[userId]/route.ts`

- [ ] **Step 1: Criar route de serviços do membro**

Criar arquivo `src/app/api/iam/users/[userId]/services/route.ts`:

```typescript
import { z } from 'zod'
import { iamService } from '@/domains/iam/iam.service'
import { ensurePermission, PERMISSIONS } from '@/shared/auth/permissions'
import { getSessionContext } from '@/shared/auth/session'
import { handleApiError } from '@/shared/http/handle-api-error'
import { validateInput } from '@/shared/http/validate-input'
import { initializeDomainRuntime } from '@/app/api/_lib/runtime'

const setServicesSchema = z.object({
  serviceIds: z.array(z.string().cuid()).max(100),
})

type Params = { params: Promise<{ userId: string }> }

export async function GET(request: Request, { params }: Params) {
  initializeDomainRuntime()
  try {
    const session = await getSessionContext(request)
    ensurePermission(session, PERMISSIONS.users.view)
    const { userId } = await params
    const services = await iamService.getMemberServices(session.tenantId, userId)
    return Response.json(services.map((ps) => ps.service))
  } catch (error) {
    return handleApiError(error)
  }
}

export async function PUT(request: Request, { params }: Params) {
  initializeDomainRuntime()
  try {
    const session = await getSessionContext(request)
    ensurePermission(session, PERMISSIONS.users.manage)
    const { userId } = await params
    const { serviceIds } = await validateInput(request, setServicesSchema)
    const updated = await iamService.setMemberServices(session.tenantId, userId, serviceIds)
    return Response.json(updated.map((ps) => (ps as any).service))
  } catch (error) {
    return handleApiError(error)
  }
}
```

- [ ] **Step 2: Criar route de upload de avatar**

Criar arquivo `src/app/api/iam/users/[userId]/avatar/route.ts`:

```typescript
import { iamService } from '@/domains/iam/iam.service'
import { ensurePermission, PERMISSIONS } from '@/shared/auth/permissions'
import { getSessionContext } from '@/shared/auth/session'
import { handleApiError } from '@/shared/http/handle-api-error'
import { initializeDomainRuntime } from '@/app/api/_lib/runtime'
import { supabaseAdmin } from '@/integrations/supabase/admin'
import { ForbiddenError, ValidationError } from '@/shared/errors'

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const MAX_SIZE_BYTES = 2 * 1024 * 1024 // 2 MB
const BUCKET = 'professional-avatars'

type Params = { params: Promise<{ userId: string }> }

export async function POST(request: Request, { params }: Params) {
  initializeDomainRuntime()
  try {
    const session = await getSessionContext(request)
    ensurePermission(session, PERMISSIONS.users.manage)

    const { userId } = await params

    // Verifica permissão de edição (OWNER pode editar todos, MANAGER com restrições)
    // A validação completa de hierarquia está no service; aqui validamos apenas que
    // o requisitante pode gerenciar membros.
    const formData = await request.formData()
    const file = formData.get('file')

    if (!(file instanceof File)) {
      throw new ValidationError('Campo "file" obrigatório.')
    }
    if (!ALLOWED_TYPES.includes(file.type)) {
      throw new ValidationError('Formato inválido. Use jpg, png ou webp.')
    }
    if (file.size > MAX_SIZE_BYTES) {
      throw new ValidationError('Arquivo muito grande. Máximo 2 MB.')
    }

    const ext = file.type.split('/')[1]!.replace('jpeg', 'jpg')
    const path = `${session.tenantId}/${userId}/avatar.${ext}`

    const arrayBuffer = await file.arrayBuffer()
    const { error: uploadError } = await supabaseAdmin.storage
      .from(BUCKET)
      .upload(path, arrayBuffer, { contentType: file.type, upsert: true })

    if (uploadError) throw new Error(`Erro no upload: ${uploadError.message}`)

    const { data: publicUrlData } = supabaseAdmin.storage.from(BUCKET).getPublicUrl(path)
    const avatarUrl = publicUrlData.publicUrl

    await iamService.updateMember(session.tenantId, session.userId, userId, { avatarUrl })

    return Response.json({ avatarUrl })
  } catch (error) {
    return handleApiError(error)
  }
}
```

- [ ] **Step 3: Estender PATCH /api/iam/users/[userId] para nome e e-mail**

Abrir `src/app/api/iam/users/[userId]/route.ts` e substituir pelo conteúdo abaixo:

```typescript
import { z } from 'zod'
import { iamService } from '@/domains/iam/iam.service'
import { ensurePermission, PERMISSIONS } from '@/shared/auth/permissions'
import { getSessionContext } from '@/shared/auth/session'
import { handleApiError } from '@/shared/http/handle-api-error'
import { validateInput } from '@/shared/http/validate-input'
import { initializeDomainRuntime } from '@/app/api/_lib/runtime'

const updateMemberSchema = z.object({
  roleId: z.string().min(1).optional(),
  name: z.string().min(1).max(120).optional(),
  email: z.string().email().optional(),
}).refine((d) => d.roleId || d.name || d.email, {
  message: 'Pelo menos um campo deve ser fornecido.',
})

type Params = { params: Promise<{ userId: string }> }

export async function PATCH(request: Request, { params }: Params) {
  initializeDomainRuntime()
  try {
    const session = await getSessionContext(request)
    ensurePermission(session, PERMISSIONS.users.manage)
    const { userId } = await params
    const body = await validateInput(request, updateMemberSchema)

    // Atualizar cargo (caminho existente)
    if (body.roleId) {
      const user = await iamService.updateUserRoleById(
        session.tenantId,
        session.userId,
        userId,
        body.roleId,
      )
      return Response.json(user)
    }

    // Atualizar nome / e-mail
    const user = await iamService.updateMember(session.tenantId, session.userId, userId, {
      name: body.name,
      email: body.email,
    })
    return Response.json(user)
  } catch (error) {
    return handleApiError(error)
  }
}
```

- [ ] **Step 4: Verificar tipos**

```bash
npx tsc --noEmit
```

Saída esperada: 0 erros.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/iam/users/
git commit -m "feat(iam): adiciona routes de serviços e avatar do membro; estende PATCH com name/email"
```

---

## Task 5: API Route — GET /api/iam/users com filtro por serviceId

**Files:**
- Modify: `src/app/api/iam/users/route.ts`

- [ ] **Step 1: Estender GET /api/iam/users para suportar ?serviceId=**

Substituir o conteúdo de `src/app/api/iam/users/route.ts`:

```typescript
import { iamService } from '@/domains/iam/iam.service'
import { iamRepository } from '@/domains/iam/iam.repository'
import { initializeDomainRuntime } from '@/app/api/_lib/runtime'
import { ensurePermission, PERMISSIONS } from '@/shared/auth/permissions'
import { getSessionContext } from '@/shared/auth/session'
import { handleApiError } from '@/shared/http/handle-api-error'

export async function GET(request: Request) {
  initializeDomainRuntime()
  try {
    const session = await getSessionContext(request)
    ensurePermission(session, PERMISSIONS.users.view)

    const { searchParams } = new URL(request.url)
    const serviceId = searchParams.get('serviceId')

    if (!serviceId) {
      const users = await iamService.listUsers(session.tenantId)
      return Response.json(users)
    }

    // Filtro por serviço — retorna { professionals, filtered }
    const linked = await iamRepository.findProfessionalsByService(session.tenantId, serviceId)

    if (linked.length > 0) {
      return Response.json({ professionals: linked, filtered: true })
    }

    // Fallback: nenhum profissional vinculado — retorna todos
    const all = await iamService.listUsers(session.tenantId)
    const eligible = all.filter((u) =>
      ['OWNER', 'MANAGER', 'PROFESSIONAL'].includes(u.role),
    )
    return Response.json({ professionals: eligible, filtered: false })
  } catch (error) {
    return handleApiError(error)
  }
}
```

- [ ] **Step 2: Verificar tipos**

```bash
npx tsc --noEmit
```

Saída esperada: 0 erros.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/iam/users/route.ts
git commit -m "feat(iam): GET /api/iam/users suporta ?serviceId= com fallback permissivo"
```

---

## Task 6: Supabase Storage — criar bucket professional-avatars

- [ ] **Step 1: Criar bucket via SQL no Supabase**

No painel do Supabase → SQL Editor, executar:

```sql
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'professional-avatars',
  'professional-avatars',
  true,
  2097152,
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Policy: leitura pública
CREATE POLICY "Leitura pública de avatars"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'professional-avatars');

-- Policy: upload autenticado
CREATE POLICY "Upload de avatar autenticado"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'professional-avatars');

-- Policy: substituição autenticada
CREATE POLICY "Substituição de avatar autenticado"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'professional-avatars');
```

- [ ] **Step 2: Verificar bucket no painel**

Supabase Dashboard → Storage → verificar que `professional-avatars` aparece com acesso público ativado.

- [ ] **Step 3: Commit (documentação)**

```bash
git commit --allow-empty -m "chore: bucket professional-avatars criado no Supabase Storage"
```

---

## Task 7: Hook — use-member-services.ts

**Files:**
- Create: `src/hooks/iam/use-member-services.ts`

- [ ] **Step 1: Criar hook**

Criar `src/hooks/iam/use-member-services.ts`:

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

export type MemberService = {
  id: string
  name: string
}

async function fetchMemberServices(userId: string): Promise<MemberService[]> {
  const res = await fetch(`/api/iam/users/${userId}/services`)
  if (!res.ok) throw new Error('Falha ao carregar serviços do membro')
  return res.json()
}

async function setMemberServices(input: {
  userId: string
  serviceIds: string[]
}): Promise<MemberService[]> {
  const res = await fetch(`/api/iam/users/${input.userId}/services`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ serviceIds: input.serviceIds }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error?.message ?? 'Falha ao salvar serviços')
  }
  return res.json()
}

export function useGetMemberServices(userId: string | null) {
  return useQuery({
    queryKey: ['member-services', userId],
    queryFn: () => fetchMemberServices(userId!),
    enabled: !!userId,
    staleTime: 30 * 1000,
  })
}

export function useSetMemberServices() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: setMemberServices,
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['member-services', variables.userId] })
      queryClient.invalidateQueries({ queryKey: ['team-members'] })
    },
  })
}
```

- [ ] **Step 2: Verificar tipos**

```bash
npx tsc --noEmit
```

Saída esperada: 0 erros.

- [ ] **Step 3: Commit**

```bash
git add src/hooks/iam/use-member-services.ts
git commit -m "feat(iam): hook use-member-services para query e mutação de serviços por membro"
```

---

## Task 8: Hook — use-team.ts estendido

**Files:**
- Modify: `src/hooks/iam/use-team.ts`

- [ ] **Step 1: Atualizar tipo TeamMember e adicionar mutations**

Substituir o conteúdo completo de `src/hooks/iam/use-team.ts`:

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

export type UserRole = 'OWNER' | 'MANAGER' | 'PROFESSIONAL' | 'RECEPTIONIST'

export type MemberService = {
  id: string
  name: string
}

export type TeamMember = {
  id: string
  name: string
  email: string
  role: UserRole
  isOwner: boolean
  roleId: string | null
  roleName: string
  avatarUrl: string | null
  services: MemberService[]
  createdAt: string
}

export type TeamInvite = {
  id: string
  email: string
  role: UserRole
  roleId: string | null
  status: 'PENDING' | 'ACCEPTED'
  expiresAt: string
  createdAt: string
}

export type ProfessionalsByServiceResult = {
  professionals: TeamMember[]
  filtered: boolean
}

async function fetchTeamMembers(): Promise<TeamMember[]> {
  const res = await fetch('/api/iam/users')
  if (!res.ok) throw new Error('Falha ao carregar equipe')
  return res.json()
}

async function fetchProfessionalsByService(
  serviceId: string,
): Promise<ProfessionalsByServiceResult> {
  const res = await fetch(`/api/iam/users?serviceId=${serviceId}`)
  if (!res.ok) throw new Error('Falha ao carregar profissionais')
  return res.json()
}

async function fetchInvites(): Promise<TeamInvite[]> {
  const res = await fetch('/api/iam/invites')
  if (!res.ok) throw new Error('Falha ao carregar convites')
  return res.json()
}

async function createInvite(input: { email: string; roleId: string }): Promise<TeamInvite> {
  const res = await fetch('/api/iam/invites', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error?.message ?? 'Falha ao enviar convite')
  }
  return res.json()
}

async function updateMemberRole(input: { userId: string; roleId: string }): Promise<TeamMember> {
  const res = await fetch(`/api/iam/users/${input.userId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ roleId: input.roleId }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error?.message ?? 'Falha ao atualizar cargo')
  }
  return res.json()
}

async function updateMemberProfile(input: {
  userId: string
  name?: string
  email?: string
}): Promise<TeamMember> {
  const res = await fetch(`/api/iam/users/${input.userId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: input.name, email: input.email }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error?.message ?? 'Falha ao atualizar membro')
  }
  return res.json()
}

async function uploadAvatar(input: {
  userId: string
  file: File
}): Promise<{ avatarUrl: string }> {
  const formData = new FormData()
  formData.append('file', input.file)
  const res = await fetch(`/api/iam/users/${input.userId}/avatar`, {
    method: 'POST',
    body: formData,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error?.message ?? 'Falha ao fazer upload da foto')
  }
  return res.json()
}

async function cancelInvite(inviteId: string): Promise<void> {
  const res = await fetch(`/api/iam/invites/${inviteId}`, { method: 'DELETE' })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error?.message ?? 'Falha ao cancelar convite')
  }
}

export function useTeamMembers() {
  return useQuery({
    queryKey: ['team-members'],
    queryFn: fetchTeamMembers,
    staleTime: 60 * 1000,
  })
}

export function useProfessionalsByService(serviceId: string | null) {
  return useQuery({
    queryKey: ['professionals-by-service', serviceId],
    queryFn: () => fetchProfessionalsByService(serviceId!),
    enabled: !!serviceId,
    staleTime: 30 * 1000,
  })
}

export function useTeamInvites() {
  return useQuery({
    queryKey: ['team-invites'],
    queryFn: fetchInvites,
    staleTime: 60 * 1000,
  })
}

export function useInviteMember() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: createInvite,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team-invites'] })
    },
  })
}

export function useCancelInvite() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: cancelInvite,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team-invites'] })
    },
  })
}

export function useUpdateMemberRole() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: updateMemberRole,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team-members'] })
    },
  })
}

export function useUpdateMemberProfile() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: updateMemberProfile,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team-members'] })
    },
  })
}

export function useUploadAvatar() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: uploadAvatar,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team-members'] })
    },
  })
}
```

- [ ] **Step 2: Verificar tipos**

```bash
npx tsc --noEmit
```

Saída esperada: 0 erros.

- [ ] **Step 3: Commit**

```bash
git add src/hooks/iam/use-team.ts
git commit -m "feat(iam): estende use-team com tipos de serviços, avatarUrl e mutations de edição"
```

---

## Task 9: Component — member-services-selector.tsx

**Files:**
- Create: `src/components/domain/iam/member-services-selector.tsx`

- [ ] **Step 1: Criar componente**

Criar `src/components/domain/iam/member-services-selector.tsx`:

```typescript
'use client'

import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { useServices } from '@/hooks/scheduling/use-services'

type Props = {
  selectedIds: string[]
  onChange: (ids: string[]) => void
}

export function MemberServicesSelector({ selectedIds, onChange }: Props) {
  const { data: services = [], isLoading } = useServices()
  const activeServices = services.filter((s) => s.active)

  function toggle(serviceId: string) {
    if (selectedIds.includes(serviceId)) {
      onChange(selectedIds.filter((id) => id !== serviceId))
    } else {
      onChange([...selectedIds, serviceId])
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-6 w-full" />
        ))}
      </div>
    )
  }

  if (activeServices.length === 0) {
    return (
      <p className="text-sm text-slate-400">
        Nenhum serviço ativo cadastrado. Crie serviços em{' '}
        <span className="font-medium">Serviços</span>.
      </p>
    )
  }

  return (
    <div className="max-h-52 overflow-y-auto rounded-xl border border-slate-200 divide-y divide-slate-100">
      {activeServices.map((service) => (
        <label
          key={service.id}
          className="flex cursor-pointer items-center gap-3 px-4 py-2.5 hover:bg-slate-50"
        >
          <Checkbox
            id={`svc-${service.id}`}
            checked={selectedIds.includes(service.id)}
            onCheckedChange={() => toggle(service.id)}
          />
          <span className="text-sm text-slate-800">{service.name}</span>
        </label>
      ))}
    </div>
  )
}
```

- [ ] **Step 2: Verificar tipos**

```bash
npx tsc --noEmit
```

Saída esperada: 0 erros.

- [ ] **Step 3: Commit**

```bash
git add src/components/domain/iam/member-services-selector.tsx
git commit -m "feat(iam): componente MemberServicesSelector para seleção de serviços por profissional"
```

---

## Task 10: Component — avatar-upload.tsx

**Files:**
- Create: `src/components/domain/iam/avatar-upload.tsx`

- [ ] **Step 1: Criar componente**

Criar `src/components/domain/iam/avatar-upload.tsx`:

```typescript
'use client'

import { useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { useUploadAvatar } from '@/hooks/iam/use-team'

type Props = {
  userId: string
  currentAvatarUrl: string | null
  name: string
  onUploaded: (url: string) => void
}

export function AvatarUpload({ userId, currentAvatarUrl, name, onUploaded }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<string | null>(currentAvatarUrl)
  const uploadAvatar = useUploadAvatar()

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    const localPreview = URL.createObjectURL(file)
    setPreview(localPreview)

    uploadAvatar.mutate(
      { userId, file },
      {
        onSuccess: ({ avatarUrl }) => {
          onUploaded(avatarUrl)
          toast.success('Foto atualizada')
        },
        onError: (err) => {
          setPreview(currentAvatarUrl)
          toast.error(err instanceof Error ? err.message : 'Erro ao fazer upload')
        },
      },
    )
  }

  const initials = name.slice(0, 2).toUpperCase()

  return (
    <div className="flex items-center gap-4">
      <div className="relative">
        {preview ? (
          <img
            src={preview}
            alt={name}
            className="size-16 rounded-full object-cover border border-slate-200"
          />
        ) : (
          <div className="flex size-16 items-center justify-center rounded-full bg-slate-100 text-lg font-semibold text-slate-700">
            {initials}
          </div>
        )}
        {uploadAvatar.isPending && (
          <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/30">
            <div className="size-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
          </div>
        )}
      </div>

      <div className="space-y-1">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => inputRef.current?.click()}
          disabled={uploadAvatar.isPending}
        >
          {uploadAvatar.isPending ? 'Enviando...' : 'Alterar foto'}
        </Button>
        <p className="text-xs text-slate-400">jpg, png ou webp · máx 2 MB</p>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={handleFileChange}
      />
    </div>
  )
}
```

- [ ] **Step 2: Verificar tipos**

```bash
npx tsc --noEmit
```

Saída esperada: 0 erros.

- [ ] **Step 3: Commit**

```bash
git add src/components/domain/iam/avatar-upload.tsx
git commit -m "feat(iam): componente AvatarUpload com preview imediato e upload para Supabase Storage"
```

---

## Task 11: Component — edit-member-modal.tsx

**Files:**
- Create: `src/components/domain/iam/edit-member-modal.tsx`

- [ ] **Step 1: Criar o modal de edição completa**

Criar `src/components/domain/iam/edit-member-modal.tsx`:

```typescript
'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { AvatarUpload } from './avatar-upload'
import { MemberServicesSelector } from './member-services-selector'
import { useUpdateMemberProfile, useUpdateMemberRole, type TeamMember } from '@/hooks/iam/use-team'
import { useGetMemberServices, useSetMemberServices } from '@/hooks/iam/use-member-services'
import { useRoles } from '@/hooks/iam/use-roles'
import { useCurrentUser } from '@/hooks/use-current-user'

type Props = {
  member: TeamMember | null
  open: boolean
  onClose: () => void
}

export function EditMemberModal({ member, open, onClose }: Props) {
  const { data: currentUser } = useCurrentUser()
  const { data: roles = [] } = useRoles()
  const { data: memberServices = [], isLoading: loadingServices } = useGetMemberServices(
    member?.id ?? null,
  )

  const updateProfile = useUpdateMemberProfile()
  const updateRole = useUpdateMemberRole()
  const setServices = useSetMemberServices()

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [roleId, setRoleId] = useState('')
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>([])
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)

  useEffect(() => {
    if (member) {
      setName(member.name)
      setEmail(member.email)
      setRoleId(member.roleId ?? '')
      setAvatarUrl(member.avatarUrl)
    }
  }, [member])

  useEffect(() => {
    if (memberServices.length >= 0) {
      setSelectedServiceIds(memberServices.map((s) => s.id))
    }
  }, [memberServices])

  function handleClose() {
    onClose()
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!member) return

    const promises: Promise<unknown>[] = []

    // Atualizar nome/email se mudaram
    if (name !== member.name || email !== member.email) {
      promises.push(
        updateProfile.mutateAsync({ userId: member.id, name, email }).catch((err) => {
          throw new Error(`Perfil: ${err instanceof Error ? err.message : 'Erro'}`)
        }),
      )
    }

    // Atualizar cargo se mudou
    if (roleId && roleId !== member.roleId) {
      promises.push(
        updateRole.mutateAsync({ userId: member.id, roleId }).catch((err) => {
          throw new Error(`Cargo: ${err instanceof Error ? err.message : 'Erro'}`)
        }),
      )
    }

    // Atualizar serviços
    const currentIds = memberServices.map((s) => s.id).sort().join(',')
    const newIds = [...selectedServiceIds].sort().join(',')
    if (currentIds !== newIds) {
      promises.push(
        setServices.mutateAsync({ userId: member.id, serviceIds: selectedServiceIds }).catch((err) => {
          throw new Error(`Serviços: ${err instanceof Error ? err.message : 'Erro'}`)
        }),
      )
    }

    if (promises.length === 0) {
      handleClose()
      return
    }

    try {
      await Promise.all(promises)
      toast.success('Membro atualizado com sucesso')
      handleClose()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar alterações')
    }
  }

  const isPending = updateProfile.isPending || updateRole.isPending || setServices.isPending
  const isOwnerTarget = member?.isOwner

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar membro</DialogTitle>
        </DialogHeader>

        {member && (
          <form onSubmit={handleSubmit} className="space-y-5 pt-1">
            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-slate-600">Foto</Label>
              <AvatarUpload
                userId={member.id}
                currentAvatarUrl={avatarUrl}
                name={name}
                onUploaded={(url) => setAvatarUrl(url)}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="edit-name">Nome *</Label>
              <Input
                id="edit-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                maxLength={120}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="edit-email">E-mail *</Label>
              <Input
                id="edit-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            {!isOwnerTarget && (
              <div className="space-y-1.5">
                <Label>Cargo</Label>
                <Select value={roleId} onValueChange={setRoleId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o cargo..." />
                  </SelectTrigger>
                  <SelectContent>
                    {roles.map((role) => (
                      <SelectItem key={role.id} value={role.id}>
                        {role.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-1.5">
              <Label>Serviços que realiza</Label>
              {loadingServices ? (
                <p className="text-sm text-slate-400">Carregando serviços...</p>
              ) : (
                <MemberServicesSelector
                  selectedIds={selectedServiceIds}
                  onChange={setSelectedServiceIds}
                />
              )}
            </div>

            <div className="flex gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={handleClose}
                disabled={isPending}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                className="flex-1 bg-slate-950 text-white hover:bg-slate-800"
                disabled={isPending || !name || !email}
              >
                {isPending ? 'Salvando...' : 'Salvar alterações'}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 2: Verificar tipos**

```bash
npx tsc --noEmit
```

Saída esperada: 0 erros.

- [ ] **Step 3: Commit**

```bash
git add src/components/domain/iam/edit-member-modal.tsx
git commit -m "feat(iam): modal EditMemberModal com edição de nome, email, cargo, serviços e foto"
```

---

## Task 12: Component — team-member-card.tsx

**Files:**
- Modify: `src/components/domain/iam/team-member-card.tsx`

- [ ] **Step 1: Adicionar botão Editar e badges de serviços**

Substituir o conteúdo completo de `src/components/domain/iam/team-member-card.tsx`:

```typescript
'use client'

import { useState } from 'react'
import { Pencil } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { type TeamMember } from '@/hooks/iam/use-team'
import { useCurrentUser } from '@/hooks/use-current-user'
import { EditMemberModal } from './edit-member-modal'

type Props = {
  member: TeamMember
  canManage: boolean
}

export function TeamMemberCard({ member, canManage }: Props) {
  const { data: currentUser } = useCurrentUser()
  const [editOpen, setEditOpen] = useState(false)

  const isCurrentUser = currentUser?.id === member.id
  const canEdit = canManage || isCurrentUser

  const initials = member.name.slice(0, 2).toUpperCase()

  return (
    <>
      <div className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white p-4">
        <div className="shrink-0">
          {member.avatarUrl ? (
            <img
              src={member.avatarUrl}
              alt={member.name}
              className="size-10 rounded-full object-cover border border-slate-200"
            />
          ) : (
            <div className="flex size-10 items-center justify-center rounded-full bg-slate-100 text-sm font-semibold text-slate-700">
              {initials}
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-slate-950">{member.name}</p>
            {isCurrentUser && (
              <span className="text-xs text-slate-400">(você)</span>
            )}
          </div>
          <p className="text-xs text-slate-500">{member.email}</p>

          {member.services.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {member.services.map((svc) => (
                <span
                  key={svc.id}
                  className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600"
                >
                  {svc.name}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {member.isOwner ? (
            <Badge className="text-xs bg-slate-950 text-white">Dono</Badge>
          ) : (
            <Badge className="text-xs bg-slate-100 text-slate-700">{member.roleName}</Badge>
          )}

          {canEdit && (
            <Button
              variant="ghost"
              size="icon"
              className="size-8 text-slate-400 hover:text-slate-700"
              onClick={() => setEditOpen(true)}
              title="Editar membro"
            >
              <Pencil className="size-4" />
            </Button>
          )}
        </div>
      </div>

      <EditMemberModal
        member={editOpen ? member : null}
        open={editOpen}
        onClose={() => setEditOpen(false)}
      />
    </>
  )
}
```

- [ ] **Step 2: Verificar tipos**

```bash
npx tsc --noEmit
```

Saída esperada: 0 erros.

- [ ] **Step 3: Commit**

```bash
git add src/components/domain/iam/team-member-card.tsx
git commit -m "feat(iam): TeamMemberCard com botão Editar, badges de serviços e foto do profissional"
```

---

## Task 13: Component — create-appointment-modal.tsx (filtro por serviço)

**Files:**
- Modify: `src/components/domain/scheduling/create-appointment-modal.tsx`

- [ ] **Step 1: Adicionar filtro de profissionais por serviço**

No arquivo `src/components/domain/scheduling/create-appointment-modal.tsx`, fazer as seguintes alterações:

**Adicionar import** no topo (junto com os outros imports):
```typescript
import { useProfessionalsByService } from '@/hooks/iam/use-team'
```

**Adicionar hook** logo após a declaração de `createAppointment`:
```typescript
const { data: professionalsByService } = useProfessionalsByService(serviceId || null)
```

**Substituir** o trecho de derivação dos profissionais (a linha que filtra por role):

Encontrar:
```typescript
const professionals = teamMembers.filter((m) =>
  ['OWNER', 'MANAGER', 'PROFESSIONAL'].includes(m.role),
)
```

Substituir por:
```typescript
const allEligible = teamMembers.filter((m) =>
  ['OWNER', 'MANAGER', 'PROFESSIONAL'].includes(m.role),
)

const professionals = serviceId && professionalsByService
  ? professionalsByService.professionals
  : allEligible

const showServiceWarning =
  serviceId && professionalsByService && !professionalsByService.filtered
```

**Adicionar banner** no JSX do modal, logo antes do select de profissional (dentro do bloco `{canManage && (...)}`, antes do `<div className="space-y-2"><Label>Profissional</Label>`):

```typescript
{showServiceWarning && (
  <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
    Nenhum profissional configurado para este serviço. Configure na aba{' '}
    <span className="font-medium">Equipe</span>.
  </div>
)}
```

- [ ] **Step 2: Verificar tipos**

```bash
npx tsc --noEmit
```

Saída esperada: 0 erros.

- [ ] **Step 3: Commit**

```bash
git add src/components/domain/scheduling/create-appointment-modal.tsx
git commit -m "feat(scheduling): filtra profissionais por serviço no modal de agendamento"
```

---

## Task 14: Página pública de agendamento — foto e filtro

**Files:**
- Modify: `src/app/(public)/agendar/[slug]/types.ts`
- Modify: `src/app/(public)/agendar/[slug]/page.tsx`
- Modify: `src/app/(public)/agendar/[slug]/booking-client.tsx`

- [ ] **Step 1: Atualizar tipo PublicProfessional**

Abrir `src/app/(public)/agendar/[slug]/types.ts` e atualizar o tipo `PublicProfessional` para incluir `avatarUrl` e `serviceIds`:

```typescript
export type PublicProfessional = {
  id: string
  name: string
  avatarUrl: string | null  // adicionar
  serviceIds: string[]       // adicionar
  // ... outros campos existentes
}
```

Nota: preservar todos os campos existentes, apenas adicionar os dois novos.

- [ ] **Step 2: Incluir avatarUrl e serviceIds na query do server component**

Abrir `src/app/(public)/agendar/[slug]/page.tsx` e localizar a query que carrega os profissionais do tenant.

A query de profissionais deve ser atualizada para incluir `avatarUrl` e os serviços vinculados. Adicionar ao select/include dos profissionais:
```typescript
avatarUrl: true,
professionalServices: {
  select: { serviceId: true },
},
```

No mapeamento do resultado, adicionar:
```typescript
avatarUrl: professional.avatarUrl,
serviceIds: professional.professionalServices.map((ps) => ps.serviceId),
```

- [ ] **Step 3: Filtrar profissionais por serviço no BookingClient**

Abrir `src/app/(public)/agendar/[slug]/booking-client.tsx`.

Adicionar estado para profissionais filtrados e flag de aviso:
```typescript
const [professionalsForService, setProfessionalsForService] = useState<PublicProfessional[]>(
  tenantData.professionals,
)
const [showServiceWarning, setShowServiceWarning] = useState(false)
```

No início da função `handleServiceSelect`, após calcular `priceLabel`, adicionar:
```typescript
// Filtrar profissionais pelo serviço selecionado
const linked = tenantData.professionals.filter((p) =>
  p.serviceIds.includes(service.id),
)
const filtered = linked.length > 0 ? linked : tenantData.professionals
const isFiltered = linked.length > 0
setProfessionalsForService(filtered)
setShowServiceWarning(!isFiltered)
```

Ainda em `handleServiceSelect`, atualizar a verificação de profissional único para usar `filtered`:
```typescript
// Substituir:
if (singleProfessional) {
  const p = tenantData.professionals[0]!
// Por:
if (filtered.length === 1) {
  const p = filtered[0]!
```

Passar `professionalsForService` para `ProfessionalStep` no JSX:
```typescript
// Encontrar:
<ProfessionalStep
  professionals={tenantData.professionals}
// Substituir por:
<ProfessionalStep
  professionals={professionalsForService}
```

Adicionar banner de aviso antes do `ProfessionalStep` (se o componente aceitar um slot de children ou adicionar no componente pai):
```typescript
{step === 'professional' && showServiceWarning && (
  <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
    Nenhum profissional configurado para este serviço. O dono do negócio pode configurar isso.
  </div>
)}
```

- [ ] **Step 4: Atualizar ProfessionalStep para exibir foto**

Localizar o componente `ProfessionalStep` em `src/components/domain/booking/professional-step.tsx`.

No card de cada profissional, substituir as iniciais por foto quando disponível:

```typescript
// Encontrar o bloco que renderiza as iniciais/avatar do profissional
// e substituir pela lógica:
{professional.avatarUrl ? (
  <img
    src={professional.avatarUrl}
    alt={professional.name}
    className="size-16 rounded-full object-cover border border-slate-200"
  />
) : (
  <div className="flex size-16 items-center justify-center rounded-full bg-slate-100 text-xl font-semibold text-slate-600">
    {professional.name.slice(0, 2).toUpperCase()}
  </div>
)}
```

- [ ] **Step 5: Verificar tipos**

```bash
npx tsc --noEmit
```

Saída esperada: 0 erros.

- [ ] **Step 6: Rodar todos os testes**

```bash
npx vitest run
```

Saída esperada: todos os testes PASS.

- [ ] **Step 7: Commit final**

```bash
git add src/app/(public)/agendar/ src/components/domain/booking/professional-step.tsx
git commit -m "feat(booking): exibe foto do profissional e filtra por serviço no agendamento online"
```

---

## Verificação Final

- [ ] **Rodar build completo**

```bash
npx tsc --noEmit && npx vitest run
```

Saída esperada: 0 erros de tipo, todos os testes passando.

- [ ] **Abrir PR para main**

```bash
git push origin HEAD
gh pr create --title "feat(iam): vínculo de serviços, edição completa e foto do profissional" \
  --body "Implementa spec docs/superpowers/specs/2026-06-06-equipe-servicos-foto-design.md"
```
