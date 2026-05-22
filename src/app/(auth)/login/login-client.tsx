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
