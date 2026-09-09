"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Languages, Loader2 } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { cn } from "cn";

export function TranslateButton({
  text,
  sourceLang,
  className,
}: {
  text: string;
  sourceLang?: string;
  className?: string;
}) {
  const locale = useLocale();
  const t = useTranslations("translate");
  const [translated, setTranslated] = useState<string | null>(null);
  const [showTranslated, setShowTranslated] = useState(false);
  const [loading, setLoading] = useState(false);

  const trimmed = (text || "").trim();

  const toggle = async () => {
    if (showTranslated) {
      setShowTranslated(false);
      return;
    }
    if (!trimmed || loading) return;
    if (translated) {
      setShowTranslated(true);
      return;
    }
    setLoading(true);
    try {
      const res = await apiFetch<{ translated_text: string }>("/translate", {
        method: "POST",
        body: JSON.stringify({
          text: trimmed,
          source_lang: sourceLang || "en",
          target_lang: locale,
        }),
      });
      setTranslated(res.translated_text);
      setShowTranslated(true);
    } catch {
      // Translation provider may be unconfigured; keep original visible
    } finally {
      setLoading(false);
    }
  };

  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <button
        type="button"
        onClick={toggle}
        disabled={!trimmed || loading}
        className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-primary disabled:opacity-50"
      >
        {loading ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
        ) : (
          <Languages className="h-3.5 w-3.5" aria-hidden="true" />
        )}
        {showTranslated ? t("backToOriginal") : t("translate")}
      </button>
      {translated && showTranslated && (
        <span className="text-xs text-muted-foreground">{translated}</span>
      )}
    </span>
  );
}