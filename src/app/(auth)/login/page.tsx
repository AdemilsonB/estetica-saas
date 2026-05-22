import { Suspense } from "react";
import { LoginClient } from "./login-client";

type Props = {
  searchParams: Promise<{ tenant?: string }>;
};

export default async function LoginPage({ searchParams }: Props) {
  const params = await searchParams;
  const tenantSlug = params.tenant ?? null;

  let branding = {
    primaryColor: "#191919",
    logoUrl: null as string | null,
    displayName: "SaaS Estetica",
  };

  if (tenantSlug) {
    try {
      const baseUrl =
        process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
      const res = await fetch(
        `${baseUrl}/api/iam/tenant-branding?slug=${tenantSlug}`,
        { cache: "no-store" },
      );
      if (res.ok) branding = await res.json();
    } catch {
      // branding default
    }
  }

  return (
    <Suspense>
      <LoginClient branding={branding} />
    </Suspense>
  );
}
