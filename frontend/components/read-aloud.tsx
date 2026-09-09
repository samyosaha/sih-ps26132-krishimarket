"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Volume2, Loader2 } from "lucide-react";
import { apiFetch, resolveApiUrl } from "@/lib/api";
import { cn } from "cn";

export function ReadAloud({
  text,
  language,
  className,
}: {
  text: string;
  language?: string;
  className?: string;
}) {
  const locale = useLocale();
  const t = useTranslations("voice");
  const [loading, setLoading] = useState(false);
  const trimmed = (text || "").trim();

  const handle = async () => {
    if (!trimmed || loading) return;
    setLoading(true);
    try {
      const res = await apiFetch<{ audio_url: string }>("/voice/tts", {
        method: "POST",
        body: JSON.stringify({
          text: trimmed,
          language: language || (locale === "mr" ? "mr" : locale === "en" ? "en" : "hi"),
        }),
      });
      if (res.audio_url) {
        const audio = new Audio(resolveApiUrl(res.audio_url));
        audio.play().catch(() => {});
      }
    } catch {
      // Voice service may be unconfigured in dev — silently ignore
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handle}
      disabled={!trimmed || loading}
      className={cn(
        "inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-primary disabled:opacity-50",
        className
      )}
      aria-label={t("readAloud")}
    >
      {loading ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
      ) : (
        <Volume2 className="h-3.5 w-3.5" aria-hidden="true" />
      )}
      {t("readAloud")}
    </button>
  );
}
