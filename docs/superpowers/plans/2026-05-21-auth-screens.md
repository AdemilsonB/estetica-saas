# Auth Screens — Plano de Implementação

> **Para agentes:** SUB-SKILL OBRIGATÓRIA: Use `superpowers:subagent-driven-development` (recomendado) ou `superpowers:executing-plans` para implementar este plano tarefa por tarefa. Os passos usam sintaxe de checkbox (`- [ ]`) para rastreamento.

**Goal:** Implementar autenticação completa (login, cadastro, Google OAuth, reset de senha) com telas no estilo Notion + foundation para white-label por tenant.

**Architecture:** Forms customizados com `react-hook-form` + `zod` chamando diretamente o Supabase Auth SDK. Backend cria Tenant + User OWNER após signUp. Route group `(auth)` sem sidebar; `(app)` com AppShell. Middleware protege `/dashboard/*`.

**Tech Stack:** Next.js 15 App Router, Supabase Auth (`@supabase/ssr`), `react-hook-form`, `@hookform/resolvers/zod`, `sonner`, Prisma, Shadcn/Radix, TypeScript strict.

---

## Mapa de arquivos

| Arquivo | Ação | Responsabilidade |
|---|---|---|
| `src/integrations/supabase/client.ts` | Criar | Browser client para auth no frontend |
| `src/app/layout.tsx` | Modificar | Remover AppShell; manter só html/body/fonts |
| `src/app/(app)/layout.tsx` | Criar | Layout com AppShell para rotas do app |
| `src/app/(app)/page.tsx` | Criar (mover) | Home page (era `src/app/page.tsx`) |
| `prisma/schema.prisma` | Modificar | Adicionar `brandingConfig Json?` ao Tenant + url/directUrl |
| `src/domains/iam/iam.repository.ts` | Criar | `createTenantWithOwner` |
| `src/domains/iam/iam.service.ts` | Modificar | Adicionar método `register` |
| `src/app/api/iam/register/route.ts` | Criar | POST — cria Tenant + User OWNER |
| `src/app/api/iam/tenant-branding/route.ts` | Criar | GET público — branding do tenant pelo slug |
| `middleware.ts` | Criar | Proteção de rotas `/dashboard/*` e `/auth/*` |
| `src/components/auth/password-strength.tsx` | Criar | Barra visual de força da senha |
| `src/components/auth/google-button.tsx` | Criar | Botão OAuth Google reutilizável |
| `src/app/(auth)/layout.tsx` | Criar | Layout sem sidebar, fundo Notion |
| `src/app/(auth)/login/page.tsx` | Criar | Split + abas Entrar / Criar conta |
| `src/app/(auth)/callback/route.ts` | Criar | Handler OAuth — troca code por session |
| `src/app/(auth)/onboarding/page.tsx` | Criar | Coleta nome do negócio pós-Google |
| `src/app/(auth)/forgot-password/page.tsx` | Criar | Solicitar reset de senha |
| `src/app/(auth)/reset-password/page.tsx` | Criar | Definir nova senha via link do email |

---

## Task 1: Setup — Pacotes, env vars e Supabase browser client

**Files:**
- Modify: `.env.local`
- Create: `src/integrations/supabase/client.ts`

- [ ] **Instalar dependências**

```bash
npm install react-hook-form @hookform/resolvers sonner
```

Instalar componentes Shadcn necessários:

```bash
npx shadcn@latest add input label tabs separator
```

- [ ] **Adicionar variáveis de ambiente públicas ao `.env.local`**

Abrir `.env.local` e adicionar ao final:

```env
NEXT_PUBLIC_SUPABASE_URL=https://vcbkcwcgejukjjagcleh.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_aQQhARZuZ5mm9akW0H42Rw_SL28qYQ0
```

> **Por que:** `NEXT_PUBLIC_*` expõe as variáveis ao bundle do browser. A anon key é segura para expor — é a chave pública do projeto Supabase.

- [ ] **Criar o browser client**

Criar `src/integrations/supabase/client.ts`:

```typescript
import { createBrowserClient } from "@supabase/ssr";

export function createSupabaseBrowserClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
```

- [ ] **Verificar TypeScript**

```bash
npx tsc --noEmit
```

Esperado: sem erros.

- [ ] **Commit**

```bash
git add -A
git commit -m "feat(auth): setup pacotes, env vars e supabase browser client"
```

---

## Task 2: Refatorar AppShell para route group `(app)`

**Files:**
- Modify: `src/app/layout.tsx`
- Create: `src/app/(app)/layout.tsx`
- Create: `src/app/(app)/page.tsx` (mover de `src/app/page.tsx`)
- Delete: `src/app/page.tsx`

> **Por que:** O `(auth)` route group precisa de um layout sem sidebar. O Next.js App Router permite layouts aninhados por route group. O `RootLayout` envolve tudo — incluindo auth — portanto o AppShell deve sair dele e ir para um layout específico do grupo `(app)`.

- [ ] **Criar `src/app/(app)/layout.tsx`**

```typescript
import type { ReactNode } from "react";
import { AppShell } from "@/components/app/app-shell";

export default function AppLayout({ children }: { children: ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
```

- [ ] **Mover `src/app/page.tsx` para `src/app/(app)/page.tsx`**

Copiar o conteúdo inteiro de `src/app/page.tsx` para `src/app/(app)/page.tsx` sem alterações.

- [ ] **Atualizar `src/app/layout.tsx` — remover AppShell, adicionar Toaster**

Substituir o conteúdo completo de `src/app/layout.tsx` por:

```typescript
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "sonner";

import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Estetica SaaS",
  description:
    "Plataforma operacional inteligente para negocios de estetica e servicos.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="pt-BR"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {children}
        <Toaster position="top-right" richColors />
      </body>
    </html>
  );
}
```

- [ ] **Deletar `src/app/page.tsx`**

```bash
Remove-Item src/app/page.tsx
```

- [ ] **Verificar dev server**

```bash
npm run dev
```

Abrir `http://localhost:3000` — deve exibir a home page com sidebar normalmente. Sem erros no console.

- [ ] **Commit**

```bash
git add -A
git commit -m "refactor(app): move AppShell para route group (app)"
```

---

## Task 3: Migration Prisma — `brandingConfig` no Tenant

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Adicionar `url` e `directUrl` ao datasource e `brandingConfig` ao Tenant**

Abrir `prisma/schema.prisma` e substituir o bloco `datasource db` e o model `Tenant`:

```prisma
datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DIRECT_URL")
}
```

No model `Tenant`, adicionar o campo após `plan`:

```prisma
model Tenant {
  id             String            @id @default(cuid())
  name           String
  slug           String            @unique
  plan           String            @default("free")
  brandingConfig Json?
  createdAt      DateTime          @default(now())
  updatedAt      DateTime          @updatedAt
  users          User[]
  customers      Customer[]
  services       Service[]
  appointments   Appointment[]
  transactions   Transaction[]
  notifications  NotificationLog[]
}
```

- [ ] **Gerar e aplicar a migration no Supabase**

No PowerShell, setar as variáveis para usar o banco Supabase (não o local do `.env`):

```powershell
$env:DATABASE_URL = "postgresql://postgres.vcbkcwcgejukjjagcleh:SaaSEstetica@aws-1-us-east-2.pooler.supabase.com:6543/postgres"
$env:DIRECT_URL = "postgresql://postgres.vcbkcwcgejukjjagcleh:SaaSEstetica@aws-1-us-east-2.pooler.supabase.com:5432/postgres"
npx prisma migrate dev --name add_branding_config
```

Esperado: arquivo `prisma/migrations/20260521.../migration.sql` criado com:
```sql
ALTER TABLE "Tenant" ADD COLUMN "brandingConfig" JSONB;
```

- [ ] **Regenerar o Prisma Client**

```bash
npx prisma generate
```

- [ ] **Verificar TypeScript**

```bash
npx tsc --noEmit
```

- [ ] **Commit**

```bash
git add prisma/
git commit -m "feat(db): adiciona brandingConfig ao Tenant"
```

---

## Task 4: IAM Repository e Service — método `register`

**Files:**
- Create: `src/domains/iam/iam.repository.ts`
- Modify: `src/domains/iam/iam.service.ts`

- [ ] **Criar `src/domains/iam/iam.repository.ts`**

```typescript
import { UserRole } from "@prisma/client";
import { prisma } from "@/shared/database/prisma";
import { ROLE_PERMISSIONS } from "@/shared/auth/permissions";

type CreateTenantWithOwnerInput = {
  userId: string;
  email: string;
  businessName: string;
  userName: string;
};

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export class IamRepository {
  async createTenantWithOwner(input: CreateTenantWithOwnerInput) {
    const slug = generateSlug(input.businessName);

    return prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({
        data: {
          name: input.businessName,
          slug,
          brandingConfig: {
            primaryColor: "#191919",
            logoUrl: null,
            displayName: input.businessName,
          },
        },
      });

      const user = await tx.user.create({
        data: {
          id: input.userId,
          tenantId: tenant.id,
          email: input.email,
          name: input.userName,
          role: UserRole.OWNER,
          permissions: ROLE_PERMISSIONS[UserRole.OWNER],
        },
      });

      return { tenant, user };
    });
  }

  async findTenantBySlug(slug: string) {
    return prisma.tenant.findUnique({ where: { slug } });
  }
}

export const iamRepository = new IamRepository();
```

- [ ] **Atualizar `src/domains/iam/iam.service.ts`**

Substituir o conteúdo completo por:

```typescript
import { prisma } from "@/shared/database/prisma";
import { supabaseAdmin } from "@/integrations/supabase/admin";
import { NotFoundError, ConflictError } from "@/shared/errors";
import { iamRepository } from "./iam.repository";
import type { SessionContext } from "@/shared/types/auth";
import { UserRole } from "@prisma/client";

type RegisterInput = {
  businessName: string;
  userName: string;
};

export class IamService {
  async getCurrentUser(session: SessionContext) {
    const user = await prisma.user.findFirst({
      where: {
        id: session.userId,
        tenantId: session.tenantId,
      },
      select: {
        id: true,
        tenantId: true,
        email: true,
        name: true,
        role: true,
        permissions: true,
      },
    });

    if (!user) {
      throw new NotFoundError("Usuario");
    }

    return user;
  }

  async register(userId: string, input: RegisterInput) {
    const { data: authUser, error } =
      await supabaseAdmin.auth.admin.getUserById(userId);

    if (error || !authUser.user) {
      throw new NotFoundError("Usuario Supabase");
    }

    const existingUser = await prisma.user.findFirst({ where: { id: userId } });
    if (existingUser) {
      throw new ConflictError("Tenant ja cadastrado para este usuario.");
    }

    const { tenant, user } = await iamRepository.createTenantWithOwner({
      userId,
      email: authUser.user.email!,
      businessName: input.businessName,
      userName: input.userName,
    });

    await supabaseAdmin.auth.admin.updateUserById(userId, {
      user_metadata: {
        tenantId: tenant.id,
        role: UserRole.OWNER,
      },
    });

    return { tenantId: tenant.id, userId: user.id };
  }
}

export const iamService = new IamService();
```

- [ ] **Verificar TypeScript**

```bash
npx tsc --noEmit
```

Esperado: sem erros.

- [ ] **Commit**

```bash
git add src/domains/iam/
git commit -m "feat(iam): adiciona repository e metodo register ao service"
```

---

## Task 5: API — `POST /api/iam/register`

**Files:**
- Create: `src/app/api/iam/register/route.ts`

- [ ] **Criar `src/app/api/iam/register/route.ts`**

```typescript
import { z } from "zod";
import { iamService } from "@/domains/iam/iam.service";
import { initializeDomainRuntime } from "@/app/api/_lib/runtime";
import { getSessionContext } from "@/shared/auth/session";
import { handleApiError } from "@/shared/http/handle-api-error";
import { validateInput } from "@/shared/http/validate-input";

const RegisterSchema = z.object({
  businessName: z.string().min(2, "Nome do negocio muito curto"),
  userName: z.string().min(2, "Nome muito curto"),
});

export async function POST(req: Request) {
  initializeDomainRuntime();

  try {
    const session = await getSessionContext(req);
    const input = await validateInput(req, RegisterSchema);
    const result = await iamService.register(session.userId, input);
    return Response.json(result, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
```

- [ ] **Verificar TypeScript**

```bash
npx tsc --noEmit
```

- [ ] **Testar com curl** (com dev server rodando: `npm run dev`)

```bash
# Substitua TOKEN pelo JWT do Supabase (obtenha via supabase.auth.getSession() no browser)
curl -X POST http://localhost:3000/api/iam/register \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TOKEN" \
  -d '{"businessName":"Barbearia do Joao","userName":"Joao Silva"}'
```

Esperado: `{ "tenantId": "...", "userId": "..." }` com status 201.

- [ ] **Commit**

```bash
git add src/app/api/iam/register/
git commit -m "feat(api): POST /api/iam/register — cria tenant e usuario OWNER"
```

---

## Task 6: API — `GET /api/iam/tenant-branding` (pública)

**Files:**
- Create: `src/app/api/iam/tenant-branding/route.ts`

- [ ] **Criar `src/app/api/iam/tenant-branding/route.ts`**

```typescript
import { iamRepository } from "@/domains/iam/iam.repository";

const DEFAULT_BRANDING = {
  primaryColor: "#191919",
  logoUrl: null,
  displayName: "SaaS Estetica",
};

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const slug = searchParams.get("slug");

  if (!slug) {
    return Response.json(DEFAULT_BRANDING);
  }

  const tenant = await iamRepository.findTenantBySlug(slug);

  if (!tenant) {
    return Response.json(DEFAULT_BRANDING);
  }

  const branding =
    typeof tenant.brandingConfig === "object" && tenant.brandingConfig !== null
      ? (tenant.brandingConfig as {
          primaryColor?: string;
          logoUrl?: string | null;
          displayName?: string;
        })
      : {};

  return Response.json({
    primaryColor: branding.primaryColor ?? DEFAULT_BRANDING.primaryColor,
    logoUrl: branding.logoUrl ?? null,
    displayName: branding.displayName ?? tenant.name,
  });
}
```

- [ ] **Testar com curl**

```bash
curl http://localhost:3000/api/iam/tenant-branding
```

Esperado: `{ "primaryColor": "#191919", "logoUrl": null, "displayName": "SaaS Estetica" }`

```bash
curl "http://localhost:3000/api/iam/tenant-branding?slug=inexistente"
```

Esperado: mesmo resultado default.

- [ ] **Commit**

```bash
git add src/app/api/iam/tenant-branding/
git commit -m "feat(api): GET /api/iam/tenant-branding — branding publico por slug"
```

---

## Task 7: Middleware de proteção de rotas

**Files:**
- Create: `middleware.ts` (raiz do projeto)

- [ ] **Criar `middleware.ts` na raiz do projeto**

```typescript
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/dashboard")) {
    if (!user) {
      return NextResponse.redirect(new URL("/auth/login", request.url));
    }
    if (!user.user_metadata?.tenantId) {
      return NextResponse.redirect(new URL("/auth/onboarding", request.url));
    }
  }

  const isAuthRoute = pathname.startsWith("/auth");
  const isPublicAuthRoute =
    pathname.includes("/callback") || pathname.includes("/reset-password");

  if (isAuthRoute && !isPublicAuthRoute) {
    if (user?.user_metadata?.tenantId) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: ["/dashboard/:path*", "/auth/:path*"],
};
```

- [ ] **Verificar TypeScript**

```bash
npx tsc --noEmit
```

- [ ] **Testar comportamento** (dev server rodando)

Abrir `http://localhost:3000/dashboard` sem estar logado. Esperado: redirect para `/auth/login`.

- [ ] **Commit**

```bash
git add middleware.ts
git commit -m "feat(auth): middleware de protecao de rotas"
```

---

## Task 8: Componentes compartilhados de auth

**Files:**
- Create: `src/components/auth/password-strength.tsx`
- Create: `src/components/auth/google-button.tsx`

- [ ] **Criar `src/components/auth/password-strength.tsx`**

```typescript
"use client";

type Strength = "fraca" | "media" | "forte";

function getStrength(password: string): Strength {
  if (password.length < 8) return "fraca";
  const hasNumber = /\d/.test(password);
  const hasSpecial = /[^a-zA-Z0-9]/.test(password);
  const hasUpper = /[A-Z]/.test(password);
  if (hasNumber && hasSpecial && hasUpper) return "forte";
  if (hasNumber || hasSpecial) return "media";
  return "fraca";
}

const strengthConfig: Record<
  Strength,
  { label: string; color: string; width: string }
> = {
  fraca: { label: "Fraca", color: "bg-red-500", width: "w-1/3" },
  media: { label: "Media", color: "bg-yellow-500", width: "w-2/3" },
  forte: { label: "Forte", color: "bg-green-500", width: "w-full" },
};

type Props = {
  password: string;
};

export function PasswordStrength({ password }: Props) {
  if (!password) return null;

  const strength = getStrength(password);
  const config = strengthConfig[strength];

  return (
    <div className="space-y-1">
      <div className="h-1 w-full rounded-full bg-[#e5e5e5]">
        <div
          className={`h-1 rounded-full transition-all duration-300 ${config.color} ${config.width}`}
        />
      </div>
      <p className="text-xs text-[#787774]">Senha {config.label}</p>
    </div>
  );
}
```

- [ ] **Criar `src/components/auth/google-button.tsx`**

```typescript
"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createSupabaseBrowserClient } from "@/integrations/supabase/client";

export function GoogleButton() {
  const [loading, setLoading] = useState(false);

  async function handleGoogleLogin() {
    setLoading(true);
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
  }

  return (
    <Button
      type="button"
      variant="outline"
      className="w-full border-[#e5e5e5] bg-white text-[#37352f] hover:bg-[#f7f6f3] hover:text-[#191919]"
      onClick={handleGoogleLogin}
      disabled={loading}
    >
      {loading ? (
        <Loader2 className="mr-2 size-4 animate-spin" />
      ) : (
        <svg className="mr-2 size-4" viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            fill="#4285F4"
          />
          <path
            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            fill="#34A853"
          />
          <path
            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
            fill="#FBBC05"
          />
          <path
            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            fill="#EA4335"
          />
        </svg>
      )}
      Continuar com Google
    </Button>
  );
}
```

- [ ] **Verificar TypeScript**

```bash
npx tsc --noEmit
```

- [ ] **Commit**

```bash
git add src/components/auth/
git commit -m "feat(auth): componentes PasswordStrength e GoogleButton"
```

---

## Task 9: Auth layout

**Files:**
- Create: `src/app/(auth)/layout.tsx`

- [ ] **Criar `src/app/(auth)/layout.tsx`**

```typescript
import type { ReactNode } from "react";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[#f7f6f3]">
      {children}
    </div>
  );
}
```

- [ ] **Verificar TypeScript**

```bash
npx tsc --noEmit
```

- [ ] **Commit**

```bash
git add src/app/(auth)/
git commit -m "feat(auth): layout do route group (auth)"
```

---

## Task 10: Tela `/auth/login` — split + abas

**Files:**
- Create: `src/app/(auth)/login/page.tsx`

- [ ] **Criar `src/app/(auth)/login/page.tsx`**

```typescript
import { Suspense } from "react";
import { LoginClient } from "./login-client";

type Props = {
  searchParams: Promise<{ tenant?: string }>;
};

export default async function LoginPage({ searchParams }: Props) {
  const params = await searchParams;
  const tenantSlug = params.tenant ?? null;

  let branding = {
    primaryColor: "#191919",
    logoUrl: null as string | null,
    displayName: "SaaS Estetica",
  };

  if (tenantSlug) {
    try {
      const baseUrl =
        process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
      const res = await fetch(
        `${baseUrl}/api/iam/tenant-branding?slug=${tenantSlug}`,
        { cache: "no-store" },
      );
      if (res.ok) branding = await res.json();
    } catch {
      // branding default
    }
  }

  return (
    <Suspense>
      <LoginClient branding={branding} />
    </Suspense>
  );
}
```

- [ ] **Criar `src/app/(auth)/login/login-client.tsx`**

```typescript
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Eye, EyeOff, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { PasswordStrength } from "@/components/auth/password-strength";
import { GoogleButton } from "@/components/auth/google-button";
import { createSupabaseBrowserClient } from "@/integrations/supabase/client";

// ─── Schemas ───────────────────────────────────────────────────────────────

const loginSchema = z.object({
  email: z.string().email("Email invalido"),
  password: z.string().min(1, "Senha obrigatoria"),
});

const signupSchema = z
  .object({
    businessName: z
      .string()
      .min(2, "Nome do negocio muito curto"),
    userName: z.string().min(2, "Nome muito curto"),
    email: z.string().email("Email invalido"),
    password: z.string().min(8, "Minimo 8 caracteres"),
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "As senhas nao conferem",
    path: ["confirmPassword"],
  });

type LoginForm = z.infer<typeof loginSchema>;
type SignupForm = z.infer<typeof signupSchema>;

// ─── Props ─────────────────────────────────────────────────────────────────

type Branding = {
  primaryColor: string;
  logoUrl: string | null;
  displayName: string;
};

type Props = {
  branding: Branding;
};

// ─── Component ─────────────────────────────────────────────────────────────

export function LoginClient({ branding }: Props) {
  const router = useRouter();

  return (
    <div className="flex min-h-screen">
      <LeftPanel branding={branding} />
      <RightPanel router={router} />
    </div>
  );
}

// ─── Left panel ────────────────────────────────────────────────────────────

function LeftPanel({ branding }: { branding: Branding }) {
  const benefits = [
    "Agenda inteligente com deteccao de conflitos",
    "CRM de clientes com historico completo",
    "Financeiro conectado ao atendimento",
  ];

  return (
    <div className="hidden lg:flex lg:w-[45%] flex-col border-r border-[#e5e5e5] bg-[#f7f6f3] p-12">
      <div className="flex items-center gap-3">
        {branding.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={branding.logoUrl}
            alt={branding.displayName}
            className="h-8 w-auto"
          />
        ) : (
          <div className="flex size-8 items-center justify-center rounded-lg bg-[#191919]">
            <Sparkles className="size-4 text-white" />
          </div>
        )}
        <span className="text-sm font-semibold tracking-tight text-[#191919]">
          {branding.displayName}
        </span>
      </div>

      <div className="my-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold leading-tight tracking-tight text-[#191919]">
            O workspace dos
            <br />
            profissionais de estetica.
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-[#787774]">
            Agenda, CRM, financeiro e IA em uma plataforma so.
          </p>
        </div>

        <div className="space-y-2">
          {benefits.map((b) => (
            <div
              key={b}
              className="flex items-center gap-3 rounded-md border border-[#e5e5e5] bg-white px-4 py-3"
            >
              <div className="size-4 rounded-sm bg-[#e3e2df]" />
              <span className="text-sm text-[#37352f]">{b}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Right panel ───────────────────────────────────────────────────────────

function RightPanel({ router }: { router: ReturnType<typeof useRouter> }) {
  return (
    <div className="flex w-full flex-col items-center justify-center bg-white p-8 lg:w-[55%]">
      <div className="w-full max-w-sm space-y-6">
        <div className="lg:hidden flex items-center gap-2">
          <div className="flex size-7 items-center justify-center rounded-lg bg-[#191919]">
            <Sparkles className="size-3.5 text-white" />
          </div>
          <span className="text-sm font-semibold text-[#191919]">
            SaaS Estetica
          </span>
        </div>

        <Tabs defaultValue="login" className="w-full">
          <TabsList className="grid w-full grid-cols-2 bg-[#f7f6f3]">
            <TabsTrigger
              value="login"
              className="data-[state=active]:bg-[#191919] data-[state=active]:text-white"
            >
              Entrar
            </TabsTrigger>
            <TabsTrigger
              value="signup"
              className="data-[state=active]:bg-[#191919] data-[state=active]:text-white"
            >
              Criar conta
            </TabsTrigger>
          </TabsList>

          <TabsContent value="login" className="mt-6">
            <LoginForm router={router} />
          </TabsContent>

          <TabsContent value="signup" className="mt-6">
            <SignupForm router={router} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

// ─── Login form ────────────────────────────────────────────────────────────

function LoginForm({ router }: { router: ReturnType<typeof useRouter> }) {
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>({ resolver: zodResolver(loginSchema) });

  async function onSubmit(data: LoginForm) {
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.signInWithPassword({
      email: data.email,
      password: data.password,
    });

    if (error) {
      if (error.message.includes("Invalid login credentials")) {
        toast.error("Email ou senha incorretos.");
      } else if (error.message.includes("Email not confirmed")) {
        toast.error("Confirme seu email antes de entrar.");
      } else {
        toast.error("Erro ao fazer login. Tente novamente.");
      }
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="login-email" className="text-[#37352f]">
          Email
        </Label>
        <Input
          id="login-email"
          type="email"
          autoComplete="email"
          placeholder="voce@exemplo.com"
          className="border-[#e5e5e5] bg-[#f7f6f3] focus-visible:ring-[#191919]"
          {...register("email")}
        />
        {errors.email && (
          <p className="text-xs text-red-500">{errors.email.message}</p>
        )}
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label htmlFor="login-password" className="text-[#37352f]">
            Senha
          </Label>
          <a
            href="/auth/forgot-password"
            className="text-xs text-[#787774] hover:text-[#191919]"
          >
            Esqueceu sua senha?
          </a>
        </div>
        <div className="relative">
          <Input
            id="login-password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            placeholder="••••••••"
            className="border-[#e5e5e5] bg-[#f7f6f3] pr-10 focus-visible:ring-[#191919]"
            {...register("password")}
          />
          <button
            type="button"
            className="absolute right-3 top-1/2 -translate-y-1/2 text-[#787774] hover:text-[#191919]"
            onClick={() => setShowPassword((p) => !p)}
            aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
          >
            {showPassword ? (
              <EyeOff className="size-4" />
            ) : (
              <Eye className="size-4" />
            )}
          </button>
        </div>
        {errors.password && (
          <p className="text-xs text-red-500">{errors.password.message}</p>
        )}
      </div>

      <Button
        type="submit"
        className="w-full bg-[#191919] text-white hover:bg-[#2d2d2d]"
        disabled={isSubmitting}
      >
        {isSubmitting ? (
          <>
            <Loader2 className="mr-2 size-4 animate-spin" />
            Entrando...
          </>
        ) : (
          "Entrar"
        )}
      </Button>

      <div className="relative">
        <Separator className="bg-[#e5e5e5]" />
        <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-white px-2 text-xs text-[#b7b6b2]">
          ou
        </span>
      </div>

      <GoogleButton />
    </form>
  );
}

// ─── Signup form ───────────────────────────────────────────────────────────

function SignupForm({ router }: { router: ReturnType<typeof useRouter> }) {
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<SignupForm>({ resolver: zodResolver(signupSchema) });

  const passwordValue = watch("password", "");

  async function onSubmit(data: SignupForm) {
    const supabase = createSupabaseBrowserClient();

    const { data: authData, error: signUpError } = await supabase.auth.signUp({
      email: data.email,
      password: data.password,
    });

    if (signUpError) {
      if (signUpError.message.includes("already registered")) {
        toast.error("Este email ja possui uma conta. Faca login.");
      } else {
        toast.error(signUpError.message);
      }
      return;
    }

    if (!authData.user) {
      toast.error("Erro ao criar conta. Tente novamente.");
      return;
    }

    const session = authData.session;
    if (!session) {
      toast.success("Conta criada! Verifique seu email para confirmar.");
      return;
    }

    const res = await fetch("/api/iam/register", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        businessName: data.businessName,
        userName: data.userName,
      }),
    });

    if (!res.ok) {
      const body = await res.json();
      toast.error(body.error?.message ?? "Erro ao configurar sua conta.");
      return;
    }

    toast.success("Conta criada com sucesso!");
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-1.5">
        <Label className="text-[#37352f]">Nome do negocio</Label>
        <Input
          placeholder="Ex: Barbearia do Joao"
          className="border-[#e5e5e5] bg-[#f7f6f3] focus-visible:ring-[#191919]"
          {...register("businessName")}
        />
        {errors.businessName && (
          <p className="text-xs text-red-500">{errors.businessName.message}</p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label className="text-[#37352f]">Seu nome</Label>
        <Input
          placeholder="Nome completo"
          className="border-[#e5e5e5] bg-[#f7f6f3] focus-visible:ring-[#191919]"
          {...register("userName")}
        />
        {errors.userName && (
          <p className="text-xs text-red-500">{errors.userName.message}</p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label className="text-[#37352f]">Email</Label>
        <Input
          type="email"
          placeholder="voce@exemplo.com"
          className="border-[#e5e5e5] bg-[#f7f6f3] focus-visible:ring-[#191919]"
          {...register("email")}
        />
        {errors.email && (
          <p className="text-xs text-red-500">{errors.email.message}</p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label className="text-[#37352f]">Senha</Label>
        <div className="relative">
          <Input
            type={showPassword ? "text" : "password"}
            placeholder="Minimo 8 caracteres"
            className="border-[#e5e5e5] bg-[#f7f6f3] pr-10 focus-visible:ring-[#191919]"
            {...register("password")}
          />
          <button
            type="button"
            className="absolute right-3 top-1/2 -translate-y-1/2 text-[#787774] hover:text-[#191919]"
            onClick={() => setShowPassword((p) => !p)}
            aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
          >
            {showPassword ? (
              <EyeOff className="size-4" />
            ) : (
              <Eye className="size-4" />
            )}
          </button>
        </div>
        <PasswordStrength password={passwordValue} />
        {errors.password && (
          <p className="text-xs text-red-500">{errors.password.message}</p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label className="text-[#37352f]">Confirmar senha</Label>
        <Input
          type="password"
          placeholder="Repita a senha"
          className="border-[#e5e5e5] bg-[#f7f6f3] focus-visible:ring-[#191919]"
          {...register("confirmPassword")}
        />
        {errors.confirmPassword && (
          <p className="text-xs text-red-500">
            {errors.confirmPassword.message}
          </p>
        )}
      </div>

      <Button
        type="submit"
        className="w-full bg-[#191919] text-white hover:bg-[#2d2d2d]"
        disabled={isSubmitting}
      >
        {isSubmitting ? (
          <>
            <Loader2 className="mr-2 size-4 animate-spin" />
            Criando conta...
          </>
        ) : (
          "Criar conta"
        )}
      </Button>

      <div className="relative">
        <Separator className="bg-[#e5e5e5]" />
        <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-white px-2 text-xs text-[#b7b6b2]">
          ou
        </span>
      </div>

      <GoogleButton />

      <p className="text-center text-xs text-[#787774]">
        Ao criar uma conta, voce concorda com nossos{" "}
        <a href="#" className="underline hover:text-[#191919]">
          Termos de Uso
        </a>{" "}
        e{" "}
        <a href="#" className="underline hover:text-[#191919]">
          Politica de Privacidade
        </a>
        .
      </p>
    </form>
  );
}
```

- [ ] **Verificar TypeScript**

```bash
npx tsc --noEmit
```

- [ ] **Testar no browser** (dev server rodando)

Abrir `http://localhost:3000/auth/login`. Verificar:
- Split visível no desktop, formulário apenas no mobile
- Alternância entre abas Entrar / Criar conta sem layout shift
- Toggle show/hide senha funciona
- Barra de força da senha aparece ao digitar no campo senha do cadastro

- [ ] **Commit**

```bash
git add src/app/(auth)/login/
git commit -m "feat(auth): tela de login com split Notion e abas entrar/cadastro"
```

---

## Task 11: Rota `/auth/callback` — handler OAuth

**Files:**
- Create: `src/app/(auth)/callback/route.ts`

- [ ] **Criar `src/app/(auth)/callback/route.ts`**

```typescript
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { env } from "@/shared/config/env";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");

  if (!code) {
    return NextResponse.redirect(new URL("/auth/login", request.url));
  }

  const cookieStore = await cookies();

  const supabase = createServerClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) =>
          cookieStore.set(name, value, options),
        );
      },
    },
  });

  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(new URL("/auth/login", request.url));
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user?.user_metadata?.tenantId) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.redirect(new URL("/auth/onboarding", request.url));
}
```

- [ ] **Verificar TypeScript**

```bash
npx tsc --noEmit
```

- [ ] **Commit**

```bash
git add src/app/(auth)/callback/
git commit -m "feat(auth): handler OAuth /auth/callback"
```

---

## Task 12: Tela `/auth/onboarding`

**Files:**
- Create: `src/app/(auth)/onboarding/page.tsx`

- [ ] **Criar `src/app/(auth)/onboarding/page.tsx`**

```typescript
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createSupabaseBrowserClient } from "@/integrations/supabase/client";

const schema = z.object({
  businessName: z.string().min(2, "Nome do negocio muito curto"),
  userName: z.string().min(2, "Nome muito curto"),
});

type Form = z.infer<typeof schema>;

export default function OnboardingPage() {
  const router = useRouter();
  const [initialName, setInitialName] = useState("");

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    supabase.auth.getUser().then(({ data }) => {
      const name =
        data.user?.user_metadata?.full_name ??
        data.user?.user_metadata?.name ??
        "";
      setInitialName(name);
    });
  }, []);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Form>({
    resolver: zodResolver(schema),
    values: { businessName: "", userName: initialName },
  });

  async function onSubmit(data: Form) {
    const supabase = createSupabaseBrowserClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      toast.error("Sessao expirada. Faca login novamente.");
      router.push("/auth/login");
      return;
    }

    const res = await fetch("/api/iam/register", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify(data),
    });

    if (!res.ok) {
      const body = await res.json();
      toast.error(body.error?.message ?? "Erro ao configurar sua conta.");
      return;
    }

    toast.success("Tudo pronto! Bem-vindo ao workspace.");
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-8">
      <div className="w-full max-w-sm space-y-8">
        <div className="flex size-10 items-center justify-center rounded-xl bg-[#191919]">
          <Sparkles className="size-5 text-white" />
        </div>

        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#191919]">
            Quase la!
          </h1>
          <p className="mt-2 text-sm text-[#787774]">
            Como se chama seu negocio? Voce pode alterar isso depois nas
            configuracoes.
          </p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-[#37352f]">Nome do negocio</Label>
            <Input
              placeholder="Ex: Barbearia do Joao"
              className="border-[#e5e5e5] bg-white focus-visible:ring-[#191919]"
              {...register("businessName")}
            />
            {errors.businessName && (
              <p className="text-xs text-red-500">
                {errors.businessName.message}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label className="text-[#37352f]">Seu nome</Label>
            <Input
              placeholder="Nome completo"
              className="border-[#e5e5e5] bg-white focus-visible:ring-[#191919]"
              {...register("userName")}
            />
            {errors.userName && (
              <p className="text-xs text-red-500">{errors.userName.message}</p>
            )}
          </div>

          <Button
            type="submit"
            className="w-full bg-[#191919] text-white hover:bg-[#2d2d2d]"
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" />
                Configurando...
              </>
            ) : (
              "Comecar →"
            )}
          </Button>
        </form>
      </div>
    </div>
  );
}
```

- [ ] **Verificar TypeScript**

```bash
npx tsc --noEmit
```

- [ ] **Commit**

```bash
git add src/app/(auth)/onboarding/
git commit -m "feat(auth): tela de onboarding pos-Google OAuth"
```

---

## Task 13: Tela `/auth/forgot-password`

**Files:**
- Create: `src/app/(auth)/forgot-password/page.tsx`

- [ ] **Criar `src/app/(auth)/forgot-password/page.tsx`**

```typescript
"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, Mail, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createSupabaseBrowserClient } from "@/integrations/supabase/client";

const schema = z.object({
  email: z.string().email("Email invalido"),
});

type Form = z.infer<typeof schema>;

export default function ForgotPasswordPage() {
  const [sent, setSent] = useState(false);
  const [sentEmail, setSentEmail] = useState("");
  const [cooldown, setCooldown] = useState(0);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Form>({ resolver: zodResolver(schema) });

  async function onSubmit(data: Form) {
    const supabase = createSupabaseBrowserClient();
    const redirectTo = `${window.location.origin}/auth/reset-password`;

    const { error } = await supabase.auth.resetPasswordForEmail(data.email, {
      redirectTo,
    });

    if (error) {
      toast.error("Erro ao enviar email. Tente novamente.");
      return;
    }

    setSentEmail(data.email);
    setSent(true);
    setCooldown(60);

    const timer = setInterval(() => {
      setCooldown((c) => {
        if (c <= 1) {
          clearInterval(timer);
          return 0;
        }
        return c - 1;
      });
    }, 1000);
  }

  if (sent) {
    return (
      <div className="flex min-h-screen items-center justify-center p-8">
        <div className="w-full max-w-sm space-y-6 text-center">
          <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-[#e3e2df]">
            <Mail className="size-6 text-[#37352f]" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-[#191919]">
              Verifique seu email
            </h1>
            <p className="mt-2 text-sm text-[#787774]">
              Enviamos as instrucoes para{" "}
              <span className="font-medium text-[#37352f]">{sentEmail}</span>.
              Verifique sua caixa de entrada e spam.
            </p>
          </div>
          <Button
            variant="outline"
            className="w-full border-[#e5e5e5]"
            onClick={() => onSubmit({ email: sentEmail })}
            disabled={cooldown > 0 || isSubmitting}
          >
            {cooldown > 0
              ? `Reenviar em ${cooldown}s`
              : "Reenviar email"}
          </Button>
          <a
            href="/auth/login"
            className="block text-sm text-[#787774] hover:text-[#191919]"
          >
            ← Voltar para o login
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-8">
      <div className="w-full max-w-sm space-y-8">
        <div className="flex size-10 items-center justify-center rounded-xl bg-[#191919]">
          <Sparkles className="size-5 text-white" />
        </div>

        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#191919]">
            Esqueceu sua senha?
          </h1>
          <p className="mt-2 text-sm text-[#787774]">
            Digite seu email e enviaremos as instrucoes.
          </p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-[#37352f]">Email</Label>
            <Input
              type="email"
              placeholder="voce@exemplo.com"
              className="border-[#e5e5e5] bg-white focus-visible:ring-[#191919]"
              {...register("email")}
            />
            {errors.email && (
              <p className="text-xs text-red-500">{errors.email.message}</p>
            )}
          </div>

          <Button
            type="submit"
            className="w-full bg-[#191919] text-white hover:bg-[#2d2d2d]"
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" />
                Enviando...
              </>
            ) : (
              "Enviar instrucoes"
            )}
          </Button>
        </form>

        <a
          href="/auth/login"
          className="block text-center text-sm text-[#787774] hover:text-[#191919]"
        >
          ← Voltar para o login
        </a>
      </div>
    </div>
  );
}
```

- [ ] **Verificar TypeScript**

```bash
npx tsc --noEmit
```

- [ ] **Commit**

```bash
git add src/app/(auth)/forgot-password/
git commit -m "feat(auth): tela de esqueci minha senha"
```

---

## Task 14: Tela `/auth/reset-password`

**Files:**
- Create: `src/app/(auth)/reset-password/page.tsx`

- [ ] **Criar `src/app/(auth)/reset-password/page.tsx`**

```typescript
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { CheckCircle, Eye, EyeOff, Loader2, Sparkles, XCircle } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordStrength } from "@/components/auth/password-strength";
import { createSupabaseBrowserClient } from "@/integrations/supabase/client";

const schema = z
  .object({
    password: z.string().min(8, "Minimo 8 caracteres"),
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "As senhas nao conferem",
    path: ["confirmPassword"],
  });

type Form = z.infer<typeof schema>;

export default function ResetPasswordPage() {
  const router = useRouter();
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [sessionValid, setSessionValid] = useState<boolean | null>(null);
  const [done, setDone] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    supabase.auth.getUser().then(({ data, error }) => {
      if (error || !data.user) {
        setSessionValid(false);
        return;
      }
      setSessionValid(true);
      setUserEmail(data.user.email ?? null);
    });
  }, []);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<Form>({ resolver: zodResolver(schema) });

  const passwordValue = watch("password", "");

  async function onSubmit(data: Form) {
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.updateUser({
      password: data.password,
    });

    if (error) {
      toast.error("Erro ao redefinir senha. O link pode ter expirado.");
      return;
    }

    setDone(true);
  }

  if (sessionValid === null) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="size-6 animate-spin text-[#787774]" />
      </div>
    );
  }

  if (!sessionValid) {
    return (
      <div className="flex min-h-screen items-center justify-center p-8">
        <div className="w-full max-w-sm space-y-6 text-center">
          <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-red-100">
            <XCircle className="size-6 text-red-500" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-[#191919]">
              Link invalido ou expirado
            </h1>
            <p className="mt-2 text-sm text-[#787774]">
              Solicite um novo link de redefinicao de senha.
            </p>
          </div>
          <Button
            className="w-full bg-[#191919] text-white hover:bg-[#2d2d2d]"
            onClick={() => router.push("/auth/forgot-password")}
          >
            Solicitar novo link
          </Button>
        </div>
      </div>
    );
  }

  if (done) {
    return (
      <div className="flex min-h-screen items-center justify-center p-8">
        <div className="w-full max-w-sm space-y-6 text-center">
          <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-green-100">
            <CheckCircle className="size-6 text-green-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-[#191919]">
              Senha alterada com sucesso!
            </h1>
            <p className="mt-2 text-sm text-[#787774]">
              Voce ja pode entrar com sua nova senha.
            </p>
          </div>
          <Button
            className="w-full bg-[#191919] text-white hover:bg-[#2d2d2d]"
            onClick={() => router.push("/auth/login")}
          >
            Ir para o login
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-8">
      <div className="w-full max-w-sm space-y-8">
        <div className="flex size-10 items-center justify-center rounded-xl bg-[#191919]">
          <Sparkles className="size-5 text-white" />
        </div>

        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#191919]">
            Criar nova senha
          </h1>
          {userEmail && (
            <p className="mt-2 text-sm text-[#787774]">
              Para a conta{" "}
              <span className="font-medium text-[#37352f]">{userEmail}</span>
            </p>
          )}
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {userEmail && (
            <div className="space-y-1.5">
              <Label className="text-[#37352f]">Email</Label>
              <Input
                type="email"
                value={userEmail}
                readOnly
                className="border-[#e5e5e5] bg-[#f7f6f3] text-[#787774]"
              />
            </div>
          )}

          <div className="space-y-1.5">
            <Label className="text-[#37352f]">Nova senha</Label>
            <div className="relative">
              <Input
                type={showPassword ? "text" : "password"}
                placeholder="Minimo 8 caracteres"
                className="border-[#e5e5e5] bg-white pr-10 focus-visible:ring-[#191919]"
                {...register("password")}
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#787774] hover:text-[#191919]"
                onClick={() => setShowPassword((p) => !p)}
                aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
              >
                {showPassword ? (
                  <EyeOff className="size-4" />
                ) : (
                  <Eye className="size-4" />
                )}
              </button>
            </div>
            <PasswordStrength password={passwordValue} />
            {errors.password && (
              <p className="text-xs text-red-500">{errors.password.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label className="text-[#37352f]">Confirmar nova senha</Label>
            <Input
              type="password"
              placeholder="Repita a nova senha"
              className="border-[#e5e5e5] bg-white focus-visible:ring-[#191919]"
              {...register("confirmPassword")}
            />
            {errors.confirmPassword && (
              <p className="text-xs text-red-500">
                {errors.confirmPassword.message}
              </p>
            )}
          </div>

          <Button
            type="submit"
            className="w-full bg-[#191919] text-white hover:bg-[#2d2d2d]"
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" />
                Redefinindo...
              </>
            ) : (
              "Redefinir senha"
            )}
          </Button>
        </form>
      </div>
    </div>
  );
}
```

- [ ] **Verificar TypeScript**

```bash
npx tsc --noEmit
```

- [ ] **Testar no browser**

Abrir `http://localhost:3000/auth/reset-password` sem token de reset.
Esperado: tela de "Link invalido ou expirado" com botão de solicitar novo link.

- [ ] **Commit**

```bash
git add src/app/(auth)/reset-password/
git commit -m "feat(auth): tela de reset de senha"
```

---

## Task 15: Configuração do Google OAuth no Supabase

> Esta tarefa é manual — requer acesso ao Google Cloud Console e ao painel do Supabase.

- [ ] **Criar projeto OAuth no Google Cloud Console**

1. Acessar [console.cloud.google.com](https://console.cloud.google.com)
2. Criar projeto ou selecionar existente
3. Ir em **APIs & Services → Credentials → Create Credentials → OAuth 2.0 Client ID**
4. Application type: **Web application**
5. Authorized redirect URIs: `https://vcbkcwcgejukjjagcleh.supabase.co/auth/v1/callback`
6. Salvar e copiar **Client ID** e **Client Secret**

- [ ] **Configurar Google no painel Supabase**

1. Acessar [supabase.com/dashboard](https://supabase.com/dashboard) → projeto `vcbkcwcgejukjjagcleh`
2. Ir em **Authentication → Providers → Google**
3. Habilitar → colar **Client ID** e **Client Secret**
4. Salvar

- [ ] **Configurar URLs de redirect**

No painel Supabase → **Authentication → URL Configuration**:
- Site URL: `http://localhost:3000` (dev) / URL do Vercel (prod)
- Redirect URLs: adicionar `http://localhost:3000/auth/callback` e a URL de produção

- [ ] **Testar fluxo Google**

No dev server rodando, clicar em "Continuar com Google" na tela de login.
Esperado: redirect para Google consent → voltar para `/auth/callback` → redirect para `/auth/onboarding` (novo usuário) ou `/dashboard` (usuário existente).

- [ ] **Commit final**

```bash
git add -A
git commit -m "chore(auth): configuracao Google OAuth documentada"
```

---

## Auto-revisão do plano

**Cobertura da spec:**
- ✅ Split Notion dark + branding white-label (Task 10)
- ✅ Login email/senha (Task 10)
- ✅ Cadastro com criação de tenant (Tasks 4, 5, 10)
- ✅ Google OAuth (Tasks 8, 11, 15)
- ✅ Onboarding pós-Google (Task 12)
- ✅ Esqueci senha (Task 13)
- ✅ Reset senha com email pré-preenchido (Task 14)
- ✅ Middleware proteção de rotas (Task 7)
- ✅ Migration brandingConfig (Task 3)
- ✅ Rota pública tenant-branding (Task 6)
- ✅ AppShell movido para (app) route group (Task 2)
- ✅ Supabase browser client (Task 1)

**Consistência de tipos:**
- `createTenantWithOwner` definida em Task 4, usada em Task 4 ✅
- `createSupabaseBrowserClient` definida em Task 1, usada em Tasks 8, 10, 11, 12, 13, 14 ✅
- `iamRepository.findTenantBySlug` definida em Task 4, usada em Task 6 ✅
- `iamService.register` definida em Task 4, usada em Task 5 ✅
- `PasswordStrength` definida em Task 8, usada em Tasks 10, 14 ✅
- `GoogleButton` definida em Task 8, usada em Task 10 ✅
