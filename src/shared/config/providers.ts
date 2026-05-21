import { createSupabaseServerClient } from "@/integrations/supabase/server";
import { supabaseAdmin } from "@/integrations/supabase/admin";

export const providers = {
  supabase: {
    server: createSupabaseServerClient,
    admin: supabaseAdmin,
  },
};
