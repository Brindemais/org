import { Link } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'
import { Logo } from '../../components/layout/Logo'

export default function Privacy() {
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
          <h1 className="font-display text-3xl font-semibold mb-2">Política de Privacidade</h1>
          <p className="text-sm text-black/40">Última atualização: 31 de julho de 2026</p>
        </div>

        <div className="space-y-6 text-sm text-black/70 leading-relaxed">
          <section>
            <p>Esta Política de Privacidade descreve como o Brinde Mais coleta, usa, armazena e protege seus dados pessoais, em conformidade com a Lei Geral de Proteção de Dados (Lei nº 13.709/2018, LGPD).</p>
          </section>

          <section>
            <h2 className="font-display text-lg font-semibold text-ink-950 mb-2">1. Dados que coletamos</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>Dados cadastrais: nome completo, CPF, data de nascimento, e-mail, telefone e endereço.</li>
              <li>Dados de pagamento: chave Pix e histórico de transações (não armazenamos dados de cartão).</li>
              <li>Dados de uso: histórico de retiradas, pedidos na loja, indicações realizadas e interações de suporte.</li>
              <li>Dados de localização: apenas quando você autoriza o acesso à geolocalização do navegador, usados para calcular a distância até parceiros próximos. Não armazenamos essa localização em nossos servidores.</li>
            </ul>
          </section>

          <section>
            <h2 className="font-display text-lg font-semibold text-ink-950 mb-2">2. Finalidade do tratamento</h2>
            <p>Usamos seus dados para: viabilizar sua assinatura e o acesso aos benefícios do clube; processar pagamentos e saques; calcular e creditar bonificações do programa de indicação; permitir a confirmação segura de retiradas de brinde; prevenir fraudes; e para comunicações operacionais sobre sua conta (confirmações, avisos de vencimento, notificações de retirada).</p>
          </section>

          <section>
            <h2 className="font-display text-lg font-semibold text-ink-950 mb-2">3. Compartilhamento de dados</h2>
            <p>Compartilhamos dados estritamente necessários com estabelecimentos parceiros (nome do assinante e código de retirada, apenas no momento da confirmação da entrega) e com prestadores de infraestrutura tecnológica (hospedagem e banco de dados) que atuam como operadores, sob obrigações contratuais de confidencialidade e segurança. Não vendemos seus dados pessoais a terceiros.</p>
          </section>

          <section>
            <h2 className="font-display text-lg font-semibold text-ink-950 mb-2">4. Retenção de dados</h2>
            <p>Mantemos seus dados enquanto sua conta estiver ativa e pelo período adicional exigido por obrigações legais, fiscais e contábeis (incluindo o histórico financeiro de transações, saldo de carteira e bonificações, que não podem ser apagados retroativamente por integridade contábil). Solicitações de exclusão são atendidas na medida em que não conflitem com essas obrigações legais.</p>
          </section>

          <section>
            <h2 className="font-display text-lg font-semibold text-ink-950 mb-2">5. Seus direitos como titular</h2>
            <p>Nos termos da LGPD, você pode a qualquer momento, pelo aplicativo (em Perfil → Privacidade e dados) ou pelo canal de suporte:</p>
            <ul className="list-disc pl-5 space-y-1 mt-2">
              <li>Confirmar a existência de tratamento e acessar seus dados;</li>
              <li>Baixar uma cópia estruturada dos seus dados pessoais;</li>
              <li>Corrigir dados incompletos, inexatos ou desatualizados pelo seu perfil;</li>
              <li>Solicitar a exclusão da sua conta e dos dados não sujeitos a retenção legal obrigatória;</li>
              <li>Revogar o consentimento de uso de geolocalização a qualquer momento, pelas permissões do navegador ou dispositivo.</li>
            </ul>
          </section>

          <section>
            <h2 className="font-display text-lg font-semibold text-ink-950 mb-2">6. Segurança</h2>
            <p>Adotamos medidas técnicas e administrativas para proteger seus dados contra acessos não autorizados, incluindo controle de acesso por perfil, criptografia em trânsito e políticas de banco de dados que restringem o acesso apenas ao necessário para cada função (assinante, parceiro ou administrador).</p>
          </section>

          <section>
            <h2 className="font-display text-lg font-semibold text-ink-950 mb-2">7. Encarregado de dados (DPO)</h2>
            <p>Para exercer seus direitos ou tirar dúvidas sobre o tratamento dos seus dados, entre em contato pelo e-mail <span className="text-gold-600">contato@brindemais.com.br</span> ou pelo canal de suporte dentro do aplicativo.</p>
          </section>
        </div>
      </div>
    </div>
  )
}
