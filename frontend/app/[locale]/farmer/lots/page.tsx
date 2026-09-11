"use client";

import { useEffect, useState, FormEvent, useCallback } from "react";
import { useTranslations } from "next-intl";
import { FarmerRouteGuard } from "@/components/farmer-route-guard";
import { apiFetch } from "@/lib/api";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Loader2,
  Plus,
  Sprout,
  MapPin,
  Scale,
  Tag,
  Truck,
  Info,
  CheckCircle2,
} from "lucide-react";
import {
  Lot,
  QualityGrade,
  LOT_STATUS_STYLES,
  gradeBadgeClass,
  formatINR,
  INDIAN_STATES,
  DISTRICTS_BY_STATE,
  HubSuggestion,
} from "@/lib/market-types";
import { FieldError } from "@/components/field-error";
import {
  validateRequired,
  validatePositiveNumber,
} from "@/lib/validation";
import { isRateLimited } from "@/lib/anti-spam";

interface CreateLotPayload {
  commodity: string;
  variety?: string;
  quantity_kg: number;
  quality_grade: QualityGrade;
  asking_price_per_kg: number;
  district: string;
  state: string;
  pincode?: string;
  hub_id?: number;
}

const emptyForm = (): CreateLotPayload => ({
  commodity: "",
  variety: "",
  quantity_kg: 0,
  quality_grade: "A",
  asking_price_per_kg: 0,
  district: "",
  state: "",
  pincode: "",
});

function FarmerLotsInner() {
  const t = useTranslations("farmerLots");
  const tLots = useTranslations("lots");
  const tCommon = useTranslations("common");
  const [lots, setLots] = useState<Lot[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<CreateLotPayload>(emptyForm());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string | null>>({});
  const [suggestedHub, setSuggestedHub] = useState<HubSuggestion | null>(null);
  const [isLoadingHub, setIsLoadingHub] = useState(false);

  const loadLots = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await apiFetch<Lot[]>("/lots/mine");
      setLots(data);
    } catch (err) {
      const msg = err instanceof Error ? err.message : t("loadFailed");
      toast.error(msg);
    } finally {
      setIsLoading(false);
    }
  }, [t]);

  useEffect(() => {
    loadLots();
  }, [loadLots]);

  useEffect(() => {
    let isCancelled = false;

    if (!form.district && !form.state && !form.pincode) {
      setSuggestedHub(null);
      return;
    }

    const params = new URLSearchParams();
    if (form.district) params.set("district", form.district);
    if (form.state) params.set("state", form.state);
    if (form.pincode) params.set("pincode", form.pincode);

    setIsLoadingHub(true);
    apiFetch<HubSuggestion>(`/lots/suggest-hub?${params.toString()}`)
      .then((data) => {
        if (!isCancelled) {
          setSuggestedHub(data);
          if (data.matched && data.hub_id) {
            setForm((prev) => ({ ...prev, hub_id: data.hub_id! }));
          } else {
            setForm((prev) => {
              const next = { ...prev };
              delete next.hub_id;
              return next;
            });
          }
        }
      })
      .catch(() => {
        if (!isCancelled) {
          setSuggestedHub(null);
        }
      })
      .finally(() => {
        if (!isCancelled) {
          setIsLoadingHub(false);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [form.district, form.state, form.pincode]);

  const updateField = <K extends keyof CreateLotPayload>(
    key: K,
    value: CreateLotPayload[K]
  ) => setForm((prev) => ({ ...prev, [key]: value }));

  const availableDistricts = form.state
    ? DISTRICTS_BY_STATE[form.state] ?? []
    : [];

  const validateForm = (): boolean => {
    const errors: Record<string, string | null> = {
      commodity: validateRequired(form.commodity, "Commodity"),
      quantity_kg: validatePositiveNumber(form.quantity_kg || "", "Quantity"),
      asking_price_per_kg: validatePositiveNumber(form.asking_price_per_kg || "", "Asking price"),
      state: validateRequired(form.state, "State"),
      district: validateRequired(form.district, "District"),
    };
    setFieldErrors(errors);
    return !Object.values(errors).some(Boolean);
  };

  const handleCreate = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (isRateLimited("create-lot", 5, 60_000)) {
      toast.error(t("tooMany"));
      return;
    }

    if (!validateForm()) return;

    setIsSubmitting(true);
    try {
      const cleaned: CreateLotPayload = {
        ...form,
        variety: form.variety?.trim() || undefined,
      };
      await apiFetch("/lots", {
        method: "POST",
        body: JSON.stringify(cleaned),
      });
      toast.success(t("created"));
      setDialogOpen(false);
      setForm(emptyForm());
      setFieldErrors({});
      await loadLots();
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : t("createFailed");
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
          <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-emerald-600 hover:bg-emerald-700 gap-2">
              <Plus className="h-4 w-4" />
              {t("createLot")}
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{t("createTitle")}</DialogTitle>
              <DialogDescription>
                {t("createDesc")}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreate} className="space-y-5" noValidate>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="commodity">{tCommon("commodity")}</Label>
                  <Input
                    id="commodity"
                    required
                    placeholder={t("commodityPlaceholder")}
                    value={form.commodity}
                    onChange={(e) => updateField("commodity", e.target.value)}
                    disabled={isSubmitting}
                    aria-invalid={!!fieldErrors.commodity}
                  />
                  <FieldError message={fieldErrors.commodity} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="variety">{t("variety")} <span className="text-muted-foreground">{tCommon("optional")}</span></Label>
                  <Input
                    id="variety"
                    placeholder={t("varietyPlaceholder")}
                    value={form.variety}
                    onChange={(e) => updateField("variety", e.target.value)}
                    disabled={isSubmitting}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="quantity">{t("quantity")}</Label>
                  <Input
                    id="quantity"
                    type="number"
                    min={0}
                    step="any"
                    required
                    value={form.quantity_kg || ""}
                    onChange={(e) =>
                      updateField("quantity_kg", Number(e.target.value))
                    }
                    disabled={isSubmitting}
                    aria-invalid={!!fieldErrors.quantity_kg}
                  />
                  <FieldError message={fieldErrors.quantity_kg} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="price">{t("askingPrice")}</Label>
                  <Input
                    id="price"
                    type="number"
                    min={0}
                    step="any"
                    required
                    value={form.asking_price_per_kg || ""}
                    onChange={(e) =>
                      updateField("asking_price_per_kg", Number(e.target.value))
                    }
                    disabled={isSubmitting}
                    aria-invalid={!!fieldErrors.asking_price_per_kg}
                  />
                  <FieldError message={fieldErrors.asking_price_per_kg} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="quality">{t("qualityGrade")}</Label>
                  <Select
                    value={form.quality_grade}
                    onValueChange={(v) =>
                      updateField("quality_grade", v as QualityGrade)
                    }
                    disabled={isSubmitting}
                  >
                    <SelectTrigger id="quality">
                      <SelectValue placeholder={t("selectGrade")} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="A">{tLots("gradeA")}</SelectItem>
                      <SelectItem value="B">{tLots("gradeB")}</SelectItem>
                      <SelectItem value="C">{tLots("gradeC")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="state">{tCommon("state")}</Label>
                  <Select
                    value={form.state || ""}
                    onValueChange={(v) => {
                      updateField("state", v);
                      updateField("district", "");
                    }}
                    disabled={isSubmitting}
                  >
                    <SelectTrigger id="state">
                      <SelectValue placeholder={t("selectState")} />
                    </SelectTrigger>
                    <SelectContent>
                      {INDIAN_STATES.map((s) => (
                        <SelectItem key={s} value={s}>
                          {s}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="district">{tCommon("district")}</Label>
                  <Select
                    value={form.district || ""}
                    onValueChange={(v) => updateField("district", v)}
                    disabled={isSubmitting || !form.state}
                  >
                    <SelectTrigger id="district">
                      <SelectValue
                        placeholder={
                          form.state ? t("selectDistrict") : t("pickStateFirst")
                        }
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {availableDistricts.length === 0 ? (
                        <SelectItem value="__none" disabled>
                          {t("noDistricts")}
                        </SelectItem>
                      ) : (
                        availableDistricts.map((d) => (
                          <SelectItem key={d} value={d}>
                            {d}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="pincode">
                    {t("pincode")}{" "}
                    <span className="text-muted-foreground font-normal">
                      ({tCommon("optional")} — {t("pincodeHint")})
                    </span>
                  </Label>
                  <Input
                    id="pincode"
                    placeholder={t("pincodePlaceholder")}
                    maxLength={6}
                    value={form.pincode || ""}
                    onChange={(e) => updateField("pincode", e.target.value)}
                    disabled={isSubmitting}
                  />
                </div>

                {/* Hub-Assisted Logistics Suggestion */}
                {(form.district || form.state || form.pincode || isLoadingHub) && (
                  <div className="sm:col-span-2 pt-1" aria-live="polite">
                    {isLoadingHub ? (
                      <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50/50 p-3 text-xs text-muted-foreground dark:border-slate-800 dark:bg-slate-900/30">
                        <Loader2 className="h-4 w-4 animate-spin text-emerald-600" />
                        <span>{t("checkingHub")}</span>
                      </div>
                    ) : suggestedHub?.matched ? (
                      <div
                        id="suggested-hub-card"
                        className={`rounded-lg border p-3.5 text-sm transition-all ${
                          suggestedHub.is_regional_fallback
                            ? "border-amber-200 bg-amber-50/80 text-amber-950 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-200"
                            : "border-emerald-200 bg-emerald-50/80 text-emerald-950 dark:border-emerald-900/40 dark:bg-emerald-950/20 dark:text-emerald-200"
                        }`}
                      >
                        <div className="flex items-start gap-2.5">
                          <div
                            className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
                              suggestedHub.is_regional_fallback
                                ? "bg-amber-100 text-amber-700 dark:bg-amber-900/60 dark:text-amber-300"
                                : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-300"
                            }`}
                          >
                            <Truck className="h-4 w-4" aria-hidden="true" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2 font-medium">
                              <span>
                                {suggestedHub.is_regional_fallback ? t("regionalHub") : t("nearestHub")}:{" "}
                                <span className="font-semibold">{suggestedHub.hub_name}</span>
                              </span>
                              <Badge
                                variant="secondary"
                                className={`text-[10px] uppercase tracking-wider ${
                                  suggestedHub.is_regional_fallback
                                    ? "bg-amber-100 text-amber-800 hover:bg-amber-100 dark:bg-amber-900/50 dark:text-amber-300"
                                    : "bg-emerald-100 text-emerald-800 hover:bg-emerald-100 dark:bg-emerald-900/50 dark:text-emerald-300"
                                }`}
                              >
                                {t("autoAssigned")}
                              </Badge>
                            </div>
                            <p className="mt-1 text-xs text-muted-foreground">
                              {suggestedHub.message}
                            </p>
                            <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-muted-foreground/80">
                              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                              <span>{t("dropOffNote")}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : suggestedHub && !suggestedHub.matched ? (
                      <div
                        id="suggested-hub-fallback"
                        className="rounded-lg border border-slate-200 bg-slate-50/80 p-3 text-xs text-muted-foreground dark:border-slate-800 dark:bg-slate-900/30"
                      >
                        <div className="flex items-center gap-2 font-medium text-foreground">
                          <Info className="h-4 w-4 text-muted-foreground" />
                          <span>{t("directFulfillment")}</span>
                        </div>
                        <p className="mt-1">
                          {suggestedHub.message}
                        </p>
                      </div>
                    ) : null}
                  </div>
                )}
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
                  className="bg-emerald-600 hover:bg-emerald-700"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {t("publishing")}
                    </>
                  ) : (
                    t("publish")
                  )}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="flex min-h-[40vh] items-center justify-center">
          <div className="flex items-center gap-3 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span>{t("loading")}</span>
          </div>
        </div>
      ) : lots.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Sprout className="mb-4 h-12 w-12 text-emerald-300" />
            <h3 className="text-lg font-semibold">{t("emptyTitle")}</h3>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">
              {t("emptyDesc")}
            </p>
            <Button
              onClick={() => setDialogOpen(true)}
              className="mt-6 bg-emerald-600 hover:bg-emerald-700"
            >
              <Plus className="mr-2 h-4 w-4" />
              {t("createFirst")}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {lots.map((lot) => {
            const location = [lot.district, lot.state]
              .filter(Boolean)
              .join(", ");
            return (
              <Card
                key={lot.id}
                className="overflow-hidden transition-shadow hover:shadow-md"
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <CardTitle className="truncate text-lg">
                        {lot.commodity}
                      </CardTitle>
                      <CardDescription className="mt-1 inline-flex items-center gap-1 text-sm">
                        <Sprout className="h-3.5 w-3.5" />
                        {lot.commodity}
                        {lot.variety ? (
                          <span className="text-muted-foreground">
                            {" · "}{lot.variety}
                          </span>
                        ) : null}
                      </CardDescription>
                    </div>
                    <Badge
                      variant="secondary"
                      className={`shrink-0 ${LOT_STATUS_STYLES[lot.status]}`}
                    >
                      {lot.status === "available"
                        ? tLots("statusAvailable")
                        : lot.status === "reserved"
                        ? tLots("statusReserved")
                        : tLots("statusSold")}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3 pt-0">
                  <div className="flex items-center gap-4 text-sm">
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <Scale className="h-4 w-4" />
                      <span>
                        <span className="font-medium text-foreground">
                          {lot.quantity_kg}
                        </span>{" "}
                        {tCommon("kg")}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <Tag className="h-4 w-4" />
                      <span>
                        <span className="font-semibold text-emerald-700">
                          {formatINR(lot.asking_price_per_kg)}
                        </span>
                        {tCommon("perKg")}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs">
                    <Badge
                      variant="outline"
                      className={gradeBadgeClass(lot.quality_grade)}
                    >
                      {tLots("grade", { grade: lot.quality_grade })}
                    </Badge>
                    {location ? (
                      <span className="inline-flex items-center gap-1 text-muted-foreground">
                        <MapPin className="h-3.5 w-3.5" />
                        {location}
                      </span>
                    ) : null}
                  </div>

                  {lot.hub_name ? (
                    <div className="flex items-center gap-1.5 rounded-md bg-emerald-50/80 px-2 py-1 text-xs font-medium text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300">
                      <Truck className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                      <span className="truncate">
                        {t("hubLabel")}: {lot.hub_name}
                      </span>
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function FarmerLotsPage() {
  return (
    <FarmerRouteGuard>
      <FarmerLotsInner />
    </FarmerRouteGuard>
  );
}
