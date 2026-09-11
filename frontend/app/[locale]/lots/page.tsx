"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { apiFetch } from "@/lib/api";
import { toast } from "sonner";
import {
  Lot,
  LOT_STATUS_STYLES,
  QualityGrade,
  LotStatus,
  gradeBadgeClass,
  formatINR,
  INDIAN_STATES,
  DISTRICTS_BY_STATE,
} from "@/lib/market-types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
  Sprout,
  MapPin,
  Scale,
  Tag,
  User,
  Search,
  RotateCcw,
  ArrowRight,
  ShieldCheck,
} from "lucide-react";

interface LotFilters {
  commodity: string;
  state: string;
  district: string;
  quality_grade: "" | QualityGrade;
  status: "" | LotStatus;
}

const EMPTY_FILTERS: LotFilters = {
  commodity: "",
  state: "",
  district: "",
  quality_grade: "",
  status: "available",
};

export default function BrowseLotsPage() {
  const t = useTranslations("lots.browse");
  const tLots = useTranslations("lots");
  const tCommon = useTranslations("common");
  const tFarmerLots = useTranslations("farmerLots");
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [lots, setLots] = useState<Lot[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filters, setFilters] = useState<LotFilters>(EMPTY_FILTERS);
  const [applied, setApplied] = useState<LotFilters>(EMPTY_FILTERS);

  const loadLots = useCallback(async (f: LotFilters) => {
    setIsLoading(true);
    try {
      const params: Record<string, string> = {};
      if (f.commodity.trim()) params.commodity = f.commodity.trim();
      if (f.state) params.state = f.state;
      if (f.district) params.district = f.district;
      if (f.quality_grade) params.quality_grade = f.quality_grade;
      if (f.status) params.status = f.status;
      const data = await apiFetch<Lot[]>("/lots", { params });
      setLots(data);
    } catch (err) {
      const msg = err instanceof Error ? err.message : t("loadFailed");
      toast.error(msg);
    } finally {
      setIsLoading(false);
    }
  }, [t]);

  useEffect(() => {
    loadLots(applied);
  }, [applied, loadLots]);



  const availableDistricts = useMemo(() => {
    const list = filters.state ? DISTRICTS_BY_STATE[filters.state] ?? [] : [];
    return list;
  }, [filters.state]);

  const onApply = () => {
    setApplied({
      ...filters,
      district:
        filters.state === applied.state ? filters.district : "",
    });
  };

  const onReset = () => {
    setFilters(EMPTY_FILTERS);
    setApplied(EMPTY_FILTERS);
  };

  return (
    <div className="space-y-6">
      {/* CTA banner for visitors */}
      {!authLoading && !isAuthenticated && (
        <section className="relative overflow-hidden rounded-xl border border-primary/20 bg-primary/5 p-5 sm:p-7">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1.5 min-w-0">
              <h2 className="text-lg font-bold tracking-tight sm:text-xl">
                {t("ctaTitle")}
              </h2>
              <p className="max-w-lg text-sm text-muted-foreground">
                {t("ctaDesc")}
              </p>
              <div className="flex flex-wrap items-center gap-4 pt-1 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                  <ShieldCheck className="h-3.5 w-3.5 text-primary" />
                  {t("verifiedFarmers")}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Tag className="h-3.5 w-3.5 text-primary" />
                  {t("fairPrices")}
                </span>
              </div>
            </div>
            <Button asChild size="default" className="shrink-0">
              <Link href="/register">
                {t("getStarted")}
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </section>
      )}

      {/* Page heading */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>

      {/* Filter card */}
      <Card>
        <CardContent className="pt-5">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
            <div className="space-y-1.5 lg:col-span-1">
              <Label htmlFor="flt-commodity">{t("commodity")}</Label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="flt-commodity"
                  placeholder={t("commodityPlaceholder")}
                  className="pl-9"
                  value={filters.commodity}
                  onChange={(e) =>
                    setFilters({ ...filters, commodity: e.target.value })
                  }
                  onKeyDown={(e) => {
                    if (e.key === "Enter") onApply();
                  }}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="flt-state">{tCommon("state")}</Label>
              <Select
                value={filters.state || ""}
                onValueChange={(v) =>
                  setFilters({
                    ...filters,
                    state: v,
                    district: "",
                  })
                }
              >
                <SelectTrigger id="flt-state">
                  <SelectValue placeholder={t("allStates")} />
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

            <div className="space-y-1.5">
              <Label htmlFor="flt-district">{tCommon("district")}</Label>
              <Select
                value={filters.district || ""}
                onValueChange={(v) =>
                  setFilters({ ...filters, district: v })
                }
                disabled={!filters.state}
              >
                <SelectTrigger id="flt-district">
                  <SelectValue
                    placeholder={
                      filters.state ? t("chooseDistrict") : t("chooseStateFirst")
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

            <div className="space-y-1.5">
              <Label htmlFor="flt-grade">{tFarmerLots("qualityGrade")}</Label>
              <Select
                value={filters.quality_grade || ""}
                onValueChange={(v) =>
                  setFilters({
                    ...filters,
                    quality_grade: (v as QualityGrade) || "",
                  })
                }
              >
                <SelectTrigger id="flt-grade">
                  <SelectValue placeholder={t("anyGrade")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="A">{tLots("gradeA")}</SelectItem>
                  <SelectItem value="B">{tLots("gradeB")}</SelectItem>
                  <SelectItem value="C">{tLots("gradeC")}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="flt-status">{tCommon("status")}</Label>
              <Select
                value={filters.status || ""}
                onValueChange={(v) =>
                  setFilters({
                    ...filters,
                    status: (v as LotStatus) || "",
                  })
                }
              >
                <SelectTrigger id="flt-status">
                  <SelectValue placeholder={t("anyStatus")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="available">{tLots("statusAvailable")}</SelectItem>
                  <SelectItem value="reserved">{tLots("statusReserved")}</SelectItem>
                  <SelectItem value="sold">{tLots("statusSold")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Button onClick={onApply}>
              <Search className="h-4 w-4" />
              {t("applyFilters")}
            </Button>
            <Button variant="outline" onClick={onReset}>
              <RotateCcw className="h-4 w-4" />
              {t("reset")}
            </Button>
            <span className="ml-auto text-sm text-muted-foreground">
              {!isLoading && t("found", { count: lots.length })}
              {applied.state ? (
                <span className="ml-1">
                  · {applied.state}
                  {applied.district ? ` / ${applied.district}` : ""}
                </span>
              ) : null}
              {applied.commodity ? (
                <span className="ml-1">· &ldquo;{applied.commodity}&rdquo;</span>
              ) : null}
              {applied.quality_grade ? (
                <span className="ml-1">· {tLots("grade", { grade: applied.quality_grade })}</span>
              ) : null}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      {isLoading ? (
        <div className="flex min-h-[30vh] items-center justify-center">
          <div className="flex items-center gap-3 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span>{t("searching")}</span>
          </div>
        </div>
      ) : lots.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-14 text-center">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
              <Sprout className="h-6 w-6 text-muted-foreground" />
            </div>
            <h3 className="text-base font-semibold">{t("emptyTitle")}</h3>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">
              {t("emptyDesc")}
            </p>
            <Button variant="outline" onClick={onReset} className="mt-6" size="sm">
              <RotateCcw className="h-4 w-4" />
              {t("resetFilters")}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {lots.map((lot) => {
            const farmerName = lot.farmer_name || t("unknownFarmer");
            const location =
              [lot.district, lot.state].filter(Boolean).join(", ");
            return (
              <Link
                key={lot.id}
                href={`/lots/${lot.id}`}
                className="group block min-w-0"
              >
                <Card className="h-full overflow-hidden transition-all duration-150 hover:-translate-y-0.5 hover:shadow-md hover:border-primary/30">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-3 min-w-0">
                      <div className="min-w-0 flex-1">
                        <CardTitle className="truncate text-base group-hover:text-primary transition-colors">
                          {lot.commodity}
                        </CardTitle>
                        <CardDescription className="mt-0.5 inline-flex items-center gap-1 text-xs truncate max-w-full">
                          <Sprout className="h-3 w-3 shrink-0" />
                          <span className="truncate">
                            {lot.commodity}
                            {lot.variety ? (
                              <span className="text-muted-foreground/70"> · {lot.variety}</span>
                            ) : null}
                          </span>
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
                    {/* Qty + Price */}
                    <div className="flex items-center gap-4 text-sm">
                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        <Scale className="h-3.5 w-3.5 shrink-0" />
                        <span>
                          <span className="font-medium text-foreground">
                            {lot.quantity_kg}
                          </span>{" "}
                          {tCommon("kg")}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        <Tag className="h-3.5 w-3.5 shrink-0" />
                        <span>
                          <span className="font-semibold text-primary">
                            {formatINR(lot.asking_price_per_kg)}
                          </span>
                          <span className="ml-0.5 text-xs">{tCommon("perKg")}</span>
                        </span>
                      </div>
                    </div>

                    {/* Grade + Location */}
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <Badge
                        variant="outline"
                        className={`${gradeBadgeClass(lot.quality_grade)} shrink-0`}
                      >
                        {tLots("grade", { grade: lot.quality_grade })}
                      </Badge>
                      {location ? (
                        <span className="inline-flex items-center gap-1 text-muted-foreground min-w-0">
                          <MapPin className="h-3 w-3 shrink-0" />
                          <span className="truncate">{location}</span>
                        </span>
                      ) : null}
                    </div>

                    {/* Farmer + View link */}
                    <div className="flex items-center justify-between border-t border-border/50 pt-3 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1.5 min-w-0">
                        <User className="h-3 w-3 shrink-0" />
                        <span className="truncate">{farmerName}</span>
                      </span>
                      <span className="inline-flex shrink-0 items-center gap-1 font-medium text-primary">
                        {t("viewLot")}
                        <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
