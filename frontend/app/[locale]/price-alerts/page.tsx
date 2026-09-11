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
    <div className="mx-auto max-w-2xl space-y-6 py-6">
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
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <BellPlus className="h-5 w-5 text-primary" aria-hidden="true" />
                {t("createTitle")}
              </CardTitle>
              <CardDescription>{t("subtitle")}</CardDescription>
            </CardHeader>
            <form onSubmit={create}>
              <CardContent className="space-y-4">
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
                    <Label>{t("state")}</Label>
                    <Select value={state} onValueChange={(v) => { setState(v); setDistrict(""); }}>
                      <SelectTrigger>
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
                    <Label>{t("district")}</Label>
                    <Select value={district} onValueChange={setDistrict} disabled={!state}>
                      <SelectTrigger>
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

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="alert-price">{t("targetPrice")}</Label>
                    <Input
                      id="alert-price"
                      type="number"
                      inputMode="decimal"
                      min="0.01"
                      step="0.01"
                      className="font-semibold"
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
                      className="flex gap-2 py-2"
                    >
                      <Label
                        htmlFor="cond-above"
                        className={`flex-1 cursor-pointer rounded-md border p-2 text-center text-sm ${
                          condition === "at_or_below"
                            ? "border-primary bg-primary/5 text-primary"
                            : "border-border"
                        }`}
                      >
                        <RadioGroupItem id="cond-above" value="at_or_below" className="sr-only" />
                        <TrendingDown className="mx-auto mb-1 h-4 w-4" aria-hidden="true" />
                        {t("atOrBelow")}
                      </Label>
                      <Label
                        htmlFor="cond-below"
                        className={`flex-1 cursor-pointer rounded-md border p-2 text-center text-sm ${
                          condition === "at_or_above"
                            ? "border-primary bg-primary/5 text-primary"
                            : "border-border"
                        }`}
                      >
                        <RadioGroupItem id="cond-below" value="at_or_above" className="sr-only" />
                        <TrendingUp className="mx-auto mb-1 h-4 w-4" aria-hidden="true" />
                        {t("atOrAbove")}
                      </Label>
                    </RadioGroup>
                  </div>
                </div>

                <Button
                  type="submit"
                  className="w-full"
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
              </CardContent>
            </form>
          </Card>

          <div className="space-y-3">
            <h2 className="text-lg font-semibold">{t("activeTitle")}</h2>
            {alerts.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center gap-2 py-10 text-center">
                  <BellOff className="h-9 w-9 text-muted-foreground" />
                  <h3 className="font-medium">{t("emptyTitle")}</h3>
                  <p className="max-w-sm text-sm text-muted-foreground">{t("emptyDesc")}</p>
                </CardContent>
              </Card>
            ) : (
              <ul className="space-y-2">
                {alerts.map((a) => (
                  <li key={a.id}>
                    <Card>
                      <CardContent className="flex items-center justify-between gap-3 py-3">
                        <div className="min-w-0">
                          <p className="font-medium">
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
                        <div className="flex shrink-0 items-center gap-2">
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
                            className="text-muted-foreground hover:text-red-600"
                          >
                            <X className="h-4 w-4" aria-hidden="true" />
                            <span className="sr-only">{t("delete")}</span>
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  </li>
                ))}
              </ul>
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