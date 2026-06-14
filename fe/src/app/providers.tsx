"use client";

import { getDefaultConfig, RainbowKitProvider } from "@rainbow-me/rainbowkit";
import { WagmiProvider } from "wagmi";
import { http } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import "@rainbow-me/rainbowkit/styles.css";
import type { ReactNode } from "react";
import { mantleSepolia, mantleSepoliaRpcUrl } from "@/lib/contracts";

function requirePublicEnv(value: string | undefined, name: string) {
  if (!value) {
    throw new Error(`Missing required public env: ${name}`);
  }
  return value;
}

const config = getDefaultConfig({
  appName: "AI Arena",
  projectId: requirePublicEnv(
    process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID,
    "NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID",
  ),
  chains: [mantleSepolia],
  transports: {
    [mantleSepolia.id]: http(mantleSepoliaRpcUrl),
  },
  ssr: true,
});

const queryClient = new QueryClient();

export function Providers({ children }: { children: ReactNode }) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider>{children}</RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
