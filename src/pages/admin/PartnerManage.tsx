import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowDownLeft, ArrowLeft, ArrowUpRight, Check, Gift, History, Package, Pause, Play, Plus, Trash2, Wallet } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import type { ProductRow, Partner } from '../../lib/types'
import { formatBRL, formatDateTime } from '../../lib/format'
import { EmptyState } from '../../components/ui/EmptyState'

interface ExtratoRow { id: string; type: string; direction: string; amount: number; description: string | null; created_at: string }

// Mesmos rótulos do extrato do parceiro (src/pages/partner/ProductOrders.tsx)
// — a descrição já traz a origem real (saldo interno/Pix/cartão/ativação
// manual) desde que o lançamento foi gerado.
const EXTRATO_TYPE_LABELS: Record<string, string> = {
  purchase: 'Venda de produto',
  bonus_subscription: 'Bonificação de indicação de assinante',
  bonus_partner_fee: 'Bonificação de indicação de parceiro',
  bonus_consumption: 'Bonificação de produtos',
  cashback: 'Cashback',
  withdrawal: 'Saque',
  adjustment: 'Ajuste administrativo',
  reversal: 'Estorno',
}

// Admin gerenciando a vitrine deste parceiro específico, nos mesmos
// moldes de partner/Products.tsx — não é um "logar como o parceiro" de
// verdade, mas chega no mesmo resultado prático via RLS (is_admin()
// libera tudo que is_partner_staff libera). Mesma regra de produto do
// parceiro comum: só escolhe do catálogo do admin
// (/admin/cadastrar-brinde), não cadastra brinde do zero, sem valor.
//
// Quantidade em estoque é SÓ do parceiro — o admin não sabe quanto o
// parceiro tem de verdade no balcão, então não tem campo de quantidade
// aqui nem forma de ajustar estoque por aqui. A lista abaixo é só
// consulta (read-only); o parceiro ajusta na própria aba Brindes/Estoque.
interface CatalogItem { id: string; name: string; description: string | null; image_url: string | null }
interface StockRow { id: string; quantity: number; product: { id: string; name: string } }

export default function AdminPartnerManage() {
  const { id } = useParams<{ id: string }>()
  const [partner, setPartner] = useState<Partner | null>(null)
  const [catalog, setCatalog] = useState<CatalogItem[]>([])
  const [mine, setMine] = useState<ProductRow[]>([])
  const [stock, setStock] = useState<StockRow[]>([])
  const [addingId, setAddingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState<{ id: string; message: string } | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [walletBalance, setWalletBalance] = useState<number | null>(null)
  const [walletAvailable, setWalletAvailable] = useState<number | null>(null)
  const [extrato, setExtrato] = useState<ExtratoRow[]>([])
  const [showAllExtrato, setShowAllExtrato] = useState(false)

  async function load() {
    if (!id) return
    const [{ data: p }, { data: cat }, { data: own }, { data: stockRows }, { data: staffRow }] = await Promise.all([
      supabase.from('partners').select('*').eq('id', id).maybeSingle(),
      supabase.rpc('list_public_products').select('id, name, description, image_url').is('partner_id', null).eq('is_gift', true).order('name'),
      supabase.from('products').select('*').eq('partner_id', id).order('created_at', { ascending: false }),
      supabase.from('stock_partner').select('id, quantity, product:product_id(id, name)').eq('partner_id', id),
      supabase.from('partner_staff').select('profile_id').eq('partner_id', id).order('created_at', { ascending: true }).limit(1).maybeSingle(),
    ])
    setPartner(p as Partner)
    setCatalog((cat as CatalogItem[]) ?? [])
    setMine((own as ProductRow[]) ?? [])
    setStock((stockRows as any[]) ?? [])

    const staffProfileId = (staffRow as { profile_id: string } | null)?.profile_id
    if (staffProfileId) {
      const [{ data: balance }, { data: available }, { data: extratoRows }] = await Promise.all([
        supabase.rpc('current_wallet_balance', { p_user_id: staffProfileId }),
        supabase.rpc('available_bonus_balance', { p_user_id: staffProfileId }),
        supabase.from('wallet_transactions').select('id, type, direction, amount, description, created_at').eq('user_id', staffProfileId).order('created_at', { ascending: false }).limit(100),
      ])
      setWalletBalance(typeof balance === 'number' ? balance : Number(balance ?? 0))
      setWalletAvailable(typeof available === 'number' ? available : Number(available ?? 0))
      setExtrato((extratoRows as ExtratoRow[]) ?? [])
    } else {
      setWalletBalance(null)
      setWalletAvailable(null)
      setExtrato([])
    }
  }

  useEffect(() => { load() }, [id])

  const selectedCatalogIds = new Set(mine.map((p) => p.catalog_id).filter(Boolean))

  async function addToShowcase(item: CatalogItem) {
    if (!id) return
    setError(null)
    setAddingId(item.id)
    const { error: insertError } = await supabase.from('products').insert({
      partner_id: id,
      catalog_id: item.id,
      name: item.name,
      description: item.description,
      image_url: item.image_url,
      is_gift: true,
      approved: true,
    })
    setAddingId(null)
    if (insertError) { setError('Não foi possível adicionar este brinde à vitrine do parceiro.'); return }
    load()
  }

  async function toggleActive(p: ProductRow) {
    await supabase.from('products').update({ active: !p.active }).eq('id', p.id)
    load()
  }

  async function deleteMine(p: ProductRow) {
    if (!confirm(`Remover "${p.name}" da vitrine deste parceiro? Essa ação não pode ser desfeita.`)) return
    setDeleteError(null)
    setDeletingId(p.id)
    const { error: deleteErr } = await supabase.from('products').delete().eq('id', p.id)
    setDeletingId(null)
    if (deleteErr) {
      setDeleteError({
        id: p.id,
        message: deleteErr.code === '23503' ? 'Não é possível remover: já tem retirada ou movimentação de estoque registrada. Use Pausar.' : 'Não foi possível remover.',
      })
      return
    }
    load()
  }

  if (!partner) return null

  return (
    <div className="space-y-8">
      <div>
        <Link to="/admin/parceiros" className="text-xs text-white/40 flex items-center gap-1 mb-2 w-fit"><ArrowLeft size={12} /> Voltar pra parceiros</Link>
        <h1 className="font-display text-2xl font-semibold">{partner.trade_name}</h1>
        <p className="text-white/50 text-sm">Escolha, do catálogo, quais brindes este parceiro oferece. A quantidade em estoque é definida pelo próprio parceiro.</p>
      </div>

      {walletBalance !== null ? (
        <div className="card">
          <p className="font-semibold mb-3 flex items-center gap-2"><Wallet size={16} className="text-gold-400" /> Financeiro do parceiro</p>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <p className="text-xs text-white/40">Saldo total</p>
              <p className={`text-xl font-bold ${walletBalance < 0 ? 'text-red-400' : ''}`}>{formatBRL(walletBalance)}</p>
            </div>
            <div>
              <p className="text-xs text-white/40">Disponível para saque</p>
              <p className="text-xl font-bold text-emerald-400">{formatBRL(walletAvailable ?? 0)}</p>
            </div>
          </div>

          <div className="flex items-center justify-between mb-2 pt-3 border-t border-ink-800">
            <p className="text-xs font-bold uppercase tracking-wide text-white/40 flex items-center gap-1.5"><History size={12} /> Extrato</p>
            {extrato.length > 6 && (
              <button onClick={() => setShowAllExtrato(!showAllExtrato)} className="text-xs text-gold-400 font-medium">
                {showAllExtrato ? 'Ver menos' : `Ver todos (${extrato.length})`}
              </button>
            )}
          </div>
          {extrato.length === 0 && <p className="text-xs text-white/30">Nenhuma movimentação ainda.</p>}
          <div className="space-y-1.5">
            {(showAllExtrato ? extrato : extrato.slice(0, 6)).map((t) => (
              <div key={t.id} className="flex items-center gap-2 text-xs py-1.5 border-t border-ink-800">
                <span className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${t.direction === 'in' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400'}`}>
                  {t.direction === 'in' ? <ArrowDownLeft size={11} /> : <ArrowUpRight size={11} />}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="truncate">{t.description || EXTRATO_TYPE_LABELS[t.type] || t.type}</p>
                  <p className="text-white/30">{formatDateTime(t.created_at)}</p>
                </div>
                <span className={`font-semibold shrink-0 ${t.direction === 'in' ? 'text-emerald-400' : 'text-red-400'}`}>
                  {t.direction === 'in' ? '+' : '-'} {formatBRL(t.amount)}
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="card">
          <p className="text-xs text-white/40">Este parceiro ainda não tem nenhuma pessoa da equipe vinculada — sem isso, não há carteira pra mostrar.</p>
        </div>
      )}

      <div>
        <p className="font-semibold mb-3">Catálogo disponível</p>
        {error && <p className="text-xs text-red-400 mb-3">{error}</p>}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {catalog.map((item) => {
            const selected = selectedCatalogIds.has(item.id)
            return (
              <div key={item.id} className="card">
                <div className="aspect-video rounded-lg bg-ink-950 border border-ink-800 mb-3 overflow-hidden flex items-center justify-center">
                  {item.image_url ? <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" /> : <span className="text-xs text-white/20">Sem foto</span>}
                </div>
                <p className="font-semibold">{item.name}</p>
                {item.description && <p className="text-xs text-white/50 mb-2">{item.description}</p>}

                {selected ? (
                  <p className="mt-3 pt-3 border-t border-ink-800 text-xs text-emerald-400 flex items-center gap-1.5"><Check size={12} /> Já está na vitrine</p>
                ) : (
                  <button onClick={() => addToShowcase(item)} disabled={addingId === item.id} className="btn-dark w-full !py-2 text-xs gap-1.5 mt-3 pt-3 border-t border-ink-800 justify-center">
                    <Plus size={12} /> {addingId === item.id ? 'Adicionando...' : 'Adicionar à vitrine'}
                  </button>
                )}
              </div>
            )
          })}
          {!catalog.length && (
            <div className="col-span-full"><EmptyState dark icon={Gift} title="Nenhum brinde no catálogo ainda" description="Cadastre o primeiro em Cadastrar brinde." /></div>
          )}
        </div>
      </div>

      <div>
        <p className="font-semibold mb-3">Vitrine deste parceiro</p>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {mine.map((p) => (
            <div key={p.id} className={`card ${!p.active ? 'opacity-60' : ''}`}>
              <div className="aspect-video rounded-lg bg-ink-950 border border-ink-800 mb-3 overflow-hidden flex items-center justify-center">
                {p.image_url ? <img src={p.image_url} alt={p.name} className="w-full h-full object-cover" /> : <span className="text-xs text-white/20">Sem foto</span>}
              </div>
              <p className="font-semibold">{p.name}</p>
              <div className="flex gap-2 mt-3 pt-3 border-t border-ink-800">
                <button onClick={() => toggleActive(p)} className="btn-dark flex-1 !py-2 text-xs gap-1.5">
                  {p.active ? <><Pause size={12} /> Pausar</> : <><Play size={12} /> Reativar</>}
                </button>
                <button onClick={() => deleteMine(p)} disabled={deletingId === p.id} className="btn-dark !py-2 !px-2.5 text-xs text-red-400"><Trash2 size={12} /></button>
              </div>
              {deleteError?.id === p.id && <p className="text-xs text-red-400 mt-2">{deleteError.message}</p>}
            </div>
          ))}
          {!mine.length && (
            <div className="col-span-full"><EmptyState dark icon={Gift} title="Nenhum brinde escolhido ainda" description="Escolha um brinde do catálogo acima." /></div>
          )}
        </div>
      </div>

      <div>
        <p className="font-semibold mb-3 flex items-center gap-2"><Package size={16} className="text-gold-400" /> Estoque (consulta)</p>
        <p className="text-xs text-white/30 mb-3">Só o parceiro informa e ajusta a quantidade, na própria aba Brindes/Estoque do painel dele.</p>
        <div className="card overflow-x-auto">
          <table className="w-full text-sm min-w-[400px]">
            <thead>
              <tr className="text-left text-white/40 text-xs uppercase"><th className="pb-3">Produto</th><th className="pb-3">Quantidade</th></tr>
            </thead>
            <tbody>
              {stock.map((s) => (
                <tr key={s.id} className="border-t border-ink-800">
                  <td className="py-3">{s.product?.name}</td>
                  <td className="py-3 font-semibold">{s.quantity}</td>
                </tr>
              ))}
              {!stock.length && <tr><td colSpan={2}><EmptyState dark icon={Package} title="Nenhum brinde em estoque ainda" className="py-6" /></td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
