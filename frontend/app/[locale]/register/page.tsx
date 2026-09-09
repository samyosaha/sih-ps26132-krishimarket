"use client";

import { useState, FormEvent } from "react";
import { useTranslations } from "next-intl";
import { useAuth, UserRole } from "@/lib/auth-context";
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
import {
  RadioGroup,
  RadioGroupItem,
} from "@/components/ui/radio-group";
import { Loader2, AlertCircle, Sprout, ShoppingBasket } from "lucide-react";
import { FieldError } from "@/components/field-error";
import {
  validateEmail,
  validatePassword,
  validatePhone,
  validateName,
} from "@/lib/validation";
import { useHoneypot, HoneypotField, isRateLimited } from "@/lib/anti-spam";

import { Link, useRouter } from "@/i18n/navigation";

export default function RegisterPage() {
  const router = useRouter();
  const t = useTranslations("register");
  const { register } = useAuth();
  const honeypot = useHoneypot();

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<UserRole>("farmer");
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [fieldErrors, setFieldErrors] = useState<Record<string, string | null>>(
    {}
  );

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

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    if (honeypot.isFilled()) {
      setSuccessMsg(t("created"));
      return;
    }

    if (isRateLimited("register", 3, 60_000)) {
      setError(t("tooMany"));
      return;
    }

    if (!validate()) return;

    setIsSubmitting(true);
    try {
      await register({ name, phone, email, password, role });
      setSuccessMsg(t("created"));
      setTimeout(() => {
        router.push("/");
        router.refresh();
      }, 1000);
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : t("failed");
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-[calc(100vh-10rem)] items-center justify-center py-8">
      <Card className="w-full max-w-lg">
        <CardHeader className="space-y-1 text-center">
          <CardTitle className="text-2xl font-bold">{t("title")}</CardTitle>
          <CardDescription>{t("subtitle")}</CardDescription>
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
            {successMsg && (
              <div className="flex items-start gap-2 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
                <Sprout className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{successMsg}</span>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="name">{t("name")}</Label>
              <Input
                id="name"
                type="text"
                placeholder={t("namePlaceholder")}
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (fieldErrors.name) setFieldErrors((p) => ({ ...p, name: validateName(e.target.value) }));
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
                placeholder={t("phonePlaceholder")}
                value={phone}
                onChange={(e) => {
                  setPhone(e.target.value);
                  if (fieldErrors.phone) setFieldErrors((p) => ({ ...p, phone: validatePhone(e.target.value) }));
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
                <Label htmlFor="password">{t("passwordPlaceholder")}</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder={t("passwordPlaceholder")}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (fieldErrors.password) setFieldErrors((p) => ({ ...p, password: validatePassword(e.target.value) }));
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
                onValueChange={(v) => setRole(v as UserRole)}
                className="grid grid-cols-2 gap-3"
                disabled={isSubmitting}
              >
                <Label
                  htmlFor="role-farmer"
                  className={`flex cursor-pointer items-start gap-3 rounded-md border p-4 transition-all ${
                    role === "farmer"
                      ? "border-emerald-500 bg-emerald-50 ring-1 ring-emerald-500"
                      : "border-border hover:border-emerald-300 hover:bg-emerald-50/30"
                  } ${isSubmitting ? "opacity-60" : ""}`}
                >
                  <RadioGroupItem
                    value="farmer"
                    id="role-farmer"
                    className="mt-1"
                  />
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2 font-semibold text-emerald-800">
                      <Sprout className="h-4 w-4" />
                      {t("farmer")}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {t("farmerDesc")}
                    </p>
                  </div>
                </Label>

                <Label
                  htmlFor="role-buyer"
                  className={`flex cursor-pointer items-start gap-3 rounded-md border p-4 transition-all ${
                    role === "buyer"
                      ? "border-amber-500 bg-amber-50 ring-1 ring-amber-500"
                      : "border-border hover:border-amber-300 hover:bg-amber-50/30"
                  } ${isSubmitting ? "opacity-60" : ""}`}
                >
                  <RadioGroupItem
                    value="buyer"
                    id="role-buyer"
                    className="mt-1"
                  />
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2 font-semibold text-amber-800">
                      <ShoppingBasket className="h-4 w-4" />
                      {t("buyer")}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {t("buyerDesc")}
                    </p>
                  </div>
                </Label>
              </RadioGroup>
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
                  {t("creating")}
                </>
              ) : (
                t("create")
              )}
            </Button>
            <div className="text-center text-sm text-muted-foreground">
              {t("alreadyHave")}{" "}
              <Link
                href="/login"
                className="font-medium text-emerald-600 underline-offset-4 hover:text-emerald-700 hover:underline"
              >
                {t("signIn")}
              </Link>
            </div>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}