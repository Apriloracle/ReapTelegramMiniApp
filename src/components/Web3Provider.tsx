import React from 'react';
import { WagmiProvider, createConfig, http } from 'wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ConnectKitProvider, getDefaultConfig } from 'connectkit';
import { Celo } from '@thirdweb-dev/chains';
import { walletConnect } from 'wagmi/connectors';
import { ThirdwebProvider } from "@thirdweb-dev/react";

const config = createConfig(
  getDefaultConfig({
    appName: 'Celo Telegram Mini App',
    walletConnectProjectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID!,
    chains: [Celo],
    transports: {
      [Celo.chainId]: http()
    },
    connectors: [
      walletConnect({ projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID! }),
    ],
  })
);

const queryClient = new QueryClient();

export const Web3Provider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <ThirdwebProvider activeChain={Celo}>
      <WagmiProvider config={config}>
        <QueryClientProvider client={queryClient}>
          <ConnectKitProvider
            options={{
              initialChainId: 0,
              customAvatar: () => null,
              embedGoogleFonts: true,
              walletConnectCTA: 'modal',
              language: 'en-US',
            }}
          >
            {children}
          </ConnectKitProvider>
        </QueryClientProvider>
      </WagmiProvider>
    </ThirdwebProvider>
  );
};
