import React from 'react';
import { WagmiProvider, createConfig, http } from 'wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ConnectKitProvider, getDefaultConfig } from 'connectkit';
import { celo } from 'wagmi/chains';
import { walletConnect } from 'wagmi/connectors';

const config = createConfig(
  getDefaultConfig({
    appName: 'Celo Telegram Mini App',
    walletConnectProjectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID!,
    chains: [celo],
    transports: {
      [celo.id]: http()
    },
    connectors: [
      walletConnect({ projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID! }),
    ],
  })
);

const queryClient = new QueryClient();

export const Web3Provider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <ConnectKitProvider
          options={{
            initialChainId: 0,
            // Disable unsupported wallets
            walletConnectName: 'WalletConnect',
            hideNoWalletCTA: true,
            hideMainnetWarning: true,
            hideRecentBadge: true,
            hideTooltips: true,
            hideQuestionMarkCTA: true,
            hideDefaultWalletWhenDelegateWalletIsConnected: true,
            embedGoogleFonts: true,
            walletConnectCTA: 'scan',
            // Customizing the modal for Telegram
            customAvatar: () => null,
            disclaimer: null,
            language: 'en-US',
            // You can add more customizations here
          }}
        >
          {children}
        </ConnectKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
};
