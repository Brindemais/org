import { Routes, Route } from 'react-router-dom'
import { RequireRole } from './components/RequireRole'
import { SubscriberShell } from './components/layout/SubscriberShell'
import { PartnerShell } from './components/layout/PartnerShell'
import { AdminShell } from './components/layout/AdminShell'

import Landing from './pages/public/Landing'
import Login from './pages/public/Login'
import Signup from './pages/public/Signup'
import NotFound from './pages/public/NotFound'
import ForgotPassword from './pages/public/ForgotPassword'
import ResetPassword from './pages/public/ResetPassword'
import Terms from './pages/public/Terms'
import Privacy from './pages/public/Privacy'

import SubscriberHome from './pages/subscriber/Home'
import SubscriberBenefits from './pages/subscriber/Benefits'
import SubscriberPickup from './pages/subscriber/Pickup'
import SubscriberWallet from './pages/subscriber/Wallet'
import SubscriberWithdraw from './pages/subscriber/Withdraw'
import SubscriberReferrals from './pages/subscriber/Referrals'
import SubscriberStore from './pages/subscriber/Store'
import SubscriberStoreOrders from './pages/subscriber/StoreOrders'
import SubscriberPartners from './pages/subscriber/Partners'
import SubscriberNotifications from './pages/subscriber/Notifications'
import SubscriberSupport from './pages/subscriber/Support'
import SubscriberProfile from './pages/subscriber/Profile'
import SubscriberSubscription from './pages/subscriber/SubscriptionCheckout'

import PartnerDashboard from './pages/partner/Dashboard'
import PartnerPickups from './pages/partner/Pickups'
import PartnerStock from './pages/partner/Stock'
import PartnerProducts from './pages/partner/Products'
import PartnerPromotions from './pages/partner/Promotions'
import PartnerHistory from './pages/partner/History'
import PartnerProfile from './pages/partner/Profile'

import AdminDashboard from './pages/admin/Dashboard'
import AdminSubscribers from './pages/admin/Subscribers'
import AdminPartners from './pages/admin/Partners'
import AdminPayments from './pages/admin/Payments'
import AdminStock from './pages/admin/Stock'
import AdminPromotions from './pages/admin/Promotions'
import AdminWithdrawals from './pages/admin/Withdrawals'
import AdminSupport from './pages/admin/Support'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/entrar" element={<Login />} />
      <Route path="/cadastro" element={<Signup />} />
      <Route path="/esqueci-senha" element={<ForgotPassword />} />
      <Route path="/redefinir-senha" element={<ResetPassword />} />
      <Route path="/termos" element={<Terms />} />
      <Route path="/privacidade" element={<Privacy />} />

      <Route
        path="/app"
        element={
          <RequireRole roles={['subscriber']}>
            <SubscriberShell />
          </RequireRole>
        }
      >
        <Route index element={<SubscriberHome />} />
        <Route path="beneficios" element={<SubscriberBenefits />} />
        <Route path="assinatura" element={<SubscriberSubscription />} />
        <Route path="retirada" element={<SubscriberPickup />} />
        <Route path="carteira" element={<SubscriberWallet />} />
        <Route path="carteira/saque" element={<SubscriberWithdraw />} />
        <Route path="indique" element={<SubscriberReferrals />} />
        <Route path="loja" element={<SubscriberStore />} />
        <Route path="loja/pedidos" element={<SubscriberStoreOrders />} />
        <Route path="parceiros" element={<SubscriberPartners />} />
        <Route path="notificacoes" element={<SubscriberNotifications />} />
        <Route path="suporte" element={<SubscriberSupport />} />
        <Route path="perfil" element={<SubscriberProfile />} />
      </Route>

      <Route
        path="/parceiro"
        element={
          <RequireRole roles={['partner']}>
            <PartnerShell />
          </RequireRole>
        }
      >
        <Route index element={<PartnerDashboard />} />
        <Route path="retiradas" element={<PartnerPickups />} />
        <Route path="estoque" element={<PartnerStock />} />
        <Route path="brindes" element={<PartnerProducts />} />
        <Route path="promocoes" element={<PartnerPromotions />} />
        <Route path="historico" element={<PartnerHistory />} />
        <Route path="perfil" element={<PartnerProfile />} />
      </Route>

      <Route
        path="/admin"
        element={
          <RequireRole roles={['admin', 'operator']}>
            <AdminShell />
          </RequireRole>
        }
      >
        <Route index element={<AdminDashboard />} />
        <Route path="assinantes" element={<AdminSubscribers />} />
        <Route path="parceiros" element={<AdminPartners />} />
        <Route path="pagamentos" element={<AdminPayments />} />
        <Route path="estoque" element={<AdminStock />} />
        <Route path="promocoes" element={<AdminPromotions />} />
        <Route path="saques" element={<AdminWithdrawals />} />
        <Route path="suporte" element={<AdminSupport />} />
      </Route>

      <Route path="*" element={<NotFound />} />
    </Routes>
  )
}
