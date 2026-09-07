"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Sprout, Home, Search, ArrowLeft } from "lucide-react";

export default function NotFoundPage() {
  return (
    <div className="flex min-h-[calc(100vh-14rem)] flex-col items-center justify-center px-4 text-center">
      {/* Decorative background */}
      <div className="absolute inset-0 -z-10 overflow-hidden" aria-hidden="true">
        <div className="absolute left-1/2 top-1/3 h-[500px] w-[500px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-emerald-100/40 blur-3xl" />
        <div className="absolute right-1/4 top-1/2 h-[300px] w-[300px] rounded-full bg-amber-100/30 blur-3xl" />
      </div>

      {/* 404 number */}
      <div className="relative" aria-hidden="true">
        <span className="select-none text-[10rem] font-black leading-none tracking-tighter text-emerald-100 sm:text-[14rem]">
          404
        </span>
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-emerald-600 shadow-xl shadow-emerald-600/20">
            <Sprout className="h-10 w-10 text-white" />
          </div>
        </div>
      </div>

      {/* Text */}
      <h1 className="mt-6 text-2xl font-bold tracking-tight sm:text-3xl">
        Page not found
      </h1>
      <p className="mt-3 max-w-md text-muted-foreground">
        The page you&apos;re looking for doesn&apos;t exist, has been moved, or
        is temporarily unavailable. Let&apos;s get you back on track.
      </p>

      {/* Actions */}
      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <Button asChild className="bg-emerald-600 hover:bg-emerald-700">
          <Link href="/">
            <Home className="mr-2 h-4 w-4" aria-hidden="true" />
            Go home
          </Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/lots">
            <Search className="mr-2 h-4 w-4" aria-hidden="true" />
            Browse lots
          </Link>
        </Button>
      </div>

      {/* Back link */}
      <button
        type="button"
        onClick={() => window.history.back()}
        className="mt-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-emerald-700"
      >
        <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
        Go back to previous page
      </button>
    </div>
  );
}
