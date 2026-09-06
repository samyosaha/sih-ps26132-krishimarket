"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { BuyerRouteGuard } from "@/components/buyer-route-guard";
import { apiFetch } from "@/lib/api";
import { toast } from "sonner";
import {
  SentOffer,
  OfferStatus,
  OFFER_STATUS_STYLES,
  formatINR,
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
  Inbox,
  Sprout,
  Scale,
  Tag,
  User,
  Calendar,
  MessageSquare,
  ChevronRight,
} from "lucide-react";

type Filter = "all" | OfferStatus;

const FILTER_TABS: { key: Filter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "pending", label: "Pending" },
  { key: "accepted", label: "Accepted" },
  { key: "rejected", label: "Rejected" },
];

function BuyerOffersInner() {
  const [offers, setOffers] = useState<SentOffer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("all");

  const loadOffers = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await apiFetch<SentOffer[]>("/offers/sent");
      setOffers(data);
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Failed to load offers";
      toast.error(msg);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadOffers();
  }, [loadOffers]);

  const counts = useMemo(() => {
    const c = { all: offers.length, pending: 0, accepted: 0, rejected: 0 };
    for (const o of offers) c[o.status] += 1;
    return c;
  }, [offers]);

  const filtered = useMemo(
    () => (filter === "all" ? offers : offers.filter((o) => o.status === filter)),
    [offers, filter]
  );

  return (
    <div className="space-y-8">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">My Offers</h1>
          <p className="text-sm text-muted-foreground">
            Offers you&apos;ve sent on farmer lots.
          </p>
        </div>
        <Button asChild className="bg-emerald-600 hover:bg-emerald-700">
          <Link href="/lots">
            <Sprout className="mr-2 h-4 w-4" />
            Browse more lots
          </Link>
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="text-xs uppercase tracking-wide">
              Total offers
            </CardDescription>
            <CardTitle className="text-3xl">{counts.all}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="text-xs uppercase tracking-wide">
              Pending
            </CardDescription>
            <CardTitle className="text-3xl text-amber-600">
              {counts.pending}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="text-xs uppercase tracking-wide">
              Accepted
            </CardDescription>
            <CardTitle className="text-3xl text-emerald-600">
              {counts.accepted}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="text-xs uppercase tracking-wide">
              Rejected
            </CardDescription>
            <CardTitle className="text-3xl text-slate-500">
              {counts.rejected}
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
            <span>Loading your offers…</span>
          </div>
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Inbox className="mb-4 h-12 w-12 text-slate-300" />
            <h3 className="text-lg font-semibold">
              {filter === "all" ? "No offers sent yet" : "No matching offers"}
            </h3>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">
              {filter === "all"
                ? "Browse lots and send an offer to start trading with farmers."
                : `You don't have any ${filter} offers right now.`}
            </p>
            <Button
              asChild
              className="mt-6 bg-emerald-600 hover:bg-emerald-700"
            >
              <Link href="/lots">
                <Sprout className="mr-2 h-4 w-4" />
                Browse lots
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2">
          {filtered.map((offer) => {
            const lot = offer.lot;
            const price = offer.offered_price_per_kg ?? offer.price ?? 0;
            const quantity = lot?.quantity;
            const unit = lot?.unit ?? "kg";
            const farmerName =
              offer.farmer?.name || lot?.farmer?.name || "Farmer";
            const borderCls =
              offer.status === "pending"
                ? "border-l-4 border-l-amber-400"
                : offer.status === "accepted"
                ? "border-l-4 border-l-emerald-400"
                : "border-l-4 border-l-slate-200";
            return (
              <Card
                key={offer.id}
                className={`overflow-hidden transition-shadow hover:shadow-md ${borderCls}`}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      {lot ? (
                        <Link
                          href={`/lots/${lot.id}`}
                          className="group inline-flex items-center gap-1.5"
                        >
                          <CardTitle className="truncate text-lg group-hover:text-emerald-700">
                            {lot.title}
                          </CardTitle>
                          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-emerald-600" />
                        </Link>
                      ) : (
                        <CardTitle className="truncate text-lg">
                          Lot #{offer.lot_id}
                        </CardTitle>
                      )}
                      <CardDescription className="mt-1 inline-flex items-center gap-1 text-sm">
                        <Sprout className="h-3.5 w-3.5" />
                        {lot?.produce ||
                          lot?.commodity ||
                          "Produce"}
                        {lot?.variety ? ` · ${lot.variety}` : ""}
                      </CardDescription>
                    </div>
                    <Badge
                      variant="secondary"
                      className={`shrink-0 ${OFFER_STATUS_STYLES[offer.status]}`}
                    >
                      {offer.status.charAt(0).toUpperCase() +
                        offer.status.slice(1)}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4 pt-0">
                  <div className="flex items-center gap-4 rounded-md bg-slate-50 p-3 text-sm dark:bg-slate-900/50">
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <Tag className="h-4 w-4" />
                      <span>
                        Offered{" "}
                        <span className="font-semibold text-emerald-700">
                          {formatINR(price)}
                        </span>
                        /{unit}
                      </span>
                    </div>
                    {quantity ? (
                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        <Scale className="h-4 w-4" />
                        <span>
                          <span className="font-medium text-foreground">
                            {quantity}
                          </span>{" "}
                          {unit}
                        </span>
                        <span className="text-muted-foreground">
                          (≈ {formatINR(price * Number(quantity))})
                        </span>
                      </div>
                    ) : null}
                  </div>

                  {offer.message ? (
                    <div className="flex gap-2 rounded-md border p-3 text-sm">
                      <MessageSquare className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                      <p className="text-muted-foreground">
                        {offer.message}
                      </p>
                    </div>
                  ) : null}

                  <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t pt-3 text-xs">
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <User className="h-3.5 w-3.5" />
                      Farmer:{" "}
                      <span className="font-medium text-foreground">
                        {farmerName}
                      </span>
                    </div>
                    {offer.created_at ? (
                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        <Calendar className="h-3.5 w-3.5" />
                        {new Date(offer.created_at).toLocaleString("en-IN")}
                      </div>
                    ) : null}
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

export default function BuyerOffersPage() {
  return (
    <BuyerRouteGuard>
      <BuyerOffersInner />
    </BuyerRouteGuard>
  );
}
