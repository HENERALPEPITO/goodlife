import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "next-themes";
import Link from "next/link";
import { Music2 } from "lucide-react";
import { ReactNode } from "react";
import Providers from "./providers";
import Topbar from "@/components/Topbar";

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
            <aside className="hidden md:flex flex-col gap-2 border-r border-zinc-200 dark:border-zinc-800 p-4">
              <div className="flex items-center gap-2 mb-2">
                <Music2 className="h-6 w-6" />
                <span className="font-semibold">GoodLife</span>
              </div>
              <nav className="flex flex-col gap-1 text-sm">
                <Link className="px-3 py-2 rounded hover:bg-zinc-100 dark:hover:bg-zinc-900" href="/">Dashboard</Link>
                <Link className="px-3 py-2 rounded hover:bg-zinc-100 dark:hover:bg-zinc-900" href="/analytics">Analytics</Link>
                <Link className="px-3 py-2 rounded hover:bg-zinc-100 dark:hover:bg-zinc-900" href="/royalties">Royalties</Link>
                <Link className="px-3 py-2 rounded hover:bg-zinc-100 dark:hover:bg-zinc-900" href="/royalty-uploader">Royalty Uploader</Link>
                <Link className="px-3 py-2 rounded hover:bg-zinc-100 dark:hover:bg-zinc-900" href="/catalog">Catalog</Link>
                <Link className="px-3 py-2 rounded hover:bg-zinc-100 dark:hover:bg-zinc-900" href="/settings">Settings</Link>
              </nav>
              <div className="mt-auto text-xs text-zinc-500">© {new Date().getFullYear()} GoodLife</div>
            </aside>
            <div className="flex flex-col min-h-screen">
              <Topbar />
              <main className="p-4 md:p-6">{children}</main>
            </div>
          </div>
          </Providers>
        </ThemeProvider>
      </body>
    </html>
  );
}

// Topbar moved to client component
