import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { AuthNav } from "@/components/AuthNav";
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
  title: "GEO Archer — AI Advertising Command Center",
  description:
    "Scan a website, understand the business, and generate Google and Meta campaigns from what the site already says. Publish when you approve.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-sans">
        <AuthNav />
        {children}
      </body>
    </html>
  );
}
