import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import './i18n'
import './styles.css'
import { App } from './App'
import { ClinicProvider } from './state/ClinicContext'
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

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <NativePlatformProvider>
          <ClinicProvider>
            <App />
          </ClinicProvider>
        </NativePlatformProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
)
