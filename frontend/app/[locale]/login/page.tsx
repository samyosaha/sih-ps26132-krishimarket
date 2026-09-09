"use client";

import { useState, FormEvent } from "react";
import { useTranslations } from "next-intl";
import { useAuth } from "@/lib/auth-context";
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

export default function LoginPage() {
  const router = useRouter();
  const t = useTranslations("auth");
  const { login } = useAuth();
  const honeypot = useHoneypot();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string | null>>(
    {}
  );

  const validate = (): boolean => {
    const errors: Record<string, string | null> = {
      email: validateEmail(email),
      password: !password ? t("passwordRequired") : null,
    };
    setFieldErrors(errors);
    return !Object.values(errors).some(Boolean);
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    if (honeypot.isFilled()) {
      setError(t("loginFailed"));
      return;
    }

    if (isRateLimited("login", 5, 60_000)) {
      setError(t("tooManyAttempts"));
      return;
    }

    if (!validate()) return;

    setIsSubmitting(true);
    try {
      await login({ email, password });
      router.push("/");
      router.refresh();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : t("loginFailed");
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-[calc(100vh-10rem)] items-center justify-center py-8">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1 text-center">
          <CardTitle className="text-2xl font-bold">{t("welcomeBack")}</CardTitle>
          <CardDescription>{t("loginSubtitle")}</CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit} noValidate>
          <CardContent className="space-y-4">
            <HoneypotField {...honeypot.fieldProps} />

            {error && (
              <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">{t("email")}</Label>
              <Input
                id="email"
                type="email"
                placeholder={t("emailPlaceholder")}
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (fieldErrors.email) setFieldErrors((p) => ({ ...p, email: validateEmail(e.target.value) }));
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
                  className="text-xs font-medium text-emerald-600 hover:text-emerald-700 hover:underline"
                >
                  {t("forgotPassword")}
                </Link>
              </div>
              <Input
                id="password"
                type="password"
                placeholder={t("passwordPlaceholder")}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (fieldErrors.password) setFieldErrors((p) => ({ ...p, password: e.target.value ? null : t("passwordRequired") }));
                }}
                autoComplete="current-password"
                required
                disabled={isSubmitting}
                aria-invalid={!!fieldErrors.password}
              />
              <FieldError message={fieldErrors.password} />
            </div>
          </CardContent>
          <CardFooter className="flex-col gap-4">
            <Button
              type="submit"
              className="w-full bg-emerald-600 hover:bg-emerald-700"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t("signingIn")}
                </>
              ) : (
                t("signIn")
              )}
            </Button>

            <Button asChild variant="outline" className="w-full gap-2">
              <Link href="/login/otp">
                <Smartphone className="h-4 w-4" aria-hidden="true" />
                {t("loginWithOtp")}
              </Link>
            </Button>

            <div className="border-t pt-4 text-center text-sm text-muted-foreground">
              {t("noAccount")}{" "}
              <Link
                href="/register"
                className="font-medium text-emerald-600 underline-offset-4 hover:text-emerald-700 hover:underline"
              >
                {t("createAccount")}
              </Link>
            </div>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}