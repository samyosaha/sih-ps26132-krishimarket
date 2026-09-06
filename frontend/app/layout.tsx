import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/lib/auth-context";
import { Navbar } from "@/components/navbar";
import { Toaster } from "@/components/ui/sonner";

export const metadata: Metadata = {
  title: "KrishiMarket — Farmer Market Linkage Platform",
  description:
    "Connect farmers directly with buyers. List produce, negotiate offers, check prices.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-background antialiased">
        <AuthProvider>
          <Navbar />
          <main className="container mx-auto px-4 py-6 max-w-7xl">
            {children}
          </main>
          <Toaster richColors position="top-right" />
        </AuthProvider>
      </body>
    </html>
  );
}
