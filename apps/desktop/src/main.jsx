import React from 'react';
import ReactDOM from 'react-dom/client';
import '@fontsource-variable/inter';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, HashRouter } from 'react-router-dom';
import App from './App.jsx';
import { AuthProvider } from './services/auth.jsx';
import { ThemeProvider } from './services/theme.jsx';
import { ToastProvider } from './components/ui/Toast.jsx';
import { ApiError } from './services/api.js';
import { UnsavedChangesProvider } from './hooks/useUnsavedChanges.jsx';
import './styles/index.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
      retry: (failureCount, error) => {
        if (error instanceof ApiError && error.status >= 400 && error.status < 500) return false;
        return failureCount < 2;
      }
    },
    mutations: { retry: false }
  }
});

// The packaged desktop app is served from file://, where path-based history rewrites
// the URL to the drive root and breaks routing; hash routing works on file:// and http.
const Router = window.location.protocol === 'file:' ? HashRouter : BrowserRouter;

// Automatically reload if a stale cached asset encounters an error after a new deployment
window.addEventListener('vite:preloadError', (event) => {
  event.preventDefault();
  window.location.reload();
});

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <ToastProvider>
          <UnsavedChangesProvider>
            <AuthProvider>
              <ThemeProvider>
                <App />
              </ThemeProvider>
            </AuthProvider>
          </UnsavedChangesProvider>
        </ToastProvider>
      </Router>
    </QueryClientProvider>
  </React.StrictMode>
);
