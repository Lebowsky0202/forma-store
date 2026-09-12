import { NavLink, Link } from 'react-router-dom';
import { useAuthStore } from '../shared/store/auth';

export default function AccountNav() {
  const user = useAuthStore(state => state.user);
  return <nav className="account-nav" aria-label="Личный кабинет"><NavLink to="/profile" end>Мои данные</NavLink><NavLink to="/profile/orders">История заказов</NavLink><NavLink to="/favorites">Избранное</NavLink>{user?.role === 'ADMIN' && <Link to="/admin">Управление магазином ↗</Link>}</nav>;
}
