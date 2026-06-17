"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Eye, EyeOff, Loader2, MapPin } from "lucide-react";
import { toast } from "sonner";
import Image from "next/image";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PasswordStrength } from "@/components/auth/password-strength";
import { createSupabaseBrowserClient } from "@/integrations/supabase/client";

// ─── Máscaras ──────────────────────────────────────────────────────────────

function maskPhone(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 2) return digits.length ? `(${digits}` : "";
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 11)
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  return value;
}

function maskCpf(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
}

function maskCep(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 5) return digits;
  return `${digits.slice(0, 5)}-${digits.slice(5)}`;
}

// ─── Validação de CPF ──────────────────────────────────────────────────────

function validateCpf(cpf: string): boolean {
  const digits = cpf.replace(/\D/g, "");
  if (digits.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(digits)) return false;

  const calc = (len: number) => {
    const sum = digits
      .slice(0, len)
      .split("")
      .reduce((acc, d, i) => acc + Number(d) * (len + 1 - i), 0);
    const rem = (sum * 10) % 11;
    return rem >= 10 ? 0 : rem;
  };

  return calc(9) === Number(digits[9]) && calc(10) === Number(digits[10]);
}

// ─── Schemas ───────────────────────────────────────────────────────────────

const loginSchema = z.object({
  email: z.string().email("Email invalido"),
  password: z.string().min(1, "Senha obrigatoria"),
});

const signupSchema = z
  .object({
    nomeCompleto: z.string().min(2, "Nome deve ter no mínimo 2 caracteres"),
    email: z.string().email("Email inválido"),
    telefone: z
      .string()
      .min(14, "Telefone inválido")
      .max(15, "Telefone inválido"),
    cpf: z.string().refine((v) => validateCpf(v), { message: "CPF inválido" }),
    cep: z.string().min(9, "CEP inválido").max(9, "CEP inválido"),
    password: z.string().min(8, "Mínimo 8 caracteres"),
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "As senhas não conferem",
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
  plan: string | null;
};

// ─── Component ─────────────────────────────────────────────────────────────

export function LoginClient({ branding, plan }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const defaultTab = plan ? "signup" : (searchParams.get("tab") ?? "login");

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    supabase.auth.getSession().then(({ data }) => {
      if (data.session?.user?.app_metadata?.tenantId) {
        router.replace("/agenda");
      }
    });
  }, [router]);

  return (
    <div className="flex min-h-screen">
      <LeftPanel branding={branding} plan={plan} />
      <RightPanel router={router} plan={plan} defaultTab={defaultTab} />
    </div>
  );
}

// ─── Left panel ────────────────────────────────────────────────────────────

const PLAN_LABEL: Record<string, string> = {
  FREE: "Trial gratuito",
  STARTER: "Plano Starter",
  PRO: "Plano Pro",
  ENTERPRISE: "Plano Enterprise",
};

function LeftPanel({
  branding,
  plan,
}: {
  branding: Branding;
  plan: string | null;
}) {
  const benefits = [
    { icon: "📅", text: "Agenda inteligente com detecção de conflitos" },
    { icon: "👥", text: "CRM de clientes com histórico completo" },
    { icon: "💰", text: "Financeiro conectado ao atendimento" },
  ];

  const isCustomBranding = branding.displayName !== "SaaS Estetica" && branding.displayName !== "Agendê";

  return (
    <div className="hidden md:flex md:w-[45%] flex-col relative overflow-hidden bg-gradient-to-br from-violet-50 to-pink-50 p-12">
      {/* Blobs decorativos */}
      <div className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full bg-violet-200/40 blur-3xl" />
      <div className="pointer-events-none absolute -left-16 bottom-0 h-64 w-64 rounded-full bg-pink-200/30 blur-3xl" />

      <div className="relative flex items-center gap-2">
        {isCustomBranding && branding.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={branding.logoUrl}
            alt={branding.displayName}
            className="h-8 w-auto"
          />
        ) : (
          <Image
            src="/brand/logo-horizontal.png"
            alt="Agendê"
            width={130}
            height={32}
            className="h-8 w-auto object-contain"
            priority
          />
        )}
      </div>

      <div className="relative my-auto space-y-8">
        <div>
          {plan && (
            <div className="mb-4 inline-block rounded-full border border-violet-200 bg-white/70 px-3 py-1 text-xs font-semibold text-violet-700">
              ✓ {PLAN_LABEL[plan] ?? plan} selecionado
            </div>
          )}
          <h1 className="text-3xl font-extrabold leading-tight tracking-tight text-slate-900">
            Seu salão no{" "}
            <span className="bg-gradient-to-r from-violet-600 to-pink-600 bg-clip-text text-transparent">
              piloto automático.
            </span>
          </h1>
          <p className="mt-3 text-base leading-relaxed text-slate-500">
            Agenda, CRM, financeiro e IA em uma plataforma só.
          </p>
        </div>

        <div className="space-y-3">
          {benefits.map((b) => (
            <div
              key={b.text}
              className="flex items-center gap-3 rounded-xl border border-violet-100 bg-white/80 px-4 py-3 shadow-sm backdrop-blur-sm"
            >
              <span className="text-base">{b.icon}</span>
              <span className="text-sm font-medium text-slate-700">{b.text}</span>
            </div>
          ))}
        </div>

        {/* Mini mockup decorativo */}
        <div className="rounded-xl border border-violet-100 bg-white/60 p-4 backdrop-blur-sm shadow-sm">
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: "hoje", value: "47", color: "text-violet-600" },
              { label: "faturado", value: "R$2.840", color: "text-pink-600" },
              { label: "faltas evitadas", value: "3", color: "text-emerald-600" },
            ].map(({ label, value, color }) => (
              <div key={label} className="rounded-lg border border-slate-100 bg-white p-2 text-center">
                <div className={`text-sm font-extrabold ${color}`}>{value}</div>
                <div className="text-[10px] text-slate-400">{label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Right panel ───────────────────────────────────────────────────────────

function RightPanel({
  router,
  plan,
  defaultTab,
}: {
  router: ReturnType<typeof useRouter>;
  plan: string | null;
  defaultTab: string;
}) {
  return (
    <div className="flex w-full flex-col items-center justify-center bg-white p-8 lg:w-[55%]">
      <div className="w-full max-w-sm space-y-6">
        <div className="md:hidden flex items-center gap-2">
          <Image
            src="/brand/logo-horizontal.png"
            alt="Agendê"
            width={130}
            height={32}
            className="h-8 w-auto object-contain"
            priority
          />
        </div>

        <Tabs defaultValue={defaultTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2 bg-slate-100">
            <TabsTrigger
              value="login"
              className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-violet-600 data-[state=active]:to-pink-600 data-[state=active]:text-white data-[state=active]:shadow-md"
            >
              Entrar
            </TabsTrigger>
            <TabsTrigger
              value="signup"
              className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-violet-600 data-[state=active]:to-pink-600 data-[state=active]:text-white data-[state=active]:shadow-md"
            >
              Criar conta
            </TabsTrigger>
          </TabsList>

          <TabsContent value="login" className="mt-6">
            <LoginForm router={router} />
          </TabsContent>

          <TabsContent value="signup" className="mt-6">
            <SignupFormComponent router={router} plan={plan} />
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

    router.push("/");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="login-email" className="text-foreground">
          Email
        </Label>
        <Input
          id="login-email"
          type="email"
          autoComplete="email"
          placeholder="voce@exemplo.com"
          className="border-border bg-background focus-visible:ring-primary"
          {...register("email")}
        />
        {errors.email && (
          <p className="text-xs text-red-500">{errors.email.message}</p>
        )}
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label htmlFor="login-password" className="text-foreground">
            Senha
          </Label>
          <a
            href="/forgot-password"
            className="text-xs text-violet-500 hover:text-violet-700"
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
            className="border-border bg-background pr-10 focus-visible:ring-primary"
            {...register("password")}
          />
          <button
            type="button"
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            onClick={() => setShowPassword((p) => !p)}
            aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
          >
            {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        </div>
        {errors.password && (
          <p className="text-xs text-red-500">{errors.password.message}</p>
        )}
      </div>

      <Button
        type="submit"
        className="w-full bg-gradient-to-r from-violet-600 to-pink-600 text-white shadow-md shadow-violet-200 hover:opacity-90 transition-opacity"
        disabled={isSubmitting}
      >
        {isSubmitting ? (
          <><Loader2 className="mr-2 size-4 animate-spin" />Entrando...</>
        ) : (
          "Entrar"
        )}
      </Button>
    </form>
  );
}

// ─── Signup form ───────────────────────────────────────────────────────────

type CepInfo = { localidade: string; uf: string } | null;

function SignupFormComponent({
  router,
  plan,
}: {
  router: ReturnType<typeof useRouter>;
  plan: string | null;
}) {
  const [showPassword, setShowPassword] = useState(false);
  const [telefone, setTelefone] = useState("");
  const [cpf, setCpf] = useState("");
  const [cep, setCep] = useState("");
  const [cepInfo, setCepInfo] = useState<CepInfo>(null);
  const [cepLoading, setCepLoading] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<SignupForm>({ resolver: zodResolver(signupSchema) });

  const passwordValue = watch("password", "");

  async function fetchCep(rawCep: string) {
    const digits = rawCep.replace(/\D/g, "");
    if (digits.length !== 8) { setCepInfo(null); return; }
    setCepLoading(true);
    try {
      const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
      const data = await res.json();
      if (data.erro) {
        setCepInfo(null);
        toast.error("CEP não encontrado.");
      } else {
        setCepInfo({ localidade: data.localidade, uf: data.uf });
      }
    } catch {
      setCepInfo(null);
    } finally {
      setCepLoading(false);
    }
  }

  async function onSubmit(data: SignupForm) {
    const res = await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: data.email,
        password: data.password,
        nomeCompleto: data.nomeCompleto,
        telefone: data.telefone,
        cpf: data.cpf,
        cep: data.cep,
      }),
    });

    if (!res.ok) {
      const body = await res.json();
      const msg = body.error ?? "";
      if (msg === "email_taken") {
        toast.error("Este email já possui uma conta. Faça login.");
      } else {
        toast.error(msg || "Erro ao criar conta.");
      }
      return;
    }

    const body = await res.json();

    if (body.requiresConfirmation) {
      toast.success("Verifique seu email para ativar sua conta.", { duration: 8000 });
      return;
    }

    const supabase = createSupabaseBrowserClient();
    const { data: signed, error: signInError } = await supabase.auth.signInWithPassword({
      email: data.email,
      password: data.password,
    });

    if (signInError || !signed.session) {
      toast.error("Erro ao iniciar sessão. Tente fazer login.");
      return;
    }

    router.push(plan ? `/onboarding?plan=${plan}` : "/onboarding");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {/* Nome completo */}
      <div className="space-y-1.5">
        <Label className="text-foreground">Nome completo</Label>
        <Input
          placeholder="Seu nome completo"
          className="border-border bg-background focus-visible:ring-primary"
          {...register("nomeCompleto")}
        />
        {errors.nomeCompleto && (
          <p className="text-xs text-red-500">{errors.nomeCompleto.message}</p>
        )}
      </div>

      {/* Email */}
      <div className="space-y-1.5">
        <Label className="text-foreground">Email</Label>
        <Input
          type="email"
          placeholder="voce@exemplo.com"
          className="border-border bg-background focus-visible:ring-primary"
          {...register("email")}
        />
        {errors.email && (
          <p className="text-xs text-red-500">{errors.email.message}</p>
        )}
      </div>

      {/* Telefone e CPF lado a lado */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-foreground">Telefone</Label>
          <Input
            placeholder="(00) 0 0000-0000"
            inputMode="numeric"
            className="border-border bg-background focus-visible:ring-primary"
            value={telefone}
            {...register("telefone")}
            onChange={(e) => {
              const masked = maskPhone(e.target.value);
              setTelefone(masked);
              setValue("telefone", masked, { shouldValidate: true });
            }}
          />
          {errors.telefone && (
            <p className="text-xs text-red-500">{errors.telefone.message}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label className="text-foreground">CPF</Label>
          <Input
            placeholder="000.000.000-00"
            inputMode="numeric"
            className="border-border bg-background focus-visible:ring-primary"
            value={cpf}
            {...register("cpf")}
            onChange={(e) => {
              const masked = maskCpf(e.target.value);
              setCpf(masked);
              setValue("cpf", masked, { shouldValidate: true });
            }}
          />
          {errors.cpf && (
            <p className="text-xs text-red-500">{errors.cpf.message}</p>
          )}
        </div>
      </div>

      {/* CEP */}
      <div className="space-y-1.5">
        <Label className="text-foreground">CEP</Label>
        <div className="relative">
          <Input
            placeholder="00000-000"
            inputMode="numeric"
            className="border-border bg-background pr-10 focus-visible:ring-primary"
            value={cep}
            {...register("cep")}
            onChange={(e) => {
              const masked = maskCep(e.target.value);
              setCep(masked);
              setValue("cep", masked, { shouldValidate: true });
              if (masked.replace(/\D/g, "").length === 8) fetchCep(masked);
              else setCepInfo(null);
            }}
          />
          <div className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
            {cepLoading
              ? <Loader2 className="size-4 animate-spin" />
              : <MapPin className="size-4" />}
          </div>
        </div>
        {cepInfo && (
          <p className="text-xs text-emerald-600">
            ✓ {cepInfo.localidade} — {cepInfo.uf}
          </p>
        )}
        {errors.cep && (
          <p className="text-xs text-red-500">{errors.cep.message}</p>
        )}
      </div>

      {/* Senha */}
      <div className="space-y-1.5">
        <Label className="text-foreground">Senha</Label>
        <div className="relative">
          <Input
            type={showPassword ? "text" : "password"}
            placeholder="Mínimo 8 caracteres"
            className="border-border bg-background pr-10 focus-visible:ring-primary"
            {...register("password")}
          />
          <button
            type="button"
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            onClick={() => setShowPassword((p) => !p)}
            aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
          >
            {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        </div>
        <PasswordStrength password={passwordValue} />
        {errors.password && (
          <p className="text-xs text-red-500">{errors.password.message}</p>
        )}
      </div>

      {/* Confirmar senha */}
      <div className="space-y-1.5">
        <Label className="text-foreground">Confirmar senha</Label>
        <Input
          type="password"
          placeholder="Repita a senha"
          className="border-border bg-background focus-visible:ring-primary"
          {...register("confirmPassword")}
        />
        {errors.confirmPassword && (
          <p className="text-xs text-red-500">{errors.confirmPassword.message}</p>
        )}
      </div>

      <Button
        type="submit"
        className="w-full bg-gradient-to-r from-violet-600 to-pink-600 text-white shadow-md shadow-violet-200 hover:opacity-90 transition-opacity"
        disabled={isSubmitting}
      >
        {isSubmitting ? (
          <><Loader2 className="mr-2 size-4 animate-spin" />Criando conta...</>
        ) : (
          "Criar conta"
        )}
      </Button>

      <p className="text-center text-xs text-muted-foreground">
        Ao criar uma conta, você concorda com nossos{" "}
        <a href="#" className="underline hover:text-foreground">Termos de Uso</a>{" "}
        e{" "}
        <a href="#" className="underline hover:text-foreground">Política de Privacidade</a>.
      </p>
    </form>
  );
}
