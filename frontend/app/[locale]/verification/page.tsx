"use client";

import { useCallback, useEffect, useState, FormEvent } from "react";
import { useTranslations } from "next-intl";
import { useAuth } from "@/lib/auth-context";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, BadgeCheck, UploadCloud, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { Link } from "@/i18n/navigation";
import { AuthenticatedRouteGuard } from "@/components/authenticated-route-guard";

interface VerificationStatus {
  id: number;
  business_name: string;
  gst_number?: string | null;
  id_document_url?: string | null;
  status: "pending" | "approved" | "rejected";
  rejection_reason?: string | null;
  created_at?: string | null;
}

const STATUS_BADGE: Record<string, string> = {
  pending: "border-accent/30 bg-accent/10 text-accent hover:bg-accent/10",
  approved: "border-primary/30 bg-primary/10 text-primary hover:bg-primary/10",
  rejected: "border-destructive/30 bg-destructive/10 text-destructive hover:bg-destructive/10",
};

function VerificationInner() {
  const t = useTranslations("verify");
  const { user, isAuthenticated, isLoading } = useAuth();
  const [businessName, setBusinessName] = useState("");
  const [gst, setGst] = useState("");
  const [documentFile, setDocumentFile] = useState<File | null>(null);
  const [requests, setRequests] = useState<VerificationStatus[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadStatus = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      const res = await apiFetch<VerificationStatus[]>("/verification/status");
      setRequests(Array.isArray(res) ? res : []);
    } catch {
      // ignore
    }
  }, [isAuthenticated]);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const form = new FormData();
      form.append("business_name", businessName.trim());
      if (gst.trim()) form.append("gst_number", gst.trim());
      if (documentFile) form.append("id_document", documentFile);
      await apiFetch("/verification/apply", { method: "POST", body: form });
      toast.success(t("success"));
      setBusinessName("");
      setGst("");
      setDocumentFile(null);
      loadStatus();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("submitFailed"));
    } finally {
      setIsSubmitting(false);
    }
  };

  const latest = requests[0];

  return (
    <div className="mx-auto max-w-2xl space-y-6 py-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : !isAuthenticated ? (
        <Card>
          <CardContent className="py-10 text-center">
            <ShieldAlert className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
            <Button asChild className="mt-4">
              <Link href="/login">{t("submit")}</Link>
            </Button>
          </CardContent>
        </Card>
      ) : user?.role !== "buyer" ? (
        <Card>
          <CardContent className="py-10 text-center">
            <ShieldAlert className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
          </CardContent>
        </Card>
      ) : user?.is_verified_buyer ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
            <BadgeCheck className="h-12 w-12 text-primary" />
            <p className="font-semibold text-primary">{t("statusApproved")}</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {latest && (
            <Card>
              <CardContent className="flex items-center justify-between py-4">
                <div>
                  <p className="font-medium">{latest.business_name}</p>
                  {latest.rejection_reason && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      {latest.rejection_reason}
                    </p>
                  )}
                </div>
                <Badge className={`${STATUS_BADGE[latest.status] ?? ""} shrink-0`}>
                  {latest.status === "pending"
                    ? t("statusPending")
                    : latest.status === "approved"
                    ? t("statusApproved")
                    : t("statusRejected")}
                </Badge>
              </CardContent>
            </Card>
          )}

          {latest?.status === "rejected" || latest?.status === "pending" ? null : (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">{t("title")}</CardTitle>
                <CardDescription>{t("subtitle")}</CardDescription>
              </CardHeader>
              <form onSubmit={submit}>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="biz-name">{t("businessName")}</Label>
                    <Input
                      id="biz-name"
                      value={businessName}
                      onChange={(e) => setBusinessName(e.target.value)}
                      placeholder={t("businessNamePlaceholder")}
                      required
                      minLength={2}
                      maxLength={200}
                      disabled={isSubmitting}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="gst">{t("gstOptional")}</Label>
                    <Input
                      id="gst"
                      value={gst}
                      onChange={(e) => setGst(e.target.value)}
                      placeholder={t("gstPlaceholder")}
                      maxLength={20}
                      disabled={isSubmitting}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="doc">{t("document")}</Label>
                    <label
                      htmlFor="doc"
                      className="flex cursor-pointer flex-col items-center gap-2 rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground hover:border-primary/40 hover:bg-primary/5 transition-colors"
                    >
                      <UploadCloud className="h-6 w-6" aria-hidden="true" />
                      {documentFile ? documentFile.name : t("documentHint")}
                      <input
                        id="doc"
                        type="file"
                        accept=".jpg,.jpeg,.png,.pdf"
                        className="sr-only"
                        onChange={(e) => setDocumentFile(e.target.files?.[0] ?? null)}
                        disabled={isSubmitting}
                      />
                    </label>
                  </div>
                </CardContent>
                <CardContent className="pt-0">
                  <Button
                    type="submit"
                    className="w-full"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        {t("submitting")}
                      </>
                    ) : (
                      t("submit")
                    )}
                  </Button>
                </CardContent>
              </form>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

export default function VerificationPage() {
  return (
    <AuthenticatedRouteGuard>
      <VerificationInner />
    </AuthenticatedRouteGuard>
  );
}