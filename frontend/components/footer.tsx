import { getTranslations } from "next-intl/server";
import { Sprout } from "lucide-react";
import { Link } from "@/i18n/navigation";

export async function Footer() {
  const t = await getTranslations("footer");

  return (
    <footer className="border-t border-border/50 bg-card/50">
      <div className="w-full max-w-7xl mx-auto flex flex-col items-center gap-3 px-4 py-6 sm:flex-row sm:justify-between sm:px-6">
        {/* Brand */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Sprout className="h-3.5 w-3.5 text-primary/70" />
          <span>{t("rights", { year: new Date().getFullYear() })}</span>
        </div>

        {/* Legal links */}
        <nav className="flex items-center gap-4 text-xs" aria-label="Footer navigation">
          <Link
            href="/privacy"
            className="text-muted-foreground transition-colors hover:text-foreground"
          >
            {t("privacy")}
          </Link>
          <span className="text-border" aria-hidden="true">·</span>
          <Link
            href="/terms"
            className="text-muted-foreground transition-colors hover:text-foreground"
          >
            {t("terms")}
          </Link>
        </nav>
      </div>
    </footer>
  );
}