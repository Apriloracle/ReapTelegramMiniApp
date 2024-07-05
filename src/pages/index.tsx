import TelegramMiniApp from '@/components/TelegramMiniApp'
import Web3Provider from '@/components/Web3Provider'

export default function Home() {
  return (
    <Web3Provider>
      <main className="flex min-h-screen flex-col items-center justify-center p-0 bg-gray-100">
        <TelegramMiniApp />
      </main>
    </Web3Provider>
  )
}
