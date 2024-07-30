import '@/styles/globals.css'
import type { AppProps } from 'next/app'
import { ThirdwebProviderWrapper } from '../path/to/client'
import TelegramMiniApp from '../path/to/components/TelegramMiniApp'

function MyApp({ Component, pageProps }: AppProps) {
  return (
    <ThirdwebProviderWrapper>
      <Component {...pageProps} />
    </ThirdwebProviderWrapper>
  )
}

export default MyApp
