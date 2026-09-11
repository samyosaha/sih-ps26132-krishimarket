"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { AuthenticatedRouteGuard } from "@/components/authenticated-route-guard";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, ArrowUpRight, User } from "lucide-react";
import { toast } from "sonner";
import { Link } from "@/i18n/navigation";

interface DisputeRow {
  id: number;
  transaction_id: number;
  raised_by_id: number;
  reason: string;
  status: "open" | "resolved";
  resolution_notes?: string | null;
  outcome?: string | null;
}

interface UserStub {
  id: number;
  name?: string;
}

interface TxnRow {
  id: number | string;
  lot_title?: string;
  farmer?: UserStub | null;
  buyer?: UserStub | null;
}

type FilterTab = "all" | "open" | "resolved";

function outcomeLabel(outcome: string): string {
  return outcome.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function MyDisputesInner() {
  const t = useTranslations("disputes");
  const { user } = useAuth();

  const [disputes, setDisputes] = useState<DisputeRow[]>([]);
  const [transactions, setTransactions] = useState<TxnRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterTab>("all");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [disputeData, txnData] = await Promise.all([
        apiFetch<DisputeRow[]>("/disputes"),
        apiFetch<TxnRow[]>("/transactions").catch(() => [] as TxnRow[]),
      ]);
      setDisputes(Array.isArray(disputeData) ? disputeData : []);
      setTransactions(Array.isArray(txnData) ? txnData : []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    load();
  }, [load]);

  const txnMap = useMemo(() => {
    const m = new Map<number, TxnRow>();
    for (const tx of transactions) m.set(Number(tx.id), tx);
    return m;
  }, [transactions]);

  const filtered = useMemo(
    () => (filter === "all" ? disputes : disputes.filter((d) => d.status === filter)),
    [disputes, filter],
  );

  const userId = user?.id as number | undefined;

  function getCounterparty(dispute: DisputeRow): UserStub | null {
    const tx = txnMap.get(dispute.transaction_id);
    if (!tx) return null;
    if (dispute.raised_by_id === tx.farmer?.id) return tx.buyer ?? null;
    return tx.farmer ?? null;
  }

  function getLotTitle(dispute: DisputeRow): string {
    const tx = txnMap.get(dispute.transaction_id);
    return tx?.lot_title ?? "Transaction #" + dispute.transaction_id;
  }

  const roleLabel = user?.role === "farmer" ? "Buyer" : "Farmer";

  return (
    <div className="mx-auto max-w-3xl space-y-6 py-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t("myDisputesTitle")}</h1>
        <p className="text-sm text-muted-foreground">{t("myDisputesSubtitle")}</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {(["all", "open", "resolved"] as FilterTab[]).map((f) => (
          <Button
            key={f}
            variant={filter === f ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter(f)}
          >
            {f === "all" ? t("all") : f === "open" ? t("open") : t("resolved")}
          </Button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            {t("emptyMyDisputes")}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {filtered.map((dispute) => {
            const isMyDispute = dispute.raised_by_id === userId;
            const counterparty = getCounterparty(dispute);
            const lotTitle = getLotTitle(dispute);

            return (
              <Card key={dispute.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <CardTitle className="flex flex-wrap items-center gap-2 text-base">
                        <span className="truncate">{lotTitle}</span>
                        <Link
                          href={"/transactions#txn-" + dispute.transaction_id}
                          className="inline-flex shrink-0 items-center gap-1 text-xs text-primary underline-offset-2 hover:underline"
                        >
                          <ArrowUpRight className="h-3.5 w-3.5" />
                          {t("viewTransaction")}
                        </Link>
                      </CardTitle>
                      {counterparty && (
                        <p className="mt-0.5 text-sm text-muted-foreground">
                          {roleLabel}:{" "}
                          <span className="font-medium text-foreground">
                            {counterparty.name ?? "#" + counterparty.id}
                          </span>
                        </p>
                      )}
                    </div>
                    <Badge
                      variant={dispute.status === "open" ? "secondary" : "default"}
                      className={
                        dispute.status === "resolved"
                          ? "bg-emerald-100 text-emerald-800 hover:bg-emerald-100"
                          : ""
                      }
                    >
                      {dispute.status === "open" ? t("open") : t("resolved")}
                    </Badge>
                  </div>
                </CardHeader>

                <CardContent className="space-y-3">
                  <div className="flex items-center gap-1.5 text-sm">
                    <User className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    {isMyDispute ? (
                      <span className="font-medium text-primary">{t("youRaisedThis")}</span>
                    ) : (
                      <span className="text-muted-foreground">
                        {counterparty?.name
                          ? t("otherRaisedThis", { name: counterparty.name })
                          : t("counterpartyRaisedThis")}
                      </span>
                    )}
                  </div>

                  <p className="text-sm">
                    <span className="font-medium">{t("reason")}: </span>
                    {dispute.reason}
                  </p>

                  {dispute.status === "resolved" && (
                    <div className="rounded-md border border-border bg-slate-50/60 p-3 space-y-1 dark:bg-slate-900/40">
                      {dispute.outcome && (
                        <p className="text-sm">
                          <span className="font-medium">{t("outcome")}: </span>
                          {outcomeLabel(dispute.outcome)}
                        </p>
                      )}
                      {dispute.resolution_notes && (
                        <p className="text-sm text-muted-foreground">{dispute.resolution_notes}</p>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function MyDisputesPage() {
  return (
    <AuthenticatedRouteGuard>
      <MyDisputesInner />
    </AuthenticatedRouteGuard>
  );
}