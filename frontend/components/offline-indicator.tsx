"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { WifiOff, RefreshCw } from "lucide-react";
import { subscribeOffline } from "@/lib/offline-queue";

export function OfflineIndicator() {
  const t = useTranslations("offline");
  const [online, setOnline] = useState(true);
  const [pending, setPending] = useState(0);

  useEffect(() => {
    let mounted = true;
    subscribeOffline((isOnline, count) => {
      if (!mounted) return;
      setOnline(isOnline);
      setPending(count);
    }).catch(() => {
      // Dexie may be unavailable (SSR) — indicator stays hidden
    });
    return () => {
      mounted = false;
    };
  }, []);

  if (online) return null;

  return (
    <div className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2">
      <div className="flex items-center gap-2 rounded-full border border-border bg-popover px-4 py-2 text-xs shadow-lg">
        <WifiOff className="h-3.5 w-3.5 text-destructive" aria-hidden="true" />
        <span>{t("offline")}</span>
        {pending > 0 && (
          <span className="inline-flex items-center gap-1 text-muted-foreground">
            <RefreshCw className="h-3 w-3" aria-hidden="true" />
            {t("syncing", { count: pending })}
          </span>
        )}
      </div>
    </div>
  );
}

export function OnlineBanner() {
  const t = useTranslations("offline");
  const [online, setOnline] = useState(true);

  useEffect(() => {
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener("online", up);
    window.addEventListener("offline", down);
    setOnline(navigator.onLine);
    return () => {
      window.removeEventListener("online", up);
      window.removeEventListener("offline", down);
    };
  }, []);

  if (online) return null;

  return (
    <div className="flex items-center justify-center gap-2 bg-amber-100 px-4 py-1.5 text-xs font-medium text-amber-800">
      <WifiOff className="h-3.5 w-3.5" aria-hidden="true" />
      {t("offline")}
    </div>
  );
}