"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { apiFetch } from "@/lib/api";
import { AdminRouteGuard } from "@/components/admin-route-guard";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
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
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Link } from "@/i18n/navigation";

interface DisputeRow {
  id: number;
  transaction_id: number;
  raised_by_id: number;
  reason: string;
  status: "open" | "resolved";
  outcome?: string | null;
}

type Filter = "" | "open" | "resolved";
type Outcome = "favor_farmer" | "favor_buyer" | "mutual" | "no_fault";

function AdminDisputesInner() {
  const t = useTranslations("disputes");
  const [rows, setRows] = useState<DisputeRow[]>([]);
  const [filter, setFilter] = useState<Filter>("open");
  const [loading, setLoading] = useState(true);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [notes, setNotes] = useState("");
  const [outcome, setOutcome] = useState<Outcome>("mutual");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch<DisputeRow[]>("/disputes/admin/all", {
        params: filter ? { status: filter } : undefined,
      });
      setRows(Array.isArray(res) ? res : []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [filter, t]);

  useEffect(() => {
    load();
  }, [load]);

  const resolve = async () => {
    if (!activeId || notes.trim().length < 5) return;
    try {
      await apiFetch(`/disputes/${activeId}/resolve`, {
        method: "PATCH",
        body: JSON.stringify({ resolution_notes: notes.trim(), outcome }),
      });
      toast.success(t("resolvedToast"));
      setActiveId(null);
      setNotes("");
      load();
    } catch {
      toast.error(t("failToast"));
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6 py-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {(["open", "resolved", ""] as Filter[]).map((f) => (
          <Button
            key={f || "all"}
            variant={filter === f ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter(f)}
          >
            {f === "" ? t("all") : f === "open" ? t("open") : t("resolved")}
          </Button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : rows.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            {t("empty")}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {rows.map((row) => (
            <Card key={row.id}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <CardTitle className="text-base">
                      {t("transaction")} #{row.transaction_id}
                    </CardTitle>
                    <p className="mt-0.5 text-sm text-muted-foreground">
                      {t("raisedBy")} #{row.raised_by_id}
                    </p>
                  </div>
                  <Badge variant="secondary">
                    {row.status === "open" ? t("open") : t("resolved")}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm">
                  <span className="font-medium">{t("reason")}: </span>
                  {row.reason}
                </p>
                {row.status === "open" ? (
                  <Dialog
                    open={activeId === row.id}
                    onOpenChange={(open) => {
                      setActiveId(open ? row.id : null);
                      if (!open) setNotes("");
                    }}
                  >
                    <DialogTrigger asChild>
                      <Button size="sm">{t("resolve")}</Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-md">
                      <DialogHeader>
                        <DialogTitle>{t("resolve")}</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-3">
                        <div className="space-y-2">
                          <Label>{t("outcome")}</Label>
                          <Select
                            value={outcome}
                            onValueChange={(v) => setOutcome(v as Outcome)}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="favor_farmer">{t("favorFarmer")}</SelectItem>
                              <SelectItem value="favor_buyer">{t("favorBuyer")}</SelectItem>
                              <SelectItem value="mutual">{t("mutual")}</SelectItem>
                              <SelectItem value="no_fault">{t("noFault")}</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="notes">{t("notes")}</Label>
                          <Textarea
                            id="notes"
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            placeholder={t("notesPlaceholder")}
                            rows={4}
                          />
                        </div>
                      </div>
                      <DialogFooter>
                        <Button onClick={resolve} disabled={notes.trim().length < 5}>
                          {t("resolve")}
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                ) : null}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <p className="text-center text-xs text-muted-foreground">
        <Link href="/" className="hover:underline">
          ← KrishiMarket
        </Link>
      </p>
    </div>
  );
}

export default function AdminDisputesPage() {
  return (
    <AdminRouteGuard>
      <AdminDisputesInner />
    </AdminRouteGuard>
  );
}
