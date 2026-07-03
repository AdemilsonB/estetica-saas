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
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const urlError = params.get('error');

    if (urlError) {
      // Supabase redirecionou com ?error= — token expirado ou inválido
      setSessionValid(false);
      return;
    }

    if (code) {
      // PKCE flow: troca o code pelo token de sessão antes de chamar getUser
      supabase.auth.exchangeCodeForSession(code).then(({ data, error }) => {
        if (error || !data.session) {
          setSessionValid(false);
          return;
        }
        setSessionValid(true);
        setUserEmail(data.session.user.email ?? null);
      });
    } else {
      // Fluxo implícito: tokens já estão no hash, getUser é suficiente
      supabase.auth.getUser().then(({ data, error }) => {
        if (error || !data.user) {
          setSessionValid(false);
          return;
        }
        setSessionValid(true);
        setUserEmail(data.user.email ?? null);
      });
    }
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
            onClick={() => router.push("/forgot-password")}
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
            onClick={() => router.push("/login")}
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
