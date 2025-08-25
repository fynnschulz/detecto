// app/layout.tsx
import "./globals.css";
import { Geist, Geist_Mono } from "next/font/google";
import Providers from "@/app/providers";
import { createClient } from "@/app/lib/supbaseServer";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Server-side Supabase: read session from cookies to avoid auth flash
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();

  return (
    <html lang="de" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body className="antialiased bg-black text-white">
        {/* Providers is a client component that restores animations and sets up the browser Supabase client */}
        <Providers initialSession={session}>{children}</Providers>
      </body>
    </html>
  );
}