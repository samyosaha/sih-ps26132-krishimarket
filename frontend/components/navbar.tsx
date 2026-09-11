"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { LanguageSwitcher } from "@/components/language-switcher";
import { NotificationBell } from "@/components/notification-bell";
import { Link, usePathname, useRouter } from "@/i18n/navigation";
import { Sprout, LogOut, Menu, X, ArrowUpRight } from "lucide-react";

function NavLink({
  href,
  label,
  active,
  onClick,
}: {
  href: string;
  label: string;
  active: boolean;
  onClick?: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className={`text-sm font-medium transition-colors hover:text-primary ${
        active ? "text-primary" : "text-muted-foreground"
      }`}
    >
      {label}
    </Link>
  );
}

export function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const t = useTranslations("nav");
  const { user, isAuthenticated, logout, isLoading } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleLogout = () => {
    logout();
    setMobileOpen(false);
    router.push("/login");
    router.refresh();
  };

  const closeMobile = () => setMobileOpen(false);

  const navLinks = isAuthenticated && !isLoading && user ? (
    user.role === "farmer" ? (
      <>
        <NavLink
          href="/farmer/lots"
          label={t("myLots")}
          active={pathname?.startsWith("/farmer/lots")}
          onClick={closeMobile}
        />
        <NavLink
          href="/farmer/offers"
          label={t("offersReceived")}
          active={pathname?.startsWith("/farmer/offers")}
          onClick={closeMobile}
        />
      </>
    ) : user.role === "admin" ? (
      <>
        <NavLink
          href="/admin/verification"
          label={t("reviewBuyers")}
          active={pathname?.startsWith("/admin/verification")}
          onClick={closeMobile}
        />
        <NavLink
          href="/admin/disputes"
          label={t("disputes")}
          active={pathname?.startsWith("/admin/disputes")}
          onClick={closeMobile}
        />
      </>
    ) : (
      <>
        <NavLink
          href="/lots"
          label={t("browseLots")}
          active={pathname?.startsWith("/lots")}
          onClick={closeMobile}
        />
        <NavLink
          href="/buyer/offers"
          label={t("myOffers")}
          active={pathname?.startsWith("/buyer/offers")}
          onClick={closeMobile}
        />
      </>
    )
  ) : null;

  const commonLinks = isAuthenticated && !isLoading && user ? (
    <>
      <NavLink
        href="/price-alerts"
        label={t("priceAlerts")}
        active={pathname === "/price-alerts"}
        onClick={closeMobile}
      />
      <NavLink
        href="/transactions"
        label={t("transactions")}
        active={pathname === "/transactions"}
        onClick={closeMobile}
      />
      {(user.role === "farmer" || user.role === "buyer") && (
        <NavLink
          href="/disputes"
          label={t("myDisputes")}
          active={pathname?.startsWith("/disputes")}
          onClick={closeMobile}
        />
      )}
      <NavLink
        href="/prices"
        label={t("priceDashboard")}
        active={pathname === "/prices"}
        onClick={closeMobile}
      />
    </>
  ) : null;

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/70 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/75">
      <div className="container mx-auto flex h-16 max-w-7xl items-center justify-between px-4">
        <div className="flex items-center gap-10">
          <Link href="/" className="flex items-center gap-2" aria-label="KrishiMarket home">
            <Sprout className="h-6 w-6 text-accent" aria-hidden="true" />
            <span className="font-display text-xl tracking-tight text-primary">
              KrishiMarket
            </span>
          </Link>

          {/* Desktop nav */}
          {isAuthenticated && !isLoading && user ? (
            <nav className="hidden items-center gap-6 md:flex" aria-label="Main navigation">
              {navLinks}
              {commonLinks}
            </nav>
          ) : (
            <nav className="hidden items-center gap-6 md:flex" aria-label="Public navigation">
              <NavLink href="/prices" label={t("marketPrices")} active={pathname === "/prices"} />
              <NavLink href="/lots" label={t("browseLots")} active={pathname?.startsWith("/lots")} />
            </nav>
          )}
        </div>

        <div className="flex items-center gap-3">
          <LanguageSwitcher />
          <ThemeToggle />
          {isAuthenticated && !isLoading && (
            <span className="hidden sm:block">
              <NotificationBell />
            </span>
          )}
          {/* Desktop auth buttons */}
          {isLoading ? null : isAuthenticated && user ? (
            <>
              <div className="hidden items-center gap-2 sm:flex">
                <span className="text-sm text-muted-foreground">
                  {t("hi", { name: user.name as string })}
                </span>
                <span
                  className={`border border-border px-2 py-0.5 text-xs font-semibold uppercase ${
                    user.role === "farmer"
                      ? "text-primary"
                      : user.role === "admin"
                      ? "text-amber-700"
                      : "text-clay"
                  }`}
                >
                  {user.role}
                </span>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleLogout}
                className="hidden gap-1.5 sm:inline-flex"
              >
                <LogOut className="h-4 w-4" aria-hidden="true" />
                <span>{t("logout")}</span>
              </Button>
            </>
          ) : (
            <div className="hidden sm:flex items-center gap-2">
              <Link href="/login" className="hidden text-sm font-medium text-muted-foreground hover:text-primary sm:inline-flex">
                {t("signIn")}
              </Link>
              <Button asChild size="sm" className="hidden gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90 sm:inline-flex">
                <Link href="/register">{t("join")} <ArrowUpRight className="h-4 w-4" /></Link>
              </Button>
            </div>
          )}

          {/* Mobile hamburger */}
          <button
            type="button"
            onClick={() => setMobileOpen(!mobileOpen)}
            className="inline-flex h-9 w-9 items-center justify-center rounded-md border text-muted-foreground transition-colors hover:bg-muted md:hidden"
            aria-label={mobileOpen ? t("closeMenu") : t("openMenu")}
            aria-expanded={mobileOpen}
          >
            {mobileOpen ? (
              <X className="h-5 w-5" aria-hidden="true" />
            ) : (
              <Menu className="h-5 w-5" aria-hidden="true" />
            )}
          </button>
        </div>
      </div>

      {/* Mobile menu panel */}
      {mobileOpen && (
        <div className="border-t bg-background md:hidden animate-in slide-in-from-top-2 duration-200">
          <nav className="container mx-auto max-w-7xl space-y-1 px-4 py-4" aria-label="Mobile navigation">
            {isAuthenticated && !isLoading && user ? (
              <>
                <div className="flex items-center gap-2 pb-3 mb-3 border-b">
                  <span className="text-sm text-muted-foreground">
                    {t("hi", { name: user.name as string })}
                  </span>
                  <span
                    className={`border border-border px-2 py-0.5 text-xs font-semibold uppercase ${
                      user.role === "farmer"
                      ? "text-primary"
                      : user.role === "admin"
                      ? "text-amber-700"
                      : "text-clay"
                    }`}
                  >
                    {user.role}
                  </span>
                </div>
                <div className="flex flex-col gap-3">
                  {navLinks}
                  {commonLinks}
                  <NavLink
                    href="/notifications"
                    label={t("notifications")}
                    active={pathname === "/notifications"}
                    onClick={closeMobile}
                  />
                  <NavLink
                    href={`/profile/${user.id}`}
                    label={t("profile")}
                    active={pathname?.startsWith("/profile/")}
                    onClick={closeMobile}
                  />
                  {user.role === "buyer" ? (
                    <NavLink
                      href="/verification"
                      label={t("verification")}
                      active={pathname?.startsWith("/verification")}
                      onClick={closeMobile}
                    />
                  ) : null}
                </div>
                <div className="border-t mt-3 pt-3">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleLogout}
                    className="w-full gap-1.5"
                  >
                    <LogOut className="h-4 w-4" aria-hidden="true" />
                    {t("logout")}
                  </Button>
                </div>
              </>
            ) : (
              <div className="flex flex-col gap-2">
                <Link href="/prices" onClick={closeMobile} className="py-2 text-sm font-medium text-muted-foreground">{t("marketPrices")}</Link>
                <Link href="/lots" onClick={closeMobile} className="py-2 text-sm font-medium text-muted-foreground">{t("browseLots")}</Link>
                <Link href="/login" onClick={closeMobile} className="py-2 text-sm font-medium text-muted-foreground">{t("signIn")}</Link>
                <Button asChild size="sm" className="justify-start bg-primary text-primary-foreground hover:bg-primary/90">
                  <Link href="/register" onClick={closeMobile}>{t("join")} <ArrowUpRight className="h-4 w-4" /></Link>
                </Button>
              </div>
            )}
          </nav>
        </div>
      )}
    </header>
  );
}