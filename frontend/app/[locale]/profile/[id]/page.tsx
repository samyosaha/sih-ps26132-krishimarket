"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useParams } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { apiFetch } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StarRating } from "@/components/star-rating";
import { Loader2, BadgeCheck, ShieldOff, User as UserIcon } from "lucide-react";
import { toast } from "sonner";
import { Link } from "@/i18n/navigation";

interface PublicRating {
  id: number;
  rating_value: number;
  comment?: string | null;
  rater_name?: string | null;
  created_at?: string | null;
}

interface DisputeSummary {
  total_disputes: number;
  resolved_count: number;
  outcome_breakdown: Record<string, number>;
}

interface RatingSummary {
  average_rating: number | null;
  total_ratings: number;
  ratings: PublicRating[];
}

export default function ProfilePage() {
  const t = useTranslations("profile");
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [summary, setSummary] = useState<RatingSummary | null>(null);
  const [disputes, setDisputes] = useState<DisputeSummary | null>(null);
  const [loading, setLoading] = useState(true);

  const isSelf = user && String(user.id) === id;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [res, disputeRes] = await Promise.all([
        apiFetch<RatingSummary>(`/users/${id}/ratings`, { params: { limit: 50 } }),
        apiFetch<DisputeSummary>(`/disputes/user/${id}/summary`).catch(() => null),
      ]);
      setSummary(res);
      setDisputes(disputeRes);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [id, t]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="mx-auto max-w-2xl space-y-6 py-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            <UserIcon className="h-6 w-6" aria-hidden="true" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
            <p className="text-sm text-muted-foreground">#{id}</p>
          </div>
        </div>
        <Link href="/" className="text-sm text-muted-foreground hover:text-primary">
          ← KrishiMarket
        </Link>
      </div>

      {loading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : !summary ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            {t("loadFailed")}
          </CardContent>
        </Card>
      ) : (
        <>
          {isSelf && (
            <Card>
              <CardContent className="flex items-center gap-2 py-4">
                {user?.is_verified_buyer || user?.is_verified_farmer ? (
                  <>
                    <BadgeCheck className="h-5 w-5 text-primary" aria-hidden="true" />
                    <Badge variant="outline" className="border-primary/30 bg-primary/10 text-primary">
                      {user?.role === "buyer" ? t("verifiedBuyer") : t("verifiedSeller")}
                    </Badge>
                  </>
                ) : (
                  <>
                    <ShieldOff className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
                    <span className="text-sm text-muted-foreground">{t("notVerified")}</span>
                  </>
                )}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">{t("avgRating")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {summary.total_ratings > 0 ? (
                <>
                  <div className="flex items-center gap-3">
                    <span className="text-3xl font-bold">
                      {summary.average_rating?.toFixed(1) ?? "—"}
                    </span>
                    <div>
                      <StarRating
                        value={summary.average_rating ?? 0}
                        size="md"
                      />
                      <p className="mt-1 text-xs text-muted-foreground">
                        {t("ratingsCount", { count: summary.total_ratings })}
                      </p>
                    </div>
                  </div>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">{t("noRatings")}</p>
              )}
            </CardContent>
          </Card>

          {disputes ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">{t("disputeSummary")}</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-2 text-sm sm:grid-cols-3">
                <div>
                  <p className="text-muted-foreground">{t("totalDisputes")}</p>
                  <p className="text-xl font-semibold">{disputes.total_disputes}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">{t("resolved")}</p>
                  <p className="text-xl font-semibold">{disputes.resolved_count}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">{t("open")}</p>
                  <p className="text-xl font-semibold">
                    {Math.max(0, disputes.total_disputes - disputes.resolved_count)}
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : null}

          {summary.total_ratings > 0 && (
            <div className="space-y-3">
              <h2 className="text-lg font-semibold">{t("comments")}</h2>
              {summary.ratings.map((r) => (
                <Card key={r.id}>
                  <CardContent className="space-y-2 py-4">
                    <div className="flex items-center justify-between gap-3">
                      <StarRating value={r.rating_value} size="sm" />
                      <span className="text-sm text-muted-foreground">
                        {r.rater_name ?? `#${id}`}
                      </span>
                    </div>
                    {r.comment && <p className="text-sm text-muted-foreground">{r.comment}</p>}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}