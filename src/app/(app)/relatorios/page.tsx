import { FeatureLock } from '@/components/domain/billing/feature-lock'
import { VisaoGeralClient } from './visao-geral-client'

export default function RelatoriosPage() {
  return (
    <FeatureLock capability="report_visao_geral">
      <VisaoGeralClient />
    </FeatureLock>
  )
}
