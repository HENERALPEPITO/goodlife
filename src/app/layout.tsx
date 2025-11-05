import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "next-themes";
import { ReactNode } from "react";
import Providers from "./providers";
import Topbar from "@/components/Topbar";
import Sidebar from "@/components/Sidebar";
import { Toaster } from "@/components/ui/toaster";

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "GOOD LIFE MUSIC: Cloud Workspace",
  description: "Streamlined music business dashboard",
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
            <main className="flex h-screen bg-background text-foreground transition-colors">
              <Sidebar />
              <div className="flex-1 flex flex-col ml-64 overflow-hidden bg-background">
                <Topbar />
                <div className="flex-1 overflow-auto bg-background">
                  <section className="flex-1 overflow-auto p-8 bg-background">
                    {children}
                  </section>
                </div>
              </div>
            </main>
            <Toaster />
          </Providers>
        </ThemeProvider>
      </body>
    </html>
  );
}
