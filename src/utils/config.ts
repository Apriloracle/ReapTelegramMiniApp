import { createConfig, http } from 'wagmi'
import { celoAlfajores, celo, mainnet } from 'wagmi/chains'
import { coinbaseWallet, injected, metaMask, walletConnect } from 'wagmi/connectors'

const walletConnectProjectId = process.env.NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID

if (!walletConnectProjectId) {
  throw new Error('You need to provide NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID env variable')
}

export const config = createConfig({
  chains: [celoAlfajores, celo, mainnet],
  transports: {
    [celoAlfajores.id]: http(),
    [celo.id]: http(),
    [mainnet.id]: http(),
  },
  connectors: [
    metaMask(),
    coinbaseWallet({ appName: 'Celo Telegram App' }),
    walletConnect({ projectId: walletConnectProjectId }),
    injected(),
  ],
})
