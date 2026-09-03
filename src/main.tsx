import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import './index.css'
import App from './App.tsx'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Every query here is invalidated explicitly by the mutation that
      // changes its data (see the `onSuccess` handlers in lib/queries/*) —
      // so a short staleTime is safe and stops every tab switch / window
      // focus from re-fetching data that hasn't changed.
      staleTime: 60_000,
      retry: 1,
    },
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </StrictMode>,
)
