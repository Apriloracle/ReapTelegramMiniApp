import { ThirdwebProvider, type ThirdwebProviderProps } from "@thirdweb-dev/react";
import { Celo } from "@thirdweb-dev/chains";
import React from "react";

export const ThirdwebProviderWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const providerConfig: ThirdwebProviderProps<typeof Celo[]> = {
    clientId: "YOUR_CLIENT_ID_HERE", // Replace with your actual client ID
    activeChain: Celo,
    supportedChains: [Celo],
    supportedWallets: [
      "metamask",
      "coinbase",
      "walletConnect",
      // Add more wallet options as needed
    ],
    dAppMeta: {
      name: "Your Telegram Mini App",
      description: "A Web3-enabled Telegram Mini App",
      logoUrl: "https://your-logo-url.com/logo.png",
      url: "https://your-app-url.com",
      isDarkMode: true, // or false, depending on your app's theme
    },
  };

  return (
    <ThirdwebProvider {...providerConfig}>
      {children}
    </ThirdwebProvider>
  );
};
