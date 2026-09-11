"use client";

import { FormEvent, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useAuth, UserRole } from "@/lib/auth-context";
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
import { Loader2, AlertCircle, Sprout, ShoppingBasket, Smartphone } from "lucide-react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { FieldError } from "@/components/field-error";
import { validateEmail, validateName, validatePassword, validatePhone } from "@/lib/validation";
import { useHoneypot, HoneypotField, isRateLimited } from "@/lib/anti-spam";
import { Link, useRouter } from "@/i18n/navigation";

type OtpDelivery = { dev_otp?: string };

export default function RegisterPage() {
  const router = useRouter();
  const t = useTranslations("register");
  const otpT = useTranslations("otp");
  const { setSession } = useAuth();
  const honeypot = useHoneypot();

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<UserRole>("farmer");
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState<"details" | "otp">("details");
  const [resendIn, setResendIn] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string | null>>({});

  useEffect(() => {
    if (resendIn <= 0) return;
    const id = window.setTimeout(() => setResendIn((seconds) => seconds - 1), 1000);
    return () => window.clearTimeout(id);
  }, [resendIn]);

  const validate = (): boolean => {
    const errors: Record<string, string | null> = {
      name: validateName(name),
      phone: validatePhone(phone),
      email: validateEmail(email),
      password: validatePassword(password),
    };
    setFieldErrors(errors);
    return !Object.values(errors).some(Boolean);
  };

  const requestSignupOtp = async (enforceLocalRateLimit = true) => {
    setError(null);
    if (honeypot.isFilled()) {
      setError(t("failed"));
      return;
    }
    if (enforceLocalRateLimit && isRateLimited("register", 3, 60_000)) {
      setError(t("tooMany"));
      return;
    }
    if (!validate()) return;

    setIsSubmitting(true);
    try {
      const delivery = await apiFetch<OtpDelivery>("/auth/otp/request", {
        method: "POST",
        body: JSON.stringify({ phone, email, purpose: "signup" }),
      });
      setOtp(delivery.dev_otp ?? "");
      setStep("otp");
      setResendIn(60);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("failed"));
    } finally {
      setIsSubmitting(false);
    }
  };

  const verifySignupOtp = async (event: FormEvent<HTMLFormElement>) => {
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
        body: JSON.stringify({
          phone,
          otp: otp.trim(),
          purpose: "signup",
          name,
          email,
          password,
          role,
        }),
      });
      await setSession(result.access_token);
      router.push("/");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("failed"));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-[calc(100vh-10rem)] items-center justify-center py-8">
      <Card className="w-full max-w-lg">
        <CardHeader className="space-y-1 text-center">
          <CardTitle className="text-2xl font-bold">
            {step === "details" ? t("title") : t("verifyTitle")}
          </CardTitle>
          <CardDescription>
            {step === "details" ? t("subtitle") : t("verifySubtitle", { phone })}
          </CardDescription>
        </CardHeader>
        <form
          onSubmit={step === "details" ? (event) => {
            event.preventDefault();
            void requestSignupOtp();
          } : verifySignupOtp}
          noValidate
        >
          <CardContent className="space-y-4">
            {step === "details" && <HoneypotField {...honeypot.fieldProps} />}

            {error && (
              <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {step === "details" ? (
              <>
                <div className="space-y-2">
                  <Label htmlFor="name">{t("name")}</Label>
                  <Input
                    id="name"
                    type="text"
                    placeholder={t("namePlaceholder")}
                    value={name}
                    onChange={(event) => {
                      setName(event.target.value);
                      if (fieldErrors.name) setFieldErrors((current) => ({ ...current, name: validateName(event.target.value) }));
                    }}
                    autoComplete="name"
                    required
                    disabled={isSubmitting}
                    aria-invalid={!!fieldErrors.name}
                  />
                  <FieldError message={fieldErrors.name} />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone">{t("phone")}</Label>
                  <Input
                    id="phone"
                    type="tel"
                    inputMode="tel"
                    placeholder={t("phonePlaceholder")}
                    value={phone}
                    onChange={(event) => {
                      setPhone(event.target.value);
                      if (fieldErrors.phone) setFieldErrors((current) => ({ ...current, phone: validatePhone(event.target.value) }));
                    }}
                    autoComplete="tel"
                    required
                    disabled={isSubmitting}
                    aria-invalid={!!fieldErrors.phone}
                  />
                  <FieldError message={fieldErrors.phone} />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder={t("emailPlaceholder")}
                      value={email}
                      onChange={(event) => {
                        setEmail(event.target.value);
                        if (fieldErrors.email) setFieldErrors((current) => ({ ...current, email: validateEmail(event.target.value) }));
                      }}
                      autoComplete="email"
                      required
                      disabled={isSubmitting}
                      aria-invalid={!!fieldErrors.email}
                    />
                    <FieldError message={fieldErrors.email} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password">{t("passwordPlaceholder")}</Label>
                    <Input
                      id="password"
                      type="password"
                      placeholder={t("passwordPlaceholder")}
                      value={password}
                      onChange={(event) => {
                        setPassword(event.target.value);
                        if (fieldErrors.password) setFieldErrors((current) => ({ ...current, password: validatePassword(event.target.value) }));
                      }}
                      autoComplete="new-password"
                      required
                      disabled={isSubmitting}
                      aria-invalid={!!fieldErrors.password}
                    />
                    <FieldError message={fieldErrors.password} />
                  </div>
                </div>

                <div className="space-y-3 pt-2">
                  <Label>{t("iAmA")}</Label>
                  <RadioGroup
                    value={role}
                    onValueChange={(value) => setRole(value as UserRole)}
                    className="grid grid-cols-2 gap-3"
                    disabled={isSubmitting}
                  >
                    <Label
                      htmlFor="role-farmer"
                      className={`flex cursor-pointer items-start gap-3 rounded-lg border p-4 transition-all ${
                        role === "farmer"
                          ? "border-primary bg-primary/10 ring-1 ring-primary"
                          : "border-border hover:border-primary/40 hover:bg-primary/5"
                      } ${isSubmitting ? "opacity-60" : ""}`}
                    >
                      <RadioGroupItem value="farmer" id="role-farmer" className="mt-1" />
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center gap-2 font-semibold text-primary">
                          <Sprout className="h-4 w-4" />{t("farmer")}
                        </div>
                        <p className="text-xs text-muted-foreground">{t("farmerDesc")}</p>
                      </div>
                    </Label>

                    <Label
                      htmlFor="role-buyer"
                      className={`flex cursor-pointer items-start gap-3 rounded-lg border p-4 transition-all ${
                        role === "buyer"
                          ? "border-accent bg-accent/10 ring-1 ring-accent"
                          : "border-border hover:border-accent/40 hover:bg-accent/5"
                      } ${isSubmitting ? "opacity-60" : ""}`}
                    >
                      <RadioGroupItem value="buyer" id="role-buyer" className="mt-1" />
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center gap-2 font-semibold text-accent">
                          <ShoppingBasket className="h-4 w-4" />{t("buyer")}
                        </div>
                        <p className="text-xs text-muted-foreground">{t("buyerDesc")}</p>
                      </div>
                    </Label>
                  </RadioGroup>
                </div>
              </>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="signup-otp">{otpT("codeLabel", { phone })}</Label>
                <div className="relative">
                  <Smartphone className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="signup-otp"
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    placeholder="_ _ _ _ _ _"
                    className="pl-9 text-center text-lg tracking-[0.5em]"
                    value={otp}
                    onChange={(event) => setOtp(event.target.value.replace(/\D/g, "").slice(0, 6))}
                    autoComplete="one-time-code"
                    required
                    disabled={isSubmitting}
                  />
                </div>
              </div>
            )}
          </CardContent>

          <CardFooter className="flex-col gap-4">
            {step === "details" ? (
              <>
                <Button type="submit" className="w-full" disabled={isSubmitting}>
                  {isSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />{otpT("sending")}</> : t("create")}
                </Button>
                <div className="text-center text-sm text-muted-foreground">
                  {t("alreadyHave")} {" "}
                  <Link href="/login" className="font-medium text-primary underline-offset-4 hover:underline">
                    {t("signIn")}
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
                  onClick={() => void requestSignupOtp(false)}
                  disabled={resendIn > 0 || isSubmitting}
                  className="w-full text-center text-sm text-primary hover:underline disabled:text-muted-foreground disabled:no-underline"
                >
                  {resendIn > 0 ? otpT("resendIn", { seconds: resendIn }) : otpT("resend")}
                </button>
                <button
                  type="button"
                  onClick={() => { setStep("details"); setOtp(""); setError(null); }}
                  disabled={isSubmitting}
                  className="text-sm text-muted-foreground hover:text-primary hover:underline"
                >
                  {t("editDetails")}
                </button>
              </>
            )}
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
