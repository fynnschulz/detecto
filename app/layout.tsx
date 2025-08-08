// app/layout.tsx
"use client";

import { Geist, Geist_Mono } from "next/font/google";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState, useRef } from "react";
import "./globals.css";
import { useTranslation } from "react-i18next";
import { createBrowserSupabaseClient } from "@supabase/auth-helpers-nextjs";
import { SessionContextProvider } from "@supabase/auth-helpers-react";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});


function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const pathname = usePathname();
  const { i18n } = useTranslation();
  const [isMounted, setIsMounted] = useState(false);
  const supabaseClientRef = useRef(createBrowserSupabaseClient());
  const supabaseClient = supabaseClientRef.current;

  useEffect(() => {
    setIsMounted(true);
  }, []);

  return (
    <html lang={i18n.language} className={`${geistSans.variable} ${geistMono.variable}`}>
      <body className="antialiased bg-black text-white">
        <SessionContextProvider supabaseClient={supabaseClient}>
          <AnimatePresence mode="wait">
            <motion.div
              key={pathname}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.4, ease: "easeInOut" }}
              className="min-h-screen"
            >
              {isMounted && children}
            </motion.div>
          </AnimatePresence>
        </SessionContextProvider>
      </body>
    </html>
  );
}

export default RootLayout;