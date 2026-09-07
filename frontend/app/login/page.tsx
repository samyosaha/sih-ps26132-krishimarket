"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, FormEvent } from "react";
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
import { Loader2, AlertCircle } from "lucide-react";
import { FieldError } from "@/components/field-error";
import { validateEmail } from "@/lib/validation";
import { useHoneypot, HoneypotField, isRateLimited } from "@/lib/anti-spam";

export default function LoginPage() {
  const router = useRouter();
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
      password: !password ? "Password is required." : null,
    };
    setFieldErrors(errors);
    return !Object.values(errors).some(Boolean);
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    // Anti-spam: honeypot
    if (honeypot.isFilled()) {
      setError("Login failed. Please try again.");
      return;
    }

    // Anti-spam: rate limit (5 attempts per minute)
    if (isRateLimited("login", 5, 60_000)) {
      setError("Too many login attempts. Please wait a minute and try again.");
      return;
    }

    // Validation
    if (!validate()) return;

    setIsSubmitting(true);
    try {
      await login({ email, password });
      router.push("/");
      router.refresh();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Login failed. Please try again.";
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-[calc(100vh-10rem)] items-center justify-center py-8">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1 text-center">
          <CardTitle className="text-2xl font-bold">Welcome back</CardTitle>
          <CardDescription>
            Log in to your KrishiMarket account
          </CardDescription>
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
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="farmer@example.com"
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
                <Label htmlFor="password">Password</Label>
              </div>
              <Input
                id="password"
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (fieldErrors.password) setFieldErrors((p) => ({ ...p, password: e.target.value ? null : "Password is required." }));
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
                  Signing in…
                </>
              ) : (
                "Sign in"
              )}
            </Button>
            <div className="text-center text-sm text-muted-foreground">
              Don&apos;t have an account?{" "}
              <Link
                href="/register"
                className="font-medium text-emerald-600 underline-offset-4 hover:text-emerald-700 hover:underline"
              >
                Create an account
              </Link>
            </div>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
