import Link from "next/link";
import { Sprout } from "lucide-react";

export function Footer() {
  return (
    <footer className="border-t bg-muted/30">
      <div className="container mx-auto flex max-w-7xl flex-col items-center gap-4 px-4 py-8 sm:flex-row sm:justify-between">
        {/* Brand */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Sprout className="h-4 w-4 text-emerald-600" />
          <span>&copy; {new Date().getFullYear()} KrishiMarket. All rights reserved.</span>
        </div>

        {/* Legal links */}
        <nav className="flex items-center gap-4 text-sm" aria-label="Footer navigation">
          <Link
            href="/privacy"
            className="text-muted-foreground transition-colors hover:text-emerald-700"
          >
            Privacy Policy
          </Link>
          <span className="text-border">·</span>
          <Link
            href="/terms"
            className="text-muted-foreground transition-colors hover:text-emerald-700"
          >
            Terms &amp; Conditions
          </Link>
        </nav>
      </div>
    </footer>
  );
}
