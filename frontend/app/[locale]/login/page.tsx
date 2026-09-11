"use client";

import { FormEvent, useEffect, useState } from "react";
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
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Loader2, AlertCircle, Smartphone } from "lucide-react";
import { FieldError } from "@/components/field-error";
import { validateEmail } from "@/lib/validation";
import { useHoneypot, HoneypotField, isRateLimited } from "@/lib/anti-spam";
import { Link, useRouter } from "@/i18n/navigation";

type LoginChallenge = {
  phone: string;
  dev_otp?: string;
};

export default function LoginPage() {
  const router = useRouter();
  const t = useTranslations("auth");
  const otpT = useTranslations("otp");
  const { setSession } = useAuth();
  const honeypot = useHoneypot();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState<"credentials" | "otp">("credentials");
  const [resendIn, setResendIn] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string | null>>({});

  useEffect(() => {
    if (resendIn <= 0) return;
    const id = window.setTimeout(() => setResendIn((seconds) => seconds - 1), 1000);
    return () => window.clearTimeout(id);
  }, [resendIn]);

  const validateCredentials = (): boolean => {
    const errors: Record<string, string | null> = {
      email: validateEmail(email),
      password: !password ? t("passwordRequired") : null,
    };
    setFieldErrors(errors);
    return !Object.values(errors).some(Boolean);
  };

  const requestLoginOtp = async (enforceLocalRateLimit = true) => {
    setError(null);
    if (honeypot.isFilled()) {
      setError(t("loginFailed"));
      return;
    }
    if (enforceLocalRateLimit && isRateLimited("login", 5, 60_000)) {
      setError(t("tooManyAttempts"));
      return;
    }
    if (!validateCredentials()) return;

    setIsSubmitting(true);
    try {
      const challenge = await apiFetch<LoginChallenge>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      setPhone(challenge.phone);
      setOtp(challenge.dev_otp ?? "");
      setStep("otp");
      setResendIn(60);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("loginFailed"));
    } finally {
      setIsSubmitting(false);
    }
  };

  const verifyOtp = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    if (otp.trim().length !== 6) {
      setError(otpT("codeRequired"));
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await apiFetch<{ access_token: string }>("/auth/otp/verify", {
        method: "POST",
        body: JSON.stringify({ phone, otp: otp.trim(), purpose: "login" }),
      });
      await setSession(result.access_token);
      router.push("/");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : otpT("invalid"));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-[calc(100vh-10rem)] items-center justify-center py-8">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1 text-center">
          <CardTitle className="text-2xl font-bold">
            {step === "credentials" ? t("welcomeBack") : otpT("title")}
          </CardTitle>
          <CardDescription>
            {step === "credentials" ? t("loginSubtitle") : otpT("codeLabel", { phone })}
          </CardDescription>
        </CardHeader>
        <form
          onSubmit={step === "credentials" ? (event) => {
            event.preventDefault();
            void requestLoginOtp();
          } : verifyOtp}
          noValidate
        >
          <CardContent className="space-y-4">
            {step === "credentials" && <HoneypotField {...honeypot.fieldProps} />}

            {error && (
              <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {step === "credentials" ? (
              <>
                <div className="space-y-2">
                  <Label htmlFor="email">{t("email")}</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder={t("emailPlaceholder")}
                    value={email}
                    onChange={(event) => {
                      setEmail(event.target.value);
                      if (fieldErrors.email) {
                        setFieldErrors((current) => ({ ...current, email: validateEmail(event.target.value) }));
                      }
                    }}
                    autoComplete="email"
                    required
                    disabled={isSubmitting}
                    aria-invalid={!!fieldErrors.email}
                  />
                  <FieldError message={fieldErrors.email} />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password">{t("password")}</Label>
                    <Link
                      href="/forgot-password"
                      className="text-xs font-medium text-primary hover:underline"
                    >
                      {t("forgotPassword")}
                    </Link>
                  </div>
                  <Input
                    id="password"
                    type="password"
                    placeholder={t("passwordPlaceholder")}
                    value={password}
                    onChange={(event) => {
                      setPassword(event.target.value);
                      if (fieldErrors.password) {
                        setFieldErrors((current) => ({
                          ...current,
                          password: event.target.value ? null : t("passwordRequired"),
                        }));
                      }
                    }}
                    autoComplete="current-password"
                    required
                    disabled={isSubmitting}
                    aria-invalid={!!fieldErrors.password}
                  />
                  <FieldError message={fieldErrors.password} />
                </div>
              </>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="login-otp">{otpT("codeLabel", { phone })}</Label>
                <Input
                  id="login-otp"
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="_ _ _ _ _ _"
                  className="text-center text-lg tracking-[0.5em]"
                  value={otp}
                  onChange={(event) => setOtp(event.target.value.replace(/\D/g, "").slice(0, 6))}
                  autoComplete="one-time-code"
                  required
                  disabled={isSubmitting}
                />
              </div>
            )}
          </CardContent>
          <CardFooter className="flex-col gap-4">
            {step === "credentials" ? (
              <>
                <Button
                  type="submit"
                  className="w-full"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" />{otpT("sending")}</>
                  ) : t("signIn")}
                </Button>

                <Button asChild variant="outline" className="w-full gap-2">
                  <Link href="/login/otp">
                    <Smartphone className="h-4 w-4" aria-hidden="true" />
                    {t("loginWithOtp")}
                  </Link>
                </Button>

                <div className="border-t pt-4 text-center text-sm text-muted-foreground">
                  {t("noAccount")} {" "}
                  <Link href="/register" className="font-medium text-primary underline-offset-4 hover:underline">
                    {t("createAccount")}
                  </Link>
                </div>
              </>
            ) : (
              <>
                <Button type="submit" className="w-full" disabled={isSubmitting}>
                  {isSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />{otpT("verifying")}</> : otpT("verify")}
                </Button>
                <button
                  type="button"
                  onClick={() => void requestLoginOtp(false)}
                  disabled={resendIn > 0 || isSubmitting}
                  className="w-full text-center text-sm text-primary hover:underline disabled:text-muted-foreground disabled:no-underline"
                >
                  {resendIn > 0 ? otpT("resendIn", { seconds: resendIn }) : otpT("resend")}
                </button>
                <button
                  type="button"
                  onClick={() => { setStep("credentials"); setOtp(""); setError(null); }}
                  disabled={isSubmitting}
                  className="text-sm text-muted-foreground hover:text-primary hover:underline"
                >
                  {otpT("backToLogin")}
                </button>
              </>
            )}
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
