import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Press_Start_2P, Silkscreen } from "next/font/google";
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
  title: "AI ARENA — The Ultimate AI Trading Battle",
  description: "Gamified agent trading arena",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${pressStart2P.variable} ${silkscreen.variable}`}>
        {children}
      </body>
    </html>
  );
}
