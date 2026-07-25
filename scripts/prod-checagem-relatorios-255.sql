-- ============================================================================
-- #255 — Checagem + auto-cura dos gates de relatório em produção
-- ----------------------------------------------------------------------------
-- Se o seed de PlanFeatureConfig nunca rodou em produção, os 4 relatórios ficam
-- BLOQUEADOS para todos os tenants (o gate report_* nega por ausência de linha).
-- Este script é SEGURO de rodar inteiro no Supabase SQL Editor: o INSERT usa
-- ON CONFLICT DO NOTHING — só cria as linhas que faltam, NUNCA sobrescreve as
-- existentes. Não toca em preços nem em outros flags (≠ do seed inteiro).
-- ============================================================================

-- BLOCO 1 — LEITURA (antes). Esperado ideal: 16 linhas (4 planos × 4 report_*),
-- todas enabled = true. Se vier vazio/incompleto, o BLOCO 2 completa.
SELECT plan, "sectionKey", enabled
FROM "PlanFeatureConfig"
WHERE "sectionKey" LIKE 'report_%'
ORDER BY plan, "sectionKey";

-- BLOCO 2 — AUTO-CURA (idempotente). Cria só o que falta, habilitado.
INSERT INTO "PlanFeatureConfig" (id, plan, "sectionKey", enabled, "updatedAt")
SELECT gen_random_uuid()::text, p.plan::"PlanName", k.key, true, now()
FROM (VALUES ('FREE'), ('STARTER'), ('PRO'), ('ENTERPRISE')) AS p(plan)
CROSS JOIN (VALUES
  ('report_visao_geral'),
  ('report_financeiro'),
  ('report_agendamentos'),
  ('report_clientes')
) AS k(key)
ON CONFLICT (plan, "sectionKey") DO NOTHING;

-- BLOCO 3 — LEITURA (depois). Agora devem ser 16 linhas, todas enabled = true.
SELECT plan, "sectionKey", enabled
FROM "PlanFeatureConfig"
WHERE "sectionKey" LIKE 'report_%'
ORDER BY plan, "sectionKey";
