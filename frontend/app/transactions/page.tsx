"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AuthenticatedRouteGuard } from "@/components/authenticated-route-guard";
import { useAuth } from "@/lib/auth-context";
import { apiFetch } from "@/lib/api";
import { toast } from "sonner";
import {
  Transaction,
  PaymentStatus,
  PAYMENT_STATUS_STYLES,
  formatINR,
  UserRole,
} from "@/lib/market-types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
} from "lucide-react";

type Filter = "all" | PaymentStatus;

const FILTER_TABS: { key: Filter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "pending", label: "Pending Payment" },
  { key: "paid", label: "Paid" },
  { key: "delivered", label: "Delivered" },
];

function TransactionsInner() {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("all");
  const [actingId, setActingId] = useState<string | number | null>(null);

  const loadTransactions = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await apiFetch<Transaction[]>("/transactions");
      setTransactions(data);
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Failed to load transactions";
      toast.error(msg);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTransactions();
  }, [loadTransactions]);

  const counts = useMemo(() => {
    const c: Record<Filter, number> = {
      all: transactions.length,
      pending: 0,
      paid: 0,
      delivered: 0,
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
        prev.map((t) =>
          t.id === id ? { ...t, payment_status: "paid" as PaymentStatus } : t
        )
      );
      toast.success("Payment marked as completed.");
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Failed to update status";
      toast.error(msg);
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
    if (role === "buyer") return "Farmer";
    if (role === "farmer") return "Buyer";
    return "Counterparty";
  };

  const canMarkPaid = (t: Transaction) => {
    if (t.payment_status !== "pending") return false;
    const role = user?.role as UserRole | undefined;
    return role === "buyer";
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Transactions</h1>
        <p className="text-sm text-muted-foreground">
          Track every deal you&apos;re involved in.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1.5 text-xs uppercase tracking-wide">
              <Receipt className="h-3 w-3" />
              Total deals
            </CardDescription>
            <CardTitle className="text-3xl">{counts.all}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1.5 text-xs uppercase tracking-wide">
              <Banknote className="h-3 w-3" />
              Total value
            </CardDescription>
            <CardTitle className="text-2xl">
              {formatINR(counts.volume)}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="text-xs uppercase tracking-wide">
              Pending payment
            </CardDescription>
            <CardTitle className="text-3xl text-amber-600">
              {counts.pending}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="text-xs uppercase tracking-wide">
              Completed
            </CardDescription>
            <CardTitle className="text-3xl text-emerald-600">
              {counts.paid}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      <div className="flex flex-wrap gap-2 border-b">
        {FILTER_TABS.map((t) => {
          const active = filter === t.key;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setFilter(t.key)}
              className={`-mb-px border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
                active
                  ? "border-emerald-600 text-emerald-700"
                  : "border-transparent text-muted-foreground hover:text-emerald-700"
              }`}
            >
              {t.label}
              <span
                className={`ml-2 rounded-full px-2 py-0.5 text-xs ${
                  active
                    ? "bg-emerald-100 text-emerald-800"
                    : "bg-slate-100 text-slate-600"
                }`}
              >
                {counts[t.key]}
              </span>
            </button>
          );
        })}
      </div>

      {isLoading ? (
        <div className="flex min-h-[40vh] items-center justify-center">
          <div className="flex items-center gap-3 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span>Loading transactions…</span>
          </div>
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Receipt className="mb-4 h-12 w-12 text-slate-300" />
            <h3 className="text-lg font-semibold">
              {filter === "all"
                ? "No transactions yet"
                : "No matching transactions"}
            </h3>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">
              {filter === "all"
                ? "Accepted offers will appear here so you can track them end to end."
                : `There are no transactions with status "${filter}" right now.`}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {filtered.map((t) => {
            const counterparty = getCounterparty(t);
            const unit = t.unit ?? "kg";
            const lotTitle = t.lot_title ?? `Lot #${t.lot_id ?? ""}`;
            const isPending = t.payment_status === "pending";
            return (
              <Card
                key={t.id}
                className={
                  isPending
                    ? "border-l-4 border-l-amber-400"
                    : t.payment_status === "paid"
                    ? "border-l-4 border-l-emerald-400"
                    : "border-l-4 border-l-sky-400"
                }
              >
                <CardContent className="p-5">
                  <div className="grid gap-5 lg:grid-cols-[1.2fr_1fr_auto] lg:items-center">
                    <div className="space-y-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-semibold">{lotTitle}</h3>
                        <Badge
                          variant="secondary"
                          className={PAYMENT_STATUS_STYLES[t.payment_status]}
                        >
                          {t.payment_status.charAt(0).toUpperCase() +
                            t.payment_status.slice(1)}
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
                              {counterparty?.name || "Unknown"}
                            </span>
                          </span>
                        </div>
                        <div className="inline-flex items-center gap-1.5 text-muted-foreground">
                          <Scale className="h-4 w-4" />
                          <span>
                            <span className="font-medium text-foreground">
                              {t.quantity ?? "—"}
                            </span>{" "}
                            {unit} × {formatINR(t.final_price_per_kg)}
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
                        {t.created_at ? (
                          <div className="inline-flex items-center gap-1.5 text-xs text-muted-foreground sm:col-span-2">
                            <Calendar className="h-3.5 w-3.5" />
                            Created{" "}
                            {new Date(t.created_at).toLocaleString("en-IN")}
                          </div>
                        ) : null}
                      </div>
                    </div>

                    <div className="rounded-lg bg-slate-50 p-4 dark:bg-slate-900/50">
                      <div className="text-xs uppercase tracking-wide text-muted-foreground">
                        Final amount
                      </div>
                      <div className="mt-1 text-3xl font-bold text-emerald-700">
                        {t.total_amount ? formatINR(t.total_amount) : "—"}
                      </div>
                    </div>

                    <div className="flex items-center justify-end lg:justify-center">
                      {canMarkPaid(t) ? (
                        <Button
                          onClick={() => handleMarkPaid(t.id)}
                          disabled={actingId === t.id}
                          className="bg-emerald-600 hover:bg-emerald-700"
                        >
                          {actingId === t.id ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          ) : (
                            <CheckCircle2 className="mr-2 h-4 w-4" />
                          )}
                          Mark as Paid
                        </Button>
                      ) : isPending ? (
                        <span className="text-xs italic text-muted-foreground">
                          {user?.role === ("farmer" as UserRole)
                            ? "Waiting for buyer to confirm payment"
                            : "Awaiting your confirmation"}
                        </span>
                      ) : t.payment_status === "paid" ? (
                        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700">
                          <CheckCircle2 className="h-4 w-4" />
                          Payment complete
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-sky-700">
                          <CheckCircle2 className="h-4 w-4" />
                          Delivered
                        </span>
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
