"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth, UserRole } from "@/lib/auth-context";
import { Loader2 } from "lucide-react";

interface BuyerRouteGuardProps {
  children: React.ReactNode;
}

export function BuyerRouteGuard({ children }: BuyerRouteGuardProps) {
  const router = useRouter();
  const { isAuthenticated, user, isLoading } = useAuth();

  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated) {
      router.replace("/login");
      return;
    }
    if (user?.role !== ("buyer" as UserRole)) {
      router.replace("/");
    }
  }, [isAuthenticated, user, isLoading, router]);

  if (isLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="flex items-center gap-3 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span className="text-sm">Loading…</span>
        </div>
      </div>
    );
  }

  if (!isAuthenticated || user?.role !== ("buyer" as UserRole)) {
    return null;
  }

  return <>{children}</>;
}
