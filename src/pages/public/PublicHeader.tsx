import { Link, useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { Menu, X } from 'lucide-react'
import { Logo } from '../../components/layout/Logo'

const LINKS = [
  { href: '#inicio', label: 'Início' },
  { href: '#beneficios', label: 'Benefícios' },
  { href: '#como-funciona', label: 'Como funciona' },
  { href: '#planos', label: 'Planos' },
  { href: '#brinde', label: 'Brinde do mês' },
  { href: '#parceiros', label: 'Parceiros' },
  { href: '#loja', label: 'Loja' },
  { href: '#seja-parceiro', label: 'Quero ser parceiro' },
]

export function PublicHeader() {
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()

  // Lock body scroll while the mobile menu is open
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [open])

  return (
    <header className="safe-top sticky top-0 z-40 bg-white/90 backdrop-blur border-b border-black/10">
      <div className="max-w-content mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        <Link to="/" className="focus-ring rounded-lg shrink-0">
          <Logo size="sm" dark />
        </Link>

        <nav className="hidden xl:flex items-center gap-6 text-sm text-black/60">
          {LINKS.map((l) => (
            <a key={l.href} href={l.href} className="hover:text-gold-500 transition whitespace-nowrap">
              {l.label}
            </a>
          ))}
        </nav>

        <div className="hidden xl:flex items-center gap-2 shrink-0">
          <button onClick={() => navigate('/entrar/assinante')} className="btn-outline-light !px-3 !py-2 text-xs whitespace-nowrap">
            Login assinante
          </button>
          <button onClick={() => navigate('/entrar/parceiro')} className="btn-outline-light !px-3 !py-2 text-xs whitespace-nowrap">
            Login parceiro
          </button>
          <button onClick={() => navigate('/cadastro')} className="btn-gold !px-4 !py-2 text-sm">
            Assine agora
          </button>
        </div>

        <div className="flex xl:hidden items-center gap-2">
          <button
            className="text-ink-950 p-2 -mr-2 focus-ring rounded-lg"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-controls="mobile-menu"
            aria-label={open ? 'Fechar menu' : 'Abrir menu'}
          >
            {open ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </div>

      {open && (
        <div id="mobile-menu" className="xl:hidden border-t border-black/10 px-4 sm:px-6 py-4 flex flex-col gap-1 bg-white max-h-[calc(100dvh-4rem)] overflow-y-auto">
          {LINKS.map((l) => (
            <a
              key={l.href}
              href={l.href}
              onClick={() => setOpen(false)}
              className="text-black/70 text-sm py-3 border-b border-black/5 last:border-0"
            >
              {l.label}
            </a>
          ))}
          <div className="flex flex-col gap-2 pt-4 safe-bottom">
            <div className="flex gap-2">
              <Link to="/entrar/assinante" onClick={() => setOpen(false)} className="btn-outline-light flex-1 !py-2.5 text-sm">Login assinante</Link>
              <Link to="/entrar/parceiro" onClick={() => setOpen(false)} className="btn-outline-light flex-1 !py-2.5 text-sm">Login parceiro</Link>
            </div>
            <Link to="/cadastro" onClick={() => setOpen(false)} className="btn-gold !py-2.5 text-sm">Assinar</Link>
          </div>
        </div>
      )}
    </header>
  )
}
