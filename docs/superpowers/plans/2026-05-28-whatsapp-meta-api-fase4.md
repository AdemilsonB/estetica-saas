# WhatsApp Meta API — Fase 4: Frontend

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Pré-requisito:** Fases 1, 2 e 3 completas e mergeadas.

**Goal:** Implementar todas as telas de gerenciamento WhatsApp — configuração da conta Meta, templates, automações, histórico — e estender o CRM com campos de consentimento e birthDate.

**Architecture:** Pages em `/whatsapp/` usando TanStack Query para server state + Shadcn UI. Formulários com react-hook-form + resolvers Zod. Hooks por domínio em `src/hooks/whatsapp/`. Navegação adicionada ao `app-shell.tsx`.

**Tech Stack:** Next.js 15 App Router, TanStack Query v5, react-hook-form, Zod, Shadcn UI (Nova preset), Tailwind CSS.

**Branch:** continua em `feat/whatsapp-meta-api`.

---

## Mapa de arquivos

| Arquivo | Ação |
|---|---|
| `src/components/app/app-shell.tsx` | Modificar — adiciona seção WhatsApp na nav |
| `src/hooks/whatsapp/use-whatsapp-config.ts` | Criar |
| `src/hooks/whatsapp/use-whatsapp-templates.ts` | Criar |
| `src/hooks/whatsapp/use-automation-rules.ts` | Criar |
| `src/hooks/whatsapp/use-whatsapp-messages.ts` | Criar |
| `src/components/domain/whatsapp/setup-wizard.tsx` | Criar |
| `src/components/domain/whatsapp/template-editor.tsx` | Criar |
| `src/components/domain/whatsapp/template-status-badge.tsx` | Criar |
| `src/components/domain/whatsapp/automation-rule-form.tsx` | Criar |
| `src/components/domain/whatsapp/message-history-table.tsx` | Criar |
| `src/components/domain/whatsapp/whatsapp-metrics.tsx` | Criar |
| `src/components/domain/crm/consent-checkbox.tsx` | Criar |
| `src/components/domain/crm/engagement-score.tsx` | Criar |
| `src/app/(app)/configuracoes/whatsapp/page.tsx` | Criar |
| `src/app/(app)/whatsapp/templates/page.tsx` | Criar |
| `src/app/(app)/whatsapp/automacoes/page.tsx` | Criar |
| `src/app/(app)/whatsapp/historico/page.tsx` | Criar |

---

### Task 19: Navegação + hooks

**Files:**
- Modify: `src/components/app/app-shell.tsx`
- Create: `src/hooks/whatsapp/use-whatsapp-config.ts`
- Create: `src/hooks/whatsapp/use-whatsapp-templates.ts`
- Create: `src/hooks/whatsapp/use-automation-rules.ts`
- Create: `src/hooks/whatsapp/use-whatsapp-messages.ts`

- [ ] **Step 1: Adicionar WhatsApp à navegação em app-shell.tsx**

Abrir `src/components/app/app-shell.tsx`. Localizar o array de items de navegação (próximo à linha 26, onde estão `href: '/agenda'`, etc.). Adicionar antes do item de configurações:

```typescript
  {
    href: '/whatsapp',
    label: 'WhatsApp',
    description: 'Templates e automações',
    icon: MessageCircle,   // importar de lucide-react
    permission: PERMISSIONS.whatsapp.view,
  },
```

Adicionar o import de `MessageCircle` no topo junto aos outros imports de ícones.

- [ ] **Step 2: Criar use-whatsapp-config.ts**

```typescript
// src/hooks/whatsapp/use-whatsapp-config.ts
"use client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

async function fetchConfig() {
  const res = await fetch("/api/iam/whatsapp/config");
  if (res.status === 404) return null;
  if (!res.ok) throw new Error("Erro ao buscar configuração");
  return res.json();
}

async function saveConfig(data: {
  phoneNumberId: string;
  wabaId: string;
  accessToken: string;
  displayPhone: string;
}) {
  const res = await fetch("/api/iam/whatsapp/config", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.message ?? "Erro ao salvar configuração");
  }
  return res.json();
}

export function useWhatsAppConfig() {
  return useQuery({ queryKey: ["whatsapp-config"], queryFn: fetchConfig });
}

export function useSaveWhatsAppConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: saveConfig,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["whatsapp-config"] }),
  });
}
```

- [ ] **Step 3: Criar use-whatsapp-templates.ts**

```typescript
// src/hooks/whatsapp/use-whatsapp-templates.ts
"use client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

async function fetchTemplates() {
  const res = await fetch("/api/whatsapp/templates");
  if (!res.ok) throw new Error("Erro ao buscar templates");
  return res.json();
}

async function createTemplate(data: unknown) {
  const res = await fetch("/api/whatsapp/templates", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.message ?? "Erro ao criar template");
  }
  return res.json();
}

async function submitTemplate(id: string) {
  const res = await fetch(`/api/whatsapp/templates/${id}/submit`, { method: "POST" });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.message ?? "Erro ao submeter template");
  }
  return res.json();
}

async function deleteTemplate(id: string) {
  const res = await fetch(`/api/whatsapp/templates/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error("Erro ao remover template");
}

export function useWhatsAppTemplates() {
  return useQuery({ queryKey: ["whatsapp-templates"], queryFn: fetchTemplates });
}

export function useCreateTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createTemplate,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["whatsapp-templates"] }),
  });
}

export function useSubmitTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: submitTemplate,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["whatsapp-templates"] }),
  });
}

export function useDeleteTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deleteTemplate,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["whatsapp-templates"] }),
  });
}
```

- [ ] **Step 4: Criar use-automation-rules.ts**

```typescript
// src/hooks/whatsapp/use-automation-rules.ts
"use client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

async function fetchRules() {
  const res = await fetch("/api/automation/rules");
  if (!res.ok) throw new Error("Erro ao buscar automações");
  return res.json();
}

async function createRule(data: unknown) {
  const res = await fetch("/api/automation/rules", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.message ?? "Erro ao criar automação");
  }
  return res.json();
}

async function updateRule({ id, ...data }: { id: string; [key: string]: unknown }) {
  const res = await fetch(`/api/automation/rules/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.message ?? "Erro ao atualizar automação");
  }
  return res.json();
}

async function deleteRule(id: string) {
  const res = await fetch(`/api/automation/rules/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error("Erro ao remover automação");
}

export function useAutomationRules() {
  return useQuery({ queryKey: ["automation-rules"], queryFn: fetchRules });
}

export function useCreateAutomationRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createRule,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["automation-rules"] }),
  });
}

export function useUpdateAutomationRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: updateRule,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["automation-rules"] }),
  });
}

export function useDeleteAutomationRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deleteRule,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["automation-rules"] }),
  });
}
```

- [ ] **Step 5: Criar use-whatsapp-messages.ts**

```typescript
// src/hooks/whatsapp/use-whatsapp-messages.ts
"use client";
import { useQuery } from "@tanstack/react-query";

type MessageFilters = {
  status?: string;
  customerId?: string;
  page?: number;
  pageSize?: number;
};

async function fetchMessages(filters: MessageFilters = {}) {
  const params = new URLSearchParams();
  if (filters.status) params.set("status", filters.status);
  if (filters.customerId) params.set("customerId", filters.customerId);
  if (filters.page) params.set("page", String(filters.page));
  if (filters.pageSize) params.set("pageSize", String(filters.pageSize));

  const res = await fetch(`/api/whatsapp/messages?${params}`);
  if (!res.ok) throw new Error("Erro ao buscar histórico");
  return res.json();
}

export function useWhatsAppMessages(filters: MessageFilters = {}) {
  return useQuery({
    queryKey: ["whatsapp-messages", filters],
    queryFn: () => fetchMessages(filters),
    refetchInterval: 30_000,
  });
}
```

- [ ] **Step 6: Verificar TypeScript**

```bash
npx tsc --noEmit
```

- [ ] **Step 7: Commit**

```bash
git add src/components/app/app-shell.tsx src/hooks/whatsapp/
git commit -m "feat(frontend): hooks WhatsApp + item de navegação"
```

---

### Task 20: Componentes utilitários + página de configuração

**Files:**
- Create: `src/components/domain/whatsapp/template-status-badge.tsx`
- Create: `src/components/domain/whatsapp/setup-wizard.tsx`
- Create: `src/app/(app)/configuracoes/whatsapp/page.tsx`

- [ ] **Step 1: Criar template-status-badge.tsx**

```typescript
// src/components/domain/whatsapp/template-status-badge.tsx
import { Badge } from "@/components/ui/badge";

type Status = "DRAFT" | "PENDING_APPROVAL" | "APPROVED" | "REJECTED" | "PAUSED";

const config: Record<Status, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  DRAFT: { label: "Rascunho", variant: "secondary" },
  PENDING_APPROVAL: { label: "Aguardando aprovação", variant: "outline" },
  APPROVED: { label: "Aprovado", variant: "default" },
  REJECTED: { label: "Rejeitado", variant: "destructive" },
  PAUSED: { label: "Pausado", variant: "secondary" },
};

export function TemplateStatusBadge({ status }: { status: Status }) {
  const { label, variant } = config[status] ?? config.DRAFT;
  return <Badge variant={variant}>{label}</Badge>;
}
```

- [ ] **Step 2: Criar setup-wizard.tsx**

```typescript
// src/components/domain/whatsapp/setup-wizard.tsx
"use client";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle, AlertCircle, Eye, EyeOff } from "lucide-react";
import { useWhatsAppConfig, useSaveWhatsAppConfig } from "@/hooks/whatsapp/use-whatsapp-config";

const schema = z.object({
  phoneNumberId: z.string().trim().min(1, "Obrigatório"),
  wabaId: z.string().trim().min(1, "Obrigatório"),
  accessToken: z.string().trim().min(1, "Obrigatório"),
  displayPhone: z.string().trim().min(1, "Obrigatório"),
});

type FormData = z.infer<typeof schema>;

export function SetupWizard() {
  const [showToken, setShowToken] = useState(false);
  const { data: config, isLoading } = useWhatsAppConfig();
  const save = useSaveWhatsAppConfig();

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      phoneNumberId: config?.phoneNumberId ?? "",
      wabaId: config?.wabaId ?? "",
      accessToken: "",
      displayPhone: config?.displayPhone ?? "",
    },
  });

  const onSubmit = (data: FormData) => save.mutate(data);

  if (isLoading) return <div className="h-32 animate-pulse rounded-2xl bg-muted" />;

  return (
    <div className="space-y-6">
      {config?.active && (
        <Alert className="border-green-200 bg-green-50">
          <CheckCircle className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-700">
            WhatsApp conectado e verificado — {config.displayPhone}
          </AlertDescription>
        </Alert>
      )}

      {config && !config.active && (
        <Alert className="border-amber-200 bg-amber-50">
          <AlertCircle className="h-4 w-4 text-amber-600" />
          <AlertDescription className="text-amber-700">
            Credenciais salvas. Configure o webhook na Meta usando o token de verificação:{" "}
            <strong>veja nas instruções abaixo</strong>.
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Conectar WhatsApp Business</CardTitle>
          <CardDescription>
            Siga os passos para obter suas credenciais no Meta Business Manager.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ol className="mb-6 space-y-3 text-sm text-muted-foreground">
            <li>
              <strong>1.</strong> Acesse{" "}
              <strong>business.facebook.com → Usuários do Sistema</strong> e crie um System User.
            </li>
            <li>
              <strong>2.</strong> Dê acesso ao System User ao seu WhatsApp Business Account e gere
              um token permanente.
            </li>
            <li>
              <strong>3.</strong> Acesse{" "}
              <strong>business.facebook.com/wa/manage</strong> para encontrar seu Phone Number ID e
              WABA ID.
            </li>
            <li>
              <strong>4.</strong> Cole as informações abaixo e salve. Depois configure o Webhook na
              Meta com a URL e token de verificação exibidos.
            </li>
          </ol>

          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Phone Number ID</Label>
                <Input placeholder="123456789012345" {...form.register("phoneNumberId")} />
                {form.formState.errors.phoneNumberId && (
                  <p className="text-xs text-destructive">{form.formState.errors.phoneNumberId.message}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label>WABA ID</Label>
                <Input placeholder="123456789012345" {...form.register("wabaId")} />
                {form.formState.errors.wabaId && (
                  <p className="text-xs text-destructive">{form.formState.errors.wabaId.message}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label>Número de exibição</Label>
                <Input placeholder="+5511999999999" {...form.register("displayPhone")} />
              </div>
              <div className="space-y-1.5">
                <Label>Access Token</Label>
                <div className="relative">
                  <Input
                    type={showToken ? "text" : "password"}
                    placeholder="EAAxxxxxxx..."
                    {...form.register("accessToken")}
                  />
                  <button
                    type="button"
                    onClick={() => setShowToken((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                  >
                    {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {form.formState.errors.accessToken && (
                  <p className="text-xs text-destructive">{form.formState.errors.accessToken.message}</p>
                )}
              </div>
            </div>

            {save.error && (
              <Alert variant="destructive">
                <AlertDescription>{save.error.message}</AlertDescription>
              </Alert>
            )}

            <Button type="submit" disabled={save.isPending}>
              {save.isPending ? "Salvando..." : "Salvar credenciais"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
```

- [ ] **Step 3: Criar página de configuração**

```typescript
// src/app/(app)/configuracoes/whatsapp/page.tsx
import { SetupWizard } from "@/components/domain/whatsapp/setup-wizard";

export default function WhatsAppConfigPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">WhatsApp Business</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Conecte sua conta Meta para enviar mensagens automatizadas.
        </p>
      </div>
      <SetupWizard />
    </div>
  );
}
```

- [ ] **Step 4: Verificar TypeScript**

```bash
npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add src/components/domain/whatsapp/template-status-badge.tsx src/components/domain/whatsapp/setup-wizard.tsx src/app/\(app\)/configuracoes/whatsapp/
git commit -m "feat(frontend): página de configuração WhatsApp com setup wizard"
```

---

### Task 21: Página de templates

**Files:**
- Create: `src/components/domain/whatsapp/template-editor.tsx`
- Create: `src/app/(app)/whatsapp/templates/page.tsx`

- [ ] **Step 1: Criar template-editor.tsx**

```typescript
// src/components/domain/whatsapp/template-editor.tsx
"use client";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createTemplateSchema, type CreateTemplateInput } from "@/domains/whatsapp/templates/schemas";

type Props = {
  onSubmit: (data: CreateTemplateInput) => void;
  isLoading?: boolean;
};

export function TemplateEditor({ onSubmit, isLoading }: Props) {
  const form = useForm<CreateTemplateInput>({
    resolver: zodResolver(createTemplateSchema),
    defaultValues: {
      category: "MARKETING",
      language: "pt_BR",
      variables: [],
      buttons: [],
    },
  });

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Nome único do template</Label>
          <Input
            placeholder="retorno_cliente"
            {...form.register("name")}
          />
          <p className="text-xs text-muted-foreground">
            Apenas letras minúsculas, números e underscores
          </p>
          {form.formState.errors.name && (
            <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label>Categoria</Label>
          <Select
            defaultValue="MARKETING"
            onValueChange={(v) => form.setValue("category", v as "MARKETING" | "UTILITY" | "AUTHENTICATION")}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="MARKETING">Marketing</SelectItem>
              <SelectItem value="UTILITY">Utility (transacional)</SelectItem>
              <SelectItem value="AUTHENTICATION">Autenticação</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>Texto do corpo</Label>
        <Textarea
          rows={4}
          placeholder={"Olá {{1}} 👋\n\nSentimos sua falta! Preparamos uma condição especial para você."}
          {...form.register("bodyText")}
        />
        <p className="text-xs text-muted-foreground">
          Use &#123;&#123;1&#125;&#125;, &#123;&#123;2&#125;&#125;... para variáveis dinâmicas
        </p>
        {form.formState.errors.bodyText && (
          <p className="text-xs text-destructive">{form.formState.errors.bodyText.message}</p>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Cabeçalho (opcional)</Label>
          <Input placeholder="Novidade para você!" {...form.register("headerText")} />
        </div>
        <div className="space-y-1.5">
          <Label>Rodapé (opcional)</Label>
          <Input placeholder="Responda SAIR para cancelar" {...form.register("footerText")} />
        </div>
      </div>

      <Button type="submit" disabled={isLoading}>
        {isLoading ? "Salvando..." : "Salvar rascunho"}
      </Button>
    </form>
  );
}
```

- [ ] **Step 2: Criar página de templates**

```typescript
// src/app/(app)/whatsapp/templates/page.tsx
"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Plus, MoreHorizontal, Send, Trash } from "lucide-react";
import { TemplateEditor } from "@/components/domain/whatsapp/template-editor";
import { TemplateStatusBadge } from "@/components/domain/whatsapp/template-status-badge";
import {
  useWhatsAppTemplates,
  useCreateTemplate,
  useSubmitTemplate,
  useDeleteTemplate,
} from "@/hooks/whatsapp/use-whatsapp-templates";

export default function TemplatesPage() {
  const [open, setOpen] = useState(false);
  const { data: templates = [], isLoading } = useWhatsAppTemplates();
  const createTemplate = useCreateTemplate();
  const submitTemplate = useSubmitTemplate();
  const deleteTemplate = useDeleteTemplate();

  const categoryLabel: Record<string, string> = {
    MARKETING: "Marketing",
    UTILITY: "Utility",
    AUTHENTICATION: "Autenticação",
  };

  if (isLoading) {
    return <div className="h-64 animate-pulse rounded-2xl bg-muted m-6" />;
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Templates WhatsApp</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Templates precisam ser aprovados pela Meta antes do uso.
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="mr-2 h-4 w-4" /> Novo template</Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Criar template</DialogTitle>
            </DialogHeader>
            <TemplateEditor
              isLoading={createTemplate.isPending}
              onSubmit={(data) =>
                createTemplate.mutate(data, { onSuccess: () => setOpen(false) })
              }
            />
          </DialogContent>
        </Dialog>
      </div>

      {templates.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <p className="font-medium">Nenhum template criado</p>
            <p className="text-sm">Crie seu primeiro template para começar a automatizar mensagens.</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader><CardTitle>Seus templates</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {templates.map((tpl: { id: string; name: string; category: string; status: string }) => (
                  <TableRow key={tpl.id}>
                    <TableCell className="font-mono text-sm">{tpl.name}</TableCell>
                    <TableCell>{categoryLabel[tpl.category] ?? tpl.category}</TableCell>
                    <TableCell>
                      <TemplateStatusBadge status={tpl.status as "DRAFT" | "PENDING_APPROVAL" | "APPROVED" | "REJECTED" | "PAUSED"} />
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {tpl.status === "DRAFT" && (
                            <DropdownMenuItem
                              onClick={() => submitTemplate.mutate(tpl.id)}
                            >
                              <Send className="mr-2 h-4 w-4" /> Enviar para aprovação
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => deleteTemplate.mutate(tpl.id)}
                          >
                            <Trash className="mr-2 h-4 w-4" /> Remover
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Verificar TypeScript**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add src/components/domain/whatsapp/template-editor.tsx src/app/\(app\)/whatsapp/templates/
git commit -m "feat(frontend): página de templates WhatsApp com criação e envio para aprovação"
```

---

### Task 22: Página de automações

**Files:**
- Create: `src/components/domain/whatsapp/automation-rule-form.tsx`
- Create: `src/app/(app)/whatsapp/automacoes/page.tsx`

- [ ] **Step 1: Criar automation-rule-form.tsx**

```typescript
// src/components/domain/whatsapp/automation-rule-form.tsx
"use client";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { createAutomationRuleSchema, type CreateAutomationRuleInput } from "@/domains/automation/schemas";
import { useWhatsAppTemplates } from "@/hooks/whatsapp/use-whatsapp-templates";

const TRIGGER_LABELS: Record<string, string> = {
  "appointment.created": "Agendamento criado",
  "appointment.completed": "Atendimento concluído",
  "appointment.cancelled": "Agendamento cancelado",
  "appointment.no_show": "Cliente não compareceu",
  "customer.created": "Novo cliente cadastrado",
  "customer.inactive": "Cliente inativo por X dias",
  "customer.birthday": "Aniversário do cliente",
  "customer.return_window": "Janela de retorno",
};

type Props = {
  defaultValues?: Partial<CreateAutomationRuleInput>;
  onSubmit: (data: CreateAutomationRuleInput) => void;
  isLoading?: boolean;
};

export function AutomationRuleForm({ defaultValues, onSubmit, isLoading }: Props) {
  const { data: templates = [] } = useWhatsAppTemplates();
  const approvedTemplates = templates.filter((t: { status: string }) => t.status === "APPROVED");

  const form = useForm<CreateAutomationRuleInput>({
    resolver: zodResolver(createAutomationRuleSchema),
    defaultValues: {
      trigger: "customer.inactive",
      conditions: [],
      variables: [],
      active: true,
      cooldownDays: 30,
      maxPerMonth: 1,
      sendHourStart: 8,
      sendHourEnd: 20,
      ...defaultValues,
    },
  });

  const trigger = form.watch("trigger");

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-1.5">
        <Label>Nome da automação</Label>
        <Input placeholder="Ex: Clientes inativos 60 dias" {...form.register("name")} />
        {form.formState.errors.name && (
          <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Gatilho</Label>
          <Select
            defaultValue={defaultValues?.trigger ?? "customer.inactive"}
            onValueChange={(v) => form.setValue("trigger", v as CreateAutomationRuleInput["trigger"])}
          >
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {Object.entries(TRIGGER_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label>Template (apenas aprovados)</Label>
          <Select onValueChange={(v) => form.setValue("templateId", v)}>
            <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
            <SelectContent>
              {approvedTemplates.map((t: { id: string; name: string }) => (
                <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {(trigger === "customer.inactive" || trigger === "customer.return_window") && (
        <div className="space-y-1.5">
          <Label>Dias de inatividade</Label>
          <Input type="number" min={1} max={365} {...form.register("inactiveDays", { valueAsNumber: true })} />
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label>Cooldown (dias)</Label>
          <Input type="number" min={0} {...form.register("cooldownDays", { valueAsNumber: true })} />
        </div>
        <div className="space-y-1.5">
          <Label>Máx por mês</Label>
          <Input type="number" min={1} max={10} {...form.register("maxPerMonth", { valueAsNumber: true })} />
        </div>
        <div className="space-y-1.5">
          <Label>Janela de envio</Label>
          <div className="flex items-center gap-2">
            <Input type="number" min={0} max={23} className="w-20" {...form.register("sendHourStart", { valueAsNumber: true })} />
            <span className="text-muted-foreground">às</span>
            <Input type="number" min={0} max={23} className="w-20" {...form.register("sendHourEnd", { valueAsNumber: true })} />
            <span className="text-muted-foreground text-sm">h</span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Switch
          defaultChecked={defaultValues?.active ?? true}
          onCheckedChange={(v) => form.setValue("active", v)}
        />
        <Label>Automação ativa</Label>
      </div>

      <Button type="submit" disabled={isLoading}>
        {isLoading ? "Salvando..." : "Salvar automação"}
      </Button>
    </form>
  );
}
```

- [ ] **Step 2: Criar página de automações**

```typescript
// src/app/(app)/whatsapp/automacoes/page.tsx
"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Pencil, Trash, Pause, Play } from "lucide-react";
import { AutomationRuleForm } from "@/components/domain/whatsapp/automation-rule-form";
import {
  useAutomationRules,
  useCreateAutomationRule,
  useUpdateAutomationRule,
  useDeleteAutomationRule,
} from "@/hooks/whatsapp/use-automation-rules";

const TRIGGER_LABELS: Record<string, string> = {
  "appointment.created": "Agendamento criado",
  "appointment.completed": "Atendimento concluído",
  "appointment.cancelled": "Agendamento cancelado",
  "appointment.no_show": "Cliente não compareceu",
  "customer.created": "Novo cliente",
  "customer.inactive": "Cliente inativo",
  "customer.birthday": "Aniversário",
  "customer.return_window": "Janela de retorno",
};

export default function AutomacoesPage() {
  const [open, setOpen] = useState(false);
  const { data: rules = [], isLoading } = useAutomationRules();
  const create = useCreateAutomationRule();
  const update = useUpdateAutomationRule();
  const remove = useDeleteAutomationRule();

  if (isLoading) {
    return <div className="h-64 animate-pulse rounded-2xl bg-muted m-6" />;
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Automações WhatsApp</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Regras que disparam mensagens automaticamente para seus clientes.
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="mr-2 h-4 w-4" /> Nova automação</Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader><DialogTitle>Criar automação</DialogTitle></DialogHeader>
            <AutomationRuleForm
              isLoading={create.isPending}
              onSubmit={(data) => create.mutate(data, { onSuccess: () => setOpen(false) })}
            />
          </DialogContent>
        </Dialog>
      </div>

      {rules.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <p className="font-medium">Nenhuma automação criada</p>
            <p className="text-sm">Crie sua primeira automação para começar a engajar clientes.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {rules.map((rule: { id: string; name: string; trigger: string; active: boolean; cooldownDays: number; maxPerMonth: number }) => (
            <Card key={rule.id}>
              <CardContent className="flex items-center justify-between py-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-3">
                    <span className="font-medium">{rule.name}</span>
                    <Badge variant={rule.active ? "default" : "secondary"}>
                      {rule.active ? "Ativo" : "Pausado"}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {TRIGGER_LABELS[rule.trigger] ?? rule.trigger} ·{" "}
                    Cooldown {rule.cooldownDays}d · Máx {rule.maxPerMonth}×/mês
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => update.mutate({ id: rule.id, active: !rule.active })}
                  >
                    {rule.active ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive"
                    onClick={() => remove.mutate(rule.id)}
                  >
                    <Trash className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Verificar TypeScript**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add src/components/domain/whatsapp/automation-rule-form.tsx src/app/\(app\)/whatsapp/automacoes/
git commit -m "feat(frontend): página de automações WhatsApp com criação e ativação de regras"
```

---

### Task 23: Página de histórico + métricas

**Files:**
- Create: `src/components/domain/whatsapp/whatsapp-metrics.tsx`
- Create: `src/components/domain/whatsapp/message-history-table.tsx`
- Create: `src/app/(app)/whatsapp/historico/page.tsx`
- Create: `src/app/(app)/whatsapp/page.tsx` (redirect)

- [ ] **Step 1: Criar whatsapp-metrics.tsx**

```typescript
// src/components/domain/whatsapp/whatsapp-metrics.tsx
type Metrics = {
  sent: number;
  delivered: number;
  read: number;
  failed: number;
};

export function WhatsAppMetrics({ metrics }: { metrics: Metrics }) {
  const readRate = metrics.sent > 0 ? Math.round((metrics.read / metrics.sent) * 100) : 0;

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
      {[
        { label: "Enviadas", value: metrics.sent, color: "text-foreground" },
        { label: "Entregues", value: metrics.delivered, color: "text-blue-600" },
        { label: "Lidas", value: metrics.read, color: "text-green-600" },
        { label: "Taxa de leitura", value: `${readRate}%`, color: "text-emerald-600" },
      ].map(({ label, value, color }) => (
        <div key={label} className="rounded-2xl border bg-card p-4 space-y-1">
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className={`text-2xl font-bold ${color}`}>{value}</p>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Criar message-history-table.tsx**

```typescript
// src/components/domain/whatsapp/message-history-table.tsx
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

type Message = {
  id: string;
  customer?: { name: string } | null;
  templateName: string;
  status: string;
  createdAt: string;
  failureReason?: string | null;
};

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  QUEUED:    { label: "Na fila",    variant: "secondary" },
  SENT:      { label: "Enviada",    variant: "outline" },
  DELIVERED: { label: "Entregue",   variant: "default" },
  READ:      { label: "Lida",       variant: "default" },
  FAILED:    { label: "Falhou",     variant: "destructive" },
};

export function MessageHistoryTable({ messages }: { messages: Message[] }) {
  if (messages.length === 0) {
    return (
      <div className="py-12 text-center text-muted-foreground">
        <p>Nenhuma mensagem enviada ainda.</p>
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Cliente</TableHead>
          <TableHead>Template</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Data</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {messages.map((msg) => {
          const sc = statusConfig[msg.status] ?? statusConfig.QUEUED;
          return (
            <TableRow key={msg.id}>
              <TableCell>{msg.customer?.name ?? "—"}</TableCell>
              <TableCell className="font-mono text-sm">{msg.templateName}</TableCell>
              <TableCell>
                <Badge variant={sc.variant}>{sc.label}</Badge>
              </TableCell>
              <TableCell className="text-muted-foreground text-sm">
                {format(new Date(msg.createdAt), "dd/MM HH:mm", { locale: ptBR })}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
```

- [ ] **Step 3: Criar página de histórico**

```typescript
// src/app/(app)/whatsapp/historico/page.tsx
"use client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState } from "react";
import { WhatsAppMetrics } from "@/components/domain/whatsapp/whatsapp-metrics";
import { MessageHistoryTable } from "@/components/domain/whatsapp/message-history-table";
import { useWhatsAppMessages } from "@/hooks/whatsapp/use-whatsapp-messages";

export default function HistoricoPage() {
  const [status, setStatus] = useState<string | undefined>();
  const { data, isLoading } = useWhatsAppMessages({ status, pageSize: 50 });

  if (isLoading) {
    return <div className="h-64 animate-pulse rounded-2xl bg-muted m-6" />;
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Histórico de mensagens</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Todas as mensagens enviadas via WhatsApp.
        </p>
      </div>

      {data?.metrics && <WhatsAppMetrics metrics={data.metrics} />}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Mensagens</CardTitle>
          <Select onValueChange={(v) => setStatus(v === "all" ? undefined : v)}>
            <SelectTrigger className="w-44">
              <SelectValue placeholder="Todos os status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="READ">Lidas</SelectItem>
              <SelectItem value="DELIVERED">Entregues</SelectItem>
              <SelectItem value="SENT">Enviadas</SelectItem>
              <SelectItem value="FAILED">Com falha</SelectItem>
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent>
          <MessageHistoryTable messages={data?.data ?? []} />
        </CardContent>
      </Card>
    </div>
  );
}
```

- [ ] **Step 4: Criar página de índice /whatsapp (redireciona para templates)**

```typescript
// src/app/(app)/whatsapp/page.tsx
import { redirect } from "next/navigation";

export default function WhatsAppPage() {
  redirect("/whatsapp/templates");
}
```

- [ ] **Step 5: Verificar TypeScript**

```bash
npx tsc --noEmit
```

- [ ] **Step 6: Commit**

```bash
git add src/components/domain/whatsapp/whatsapp-metrics.tsx src/components/domain/whatsapp/message-history-table.tsx src/app/\(app\)/whatsapp/
git commit -m "feat(frontend): página de histórico de mensagens com métricas de entrega"
```

---

### Task 24: CRM — consentimento + birthDate + engagement

**Files:**
- Create: `src/components/domain/crm/consent-checkbox.tsx`
- Create: `src/components/domain/crm/engagement-score.tsx`

- [ ] **Step 1: Criar consent-checkbox.tsx**

```typescript
// src/components/domain/crm/consent-checkbox.tsx
"use client";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type Props = {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  origin: string;
  onOriginChange: (origin: string) => void;
};

export function ConsentCheckbox({ checked, onCheckedChange, origin, onOriginChange }: Props) {
  return (
    <div className="space-y-3 rounded-2xl border border-amber-200 bg-amber-50 p-4">
      <div className="flex items-start gap-3">
        <Checkbox
          id="consent"
          checked={checked}
          onCheckedChange={(v) => onCheckedChange(v === true)}
          className="mt-0.5"
        />
        <Label htmlFor="consent" className="text-sm leading-relaxed cursor-pointer">
          Declaro que possuo autorização dos contatos cadastrados para receber comunicações via
          WhatsApp desta empresa, conforme a LGPD.
        </Label>
      </div>

      {checked && (
        <div className="space-y-1.5 pl-7">
          <Label className="text-xs text-muted-foreground">Origem do consentimento</Label>
          <Select value={origin} onValueChange={onOriginChange}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="balcao">Balcão / presencial</SelectItem>
              <SelectItem value="formulario">Formulário digital</SelectItem>
              <SelectItem value="import">Importação de lista</SelectItem>
              <SelectItem value="api">API / integração</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Criar engagement-score.tsx**

```typescript
// src/components/domain/crm/engagement-score.tsx
type Props = {
  score: number;
  totalSent?: number;
  totalRead?: number;
};

export function EngagementScore({ score, totalSent = 0, totalRead = 0 }: Props) {
  const color =
    score >= 70 ? "bg-green-500" :
    score >= 40 ? "bg-yellow-500" :
    "bg-red-500";

  const label =
    score >= 70 ? "Alto engajamento" :
    score >= 40 ? "Engajamento médio" :
    "Baixo engajamento";

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium">{score}/100</span>
      </div>
      <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${color}`}
          style={{ width: `${score}%` }}
        />
      </div>
      {totalSent > 0 && (
        <p className="text-xs text-muted-foreground">
          {totalRead} de {totalSent} mensagens lidas
        </p>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Verificar TypeScript**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Verificar todos os testes**

```bash
npx vitest run
```

Esperado: todos os testes passando.

- [ ] **Step 5: Commit final da Fase 4**

```bash
git add src/components/domain/crm/
git commit -m "feat(crm): ConsentCheckbox e EngagementScore para integração com WhatsApp"
```

---

### Task 25: Commit do spec + push + PR

- [ ] **Step 1: Commitar o spec e o plano**

```bash
git add docs/
git commit -m "docs: spec e plano de implementação — WhatsApp Meta API automação"
```

- [ ] **Step 2: Push da branch**

```bash
git push -u origin feat/whatsapp-meta-api
```

- [ ] **Step 3: Abrir Pull Request**

```bash
gh pr create \
  --title "feat(whatsapp): automação WhatsApp via API oficial Meta" \
  --body "$(cat <<'EOF'
## Resumo

- Substitui Z-API pela Meta Cloud API oficial (por tenant, Caminho A)
- Novo domínio `whatsapp/` com cliente HTTP, webhooks HMAC-SHA256, templates e anti-spam
- Domínio `automation/` construído — motor de regras com scheduler pg-boss (cron diário)
- Consentimento, opt-out, engagement scoring (0-100) e histórico completo de mensagens
- 4 novas telas: configuração Meta, templates, automações, histórico

## Plano de teste

- [ ] `npx tsc --noEmit` — zero erros
- [ ] `npx vitest run` — todos os testes passando
- [ ] Configurar WhatsApp config com credentials de teste
- [ ] Criar template DRAFT → submeter → verificar status PENDING_APPROVAL
- [ ] Criar automação `customer.inactive` com cooldown 0 e acionar manualmente
- [ ] Simular webhook de entrega e verificar atualização de status
- [ ] Verificar opt-out via keyword SAIR no webhook

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Checklist de conclusão da Fase 4

- [ ] `npx vitest run` — todos os testes passando
- [ ] `npx tsc --noEmit` — zero erros
- [ ] Todas as 4 páginas renderizam sem erro
- [ ] Formulários validam com Zod antes de submeter
- [ ] Loading states em todas as operações assíncronas
- [ ] Empty states em todas as listagens
- [ ] PR aberta para `main`
