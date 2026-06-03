import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { env } from "@/shared/config/env";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");

  if (!code) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const cookieStore = await cookies();

  const supabase = createServerClient(
    env.SUPABASE_URL,
    env.SUPABASE_ANON_KEY,
    {
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
    },
  );

  // Encerra sessão existente antes de trocar o código — garante que o
  // convidado receba sua própria sessão mesmo que outra conta esteja logada.
  await supabase.auth.signOut();

  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(new URL("/login?error=link_invalido", request.url));
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user?.app_metadata?.tenantId) {
    return NextResponse.redirect(new URL("/agenda", request.url));
  }

  return NextResponse.redirect(new URL("/onboarding", request.url));
}
