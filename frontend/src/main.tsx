import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import App from './app/App';
import { ApiError, refreshSession } from './shared/api/client';
import { useAuthStore } from './shared/store/auth';
import './styles/index.css';

const queryClient = new QueryClient({ defaultOptions: { queries: {
  staleTime: 30_000,
  retry: (count, error) => count < 1 && !(error instanceof ApiError && error.status >= 400 && error.status < 500),
  refetchOnWindowFocus: false,
} } });

void refreshSession().catch(() => useAuthStore.getState().clear());

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode><QueryClientProvider client={queryClient}><BrowserRouter><App /></BrowserRouter></QueryClientProvider></React.StrictMode>,
);
