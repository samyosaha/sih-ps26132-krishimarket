"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
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
  MessageSquare,
  ChevronRight,
} from "lucide-react";

type Filter = "all" | OfferStatus;

const FILTER_TABS: { key: Filter }[] = [
  { key: "all" },
  { key: "pending" },
  { key: "accepted" },
  { key: "rejected" },
];

function BuyerOffersInner() {
  const t = useTranslations("offers.buyer");
  const tOffers = useTranslations("offers");
  const tCommon = useTranslations("common");
  const [offers, setOffers] = useState<SentOffer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("all");

  const tabLabel = (key: Filter) =>
    key === "all"
      ? tCommon("all")
      : key === "pending"
      ? tOffers("statusPending")
      : key === "accepted"
      ? tOffers("statusAccepted")
      : tOffers("statusRejected");

  const loadOffers = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await apiFetch<SentOffer[]>("/offers/sent");
      setOffers(data);
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : t("loadFailed");
      toast.error(msg);
    } finally {
      setIsLoading(false);
    }
  }, [t]);

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
          <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
          <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
        </div>
        <Button asChild className="bg-emerald-600 hover:bg-emerald-700">
          <Link href="/lots">
            <Sprout className="mr-2 h-4 w-4" />
            {t("browseMore")}
          </Link>
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="text-xs uppercase tracking-wide">
              {t("total")}
            </CardDescription>
            <CardTitle className="text-3xl">{counts.all}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="text-xs uppercase tracking-wide">
              {tOffers("statusPending")}
            </CardDescription>
            <CardTitle className="text-3xl text-amber-600">
              {counts.pending}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="text-xs uppercase tracking-wide">
              {tOffers("statusAccepted")}
            </CardDescription>
            <CardTitle className="text-3xl text-emerald-600">
              {counts.accepted}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="text-xs uppercase tracking-wide">
              {tOffers("statusRejected")}
            </CardDescription>
            <CardTitle className="text-3xl text-slate-500">
              {counts.rejected}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      <div className="flex flex-wrap gap-2 border-b">
        {FILTER_TABS.map((tab) => {
          const active = filter === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setFilter(tab.key)}
              className={`-mb-px border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
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
            <Inbox className="mb-4 h-12 w-12 text-slate-300" />
            <h3 className="text-lg font-semibold">
              {filter === "all" ? t("emptyTitle") : t("emptyTitleFiltered")}
            </h3>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">
              {filter === "all"
                ? t("emptyDesc")
                : t("emptyDescFiltered", { filter })}
            </p>
            <Button
              asChild
              className="mt-6 bg-emerald-600 hover:bg-emerald-700"
            >
              <Link href="/lots">
                <Sprout className="mr-2 h-4 w-4" />
                {t("browseLots")}
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2">
          {filtered.map((offer) => {
            const lot = offer.lot;
            const price = offer.offered_price_per_kg ?? 0;
            const quantity = lot?.quantity_kg;
            const farmerName =
              offer.farmer?.name || lot?.farmer_name || t("farmer");
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
                            {lot.commodity}
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
                        {lot?.commodity || t("produce")}
                        {lot?.variety ? ` · ${lot.variety}` : ""}
                      </CardDescription>
                    </div>
                    <Badge
                      variant="secondary"
                      className={`shrink-0 ${OFFER_STATUS_STYLES[offer.status]}`}
                    >
                      {offer.status === "pending"
                        ? tOffers("statusPending")
                        : offer.status === "accepted"
                        ? tOffers("statusAccepted")
                        : offer.status === "rejected"
                        ? tOffers("statusRejected")
                        : offer.status === "paid"
                        ? tOffers("statusPaid")
                        : tOffers("statusDelivered")}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4 pt-0">
                  <div className="flex items-center gap-4 rounded-md bg-slate-50 p-3 text-sm dark:bg-slate-900/50">
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <Tag className="h-4 w-4" />
                      <span>
                        {t("offered", { price: formatINR(price) })}
                        {tCommon("perKg")}
                      </span>
                    </div>
                    {quantity ? (
                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        <Scale className="h-4 w-4" />
                        <span>
                          <span className="font-medium text-foreground">
                            {quantity}
                          </span>{" "}
                          {tCommon("kg")}
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
                      {t("farmer")}{" "}
                      <span className="font-medium text-foreground">
                        {farmerName}
                      </span>
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

export default function BuyerOffersPage() {
  return (
    <BuyerRouteGuard>
      <BuyerOffersInner />
    </BuyerRouteGuard>
  );
}
