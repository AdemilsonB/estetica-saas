import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/admin";
import { validateInput } from "@/shared/http/validate-input";

const Schema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export async function POST(req: Request) {
  const input = await validateInput(req, Schema);

  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email: input.email,
    password: input.password,
    email_confirm: true,
  });

  if (!error) {
    return Response.json({ userId: data.user.id });
  }

  const alreadyExists =
    error.message.toLowerCase().includes("already been registered") ||
    error.message.toLowerCase().includes("already exists") ||
    error.message.toLowerCase().includes("already registered");

  if (!alreadyExists) {
    return Response.json({ error: error.message }, { status: 400 });
  }

  // Usuário existe mas pode estar não-confirmado — busca e confirma para desbloquear login
  const { data: listData } = await supabaseAdmin.auth.admin.listUsers();
  const existing = listData?.users?.find(
    (u) => u.email?.toLowerCase() === input.email.toLowerCase(),
  );

  if (!existing) {
    return Response.json({ error: "email_taken" }, { status: 400 });
  }

  if (existing.email_confirmed_at) {
    // Já confirmado: conta ativa, orientar a fazer login
    return Response.json({ error: "email_taken" }, { status: 400 });
  }

  // Não-confirmado: confirma e atualiza a senha para a nova tentativa
  const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
    existing.id,
    { email_confirm: true, password: input.password },
  );

  if (updateError) {
    return Response.json({ error: updateError.message }, { status: 400 });
  }

  return Response.json({ userId: existing.id });
}
