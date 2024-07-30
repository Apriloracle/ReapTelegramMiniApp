import { createThirdwebClient, ChainId, Celo } from "thirdweb";

// Configure the client
export const client = createThirdwebClient({
  clientId: "YOUR_CLIENT_ID_HERE", // Replace with your actual client ID

  // Configure which chains you want to support
  chains: [
    Celo,
    // Add more chains as needed, e.g.:
    // ChainId.Goerli,
    // ChainId.Polygon,
  ],

  // Configure which wallets you want to support
  supportedWallets: [
    "metamask",
    "coinbase",
    "walletConnect",
    // Add more wallet options as needed
  ],

  // Optional: Configure default chain
  defaultChain: Celo,

  // Optional: Configure dApp metadata
  dAppMeta: {
    name: "Your Telegram Mini App",
    description: "A Web3-enabled Telegram Mini App",
    logoUrl: "https://your-logo-url.com/logo.png",
    url: "https://your-app-url.com",
    isDarkMode: true, // or false, depending on your app's theme
  },
});
