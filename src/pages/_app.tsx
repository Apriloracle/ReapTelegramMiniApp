import '@/styles/globals.css'
import type { AppProps } from 'next/app'
import { Web3Provider } from '@/components/Web3Provider'
import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'

const InitialDataFetcher = dynamic(() => import('@/components/InitialDataFetcher'), { ssr: false })
const PeerSync = dynamic(() => import('@/components/PeerSync'), { ssr: false })

function MyApp({ Component, pageProps }: AppProps) {
  const [isClient, setIsClient] = useState(false)

  useEffect(() => {
    setIsClient(true)
    console.log('App launched')
    // You can add any initialization logic here
  }, [])

  return (
    <Web3Provider>
      {isClient && (
        <>
          <InitialDataFetcher />
          <PeerSync onConnectionStatus={(status) => console.log('Connection status:', status)} />
        </>
      )}
      <Component {...pageProps} />
    </Web3Provider>
  )
}

export default MyApp
