import { Link, useNavigate } from 'react-router-dom'
import { useState } from 'react'
import { Menu, X } from 'lucide-react'
import { Logo } from '../../components/layout/Logo'

const LINKS = [
  { href: '#inicio', label: 'Início' },
  { href: '#beneficios', label: 'Benefícios' },
  { href: '#brinde', label: 'Brinde do mês' },
  { href: '#parceiros', label: 'Parceiros' },
  { href: '#como-funciona', label: 'Como funciona' },
]

export function PublicHeader() {
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()
  return (
    <header className="sticky top-0 z-40 bg-ink-950/85 backdrop-blur border-b border-ink-800/60">
      <div className="max-w-6xl mx-auto px-5 py-3.5 flex items-center justify-between">
        <Logo size="sm" />
        <nav className="hidden lg:flex items-center gap-7 text-sm text-white/70">
          {LINKS.map((l) => (
            <a key={l.href} href={l.href} className="hover:text-gold-300 transition">{l.label}</a>
          ))}
        </nav>
        <div className="hidden lg:flex items-center gap-3">
          <button onClick={() => navigate('/entrar')} className="btn-ghost !px-4 !py-2 text-sm">Entrar</button>
          <button onClick={() => navigate('/cadastro')} className="btn-gold !px-4 !py-2 text-sm">Quero assinar</button>
        </div>
        <button className="lg:hidden text-white" onClick={() => setOpen(!open)}>
          {open ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>
      {open && (
        <div className="lg:hidden border-t border-ink-800 px-5 py-4 flex flex-col gap-4">
          {LINKS.map((l) => (
            <a key={l.href} href={l.href} onClick={() => setOpen(false)} className="text-white/70 text-sm">{l.label}</a>
          ))}
          <div className="flex gap-3 pt-2">
            <Link to="/entrar" className="btn-ghost flex-1 !py-2.5 text-sm">Entrar</Link>
            <Link to="/cadastro" className="btn-gold flex-1 !py-2.5 text-sm">Assinar</Link>
          </div>
        </div>
      )}
    </header>
  )
}
