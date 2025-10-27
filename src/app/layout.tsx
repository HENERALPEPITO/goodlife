import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "next-themes";
import { ReactNode } from "react";
import Providers from "./providers";
import Topbar from "@/components/Topbar";
import Sidebar from "@/components/Sidebar";
import { Toaster } from "@/components/ui/toaster";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "GoodLife: Cloud Workspace",
  description: "Streamlined music business dashboard",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}> 
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <Providers>
            <div className="min-h-screen grid grid-cols-1 md:grid-cols-[260px_1fr]">
              <Sidebar />
              <div className="flex flex-col min-h-screen">
                <Topbar />
                <main className="p-4 md:p-6">{children}</main>
              </div>
            </div>
            <Toaster />
          </Providers>
        </ThemeProvider>
      </body>
    </html>
  );
}
