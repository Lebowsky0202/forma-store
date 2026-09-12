import type { ReactNode } from 'react';

export function AdminHeading({ title, text, children }: { title: string; text: string; children?: ReactNode }) {
  return <div className="adm-heading"><div><h1>{title}</h1><p>{text}</p></div>{children}</div>;
}

export function AdminError({ error }: { error: unknown }) {
  if (!error) return null;
  return <p className="adm-notice adm-error" role="alert">{error instanceof Error ? error.message : 'Не удалось выполнить запрос. Попробуйте ещё раз.'}</p>;
}

export function AdminLoading() {
  return <div className="adm-loading" role="status">Загружаем данные…</div>;
}

export function AdminEmpty({ children }: { children: ReactNode }) {
  return <div className="adm-empty">{children}</div>;
}

export function AdminPagination({ page, pages, total, onChange }: { page: number; pages: number; total: number; onChange: (value: number) => void }) {
  return <nav className="adm-pagination" aria-label="Страницы результатов">
    <span>Всего: {total} · Страница {page} из {Math.max(1, pages)}</span>
    <div><button type="button" className="adm-button adm-secondary" disabled={page <= 1} onClick={() => onChange(page - 1)}>Назад</button>
      <button type="button" className="adm-button adm-secondary" disabled={page >= pages} onClick={() => onChange(page + 1)}>Далее</button></div>
  </nav>;
}

export function FieldError({ message }: { message?: string }) {
  return message ? <span className="adm-field-error" role="alert">{message}</span> : null;
}
