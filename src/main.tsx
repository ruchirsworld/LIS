import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { MutationCache, QueryClient, QueryClientProvider } from '@tanstack/react-query'
import '@fontsource-variable/inter'
import './index.css'
import App from './App.tsx'
import { toast } from './lib/feedback'
import { getErrorMessage } from './lib/errors'
import { keepAppUpToDate } from './pwa'

// Every save, delete or approval ends in a short message — so a change that
// worked says so, and one that failed is never silent. A mutation can opt out
// with meta: { quiet: true } when its screen already says it better.
const queryClient = new QueryClient({
  mutationCache: new MutationCache({
    onSuccess: (_data, _vars, _ctx, mutation) => {
      if (!mutation.options.meta?.quiet) toast('success', 'Saved')
    },
    onError: (error, _vars, _ctx, mutation) => {
      if (!mutation.options.meta?.quiet) toast('error', getErrorMessage(error, 'That did not go through. Please try again.'))
    },
  }),
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

keepAppUpToDate()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </StrictMode>,
)
