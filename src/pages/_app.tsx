import '@/styles/globals.css'
import type { AppProps } from 'next/app'
import { Web3Provider } from '@/components/Web3Provider'
import Head from 'next/head'

function MyApp({ Component, pageProps }: AppProps) {
  return (
    <>
      <Head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
      </Head>
      <Web3Provider>
        <Component {...pageProps} />
      </Web3Provider>
    </>
  )
}

export default MyApp
