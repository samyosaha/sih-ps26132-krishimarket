import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { Bree_Serif, DM_Sans, Noto_Sans_Devanagari } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, setRequestLocale } from "next-intl/server";
import { routing } from "@/i18n/routing";
import { AuthProvider } from "@/lib/auth-context";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { CookieConsent } from "@/components/cookie-consent";
import { Analytics } from "@/components/analytics";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/components/theme-provider";
import { OfflineIndicator } from "@/components/offline-indicator";
import { ServiceWorkerRegister } from "@/components/service-worker-register";
import "./globals.css";

const dmSans = DM_Sans({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-dm-sans",
});

const breeSerif = Bree_Serif({
  subsets: ["latin"],
  weight: "400",
  display: "swap",
  variable: "--font-bree-serif",
});

const notoDevanagari = Noto_Sans_Devanagari({
  subsets: ["devanagari"],
  display: "swap",
  variable: "--font-noto-devanagari",
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://krishimarket.in";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: "#234936",
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

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode;
  params: { locale: (typeof routing.locales)[number] };
}>) {
  const locale = params.locale;
  if (!routing.locales.includes(locale)) {
    notFound();
  }
  setRequestLocale(locale);
  const messages = await getMessages();

  return (
    <html lang={locale} suppressHydrationWarning>
      <body
        className={`${dmSans.variable} ${breeSerif.variable} ${notoDevanagari.variable} font-sans min-h-screen bg-background antialiased flex flex-col`}
      >
        <ThemeProvider>
          <AuthProvider>
            <NextIntlClientProvider locale={locale} messages={messages}>
              <Navbar />
              <main className="w-full max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8 flex-1">
                {children}
              </main>
              <Footer />
              <CookieConsent />
              <Suspense fallback={null}>
                <Analytics />
              </Suspense>
              <OfflineIndicator />
              <ServiceWorkerRegister />
              <Toaster richColors position="top-right" />
            </NextIntlClientProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}