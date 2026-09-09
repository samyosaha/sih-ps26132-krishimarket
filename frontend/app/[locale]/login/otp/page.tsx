"use client";

import { useState, FormEvent, useEffect } from "react";
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
import { Loader2, Smartphone, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { Link, useRouter } from "@/i18n/navigation";

export default function OtpLoginPage() {
  const router = useRouter();
  const t = useTranslations("otp");
  const { setSession } = useAuth();
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState<"phone" | "otp">("phone");
  const [resendIn, setResendIn] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (resendIn <= 0) return;
    const id = window.setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => window.clearTimeout(id);
  }, [resendIn]);

  const requestOtp = async () => {
    if (phone.trim().length < 10) {
      toast.error(t("phonePlaceholder"));
      return;
    }
    setIsSubmitting(true);
    try {
      const res = await apiFetch<{ message?: string; dev_otp?: string }>("/auth/otp/request", {
        method: "POST",
        body: JSON.stringify({ phone: phone.trim(), purpose: "login" }),
      });
      setStep("otp");
      setResendIn(60);
      if (res.dev_otp) {
        toast.success(`${t("sentToast")} Dev code: ${res.dev_otp}`);
        setOtp(res.dev_otp);
      } else {
        toast.success(t("sentToast"));
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("invalid"));
    } finally {
      setIsSubmitting(false);
    }
  };

  const verifyOtp = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (otp.trim().length !== 6) {
      toast.error(t("codeRequired"));
      return;
    }
    setIsSubmitting(true);
    try {
      const res = await apiFetch<{ access_token: string }>("/auth/otp/verify", {
        method: "POST",
        body: JSON.stringify({ phone: phone.trim(), otp: otp.trim(), purpose: "login" }),
      });
      await setSession(res.access_token);
      toast.success(t("verifySuccess"));
      router.push("/");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("invalid"));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-[calc(100vh-10rem)] items-center justify-center py-8">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1 text-center">
          <CardTitle className="text-2xl font-bold">{t("title")}</CardTitle>
          <CardDescription>{t("subtitle")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {step === "phone" ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                requestOtp();
              }}
              className="space-y-4"
            >
              <div className="space-y-2">
                <Label htmlFor="otp-phone">{t("phoneLabel")}</Label>
                <div className="relative">
                  <Smartphone className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="otp-phone"
                    type="tel"
                    inputMode="numeric"
                    placeholder={t("phonePlaceholder")}
                    className="pl-9"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    autoComplete="tel"
                    required
                    disabled={isSubmitting}
                  />
                </div>
              </div>
              <Button
                type="submit"
                className="w-full bg-emerald-600 hover:bg-emerald-700"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {t("sending")}
                  </>
                ) : (
                  t("send")
                )}
              </Button>
            </form>
          ) : (
            <form onSubmit={verifyOtp} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="otp-code">{t("codeLabel", { phone })}</Label>
                <Input
                  id="otp-code"
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="_ _ _ _ _ _"
                  className="text-center text-lg tracking-[0.5em]"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  required
                  disabled={isSubmitting}
                />
              </div>
              <Button
                type="submit"
                className="w-full bg-emerald-600 hover:bg-emerald-700"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {t("verifying")}
                  </>
                ) : (
                  t("verify")
                )}
              </Button>
              <button
                type="button"
                onClick={requestOtp}
                disabled={resendIn > 0 || isSubmitting}
                className="w-full text-center text-sm text-emerald-600 hover:underline disabled:text-muted-foreground disabled:no-underline"
              >
                {resendIn > 0 ? t("resendIn", { seconds: resendIn }) : t("resend")}
              </button>
            </form>
          )}

          <div className="border-t pt-4 text-center">
            <Link
              href="/login"
              className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary"
            >
              <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
              {t("backToLogin")}
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}