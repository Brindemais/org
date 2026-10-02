import { useEffect, useState } from 'react'
import { Check, Loader2, X } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { slugifyReferralCode } from '../../lib/format'

interface Props {
  referrerCode: string
  onReferrerCodeChange: (v: string) => void
  myCode: string
  onMyCodeChange: (v: string) => void
  autoSuggestSource: string
  myCodeLabel: string
  myCodeHint: string
  onValidityChange: (valid: boolean) => void
}

// Campo de "quem indicou" (obrigatório) e campo de link de indicação
// próprio (obrigatório, com sugestão automática a partir do nome). Os dois
// validam ao vivo contra o banco (resolve_referral_code /
// referral_code_available), sem precisar submeter o formulário pra saber
// se o código existe ou já está em uso.
export function ReferralFields({
  referrerCode, onReferrerCodeChange, myCode, onMyCodeChange,
  autoSuggestSource, myCodeLabel, myCodeHint, onValidityChange,
}: Props) {
  const [referrerStatus, setReferrerStatus] = useState<'idle' | 'checking' | 'valid' | 'invalid'>('idle')
  const [referrerName, setReferrerName] = useState<string | null>(null)
  const [myCodeStatus, setMyCodeStatus] = useState<'idle' | 'checking' | 'available' | 'taken' | 'invalid'>('idle')
  const [myCodeTouched, setMyCodeTouched] = useState(false)

  // Sugere o link próprio a partir do nome/estabelecimento enquanto a
  // pessoa não editar esse campo manualmente.
  useEffect(() => {
    if (myCodeTouched) return
    onMyCodeChange(slugifyReferralCode(autoSuggestSource))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoSuggestSource, myCodeTouched])

  useEffect(() => {
    const code = referrerCode.trim()
    if (!code) {
      setReferrerStatus('idle')
      setReferrerName(null)
      return
    }
    setReferrerStatus('checking')
    const t = setTimeout(async () => {
      const { data } = await supabase.rpc('resolve_referral_code', { p_code: code })
      if (data) {
        setReferrerStatus('valid')
        setReferrerName(data as string)
      } else {
        setReferrerStatus('invalid')
        setReferrerName(null)
      }
    }, 400)
    return () => clearTimeout(t)
  }, [referrerCode])

  useEffect(() => {
    const code = slugifyReferralCode(myCode)
    if (!code || code.length < 3) {
      setMyCodeStatus(code ? 'invalid' : 'idle')
      return
    }
    setMyCodeStatus('checking')
    const t = setTimeout(async () => {
      const { data } = await supabase.rpc('referral_code_available', { p_code: code })
      setMyCodeStatus(data ? 'available' : 'taken')
    }, 400)
    return () => clearTimeout(t)
  }, [myCode])

  useEffect(() => {
    onValidityChange(referrerStatus === 'valid' && myCodeStatus === 'available')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [referrerStatus, myCodeStatus])

  const slug = slugifyReferralCode(myCode)

  return (
    <div className="space-y-4">
      <div>
        <label className="label-light">Quem indicou você? *</label>
        <input
          className="input-light"
          required
          value={referrerCode}
          onChange={(e) => onReferrerCodeChange(e.target.value)}
          placeholder="Nome ou link de quem te indicou"
        />
        {referrerStatus === 'checking' && (
          <p className="text-xs text-black/40 mt-1 flex items-center gap-1"><Loader2 size={12} className="animate-spin" /> Verificando...</p>
        )}
        {referrerStatus === 'valid' && (
          <p className="text-xs text-emerald-600 mt-1 flex items-center gap-1"><Check size={12} /> Indicado por {referrerName}</p>
        )}
        {referrerStatus === 'invalid' && (
          <p className="text-xs text-red-500 mt-1 flex items-center gap-1"><X size={12} /> Código de indicação não encontrado.</p>
        )}
        <p className="text-xs text-black/40 mt-1">É obrigatório ter um link ou nome de quem te indicou pra se cadastrar na Brinde Mais.</p>
      </div>

      <div>
        <label className="label-light">{myCodeLabel} *</label>
        <input
          className="input-light"
          required
          value={myCode}
          onChange={(e) => { setMyCodeTouched(true); onMyCodeChange(e.target.value) }}
          placeholder="seu-nome-ou-apelido"
        />
        {slug && <p className="text-xs text-black/40 mt-1 break-all">Seu link: brindemais.com.br/cadastro?ref={slug}</p>}
        {myCodeStatus === 'checking' && (
          <p className="text-xs text-black/40 mt-1 flex items-center gap-1"><Loader2 size={12} className="animate-spin" /> Verificando disponibilidade...</p>
        )}
        {myCodeStatus === 'available' && (
          <p className="text-xs text-emerald-600 mt-1 flex items-center gap-1"><Check size={12} /> Disponível</p>
        )}
        {myCodeStatus === 'taken' && (
          <p className="text-xs text-red-500 mt-1 flex items-center gap-1"><X size={12} /> Esse link já está em uso, escolha outro.</p>
        )}
        {myCodeStatus === 'invalid' && (
          <p className="text-xs text-red-500 mt-1 flex items-center gap-1"><X size={12} /> Use pelo menos 3 letras ou números.</p>
        )}
        <p className="text-xs text-black/40 mt-1">{myCodeHint}</p>
      </div>
    </div>
  )
}
