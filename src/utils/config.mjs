import { http, createConfig } from 'wagmi'
import { mainnet, sepolia, celo, celoAlfajores } from 'wagmi/chains'

export const config = createConfig({
  chains: [mainnet, sepolia, celo, celoAlfajores],
  transports: {
    [mainnet.id]: http(),
    [sepolia.id]: http(),
    [celo.id]: http(),
    [celoAlfajores.id]: http(),
  },
})