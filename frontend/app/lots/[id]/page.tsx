"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
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
  Calendar,
  Scale,
  Tag,
  User,
  ArrowLeft,
  MessageSquare,
  ShieldCheck,
} from "lucide-react";

export default function LotDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const lotId = params.id;
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();

  const [lot, setLot] = useState<Lot | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [offeredPrice, setOfferedPrice] = useState<number | "">("");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadLot = useCallback(async () => {
    if (!lotId) return;
    setIsLoading(true);
    setError(null);
    try {
      const data = await apiFetch<Lot>(`/lots/${lotId}`);
      setLot(data);
      setOfferedPrice(data.price_per_unit ?? "");
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Failed to load lot details";
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  }, [lotId]);

  useEffect(() => {
    loadLot();
  }, [loadLot]);

  const isBuyer = user?.role === ("buyer" as UserRole);
  const canOffer = isBuyer && lot?.status === "available";

  const handleSubmitOffer = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!lot || offeredPrice === "" || Number(offeredPrice) <= 0) {
      toast.error("Please enter a valid offer price.");
      return;
    }
    setIsSubmitting(true);
    try {
      await apiFetch("/offers", {
        method: "POST",
        body: JSON.stringify({
          lot_id: lot.id,
          offered_price_per_kg: Number(offeredPrice),
          message: message.trim() || undefined,
        }),
      });
      toast.success("Offer sent! The farmer will be notified.");
      setDialogOpen(false);
      setMessage("");
      setTimeout(() => router.push("/buyer/offers"), 1200);
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Failed to send offer";
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
            Back to browse
          </Link>
        </Button>
      </div>

      {isLoading || authLoading ? (
        <div className="flex min-h-[40vh] items-center justify-center">
          <div className="flex items-center gap-3 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span>Loading lot details…</span>
          </div>
        </div>
      ) : error ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <h3 className="text-lg font-semibold text-red-600">{error}</h3>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">
              The lot you&apos;re looking for may have been removed or is
              unavailable.
            </p>
            <Button asChild className="mt-6">
              <Link href="/lots">Browse other lots</Link>
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
                          {lot.status.charAt(0).toUpperCase() +
                            lot.status.slice(1)}
                        </Badge>
                        <Badge
                          variant="outline"
                          className={gradeBadgeClass(lot.quality_grade)}
                        >
                          Grade {lot.quality_grade}
                        </Badge>
                      </div>
                      <CardTitle className="mt-3 text-3xl font-bold tracking-tight">
                        {lot.title}
                      </CardTitle>
                      <CardDescription className="mt-2 inline-flex items-center gap-1.5 text-base">
                        <Sprout className="h-4 w-4 text-emerald-600" />
                        {lot.produce || lot.commodity || "Produce"}
                        {lot.variety ? (
                          <span className="text-muted-foreground">
                            {" · Variety: "}{lot.variety}
                          </span>
                        ) : null}
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid gap-4 rounded-lg bg-slate-50 p-5 sm:grid-cols-3 dark:bg-slate-900/50">
                    <div className="space-y-1">
                      <div className="text-xs uppercase tracking-wide text-muted-foreground">
                        Asking price
                      </div>
                      <div className="text-2xl font-bold text-emerald-700">
                        {formatINR(lot.price_per_unit)}
                        <span className="ml-1 text-sm font-medium text-muted-foreground">
                          /{lot.unit}
                        </span>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-muted-foreground">
                        <Scale className="h-3 w-3" />
                        Available quantity
                      </div>
                      <div className="text-2xl font-bold">
                        {lot.quantity}
                        <span className="ml-1 text-sm font-medium text-muted-foreground">
                          {lot.unit}
                        </span>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <div className="text-xs uppercase tracking-wide text-muted-foreground">
                        Total lot value
                      </div>
                      <div className="text-2xl font-bold">
                        {formatINR(
                          Number(lot.price_per_unit) * Number(lot.quantity)
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    {lot.harvest_date ? (
                      <div className="flex items-start gap-3 rounded-md border p-4">
                        <Calendar className="mt-0.5 h-5 w-5 text-muted-foreground" />
                        <div>
                          <div className="text-xs uppercase tracking-wide text-muted-foreground">
                            Harvest date
                          </div>
                          <div className="mt-1 font-medium">
                            {new Date(lot.harvest_date).toLocaleDateString(
                              "en-IN",
                              {
                                day: "numeric",
                                month: "long",
                                year: "numeric",
                              }
                            )}
                          </div>
                        </div>
                      </div>
                    ) : null}

                    {lot.state || lot.district || lot.location ? (
                      <div className="flex items-start gap-3 rounded-md border p-4">
                        <MapPin className="mt-0.5 h-5 w-5 text-muted-foreground" />
                        <div>
                          <div className="text-xs uppercase tracking-wide text-muted-foreground">
                            Location
                          </div>
                          <div className="mt-1 font-medium">
                            {[
                              lot.district,
                              lot.state,
                            ]
                              .filter(Boolean)
                              .join(", ") || lot.location}
                          </div>
                        </div>
                      </div>
                    ) : null}
                  </div>

                  {lot.description ? (
                    <div className="space-y-2 border-t pt-5">
                      <h3 className="font-semibold">Description</h3>
                      <p className="whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
                        {lot.description}
                      </p>
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            </div>

            <aside className="space-y-6">
              <Card className="border-l-4 border-l-emerald-400">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg">Farmer</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                      <User className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <div className="truncate font-semibold">
                        {lot.farmer?.name || lot.farmer_name || "Farmer"}
                      </div>
                      <div className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                        <ShieldCheck className="h-3 w-3 text-emerald-600" />
                        Verified seller
                      </div>
                    </div>
                  </div>
                  {lot.farmer?.email ? (
                    <div className="rounded-md bg-slate-50 p-3 text-xs dark:bg-slate-900/50">
                      <div className="text-muted-foreground">Email</div>
                      <div className="mt-0.5 font-medium">
                        {lot.farmer.email}
                      </div>
                    </div>
                  ) : null}
                  {lot.farmer?.phone ? (
                    <div className="rounded-md bg-slate-50 p-3 text-xs dark:bg-slate-900/50">
                      <div className="text-muted-foreground">Phone</div>
                      <div className="mt-0.5 font-medium">
                        {lot.farmer.phone}
                      </div>
                    </div>
                  ) : null}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg">Interested?</CardTitle>
                  <CardDescription className="text-xs">
                    Send a direct offer — the farmer will review and respond.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {!isAuthenticated ? (
                    <div className="space-y-3 text-sm">
                      <p className="text-muted-foreground">
                        Please sign in to make an offer on this lot.
                      </p>
                      <div className="flex flex-col gap-2 sm:flex-row">
                        <Button asChild variant="outline" className="flex-1">
                          <Link href="/login">Sign in</Link>
                        </Button>
                        <Button
                          asChild
                          className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                        >
                          <Link href="/register">Create account</Link>
                        </Button>
                      </div>
                    </div>
                  ) : !isBuyer ? (
                    <div className="space-y-2 text-sm">
                      <p className="text-muted-foreground">
                        Offers can only be placed by buyers. Your current role
                        is <span className="font-medium text-foreground">farmer</span>.
                      </p>
                    </div>
                  ) : lot.status !== "available" ? (
                    <div className="space-y-2 text-sm">
                      <p className="text-muted-foreground">
                        This lot is currently{" "}
                        <span className="font-medium text-foreground">
                          {lot.status}
                        </span>{" "}
                        and is not accepting new offers.
                      </p>
                    </div>
                  ) : (
                    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                      <DialogTrigger asChild>
                        <Button className="w-full bg-amber-600 hover:bg-amber-700">
                          <Tag className="mr-2 h-4 w-4" />
                          Make an Offer
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-lg">
                        <DialogHeader>
                          <DialogTitle>Make an offer</DialogTitle>
                          <DialogDescription>
                            Submit your best price per {lot.unit} for &ldquo;
                            {lot.title}&rdquo;. The farmer will see your
                            message.
                          </DialogDescription>
                        </DialogHeader>
                        <form onSubmit={handleSubmitOffer} className="space-y-5">
                          <div className="grid gap-3 rounded-md bg-slate-50 p-3 text-xs dark:bg-slate-900/50 sm:grid-cols-2">
                            <div>
                              <div className="text-muted-foreground">
                                Asking
                              </div>
                              <div className="font-semibold">
                                {formatINR(lot.price_per_unit)} / {lot.unit}
                              </div>
                            </div>
                            <div>
                              <div className="text-muted-foreground">
                                Available
                              </div>
                              <div className="font-semibold">
                                {lot.quantity} {lot.unit}
                              </div>
                            </div>
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor="offer-price">
                              Your offer price per {lot.unit} (₹)
                            </Label>
                            <Input
                              id="offer-price"
                              type="number"
                              min={0}
                              step="any"
                              value={offeredPrice}
                              onChange={(e) =>
                                setOfferedPrice(
                                  e.target.value === ""
                                    ? ""
                                    : Number(e.target.value)
                                )
                              }
                              required
                              disabled={isSubmitting}
                            />
                            {offeredPrice !== "" &&
                            typeof offeredPrice === "number" ? (
                              <p className="text-xs text-muted-foreground">
                                Total at this price:{" "}
                                <span className="font-medium text-foreground">
                                  {formatINR(
                                    offeredPrice * Number(lot.quantity)
                                  )}
                                </span>{" "}
                                for {lot.quantity} {lot.unit}
                              </p>
                            ) : null}
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor="offer-msg">
                              Message to farmer{" "}
                              <span className="text-muted-foreground">
                                (optional)
                              </span>
                            </Label>
                            <Textarea
                              id="offer-msg"
                              rows={3}
                              placeholder="Hi, I can arrange transport. When is the produce ready for pickup?"
                              value={message}
                              onChange={(e) => setMessage(e.target.value)}
                              disabled={isSubmitting}
                            />
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                              <MessageSquare className="h-3.5 w-3.5" />
                              Personalised messages often receive faster
                              responses.
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
                              className="bg-amber-600 hover:bg-amber-700"
                              disabled={isSubmitting}
                            >
                              {isSubmitting ? (
                                <>
                                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                  Sending offer…
                                </>
                              ) : (
                                "Send Offer"
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
