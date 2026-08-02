import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { QueryProvider } from "@/components/providers/QueryProvider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "PlayLiquid — Play. Watch. Compete. Create.",
  description: "YouTube + TikTok, but every piece of content is playable. Discover, play, and create interactive experiences.",
  keywords: ["PlayLiquid", "playable content", "interactive experiences", "game platform", "AI game creation"],
  authors: [{ name: "PlayLiquid" }],
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icon.png", sizes: "1024x1024", type: "image/png" },
    ],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
  openGraph: {
    title: "PlayLiquid — Play. Watch. Compete. Create.",
    description: "YouTube + TikTok, but every piece of content is playable.",
    type: "website",
    images: [{ url: "/icon.png", width: 1024, height: 1024 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "PlayLiquid",
    description: "YouTube + TikTok, but every piece of content is playable.",
    images: ["/icon.png"],
  },
};

export const viewport: Viewport = {
  themeColor: "#f59e0b",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <link rel="manifest" href="/manifest.json" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        <QueryProvider>
          {children}
          <Toaster />
          <Sonner />
        </QueryProvider>
      </body>
    </html>
  );
}
