import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { SolanaProviders } from "@/components/solana/wallet-provider";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Rewired — Your AI Life Admin",
  description:
    "An autonomous AI agent that runs your life ops. Reads your email, tracks deadlines, manages your calendar, monitors your grades, and nudges you before disaster.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${geistSans.variable} ${geistMono.variable} font-sans antialiased`}
      >
        <SolanaProviders>
          {children}
        </SolanaProviders>
        <Toaster position="top-right" richColors />
      </body>
    </html>
  );
}
