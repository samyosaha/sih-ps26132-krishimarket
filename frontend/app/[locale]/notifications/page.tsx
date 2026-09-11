"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, BellOff, CheckCheck } from "lucide-react";
import { toast } from "sonner";
import { cn } from "cn";
import { AuthenticatedRouteGuard } from "@/components/authenticated-route-guard";

interface AppNotification {
  id: number;
  type: string;
  title: string;
  body: string;
  is_read: boolean;
  created_at?: string | null;
}

function NotificationsInner() {
  const t = useTranslations("notif");
  const { isAuthenticated, isLoading } = useAuth();
  const [items, setItems] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!isAuthenticated) return;
    setLoading(true);
    try {
      const res = await apiFetch<{ notifications: AppNotification[] }>("/notifications", {
        params: { limit: 100 },
      });
      setItems(res.notifications);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, t]);

  useEffect(() => {
    load();
  }, [load]);

  const markRead = async (id: number) => {
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
    apiFetch(`/notifications/${id}/read`, { method: "PATCH" }).catch(() => {});
  };

  const markAll = async () => {
    try {
      await apiFetch("/notifications/read-all", { method: "PATCH" });
      setItems((prev) => prev.map((n) => ({ ...n, is_read: true })));
      toast.success(t("markedRead"));
    } catch {
      // ignore
    }
  };

  const hasUnread = items.some((n) => !n.is_read);

  return (
    <div className="mx-auto max-w-2xl space-y-6 py-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
          <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
        </div>
        {hasUnread && (
          <Button variant="outline" size="sm" onClick={markAll} className="inline-flex items-center gap-1.5">
            <CheckCheck className="h-4 w-4" aria-hidden="true" />
            {t("markAll")}
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : loading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : items.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-14 text-center">
            <BellOff className="h-10 w-10 text-muted-foreground" />
            <h3 className="font-semibold">{t("emptyTitle")}</h3>
            <p className="max-w-sm text-sm text-muted-foreground">{t("emptyDesc")}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {items.map((n) => (
            <button
              key={n.id}
              type="button"
              onClick={() => markRead(n.id)}
              className={cn(
                "block w-full rounded-lg border border-border bg-card p-4 text-left transition-colors hover:bg-muted",
                !n.is_read && "border-primary/30 bg-primary/5"
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <p className="font-medium">{n.title}</p>
                {!n.is_read && (
                  <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-accent" aria-hidden="true" />
                )}
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{n.body}</p>
              {n.created_at && (
                <p className="mt-2 text-xs text-muted-foreground/70">
                  {new Date(n.created_at).toLocaleString()}
                </p>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function NotificationsPage() {
  return (
    <AuthenticatedRouteGuard>
      <NotificationsInner />
    </AuthenticatedRouteGuard>
  );
}