"use client";

import { useLocale, useTranslations } from "next-intl";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { routing, localeNames } from "@/i18n/routing";
import { usePathname, useRouter } from "@/i18n/navigation";
import { useAuth } from "@/lib/auth-context";
import { apiFetch } from "@/lib/api";
import { Languages } from "lucide-react";

export function LanguageSwitcher() {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const t = useTranslations("language");
  const { isAuthenticated } = useAuth();

  const handleChange = (next: string) => {
    router.replace(pathname, { locale: next as (typeof routing.locales)[number] });
    if (isAuthenticated) {
      apiFetch("/auth/me/language", {
        method: "PATCH",
        body: JSON.stringify({ preferred_language: next }),
      }).catch(() => {
        // Non-blocking: language preference is stored client-side too.
      });
    }
  };

  return (
    <div className="flex items-center gap-1.5">
      <Languages className="hidden h-4 w-4 text-muted-foreground sm:block" aria-hidden="true" />
      <Select value={locale} onValueChange={handleChange}>
        <SelectTrigger
          aria-label={t("label")}
          className="h-9 w-[7.5rem] gap-1 text-xs"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {routing.locales.map((loc) => (
            <SelectItem key={loc} value={loc}>
              {localeNames[loc]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}