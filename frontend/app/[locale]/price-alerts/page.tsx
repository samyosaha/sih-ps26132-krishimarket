"use client";

import { useCallback, useEffect, useState, FormEvent } from "react";
import { useTranslations } from "next-intl";
import { useAuth } from "@/lib/auth-context";
import { apiFetch } from "@/lib/api";
import { INDIAN_STATES, DISTRICTS_BY_STATE } from "@/lib/market-types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, BellPlus, BellOff, TrendingUp, TrendingDown, X } from "lucide-react";
import { toast } from "sonner";
import { VoiceInput } from "@/components/voice-input";
import { AuthenticatedRouteGuard } from "@/components/authenticated-route-guard";

interface PriceAlert {
  id: number;
  commodity: string;
  state?: string | null;
  district?: string | null;
  target_price: number;
  condition: "at_or_above" | "at_or_below";
  is_active: boolean;
  created_at?: string | null;
}

function PriceAlertsInner() {
  const t = useTranslations("alerts");
  const browseT = useTranslations("lots.browse");
  const { isAuthenticated, isLoading } = useAuth();

  const [commodity, setCommodity] = useState("");
  const [state, setState] = useState("");
  const [district, setDistrict] = useState("");
  const [targetPrice, setTargetPrice] = useState("");
  const [condition, setCondition] = useState<"at_or_above" | "at_or_below">("at_or_below");
  const [alerts, setAlerts] = useState<PriceAlert[]>([]);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  const districts = state ? (DISTRICTS_BY_STATE[state] ?? []) : [];

  const load = useCallback(async () => {
    if (!isAuthenticated) return;
    setLoading(true);
    try {
      const res = await apiFetch<PriceAlert[]>("/price-alerts/me", {
        params: { active_only: true },
      });
      setAlerts(Array.isArray(res) ? res : []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, t]);

  useEffect(() => {
    load();
  }, [load]);

  const create = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const price = Number(targetPrice);
    if (!commodity.trim() || !Number.isFinite(price) || price <= 0) {
      toast.error(t("targetRequired"));
      return;
    }
    setBusy(true);
    try {
      await apiFetch("/price-alerts", {
        method: "POST",
        body: JSON.stringify({
          commodity: commodity.trim(),
          state: state || null,
          district: district || null,
          target_price: price,
          condition,
        }),
      });
      toast.success(t("createSuccess"));
      setCommodity("");
      setTargetPrice("");
      setDistrict("");
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("loadFailed"));
    } finally {
      setBusy(false);
    }
  };

  const deactivate = async (id: number) => {
    try {
      await apiFetch(`/price-alerts/${id}`, { method: "DELETE" });
      setAlerts((prev) => prev.filter((a) => a.id !== id));
      toast.success(t("deleted"));
    } catch {
      toast.error(t("loadFailed"));
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>

      {isLoading || loading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : !isAuthenticated ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            {browseT("getStarted")} — <a href="/login" className="underline">{browseT("alreadyMember")}</a>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card className="border border-border/80 shadow-xs">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2 text-lg">
                <BellPlus className="h-5 w-5 text-primary" aria-hidden="true" />
                {t("createTitle")}
              </CardTitle>
              <CardDescription>{t("subtitle")}</CardDescription>
            </CardHeader>
            <form onSubmit={create}>
              <CardContent className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="alert-commodity">{browseT("commodity")}</Label>
                  <VoiceInput
                    value={commodity}
                    onChange={setCommodity}
                    placeholder={browseT("commodityPlaceholder")}
                    id="alert-commodity"
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="alert-state">{t("state")}</Label>
                    <Select value={state} onValueChange={(v) => { setState(v); setDistrict(""); }}>
                      <SelectTrigger id="alert-state">
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

                  <div className="space-y-2">
                    <Label htmlFor="alert-district">{t("district")}</Label>
                    <Select value={district} onValueChange={setDistrict} disabled={!state}>
                      <SelectTrigger id="alert-district">
                        <SelectValue
                          placeholder={state ? browseT("chooseDistrict") : browseT("chooseStateFirst")}
                        />
                      </SelectTrigger>
                      <SelectContent>
                        {districts.length === 0 ? (
                          <div className="flex justify-center p-3 text-sm text-muted-foreground">
                            {t("noDistricts")}
                          </div>
                        ) : (
                          districts.map((d) => (
                            <SelectItem key={d} value={d}>
                              {d}
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2 items-start">
                  <div className="space-y-2">
                    <Label htmlFor="alert-price">{t("targetPrice")}</Label>
                    <Input
                      id="alert-price"
                      type="number"
                      inputMode="decimal"
                      min="0.01"
                      step="0.01"
                      className="h-10 font-semibold"
                      placeholder="₹ 2,000"
                      value={targetPrice}
                      onChange={(e) => setTargetPrice(e.target.value)}
                      disabled={busy}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>{t("condition")}</Label>
                    <RadioGroup
                      value={condition}
                      onValueChange={(v) =>
                        setCondition(v as "at_or_above" | "at_or_below")
                      }
                      className="grid grid-cols-2 gap-2"
                    >
                      <Label
                        htmlFor="cond-above"
                        className={`flex h-10 cursor-pointer items-center justify-center gap-2 rounded-md border px-3 text-sm font-medium transition-colors ${
                          condition === "at_or_below"
                            ? "border-primary bg-primary/10 text-primary font-semibold"
                            : "border-border text-muted-foreground hover:bg-muted hover:text-foreground"
                        }`}
                      >
                        <RadioGroupItem id="cond-above" value="at_or_below" className="sr-only" />
                        <TrendingDown className="h-4 w-4 shrink-0" aria-hidden="true" />
                        <span className="truncate">{t("atOrBelow")}</span>
                      </Label>
                      <Label
                        htmlFor="cond-below"
                        className={`flex h-10 cursor-pointer items-center justify-center gap-2 rounded-md border px-3 text-sm font-medium transition-colors ${
                          condition === "at_or_above"
                            ? "border-primary bg-primary/10 text-primary font-semibold"
                            : "border-border text-muted-foreground hover:bg-muted hover:text-foreground"
                        }`}
                      >
                        <RadioGroupItem id="cond-below" value="at_or_above" className="sr-only" />
                        <TrendingUp className="h-4 w-4 shrink-0" aria-hidden="true" />
                        <span className="truncate">{t("atOrAbove")}</span>
                      </Label>
                    </RadioGroup>
                  </div>
                </div>

                <div className="pt-2">
                  <Button
                    type="submit"
                    className="w-full sm:w-auto sm:min-w-[160px]"
                    disabled={busy}
                  >
                    {busy ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        {t("saving")}
                      </>
                    ) : (
                      t("save")
                    )}
                  </Button>
                </div>
              </CardContent>
            </form>
          </Card>

          <div className="space-y-4">
            <h2 className="text-lg font-semibold tracking-tight">{t("activeTitle")}</h2>
            {alerts.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center gap-2 py-12 text-center">
                  <div className="flex h-11 w-11 items-center justify-center rounded-full bg-muted">
                    <BellOff className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <h3 className="font-semibold text-base">{t("emptyTitle")}</h3>
                  <p className="max-w-sm text-sm text-muted-foreground">{t("emptyDesc")}</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {alerts.map((a) => (
                  <Card key={a.id} className="transition-all hover:shadow-xs">
                    <CardContent className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-4">
                      <div className="min-w-0 flex-1 space-y-1">
                        <p className="font-medium text-foreground">
                          {t("matches", {
                            commodity: a.commodity,
                            state: a.state ? `${a.state}${a.district ? ` / ${a.district}` : ""}` : "—",
                            condition:
                              a.condition === "at_or_above"
                                ? t("conditionAtOrAbove")
                                : t("conditionAtOrBelow"),
                            price: `₹${Number(a.target_price).toLocaleString("en-IN")}`,
                          })}
                        </p>
                        {a.created_at && (
                          <p className="text-xs text-muted-foreground">
                            {new Date(a.created_at).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                      <div className="flex shrink-0 items-center gap-2 self-end sm:self-center">
                        <Badge
                          variant="outline"
                          className={
                            a.condition === "at_or_above"
                              ? "border-primary/30 bg-primary/10 text-primary"
                              : "border-sky-500/30 bg-sky-500/10 text-sky-600 dark:text-sky-400"
                          }
                        >
                          {a.condition === "at_or_above" ? t("atOrAbove") : t("atOrBelow")}
                        </Badge>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deactivate(a.id)}
                          className="h-8 w-8 p-0 text-muted-foreground hover:text-red-600 hover:bg-red-500/10"
                        >
                          <X className="h-4 w-4" aria-hidden="true" />
                          <span className="sr-only">{t("delete")}</span>
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default function PriceAlertsPage() {
  return (
    <AuthenticatedRouteGuard>
      <PriceAlertsInner />
    </AuthenticatedRouteGuard>
  );
}