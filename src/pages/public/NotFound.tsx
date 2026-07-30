import { Link } from 'react-router-dom'

export default function NotFound() {
  return (
    <div className="min-h-dvh flex flex-col items-center justify-center bg-ink-950 text-center px-5">
      <p className="font-display text-5xl font-semibold text-gold-400 mb-3">404</p>
      <p className="text-white/60 mb-6">Página não encontrada.</p>
      <Link to="/" className="btn-gold">Voltar ao início</Link>
    </div>
  )
}
