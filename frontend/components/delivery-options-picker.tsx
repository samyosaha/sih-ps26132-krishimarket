"use client";

import { useEffect, useState, useCallback } from "react";
import { apiFetch } from "@/lib/api";
import {
  DELIVERY_METHOD_OPTIONS,
  type FulfillmentRecommendation,
  formatINR,
} from "@/lib/market-types";
import {
  Truck,
  Train,
  PackageCheck,
  Boxes,
  Sparkles,
  Clock,
  IndianRupee,
  Loader2,
  CheckCircle2,
  Info,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface Props {
  lotId: number | string;
  buyerDistrict: string;
  perishable?: boolean;
  selectedMethod: string;
  onSelectMethod: (method: string) => void;
  className?: string;
}

export function DeliveryOptionsPicker({
  lotId,
  buyerDistrict,
  perishable = false,
  selectedMethod,
  onSelectMethod,
  className = "",
}: Props) {
  const [recommendation, setRecommendation] =
    useState<FulfillmentRecommendation | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchRecommendation = useCallback(async () => {
    if (!lotId || !buyerDistrict?.trim()) return;
    setIsLoading(true);
    setError(null);
    try {
      const url = `/lots/${lotId}/fulfillment-recommendation?buyer_district=${encodeURIComponent(
        buyerDistrict.trim()
      )}&perishable=${Boolean(perishable)}`;
      const data = await apiFetch<FulfillmentRecommendation>(url);
      setRecommendation(data);
      // Auto-select recommendation if no method is selected or if default pending
      if (!selectedMethod || selectedMethod === "pending") {
        onSelectMethod(data.method);
      }
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : "Failed to load fulfillment recommendation";
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  }, [lotId, buyerDistrict, perishable, selectedMethod, onSelectMethod]);

  useEffect(() => {
    fetchRecommendation();
  }, [fetchRecommendation]);

  const getMethodIcon = (key: string) => {
    switch (key) {
      case "buyer_pickup":
        return <PackageCheck className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />;
      case "local_transporter":
        return <Truck className="h-5 w-5 text-blue-600 dark:text-blue-400" />;
      case "kisan_rail":
        return <Train className="h-5 w-5 text-amber-600 dark:text-amber-400" />;
      case "consolidated_truck":
        return <Boxes className="h-5 w-5 text-purple-600 dark:text-purple-400" />;
      default:
        return <Truck className="h-5 w-5 text-slate-600 dark:text-slate-400" />;
    }
  };

  const getFormattedMethodName = (key: string) => {
    const found = DELIVERY_METHOD_OPTIONS.find((o) => o.key === key);
    if (found) return found.label;
    return key
      .replace(/_/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase());
  };

  return (
    <div className={`space-y-4 ${className}`}>
      {/* ── 1. Recommendation Highlight Card ──────────────────────── */}
      {isLoading ? (
        <div className="flex items-center justify-center gap-2.5 rounded-lg border border-border bg-muted/30 p-4 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin text-emerald-600" />
          <span>Analyzing logistics route and best fulfillment method…</span>
        </div>
      ) : error ? (
        <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-800/50 dark:bg-amber-950/30 dark:text-amber-300">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
          <div>
            <p className="font-semibold">Logistics advice notice</p>
            <p className="mt-0.5">{error}. You can still choose your preferred delivery method below.</p>
          </div>
        </div>
      ) : recommendation ? (
        <div
          role="button"
          tabIndex={0}
          onClick={() => onSelectMethod(recommendation.method)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              onSelectMethod(recommendation.method);
            }
          }}
          className={`relative cursor-pointer rounded-lg border-2 p-4 transition-all ${
            selectedMethod === recommendation.method
              ? "border-emerald-600 bg-emerald-50/50 shadow-sm ring-1 ring-emerald-500/30 dark:border-emerald-500 dark:bg-emerald-950/30"
              : "border-border bg-card hover:border-emerald-500/50 hover:bg-slate-50 dark:hover:bg-slate-900/50"
          }`}
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/60">
                <Sparkles className="h-4 w-4 text-emerald-700 dark:text-emerald-300" />
              </span>
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                Recommended Fulfillment Option
              </span>
            </div>

            {selectedMethod === recommendation.method ? (
              <Badge className="bg-emerald-600 hover:bg-emerald-600 text-white font-semibold">
                <CheckCircle2 className="mr-1 h-3 w-3" /> Selected Default
              </Badge>
            ) : (
              <Badge variant="outline" className="border-emerald-300 text-emerald-700 dark:text-emerald-300">
                Click to Select
              </Badge>
            )}
          </div>

          <div className="mt-2.5 flex items-start gap-3">
            <div className="mt-0.5 rounded-md border border-border bg-card p-2 shadow-xs">
              {getMethodIcon(recommendation.method)}
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="text-base font-bold text-foreground">
                {getFormattedMethodName(recommendation.method)}
              </h4>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground sm:text-sm">
                {recommendation.reason}
              </p>
            </div>
          </div>

          {/* Cost & Hours badges */}
          <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-border/70 pt-2.5 text-xs text-muted-foreground">
            <div className="flex items-center gap-1">
              <IndianRupee className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
              <span className="font-semibold text-foreground">
                {recommendation.estimated_cost !== null && recommendation.estimated_cost !== undefined
                  ? formatINR(recommendation.estimated_cost)
                  : recommendation.method === "buyer_pickup"
                  ? "₹0 (Buyer Pickup)"
                  : recommendation.method === "kisan_rail"
                  ? "Rail Freight (50% Subsidy Eligible)"
                  : "Direct Transporter Freight"}
              </span>
            </div>

            {recommendation.estimated_hours !== null &&
              recommendation.estimated_hours !== undefined && (
                <div className="flex items-center gap-1 border-l border-border pl-3">
                  <Clock className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                  <span className="font-semibold text-foreground">
                    ~{recommendation.estimated_hours} hrs transit
                  </span>
                </div>
              )}
          </div>
        </div>
      ) : null}

      {/* ── 2. Plainly Selectable Alternatives ────────────────────── */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            All Available Delivery Methods
          </label>
          <span className="text-[11px] text-muted-foreground">
            Whichever you pick will be used for dispatch
          </span>
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          {DELIVERY_METHOD_OPTIONS.map((option) => {
            const isSelected = selectedMethod === option.key;
            const isRecommended = recommendation?.method === option.key;

            return (
              <div
                key={option.key}
                role="button"
                tabIndex={0}
                onClick={() => onSelectMethod(option.key)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onSelectMethod(option.key);
                  }
                }}
                className={`relative flex cursor-pointer flex-col justify-between rounded-lg border p-3 transition-all ${
                  isSelected
                    ? "border-emerald-600 bg-emerald-50/40 ring-2 ring-emerald-500/20 dark:border-emerald-500 dark:bg-emerald-950/30"
                    : "border-border bg-card hover:border-emerald-400/60 hover:bg-slate-50/80 dark:hover:bg-slate-900/40"
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-1.5">
                    <div className="flex items-center gap-2">
                      <div className="rounded border border-border bg-muted/40 p-1.5">
                        {getMethodIcon(option.key)}
                      </div>
                      <span className="font-semibold text-sm text-foreground">
                        {option.label}
                      </span>
                    </div>

                    <div
                      className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${
                        isSelected
                          ? "border-emerald-600 bg-emerald-600 text-white dark:border-emerald-500 dark:bg-emerald-500"
                          : "border-border bg-card"
                      }`}
                    >
                      {isSelected && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
                    </div>
                  </div>

                  <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
                    {option.description}
                  </p>
                </div>

                <div className="mt-2.5 flex items-center gap-1.5 pt-1">
                  {isRecommended && (
                    <Badge variant="secondary" className="bg-emerald-100 text-emerald-800 text-[10px] dark:bg-emerald-950 dark:text-emerald-300">
                      Recommended
                    </Badge>
                  )}
                  {option.badge && (
                    <Badge variant="outline" className="border-amber-300 text-amber-800 dark:text-amber-300 text-[10px]">
                      {option.badge}
                    </Badge>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
