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
      router.push("/login");
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

    // Força refresh do JWT para que o middleware veja o tenantId recém-criado em app_metadata
    const { error: refreshError } = await supabase.auth.refreshSession();
    if (refreshError) {
      toast.error("Erro ao sincronizar sessao. Faca login novamente.");
      router.push("/login");
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
