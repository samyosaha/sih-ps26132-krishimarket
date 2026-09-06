"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Sprout, LogOut } from "lucide-react";

function NavLink({
  href,
  label,
  active,
}: {
  href: string;
  label: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={`text-sm font-medium transition-colors hover:text-emerald-700 ${
        active ? "text-emerald-700" : "text-muted-foreground"
      }`}
    >
      {label}
    </Link>
  );
}

export function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, isAuthenticated, logout, isLoading } = useAuth();

  const handleLogout = () => {
    logout();
    router.push("/login");
    router.refresh();
  };

  return (
    <header className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto flex h-16 max-w-7xl items-center justify-between px-4">
        <div className="flex items-center gap-10">
          <Link href="/" className="flex items-center gap-2">
            <Sprout className="h-6 w-6 text-emerald-600" />
            <span className="text-xl font-bold tracking-tight text-emerald-700">
              KrishiMarket
            </span>
          </Link>

          {isAuthenticated && !isLoading && user && (
            <nav className="hidden items-center gap-6 md:flex">
              {user.role === "farmer" ? (
                <>
                  <NavLink
                    href="/farmer/lots"
                    label="My Lots"
                    active={pathname?.startsWith("/farmer/lots")}
                  />
                  <NavLink
                    href="/farmer/offers"
                    label="Offers Received"
                    active={pathname?.startsWith("/farmer/offers")}
                  />
                </>
              ) : (
                <>
                  <NavLink
                    href="/lots"
                    label="Browse Lots"
                    active={pathname?.startsWith("/lots")}
                  />
                  <NavLink
                    href="/buyer/offers"
                    label="My Offers"
                    active={pathname?.startsWith("/buyer/offers")}
                  />
                </>
              )}
              <NavLink
                href="/transactions"
                label="Transactions"
                active={pathname === "/transactions"}
              />
              <NavLink
                href="/price-dashboard"
                label="Price Dashboard"
                active={pathname === "/price-dashboard"}
              />
            </nav>
          )}
        </div>

        <div className="flex items-center gap-3">
          {isLoading ? null : isAuthenticated && user ? (
            <>
              <div className="hidden items-center gap-2 sm:flex">
                <span className="text-sm text-muted-foreground">
                  Hi, <span className="font-medium text-foreground">{user.name}</span>
                </span>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-semibold uppercase ${
                    user.role === "farmer"
                      ? "bg-emerald-100 text-emerald-800"
                      : "bg-amber-100 text-amber-800"
                  }`}
                >
                  {user.role}
                </span>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleLogout}
                className="gap-1.5"
              >
                <LogOut className="h-4 w-4" />
                <span className="hidden sm:inline">Logout</span>
              </Button>
            </>
          ) : (
            <>
              <Button asChild variant="ghost" size="sm">
                <Link href="/login">Login</Link>
              </Button>
              <Button asChild size="sm" className="bg-emerald-600 hover:bg-emerald-700">
                <Link href="/register">Register</Link>
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
