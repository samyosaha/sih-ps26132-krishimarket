"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { AdminRouteGuard } from "@/components/admin-route-guard";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Loader2,
  BadgeCheck,
  AlertTriangle,
  User,
  ShieldCheck,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { Link } from "@/i18n/navigation";

// ── Types ────────────────────────────────────────────────────────────

interface UnverifiedBuyer {
  id: number;
  name: string;
  email?: string | null;
  phone?: string | null;
  is_verified_buyer: boolean;
}

interface DisputeRow {
  id: number;
  transaction_id: number;
  raised_by_id: number;
  reason: string;
  status: "open" | "resolved";
  resolution_notes?: string | null;
  outcome?: string | null;
  resolved_at?: string | null;
}

type DisputeOutcome = "favor_farmer" | "favor_buyer" | "mutual" | "no_fault";

type Tab = "buyers" | "disputes";

// ── Helpers ──────────────────────────────────────────────────────────

const OUTCOME_LABELS: Record<DisputeOutcome, string> = {
  favor_farmer: "Favour Farmer",
  favor_buyer: "Favour Buyer",
  mutual: "Mutual Settlement",
  no_fault: "No Fault",
};

// ── Inner component (rendered only when role=admin) ──────────────────

function AdminPanelInner() {
  const [tab, setTab] = useState<Tab>("buyers");

  // ── Verify Buyers tab ─────────────────────────────────
  const [buyers, setBuyers] = useState<UnverifiedBuyer[]>([]);
  const [buyersLoading, setBuyersLoading] = useState(true);
  const [verifyingId, setVerifyingId] = useState<number | null>(null);

  const loadBuyers = useCallback(async () => {
    setBuyersLoading(true);
    try {
      // Fallback: derive unverified buyers from pending verification requests
      const reqs = await apiFetch<{ user_id: number; business_name: string }[]>(
        "/admin/verification-requests?status=pending"
      );
      const ids = Array.from(new Set((reqs || []).map((r) => r.user_id)));
      setBuyers(
        ids.map((id) => ({
          id,
          name: `Buyer #${id}`,
          is_verified_buyer: false,
        }))
      );
    } catch {
      toast.error("Could not load unverified buyers.");
    } finally {
      setBuyersLoading(false);
    }
  }, []);

  useEffect(() => {
    if (tab === "buyers") loadBuyers();
  }, [tab, loadBuyers]);

  const handleVerify = async (userId: number) => {
    setVerifyingId(userId);
    try {
      await apiFetch(`/admin/users/${userId}/verify`, { method: "PATCH" });
      setBuyers((prev) => prev.filter((b) => b.id !== userId));
      toast.success("Buyer verified successfully.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Verification failed.");
    } finally {
      setVerifyingId(null);
    }
  };

  // ── Disputes tab ──────────────────────────────────────
  const [disputes, setDisputes] = useState<DisputeRow[]>([]);
  const [disputesLoading, setDisputesLoading] = useState(true);
  const [activeDisputeId, setActiveDisputeId] = useState<number | null>(null);
  const [resolveNotes, setResolveNotes] = useState("");
  const [resolveOutcome, setResolveOutcome] = useState<DisputeOutcome>("mutual");

  const loadDisputes = useCallback(async () => {
    setDisputesLoading(true);
    try {
      const res = await apiFetch<DisputeRow[]>("/disputes/admin/disputes");
      setDisputes(Array.isArray(res) ? res : []);
    } catch {
      try {
        // fallback to existing admin endpoint
        const res = await apiFetch<DisputeRow[]>("/disputes/admin/all?status=open");
        setDisputes(Array.isArray(res) ? res : []);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Could not load disputes.");
      }
    } finally {
      setDisputesLoading(false);
    }
  }, []);

  useEffect(() => {
    if (tab === "disputes") loadDisputes();
  }, [tab, loadDisputes]);

  const handleResolve = async () => {
    if (!activeDisputeId || resolveNotes.trim().length < 5) return;
    try {
      await apiFetch(`/disputes/${activeDisputeId}/resolve`, {
        method: "PATCH",
        body: JSON.stringify({
          resolution_notes: resolveNotes.trim(),
          outcome: resolveOutcome,
        }),
      });
      toast.success("Dispute resolved.");
      setActiveDisputeId(null);
      setResolveNotes("");
      loadDisputes();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not resolve dispute.");
    }
  };

  // ── Render ────────────────────────────────────────────

  return (
    <div className="mx-auto max-w-4xl space-y-8 px-4 py-8 sm:px-6">
      {/* Header */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-7 w-7 text-emerald-600" />
          <h1 className="text-2xl font-bold tracking-tight">Admin Panel</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          Manage buyer verification and resolve market disputes.
        </p>
      </div>

      {/* Tab Bar */}
      <div className="flex gap-1 rounded-lg border bg-muted/40 p-1">
        <button
          type="button"
          id="admin-tab-buyers"
          onClick={() => setTab("buyers")}
          className={`flex flex-1 items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-all ${
            tab === "buyers"
              ? "bg-white shadow-sm text-emerald-700 dark:bg-card"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Users className="h-4 w-4" />
          Verify Buyers
          {buyers.length > 0 && tab !== "buyers" && (
            <span className="ml-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">
              {buyers.length}
            </span>
          )}
        </button>
        <button
          type="button"
          id="admin-tab-disputes"
          onClick={() => setTab("disputes")}
          className={`flex flex-1 items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-all ${
            tab === "disputes"
              ? "bg-white shadow-sm text-emerald-700 dark:bg-card"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <AlertTriangle className="h-4 w-4" />
          Disputes
          {disputes.length > 0 && tab !== "disputes" && (
            <span className="ml-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">
              {disputes.length}
            </span>
          )}
        </button>
      </div>

      {/* ── Tab: Verify Buyers ───────────────────────────── */}
      {tab === "buyers" && (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Buyers with pending verification requests.
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={loadBuyers}
              disabled={buyersLoading}
            >
              {buyersLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Refresh"
              )}
            </Button>
          </div>

          {buyersLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : buyers.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                <BadgeCheck className="mb-3 h-12 w-12 text-emerald-400" />
                <h3 className="text-base font-semibold">All buyers verified</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  No pending verification requests at the moment.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {buyers.map((buyer) => (
                <Card key={buyer.id}>
                  <CardContent className="flex flex-wrap items-center justify-between gap-4 p-5">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800">
                        <User className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <div>
                        <p className="font-medium leading-tight">{buyer.name}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {buyer.email ?? "—"}
                          {buyer.phone ? ` · ${buyer.phone}` : ""}
                          {" · "}ID #{buyer.id}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge
                        variant="secondary"
                        className="bg-amber-100 text-amber-800 hover:bg-amber-100"
                      >
                        Unverified
                      </Badge>
                      <Button
                        id={`verify-buyer-${buyer.id}`}
                        size="sm"
                        className="bg-emerald-600 hover:bg-emerald-700"
                        disabled={verifyingId === buyer.id}
                        onClick={() => handleVerify(buyer.id)}
                      >
                        {verifyingId === buyer.id ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <BadgeCheck className="mr-2 h-4 w-4" />
                        )}
                        Verify
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </section>
      )}

      {/* ── Tab: Disputes ────────────────────────────────── */}
      {tab === "disputes" && (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Open disputes requiring resolution.
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={loadDisputes}
              disabled={disputesLoading}
            >
              {disputesLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Refresh"
              )}
            </Button>
          </div>

          {disputesLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : disputes.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                <AlertTriangle className="mb-3 h-12 w-12 text-slate-300" />
                <h3 className="text-base font-semibold">No open disputes</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  All disputes have been resolved.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {disputes.map((dispute) => (
                <Card
                  key={dispute.id}
                  className="border-l-4 border-l-red-400"
                >
                  <CardHeader className="pb-2">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <CardTitle className="text-base">
                          Dispute #{dispute.id}
                        </CardTitle>
                        <CardDescription className="mt-0.5 text-xs">
                          Transaction #{dispute.transaction_id} · Raised by
                          User #{dispute.raised_by_id}
                        </CardDescription>
                      </div>
                      <Badge
                        variant="secondary"
                        className={
                          dispute.status === "open"
                            ? "bg-red-100 text-red-700 hover:bg-red-100"
                            : "bg-emerald-100 text-emerald-800 hover:bg-emerald-100"
                        }
                      >
                        {dispute.status === "open" ? "Open" : "Resolved"}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3 pt-0">
                    <p className="text-sm">
                      <span className="font-medium">Reason: </span>
                      {dispute.reason}
                    </p>
                    {dispute.status === "open" && (
                      <Dialog
                        open={activeDisputeId === dispute.id}
                        onOpenChange={(open) => {
                          setActiveDisputeId(open ? dispute.id : null);
                          if (!open) setResolveNotes("");
                        }}
                      >
                        <DialogTrigger asChild>
                          <Button
                            id={`resolve-dispute-${dispute.id}`}
                            size="sm"
                            className="bg-emerald-600 hover:bg-emerald-700"
                          >
                            Resolve Dispute
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-md">
                          <DialogHeader>
                            <DialogTitle>
                              Resolve Dispute #{dispute.id}
                            </DialogTitle>
                          </DialogHeader>
                          <div className="space-y-4 py-2">
                            <div className="rounded-md bg-muted/60 p-3 text-sm">
                              <span className="font-medium">Transaction #</span>
                              {dispute.transaction_id}
                              <br />
                              <span className="font-medium">Reason: </span>
                              {dispute.reason}
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor={`outcome-${dispute.id}`}>
                                Outcome
                              </Label>
                              <Select
                                value={resolveOutcome}
                                onValueChange={(v) =>
                                  setResolveOutcome(v as DisputeOutcome)
                                }
                              >
                                <SelectTrigger id={`outcome-${dispute.id}`}>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {(
                                    Object.entries(OUTCOME_LABELS) as [
                                      DisputeOutcome,
                                      string
                                    ][]
                                  ).map(([val, label]) => (
                                    <SelectItem key={val} value={val}>
                                      {label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor={`notes-${dispute.id}`}>
                                Resolution Notes
                              </Label>
                              <Textarea
                                id={`notes-${dispute.id}`}
                                value={resolveNotes}
                                onChange={(e) =>
                                  setResolveNotes(e.target.value)
                                }
                                placeholder="Describe the resolution in detail (min 5 chars)…"
                                rows={4}
                              />
                            </div>
                          </div>
                          <DialogFooter>
                            <Button
                              id={`confirm-resolve-${dispute.id}`}
                              onClick={handleResolve}
                              disabled={resolveNotes.trim().length < 5}
                              className="bg-emerald-600 hover:bg-emerald-700"
                            >
                              Confirm Resolution
                            </Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Footer nav */}
      <p className="text-center text-xs text-muted-foreground">
        <Link href="/" className="hover:underline">
          ← Back to KrishiMarket
        </Link>
        {" · "}
        <Link href="/admin/verification" className="hover:underline">
          Verification Requests
        </Link>
        {" · "}
        <Link href="/admin/disputes" className="hover:underline">
          Full Disputes Log
        </Link>
      </p>
    </div>
  );
}

// ── Page export (guarded) ─────────────────────────────────────────────

export default function AdminPage() {
  return (
    <AdminRouteGuard>
      <AdminPanelInner />
    </AdminRouteGuard>
  );
}
