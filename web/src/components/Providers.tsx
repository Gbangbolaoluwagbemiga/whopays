"use client";

import * as React from "react";
import { useState, useEffect } from "react";
import {
  RainbowKitProvider,
  connectorsForWallets,
  Chain,
} from "@rainbow-me/rainbowkit";
import {
  metaMaskWallet,
  walletConnectWallet,
  rainbowWallet,
  coinbaseWallet,
  injectedWallet,
  talismanWallet,
} from "@rainbow-me/rainbowkit/wallets";
import { createConfig, WagmiProvider, http } from "wagmi";
import { celo, celoSepolia } from "wagmi/chains";
import { QueryClientProvider, QueryClient } from "@tanstack/react-query";
import "@rainbow-me/rainbowkit/styles.css";

const PROJECT_ID = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || "3fcc6b144964e578c772eccc661b369a";

const connectors = connectorsForWallets(
  [
    {
      groupName: 'Wallets',
      wallets: [
        injectedWallet,
      ],
    },
  ],
  {
    appName: 'WhoPays',
    projectId: PROJECT_ID,
  }
);

const config = createConfig({
  connectors,
  chains: [celo],
  transports: {
    [celo.id]: http("https://forno.celo.org"),
  },
  ssr: false, 
});

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000,
      retry: 2,
    },
  },
});

export function Providers({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="animate-pulse text-xl font-bold text-gray-500">
          Loading WhoPays...
        </div>
      </div>
    );
  }

  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider initialChain={celo} modalSize="compact">
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
