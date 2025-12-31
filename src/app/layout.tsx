import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { ThemeProvider } from "next-themes";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "KinsaKaBoi - Anonymous Chat",
  description: "Chat anonymously with strangers randomly. Modern anonymous chat application built with Next.js, TypeScript, and Tailwind CSS.",
  keywords: ["KinsaKaBoi", "anonymous chat", "Next.js", "TypeScript", "Tailwind CSS", "shadcn/ui", "React", "chat"],
  authors: [{ name: "KinsaKaBoi Team" }],
  icons: {
    icon: "/logo.svg",
  },
  openGraph: {
    title: "KinsaKaBoi",
    description: "Anonymous chat with strangers",
    url: "https://kinsakaboi.com",
    siteName: "KinsaKaBoi",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "KinsaKaBoi",
    description: "Anonymous chat with strangers",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
