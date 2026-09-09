"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Loader2, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { StarRatingInput } from "@/components/star-rating";
import { apiFetch } from "@/lib/api";

export function RatingPrompt({
  transactionId,
  rateeName,
  alreadyRated = false,
}: {
  transactionId: number | string;
  rateeName: string;
  alreadyRated?: boolean;
}) {
  const t = useTranslations("rating");
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(0);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    if (value < 1) return;
    setSubmitting(true);
    try {
      await apiFetch(`/transactions/${transactionId}/ratings`, {
        method: "POST",
        body: JSON.stringify({ rating_value: value, comment: comment.trim() || null }),
      });
      toast.success(t("thanks"));
      setOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("submitFailed"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          disabled={alreadyRated}
          className="inline-flex items-center gap-1.5"
        >
          <Star className="h-4 w-4" aria-hidden="true" />
          {alreadyRated ? t("alreadyRated") : t("title")}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{t("prompt", { name: rateeName })}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="flex justify-center">
            <StarRatingInput value={value} onChange={setValue} size="lg" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="rating-comment">{t("commentLabel")}</Label>
            <Textarea
              id="rating-comment"
              placeholder={t("commentPlaceholder")}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={3}
              maxLength={500}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            onClick={submit}
            disabled={value < 1 || submitting}
            className="bg-emerald-600 hover:bg-emerald-700"
          >
            {submitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t("submitting")}
              </>
            ) : (
              t("submit")
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}