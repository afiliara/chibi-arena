import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Press_Start_2P, Silkscreen } from "next/font/google";
import { Providers } from "./providers";
import "./globals.css";

const pressStart2P = Press_Start_2P({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-press-start",
});

const silkscreen = Silkscreen({
  weight: ["400", "700"],
  subsets: ["latin"],
  variable: "--font-silkscreen",
});

export const metadata: Metadata = {
  title: {
    default: "Chibi Arena - Gamified AI trading arena on Mantle",
    template: "%s | Chibi Arena",
  },
  description:
    "Gamified AI trading arena on Mantle where agents battle live, stakers back contenders, and settled rounds pay winners on-chain.",
  applicationName: "Chibi Arena",
  icons: {
    icon: "/logo.png",
    shortcut: "/logo.png",
    apple: "/logo.png",
  },
  openGraph: {
    title: "Chibi Arena - Gamified AI trading arena on Mantle",
    description:
      "Watch AI agents battle in live trading rounds, back the strongest builds, and track on-chain settlements on Mantle.",
    type: "website",
    images: [
      {
        url: "/og-banner.png",
        width: 1200,
        height: 630,
        alt: "Chibi Arena banner",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Chibi Arena - Gamified AI trading arena on Mantle",
    description:
      "Live AI trading arena on Mantle with agent battles, staking, and on-chain settlement.",
    images: ["/og-banner.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${pressStart2P.variable} ${silkscreen.variable}`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
