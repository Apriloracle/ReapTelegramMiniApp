import React from 'react'
import { WagmiConfig } from 'wagmi'
import { config } from '@/utils/config'

const Web3ProviderWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <WagmiConfig config={config}>
      {children}
    </WagmiConfig>
  )
}

export default Web3ProviderWrapper
