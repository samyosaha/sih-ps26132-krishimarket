"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { AuthenticatedRouteGuard } from "@/components/authenticated-route-guard";
import { useAuth } from "@/lib/auth-context";
import { apiFetch } from "@/lib/api";
import { toast } from "sonner";
import { RatingPrompt } from "@/components/rating-prompt";
import { DeliveryStatusTracker } from "@/components/delivery-status-tracker";
import { HubCheckinEvidence } from "@/components/hub-checkin-evidence";
import { DeliveryOptionsPicker } from "@/components/delivery-options-picker";
import {
  Transaction,
  PaymentStatus,
  DeliveryStatus,
  PAYMENT_STATUS_STYLES,
  formatINR,
  UserRole,
} from "@/lib/market-types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Loader2,
  Receipt,
  User,
  Scale,
  Banknote,
  Calendar,
  CheckCircle2,
  Sprout,
  ShoppingBasket,
  Truck,
  AlertTriangle,
} from "lucide-react";
import { VerifiedBadge } from "@/components/verified-badge";

type Filter = "all" | PaymentStatus;

interface DisputeRecord {
  id: number;
  transaction_id: number;
  raised_by_id: number;
  status: "open" | "resolved";
  reason: string;
}

const FILTER_TABS: { key: Filter }[] = [
  { key: "all" },
  { key: "pending" },
  { key: "paid" },
  { key: "failed" },
];

function TransactionsInner() {
  const t = useTranslations("tx");
  const tOffers = useTranslations("offers");
  const tCommon = useTranslations("common");
  const { user } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [disputes, setDisputes] = useState<DisputeRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("all");
  const [actingId, setActingId] = useState<string | number | null>(null);
  const [disputeFor, setDisputeFor] = useState<string | number | null>(null);
  const [disputeReason, setDisputeReason] = useState("");
  const [dispatchFor, setDispatchFor] = useState<string | number | null>(null);
  const [deliveryMethodInput, setDeliveryMethodInput] = useState("");
  const [rejectFor, setRejectFor] = useState<string | number | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const tabLabel = (key: Filter) =>
    key === "all"
      ? t("filterAll")
      : key === "pending"
      ? t("pendingPayment")
      : key === "paid"
      ? t("completed")
      : t("failed");

  const loadTransactions = useCallback(async () => {
    setIsLoading(true);
    try {
      const [data, disputeData] = await Promise.all([
        apiFetch<Transaction[]>("/transactions"),
        apiFetch<DisputeRecord[]>("/disputes").catch(() => [] as DisputeRecord[]),
      ]);
      setTransactions(data);
      setDisputes(Array.isArray(disputeData) ? disputeData : []);
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : t("loadFailed");
      toast.error(msg);
    } finally {
      setIsLoading(false);
    }
  }, [t]);

  useEffect(() => {
    loadTransactions();
  }, [loadTransactions]);

  const counts = useMemo(() => {
    const c: Record<Filter, number> = {
      all: transactions.length,
      pending: 0,
      paid: 0,
      failed: 0,
    };
    let volume = 0;
    for (const t of transactions) {
      c[t.payment_status] = (c[t.payment_status] || 0) + 1;
      volume += Number(t.total_amount || 0);
    }
    return { ...c, volume };
  }, [transactions]);

  const filtered = useMemo(
    () =>
      filter === "all"
        ? transactions
        : transactions.filter((t) => t.payment_status === filter),
    [transactions, filter]
  );

  const handleMarkPaid = async (id: string | number) => {
    setActingId(id);
    try {
      await apiFetch(`/transactions/${id}/payment-status`, {
        method: "PATCH",
        body: JSON.stringify({ payment_status: "paid" }),
      });
      setTransactions((prev) =>
        prev.map((row) =>
          row.id === id ? { ...row, payment_status: "paid" as PaymentStatus } : row
        )
      );
      toast.success(t("markedPaid"));
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : t("updateFailed");
      toast.error(msg);
    } finally {
      setActingId(null);
    }
  };

  const handleMarkDelivered = async (id: string | number) => {
    setActingId(id);
    try {
      const updated = await apiFetch<Transaction>(`/transactions/${id}/delivered`, {
        method: "POST",
      });
      setTransactions((prev) =>
        prev.map((row) =>
          row.id === id ? { ...row, ...updated } : row
        )
      );
      toast.success(t("markedAsDelivered"));
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : t("updateFailed");
      toast.error(msg);
    } finally {
      setActingId(null);
    }
  };

  const handleRaiseDispute = async (id: string | number) => {
    if (disputeReason.trim().length < 10) {
      toast.error(t("disputeReasonPlaceholder"));
      return;
    }
    setActingId(id);
    try {
      const created = await apiFetch<DisputeRecord>("/disputes", {
        method: "POST",
        body: JSON.stringify({
          transaction_id: Number(id),
          reason: disputeReason.trim(),
        }),
      });
      setDisputes((prev) => [created, ...prev]);
      setDisputeFor(null);
      setDisputeReason("");
      toast.success(t("disputeSubmitted"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("updateFailed"));
    } finally {
      setActingId(null);
    }
  };

  // ── Delivery state machine actions ───────────────────────────────

  const handleDispatch = async (id: string | number) => {
    if (!deliveryMethodInput.trim()) {
      toast.error(t("deliveryMethodRequired"));
      return;
    }
    setActingId(id);
    try {
      const updated = await apiFetch<Transaction>(`/transactions/${id}/dispatch`, {
        method: "POST",
        body: JSON.stringify({ delivery_method: deliveryMethodInput.trim() }),
      });
      setTransactions((prev) => prev.map((r) => (r.id === id ? { ...r, ...updated } : r)));
      setDispatchFor(null);
      setDeliveryMethodInput("");
      toast.success(t("dispatched"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("dispatchFailed"));
    } finally {
      setActingId(null);
    }
  };

  const handleDeliveryTransition = async (
    id: string | number,
    endpoint: string,
    successMsg: string,
  ) => {
    setActingId(id);
    try {
      const updated = await apiFetch<Transaction>(`/transactions/${id}/${endpoint}`, {
        method: "POST",
      });
      setTransactions((prev) => prev.map((r) => (r.id === id ? { ...r, ...updated } : r)));
      toast.success(successMsg);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("actionFailed"));
    } finally {
      setActingId(null);
    }
  };

  const handleReject = async (id: string | number) => {
    if (rejectReason.trim().length < 10) {
      toast.error(t("rejectReasonRequired"));
      return;
    }
    setActingId(id);
    try {
      const updated = await apiFetch<Transaction>(`/transactions/${id}/reject`, {
        method: "POST",
        body: JSON.stringify({ reason: rejectReason.trim() }),
      });
      setTransactions((prev) => prev.map((r) => (r.id === id ? { ...r, ...updated } : r)));
      apiFetch<DisputeRecord[]>("/disputes")
        .then((data) => setDisputes(Array.isArray(data) ? data : []))
        .catch(() => {});
      setRejectFor(null);
      setRejectReason("");
      toast.success(t("disputeRaised"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("rejectFailed"));
    } finally {
      setActingId(null);
    }
  };

  const getCounterparty = (t: Transaction) => {
    const role = user?.role as UserRole | undefined;
    if (role === "buyer") return t.farmer;
    if (role === "farmer") return t.buyer;
    return t.farmer || t.buyer;
  };

  const getCounterpartyLabel = () => {
    const role = user?.role as UserRole | undefined;
    if (role === "buyer") return t("farmerLabel");
    if (role === "farmer") return t("buyerLabel");
    return t("counterparty");
  };

  const canMarkPaid = (row: Transaction) => {
    if (row.payment_status !== "pending") return false;
    const role = user?.role as UserRole | undefined;
    return role === "buyer";
  };

  const canMarkDelivered = (row: Transaction) => {
    // The "Mark Delivered" button in this section is redundant now that
    // delivery_status drives the delivered state. Keep it hidden.
    return false;
  };

  // Scoped to current user — only returns a dispute the logged-in user themselves raised
  const myDisputeForTxn = (id: string | number) =>
    disputes.find(
      (d) => String(d.transaction_id) === String(id) && d.raised_by_id === (user?.id as number),
    );

  // Returns any dispute raised by the OTHER party on this transaction
  const counterpartyDisputeForTxn = (id: string | number) =>
    disputes.find(
      (d) => String(d.transaction_id) === String(id) && d.raised_by_id !== (user?.id as number),
    );

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1.5 text-xs uppercase tracking-wide">
              <Receipt className="h-3 w-3" />
              {t("totalDeals")}
            </CardDescription>
            <CardTitle className="text-3xl">{counts.all}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1.5 text-xs uppercase tracking-wide">
              <Banknote className="h-3 w-3" />
              {t("totalValue")}
            </CardDescription>
            <CardTitle className="text-2xl">
              {formatINR(counts.volume)}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="text-xs uppercase tracking-wide">
              {t("pendingPayment")}
            </CardDescription>
            <CardTitle className="text-3xl text-amber-600">
              {counts.pending}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="text-xs uppercase tracking-wide">
              {t("completed")}
            </CardDescription>
            <CardTitle className="text-3xl text-emerald-600">
              {counts.paid}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      <div className="flex gap-2 border-b overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0 scrollbar-hide">
        {FILTER_TABS.map((tab) => {
          const active = filter === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setFilter(tab.key)}
              className={`-mb-px whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
                active
                  ? "border-emerald-600 text-emerald-700"
                  : "border-transparent text-muted-foreground hover:text-emerald-700"
              }`}
            >
              {tabLabel(tab.key)}
              <span
                className={`ml-2 rounded-full px-2 py-0.5 text-xs ${
                  active
                    ? "bg-emerald-100 text-emerald-800"
                    : "bg-slate-100 text-slate-600"
                }`}
              >
                {counts[tab.key]}
              </span>
            </button>
          );
        })}
      </div>

      {isLoading ? (
        <div className="flex min-h-[40vh] items-center justify-center">
          <div className="flex items-center gap-3 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span>{t("loading")}</span>
          </div>
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Receipt className="mb-4 h-12 w-12 text-slate-300" />
            <h3 className="text-lg font-semibold">
              {filter === "all"
                ? t("emptyTitle")
                : t("emptyTitleFiltered")}
            </h3>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">
              {filter === "all"
                ? t("emptyDesc")
                : t("emptyDescFiltered", { filter })}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {filtered.map((item) => {
            const counterparty = getCounterparty(item);
            const unit = item.unit ?? "kg";
            const lotTitle = item.lot_title ?? `Lot #${item.lot_id ?? ""}`;
            const isPending = item.payment_status === "pending";
            const myDispute = myDisputeForTxn(item.id);
            const cpDispute = counterpartyDisputeForTxn(item.id);
            return (
              <Card
                key={item.id}
                id={`txn-${item.id}`}
                className={
                  isPending
                    ? "border-l-4 border-l-amber-400"
                    : item.payment_status === "paid"
                    ? "border-l-4 border-l-emerald-400"
                    : "border-l-4 border-l-red-400"
                }
              >
                <CardContent className="p-5">
                  {/* ── Delivery Status Tracker ─────────────────── */}
                  {item.delivery_status && (
                    <div className="mb-4 rounded-lg border border-border bg-slate-50/50 px-3 py-2 dark:bg-slate-900/30">
                      <DeliveryStatusTracker
                        status={item.delivery_status as DeliveryStatus}
                        deliveryMethod={item.delivery_method as string}
                      />
                    </div>
                  )}

                  {/* ── Hub Check-in Evidence (Verification & Mismatch) ── */}
                  <HubCheckinEvidence
                    transaction={item}
                    onOpenDispute={() => {
                      setRejectFor(item.id);
                      setRejectReason(
                        "Discrepancy observed in Hub intake verification (weight/grade mismatch)."
                      );
                    }}
                    className="mb-4"
                  />

                  <div className="grid gap-5 lg:grid-cols-[1.2fr_1fr_auto] lg:items-center">
                    <div className="space-y-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-semibold">{lotTitle}</h3>
                        <Badge
                          variant="secondary"
                          className={PAYMENT_STATUS_STYLES[item.payment_status]}
                        >
                          {item.payment_status === "pending"
                            ? tOffers("statusPending")
                            : item.payment_status === "paid"
                            ? tOffers("statusPaid")
                            : tOffers("statusFailed")}
                        </Badge>
                      </div>
                      <div className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
                        <div className="inline-flex items-center gap-1.5 text-muted-foreground">
                          {user?.role === ("buyer" as UserRole) ? (
                            <Sprout className="h-4 w-4" />
                          ) : (
                            <ShoppingBasket className="h-4 w-4" />
                          )}
                          <span>
                            {getCounterpartyLabel()}:{" "}
                           <span className="inline-flex items-center gap-1 font-medium text-foreground">
                              <User className="h-3.5 w-3.5" />
                              {counterparty?.name || tCommon("unknown")}
                              <VerifiedBadge verified={!!counterparty?.is_verified_buyer} compact />
                            </span>
                          </span>
                        </div>
                        <div className="inline-flex items-center gap-1.5 text-muted-foreground">
                          <Scale className="h-4 w-4" />
                          <span>
                            <span className="font-medium text-foreground">
                              {item.quantity ?? "—"}
                            </span>{" "}
                            {unit} × {formatINR(item.final_price_per_kg)}
                          </span>
                        </div>
                        {counterparty?.email ? (
                          <div className="text-xs text-muted-foreground sm:col-span-1">
                            {counterparty.email}
                          </div>
                        ) : null}
                        {counterparty?.phone ? (
                          <div className="text-xs text-muted-foreground sm:col-span-1">
                            {counterparty.phone}
                          </div>
                        ) : null}
                        {item.created_at ? (
                          <div className="inline-flex items-center gap-1.5 text-xs text-muted-foreground sm:col-span-2">
                            <Calendar className="h-3.5 w-3.5" />
                            {t("created", {
                              date: new Date(item.created_at).toLocaleString("en-IN"),
                            })}
                          </div>
                        ) : null}
                      </div>
                    </div>

                    <div className="rounded-lg bg-slate-50 p-4 dark:bg-slate-900/50">
                      <div className="text-xs uppercase tracking-wide text-muted-foreground">
                        {t("finalAmount")}
                      </div>
                      <div className="mt-1 text-3xl font-bold text-emerald-700">
                        {item.total_amount ? formatINR(item.total_amount) : "—"}
                      </div>
                    </div>

                    <div className="flex flex-col items-stretch gap-2 lg:min-w-[12rem]">
                      {canMarkPaid(item) ? (
                        <Button
                          onClick={() => handleMarkPaid(item.id)}
                          disabled={actingId === item.id}
                          className="bg-emerald-600 hover:bg-emerald-700"
                        >
                          {actingId === item.id ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          ) : (
                            <CheckCircle2 className="mr-2 h-4 w-4" />
                          )}
                          {t("markPaid")}
                        </Button>
                      ) : isPending ? (
                        <span className="text-xs italic text-muted-foreground">
                          {user?.role === ("farmer" as UserRole)
                            ? t("waitingBuyer")
                            : t("awaitingConfirmation")}
                        </span>
                      ) : canMarkDelivered(item) ? (
                        <Button
                          onClick={() => handleMarkDelivered(item.id)}
                          disabled={actingId === item.id}
                          className="bg-sky-600 hover:bg-sky-700"
                        >
                          {actingId === item.id ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          ) : (
                            <CheckCircle2 className="mr-2 h-4 w-4" />
                          )}
                          {t("markDelivered")}
                        </Button>
                      ) : item.payment_status === "paid" ? (
                        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700">
                          <CheckCircle2 className="h-4 w-4" />
                          {t("paymentComplete")}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-red-600">
                          <AlertTriangle className="h-4 w-4" />
                          {tOffers("statusFailed")}
                        </span>
                      )}

                      {item.delivery_status === "delivered" ? (
                        <RatingPrompt
                          transactionId={item.id}
                          rateeName={
                            (user?.role === "buyer"
                              ? item.farmer?.name
                              : item.buyer?.name) || tCommon("unknown")
                          }
                        />
                      ) : null}

                      {/* ── Delivery action buttons ───────────── */}
                      {item.delivery_status === "verified_at_hub" && (
                        <Dialog
                          open={dispatchFor === item.id}
                          onOpenChange={(open) => {
                            setDispatchFor(open ? item.id : null);
                            if (open) {
                              const savedPref =
                                typeof window !== "undefined" && item.lot_id
                                  ? localStorage.getItem(`delivery_pref_lot_${item.lot_id}`)
                                  : null;
                              setDeliveryMethodInput(savedPref || item.delivery_method && item.delivery_method !== "pending" ? (savedPref || item.delivery_method || "buyer_pickup") : "buyer_pickup");
                            } else {
                              setDeliveryMethodInput("");
                            }
                          }}
                        >
                          <DialogTrigger asChild>
                            <Button size="sm" className="bg-indigo-600 hover:bg-indigo-700 font-semibold text-white">
                              <Truck className="mr-1.5 h-3.5 w-3.5" />
                              {t("dispatch")}
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="sm:max-w-xl max-h-[85vh] overflow-y-auto">
                            <DialogHeader>
                              <DialogTitle>{t("dispatchShipmentTitle")}</DialogTitle>
                              <DialogDescription>
                                {t("dispatchShipmentDesc")}
                              </DialogDescription>
                            </DialogHeader>

                            {/* Fulfillment recommendation + selectable alternatives */}
                            {item.lot_id && (
                              <div className="py-2">
                                <DeliveryOptionsPicker
                                  lotId={item.lot_id}
                                  buyerDistrict={item.delivery_district || "Pune"}
                                  selectedMethod={deliveryMethodInput}
                                  onSelectMethod={(method) => setDeliveryMethodInput(method)}
                                />
                              </div>
                            )}

                            <div className="space-y-1.5 pt-1">
                              <Label htmlFor={`dm-${item.id}`}>{t("deliveryMethodLabel")}</Label>
                              <Input
                                id={`dm-${item.id}`}
                                value={deliveryMethodInput}
                                onChange={(e) => setDeliveryMethodInput(e.target.value)}
                                placeholder={t("deliveryMethodPlaceholder")}
                                className="bg-card"
                              />
                            </div>
                            <DialogFooter>
                              <Button
                                onClick={() => handleDispatch(item.id)}
                                disabled={actingId === item.id || !deliveryMethodInput.trim()}
                                className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold"
                              >
                                {actingId === item.id && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                {t("confirmDispatch")}
                              </Button>
                            </DialogFooter>
                          </DialogContent>
                        </Dialog>
                      )}

                      {item.delivery_status === "dispatched" && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDeliveryTransition(item.id, "in-transit", t("markedInTransit"))}
                          disabled={actingId === item.id}
                        >
                          {actingId === item.id ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Truck className="mr-1.5 h-3.5 w-3.5" />}
                          {t("markInTransit")}
                        </Button>
                      )}

                      {item.delivery_status === "in_transit" && (
                        <Button
                          size="sm"
                          className="bg-emerald-600 hover:bg-emerald-700"
                          onClick={() => handleDeliveryTransition(item.id, "delivered", t("markedAsDelivered"))}
                          disabled={actingId === item.id}
                        >
                          {actingId === item.id ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />}
                          {t("confirmDelivery")}
                        </Button>
                      )}

                      {/* Reject / Dispute — available from verified, dispatched, or in_transit */}
                      {(item.delivery_status === "verified_at_hub" ||
                        item.delivery_status === "dispatched" ||
                        item.delivery_status === "in_transit") && (
                        <Dialog
                          open={rejectFor === item.id}
                          onOpenChange={(open) => {
                            setRejectFor(open ? item.id : null);
                            if (!open) setRejectReason("");
                          }}
                        >
                          <DialogTrigger asChild>
                            <Button variant="outline" size="sm" className="border-red-200 text-red-700 hover:bg-red-50 dark:border-red-800 dark:text-red-400">
                              <AlertTriangle className="mr-1.5 h-3.5 w-3.5" />
                              {t("raiseDisputeBtn")}
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="sm:max-w-md">
                            <DialogHeader>
                              <DialogTitle>{t("raiseDispute")}</DialogTitle>
                              <DialogDescription>
                                {t("raiseDisputeDesc")}
                              </DialogDescription>
                            </DialogHeader>
                            <div className="space-y-2">
                              <Label htmlFor={`reject-${item.id}`}>{t("reasonLabel")}</Label>
                              <Textarea
                                id={`reject-${item.id}`}
                                value={rejectReason}
                                onChange={(e) => setRejectReason(e.target.value)}
                                placeholder={t("rejectReasonPlaceholder")}
                                rows={4}
                              />
                            </div>
                            <DialogFooter>
                              <Button
                                variant="destructive"
                                onClick={() => handleReject(item.id)}
                                disabled={actingId === item.id || rejectReason.trim().length < 10}
                              >
                                {actingId === item.id && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                {t("submitDispute")}
                              </Button>
                            </DialogFooter>
                          </DialogContent>
                        </Dialog>
                      )}

                      {/* My dispute badge — only for disputes THIS user raised */}
                      {myDispute ? (
                        <Badge variant="secondary">
                          {myDispute.status === "resolved"
                            ? t("disputeResolved")
                            : t("disputeOpen")}
                        </Badge>
                      ) : item.payment_status !== "pending" ? (
                        <Dialog
                          open={disputeFor === item.id}
                          onOpenChange={(open) => {
                            setDisputeFor(open ? item.id : null);
                            if (!open) setDisputeReason("");
                          }}
                        >
                          <DialogTrigger asChild>
                            <Button variant="outline" size="sm">
                              {t("raiseDispute")}
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="sm:max-w-md">
                            <DialogHeader>
                              <DialogTitle>{t("raiseDispute")}</DialogTitle>
                              <DialogDescription>{t("disputeReason")}</DialogDescription>
                            </DialogHeader>
                            <div className="space-y-2">
                              <Label htmlFor={`dispute-${item.id}`}>{t("disputeReason")}</Label>
                              <Textarea
                                id={`dispute-${item.id}`}
                                value={disputeReason}
                                onChange={(e) => setDisputeReason(e.target.value)}
                                placeholder={t("disputeReasonPlaceholder")}
                                rows={4}
                              />
                            </div>
                            <DialogFooter>
                              <Button
                                onClick={() => handleRaiseDispute(item.id)}
                                disabled={actingId === item.id || disputeReason.trim().length < 10}
                              >
                                {t("submitDispute")}
                              </Button>
                            </DialogFooter>
                          </DialogContent>
                        </Dialog>
                      ) : null}
                      {/* Counterparty dispute indicator — shown in addition to the above */}
                      {cpDispute && (
                        <Badge variant="outline" className="text-amber-700 border-amber-300">
                          {t("counterpartyDisputeOpen") ?? "Counterparty disputed"}
                        </Badge>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function TransactionsPage() {
  return (
    <AuthenticatedRouteGuard>
      <TransactionsInner />
    </AuthenticatedRouteGuard>
  );
}
