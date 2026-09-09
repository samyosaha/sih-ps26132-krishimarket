"use client";

import { useState, FormEvent, useEffect } from "react";
import { useTranslations } from "next-intl";
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
import { Loader2, Phone, ArrowLeft, KeyRound } from "lucide-react";
import { toast } from "sonner";
import { validatePassword } from "@/lib/validation";
import { FieldError } from "@/components/field-error";
import { Link } from "@/i18n/navigation";

export default function ForgotPasswordPage() {
  const t = useTranslations("forgot");
  const otpT = useTranslations("otp");
  const [step, setStep] = useState<"phone" | "code">("phone");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [resendIn, setResendIn] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (resendIn <= 0) return;
    const id = window.setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => window.clearTimeout(id);
  }, [resendIn]);

  const requestReset = async () => {
    if (phone.trim().length < 10) return;
    setIsSubmitting(true);
    try {
      await apiFetch("/auth/password/forgot", {
        method: "POST",
        body: JSON.stringify({ phone: phone.trim() }),
      });
        method: "POST",
        body: JSON.stringify({ phone: phone.trim() }),
      });
      setStep("code");
      setResendIn(60);
      toast.success(t("sentToast"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("goToLogin"));
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetPassword = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (otp.trim().length !== 6) {
      toast.error(otpT("codeRequired"));
      return;
    }
    if (newPassword !== confirm) {
      toast.error(t("passwordMismatch"));
      return;
    }
    if (validatePassword(newPassword)) {
      toast.error(validatePassword(newPassword));
      return;
    }
    setIsSubmitting(true);
    try {
      await apiFetch("/auth/password/reset", {
        method: "POST",
        body: JSON.stringify({
          phone: phone.trim(),
          otp: otp.trim(),
          new_password: newPassword,
        }),
      });
      setDone(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("goToLogin"));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (done) {
    return (
      <div className="flex min-h-[calc(100vh-10rem)] items-center justify-center py-8">
        <Card className="w-full max-w-md text-center">
          <CardHeader>
            <CardTitle className="text-2xl font-bold">{t("success")}</CardTitle>
          </CardHeader>
          <CardContent>
            <Button asChild className="bg-emerald-600 hover:bg-emerald-700">
              <Link href="/login">{t("goToLogin")}</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

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
                requestReset();
              }}
              className="space-y-4"
            >
              <div className="space-y-2">
                <Label htmlFor="fp-phone">{t("phoneLabel")}</Label>
                <div className="relative">
                  <Phone className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="fp-phone"
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
            <form onSubmit={resetPassword} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="fp-code">{t("codeLabel", { phone })}</Label>
                <div className="relative">
                  <KeyRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="fp-code"
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    className="pl-9 text-center tracking-[0.4em]"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    disabled={isSubmitting}
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="fp-new">{t("newPassword")}</Label>
                <Input
                  id="fp-new"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  autoComplete="new-password"
                  disabled={isSubmitting}
                  required
                />
                {validatePassword(newPassword) && (
                  <FieldError message={validatePassword(newPassword)} />
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="fp-confirm">{t("confirmPassword")}</Label>
                <Input
                  id="fp-confirm"
                  type="password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  autoComplete="new-password"
                  disabled={isSubmitting}
                  required
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
                    {t("resetting")}
                  </>
                ) : (
                  t("reset")
                )}
              </Button>
              <button
                type="button"
                onClick={requestReset}
                disabled={resendIn > 0 || isSubmitting}
                className="w-full text-center text-sm text-emerald-600 hover:underline disabled:text-muted-foreground disabled:no-underline"
              >
                {resendIn > 0 ? otpT("resendIn", { seconds: resendIn }) : otpT("resend")}
              </button>
            </form>
          )}

          <div className="border-t pt-4 text-center">
            <Link
              href="/login"
              className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary"
            >
              <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
              {t("goToLogin")}
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}