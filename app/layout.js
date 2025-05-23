// app/layout.jsx
'use client'
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { SessionProvider } from "next-auth/react";
import AuthGuard from "./components/Authguard";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});


export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${
          geistMono.variable
        } antialiased`}
      >
        {/* NextAuth session context */}
        <SessionProvider>
          {/* Protect all child routes */}
          {children}
        </SessionProvider>
      </body>
    </html>
  );
}
