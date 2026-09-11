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
      className={`relative text-sm font-medium transition-colors duration-150 ${
        active
          ? "text-primary after:absolute after:-bottom-[21px] after:left-0 after:right-0 after:h-[2px] after:rounded-full after:bg-primary"
          : "text-muted-foreground hover:text-foreground"
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
    <header className="sticky top-0 z-40 w-full border-b border-border/50 bg-background/95 backdrop-blur-md supports-[backdrop-filter]:bg-background/80">
      <div className="container mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6">
        {/* Logo + desktop nav */}
        <div className="flex items-center gap-8">
          <Link href="/" className="flex items-center gap-2 shrink-0" aria-label="KrishiMarket home">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/10">
              <Sprout className="h-4 w-4 text-primary" aria-hidden="true" />
            </div>
            <span className="font-display text-[1.05rem] font-semibold tracking-tight text-foreground">
              KrishiMarket
            </span>
          </Link>

          {/* Desktop nav */}
          {isAuthenticated && !isLoading && user ? (
            <nav className="hidden items-center gap-5 md:flex" aria-label="Main navigation">
              {navLinks}
              {commonLinks}
            </nav>
          ) : (
            <nav className="hidden items-center gap-5 md:flex" aria-label="Public navigation">
              <NavLink href="/prices" label={t("marketPrices")} active={pathname === "/prices"} />
              <NavLink href="/lots" label={t("browseLots")} active={pathname?.startsWith("/lots")} />
            </nav>
          )}
        </div>

        {/* Right side controls */}
        <div className="flex items-center gap-2">
          <LanguageSwitcher />
          <ThemeToggle />
          {isAuthenticated && !isLoading && (
            <span className="hidden sm:block">
              <NotificationBell />
            </span>
          )}

          {/* Desktop auth area */}
          {isLoading ? null : isAuthenticated && user ? (
            <div className="hidden items-center gap-2 sm:flex">
              {/* User greeting + role */}
              <div className="hidden items-center gap-2 lg:flex">
                <span className="text-sm text-muted-foreground">
                  {t("hi", { name: user.name as string })}
                </span>
                <span
                  className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                    user.role === "farmer"
                      ? "bg-primary/10 text-primary"
                      : user.role === "admin"
                      ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                      : "bg-secondary text-secondary-foreground"
                  }`}
                >
                  {user.role}
                </span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleLogout}
                className="hidden gap-1.5 text-muted-foreground hover:text-foreground sm:inline-flex"
              >
                <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
                <span className="hidden lg:inline">{t("logout")}</span>
              </Button>
            </div>
          ) : (
            <div className="hidden sm:flex items-center gap-2">
              <Link
                href="/login"
                className="hidden text-sm font-medium text-muted-foreground hover:text-foreground transition-colors sm:inline-flex"
              >
                {t("signIn")}
              </Link>
              <Button asChild size="sm" className="hidden sm:inline-flex">
                <Link href="/register">
                  {t("join")}
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </Link>
              </Button>
            </div>
          )}

          {/* Mobile hamburger */}
          <button
            type="button"
            onClick={() => setMobileOpen(!mobileOpen)}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground md:hidden"
            aria-label={mobileOpen ? t("closeMenu") : t("openMenu")}
            aria-expanded={mobileOpen}
          >
            {mobileOpen ? (
              <X className="h-4 w-4" aria-hidden="true" />
            ) : (
              <Menu className="h-4 w-4" aria-hidden="true" />
            )}
          </button>
        </div>
      </div>

      {/* Mobile menu panel */}
      {mobileOpen && (
        <div className="border-t border-border/50 bg-card md:hidden animate-in slide-in-from-top-1 duration-150">
          <nav className="container mx-auto max-w-7xl px-4 py-4 sm:px-6" aria-label="Mobile navigation">
            {isAuthenticated && !isLoading && user ? (
              <>
                {/* User info row */}
                <div className="flex items-center gap-2 pb-3 mb-3 border-b border-border/50">
                  <span className="text-sm font-medium">
                    {t("hi", { name: user.name as string })}
                  </span>
                  <span
                    className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                      user.role === "farmer"
                        ? "bg-primary/10 text-primary"
                        : user.role === "admin"
                        ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                        : "bg-secondary text-secondary-foreground"
                    }`}
                  >
                    {user.role}
                  </span>
                </div>

                {/* Nav links */}
                <div className="flex flex-col gap-0.5">
                  {[
                    ...(user.role === "farmer"
                      ? [
                          { href: "/farmer/lots", label: t("myLots"), active: pathname?.startsWith("/farmer/lots") },
                          { href: "/farmer/offers", label: t("offersReceived"), active: pathname?.startsWith("/farmer/offers") },
                        ]
                      : user.role === "admin"
                      ? [
                          { href: "/admin/verification", label: t("reviewBuyers"), active: pathname?.startsWith("/admin/verification") },
                          { href: "/admin/disputes", label: t("disputes"), active: pathname?.startsWith("/admin/disputes") },
                        ]
                      : [
                          { href: "/lots", label: t("browseLots"), active: pathname?.startsWith("/lots") },
                          { href: "/buyer/offers", label: t("myOffers"), active: pathname?.startsWith("/buyer/offers") },
                        ]),
                    { href: "/price-alerts", label: t("priceAlerts"), active: pathname === "/price-alerts" },
                    { href: "/transactions", label: t("transactions"), active: pathname === "/transactions" },
                    ...(user.role === "farmer" || user.role === "buyer"
                      ? [{ href: "/disputes", label: t("myDisputes"), active: pathname?.startsWith("/disputes") }]
                      : []),
                    { href: "/prices", label: t("priceDashboard"), active: pathname === "/prices" },
                    { href: "/notifications", label: t("notifications"), active: pathname === "/notifications" },
                    { href: `/profile/${user.id}`, label: t("profile"), active: pathname?.startsWith("/profile/") },
                    ...(user.role === "buyer"
                      ? [{ href: "/verification", label: t("verification"), active: pathname?.startsWith("/verification") }]
                      : []),
                  ].map(({ href, label, active }) => (
                    <Link
                      key={href}
                      href={href}
                      onClick={closeMobile}
                      className={`rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                        active
                          ? "bg-primary/10 text-primary"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground"
                      }`}
                    >
                      {label}
                    </Link>
                  ))}
                </div>

                {/* Logout */}
                <div className="border-t border-border/50 mt-3 pt-3">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleLogout}
                    className="w-full justify-start gap-2 text-muted-foreground hover:text-foreground"
                  >
                    <LogOut className="h-4 w-4" aria-hidden="true" />
                    {t("logout")}
                  </Button>
                </div>
              </>
            ) : (
              <div className="flex flex-col gap-0.5">
                <Link
                  href="/prices"
                  onClick={closeMobile}
                  className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  {t("marketPrices")}
                </Link>
                <Link
                  href="/lots"
                  onClick={closeMobile}
                  className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  {t("browseLots")}
                </Link>
                <Link
                  href="/login"
                  onClick={closeMobile}
                  className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  {t("signIn")}
                </Link>
                <div className="pt-1">
                  <Button asChild size="sm" className="w-full justify-start">
                    <Link href="/register" onClick={closeMobile}>
                      {t("join")}
                      <ArrowUpRight className="h-3.5 w-3.5" />
                    </Link>
                  </Button>
                </div>
              </div>
            )}
          </nav>
        </div>
      )}
    </header>
  );
}