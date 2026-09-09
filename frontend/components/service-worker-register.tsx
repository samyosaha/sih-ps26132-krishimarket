"use client";

import { useEffect } from "react";
import { syncQueue, type QueuedOp } from "@/lib/offline-queue";

export function ServiceWorkerRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // SW registration is non-critical
    });

    const onOnline = () => {
      if (!navigator.onLine) return;
      syncQueue(async (op: QueuedOp) => {
        window.dispatchEvent(new CustomEvent("krishimarket:sync", { detail: op }));
      }).catch(() => {});
    };
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, []);

  return null;
}