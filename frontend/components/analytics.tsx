"use client";

import Script from "next/script";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect } from "react";

const GA_ID = process.env.NEXT_PUBLIC_GA_ID;

/* Extend window with gtag for TypeScript */
declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}

/**
 * Google Analytics component.
 *
 * - Loads the gtag.js script once (afterInteractive).
 * - Listens for client-side route changes via usePathname / useSearchParams
 *   and fires a `page_view` event on every navigation.
 * - Only renders when NEXT_PUBLIC_GA_ID is set.
 */
export function Analytics() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Track route changes
  useEffect(() => {
    if (!GA_ID || !window.gtag) return;
    const url = pathname + (searchParams?.toString() ? `?${searchParams}` : "");
    window.gtag("config", GA_ID, { page_path: url });
  }, [pathname, searchParams]);

  if (!GA_ID) return null;

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
        strategy="afterInteractive"
      />
      <Script id="google-analytics" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', '${GA_ID}', {
            page_path: window.location.pathname,
          });
        `}
      </Script>
    </>
  );
}
