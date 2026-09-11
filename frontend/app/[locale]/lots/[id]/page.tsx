"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { useParams } from "next/navigation";
import { useAuth, UserRole } from "@/lib/auth-context";
import { apiFetch } from "@/lib/api";
import { toast } from "sonner";
import {
  Lot,
  LOT_STATUS_STYLES,
  gradeBadgeClass,
  formatINR,
} from "@/lib/market-types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Loader2,
  Sprout,
  MapPin,
  Scale,
  Tag,
  User,
  ArrowLeft,
  ArrowRight,
  MessageSquare,
  ShieldCheck,
} from "lucide-react";
import { FieldError } from "@/components/field-error";
import { validatePositiveNumber } from "@/lib/validation";
import { useHoneypot, HoneypotField, isRateLimited } from "@/lib/anti-spam";
import { NearbyLogistics } from "@/components/nearby-logistics";
import { DeliveryOptionsPicker } from "@/components/delivery-options-picker";

export default function LotDetailPage() {
  const t = useTranslations("lots.detail");
  const tLots = useTranslations("lots");
  const tCommon = useTranslations("common");
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const lotId = params.id;
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const honeypot = useHoneypot();

  const [lot, setLot] = useState<Lot | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [offeredPrice, setOfferedPrice] = useState<number | "">("");
  const [message, setMessage] = useState("");
  const [buyerDistrict, setBuyerDistrict] = useState("");
  const [selectedDeliveryMethod, setSelectedDeliveryMethod] = useState("buyer_pickup");
  const [isPerishable, setIsPerishable] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string | null>>({});

  const loadLot = useCallback(async () => {
    if (!lotId) return;
    setIsLoading(true);
    setError(null);
    try {
      const data = await apiFetch<Lot>(`/lots/${lotId}`);
      setLot(data);
      setOfferedPrice(data.asking_price_per_kg ?? "");
      setBuyerDistrict(data.district ?? "");
      const perishableCheck = /tomato|onion|potato|fruit|vegetable|mango|banana|apple|grape|orange|chilli|ginger|spinach|cabbage/i.test(
        data.commodity || ""
      );
      setIsPerishable(perishableCheck);
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : t("loadFailed");
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  }, [lotId, t]);

  useEffect(() => {
    loadLot();
  }, [loadLot]);

  const isBuyer = user?.role === ("buyer" as UserRole);

  const validateOffer = (): boolean => {
    const errors: Record<string, string | null> = {
      offeredPrice: validatePositiveNumber(offeredPrice, "Offer price"),
    };
    setFieldErrors(errors);
    return !Object.values(errors).some(Boolean);
  };

  const handleSubmitOffer = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    // Anti-spam: honeypot
    if (honeypot.isFilled()) {
      toast.success(t("offerSent"));
      return;
    }

    // Anti-spam: rate limit (5 offers per minute)
    if (isRateLimited("make-offer", 5, 60_000)) {
      toast.error(t("tooMany"));
      return;
    }

    // Validation
    if (!lot || !validateOffer()) return;

    setIsSubmitting(true);
    try {
      await apiFetch("/offers", {
        method: "POST",
        body: JSON.stringify({
          lot_id: lot.id,
          offered_price_per_kg: Number(offeredPrice),
          message: message.trim() || undefined,
          delivery_district: buyerDistrict.trim() || undefined,
        }),
      });

      if (typeof window !== "undefined") {
        try {
          localStorage.setItem(`delivery_pref_lot_${lot.id}`, selectedDeliveryMethod);
        } catch {
          // ignore storage errors
        }
      }

      toast.success(t("offerSent"));
      setDialogOpen(false);
      setMessage("");
      setFieldErrors({});
      setTimeout(() => router.push("/buyer/offers"), 1200);
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : t("sendFailed");
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/lots">
            <ArrowLeft className="mr-2 h-4 w-4" />
            {t("backToBrowse")}
          </Link>
        </Button>
      </div>

      {isLoading || authLoading ? (
        <div className="flex min-h-[40vh] items-center justify-center">
          <div className="flex items-center gap-3 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span>{t("loading")}</span>
          </div>
        </div>
      ) : error ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <h3 className="text-lg font-semibold text-red-600">{error}</h3>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">
              {t("notFound")}
            </p>
            <Button asChild className="mt-6">
              <Link href="/lots">{t("browseOther")}</Link>
            </Button>
          </CardContent>
        </Card>
      ) : lot ? (
        <>
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="space-y-6 lg:col-span-2">
              <Card>
                <CardHeader className="pb-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge
                          variant="secondary"
                          className={LOT_STATUS_STYLES[lot.status]}
                        >
                          {lot.status === "available"
                            ? tLots("statusAvailable")
                            : lot.status === "reserved"
                            ? tLots("statusReserved")
                            : tLots("statusSold")}
                        </Badge>
                        <Badge
                          variant="outline"
                          className={gradeBadgeClass(lot.quality_grade)}
                        >
                          {tLots("grade", { grade: lot.quality_grade })}
                        </Badge>
                      </div>
                      <CardTitle className="mt-3 text-3xl font-bold tracking-tight">
                        {lot.commodity}
                      </CardTitle>
                      <CardDescription className="mt-2 inline-flex items-center gap-1.5 text-base">
                        <Sprout className="h-4 w-4 text-primary" />
                        {lot.commodity}
                        {lot.variety ? (
                          <span className="text-muted-foreground">
                            {" · "}{t("varietyLabel", { variety: lot.variety })}
                          </span>
                        ) : null}
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid gap-px rounded-lg border border-border/60 bg-border/60 sm:grid-cols-3 overflow-hidden">
                    <div className="space-y-1 bg-card px-5 py-4">
                      <div className="text-xs uppercase tracking-wide text-muted-foreground">
                        {t("askingPrice")}
                      </div>
                      <div className="text-2xl font-bold text-primary">
                        {formatINR(lot.asking_price_per_kg)}
                        <span className="ml-1 text-sm font-medium text-muted-foreground">
                          {tCommon("perKg")}
                        </span>
                      </div>
                    </div>
                    <div className="space-y-1 bg-card px-5 py-4">
                      <div className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-muted-foreground">
                        <Scale className="h-3 w-3" />
                        {t("availableQty")}
                      </div>
                      <div className="text-2xl font-bold">
                        {lot.quantity_kg}
                        <span className="ml-1 text-sm font-medium text-muted-foreground">
                          {tCommon("kg")}
                        </span>
                      </div>
                    </div>
                    <div className="space-y-1 bg-card px-5 py-4">
                      <div className="text-xs uppercase tracking-wide text-muted-foreground">
                        {t("totalValue")}
                      </div>
                      <div className="text-2xl font-bold">
                        {formatINR(
                          Number(lot.asking_price_per_kg) * Number(lot.quantity_kg)
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    {lot.state || lot.district ? (
                      <div className="flex items-start gap-3 rounded-md border p-4">
                        <MapPin className="mt-0.5 h-5 w-5 text-muted-foreground" />
                        <div>
                          <div className="text-xs uppercase tracking-wide text-muted-foreground">
                            {t("location")}
                          </div>
                          <div className="mt-1 font-medium">
                            {[lot.district, lot.state]
                              .filter(Boolean)
                              .join(", ")}
                          </div>
                        </div>
                      </div>
                    ) : null}
                  </div>
                </CardContent>
              </Card>
            </div>

            <aside className="space-y-6">
              <Card className="border-l-4 border-l-primary">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">{t("farmer")}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <User className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="truncate font-semibold text-sm">
                        {lot.farmer_name || t("farmer")}
                      </div>
                      <div className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                        <ShieldCheck className="h-3 w-3 text-primary" />
                        {t("verifiedSeller")}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <NearbyLogistics district={lot.district} state={lot.state} />

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg">{t("interested")}</CardTitle>
                  <CardDescription className="text-xs">
                    {t("interestedDesc")}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {!isAuthenticated ? (
                    <div className="space-y-4 text-sm">
                      <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 text-center">
                        <Sprout className="mx-auto mb-2 h-7 w-7 text-primary" />
                        <p className="font-semibold text-foreground">
                          {t("joinToTrade")}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {t("joinToTradeDesc")}
                        </p>
                      </div>
                      <Button asChild size="default" className="w-full font-semibold">
                        <Link href="/register">
                          {t("getStarted")}
                          <ArrowRight className="h-4 w-4" />
                        </Link>
                      </Button>
                      <p className="text-center text-xs text-muted-foreground">
                        {t("alreadyMember")}{" "}
                        <Link href="/login" className="font-medium text-primary underline-offset-2 hover:underline">Sign in</Link>
                      </p>
                    </div>
                  ) : !isBuyer ? (
                    <div className="space-y-2 text-sm">
                      <p className="text-muted-foreground">
                        {t("offersOnlyBuyers", { role: "farmer" })}
                      </p>
                    </div>
                  ) : lot.status !== "available" ? (
                    <div className="space-y-2 text-sm">
                      <p className="text-muted-foreground">
                        {t("lotDotAvailable", {
                          status:
                            lot.status === "reserved"
                              ? tLots("statusReserved")
                              : tLots("statusSold"),
                        })}
                      </p>
                    </div>
                  ) : (
                    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                      <DialogTrigger asChild>
                        <Button className="w-full bg-accent text-accent-foreground hover:bg-accent/85">
                          <Tag className="h-4 w-4" />
                          {t("makeOffer")}
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                        <DialogHeader>
                          <DialogTitle>{t("makeOfferTitle")}</DialogTitle>
                          <DialogDescription>
                            {t("makeOfferDesc", { commodity: lot.commodity })}
                          </DialogDescription>
                        </DialogHeader>
                        <form onSubmit={handleSubmitOffer} className="space-y-5" noValidate>
                          <HoneypotField {...honeypot.fieldProps} />
                          <div className="grid gap-3 rounded-lg border border-border/60 bg-secondary/40 p-3 text-xs sm:grid-cols-2">
                            <div>
                              <div className="text-muted-foreground">
                                {t("asking")}
                              </div>
                              <div className="font-semibold">
                                {formatINR(lot.asking_price_per_kg)} {tCommon("perKg")}
                              </div>
                            </div>
                            <div>
                              <div className="text-muted-foreground">
                                {t("available")}
                              </div>
                              <div className="font-semibold">
                                {lot.quantity_kg} {tCommon("kg")}
                              </div>
                            </div>
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor="offer-price">
                              {t("offerPriceLabel")}
                            </Label>
                            <Input
                              id="offer-price"
                              type="number"
                              min={0}
                              step="any"
                              value={offeredPrice}
                              onChange={(e) => {
                                const val = e.target.value === "" ? "" : Number(e.target.value);
                                setOfferedPrice(val);
                                if (fieldErrors.offeredPrice) {
                                  setFieldErrors((p) => ({ ...p, offeredPrice: validatePositiveNumber(val, "Offer price") }));
                                }
                              }}
                              required
                              disabled={isSubmitting}
                              aria-invalid={!!fieldErrors.offeredPrice}
                            />
                            <FieldError message={fieldErrors.offeredPrice} />
                            {offeredPrice !== "" &&
                            typeof offeredPrice === "number" ? (
                              <p className="text-xs text-muted-foreground">
                                {t("totalAtPrice", {
                                  amount: formatINR(
                                    offeredPrice * Number(lot.quantity_kg)
                                  ),
                                  qty: lot.quantity_kg,
                                })}
                              </p>
                            ) : null}
                          </div>

                          {/* ── Delivery District & Fulfillment Recommendation ── */}
                          <div className="space-y-3 rounded-lg border border-border/60 bg-secondary/30 p-3.5">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <Label htmlFor="delivery-district" className="font-semibold text-xs uppercase tracking-wider text-foreground">
                                Delivery District & Fulfillment Options
                              </Label>
                              <label className="flex items-center gap-1.5 cursor-pointer text-xs text-muted-foreground hover:text-foreground">
                                <input
                                  type="checkbox"
                                  checked={isPerishable}
                                  onChange={(e) => setIsPerishable(e.target.checked)}
                                  className="h-3.5 w-3.5 rounded border-border text-primary focus:ring-primary"
                                />
                                <span>Perishable produce (Cold-chain priority)</span>
                              </label>
                            </div>

                            <div className="space-y-1">
                              <Input
                                id="delivery-district"
                                placeholder="Enter delivery district (e.g. Pune, Nagpur, Nashik)"
                                value={buyerDistrict}
                                onChange={(e) => setBuyerDistrict(e.target.value)}
                                className="bg-card"
                              />
                              <p className="text-[11px] text-muted-foreground">
                                Nearest Agri-Logistics Hub is resolved automatically from this district.
                              </p>
                            </div>

                            {buyerDistrict.trim() && (
                              <DeliveryOptionsPicker
                                lotId={lot.id}
                                buyerDistrict={buyerDistrict}
                                perishable={isPerishable}
                                selectedMethod={selectedDeliveryMethod}
                                onSelectMethod={setSelectedDeliveryMethod}
                              />
                            )}
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor="offer-msg">
                              {t("messageLabel")}{" "}
                              <span className="text-muted-foreground">
                                {tCommon("optional")}
                              </span>
                            </Label>
                            <Textarea
                              id="offer-msg"
                              rows={2}
                              placeholder={t("messagePlaceholder")}
                              value={message}
                              onChange={(e) => setMessage(e.target.value)}
                              disabled={isSubmitting}
                            />
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                              <MessageSquare className="h-3.5 w-3.5" />
                              {t("messageHint")}
                            </div>
                          </div>

                          <DialogFooter>
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => setDialogOpen(false)}
                              disabled={isSubmitting}
                            >
                              {tCommon("cancel")}
                            </Button>
                            <Button
                              type="submit"
                              className="bg-accent text-accent-foreground hover:bg-accent/85"
                              disabled={isSubmitting}
                            >
                              {isSubmitting ? (
                                <>
                                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                  {t("sending")}
                                </>
                              ) : (
                                t("sendOffer")
                              )}
                            </Button>
                          </DialogFooter>
                        </form>
                      </DialogContent>
                    </Dialog>
                  )}
                </CardContent>
              </Card>
            </aside>
          </div>
        </>
      ) : null}
    </div>
  );
}
