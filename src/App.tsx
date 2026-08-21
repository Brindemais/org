import { lazy, Suspense } from 'react'
import { Routes, Route } from 'react-router-dom'
import { RequireRole } from './components/RequireRole'
import { AdminGate } from './components/AdminGate'
import { SubscriberShell } from './components/layout/SubscriberShell'
import { PartnerShell } from './components/layout/PartnerShell'
import { AdminShell } from './components/layout/AdminShell'
import { LoadingState } from './components/ui/LoadingState'

// Public pages load eagerly (landing especially — it's the entry point for most visits).
import Landing from './pages/public/Landing'
import LoginChooser from './pages/public/LoginChooser'
import SubscriberLogin from './pages/public/SubscriberLogin'
import PartnerLogin from './pages/public/PartnerLogin'
import Signup from './pages/public/Signup'
import PartnerSignup from './pages/public/PartnerSignup'
import PartnerActivate from './pages/public/PartnerActivate'
import NotFound from './pages/public/NotFound'
import ForgotPassword from './pages/public/ForgotPassword'
import ResetPassword from './pages/public/ResetPassword'
import Terms from './pages/public/Terms'
import Privacy from './pages/public/Privacy'

// Subscriber, partner and admin areas are behind auth — split into separate
// chunks so a first-time visitor never downloads code for shells they can't use.
const SubscriberHome = lazy(() => import('./pages/subscriber/Home'))
const SubscriberBenefits = lazy(() => import('./pages/subscriber/Benefits'))
const SubscriberPickup = lazy(() => import('./pages/subscriber/Pickup'))
const SubscriberWallet = lazy(() => import('./pages/subscriber/Wallet'))
const SubscriberWithdraw = lazy(() => import('./pages/subscriber/Withdraw'))
const SubscriberReferrals = lazy(() => import('./pages/subscriber/Referrals'))
const SubscriberPartners = lazy(() => import('./pages/subscriber/Partners'))
const SubscriberPartnerDetail = lazy(() => import('./pages/subscriber/PartnerDetail'))
const SubscriberNotifications = lazy(() => import('./pages/subscriber/Notifications'))
const SubscriberSupport = lazy(() => import('./pages/subscriber/Support'))
const SubscriberProfile = lazy(() => import('./pages/subscriber/Profile'))
const SubscriberSubscription = lazy(() => import('./pages/subscriber/SubscriptionCheckout'))
const SubscriberPayments = lazy(() => import('./pages/subscriber/Payments'))

const PartnerDashboard = lazy(() => import('./pages/partner/Dashboard'))
const PartnerPickups = lazy(() => import('./pages/partner/Pickups'))
const PartnerStock = lazy(() => import('./pages/partner/Stock'))
const PartnerProducts = lazy(() => import('./pages/partner/Products'))
const PartnerPromotions = lazy(() => import('./pages/partner/Promotions'))
const PartnerReservations = lazy(() => import('./pages/partner/Reservations'))
const PartnerNotifications = lazy(() => import('./pages/partner/Notifications'))
const PartnerHistory = lazy(() => import('./pages/partner/History'))
const PartnerProfile = lazy(() => import('./pages/partner/Profile'))

const AdminDashboard = lazy(() => import('./pages/admin/Dashboard'))
const AdminSubscribers = lazy(() => import('./pages/admin/Subscribers'))
const AdminReferrals = lazy(() => import('./pages/admin/Referrals'))
const AdminPartners = lazy(() => import('./pages/admin/Partners'))
const AdminPayments = lazy(() => import('./pages/admin/Payments'))
const AdminStock = lazy(() => import('./pages/admin/Stock'))
const AdminPromotions = lazy(() => import('./pages/admin/Promotions'))
const AdminWithdrawals = lazy(() => import('./pages/admin/Withdrawals'))
const AdminSupport = lazy(() => import('./pages/admin/Support'))
const AdminTeam = lazy(() => import('./pages/admin/Team'))
const AdminAuditLog = lazy(() => import('./pages/admin/AuditLog'))
const AdminFinancial = lazy(() => import('./pages/admin/Financial'))

function RouteFallback() {
  return (
    <div className="min-h-dvh flex items-center justify-center">
      <LoadingState dark label="Carregando..." />
    </div>
  )
}

export default function App() {
  return (
    <Suspense fallback={<RouteFallback />}>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/entrar" element={<LoginChooser />} />
        <Route path="/entrar/assinante" element={<SubscriberLogin />} />
        <Route path="/entrar/parceiro" element={<PartnerLogin />} />
        <Route path="/cadastro" element={<Signup />} />
        <Route path="/seja-parceiro" element={<PartnerSignup />} />
        <Route path="/parceiro/ativar" element={<PartnerActivate />} />
        <Route path="/esqueci-senha" element={<ForgotPassword />} />
        <Route path="/redefinir-senha" element={<ResetPassword />} />
        <Route path="/termos" element={<Terms />} />
        <Route path="/privacidade" element={<Privacy />} />

        <Route
          path="/app"
          element={
            <RequireRole roles={['subscriber']} loginPath="/entrar/assinante">
              <SubscriberShell />
            </RequireRole>
          }
        >
          <Route index element={<SubscriberHome />} />
          <Route path="beneficios" element={<SubscriberBenefits />} />
          <Route path="assinatura" element={<SubscriberSubscription />} />
          <Route path="pagamentos" element={<SubscriberPayments />} />
          <Route path="retirada" element={<SubscriberPickup />} />
          <Route path="carteira" element={<SubscriberWallet />} />
          <Route path="carteira/saque" element={<SubscriberWithdraw />} />
          <Route path="indique" element={<SubscriberReferrals />} />
          <Route path="parceiros" element={<SubscriberPartners />} />
          <Route path="parceiros/:id" element={<SubscriberPartnerDetail />} />
          <Route path="notificacoes" element={<SubscriberNotifications />} />
          <Route path="suporte" element={<SubscriberSupport />} />
          <Route path="perfil" element={<SubscriberProfile />} />
        </Route>

        <Route
          path="/parceiro"
          element={
            <RequireRole roles={['partner']} loginPath="/entrar/parceiro">
              <PartnerShell />
            </RequireRole>
          }
        >
          <Route index element={<PartnerDashboard />} />
          <Route path="retiradas" element={<PartnerPickups />} />
          <Route path="estoque" element={<PartnerStock />} />
          <Route path="brindes" element={<PartnerProducts />} />
          <Route path="promocoes" element={<PartnerPromotions />} />
          <Route path="reservas" element={<PartnerReservations />} />
          <Route path="notificacoes" element={<PartnerNotifications />} />
          <Route path="historico" element={<PartnerHistory />} />
          <Route path="perfil" element={<PartnerProfile />} />
        </Route>

        <Route
          path="/admin"
          element={
            <AdminGate>
              <AdminShell />
            </AdminGate>
          }
        >
          <Route index element={<AdminDashboard />} />
          <Route path="assinantes" element={<AdminSubscribers />} />
          <Route path="indicacoes" element={<AdminReferrals />} />
          <Route path="parceiros" element={<AdminPartners />} />
          <Route path="pagamentos" element={<AdminPayments />} />
          <Route path="estoque" element={<AdminStock />} />
          <Route path="promocoes" element={<AdminPromotions />} />
          <Route path="saques" element={<AdminWithdrawals />} />
          <Route path="suporte" element={<AdminSupport />} />
          <Route path="equipe" element={<AdminTeam />} />
          <Route path="auditoria" element={<AdminAuditLog />} />
          <Route path="financeiro" element={<AdminFinancial />} />
        </Route>

        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  )
}
