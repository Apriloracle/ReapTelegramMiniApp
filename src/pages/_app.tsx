import '@/styles/globals.css'
import type { AppProps } from 'next/app'
import { Web3Provider } from '@/components/Web3Provider'
import { useEffect } from 'react'
import InitialDataFetcher from '@/components/InitialDataFetcher'
import PeerSync from '@/components/PeerSync'

function MyApp({ Component, pageProps }: AppProps) {
  useEffect(() => {
    // This will run when the app launches
    console.log('App launched')
    // You can add any initialization logic here
  }, [])

  return (
    <Web3Provider>
      <InitialDataFetcher />
      <PeerSync onConnectionStatus={(status) => console.log('Connection status:', status)} />
      <Component {...pageProps} />
    </Web3Provider>
  )
}

export default MyApp
