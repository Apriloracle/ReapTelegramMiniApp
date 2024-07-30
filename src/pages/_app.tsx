import '@/styles/globals.css'
import type { AppProps } from 'next/app'
import { ThirdwebProviderWrapper } from '@/components/client'
import TelegramMiniApp from '@/components/TelegramMiniApp'

function MyApp({ Component, pageProps }: AppProps) {
  return (
    <ThirdwebProviderWrapper>
      <Component {...pageProps} />
    </ThirdwebProviderWrapper>
  )
}

export default MyApp
