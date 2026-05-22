import { iamRepository } from "@/domains/iam/iam.repository";

const DEFAULT_BRANDING = {
  primaryColor: "#191919",
  logoUrl: null,
  displayName: "SaaS Estetica",
};

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const slug = searchParams.get("slug");

  if (!slug) {
    return Response.json(DEFAULT_BRANDING);
  }

  const tenant = await iamRepository.findTenantBySlug(slug);

  if (!tenant) {
    return Response.json(DEFAULT_BRANDING);
  }

  const branding =
    typeof tenant.brandingConfig === "object" && tenant.brandingConfig !== null
      ? (tenant.brandingConfig as {
          primaryColor?: string;
          logoUrl?: string | null;
          displayName?: string;
        })
      : {};

  return Response.json({
    primaryColor: branding.primaryColor ?? DEFAULT_BRANDING.primaryColor,
    logoUrl: branding.logoUrl ?? null,
    displayName: branding.displayName ?? tenant.name,
  });
}
