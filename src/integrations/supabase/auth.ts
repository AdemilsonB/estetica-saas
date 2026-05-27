import { UserRole } from "@prisma/client";

import { createSupabaseServerClient } from "./server";
import { UnauthorizedError } from "@/shared/errors";
import type { SessionContext } from "@/shared/types/auth";

type SupabaseJwtClaims = {
  sub?: string;
  email?: string;
  role?: string;
  app_metadata?: {
    tenantId?: string;
    role?: UserRole;
    permissions?: string[];
  };
  user_metadata?: {
    tenantId?: string;
    role?: UserRole;
    permissions?: string[];
  };
};

// Valida o token JWT e retorna apenas o userId — usado em rotas que precedem
// a criação do tenant (ex: /api/iam/register), onde tenantId ainda não existe.
export async function getVerifiedUserId(accessToken: string): Promise<string> {
  const supabase = createSupabaseServerClient(accessToken);
  const { data, error } = await supabase.auth.getUser(accessToken);
  if (error || !data.user) {
    throw new UnauthorizedError("Sessao invalida ou expirada.");
  }
  return data.user.id;
}

export async function getSupabaseSessionFromToken(
  accessToken: string,
): Promise<SessionContext> {
  const supabase = createSupabaseServerClient(accessToken);
  const { data, error } = await supabase.auth.getUser(accessToken);
  const user = data.user;

  if (error || !user) {
    throw new UnauthorizedError("Sessao invalida ou expirada.");
  }

  const claims = {
    app_metadata: user.app_metadata,
    user_metadata: user.user_metadata,
  } as SupabaseJwtClaims;
  const tenantId =
    claims.app_metadata?.tenantId ?? claims.user_metadata?.tenantId;
  const role = claims.app_metadata?.role ?? claims.user_metadata?.role;
  const permissions =
    claims.app_metadata?.permissions ?? claims.user_metadata?.permissions ?? [];

  if (!tenantId) {
    throw new UnauthorizedError("Tenant ausente na sessao autenticada.");
  }

  if (!role || !Object.values(UserRole).includes(role)) {
    throw new UnauthorizedError("Role ausente ou invalida na sessao autenticada.");
  }

  return {
    tenantId,
    userId: user.id,
    role,
    permissions,
  };
}
