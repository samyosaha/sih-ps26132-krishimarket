"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Bell, CheckCheck } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { Link } from "@/i18n/navigation";

interface AppNotification {
  id: number;
  type: string;
  title: string;
  body: string;
  is_read: boolean;
  created_at?: string | null;
}

export function NotificationBell() {
  const { isAuthenticated } = useAuth();
  const t = useTranslations("notif");
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [items, setItems] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const fetchCount = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      const res = await apiFetch<{ unread_count: number }>("/notifications/unread-count");
      setUnread(res.unread_count ?? 0);
    } catch {
      // ignore
    }
  }, [isAuthenticated]);

  const fetchItems = useCallback(async () => {
    if (!isAuthenticated) return;
    setLoading(true);
    try {
      const res = await apiFetch<{
        notifications: AppNotification[];
        unread_count: number;
      }>("/notifications", {
        params: { limit: 10 },
      });
      setItems(res.notifications);
      setUnread(res.unread_count ?? 0);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) return;
    fetchCount();
    const id = window.setInterval(fetchCount, 45_000);
    return () => window.clearInterval(id);
  }, [isAuthenticated, fetchCount]);

  useEffect(() => {
    if (open) fetchItems();
  }, [open, fetchItems]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const markAllRead = async () => {
    try {
      await apiFetch("/notifications/read-all", { method: "PATCH" });
      setItems((prev) => prev.map((n) => ({ ...n, is_read: true })));
      setUnread(0);
    } catch {
      // ignore
    }
  };

  const markRead = async (id: number) => {
    apiFetch(`/notifications/${id}/read`, { method: "PATCH" }).catch(() => {});
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
    setUnread((prev) => (prev > 0 ? prev - 1 : 0));
  };

  return (
    <div className="relative" ref={panelRef}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="relative inline-flex h-9 w-9 items-center justify-center rounded-sm border border-border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        aria-label={t("title")}
      >
        <Bell className="h-4 w-4" aria-hidden="true" />
        {unread > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-destructive-foreground">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-80 rounded-md border border-border bg-popover text-popover-foreground shadow-lg">
          <div className="flex items-center justify-between border-b px-3 py-2">
            <p className="text-sm font-semibold">
              {t("title")}
              {unread > 0 && (
                <span className="ml-2 text-xs font-normal text-muted-foreground">
                  {t("unread", { count: unread })}
                </span>
              )}
            </p>
            {items.some((n) => !n.is_read) && (
              <button
                type="button"
                onClick={markAllRead}
                className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
              >
                <CheckCheck className="h-3.5 w-3.5" aria-hidden="true" />
                {t("markAll")}
              </button>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto">
            {loading ? (
              <p className="px-3 py-6 text-center text-sm text-muted-foreground">…</p>
            ) : items.length === 0 ? (
              <div className="px-3 py-6 text-center text-sm text-muted-foreground">
                {t("emptyTitle")}
              </div>
            ) : (
              items.map((n) => (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => markRead(n.id)}
                  className={`block w-full border-b px-3 py-2.5 text-left transition-colors last:border-b-0 hover:bg-muted ${
                    n.is_read ? "" : "bg-muted/40"
                  }`}
                >
                  <p className="flex items-center gap-2 text-sm font-medium">
                    {!n.is_read && (
                      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent" aria-hidden="true" />
                    )}
                    {n.title}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{n.body}</p>
                </button>
              ))
            )}
          </div>

          <div className="border-t px-3 py-2">
            <Link
              href="/notifications"
              onClick={() => setOpen(false)}
              className="text-xs font-medium text-primary hover:underline"
            >
              {t("viewAll")}
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}