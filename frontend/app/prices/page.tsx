"use client";

import React, { useState, useCallback, useMemo } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { cn } from "cn";
import { apiFetch } from "@/lib/api";
import { formatINR, INDIAN_STATES, DISTRICTS_BY_STATE } from "@/lib/market-types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Search,
  TrendingUp,
  TrendingDown,
  Clock,
  IndianRupee,
  BarChart3,
  AlertCircle,
  Loader2,
  CalendarDays,
  ArrowRight,
  Sparkles,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface PriceRecord {
  date: string;
  modal_price: number;
  min_price?: number;
  max_price?: number;
}

interface ForecastPoint {
  date: string;
  price: number;
}

interface ForecastResponse {
  current_price: number;
  predicted_price_7d: number;
  predicted_price_14d: number;
  recommendation: "HOLD" | "SELL NOW" | "insufficient_data";
  reason: string;
  forecast_points: ForecastPoint[];
}

/* ------------------------------------------------------------------ */
/*  Shared commodities list                                            */
/* ------------------------------------------------------------------ */

const COMMODITIES = [
  "Wheat",
  "Rice",
  "Maize",
  "Bajra",
  "Jowar",
  "Barley",
  "Ragi",
  "Onion",
  "Potato",
  "Tomato",
  "Soyabean",
  "Groundnut",
  "Mustard",
  "Cotton",
  "Sugarcane",
  "Chilli",
  "Turmeric",
  "Garlic",
  "Ginger",
  "Arhar (Tur/Red Gram)",
  "Moong (Green Gram)",
  "Urad (Black Gram)",
  "Masoor",
  "Bengal Gram (Gram)(Whole)",
  "Banana",
  "Apple",
  "Mango",
  "Coconut",
  "Lemon",
  "Papaya",
  "Cabbage",
  "Cauliflower",
  "Brinjal",
  "Okra (Ladies Finger)",
  "Capsicum",
];

/* ------------------------------------------------------------------ */
/*  Skeleton primitives                                                */
/* ------------------------------------------------------------------ */

function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-md bg-muted",
        className
      )}
    />
  );
}

/* ------------------------------------------------------------------ */
/*  Custom Recharts tooltip                                            */
/* ------------------------------------------------------------------ */

function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { value: number; dataKey: string; stroke: string }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border bg-card px-3 py-2 shadow-xl ring-1 ring-foreground/5 backdrop-blur-sm">
      <p className="mb-1 text-xs font-medium text-muted-foreground">{label}</p>
      {payload.map((p) => (
        <div key={p.dataKey} className="flex items-center gap-2 text-sm">
          <span
            className="inline-block h-2 w-2 rounded-full"
            style={{ backgroundColor: p.stroke }}
          />
          <span className="font-semibold text-foreground">
            {formatINR(p.value)}/quintal
          </span>
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Loading skeleton                                                   */
/* ------------------------------------------------------------------ */

function DashboardSkeleton() {
  return (
    <div className="space-y-6 animate-in fade-in-0 duration-500">
      {/* Recommendation card skeleton */}
      <Card className="overflow-hidden">
        <div className="relative">
          <div className="absolute inset-0 bg-gradient-to-r from-muted/60 to-muted/30" />
          <CardContent className="relative p-6 md:p-8">
            <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
              <div className="space-y-4 flex-1">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-8 w-28 rounded-full" />
                  <Skeleton className="h-5 w-20 rounded-full" />
                </div>
                <Skeleton className="h-12 w-48" />
                <Skeleton className="h-5 w-full max-w-md" />
                <Skeleton className="h-5 w-3/4 max-w-sm" />
              </div>
              <div className="flex gap-4">
                <Skeleton className="h-24 w-36 rounded-xl" />
                <Skeleton className="h-24 w-36 rounded-xl" />
              </div>
            </div>
          </CardContent>
        </div>
      </Card>
      {/* Chart skeleton */}
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-48" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-80 w-full rounded-xl" />
        </CardContent>
      </Card>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Insufficient-data empty state                                      */
/* ------------------------------------------------------------------ */

function InsufficientDataState() {
  return (
    <Card className="border-dashed">
      <CardContent className="flex flex-col items-center justify-center py-16 px-6 text-center">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-400">
          <AlertCircle className="h-8 w-8" />
        </div>
        <h3 className="text-lg font-semibold tracking-tight">
          Insufficient Price Data
        </h3>
        <p className="mt-2 max-w-sm text-sm text-muted-foreground leading-relaxed">
          We don&apos;t have enough historical price records for this commodity in the
          selected region to generate a meaningful forecast. Try selecting a
          different commodity, state, or district.
        </p>
        <div className="mt-6 flex items-center gap-2 rounded-lg bg-muted px-4 py-2 text-xs text-muted-foreground">
          <Sparkles className="h-3.5 w-3.5" />
          Tip: Major crops in large agricultural states have the best coverage
        </div>
      </CardContent>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/*  Stat block used inside the recommendation card                     */
/* ------------------------------------------------------------------ */

function PredictionBlock({
  label,
  price,
  delta,
  icon: Icon,
}: {
  label: string;
  price: number;
  delta: number;
  icon: React.ElementType;
}) {
  const isUp = delta >= 0;
  return (
    <div className="flex flex-col items-start gap-1 rounded-xl border bg-card/60 backdrop-blur-sm px-4 py-3 min-w-[140px] transition-shadow hover:shadow-md">
      <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
        <Icon className="h-3 w-3" />
        {label}
      </span>
      <span className="text-xl font-bold tracking-tight text-foreground">
        {formatINR(price)}
      </span>
      <span
        className={cn(
          "flex items-center gap-0.5 text-xs font-semibold",
          isUp ? "text-emerald-600 dark:text-emerald-400" : "text-red-500 dark:text-red-400"
        )}
      >
        {isUp ? (
          <TrendingUp className="h-3 w-3" />
        ) : (
          <TrendingDown className="h-3 w-3" />
        )}
        {isUp ? "+" : ""}
        {delta.toFixed(1)}%
      </span>
    </div>
  );
}

/* ================================================================== */
/*  MAIN PAGE                                                          */
/* ================================================================== */

export default function PriceDiscoveryPage() {
  /* ---------- filter state ---------- */
  const [commodity, setCommodity] = useState("");
  const [state, setState] = useState("");
  const [district, setDistrict] = useState("");

  /* ---------- data state ---------- */
  const [prices, setPrices] = useState<PriceRecord[] | null>(null);
  const [forecast, setForecast] = useState<ForecastResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const districts = useMemo(
    () => (state ? DISTRICTS_BY_STATE[state] ?? [] : []),
    [state]
  );

  /* ---------- fetch handler ---------- */
  const handleSearch = useCallback(async () => {
    if (!commodity || !state || !district) return;
    setLoading(true);
    setError(null);
    setPrices(null);
    setForecast(null);
    setSearched(true);
    try {
      const [priceData, forecastData] = await Promise.all([
        apiFetch<PriceRecord[]>("/prices", {
          params: { commodity, state, district },
        }),
        apiFetch<ForecastResponse>("/forecast", {
          params: { commodity, state, district },
        }),
      ]);
      setPrices(priceData);
      setForecast(forecastData);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Something went wrong. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }, [commodity, state, district]);

  /* ---------- chart data: merge actual + predicted ---------- */
  const chartData = useMemo(() => {
    if (!prices && !forecast) return [];

    const actual = (prices ?? []).map((p) => ({
      date: new Date(p.date).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
      }),
      fullDate: p.date,
      actual: p.modal_price,
      predicted: undefined as number | undefined,
    }));

    // forecast_points includes historical + predicted — we only want the 2 future predicted points
    const forecastPts = forecast?.forecast_points ?? [];
    const lastActualDate = actual.length
      ? actual[actual.length - 1].fullDate
      : "";

    const predictedOnly = forecastPts.filter(
      (fp) => fp.date > lastActualDate
    );

    // Bridge: duplicate the last actual point so the predicted line visually connects
    if (actual.length > 0 && predictedOnly.length > 0) {
      const bridge = { ...actual[actual.length - 1] };
      bridge.predicted = bridge.actual;
      actual[actual.length - 1] = bridge;
    }

    const predicted = predictedOnly.map((fp) => ({
      date: new Date(fp.date).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
      }),
      fullDate: fp.date,
      actual: undefined as number | undefined,
      predicted: fp.price,
    }));

    return [...actual, ...predicted];
  }, [prices, forecast]);

  /* ---------- derived ---------- */
  const isInsufficient = forecast?.recommendation === "insufficient_data";
  const canSearch = commodity && state && district;

  /* ---------- recommendation badge styles ---------- */
  const recStyles =
    forecast?.recommendation === "SELL NOW"
      ? {
          gradient: "from-emerald-500/15 via-emerald-500/5 to-transparent",
          badge: "bg-emerald-500 text-white shadow-emerald-500/30",
          glow: "shadow-emerald-500/10",
          ring: "ring-emerald-500/20",
          label: "SELL NOW",
          icon: <TrendingUp className="h-5 w-5" />,
        }
      : {
          gradient: "from-amber-500/15 via-amber-500/5 to-transparent",
          badge: "bg-amber-500 text-white shadow-amber-500/30",
          glow: "shadow-amber-500/10",
          ring: "ring-amber-500/20",
          label: "HOLD",
          icon: <Clock className="h-5 w-5" />,
        };

  return (
    <div className="space-y-6 pb-12">
      {/* ===== Page header ===== */}
      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <BarChart3 className="h-6 w-6 text-primary" />
          Price Discovery
        </h1>
        <p className="text-sm text-muted-foreground">
          Real-time mandi prices and AI-powered forecasts to help you decide
          when to sell.
        </p>
      </div>

      {/* ===== Filter row ===== */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
            {/* Commodity */}
            <div className="flex flex-col gap-1.5 flex-1 min-w-[180px]">
              <Label htmlFor="price-commodity">Commodity</Label>
              <Select value={commodity} onValueChange={setCommodity}>
                <SelectTrigger id="price-commodity" className="w-full h-9">
                  <SelectValue placeholder="Select commodity" />
                </SelectTrigger>
                <SelectContent>
                  {COMMODITIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* State */}
            <div className="flex flex-col gap-1.5 flex-1 min-w-[180px]">
              <Label htmlFor="price-state">State</Label>
              <Select
                value={state}
                onValueChange={(v) => {
                  setState(v);
                  setDistrict("");
                }}
              >
                <SelectTrigger id="price-state" className="w-full h-9">
                  <SelectValue placeholder="Select state" />
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

            {/* District */}
            <div className="flex flex-col gap-1.5 flex-1 min-w-[180px]">
              <Label htmlFor="price-district">District</Label>
              <Select
                value={district}
                onValueChange={setDistrict}
                disabled={!state}
              >
                <SelectTrigger id="price-district" className="w-full h-9">
                  <SelectValue
                    placeholder={
                      state ? "Select district" : "Choose a state first"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {districts.map((d) => (
                    <SelectItem key={d} value={d}>
                      {d}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Search */}
            <Button
              size="lg"
              disabled={!canSearch || loading}
              onClick={handleSearch}
              className="h-9 gap-2 px-5 shadow-sm"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Search className="h-4 w-4" />
              )}
              Search
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ===== Loading ===== */}
      {loading && <DashboardSkeleton />}

      {/* ===== Error ===== */}
      {error && !loading && (
        <Card className="border-destructive/30">
          <CardContent className="flex items-center gap-3 py-4">
            <AlertCircle className="h-5 w-5 text-destructive shrink-0" />
            <p className="text-sm text-destructive">{error}</p>
          </CardContent>
        </Card>
      )}

      {/* ===== Insufficient data ===== */}
      {!loading && !error && isInsufficient && <InsufficientDataState />}

      {/* ===== Results ===== */}
      {!loading &&
        !error &&
        forecast &&
        !isInsufficient && (
          <div className="space-y-6 animate-in fade-in-0 slide-in-from-bottom-4 duration-500">
            {/* ---------- Recommendation card ---------- */}
            <Card
              className={cn(
                "overflow-hidden ring-1 transition-shadow",
                recStyles.ring,
                recStyles.glow
              )}
            >
              <div className="relative">
                <div
                  className={cn(
                    "absolute inset-0 bg-gradient-to-r",
                    recStyles.gradient
                  )}
                />
                <CardContent className="relative p-6 md:p-8">
                  <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
                    {/* Left — badge + current price + reason */}
                    <div className="space-y-3 flex-1">
                      <div className="flex items-center gap-3">
                        <span
                          className={cn(
                            "inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-bold shadow-lg tracking-wide",
                            recStyles.badge
                          )}
                        >
                          {recStyles.icon}
                          {recStyles.label}
                        </span>
                        <span className="rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground">
                          AI Recommendation
                        </span>
                      </div>

                      <div className="space-y-0.5">
                        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                          <IndianRupee className="h-3 w-3" />
                          Current Modal Price
                        </p>
                        <p className="text-4xl font-extrabold tracking-tight">
                          {formatINR(forecast.current_price)}
                          <span className="ml-1 text-base font-normal text-muted-foreground">
                            /quintal
                          </span>
                        </p>
                      </div>

                      <p className="max-w-lg text-sm leading-relaxed text-muted-foreground">
                        {forecast.reason}
                      </p>
                    </div>

                    {/* Right — prediction stat blocks */}
                    <div className="flex gap-3 flex-wrap sm:flex-nowrap">
                      <PredictionBlock
                        label="7-Day Forecast"
                        price={forecast.predicted_price_7d}
                        delta={
                          ((forecast.predicted_price_7d -
                            forecast.current_price) /
                            forecast.current_price) *
                          100
                        }
                        icon={CalendarDays}
                      />
                      <PredictionBlock
                        label="14-Day Forecast"
                        price={forecast.predicted_price_14d}
                        delta={
                          ((forecast.predicted_price_14d -
                            forecast.current_price) /
                            forecast.current_price) *
                          100
                        }
                        icon={CalendarDays}
                      />
                    </div>
                  </div>
                </CardContent>
              </div>
            </Card>

            {/* ---------- Chart ---------- */}
            <Card>
              <CardHeader className="flex-row items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-base">
                  <BarChart3 className="h-4 w-4 text-muted-foreground" />
                  Price Trend &amp; Forecast
                </CardTitle>
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <span className="inline-block h-2 w-6 rounded-full bg-[hsl(var(--chart-1))]" />
                    Actual
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="inline-block h-2 w-6 rounded-full bg-[hsl(var(--chart-2))]" style={{ backgroundImage: "repeating-linear-gradient(90deg, hsl(var(--chart-2)) 0 4px, transparent 4px 8px)" }} />
                    Predicted
                  </span>
                </div>
              </CardHeader>
              <CardContent>
                <div className="h-80 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={chartData}
                      margin={{ top: 8, right: 24, left: 8, bottom: 0 }}
                    >
                      <defs>
                        <linearGradient
                          id="actualGrad"
                          x1="0"
                          y1="0"
                          x2="0"
                          y2="1"
                        >
                          <stop
                            offset="0%"
                            stopColor="hsl(var(--chart-1))"
                            stopOpacity={0.15}
                          />
                          <stop
                            offset="100%"
                            stopColor="hsl(var(--chart-1))"
                            stopOpacity={0}
                          />
                        </linearGradient>
                      </defs>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        className="stroke-border"
                        vertical={false}
                      />
                      <XAxis
                        dataKey="date"
                        tick={{ fontSize: 11 }}
                        className="fill-muted-foreground"
                        tickLine={false}
                        axisLine={false}
                      />
                      <YAxis
                        tick={{ fontSize: 11 }}
                        className="fill-muted-foreground"
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={(v: number) => `₹${v.toLocaleString("en-IN")}`}
                        label={{
                          value: "₹/quintal",
                          angle: -90,
                          position: "insideLeft",
                          offset: -4,
                          className: "fill-muted-foreground text-[10px]",
                        }}
                      />
                      <Tooltip
                        content={<ChartTooltip />}
                        cursor={{
                          stroke: "hsl(var(--muted-foreground))",
                          strokeDasharray: "4 4",
                          strokeOpacity: 0.4,
                        }}
                      />
                      {/* Actual price line */}
                      <Line
                        type="monotone"
                        dataKey="actual"
                        stroke="hsl(var(--chart-1))"
                        strokeWidth={2.5}
                        dot={false}
                        activeDot={{
                          r: 5,
                          stroke: "hsl(var(--chart-1))",
                          strokeWidth: 2,
                          fill: "hsl(var(--card))",
                        }}
                        connectNulls={false}
                      />
                      {/* Predicted price line (dashed) */}
                      <Line
                        type="monotone"
                        dataKey="predicted"
                        stroke="hsl(var(--chart-2))"
                        strokeWidth={2.5}
                        strokeDasharray="6 4"
                        dot={{
                          r: 4,
                          stroke: "hsl(var(--chart-2))",
                          strokeWidth: 2,
                          fill: "hsl(var(--card))",
                        }}
                        activeDot={{
                          r: 5,
                          stroke: "hsl(var(--chart-2))",
                          strokeWidth: 2,
                          fill: "hsl(var(--card))",
                        }}
                        connectNulls={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

      {/* ===== No search yet ===== */}
      {!loading && !error && !forecast && !searched && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-20 px-6 text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <BarChart3 className="h-8 w-8" />
            </div>
            <h3 className="text-lg font-semibold tracking-tight">
              Discover Market Prices
            </h3>
            <p className="mt-2 max-w-sm text-sm text-muted-foreground leading-relaxed">
              Select a commodity, state, and district above, then click{" "}
              <strong>Search</strong> to view recent mandi prices and get an
              AI-powered recommendation.
            </p>
            <div className="mt-6 flex items-center gap-2 text-xs text-muted-foreground">
              <span className="rounded bg-muted px-2 py-1">Commodity</span>
              <ArrowRight className="h-3 w-3" />
              <span className="rounded bg-muted px-2 py-1">State</span>
              <ArrowRight className="h-3 w-3" />
              <span className="rounded bg-muted px-2 py-1">District</span>
              <ArrowRight className="h-3 w-3" />
              <span className="rounded bg-primary/10 text-primary px-2 py-1 font-medium">
                Insights
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ===== Searched but no results (non-insufficient) ===== */}
      {!loading && !error && !forecast && searched && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 px-6 text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
              <Search className="h-8 w-8" />
            </div>
            <h3 className="text-lg font-semibold tracking-tight">
              No Results Found
            </h3>
            <p className="mt-2 max-w-sm text-sm text-muted-foreground leading-relaxed">
              We couldn&apos;t find any price data for the selected filters.
              Try adjusting your search.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
