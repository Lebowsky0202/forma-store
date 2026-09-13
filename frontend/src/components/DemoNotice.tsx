import { isDemoMode } from '../shared/demo';

export default function DemoNotice({ checkout = false }: { checkout?: boolean }) {
  if (!isDemoMode) return null;
  return <aside className={`demo-notice${checkout ? ' demo-notice-checkout' : ''}`} aria-label="Демонстрационный режим">
    <strong>Демонстрационный магазин · проект для портфолио</strong>
    <span>{checkout
      ? 'Это тестовый заказ: доставка и оплата не выполняются. Указывайте вымышленные контактные данные и адрес.'
      : 'Все заказы тестовые. Доставка и оплата не выполняются. Используйте вымышленные данные.'}</span>
  </aside>;
}
