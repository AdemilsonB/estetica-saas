import { UserRole } from "@prisma/client";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

import { getSupabaseSessionFromToken } from "@/integrations/supabase/auth";
import { env, isProduction } from "@/shared/config/env";
import { UnauthorizedError } from "@/shared/errors";
import type { SessionContext } from "@/shared/types/auth";

const permissionsHeaderName = "x-user-permissions";
const authorizationHeaderName = "authorization";
const devSessionHeaderName = "x-auth-mode";

export async function getSessionContext(
  request: Request,
): Promise<SessionContext> {
  // 1. Bearer token no header Authorization (clientes API, mobile, testes)
  const accessToken = extractAccessToken(request);
  if (accessToken) {
    return getSupabaseSessionFromToken(accessToken);
  }

  // 2. Modo desenvolvimento com headers explícitos
  if (!isProduction && request.headers.get(devSessionHeaderName) === "headers") {
    return getDevelopmentHeaderSession(request);
  }

  // 3. Cookie do @supabase/ssr (browser via createBrowserClient)
  // O cookie real é sb-{project-ref}-auth-token, não sb-access-token
  const cookieStore = await cookies();
  const supabase = createServerClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
    cookies: {
      getAll() { return cookieStore.getAll(); },
      setAll() {},
    },
  });
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.access_token) {
    return getSupabaseSessionFromToken(session.access_token);
  }

  throw new UnauthorizedError(
    "Sessao ausente. Envie Bearer token do Supabase ou use o modo de desenvolvimento explicitamente.",
  );
}

async function getDevelopmentHeaderSession(
  request: Request,
): Promise<SessionContext> {
  const tenantId = request.headers.get("x-tenant-id");
  const userId = request.headers.get("x-user-id");
  const roleValue = request.headers.get("x-user-role");
  const permissionsValue = request.headers.get(permissionsHeaderName);

  if (!tenantId || !userId || !roleValue) {
    throw new UnauthorizedError("Cabecalhos de autenticacao ausentes.");
  }

  if (!Object.values(UserRole).includes(roleValue as UserRole)) {
    throw new UnauthorizedError("Role invalida.");
  }

  return {
    tenantId,
    userId,
    role: roleValue as UserRole,
    permissions: permissionsValue
      ? permissionsValue
          .split(",")
          .map((permission) => permission.trim())
          .filter(Boolean)
      : [],
  };
}

export async function withTenant(request: Request) {
  const session = await getSessionContext(request);
  return session.tenantId;
}

function extractAccessToken(request: Request) {
  const authorizationHeader = request.headers.get(authorizationHeaderName);
  if (authorizationHeader?.startsWith("Bearer ")) {
    return authorizationHeader.slice("Bearer ".length).trim();
  }

  const cookieHeader = request.headers.get("cookie");
  if (!cookieHeader) {
    return null;
  }

  const cookieMap = new Map(
    cookieHeader.split(";").map((cookie) => {
      const [name, ...rest] = cookie.trim().split("=");
      return [name, rest.join("=")];
    }),
  );

  const cookieToken =
    cookieMap.get("sb-access-token") ??
    cookieMap.get(`${new URL(env.SUPABASE_URL).hostname}-access-token`);

  return cookieToken ? decodeURIComponent(cookieToken) : null;
}
