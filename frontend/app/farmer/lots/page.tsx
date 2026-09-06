"use client";

import { useEffect, useState, FormEvent, useCallback } from "react";
import { useRouter } from "next/navigation";
import { FarmerRouteGuard } from "@/components/farmer-route-guard";
import { apiFetch } from "@/lib/api";
import { toast } from "sonner";
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
  Calendar,
  Scale,
  Tag,
} from "lucide-react";

type QualityGrade = "A" | "B" | "C";
type LotStatus = "available" | "reserved" | "sold";

interface Lot {
  id: string | number;
  title: string;
  produce: string;
  variety?: string;
  quantity: number;
  unit: string;
  price_per_unit: number;
  quality_grade: QualityGrade;
  description?: string;
  harvest_date?: string;
  location?: string;
  status: LotStatus;
  created_at?: string;
  farmer_id?: string | number;
  [key: string]: unknown;
}

interface CreateLotPayload {
  title: string;
  produce: string;
  variety?: string;
  quantity: number;
  unit: string;
  price_per_unit: number;
  quality_grade: QualityGrade;
  description?: string;
  harvest_date?: string;
  location?: string;
}

const STATUS_STYLES: Record<LotStatus, string> = {
  available: "bg-emerald-100 text-emerald-800 hover:bg-emerald-100",
  reserved: "bg-amber-100 text-amber-800 hover:bg-amber-100",
  sold: "bg-slate-200 text-slate-700 hover:bg-slate-200",
};

const emptyForm = (): CreateLotPayload => ({
  title: "",
  produce: "",
  variety: "",
  quantity: 0,
  unit: "kg",
  price_per_unit: 0,
  quality_grade: "A",
  description: "",
  harvest_date: "",
  location: "",
});

function FarmerLotsInner() {
  const router = useRouter();
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

  const handleCreate = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const cleaned: CreateLotPayload = {
        ...form,
        variety: form.variety?.trim() || undefined,
        description: form.description?.trim() || undefined,
        harvest_date: form.harvest_date || undefined,
        location: form.location?.trim() || undefined,
      };
      await apiFetch("/lots", {
        method: "POST",
        body: JSON.stringify(cleaned),
      });
      toast.success("Lot listed successfully!");
      setDialogOpen(false);
      setForm(emptyForm());
      await loadLots();
      router.refresh();
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
                  <Label htmlFor="lot-title">Lot Title</Label>
                  <Input
                    id="lot-title"
                    required
                    placeholder="e.g. Premium Organic Tomatoes"
                    value={form.title}
                    onChange={(e) => updateField("title", e.target.value)}
                    disabled={isSubmitting}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="produce">Produce</Label>
                  <Input
                    id="produce"
                    required
                    placeholder="e.g. Tomato"
                    value={form.produce}
                    onChange={(e) => updateField("produce", e.target.value)}
                    disabled={isSubmitting}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="variety">Variety <span className="text-muted-foreground">(optional)</span></Label>
                  <Input
                    id="variety"
                    placeholder="e.g. Heirloom"
                    value={form.variety}
                    onChange={(e) => updateField("variety", e.target.value)}
                    disabled={isSubmitting}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="quantity">Quantity</Label>
                  <Input
                    id="quantity"
                    type="number"
                    min={0}
                    step="any"
                    required
                    value={form.quantity || ""}
                    onChange={(e) =>
                      updateField("quantity", Number(e.target.value))
                    }
                    disabled={isSubmitting}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="unit">Unit</Label>
                  <Input
                    id="unit"
                    required
                    placeholder="e.g. kg, quintal, crate"
                    value={form.unit}
                    onChange={(e) => updateField("unit", e.target.value)}
                    disabled={isSubmitting}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="price">Price per Unit (₹)</Label>
                  <Input
                    id="price"
                    type="number"
                    min={0}
                    step="any"
                    required
                    value={form.price_per_unit || ""}
                    onChange={(e) =>
                      updateField("price_per_unit", Number(e.target.value))
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
                  <Label htmlFor="harvest">
                    Harvest Date <span className="text-muted-foreground">(optional)</span>
                  </Label>
                  <Input
                    id="harvest"
                    type="date"
                    value={form.harvest_date}
                    onChange={(e) =>
                      updateField("harvest_date", e.target.value)
                    }
                    disabled={isSubmitting}
                  />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="location">
                    Location <span className="text-muted-foreground">(optional)</span>
                  </Label>
                  <Input
                    id="location"
                    placeholder="e.g. Nashik, Maharashtra"
                    value={form.location}
                    onChange={(e) => updateField("location", e.target.value)}
                    disabled={isSubmitting}
                  />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="description">
                    Description <span className="text-muted-foreground">(optional)</span>
                  </Label>
                  <Textarea
                    id="description"
                    rows={3}
                    placeholder="Describe the produce, farming methods, storage conditions…"
                    value={form.description}
                    onChange={(e) =>
                      updateField("description", e.target.value)
                    }
                    disabled={isSubmitting}
                  />
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
          {lots.map((lot) => (
            <Card key={lot.id} className="overflow-hidden transition-shadow hover:shadow-md">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <CardTitle className="truncate text-lg">
                      {lot.title}
                    </CardTitle>
                    <CardDescription className="mt-1 inline-flex items-center gap-1 text-sm">
                      <Sprout className="h-3.5 w-3.5" />
                      {lot.produce}
                      {lot.variety ? (
                        <span className="text-muted-foreground">
                          {" · "}{lot.variety}
                        </span>
                      ) : null}
                    </CardDescription>
                  </div>
                  <Badge
                    variant="secondary"
                    className={`shrink-0 ${STATUS_STYLES[lot.status]}`}
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
                        {lot.quantity}
                      </span>{" "}
                      {lot.unit}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <Tag className="h-4 w-4" />
                    <span>
                      ₹
                      <span className="font-medium text-foreground">
                        {Number(lot.price_per_unit).toLocaleString("en-IN")}
                      </span>
                      /{lot.unit}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs">
                  <Badge
                    variant="outline"
                    className={
                      lot.quality_grade === "A"
                        ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                        : lot.quality_grade === "B"
                        ? "border-amber-300 bg-amber-50 text-amber-700"
                        : "border-slate-300 bg-slate-50 text-slate-700"
                    }
                  >
                    Grade {lot.quality_grade}
                  </Badge>
                  {lot.location ? (
                    <span className="inline-flex items-center gap-1 text-muted-foreground">
                      <MapPin className="h-3.5 w-3.5" />
                      {lot.location}
                    </span>
                  ) : null}
                </div>

                {lot.harvest_date ? (
                  <div className="flex items-center gap-1.5 border-t pt-3 text-xs text-muted-foreground">
                    <Calendar className="h-3.5 w-3.5" />
                    Harvested {new Date(lot.harvest_date).toLocaleDateString("en-IN")}
                  </div>
                ) : null}
              </CardContent>
            </Card>
          ))}
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
