import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const AUTH_ROUTES = ["/login", "/forgot-password"];
const TOKEN_ROUTES = ["/reset-password", "/callback"];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isAuthRoute = AUTH_ROUTES.includes(pathname);
  const isTokenRoute = TOKEN_ROUTES.includes(pathname);
  const isOnboarding = pathname === "/onboarding";

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Se env vars ausentes (ex: deploy sem configuração), deixa passar sem travar
  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.next({ request });
  }

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
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
  });

  let user = null;
  try {
    const { data } = await supabase.auth.getUser();
    user = data.user;
  } catch {
    // Falha ao contactar Supabase — redireciona para login como fallback seguro
    if (!isAuthRoute && !isTokenRoute) {
      return NextResponse.redirect(new URL("/login", request.url));
    }
    return supabaseResponse;
  }

  if (user?.app_metadata?.tenantId && (isAuthRoute || isOnboarding)) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  if (user && !user.app_metadata?.tenantId && !isOnboarding && !isTokenRoute) {
    return NextResponse.redirect(new URL("/onboarding", request.url));
  }

  if (!user && !isAuthRoute && !isTokenRoute) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return supabaseResponse;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/).*)" ],
};
