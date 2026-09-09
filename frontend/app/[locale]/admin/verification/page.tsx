"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { apiFetch, resolveApiUrl } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Loader2, Check, X, FileText, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { Link } from "@/i18n/navigation";
import { AdminRouteGuard } from "@/components/admin-route-guard";

interface VerificationRequest {
  id: number;
  user_id: number;
  business_name: string;
  gst_number?: string | null;
  id_document_url?: string | null;
  status: "pending" | "approved" | "rejected";
  rejection_reason?: string | null;
  created_at?: string | null;
}

const STATUS_BADGE: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800 hover:bg-amber-100",
  approved: "bg-emerald-100 text-emerald-800 hover:bg-emerald-100",
  rejected: "bg-red-100 text-red-800 hover:bg-red-100",
};

type Filter = "" | "pending" | "approved" | "rejected";

function AdminVerificationInner() {
  const t = useTranslations("verifyAdmin");
  const { isAuthenticated } = useAuth();
  const [requests, setRequests] = useState<VerificationRequest[]>([]);
  const [filter, setFilter] = useState<Filter>("pending");
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState<number | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [dialogAction, setDialogAction] = useState<"approve" | "reject" | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = filter ? { status: filter } : undefined;
      const res = await apiFetch<VerificationRequest[]>("/admin/verification-requests", {
        params,
      });
      setRequests(Array.isArray(res) ? res : []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [filter, t]);

  useEffect(() => {
    if (!isAuthenticated) return;
    load();
  }, [isAuthenticated, load]);

  const performAction = async () => {
    if (!actionId || !dialogAction) return;
    try {
      await apiFetch(`/admin/verification-requests/${actionId}`, {
        method: "PATCH",
        body: JSON.stringify({
          status: dialogAction === "approve" ? "approved" : "rejected",
          rejection_reason: dialogAction === "reject" ? rejectReason.trim() : null,
        }),
      });
      toast.success(dialogAction === "approve" ? t("approvedToast") : t("rejectedToast"));
      setDialogAction(null);
      setActionId(null);
      setRejectReason("");
      load();
    } catch {
      toast.error(t("failToast"));
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6 py-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {(["pending", "approved", "rejected", ""] as Filter[]).map((f) => (
          <Button
            key={f || "all"}
            variant={filter === f ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter(f)}
            className={filter === f ? "bg-emerald-600 hover:bg-emerald-700" : ""}
          >
            {f === "" ? t("all") : f === "pending" ? t("pending") : f === "approved" ? t("approved") : t("rejected")}
          </Button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : requests.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            {t("empty")}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {requests.map((r) => (
            <Card key={r.id}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <CardTitle className="text-base">{r.business_name}</CardTitle>
                    <p className="mt-0.5 text-sm text-muted-foreground">
                      {t("applicant")} #{r.user_id}
                      {r.gst_number ? ` · ${t("gst")}: ${r.gst_number}` : ""}
                    </p>
                  </div>
                  <Badge className={`${STATUS_BADGE[r.status] ?? ""} shrink-0`}>
                    {r.status === "pending"
                      ? t("pending")
                      : r.status === "approved"
                      ? t("approved")
                      : t("rejected")}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="flex flex-wrap items-center gap-2">
                {r.id_document_url && (
                  <a
                    href={resolveApiUrl(r.id_document_url)}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary"
                  >
                    <FileText className="h-4 w-4" />
                    {t("viewDocument")}
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                )}
                {r.status === "pending" && (
                  <span className="ml-auto inline-flex gap-2">
                    <Dialog open={dialogAction === "approve" && actionId === r.id} onOpenChange={(o) => { if (!o) setDialogAction(null); }}>
                      <DialogTrigger asChild>
                        <Button
                          size="sm"
                          className="inline-flex items-center gap-1 bg-emerald-600 hover:bg-emerald-700"
                          onClick={() => {
                            setActionId(r.id);
                            setDialogAction("approve");
                          }}
                        >
                          <Check className="h-4 w-4" aria-hidden="true" />
                          {t("approve")}
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="sm:max-w-sm">
                        <DialogHeader>
                          <DialogTitle>{t("approveConfirm")}</DialogTitle>
                        </DialogHeader>
                        <DialogFooter>
                          <Button
                            onClick={performAction}
                            className="bg-emerald-600 hover:bg-emerald-700"
                          >
                            {t("approve")}
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>

                    <Dialog open={dialogAction === "reject" && actionId === r.id} onOpenChange={(o) => { if (!o) setDialogAction(null); }}>
                      <DialogTrigger asChild>
                        <Button
                          size="sm"
                          variant="outline"
                          className="inline-flex items-center gap-1 text-red-600 hover:bg-red-50"
                          onClick={() => {
                            setActionId(r.id);
                            setDialogAction("reject");
                            setRejectReason("");
                          }}
                        >
                          <X className="h-4 w-4" aria-hidden="true" />
                          {t("reject")}
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="sm:max-w-sm">
                        <DialogHeader>
                          <DialogTitle>{t("rejectConfirm")}</DialogTitle>
                          <DialogDescription>{t("rejectReason")}</DialogDescription>
                        </DialogHeader>
                        <div className="space-y-2">
                          <Label htmlFor="reject-reason">{t("rejectReason")}</Label>
                          <Input
                            id="reject-reason"
                            value={rejectReason}
                            onChange={(e) => setRejectReason(e.target.value)}
                            placeholder={t("rejectReasonPlaceholder")}
                          />
                        </div>
                        <DialogFooter>
                          <Button
                            onClick={performAction}
                            disabled={!rejectReason.trim()}
                            className="bg-red-600 hover:bg-red-700"
                          >
                            {t("reject")}
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  </span>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <p className="text-center text-xs text-muted-foreground">
        <Link href="/" className="hover:underline">
          ← KrishiMarket
        </Link>
      </p>
    </div>
  );
}

export default function AdminVerificationPage() {
  return (
    <AdminRouteGuard>
      <AdminVerificationInner />
    </AdminRouteGuard>
  );
}
