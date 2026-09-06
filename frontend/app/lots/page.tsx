"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
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
      const msg = err instanceof Error ? err.message : "Failed to load lots";
      toast.error(msg);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadLots(applied);
  }, [applied, loadLots]);

  const districtOptions = useMemo(
    () => (applied.state ? DISTRICTS_BY_STATE[applied.state] ?? [] : []),
    [applied.state]
  );

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
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Browse Lots</h1>
        <p className="text-sm text-muted-foreground">
          Discover fresh produce listed by verified farmers across the country.
        </p>
      </div>

      <Card className="border-muted">
        <CardContent className="p-5">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
            <div className="space-y-2 lg:col-span-1">
              <Label htmlFor="flt-commodity">Commodity</Label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="flt-commodity"
                  placeholder="e.g. Tomato, Onion"
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

            <div className="space-y-2">
              <Label htmlFor="flt-state">State</Label>
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
                  <SelectValue placeholder="All states" />
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
              <Label htmlFor="flt-district">District</Label>
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
                      filters.state ? "Select district" : "Pick a state first"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {availableDistricts.length === 0 ? (
                    <SelectItem value="__none" disabled>
                      No districts available
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

            <div className="space-y-2">
              <Label htmlFor="flt-grade">Quality Grade</Label>
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
                  <SelectValue placeholder="Any grade" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="A">Grade A — Premium</SelectItem>
                  <SelectItem value="B">Grade B — Standard</SelectItem>
                  <SelectItem value="C">Grade C — Economy</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="flt-status">Status</Label>
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
                  <SelectValue placeholder="Any status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="available">Available</SelectItem>
                  <SelectItem value="reserved">Reserved</SelectItem>
                  <SelectItem value="sold">Sold</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Button
              onClick={onApply}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              <Search className="mr-2 h-4 w-4" />
              Apply filters
            </Button>
            <Button variant="outline" onClick={onReset}>
              <RotateCcw className="mr-2 h-4 w-4" />
              Reset
            </Button>
            <span className="ml-auto text-sm text-muted-foreground">
              {!isLoading && (
                <span className="font-medium text-foreground">
                  {lots.length}
                </span>
              )}{" "}
              lots found
              {applied.state ? (
                <span className="ml-1">
                  · {applied.state}
                  {applied.district ? ` / ${applied.district}` : ""}
                </span>
              ) : null}
              {applied.commodity ? (
                <span className="ml-1">· "{applied.commodity}"</span>
              ) : null}
              {applied.quality_grade ? (
                <span className="ml-1">· Grade {applied.quality_grade}</span>
              ) : null}
            </span>
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="flex min-h-[40vh] items-center justify-center">
          <div className="flex items-center gap-3 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span>Searching lots…</span>
          </div>
        </div>
      ) : lots.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Sprout className="mb-4 h-12 w-12 text-slate-300" />
            <h3 className="text-lg font-semibold">No lots match your filters</h3>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">
              Try broadening your search — remove filters or change the
              commodity.
            </p>
            <Button variant="outline" onClick={onReset} className="mt-6">
              <RotateCcw className="mr-2 h-4 w-4" />
              Reset filters
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {lots.map((lot) => {
            const farmerName =
              lot.farmer?.name || lot.farmer_name || "Unknown Farmer";
            const district = lot.district ?? "";
            const state = lot.state ?? "";
            const location =
              [district, state].filter(Boolean).join(", ") ||
              lot.location ||
              "";
            return (
              <Link
                key={lot.id}
                href={`/lots/${lot.id}`}
                className="group block"
              >
                <Card className="h-full overflow-hidden transition-all hover:-translate-y-0.5 hover:shadow-md">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <CardTitle className="truncate text-lg group-hover:text-emerald-700">
                          {lot.title}
                        </CardTitle>
                        <CardDescription className="mt-1 inline-flex items-center gap-1 text-sm">
                          <Sprout className="h-3.5 w-3.5" />
                          {lot.produce || lot.commodity || "Produce"}
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
                        {lot.status.charAt(0).toUpperCase() +
                          lot.status.slice(1)}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3 pt-0">
                    <div className="flex items-center gap-4 text-sm">
                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        <Scale className="h-4 w-4" />
                        <span>
                          <span className="font-medium text-foreground">
                            {lot.quantity}
                          </span>{" "}
                          {lot.unit}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        <Tag className="h-4 w-4" />
                        <span>
                          <span className="font-semibold text-emerald-700">
                            {formatINR(lot.price_per_unit)}
                          </span>
                          <span className="ml-0.5">/{lot.unit}</span>
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-xs">
                      <Badge
                        variant="outline"
                        className={gradeBadgeClass(lot.quality_grade)}
                      >
                        Grade {lot.quality_grade}
                      </Badge>
                      {location ? (
                        <span className="inline-flex items-center gap-1 text-muted-foreground">
                          <MapPin className="h-3.5 w-3.5" />
                          {location}
                        </span>
                      ) : null}
                    </div>

                    <div className="flex items-center justify-between border-t pt-3 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1.5">
                        <User className="h-3.5 w-3.5" />
                        {farmerName}
                      </span>
                      <span className="inline-flex items-center gap-1 font-medium text-emerald-600 group-hover:text-emerald-700">
                        View lot
                        <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
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
