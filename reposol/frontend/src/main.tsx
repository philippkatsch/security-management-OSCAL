import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClientProvider } from '@tanstack/react-query';
import { Provider as JotaiProvider } from 'jotai';
import { queryClient } from './lib/queryClient';
import App from './App';
import './styles/global.css';
import { ToastProvider } from './components/shared/ui/ToastProvider';
import { ConfirmProvider } from './components/shared/ui/ConfirmProvider';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <JotaiProvider>
        <ConfirmProvider>
          <ToastProvider />
          <App />
        </ConfirmProvider>
      </JotaiProvider>
    </QueryClientProvider>
  </React.StrictMode>,
);
