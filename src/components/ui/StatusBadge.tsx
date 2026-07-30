const STYLES: Record<string, string> = {
  active: 'bg-emerald-500/15 text-emerald-400',
  ativo: 'bg-emerald-500/15 text-emerald-400',
  approved: 'bg-emerald-500/15 text-emerald-400',
  confirmed: 'bg-emerald-500/15 text-emerald-400',
  paid: 'bg-emerald-500/15 text-emerald-400',
  withdrawn: 'bg-emerald-500/15 text-emerald-400',
  ready: 'bg-gold-400/15 text-gold-300',
  reserved: 'bg-gold-400/15 text-gold-300',
  requested: 'bg-gold-400/15 text-gold-300',
  pending: 'bg-gold-400/15 text-gold-300',
  pending_approval: 'bg-gold-400/15 text-gold-300',
  analyzing: 'bg-sky-500/15 text-sky-400',
  interested: 'bg-sky-500/15 text-sky-400',
  pending_docs: 'bg-sky-500/15 text-sky-400',
  overdue: 'bg-red-500/15 text-red-400',
  cancelled: 'bg-red-500/15 text-red-400',
  rejected: 'bg-red-500/15 text-red-400',
  failed: 'bg-red-500/15 text-red-400',
  suspended: 'bg-red-500/15 text-red-400',
  expired: 'bg-white/10 text-white/50',
  closed: 'bg-white/10 text-white/50',
}

const LABELS: Record<string, string> = {
  active: 'Ativo', ativo: 'Ativo', approved: 'Aprovado', confirmed: 'Confirmado', paid: 'Pago',
  withdrawn: 'Retirado', ready: 'Disponível', reserved: 'Reservado', requested: 'Solicitado',
  pending: 'Pendente', pending_approval: 'Aguardando aprovação', analyzing: 'Em análise',
  interested: 'Interessado', pending_docs: 'Aguardando documentação', overdue: 'Vencido',
  cancelled: 'Cancelado', rejected: 'Recusado', failed: 'Falhou', suspended: 'Suspenso',
  expired: 'Expirado', closed: 'Encerrado',
}

export function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`pill ${STYLES[status] ?? 'bg-white/10 text-white/60'}`}>
      {LABELS[status] ?? status}
    </span>
  )
}
