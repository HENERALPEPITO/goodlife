import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "next-themes";
import { ReactNode } from "react";
import Providers from "./providers";
import { Toaster } from "@/components/ui/toaster";
import LayoutWrapper from "@/components/LayoutWrapper";
import { SpeedInsights } from "@vercel/speed-insights/next";

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "GOOD LIFE MUSIC: Cloud Workspace",
  description: "Streamlined music business dashboard",
  icons: {
    icon: "/logo.png",
    shortcut: "/logo.png",
    apple: "/logo.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning className={inter.variable}>
      <body className="antialiased"> 
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
          <Providers>
            <LayoutWrapper>
              {children}
            </LayoutWrapper>
            <Toaster />
          </Providers>
        </ThemeProvider>
        <SpeedInsights />
      </body>
    </html>
  );
}
