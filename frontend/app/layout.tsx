import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/lib/auth-context";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { CookieConsent } from "@/components/cookie-consent";
import { Analytics } from "@/components/analytics";
import { Toaster } from "@/components/ui/sonner";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://krishimarket.in";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: "#059669",
};

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "KrishiMarket — Farmer Market Linkage Platform",
    template: "%s — KrishiMarket",
  },
  description:
    "Connect farmers directly with buyers. List produce, negotiate offers, and check real-time mandi prices — all in one platform. No middlemen.",
  keywords: [
    "KrishiMarket",
    "farmer marketplace",
    "agricultural produce",
    "mandi prices",
    "farmer buyer platform",
    "farm to buyer",
    "agritech India",
    "crop prices",
  ],
  authors: [{ name: "KrishiMarket Team" }],
  creator: "KrishiMarket",
  manifest: "/manifest.json",
  openGraph: {
    type: "website",
    locale: "en_IN",
    url: siteUrl,
    siteName: "KrishiMarket",
    title: "KrishiMarket — Fair Prices for Every Harvest",
    description:
      "Connect farmers directly with buyers. List produce, negotiate offers, and check real-time mandi prices.",
    images: [
      {
        url: "/og-image.jpg",
        width: 1200,
        height: 630,
        alt: "KrishiMarket — Fair prices for every harvest. Direct from farmers to buyers.",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "KrishiMarket — Fair Prices for Every Harvest",
    description:
      "Connect farmers directly with buyers. List produce, negotiate offers, and check real-time mandi prices.",
    images: ["/og-image.jpg"],
  },
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/favicon.ico", sizes: "any" },
    ],
    apple: "/icon.svg",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.variable} font-sans min-h-screen bg-background antialiased flex flex-col`}>
        <AuthProvider>
          <Navbar />
          <main className="container mx-auto px-4 py-6 max-w-7xl flex-1">
            {children}
          </main>
          <Footer />
          <CookieConsent />
          <Analytics />
          <Toaster richColors position="top-right" />
        </AuthProvider>
      </body>
    </html>
  );
}

