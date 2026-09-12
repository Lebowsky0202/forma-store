import { Component, lazy, Suspense, type ReactNode } from 'react';
import { Link, Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import Layout from '../components/Layout';
import { useAuthStore } from '../shared/store/auth';
import { EmptyState, Loading, Toast } from '../shared/ui';

const Home = lazy(() => import('../pages/HomePage'));
const Catalog = lazy(() => import('../pages/CatalogPage'));
const Product = lazy(() => import('../pages/ProductPage'));
const Cart = lazy(() => import('../pages/CartPage'));
const Favorites = lazy(() => import('../pages/FavoritesPage'));
const Checkout = lazy(() => import('../pages/CheckoutPage'));
const Success = lazy(() => import('../pages/CheckoutPage').then(module => ({ default: module.OrderSuccessPage })));
const Auth = lazy(() => import('../pages/AuthPage'));
const Profile = lazy(() => import('../pages/ProfilePage'));
const Orders = lazy(() => import('../pages/OrdersPage'));
const Info = lazy(() => import('../pages/InfoPage'));
const AdminLayout = lazy(() => import('../pages/admin/AdminLayout'));
const AdminDashboard = lazy(() => import('../pages/admin/AdminDashboard'));
const AdminProducts = lazy(() => import('../pages/admin/AdminProducts'));
const AdminCategories = lazy(() => import('../pages/admin/AdminCategories'));
const AdminOrders = lazy(() => import('../pages/admin/AdminOrders'));
const AdminUsers = lazy(() => import('../pages/admin/AdminUsers'));

function ProtectedRoute({ admin = false }: { admin?: boolean }) {
  const { user, ready } = useAuthStore();
  const location = useLocation();
  if (!ready) return <Loading label="Проверяем вход…" />;
  if (!user) return <Navigate to={`/login?redirect=${encodeURIComponent(location.pathname + location.search)}`} replace />;
  if (admin && user.role !== 'ADMIN') return <div className="container"><EmptyState title="Этот раздел для администратора" description="Ваши покупки и данные доступны в личном кабинете." href="/profile" action="Личный кабинет" /></div>;
  return <Outlet />;
}

class PageErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    if (this.state.failed) return <div className="container empty-state"><h1>Не удалось открыть страницу</h1><p>Обновите страницу и попробуйте снова.</p><button className="button" onClick={() => window.location.reload()}>Обновить страницу</button><Link className="text-link" to="/" onClick={() => this.setState({ failed: false })}>На главную</Link></div>;
    return this.props.children;
  }
}

export default function App() {
  return <PageErrorBoundary><Suspense fallback={<Loading label="Открываем страницу…" />}><Routes>
    <Route element={<Layout />}>
      <Route index element={<Home />} />
      <Route path="catalog" element={<Catalog />} />
      <Route path="catalog/:category" element={<Catalog />} />
      <Route path="search" element={<Catalog />} />
      <Route path="product/:slug" element={<Product />} />
      <Route path="cart" element={<Cart />} />
      <Route path="favorites" element={<Favorites />} />
      <Route path="login" element={<Auth key="login" />} />
      <Route path="register" element={<Auth key="register" registerMode />} />
      <Route path="info/:page" element={<Info />} />
      <Route element={<ProtectedRoute />}>
        <Route path="checkout" element={<Checkout />} />
        <Route path="order-success/:id" element={<Success />} />
        <Route path="profile" element={<Profile />} />
        <Route path="profile/orders" element={<Orders />} />
      </Route>
      <Route path="*" element={<div className="container"><EmptyState title="Кажется, вы свернули с пути" description="Такой страницы нет. В каталоге наверняка найдётся что-то интересное." /></div>} />
    </Route>
    <Route element={<ProtectedRoute admin />}><Route path="admin" element={<><AdminLayout /><Toast /></>}>
      <Route index element={<AdminDashboard />} />
      <Route path="products" element={<AdminProducts />} />
      <Route path="categories" element={<AdminCategories />} />
      <Route path="orders" element={<AdminOrders />} />
      <Route path="users" element={<AdminUsers />} />
    </Route></Route>
  </Routes></Suspense></PageErrorBoundary>;
}
