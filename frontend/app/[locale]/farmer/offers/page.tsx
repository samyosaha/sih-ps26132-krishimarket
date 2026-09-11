"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { FarmerRouteGuard } from "@/components/farmer-route-guard";
import { apiFetch } from "@/lib/api";
import { toast } from "sonner";
import {
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Loader2,
  Inbox,
  Check,
  X,
  User,
  Phone,
  Mail,
  Tag,
  Scale,
  Sprout,
  MessageSquare,
} from "lucide-react";
import { VerifiedBadge } from "@/components/verified-badge";

/* ── Types matching enriched backend response ── */

interface BuyerInfo {
  id: string | number;
  name: string;
  email?: string;
  phone?: string;
  is_verified_buyer?: boolean;
}

interface OfferItem {
  id: string | number;
  lot_id: string | number;
  buyer_id: string | number;
  offered_price_per_kg: number;
  message?: string;
  status: OfferStatus;
  buyer: BuyerInfo;
}

interface LotStub {
  id: string | number;
  commodity: string;
  variety?: string;
  quantity_kg: number;
  quality_grade: string;
  asking_price_per_kg: number;
  district: string;
  state: string;
  status: string;
}

interface ReceivedOffersGroup {
  lot: LotStub;
  offers: OfferItem[];
}

function FarmerOffersInner() {
  const router = useRouter();
  const t = useTranslations("offers.farmer");
  const tOffers = useTranslations("offers");
  const tCommon = useTranslations("common");
  const [groups, setGroups] = useState<ReceivedOffersGroup[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [actingOnId, setActingOnId] = useState<string | number | null>(null);

  const loadOffers = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await apiFetch<ReceivedOffersGroup[]>("/offers/received");
      setGroups(data);
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

  const updateOfferLocally = (
    offerId: string | number,
    nextStatus: OfferStatus
  ) => {
    setGroups((prev) =>
      prev.map((g) => ({
        ...g,
        offers: g.offers.map((o) =>
          o.id === offerId ? { ...o, status: nextStatus } : o
        ),
      }))
    );
  };

  const handleAccept = async (offerId: string | number) => {
    setActingOnId(offerId);
    try {
      await apiFetch(`/offers/${offerId}/accept`, { method: "PATCH" });
      updateOfferLocally(offerId, "accepted");
      toast.success(t("acceptSuccess"));
      router.refresh();
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : t("loadFailed");
      toast.error(msg);
    } finally {
      setActingOnId(null);
    }
  };

  const handleReject = async (offerId: string | number) => {
    setActingOnId(offerId);
    try {
      await apiFetch(`/offers/${offerId}/reject`, { method: "PATCH" });
      updateOfferLocally(offerId, "rejected");
      toast.success(t("rejectSuccess"));
      router.refresh();
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : t("loadFailed");
      toast.error(msg);
    } finally {
      setActingOnId(null);
    }
  };

  const totalOffers = groups.reduce((acc, g) => acc + g.offers.length, 0);
  const pendingOffers = groups.reduce(
    (acc, g) => acc + g.offers.filter((o) => o.status === "pending").length,
    0
  );

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-5">
        <Card className="flex flex-col justify-between">
          <CardHeader className="pb-3">
            <CardDescription className="text-xs uppercase tracking-wide">
              {t("lotsWithOffers")}
            </CardDescription>
            <CardTitle className="text-2xl sm:text-3xl font-bold">{groups.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="flex flex-col justify-between">
          <CardHeader className="pb-3">
            <CardDescription className="text-xs uppercase tracking-wide">
              {t("total")}
            </CardDescription>
            <CardTitle className="text-2xl sm:text-3xl font-bold">{totalOffers}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="flex flex-col justify-between">
          <CardHeader className="pb-3">
            <CardDescription className="text-xs uppercase tracking-wide">
              {t("awaiting")}
            </CardDescription>
            <CardTitle className="text-2xl sm:text-3xl font-bold text-amber-600">
              {pendingOffers}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {isLoading ? (
        <div className="flex min-h-[40vh] items-center justify-center">
          <div className="flex items-center gap-3 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span>{t("loading")}</span>
          </div>
        </div>
      ) : groups.length === 0 ? (
        <Card className="border border-border/80">
          <CardContent className="flex flex-col items-center justify-center py-14 px-4 text-center max-w-md mx-auto">
            <div className="mb-3.5 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
              <Inbox className="h-6 w-6 text-muted-foreground" />
            </div>
            <h3 className="text-base font-semibold">{t("emptyTitle")}</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {t("emptyDesc")}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-8">
          {groups.map((group) => (
            <section
              key={group.lot.id}
              className="space-y-4 rounded-xl border border-border/80 bg-card p-5 sm:p-6 shadow-xs"
            >
              <header className="flex flex-col gap-3 border-b border-border/60 pb-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-semibold tracking-tight">
                      {group.lot.commodity}
                    </h2>
                    {group.lot.status ? (
                      <Badge variant="outline" className="text-xs capitalize">
                        {String(group.lot.status)}
                      </Badge>
                    ) : null}
                  </div>
                  <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <Sprout className="h-3.5 w-3.5 shrink-0 text-primary" />
                      {group.lot.commodity}
                      {group.lot.variety ? ` · ${group.lot.variety}` : ""}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Scale className="h-3.5 w-3.5 shrink-0" />
                      {t("listed", { qty: group.lot.quantity_kg })}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Tag className="h-3.5 w-3.5 shrink-0" />
                      {t("asking", { price: formatINR(group.lot.asking_price_per_kg) })}
                    </span>
                  </div>
                </div>
                <Badge variant="secondary" className="shrink-0 self-start sm:self-auto font-medium">
                  {group.offers.length === 1
                    ? t("countOne", { count: group.offers.length })
                    : t("count", { count: group.offers.length })}
                </Badge>
              </header>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
                {group.offers.map((offer) => {
                  const isPending = offer.status === "pending";
                  const isActing = actingOnId === offer.id;
                  return (
                    <Card
                      key={offer.id}
                      className={
                        isPending
                          ? "border-l-4 border-l-amber-400"
                          : "border-l-4 border-l-slate-200"
                      }
                    >
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="flex items-center gap-2 text-sm font-medium">
                              <User className="h-4 w-4 text-muted-foreground" />
                              {offer.buyer.name}
                              <VerifiedBadge verified={!!offer.buyer.is_verified_buyer} compact />
                            </div>
                            <div className="mt-1 space-y-0.5 text-xs text-muted-foreground">
                              {offer.buyer.email ? (
                                <div className="inline-flex items-center gap-1">
                                  <Mail className="h-3 w-3" />
                                  {offer.buyer.email}
                                </div>
                              ) : null}
                              {offer.buyer.phone ? (
                                <div className="inline-flex items-center gap-1 ml-3">
                                  <Phone className="h-3 w-3" />
                                  {offer.buyer.phone}
                                </div>
                              ) : null}
                            </div>
                          </div>
                          <Badge
                            variant="secondary"
                            className={OFFER_STATUS_STYLES[offer.status]}
                          >
                            {offer.status === "pending"
                              ? tOffers("statusPending")
                              : offer.status === "accepted"
                              ? tOffers("statusAccepted")
                              : tOffers("statusRejected")}
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4 pt-0">
                        <div className="flex items-center justify-between gap-3 rounded-lg border border-border/50 bg-secondary/40 px-3.5 py-2.5">
                          <div>
                            <span className="text-xs uppercase tracking-wide text-muted-foreground">
                              {t("offeredLabel")}
                            </span>
                            <div className="text-lg font-bold text-primary">
                              {formatINR(offer.offered_price_per_kg)}{" "}
                              <span className="text-xs font-normal text-muted-foreground">
                                {tCommon("perKg")}
                              </span>
                            </div>
                          </div>
                          <div className="text-right">
                            <span className="text-xs uppercase tracking-wide text-muted-foreground">
                              {t("totalLabel")}
                            </span>
                            <div className="text-base font-semibold text-foreground">
                              ≈{" "}
                              {formatINR(
                                Number(offer.offered_price_per_kg) *
                                  Number(group.lot.quantity_kg)
                              )}
                            </div>
                          </div>
                        </div>

                        {offer.message ? (
                          <div className="flex gap-2 rounded-md border p-3 text-sm">
                            <MessageSquare className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                            <p className="text-muted-foreground">
                              {offer.message}
                            </p>
                          </div>
                        ) : null}

                        {isPending ? (
                          <div className="flex gap-2 pt-2">
                            <Button
                              onClick={() => handleAccept(offer.id)}
                              disabled={isActing}
                              className="flex-1"
                              size="sm"
                            >
                              {isActing ? (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              ) : (
                                <Check className="mr-2 h-4 w-4" />
                              )}
{t("accept")}
                            </Button>

                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  variant="destructive"
                                  size="sm"
                                  className="flex-1"
                                  disabled={isActing}
                                >
                                  <X className="mr-2 h-4 w-4" />
                                  {t("reject")}
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>
                                    {t("rejectTitle")}
                                  </AlertDialogTitle>
                                  <AlertDialogDescription>
                                    {t("rejectDesc", {
                                      price: formatINR(
                                        offer.offered_price_per_kg
                                      ),
                                      name: offer.buyer.name,
                                    })}
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel disabled={isActing}>
                                    {tCommon("cancel")}
                                  </AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => handleReject(offer.id)}
                                    disabled={isActing}
                                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                  >
                                    {isActing ? (
                                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    ) : null}
                                    {t("rejectConfirm")}
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        ) : (
                          <div className="pt-2 text-xs italic text-muted-foreground">
                            {offer.status === "accepted"
                              ? t("acceptedInfo")
                              : t("rejectedInfo")}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

export default function FarmerOffersPage() {
  return (
    <FarmerRouteGuard>
      <FarmerOffersInner />
    </FarmerRouteGuard>
  );
}
