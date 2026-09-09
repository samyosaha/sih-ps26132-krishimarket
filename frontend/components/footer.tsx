import { getTranslations } from "next-intl/server";
import { Sprout } from "lucide-react";
import { Link } from "@/i18n/navigation";

export async function Footer() {
  const t = await getTranslations("footer");

  return (
    <footer className="border-t border-border/70 bg-primary text-primary-foreground">
      <div className="container mx-auto flex max-w-7xl flex-col items-center gap-4 px-4 py-8 sm:flex-row sm:justify-between">
        {/* Brand */}
        <div className="flex items-center gap-2 text-sm text-primary-foreground/75">
          <Sprout className="h-4 w-4 text-accent" />
          <span>{t("rights", { year: new Date().getFullYear() })}</span>
        </div>

        {/* Legal links */}
        <nav className="flex items-center gap-4 text-sm" aria-label="Footer navigation">
          <Link
            href="/privacy"
            className="text-primary-foreground/75 transition-colors hover:text-accent"
          >
            {t("privacy")}
          </Link>
          <span className="text-primary-foreground/30">·</span>
          <Link
            href="/terms"
            className="text-primary-foreground/75 transition-colors hover:text-accent"
          >
            {t("terms")}
          </Link>
        </nav>
      </div>
    </footer>
  );
}