-- ============================================================================
-- Onda 0 — Alinhamento da oferta: aplicação CIRÚRGICA em produção
-- ----------------------------------------------------------------------------
-- Fecha o que o merge da PR #283 NÃO conserta sozinho: os `highlights` da
-- vitrine /planos vêm do texto livre `Plan.description` no banco, e a Vercel não
-- roda seed no deploy. Sem este UPDATE, produção continua exibindo
-- "WhatsApp premium (chatbot, aniversário)" e "Até 3 unidades".
--
-- NÃO rodar o seed inteiro (scripts/seed-admin-data.ts) — ele sobrescreve PREÇOS
-- e TODOS os feature flags (mesmo risco da #255). Este script mexe SÓ no que a
-- Onda 0 exige: 2 descrições + 2 flags (+ limpeza opcional de multi_unit).
--
-- COMO USAR:
--   1) Rode o BLOCO 1 (SELECT) e confira o estado atual.
--   2) Rode o BLOCO 2 dentro da transação; confira o SELECT de verificação.
--   3) Se estiver certo, COMMIT. Se algo estranho, ROLLBACK.
-- ============================================================================


-- ────────────────────────────────────────────────────────────────────────────
-- BLOCO 1 — LEITURA (rode primeiro, não altera nada)
-- ────────────────────────────────────────────────────────────────────────────

-- 1a. Descrições atuais dos planos vendidos
SELECT name, "displayName", description
FROM "Plan"
WHERE "isActive" = true
ORDER BY "displayOrder";

-- 1b. Flags das capacidades que a Onda 0 desliga/remova
SELECT plan, "sectionKey", enabled
FROM "PlanFeatureConfig"
WHERE "sectionKey" IN ('campaigns', 'whatsapp_premium', 'multi_unit')
ORDER BY "sectionKey", plan;


-- ────────────────────────────────────────────────────────────────────────────
-- BLOCO 2 — ESCRITA (transacional — confira antes do COMMIT)
-- ────────────────────────────────────────────────────────────────────────────
BEGIN;

-- 2a. Descrição do PRO: remove "WhatsApp premium (chatbot, aniversário)" e
--     "Até 3 unidades". Fica só o que existe de verdade.
UPDATE "Plan"
SET description = E'Até 20 profissionais\nAté 2.000 agendamentos/mês\nRelatórios avançados\nTudo do Starter'
WHERE name = 'PRO';

-- 2b. Descrição do ENTERPRISE: remove "Unidades ilimitadas".
UPDATE "Plan"
SET description = E'Profissionais ilimitados\nAgendamentos ilimitados\nWhatsApp ilimitado\nSuporte prioritário\nTudo do Pro'
WHERE name = 'ENTERPRISE';

-- 2c. Capacidades 'soon' (roadmap Onda 3) não são vendidas: desliga em todo plano.
--     (O guard de sanidade do admin para de acusar "soon vendável".)
UPDATE "PlanFeatureConfig"
SET enabled = false
WHERE "sectionKey" IN ('campaigns', 'whatsapp_premium');

-- 2d. OPCIONAL — limpeza do placeholder morto multi_unit (sem model Unit, sem
--     consumidor runtime). Remove as linhas órfãs. Se preferir conservador,
--     comente esta linha: as linhas são inertes (não aparecem em lugar nenhum).
DELETE FROM "PlanFeatureConfig"
WHERE "sectionKey" = 'multi_unit';

-- 2e. Verificação pós-escrita (ainda dentro da transação)
SELECT name, "displayName", description FROM "Plan" WHERE "isActive" = true ORDER BY "displayOrder";
SELECT plan, "sectionKey", enabled FROM "PlanFeatureConfig"
WHERE "sectionKey" IN ('campaigns', 'whatsapp_premium', 'multi_unit') ORDER BY "sectionKey", plan;

-- Se o resultado acima estiver correto:
COMMIT;
-- Se algo estiver errado, em vez do COMMIT rode:
-- ROLLBACK;
