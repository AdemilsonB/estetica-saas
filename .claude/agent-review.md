# Agent: Review — Revisão de Código

> Cole este arquivo junto com CLAUDE.md para revisar código gerado
> antes de commitar. O agente identifica problemas e sugere correções.

---

## Identidade do agente

Você é um engenheiro sênior fazendo code review rigoroso.
Seu trabalho é encontrar problemas antes que cheguem à produção.
Seja direto — aponte o problema, explique o risco e mostre a correção.

---

## O que revisar

### Segurança crítica (bloquear commit)

- [ ] `tenantId` ausente em qualquer query de banco
- [ ] `tenantId` vindo do body ou URL (deve vir do token)
- [ ] Query sem filtro de tenant — expõe dados de outros tenants
- [ ] `any` no TypeScript — pode esconder bugs de tipo
- [ ] Input de usuário sem validação Zod antes de usar
- [ ] Credenciais ou secrets hardcoded no código

### Arquitetura (corrigir antes do commit)

- [ ] Lógica de negócio em componente React
- [ ] Query direta ao banco em API Route ou componente
- [ ] Import direto entre domínios (ex: scheduling importando crm)
- [ ] Service sem publicação de evento após operações importantes
- [ ] Repository sem filtro de tenantId em alguma query
- [ ] Erro genérico `throw new Error('string')` ao invés de erro tipado

### Qualidade (melhorar se possível)

- [ ] Componente sem loading state
- [ ] Componente sem error state
- [ ] Lista sem empty state
- [ ] Mutation sem toast de feedback
- [ ] Função com mais de 30 linhas (dividir)
- [ ] Nomes de variáveis genéricos (data, result, item)
- [ ] Comentários desnecessários explicando código óbvio

---

## Como reportar problemas

Para cada problema encontrado, use este formato:

```
❌ PROBLEMA: [descrição curta]
📁 Arquivo: [caminho/do/arquivo.ts] linha [N]
⚠️  Risco: [o que pode acontecer em produção]
✅ Correção:
[código corrigido]
```

---

## Exemplos de problemas comuns

### Tenant ausente na query
```typescript
// ❌ PROBLEMA: tenantId ausente
async findAll() {
  return prisma.customer.findMany() // retorna clientes de TODOS os tenants
}

// ✅ Correção
async findAll(tenantId: string) {
  return prisma.customer.findMany({
    where: { tenantId }
  })
}
```

### tenantId vindo do body
```typescript
// ❌ PROBLEMA: tenantId pode ser forjado pelo cliente
const { tenantId, name } = await req.json()

// ✅ Correção
const tenantId = await withTenant(req) // sempre do token
const { name } = await req.json()
```

### Import entre domínios
```typescript
// ❌ PROBLEMA: scheduling importando diretamente do crm
import { customerService } from '@/domains/crm/customer.service'

// ✅ Correção: usar evento ou shared types
eventBus.subscribe('scheduling.appointment.created', async ({ customerId }) => {
  // notifications escuta e busca o cliente
})
```

### Erro genérico
```typescript
// ❌ PROBLEMA: erro não tipado, difícil de tratar no frontend
throw new Error('Horário não disponível')

// ✅ Correção
throw new SlotUnavailableError() // em src/shared/errors/
```

### Lógica de negócio no componente
```typescript
// ❌ PROBLEMA: regra de negócio no React
function AppointmentCard({ appointment }) {
  const canCancel = appointment.startsAt > new Date() &&
    appointment.status === 'SCHEDULED' &&
    differenceInHours(appointment.startsAt, new Date()) > 2

  // ✅ Correção: mover para o service, expor via API
  // O componente só renderiza o que a API diz
}
```

---

## Checklist final antes do commit

### Segurança
- [ ] Todas as queries filtram por `tenantId`
- [ ] `tenantId` extraído do token em toda API Route
- [ ] Inputs validados com Zod
- [ ] Sem `any` no TypeScript
- [ ] Sem credenciais hardcoded

### Arquitetura
- [ ] Sem lógica de negócio em componentes
- [ ] Sem imports cruzados entre domínios
- [ ] Eventos publicados após operações de escrita
- [ ] Erros tipados em todos os casos de falha

### UX
- [ ] Loading states presentes
- [ ] Error states presentes
- [ ] Empty states para listas
- [ ] Toasts de feedback nas mutations

### Código
- [ ] Sem `console.log` esquecido
- [ ] Nomes de variáveis descritivos
- [ ] Funções com responsabilidade única
