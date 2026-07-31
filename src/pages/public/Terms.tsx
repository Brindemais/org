import { Link } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'
import { Logo } from '../../components/layout/Logo'

export default function Terms() {
  return (
    <div className="bg-white text-ink-950 min-h-dvh">
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur border-b border-black/10">
        <div className="max-w-3xl mx-auto px-5 py-3.5 flex items-center justify-between">
          <Logo size="sm" dark />
          <Link to="/" className="text-sm text-black/50 flex items-center gap-1"><ChevronLeft size={15} /> Voltar ao site</Link>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-5 py-12 space-y-6">
        <div>
          <h1 className="font-display text-3xl font-semibold mb-2">Termos de Uso</h1>
          <p className="text-sm text-black/40">Última atualização: 31 de julho de 2026</p>
        </div>

        <div className="space-y-6 text-sm text-black/70 leading-relaxed">
          <section>
            <h2 className="font-display text-lg font-semibold text-ink-950 mb-2">1. Sobre o Brinde Mais</h2>
            <p>O Brinde Mais é um clube de benefícios por assinatura mensal que oferece, entre outras vantagens, um brinde mensal a ser retirado em estabelecimentos parceiros, descontos exclusivos, acesso a uma loja virtual e um programa de bonificação por indicação. Estes Termos de Uso regulam a relação entre você ("assinante") e o Brinde Mais.</p>
          </section>

          <section>
            <h2 className="font-display text-lg font-semibold text-ink-950 mb-2">2. Cadastro e elegibilidade</h2>
            <p>Para assinar o clube, você deve ser maior de 18 anos e fornecer dados verdadeiros, completos e atualizados, incluindo CPF válido. Cada CPF pode estar associado a apenas uma conta ativa. É proibido o consumo de bebidas alcoólicas por menores de idade; os brindes e descontos relacionados a bebidas alcoólicas destinam-se exclusivamente a maiores de 18 anos, e o parceiro poderá exigir documento de identificação no momento da retirada.</p>
          </section>

          <section>
            <h2 className="font-display text-lg font-semibold text-ink-950 mb-2">3. Assinatura e pagamento</h2>
            <p>A assinatura tem valor mensal informado no momento da contratação, cobrado via Pix. A confirmação do pagamento ativa ou renova o ciclo mensal de benefícios. O não pagamento até a data de vencimento pode levar a assinatura ao status de "em atraso" e, após o período de carência, à suspensão dos benefícios até a regularização.</p>
          </section>

          <section>
            <h2 className="font-display text-lg font-semibold text-ink-950 mb-2">4. Brinde mensal e retirada</h2>
            <p>Assinantes com assinatura ativa têm direito a um brinde por ciclo mensal, a ser retirado em um estabelecimento parceiro de sua escolha, mediante apresentação do código de retirada gerado no aplicativo. O prazo para retirada é de até 30 dias corridos a partir da escolha do parceiro; retiradas não realizadas dentro do prazo são consideradas expiradas, sem direito a reembolso ou acúmulo para o ciclo seguinte. O assinante pode cadastrar pessoas autorizadas para retirar o brinde em seu nome, mediante identificação no parceiro.</p>
          </section>

          <section>
            <h2 className="font-display text-lg font-semibold text-ink-950 mb-2">5. Programa de indicação e bonificação</h2>
            <p>Assinantes podem indicar novos assinantes por meio de link ou código pessoal de indicação. Bonificações são creditadas na carteira digital do indicador conforme a política vigente de percentuais por nível (até 7 níveis de profundidade), tanto sobre assinaturas quanto sobre consumo na loja virtual, respeitadas as regras de elegibilidade e possíveis limites antifraude.</p>
          </section>

          <section>
            <h2 className="font-display text-lg font-semibold text-ink-950 mb-2">6. Carteira digital e saques</h2>
            <p>Valores de cashback e bonificação são creditados em carteira digital vinculada à conta do assinante. Saques podem ser solicitados para a chave Pix cadastrada e são processados pela equipe Brinde Mais em prazo informado no aplicativo, podendo estar sujeitos a análise antifraude.</p>
          </section>

          <section>
            <h2 className="font-display text-lg font-semibold text-ink-950 mb-2">7. Parceiros comerciais</h2>
            <p>Os estabelecimentos parceiros são responsáveis pela qualidade dos produtos e serviços oferecidos, pelo cumprimento dos horários de funcionamento informados e pela correta aplicação dos descontos e retiradas. O Brinde Mais atua como plataforma intermediária e não se responsabiliza por eventuais divergências comerciais entre assinante e parceiro, comprometendo-se a mediar e apurar reclamações formais via canal de suporte.</p>
          </section>

          <section>
            <h2 className="font-display text-lg font-semibold text-ink-950 mb-2">8. Cancelamento</h2>
            <p>O assinante pode cancelar sua assinatura a qualquer momento pelo aplicativo ou canal de suporte. O cancelamento interrompe a cobrança dos próximos ciclos, sem reembolso proporcional do ciclo vigente já pago, e mantém acesso aos benefícios até o fim do período já quitado.</p>
          </section>

          <section>
            <h2 className="font-display text-lg font-semibold text-ink-950 mb-2">9. Uso indevido e encerramento de conta</h2>
            <p>O Brinde Mais poderá suspender ou encerrar contas em caso de fraude, uso de dados falsos, tentativa de burlar o programa de indicação, ou violação destes Termos, sem prejuízo de outras medidas cabíveis.</p>
          </section>

          <section>
            <h2 className="font-display text-lg font-semibold text-ink-950 mb-2">10. Alterações</h2>
            <p>Estes Termos podem ser atualizados periodicamente. Alterações relevantes serão comunicadas pelos canais de contato cadastrados. O uso continuado da plataforma após a alteração representa concordância com os novos termos.</p>
          </section>

          <section>
            <h2 className="font-display text-lg font-semibold text-ink-950 mb-2">11. Contato</h2>
            <p>Dúvidas sobre estes Termos podem ser enviadas para <span className="text-gold-600">contato@brindemais.com.br</span> ou pelo canal de suporte dentro do aplicativo.</p>
          </section>
        </div>
      </div>
    </div>
  )
}
