import type { Metadata } from 'next'
import Link from 'next/link'
import { LegalShell } from '@/components/domain/landing/legal-shell'

export const metadata: Metadata = {
  title: 'Termos de Uso — Agendê',
  description: 'Termos e condições de uso da plataforma Agendê.',
}

export default function TermosPage() {
  return (
    <LegalShell title="Termos de Uso" updatedAt="24 de julho de 2026">
      <section>
        <h2>1. Aceitação dos termos</h2>
        <p className="mt-2">
          Estes Termos de Uso regulam o acesso e a utilização da plataforma <strong>Agendê</strong>
          {' '}(&quot;Plataforma&quot;), um software de gestão para negócios de estética e bem-estar —
          salões, barbearias, clínicas e estúdios. Ao criar uma conta ou utilizar a Plataforma, você
          declara ter lido, compreendido e aceitado integralmente estes Termos e a nossa{' '}
          <Link href="/privacidade" className="underline">Política de Privacidade</Link>. Se você não
          concorda com qualquer condição aqui prevista, não utilize a Plataforma.
        </p>
      </section>

      <section>
        <h2>2. O serviço</h2>
        <p className="mt-2">
          O Agendê oferece, na modalidade de assinatura (SaaS), funcionalidades de gestão operacional,
          incluindo: agenda e agendamento online, cadastro de clientes, catálogo de serviços, controle
          financeiro, comissões, estoque, notificações e uma página pública (vitrine) por meio da qual
          clientes finais podem agendar horários diretamente com o negócio assinante.
        </p>
        <p className="mt-2">
          A Plataforma é uma ferramenta de gestão. A prestação dos serviços de estética divulgados e
          agendados por meio dela é de responsabilidade exclusiva do negócio assinante — o Agendê não é
          parte da relação entre o negócio e seus clientes finais.
        </p>
      </section>

      <section>
        <h2>3. Cadastro e conta</h2>
        <ul className="mt-2">
          <li>Para usar a Plataforma é necessário criar uma conta com dados verdadeiros, completos e atualizados, incluindo documento válido (CPF ou CNPJ).</li>
          <li>Você é responsável por manter a confidencialidade das suas credenciais de acesso e por toda atividade realizada na sua conta.</li>
          <li>Cada negócio (tenant) controla os acessos da própria equipe por meio de cargos e permissões configurados pelo titular da conta.</li>
          <li>Contas criadas com dados falsos ou utilizadas para fins ilícitos poderão ser suspensas ou encerradas.</li>
        </ul>
      </section>

      <section>
        <h2>4. Planos, pagamento e período de teste</h2>
        <ul className="mt-2">
          <li>Os planos, preços e limites vigentes estão descritos em <Link href="/planos" className="underline">agende — planos</Link> e podem ser atualizados; alterações de preço não se aplicam retroativamente ao ciclo já pago.</li>
          <li>O período de teste (trial) é gratuito e não exige cartão de crédito. Ao final do trial sem assinatura ativa, o acesso ao painel fica suspenso — nenhum dado é excluído por causa disso.</li>
          <li>Os pagamentos são processados por parceiro de pagamentos (Stripe). O Agendê não armazena dados completos de cartão.</li>
          <li>Você pode cancelar a assinatura a qualquer momento pelo painel, sem multa; o acesso permanece até o fim do ciclo vigente.</li>
          <li>Em caso de inadimplência, o acesso ao painel poderá ser suspenso até a regularização.</li>
        </ul>
      </section>

      <section>
        <h2>5. Responsabilidades do assinante</h2>
        <p className="mt-2">Ao usar a Plataforma, o negócio assinante se compromete a:</p>
        <ul className="mt-2">
          <li>Inserir apenas informações verdadeiras no catálogo, preços, fotos e na página pública;</li>
          <li>Coletar e tratar os dados dos seus clientes finais (cadastro, histórico, fichas de anamnese) em conformidade com a Lei Geral de Proteção de Dados — LGPD (Lei nº 13.709/2018), obtendo os consentimentos necessários, na qualidade de controlador desses dados;</li>
          <li>Não utilizar a Plataforma para envio de comunicações não solicitadas (spam) ou para qualquer finalidade ilícita;</li>
          <li>Respeitar direitos de terceiros nas imagens e conteúdos publicados.</li>
        </ul>
      </section>

      <section>
        <h2>6. Uso aceitável</h2>
        <p className="mt-2">É vedado, entre outros:</p>
        <ul className="mt-2">
          <li>Tentar acessar dados de outros negócios (tenants) ou burlar mecanismos de segurança e controle de acesso;</li>
          <li>Realizar engenharia reversa, cópia ou revenda da Plataforma sem autorização;</li>
          <li>Sobrecarregar intencionalmente a infraestrutura (uso abusivo, automações não autorizadas);</li>
          <li>Publicar conteúdo ilegal, ofensivo ou que viole direitos de terceiros.</li>
        </ul>
      </section>

      <section>
        <h2>7. Propriedade intelectual</h2>
        <p className="mt-2">
          A Plataforma, sua marca, código, layout e funcionalidades pertencem ao Agendê. Os dados
          inseridos pelo assinante (clientes, agendamentos, financeiro, fotos do próprio negócio)
          pertencem ao assinante, que pode solicitá-los ou excluí-los conforme a{' '}
          <Link href="/privacidade" className="underline">Política de Privacidade</Link>.
        </p>
      </section>

      <section>
        <h2>8. Disponibilidade e suporte</h2>
        <p className="mt-2">
          Empregamos esforços razoáveis para manter a Plataforma disponível de forma contínua, mas não
          garantimos operação ininterrupta ou livre de erros — manutenções, atualizações e fatores fora
          do nosso controle (provedores de infraestrutura, conexão do usuário) podem causar
          indisponibilidades temporárias. O suporte é prestado pelos canais oficiais divulgados no site.
        </p>
      </section>

      <section>
        <h2>9. Limitação de responsabilidade</h2>
        <p className="mt-2">
          Na máxima extensão permitida pela legislação, o Agendê não responde por: (i) danos decorrentes
          da relação entre o negócio assinante e seus clientes finais; (ii) uso indevido da conta por
          falha do assinante na guarda de credenciais; (iii) lucros cessantes decorrentes de
          indisponibilidade temporária; (iv) conteúdo inserido pelo assinante na sua página pública.
        </p>
      </section>

      <section>
        <h2>10. Encerramento e exclusão de dados</h2>
        <p className="mt-2">
          O assinante pode encerrar a conta a qualquer momento. Após o encerramento, os dados são
          mantidos pelo prazo necessário ao cumprimento de obrigações legais e, em seguida, excluídos ou
          anonimizados, conforme descrito na Política de Privacidade. O Agendê pode encerrar contas que
          violem estes Termos, mediante aviso quando possível.
        </p>
      </section>

      <section>
        <h2>11. Alterações destes termos</h2>
        <p className="mt-2">
          Estes Termos podem ser atualizados para refletir mudanças na Plataforma ou na legislação. A
          versão vigente estará sempre publicada nesta página, com a data de atualização. Mudanças
          relevantes serão comunicadas pelos canais da Plataforma; o uso continuado após a comunicação
          significa concordância com a nova versão.
        </p>
      </section>

      <section>
        <h2>12. Lei aplicável e contato</h2>
        <p className="mt-2">
          Estes Termos são regidos pelas leis da República Federativa do Brasil. Para dúvidas sobre
          estes Termos, utilize o canal de atendimento oficial (WhatsApp) divulgado no rodapé do site.
        </p>
      </section>
    </LegalShell>
  )
}
