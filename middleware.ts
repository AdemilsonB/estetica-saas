import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const AUTH_ROUTES = ["/login", "/forgot-password"];
const TOKEN_ROUTES = ["/reset-password", "/callback"];

// Rotas públicas com prefixo explícito — sem autenticação Supabase
const PUBLIC_PREFIXES = [
  "/agendar/",
  "/planos",
  "/avaliar/",
  "/anamnese/",
  // API — intencionalmente públicas ou com mecanismo de auth próprio (não Supabase cookie):
  "/api/public/", // booking público, anamnese, portal do cliente
  "/api/webhooks/", // Stripe/Evolution/Twilio — cada um valida sua própria assinatura/token
  "/api/admin/", // backoffice — Bearer ADMIN_API_SECRET via getAdminContext, não cookie
  "/api/cron/", // cron externo (GitHub Actions) — Bearer CRON_SECRET próprio, não cookie
  "/api/auth/signup", // criação de conta — precede qualquer sessão
  "/api/dev/", // utilitários de desenvolvimento, gated por NODE_ENV no próprio handler
  "/api/billing/plans", // lista de planos públicos (vitrine/landing)
  "/api/billing/stripe/webhook", // assinatura Stripe própria
  "/api/iam/tenant-branding", // branding por slug, consumido por páginas públicas
];

// Defesa em profundidade: nenhuma outra rota /api/* deve passar sem sessão Supabase —
// cada route.ts continua responsável pelo getSessionContext + escopo de tenantId; este
// gate só impede que uma rota nova esqueça de chamá-lo e fique 100% exposta.
function hasDevHeaderSession(request: NextRequest): boolean {
  return (
    process.env.NODE_ENV !== "production" &&
    request.headers.get("x-auth-mode") === "headers" &&
    Boolean(request.headers.get("x-tenant-id")) &&
    Boolean(request.headers.get("x-user-id")) &&
    Boolean(request.headers.get("x-user-role"))
  );
}

async function requireApiSession(request: NextRequest): Promise<NextResponse> {
  if (hasDevHeaderSession(request)) {
    return NextResponse.next({ request });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Sem env vars não há como validar — mesma postura de fallback do restante do middleware
  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.next({ request });
  }

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll() {},
    },
  });

  try {
    const { data } = await supabase.auth.getUser();
    if (!data.user) {
      return unauthorizedApiResponse();
    }
  } catch {
    return unauthorizedApiResponse();
  }

  return NextResponse.next({ request });
}

function unauthorizedApiResponse(): NextResponse {
  return NextResponse.json(
    { error: { code: "UNAUTHORIZED", message: "Sessão ausente." } },
    { status: 401 },
  );
}

// Rotas app que requerem autenticação Supabase (tenant operador)
const PROTECTED_APP_PREFIXES = [
  "/agenda",
  "/dashboard",
  "/clientes",
  "/configuracoes",
  "/equipe",
  "/financeiro",
  "/produtos",
  "/relatorios",
  "/servicos",
];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Rotas públicas com prefixo — passam direto
  if (PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    return NextResponse.next({ request });
  }

  // Qualquer outra rota /api/* exige sessão Supabase — defesa em profundidade
  if (pathname.startsWith("/api/")) {
    return requireApiSession(request);
  }

  const isAuthRoute = AUTH_ROUTES.includes(pathname);
  const isTokenRoute = TOKEN_ROUTES.includes(pathname);
  const isOnboarding = pathname === "/onboarding" || pathname.startsWith("/onboarding/");
  const isAdminRoute = pathname.startsWith("/admin");
  const isProtectedApp = PROTECTED_APP_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(p + "/"),
  );

  // Vitrine pública do tenant — /{slug}, /{slug}/entrar, /{slug}/cliente
  // Qualquer rota que não é app protegida, auth, admin ou raiz é vitrine pública
  const isVitrineRoute =
    !isAuthRoute &&
    !isTokenRoute &&
    !isOnboarding &&
    !isAdminRoute &&
    !isProtectedApp &&
    pathname !== "/";

  if (isVitrineRoute) {
    return NextResponse.next({ request });
  }

  // A partir daqui: rotas que passam pelo fluxo de autenticação Supabase

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Se env vars ausentes, deixa passar sem travar
  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.next({ request });
  }

  // x-pathname precisa ir nos headers da REQUEST para que Server Components
  // leiam via headers() tanto em SSR quanto em RSC (navegação client-side)
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-pathname", pathname);

  let supabaseResponse = NextResponse.next({ request: { headers: requestHeaders } });

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value),
        );
        supabaseResponse = NextResponse.next({ request: { headers: requestHeaders } });
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

  // Landing page — redireciona usuários autenticados para o destino correto
  if (pathname === "/") {
    if (user?.app_metadata?.isSystemAdmin) {
      return NextResponse.redirect(new URL("/admin", request.url));
    }
    if (user?.app_metadata?.tenantId) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
    if (user) {
      return NextResponse.redirect(new URL("/onboarding", request.url));
    }
    return supabaseResponse;
  }

  // Proteção de rotas admin
  if (isAdminRoute) {
    if (!user) {
      return NextResponse.redirect(new URL("/login", request.url));
    }
    if (!user.app_metadata?.isSystemAdmin) {
      return NextResponse.redirect(new URL("/agenda", request.url));
    }
    return supabaseResponse;
  }

  // Admin do sistema é uma conta isolada — nunca passa pelo fluxo de tenant/onboarding
  if (user?.app_metadata?.isSystemAdmin) {
    return NextResponse.redirect(new URL("/admin", request.url));
  }

  if (user?.app_metadata?.tenantId && isAuthRoute) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
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
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|sw\\.js|manifest\\.json|icons/).*)",
  ],
};
