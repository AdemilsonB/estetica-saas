import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/admin";
import { validateInput } from "@/shared/http/validate-input";

const Schema = z.object({ userId: z.string().uuid() });

// Endpoint exclusivo para desenvolvimento — confirma email sem aguardar link
export async function POST(req: Request) {
  if (process.env.NODE_ENV !== "development") {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const input = await validateInput(req, Schema);
  const { error } = await supabaseAdmin.auth.admin.updateUserById(input.userId, {
    email_confirm: true,
  });

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ ok: true });
}
