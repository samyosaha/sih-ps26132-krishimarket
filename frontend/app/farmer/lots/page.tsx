"use client";

import { useEffect, useState, FormEvent, useCallback } from "react";
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
} from "lucide-react";
import {
  Lot,
  QualityGrade,
  LOT_STATUS_STYLES,
  gradeBadgeClass,
  formatINR,
  INDIAN_STATES,
  DISTRICTS_BY_STATE,
} from "@/lib/market-types";

interface CreateLotPayload {
  commodity: string;
  variety?: string;
  quantity_kg: number;
  quality_grade: QualityGrade;
  asking_price_per_kg: number;
  district: string;
  state: string;
}

const emptyForm = (): CreateLotPayload => ({
  commodity: "",
  variety: "",
  quantity_kg: 0,
  quality_grade: "A",
  asking_price_per_kg: 0,
  district: "",
  state: "",
});

function FarmerLotsInner() {
  const [lots, setLots] = useState<Lot[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<CreateLotPayload>(emptyForm());
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadLots = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await apiFetch<Lot[]>("/lots/mine");
      setLots(data);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to load lots";
      toast.error(msg);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadLots();
  }, [loadLots]);

  const updateField = <K extends keyof CreateLotPayload>(
    key: K,
    value: CreateLotPayload[K]
  ) => setForm((prev) => ({ ...prev, [key]: value }));

  const availableDistricts = form.state
    ? DISTRICTS_BY_STATE[form.state] ?? []
    : [];

  const handleCreate = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
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
      toast.success("Lot listed successfully!");
      setDialogOpen(false);
      setForm(emptyForm());
      await loadLots();
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Failed to create lot";
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">My Lots</h1>
          <p className="text-sm text-muted-foreground">
            Manage the produce you have listed on KrishiMarket.
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-emerald-600 hover:bg-emerald-700 gap-2">
              <Plus className="h-4 w-4" />
              Create Lot
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>List a new lot</DialogTitle>
              <DialogDescription>
                Fill in the details below — buyers will see this
                information when browsing.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreate} className="space-y-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="commodity">Commodity</Label>
                  <Input
                    id="commodity"
                    required
                    placeholder="e.g. Tomato, Onion, Wheat"
                    value={form.commodity}
                    onChange={(e) => updateField("commodity", e.target.value)}
                    disabled={isSubmitting}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="variety">Variety <span className="text-muted-foreground">(optional)</span></Label>
                  <Input
                    id="variety"
                    placeholder="e.g. Heirloom, Desi"
                    value={form.variety}
                    onChange={(e) => updateField("variety", e.target.value)}
                    disabled={isSubmitting}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="quantity">Quantity (kg)</Label>
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
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="price">Asking Price per kg (₹)</Label>
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
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="quality">Quality Grade</Label>
                  <Select
                    value={form.quality_grade}
                    onValueChange={(v) =>
                      updateField("quality_grade", v as QualityGrade)
                    }
                    disabled={isSubmitting}
                  >
                    <SelectTrigger id="quality">
                      <SelectValue placeholder="Select grade" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="A">Grade A — Premium</SelectItem>
                      <SelectItem value="B">Grade B — Standard</SelectItem>
                      <SelectItem value="C">Grade C — Economy</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="state">State</Label>
                  <Select
                    value={form.state || ""}
                    onValueChange={(v) => {
                      updateField("state", v);
                      updateField("district", "");
                    }}
                    disabled={isSubmitting}
                  >
                    <SelectTrigger id="state">
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
                <div className="space-y-2">
                  <Label htmlFor="district">District</Label>
                  <Select
                    value={form.district || ""}
                    onValueChange={(v) => updateField("district", v)}
                    disabled={isSubmitting || !form.state}
                  >
                    <SelectTrigger id="district">
                      <SelectValue
                        placeholder={
                          form.state ? "Select district" : "Pick a state first"
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
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setDialogOpen(false)}
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="bg-emerald-600 hover:bg-emerald-700"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Publishing…
                    </>
                  ) : (
                    "Publish Lot"
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
            <span>Loading your lots…</span>
          </div>
        </div>
      ) : lots.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Sprout className="mb-4 h-12 w-12 text-emerald-300" />
            <h3 className="text-lg font-semibold">No lots yet</h3>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">
              You haven&apos;t listed any produce yet. Click &quot;Create
              Lot&quot; to publish your first harvest.
            </p>
            <Button
              onClick={() => setDialogOpen(true)}
              className="mt-6 bg-emerald-600 hover:bg-emerald-700"
            >
              <Plus className="mr-2 h-4 w-4" />
              Create your first lot
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
                      {lot.status.charAt(0).toUpperCase() + lot.status.slice(1)}
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
                        kg
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <Tag className="h-4 w-4" />
                      <span>
                        <span className="font-semibold text-emerald-700">
                          {formatINR(lot.asking_price_per_kg)}
                        </span>
                        /kg
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
