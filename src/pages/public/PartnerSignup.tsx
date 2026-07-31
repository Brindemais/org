import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Check, ShieldCheck } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { LogoBadge } from '../../components/layout/Logo'
import { PARTNER_CATEGORIES } from '../../lib/types'
import { maskPhone } from '../../lib/format'

export default function PartnerSignup() {
  const [companyName, setCompanyName] = useState('')
  const [tradeName, setTradeName] = useState('')
  const [cnpjCpf, setCnpjCpf] = useState('')
  const [responsibleName, setResponsibleName] = useState('')
  const [phone, setPhone] = useState('')
  const [whatsapp, setWhatsapp] = useState('')
  const [email, setEmail] = useState('')
  const [category, setCategory] = useState('bar')
  const [city, setCity] = useState('')
  const [neighborhood, setNeighborhood] = useState('')
  const [address, setAddress] = useState('')

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const { error: insertError } = await supabase.from('partners').insert({
      company_name: companyName,
      trade_name: tradeName,
      cnpj_cpf: cnpjCpf,
      responsible_name: responsibleName,
      phone: phone.replace(/\D/g, ''),
      whatsapp: (whatsapp || phone).replace(/\D/g, ''),
      email,
      category,
      city: city || undefined,
      neighborhood: neighborhood || undefined,
      address: address || undefined,
    })
    setLoading(false)
    if (insertError) {
      setError('Não foi possível enviar seu cadastro. Tente novamente em instantes.')
      return
    }
    setDone(true)
  }

  if (done) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-white px-5 py-10">
        <div className="w-full max-w-sm text-center">
          <Link to="/" className="flex justify-center mb-6"><LogoBadge size={130} /></Link>
          <div className="card-light">
            <div className="w-14 h-14 rounded-full bg-gold-400/15 flex items-center justify-center mx-auto mb-4">
              <Check size={26} className="text-gold-500" />
            </div>
            <h1 className="font-display text-xl font-semibold mb-2 text-ink-950">Recebemos seu cadastro!</h1>
            <p className="text-sm text-black/55 leading-relaxed">
              Nossa equipe vai analisar as informações e entrar em contato pelo WhatsApp ou e-mail informado para dar
              continuidade ao credenciamento.
            </p>
            <Link to="/" className="btn-gold w-full mt-6">Voltar ao início</Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-dvh bg-white px-5 py-8">
      <div className="max-w-md mx-auto">
        <Link to="/" className="flex justify-center mb-5"><LogoBadge size={110} /></Link>
        <form onSubmit={handleSubmit} className="card-light space-y-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-gold-600 mb-1">Para o seu negócio</p>
            <h1 className="font-display text-xl font-semibold text-ink-950">Quero ser parceiro</h1>
            <p className="text-sm text-black/50 mt-1">
              Preencha os dados do seu estabelecimento. Nossa equipe entra em contato para concluir o credenciamento.
            </p>
          </div>

          <div>
            <label className="label-light">Razão social</label>
            <input className="input-light" required value={companyName} onChange={(e) => setCompanyName(e.target.value)} />
          </div>
          <div>
            <label className="label-light">Nome fantasia</label>
            <input className="input-light" required value={tradeName} onChange={(e) => setTradeName(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label-light">CNPJ ou CPF</label>
              <input className="input-light" required value={cnpjCpf} onChange={(e) => setCnpjCpf(e.target.value)} />
            </div>
            <div>
              <label className="label-light">Categoria</label>
              <select className="input-light" value={category} onChange={(e) => setCategory(e.target.value)}>
                {PARTNER_CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="label-light">Nome do responsável</label>
            <input className="input-light" required value={responsibleName} onChange={(e) => setResponsibleName(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label-light">Telefone</label>
              <input className="input-light" required value={phone} onChange={(e) => setPhone(maskPhone(e.target.value))} placeholder="(11) 99999-9999" />
            </div>
            <div>
              <label className="label-light">WhatsApp (se diferente)</label>
              <input className="input-light" value={whatsapp} onChange={(e) => setWhatsapp(maskPhone(e.target.value))} placeholder="(11) 99999-9999" />
            </div>
          </div>
          <div>
            <label className="label-light">E-mail</label>
            <input className="input-light" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label-light">Cidade</label>
              <input className="input-light" value={city} onChange={(e) => setCity(e.target.value)} placeholder="Rio de Janeiro" />
            </div>
            <div>
              <label className="label-light">Bairro</label>
              <input className="input-light" value={neighborhood} onChange={(e) => setNeighborhood(e.target.value)} />
            </div>
          </div>
          <div>
            <label className="label-light">Endereço</label>
            <input className="input-light" value={address} onChange={(e) => setAddress(e.target.value)} />
          </div>

          <p className="flex items-start gap-2 text-xs text-black/45">
            <ShieldCheck size={14} className="shrink-0 mt-0.5" />
            Este cadastro registra apenas seu interesse. O acesso ao painel do parceiro é liberado depois da análise
            e aprovação da nossa equipe.
          </p>

          {error && <p className="text-sm text-red-500">{error}</p>}
          <button type="submit" disabled={loading} className="btn-gold w-full">
            {loading ? 'Enviando...' : 'Enviar cadastro'}
          </button>
        </form>
      </div>
    </div>
  )
}
