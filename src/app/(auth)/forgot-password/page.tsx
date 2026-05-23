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
    const redirectTo = `${window.location.origin}/reset-password`;

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
            {cooldown > 0 ? `Reenviar em ${cooldown}s` : "Reenviar email"}
          </Button>
          <a
            href="/login"
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
          href="/login"
          className="block text-center text-sm text-[#787774] hover:text-[#191919]"
        >
          ← Voltar para o login
        </a>
      </div>
    </div>
  );
}
