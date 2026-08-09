import { useEffect, useMemo, useState } from 'react'
import { Percent, Search } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import type { PromotionStatus } from '../../lib/types'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { EmptyState } from '../../components/ui/EmptyState'
import { ImageUpload } from '../../components/ui/ImageUpload'
import { formatDate } from '../../lib/format'

const STATUS_OPTIONS: PromotionStatus[] = ['draft', 'pending_approval', 'approved', 'rejected', 'suspended', 'expired']

const emptyEdit = { title: '', description: '', image_url: '', normal_price: '', subscriber_price: '', valid_until: '' }

export default function AdminPromotions() {
  const [promotions, setPromotions] = useState<any[]>([])
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [edit, setEdit] = useState(emptyEdit)
  const [savingEdit, setSavingEdit] = useState(false)

  async function load() {
    const { data } = await supabase.from('promotions').select('*, partner:partner_id(trade_name)').order('created_at', { ascending: false })
    setPromotions(data ?? [])
  }

  useEffect(() => { load() }, [])

  async function setStatus(id: string, status: PromotionStatus) {
    await supabase.rpc('admin_set_promotion_status', { p_promotion_id: id, p_status: status })
    load()
  }

  function startEdit(p: any) {
    setEditingId(p.id)
    setEdit({
      title: p.title,
      description: p.description ?? '',
      image_url: p.image_url ?? '',
      normal_price: String(p.normal_price ?? ''),
      subscriber_price: String(p.subscriber_price ?? ''),
      valid_until: p.valid_until ?? '',
    })
  }

  async function saveEdit(id: string) {
    setSavingEdit(true)
    const { error } = await supabase.from('promotions').update({
      title: edit.title,
      description: edit.description || null,
      image_url: edit.image_url || null,
      normal_price: Number(edit.normal_price || 0),
      subscriber_price: Number(edit.subscriber_price || 0),
      valid_until: edit.valid_until,
    }).eq('id', id)
    setSavingEdit(false)
    if (!error) { setEditingId(null); load() }
  }

  const filtered = useMemo(() => promotions.filter((p) => {
    const q = search.trim().toLowerCase()
    const matchesSearch = !q || p.title.toLowerCase().includes(q) || (p.partner?.trade_name ?? '').toLowerCase().includes(q)
    const matchesStatus = !statusFilter || p.status === statusFilter
    return matchesSearch && matchesStatus
  }), [promotions, search, statusFilter])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold">Promoções</h1>
        <p className="text-white/50 text-sm">Revise e aprove as promoções enviadas pelos parceiros.</p>
      </div>

      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
          <input className="input !pl-9" placeholder="Buscar por título ou parceiro..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <select className="input !w-auto" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">Todos os status</option>
          {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      <div className="space-y-3">
        {filtered.map((p: any) => (
          <div key={p.id} className="card">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                {p.image_url && <img src={p.image_url} alt="" className="w-12 h-12 rounded-lg object-cover shrink-0" />}
                <div className="min-w-0">
                  <p className="font-semibold truncate">{p.title}</p>
                  <p className="text-xs text-white/40">{p.partner?.trade_name} · Válida até {formatDate(p.valid_until)}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <StatusBadge status={p.status} />
                {editingId !== p.id && <button onClick={() => startEdit(p)} className="text-xs text-gold-400 font-medium">Editar</button>}
                {p.status === 'pending_approval' && (
                  <>
                    <button onClick={() => setStatus(p.id, 'approved')} className="btn-gold !py-1.5 !px-3 text-xs">Aprovar</button>
                    <button onClick={() => setStatus(p.id, 'rejected')} className="btn-ghost !py-1.5 !px-3 text-xs">Recusar</button>
                  </>
                )}
                {p.status === 'approved' && (
                  <button onClick={() => setStatus(p.id, 'suspended')} className="btn-ghost !py-1.5 !px-3 text-xs">Suspender</button>
                )}
              </div>
            </div>

            {editingId === p.id && (
              <div className="mt-3 grid sm:grid-cols-2 gap-3 bg-ink-950/50 rounded-lg p-3">
                <div className="sm:col-span-2">
                  <ImageUpload value={edit.image_url || null} onChange={(url) => setEdit({ ...edit, image_url: url })} folder="promotions" label="Foto da promoção" />
                </div>
                <input className="input" placeholder="Título" value={edit.title} onChange={(e) => setEdit({ ...edit, title: e.target.value })} />
                <input className="input" placeholder="Descrição" value={edit.description} onChange={(e) => setEdit({ ...edit, description: e.target.value })} />
                <input className="input" type="number" step="0.01" placeholder="Preço normal" value={edit.normal_price} onChange={(e) => setEdit({ ...edit, normal_price: e.target.value })} />
                <input className="input" type="number" step="0.01" placeholder="Preço assinante" value={edit.subscriber_price} onChange={(e) => setEdit({ ...edit, subscriber_price: e.target.value })} />
                <input className="input" type="date" value={edit.valid_until} onChange={(e) => setEdit({ ...edit, valid_until: e.target.value })} />
                <div className="sm:col-span-2 flex gap-2">
                  <button onClick={() => saveEdit(p.id)} disabled={savingEdit} className="btn-gold !py-2 !px-3 text-xs">{savingEdit ? 'Salvando...' : 'Salvar alterações'}</button>
                  <button onClick={() => setEditingId(null)} className="btn-ghost !py-2 !px-3 text-xs">Cancelar</button>
                </div>
              </div>
            )}
          </div>
        ))}
        {!filtered.length && (
          <EmptyState dark icon={Percent} title={promotions.length ? 'Nenhuma promoção encontrada' : 'Nenhuma promoção cadastrada'} />
        )}
      </div>
    </div>
  )
}
