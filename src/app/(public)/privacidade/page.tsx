import type { Metadata } from 'next'
import Link from 'next/link'
import { LegalShell } from '@/components/domain/landing/legal-shell'

export const metadata: Metadata = {
  title: 'Política de Privacidade — Agendê',
  description: 'Como o Agendê coleta, usa e protege dados pessoais, em conformidade com a LGPD.',
}

export default function PrivacidadePage() {
  return (
    <LegalShell title="Política de Privacidade" updatedAt="24 de julho de 2026">
      <section>
        <p>
          Esta Política de Privacidade descreve como a plataforma <strong>Agendê</strong> trata dados
          pessoais, em conformidade com a Lei Geral de Proteção de Dados — LGPD (Lei nº 13.709/2018).
          Ela se aplica ao site, ao painel de gestão, à página pública dos negócios (vitrine) e ao
          portal do cliente.
        </p>
      </section>

      <section>
        <h2>1. Papéis no tratamento de dados</h2>
        <ul className="mt-2">
          <li>
            <strong>Dados de conta dos assinantes</strong> (donos e equipe dos negócios que assinam a
            Plataforma): o Agendê atua como <strong>controlador</strong> — decide como e por que esses
            dados são tratados.
          </li>
          <li>
            <strong>Dados dos clientes finais dos negócios</strong> (pessoas que agendam serviços):
            o negócio assinante é o <strong>controlador</strong> desses dados; o Agendê atua como{' '}
            <strong>operador</strong>, tratando-os exclusivamente conforme a finalidade da Plataforma
            (agendamento, histórico, comunicação do próprio negócio).
          </li>
        </ul>
      </section>

      <section>
        <h2>2. Dados que coletamos</h2>
        <ul className="mt-2">
          <li><strong>Conta do assinante:</strong> nome, e-mail, CPF/CNPJ, telefone, CEP, dados do negócio (nome, endereço, catálogo, fotos) e credenciais de acesso (senha armazenada de forma criptografada pelo provedor de autenticação).</li>
          <li><strong>Clientes finais (em nome do negócio):</strong> nome, CPF, telefone, e-mail, histórico de agendamentos e atendimentos, avaliações e, quando o negócio utiliza fichas de anamnese, as respostas registradas nelas.</li>
          <li><strong>Pagamentos da assinatura:</strong> processados pela Stripe; o Agendê não armazena números completos de cartão.</li>
          <li><strong>Dados técnicos:</strong> registros de acesso (data, hora, IP) exigidos pelo Marco Civil da Internet e cookies estritamente necessários à sessão autenticada.</li>
        </ul>
      </section>

      <section>
        <h2>3. Finalidades e bases legais</h2>
        <ul className="mt-2">
          <li><strong>Prestar o serviço contratado</strong> (agenda, cadastro, financeiro, notificações) — execução de contrato;</li>
          <li><strong>Faturamento e emissão de cobranças</strong> — execução de contrato e obrigação legal;</li>
          <li><strong>Segurança, prevenção a fraudes e registros de acesso</strong> — obrigação legal e legítimo interesse;</li>
          <li><strong>Comunicações operacionais</strong> (avisos de agendamento, lembretes, notificações da equipe) — execução de contrato;</li>
          <li><strong>Melhoria do produto</strong> com dados de uso agregados — legítimo interesse.</li>
        </ul>
        <p className="mt-2">Não vendemos dados pessoais a terceiros.</p>
      </section>

      <section>
        <h2>4. Dados sensíveis (fichas de anamnese)</h2>
        <p className="mt-2">
          Fichas de anamnese podem conter dados relacionados à saúde, classificados como dados pessoais
          sensíveis pela LGPD. Esses dados são coletados pelo negócio assinante, sob responsabilidade
          dele (controlador), com o consentimento do cliente final. O Agendê os armazena de forma
          segregada por negócio e não os utiliza para nenhuma outra finalidade — inclusive não os usa
          para treinar modelos ou para publicidade.
        </p>
      </section>

      <section>
        <h2>5. Compartilhamento com suboperadores</h2>
        <p className="mt-2">
          Para operar, a Plataforma utiliza provedores de infraestrutura e serviço que tratam dados em
          nosso nome, sob contrato e apenas na medida necessária:
        </p>
        <ul className="mt-2">
          <li><strong>Supabase</strong> — hospedagem do banco de dados e autenticação;</li>
          <li><strong>Vercel</strong> — hospedagem da aplicação;</li>
          <li><strong>Stripe</strong> — processamento de pagamentos da assinatura;</li>
          <li><strong>Resend</strong> — envio de e-mails transacionais;</li>
          <li><strong>Provedor de WhatsApp</strong> — envio de mensagens de agendamento quando habilitado pelo negócio.</li>
        </ul>
        <p className="mt-2">
          Alguns desses provedores podem armazenar dados fora do Brasil; nesses casos, a transferência
          internacional observa os mecanismos previstos na LGPD. Dados também podem ser compartilhados
          por obrigação legal ou ordem de autoridade competente.
        </p>
      </section>

      <section>
        <h2>6. Segurança</h2>
        <p className="mt-2">
          Adotamos medidas técnicas e organizacionais para proteger os dados: isolamento de dados por
          negócio (multi-tenancy), controle de acesso por cargos e permissões, criptografia em trânsito
          (HTTPS), senhas armazenadas com criptografia e registro de atividades administrativas. Nenhum
          sistema é infalível; incidentes de segurança relevantes serão comunicados aos afetados e à
          ANPD conforme a LGPD.
        </p>
      </section>

      <section>
        <h2>7. Retenção e exclusão</h2>
        <ul className="mt-2">
          <li>Dados de conta são mantidos enquanto a conta existir e, após o encerramento, pelo prazo necessário ao cumprimento de obrigações legais (ex.: fiscais e registros de acesso), sendo então excluídos ou anonimizados.</li>
          <li>Dados de clientes finais são mantidos enquanto o negócio controlador determinar, dentro da Plataforma; a exclusão pode ser solicitada ao próprio negócio ou, quando cabível, ao Agendê.</li>
          <li>O encerramento da assinatura, por si só, não exclui os dados — eles ficam preservados para eventual reativação ou exportação, até a solicitação de exclusão definitiva.</li>
        </ul>
      </section>

      <section>
        <h2>8. Direitos do titular</h2>
        <p className="mt-2">Nos termos do art. 18 da LGPD, você pode solicitar:</p>
        <ul className="mt-2">
          <li>Confirmação da existência de tratamento e acesso aos seus dados;</li>
          <li>Correção de dados incompletos, inexatos ou desatualizados;</li>
          <li>Anonimização, bloqueio ou eliminação de dados desnecessários ou tratados em desconformidade;</li>
          <li>Portabilidade e informação sobre compartilhamentos;</li>
          <li>Revogação de consentimento, quando o tratamento se basear nele.</li>
        </ul>
        <p className="mt-2">
          Clientes finais de um negócio devem direcionar solicitações primeiro ao próprio negócio
          (controlador dos seus dados); o Agendê apoiará o atendimento na qualidade de operador.
        </p>
      </section>

      <section>
        <h2>9. Cookies</h2>
        <p className="mt-2">
          Utilizamos apenas cookies e armazenamento local estritamente necessários ao funcionamento da
          Plataforma (sessão autenticada, preferências de interface). Não utilizamos cookies de
          publicidade de terceiros.
        </p>
      </section>

      <section>
        <h2>10. Contato e encarregado</h2>
        <p className="mt-2">
          Para exercer seus direitos ou tirar dúvidas sobre esta Política, utilize o canal de
          atendimento oficial (WhatsApp) divulgado no rodapé do site. As solicitações são respondidas
          nos prazos previstos na LGPD.
        </p>
      </section>

      <section>
        <h2>11. Alterações desta política</h2>
        <p className="mt-2">
          Esta Política pode ser atualizada para refletir mudanças na Plataforma ou na legislação. A
          versão vigente estará sempre publicada nesta página, com a data de atualização no topo.
          Consulte também os <Link href="/termos" className="underline">Termos de Uso</Link>.
        </p>
      </section>
    </LegalShell>
  )
}
