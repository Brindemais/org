import { useEffect, useMemo, useState } from 'react'
import { ChevronDown, ChevronRight, Network, Search, Users } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { formatDate } from '../../lib/format'
import { LoadingState } from '../../components/ui/LoadingState'
import { EmptyState } from '../../components/ui/EmptyState'

interface Row {
  id: string
  full_name: string
  referral_code: string
  referred_by: string | null
  created_at: string
}

interface TreeNode extends Row {
  isActive: boolean
  children: TreeNode[]
}

export default function AdminReferrals() {
  const [rows, setRows] = useState<Row[]>([])
  const [activeIds, setActiveIds] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  useEffect(() => {
    setLoading(true)
    Promise.all([
      supabase.from('profiles').select('id, full_name, referral_code, referred_by, created_at').eq('role', 'subscriber').order('created_at', { ascending: true }),
      // Same "still within the paid cycle" rule as useSubscription's benefitsBlocked — a
      // status still saying 'active' with an expires_at in the past doesn't count.
      supabase.from('subscriptions').select('subscriber_id, status, expires_at').eq('status', 'active'),
    ]).then(([{ data: profiles }, { data: subs }]) => {
      setRows((profiles as Row[]) ?? [])
      const now = new Date()
      const active = new Set<string>()
      for (const s of subs ?? []) {
        if (!s.expires_at || new Date(s.expires_at) >= now) active.add(s.subscriber_id)
      }
      setActiveIds(active)
      setLoading(false)
    })
  }, [])

  const { roots, byId, totalInNetwork } = useMemo(() => {
    const byId = new Map<string, TreeNode>()
    for (const r of rows) byId.set(r.id, { ...r, isActive: activeIds.has(r.id), children: [] })

    const roots: TreeNode[] = []
    for (const node of byId.values()) {
      const parent = node.referred_by ? byId.get(node.referred_by) : undefined
      if (parent) parent.children.push(node)
      else roots.push(node)
    }
    const sortByName = (a: TreeNode, b: TreeNode) => a.full_name.localeCompare(b.full_name, 'pt-BR')
    const sortTree = (n: TreeNode) => { n.children.sort(sortByName); n.children.forEach(sortTree) }
    roots.sort(sortByName)
    roots.forEach(sortTree)

    return { roots, byId, totalInNetwork: rows.filter((r) => r.referred_by).length }
  }, [rows, activeIds])

  // When searching, auto-expand every ancestor chain that leads to a match
  // so the result is actually visible instead of buried in a collapsed node.
  const matchIds = useMemo(() => {
    if (!search.trim()) return null
    const q = search.trim().toLowerCase()
    const matches = new Set<string>()
    for (const r of rows) {
      if (r.full_name.toLowerCase().includes(q) || r.referral_code.toLowerCase().includes(q)) {
        let cur: string | null = r.id
        while (cur) {
          matches.add(cur)
          cur = byId.get(cur)?.referred_by ?? null
        }
      }
    }
    return matches
  }, [search, rows, byId])

  function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function countDescendants(n: TreeNode): number {
    return n.children.reduce((sum, c) => sum + 1 + countDescendants(c), 0)
  }

  function renderNode(n: TreeNode, depth: number) {
    if (matchIds && !matchIds.has(n.id)) return null
    const isOpen = matchIds ? true : expanded.has(n.id)
    const descendants = countDescendants(n)

    return (
      <div key={n.id}>
        <button
          onClick={() => n.children.length && toggle(n.id)}
          className="w-full flex items-center gap-2 py-2 pr-2 rounded-lg hover:bg-white/5 text-left"
          style={{ paddingLeft: `${depth * 20 + 8}px` }}
        >
          {n.children.length ? (
            isOpen ? <ChevronDown size={14} className="text-white/40 shrink-0" /> : <ChevronRight size={14} className="text-white/40 shrink-0" />
          ) : (
            <span className="w-3.5 shrink-0" />
          )}
          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${n.isActive ? 'bg-emerald-400' : 'bg-white/20'}`} />
          <span className="text-sm truncate">{n.full_name}</span>
          <span className="text-xs text-white/30 font-mono shrink-0">{n.referral_code}</span>
          {n.children.length > 0 && (
            <span className="text-xs text-white/40 shrink-0 ml-auto pl-2">{descendants} indicado{descendants === 1 ? '' : 's'}</span>
          )}
        </button>
        {isOpen && n.children.map((c) => renderNode(c, depth + 1))}
      </div>
    )
  }

  const visibleRoots = matchIds ? roots.filter((r) => matchIds.has(r.id)) : roots

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold">Indicações</h1>
          <p className="text-white/50 text-sm">
            {rows.length} assinantes · {totalInNetwork} vieram por indicação · {activeIds.size} com benefícios ativos
          </p>
        </div>
        <input
          className="input !w-64"
          placeholder="Buscar por nome ou código..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="card">
        {loading && <LoadingState dark label="Carregando árvore de indicações..." className="py-8" />}
        {!loading && !roots.length && (
          <EmptyState dark icon={Network} title="Nenhum assinante ainda" description="A árvore de indicações aparece aqui assim que houver assinantes cadastrados." className="py-8" />
        )}
        {!loading && roots.length > 0 && !visibleRoots.length && (
          <EmptyState dark icon={Search} title="Nada encontrado" description="Tente outro nome ou código de indicação." className="py-8" />
        )}
        {!loading && visibleRoots.length > 0 && (
          <div className="space-y-0.5">
            {visibleRoots.map((r) => renderNode(r, 0))}
          </div>
        )}
      </div>

      <div className="flex items-center gap-4 text-xs text-white/40">
        <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> Benefícios ativos</span>
        <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-white/20" /> Sem assinatura ativa</span>
        <span className="flex items-center gap-1.5 ml-auto"><Users size={12} /> Cada raiz é alguém que assinou sem link de indicação</span>
      </div>
    </div>
  )
}
