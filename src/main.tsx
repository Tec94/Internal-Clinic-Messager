import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import './i18n'
import './styles.css'
import { App } from './App'
import { AuthProvider } from './state/AuthContext'
import { ClinicProvider } from './state/ClinicContext'
import { MessagingProvider } from './state/MessagingContext'
import { NativePlatformProvider } from './native/NativePlatformContext'

document.documentElement.dataset.theme = 'graphite-indigo'
localStorage.setItem('clinic-theme', 'graphite-indigo')

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: false,
    },
  },
})

const requireAuth = import.meta.env.VITE_REQUIRE_AUTH !== 'false'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <NativePlatformProvider>
            <ClinicProvider>
              <MessagingProvider authEnabled={requireAuth}>
                <App requireAuth={requireAuth} />
              </MessagingProvider>
            </ClinicProvider>
          </NativePlatformProvider>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  </StrictMode>,
)
