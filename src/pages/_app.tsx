import '@/styles/globals.css'
import type { AppProps } from 'next/app'
import { ThirdwebProviderWrapper } from '@/components/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState } from 'react'

function MyApp({ Component, pageProps }: AppProps) {
  const [queryClient] = useState(() => new QueryClient())

  return (
    <QueryClientProvider client={queryClient}>
      <ThirdwebProviderWrapper>
        <Component {...pageProps} />
      </ThirdwebProviderWrapper>
    </QueryClientProvider>
  )
}

export default MyApp
