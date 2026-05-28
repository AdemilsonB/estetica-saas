import { prisma } from "@/shared/database/prisma";

const DEFAULT_BRANDING = {
  primaryColor: "#191919",
  logoUrl: null,
  displayName: "SaaS Estetica",
};

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const slug = searchParams.get("slug");

  if (!slug) return Response.json(DEFAULT_BRANDING);

  const tenant = await prisma.tenant.findUnique({
    where: { slug },
    select: {
      name: true,
      brandingConfig: {
        select: { primaryColor: true, logoUrl: true },
      },
    },
  });

  if (!tenant) return Response.json(DEFAULT_BRANDING);

  return Response.json({
    primaryColor: tenant.brandingConfig?.primaryColor ?? DEFAULT_BRANDING.primaryColor,
    logoUrl: tenant.brandingConfig?.logoUrl ?? null,
    displayName: tenant.name,
  });
}
