import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { persistQueryClient } from '@tanstack/react-query-persist-client'
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister'
import { useState, useEffect, type ReactNode } from 'react'
import { BrowserRouter } from 'react-router-dom'
import { AuthBootstrap } from '@/app/AuthBootstrap'
import { ErrorBoundary } from '@/components/ErrorBoundary'

export function AppProviders({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            gcTime: 1000 * 60 * 60 * 24,
            retry: 1,
            refetchOnWindowFocus: false,
          },
        },
      }),
  )

  useEffect(() => {
    const [unsubscribe] = persistQueryClient({
      queryClient,
      persister: createSyncStoragePersister({
        storage: window.localStorage,
        key: 'shijian-rq-cache',
      }),
      maxAge: 1000 * 60 * 60 * 24,
    })
    return unsubscribe
  }, [queryClient])

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthBootstrap>
          <ErrorBoundary>{children}</ErrorBoundary>
        </AuthBootstrap>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
