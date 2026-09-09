import Link from "next/link";
import { Sprout } from "lucide-react";

export function Footer() {
  return (
    <footer className="border-t border-border/70 bg-primary text-primary-foreground">
      <div className="container mx-auto flex max-w-7xl flex-col items-center gap-4 px-4 py-8 sm:flex-row sm:justify-between">
        {/* Brand */}
        <div className="flex items-center gap-2 text-sm text-primary-foreground/75">
          <Sprout className="h-4 w-4 text-accent" />
          <span>&copy; {new Date().getFullYear()} KrishiMarket. All rights reserved.</span>
        </div>

        {/* Legal links */}
        <nav className="flex items-center gap-4 text-sm" aria-label="Footer navigation">
          <Link
            href="/privacy"
            className="text-primary-foreground/75 transition-colors hover:text-accent"
          >
            Privacy Policy
          </Link>
          <span className="text-primary-foreground/30">·</span>
          <Link
            href="/terms"
            className="text-primary-foreground/75 transition-colors hover:text-accent"
          >
            Terms &amp; Conditions
          </Link>
        </nav>
      </div>
    </footer>
  );
}
