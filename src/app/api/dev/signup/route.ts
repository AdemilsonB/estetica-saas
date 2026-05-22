import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/admin";
import { validateInput } from "@/shared/http/validate-input";

const Schema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

// Cria usuário sem disparar email de confirmação — exclusivo para NODE_ENV=development
export async function POST(req: Request) {
  if (process.env.NODE_ENV !== "development") {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const input = await validateInput(req, Schema);

  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email: input.email,
    password: input.password,
    email_confirm: true,
  });

  if (error) {
    return Response.json({ error: error.message }, { status: 400 });
  }

  return Response.json({ userId: data.user.id });
}
