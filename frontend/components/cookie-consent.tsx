"use client";

import { useEffect, useState } from "react";
import { Link } from "@/i18n/navigation";
import { Cookie, X } from "lucide-react";
import { Button } from "@/components/ui/button";

const CONSENT_KEY = "cookie_consent";

type ConsentStatus = "accepted" | "declined" | null;

export function CookieConsent() {
  const [status, setStatus] = useState<ConsentStatus>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Small delay so the banner slides in after page load
    const stored = localStorage.getItem(CONSENT_KEY) as ConsentStatus;
    if (!stored) {
      const timer = setTimeout(() => setVisible(true), 800);
      return () => clearTimeout(timer);
    }
    setStatus(stored);
  }, []);

  const handleAccept = () => {
    localStorage.setItem(CONSENT_KEY, "accepted");
    setStatus("accepted");
    setVisible(false);
  };

  const handleDecline = () => {
    localStorage.setItem(CONSENT_KEY, "declined");
    setStatus("declined");
    setVisible(false);
  };

  // Don't render if already answered
  if (status) return null;

  return (
    <div
      className={`fixed bottom-0 inset-x-0 z-50 transition-all duration-500 ease-out ${
        visible
          ? "translate-y-0 opacity-100"
          : "translate-y-full opacity-0"
      }`}
      role="dialog"
      aria-label="Cookie consent"
    >
      <div className="mx-auto max-w-5xl px-4 pb-4">
        <div className="relative overflow-hidden rounded-2xl border bg-card/95 shadow-2xl backdrop-blur-md">
          {/* Decorative gradient bar */}
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-emerald-500 via-emerald-400 to-amber-400" />

          <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:gap-6 sm:p-6">
            {/* Icon + text */}
            <div className="flex items-start gap-3 sm:items-center">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
                <Cookie className="h-5 w-5" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-semibold text-foreground">
                  We use cookies
                </p>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  We use essential cookies for authentication and session
                  management. By continuing, you agree to our{" "}
                  <Link
                    href="/privacy"
                    className="font-medium text-emerald-700 underline underline-offset-2 hover:text-emerald-800"
                  >
                    Privacy Policy
                  </Link>
                  .
                </p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex shrink-0 items-center gap-2 sm:ml-auto">
              <Button
                variant="outline"
                size="sm"
                onClick={handleDecline}
                className="text-muted-foreground"
              >
                Decline
              </Button>
              <Button
                size="sm"
                onClick={handleAccept}
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                Accept cookies
              </Button>
            </div>

            {/* Close button */}
            <button
              onClick={handleDecline}
              className="absolute right-3 top-3 rounded-full p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground sm:right-4 sm:top-4"
              aria-label="Dismiss cookie consent"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
