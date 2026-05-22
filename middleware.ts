import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Rotas de auth acessíveis sem sessão
const AUTH_ROUTES = ["/login", "/forgot-password"];
// Rotas de auth que precisam de token válido no URL (não redirecionam usuário autenticado)
const TOKEN_ROUTES = ["/reset-password", "/callback"];

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  const isAuthRoute = AUTH_ROUTES.includes(pathname);
  const isTokenRoute = TOKEN_ROUTES.includes(pathname);
  const isOnboarding = pathname === "/onboarding";

  // Usuário autenticado com tenant acessando rota de login → app
  if (user?.app_metadata?.tenantId && (isAuthRoute || isOnboarding)) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  // Usuário autenticado sem tenant, fora do onboarding e fora de rotas de token → onboarding
  if (user && !user.app_metadata?.tenantId && !isOnboarding && !isTokenRoute) {
    return NextResponse.redirect(new URL("/onboarding", request.url));
  }

  // Usuário não autenticado tentando acessar rota protegida → login
  if (!user && !isAuthRoute && !isTokenRoute) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|api/).*)",
  ],
};
