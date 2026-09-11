"use client";

import { useState } from "react";
import Image from "next/image";
import { type Transaction } from "@/lib/market-types";
import {
  ShieldCheck,
  Scale,
  Award,
  AlertTriangle,
  Camera,
  CheckCircle2,
  Maximize2,
  X,
  FileCheck,
  AlertCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface Props {
  transaction: Transaction;
  onOpenDispute?: () => void;
  className?: string;
}

export function HubCheckinEvidence({
  transaction,
  onOpenDispute,
  className = "",
}: Props) {
  const [photoModalOpen, setPhotoModalOpen] = useState(false);

  const checkinWeight = transaction.hub_checkin_weight_kg;
  const listedWeight =
    transaction.lot_quantity_kg ?? transaction.quantity;
  const checkinGrade = transaction.hub_checkin_grade;
  const listedGrade = transaction.lot_grade;
  const photoUrl = transaction.hub_checkin_photo_url;

  // Has check-in happened?
  const hasCheckinData =
    checkinWeight !== null && checkinWeight !== undefined ||
    checkinGrade !== null && checkinGrade !== undefined ||
    photoUrl !== null && photoUrl !== undefined ||
    transaction.delivery_status === "verified_at_hub" ||
    transaction.delivery_status === "dispatched" ||
    transaction.delivery_status === "in_transit" ||
    transaction.delivery_status === "delivered" ||
    transaction.delivery_status === "disputed";

  if (!hasCheckinData) return null;

  // Weight mismatch calculation
  const weightDiff =
    checkinWeight !== null &&
    checkinWeight !== undefined &&
    listedWeight !== null &&
    listedWeight !== undefined
      ? checkinWeight - listedWeight
      : 0;
  const isWeightMismatch =
    checkinWeight !== null &&
    checkinWeight !== undefined &&
    listedWeight !== null &&
    listedWeight !== undefined &&
    Math.abs(weightDiff) >= 0.5;

  // Grade mismatch calculation
  const isGradeMismatch =
    Boolean(checkinGrade && listedGrade) &&
    checkinGrade?.trim().toUpperCase() !== listedGrade?.trim().toUpperCase();

  const hasAnyMismatch = isWeightMismatch || isGradeMismatch;

  return (
    <div
      className={`overflow-hidden rounded-xl border ${
        hasAnyMismatch
          ? "border-amber-400 bg-amber-50/20 shadow-xs dark:border-amber-600/70 dark:bg-amber-950/20"
          : "border-border bg-card shadow-xs"
      } ${className}`}
    >
      {/* ── Verification Certificate Header ──────────────────────── */}
      <div
        className={`flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3 ${
          hasAnyMismatch
            ? "border-amber-300 bg-amber-100/60 dark:border-amber-800/60 dark:bg-amber-950/40"
            : "border-border bg-muted/40"
        }`}
      >
        <div className="flex items-center gap-2.5">
          <div
            className={`flex h-8 w-8 items-center justify-center rounded-full ${
              hasAnyMismatch
                ? "bg-amber-200 text-amber-900 dark:bg-amber-900 dark:text-amber-200"
                : "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
            }`}
          >
            {hasAnyMismatch ? (
              <AlertTriangle className="h-4 w-4 text-amber-700 dark:text-amber-300" />
            ) : (
              <ShieldCheck className="h-4 w-4 text-emerald-700 dark:text-emerald-300" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="text-sm font-bold tracking-tight text-foreground">
                Hub Intake Verification Evidence
              </h4>
              <Badge
                variant="outline"
                className="border-emerald-600/40 bg-emerald-50 text-[10px] font-semibold text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300"
              >
                Physical Inspection
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              Official intake verification certificate recorded at drop-off Mandi Hub
            </p>
          </div>
        </div>

        <div>
          {hasAnyMismatch ? (
            <Badge className="border border-amber-500 bg-amber-500 text-white font-bold animate-pulse">
              <AlertCircle className="mr-1 h-3 w-3" /> Mismatch Flagged
            </Badge>
          ) : (
            <Badge className="bg-emerald-600 text-white font-semibold hover:bg-emerald-600">
              <CheckCircle2 className="mr-1 h-3 w-3" /> Verification Passed
            </Badge>
          )}
        </div>
      </div>

      {/* ── Mismatch Alert Banner (Visual & Distinct) ──────────────── */}
      {hasAnyMismatch && (
        <div className="border-b border-amber-300 bg-amber-50 p-3 text-xs text-amber-950 dark:border-amber-800/60 dark:bg-amber-950/60 dark:text-amber-200 sm:px-4">
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
            <div className="flex-1 space-y-1">
              <span className="font-bold uppercase tracking-wide text-amber-800 dark:text-amber-300">
                Discrepancy Detected During Hub Intake
              </span>
              <p className="leading-relaxed">
                The hub physical inspection recorded a mismatch against the farmer&apos;s listing.
                Please review the evidence below before dispatch or final release of payment.
              </p>
            </div>
            {onOpenDispute && (
              <Button
                size="sm"
                variant="destructive"
                onClick={onOpenDispute}
                className="shrink-0 bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs h-7 px-2.5"
              >
                Raise Dispute
              </Button>
            )}
          </div>
        </div>
      )}

      {/* ── Evidence Inspection Grid ───────────────────────────────── */}
      <div className="grid gap-4 p-4 sm:grid-cols-3">
        {/* 1. Photo Evidence */}
        <div className="rounded-lg border border-border bg-card p-3 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <Camera className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                Intake Photo
              </span>
              <span className="text-[10px] text-muted-foreground">Drop-off proof</span>
            </div>

            <div className="mt-2 relative">
              {photoUrl ? (
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => setPhotoModalOpen(true)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") setPhotoModalOpen(true);
                  }}
                  className="group relative h-28 w-full cursor-pointer overflow-hidden rounded-md border border-border bg-muted"
                >
                  <Image
                    src={photoUrl}
                    alt="Hub check-in physical lot evidence"
                    fill
                    sizes="(max-width: 640px) 100vw, 33vw"
                    className="object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 transition-opacity group-hover:opacity-100">
                    <span className="flex items-center gap-1 rounded bg-black/75 px-2 py-1 text-[11px] font-semibold text-white">
                      <Maximize2 className="h-3 w-3" /> View Full
                    </span>
                  </div>
                </div>
              ) : (
                <div className="flex h-28 w-full flex-col items-center justify-center rounded-md border border-dashed border-border bg-muted/20 p-2 text-center">
                  <div className="rounded-full bg-emerald-100 p-2 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                    <FileCheck className="h-5 w-5" />
                  </div>
                  <span className="mt-1 text-xs font-semibold text-foreground">
                    Physical Inspection On File
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    Recorded at Hub intake
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className="mt-2 text-[11px] text-muted-foreground flex items-center gap-1">
            <CheckCircle2 className="h-3 w-3 text-emerald-600" />
            <span>Produce condition verified</span>
          </div>
        </div>

        {/* 2. Weight Verification */}
        <div
          className={`rounded-lg border p-3 flex flex-col justify-between ${
            isWeightMismatch
              ? "border-amber-400 bg-amber-50/50 dark:border-amber-700/60 dark:bg-amber-950/30"
              : "border-border bg-card"
          }`}
        >
          <div>
            <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <Scale
                  className={`h-3.5 w-3.5 ${
                    isWeightMismatch
                      ? "text-amber-600 dark:text-amber-400"
                      : "text-emerald-600 dark:text-emerald-400"
                  }`}
                />
                Scale Weight
              </span>
              {isWeightMismatch ? (
                <span className="rounded bg-amber-200 px-1.5 py-0.2 text-[10px] font-bold text-amber-900 dark:bg-amber-900 dark:text-amber-200">
                  Mismatch
                </span>
              ) : (
                <span className="text-[10px] text-emerald-700 dark:text-emerald-400">
                  Verified
                </span>
              )}
            </div>

            <div className="mt-2 space-y-1.5">
              <div className="flex items-baseline justify-between">
                <span className="text-xs text-muted-foreground">Weighed at Hub:</span>
                <span className="text-lg font-bold text-foreground">
                  {checkinWeight !== null && checkinWeight !== undefined
                    ? `${checkinWeight} kg`
                    : listedWeight
                    ? `${listedWeight} kg`
                    : "—"}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs text-muted-foreground border-t border-border/60 pt-1">
                <span>Farmer Listed:</span>
                <span>{listedWeight ? `${listedWeight} kg` : "—"}</span>
              </div>
            </div>
          </div>

          <div className="mt-2 pt-1">
            {isWeightMismatch ? (
              <div className="rounded border border-amber-400/80 bg-amber-100/70 p-1.5 text-[11px] font-semibold text-amber-900 dark:bg-amber-950/80 dark:text-amber-200">
                ⚠️ Delta: {weightDiff > 0 ? `+${weightDiff.toFixed(1)}` : weightDiff.toFixed(1)} kg discrepancy
              </div>
            ) : (
              <div className="flex items-center gap-1 text-[11px] text-emerald-700 dark:text-emerald-400 font-medium">
                <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                <span>Exact weight match confirmed</span>
              </div>
            )}
          </div>
        </div>

        {/* 3. Quality Grade Verification */}
        <div
          className={`rounded-lg border p-3 flex flex-col justify-between ${
            isGradeMismatch
              ? "border-amber-400 bg-amber-50/50 dark:border-amber-700/60 dark:bg-amber-950/30"
              : "border-border bg-card"
          }`}
        >
          <div>
            <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <Award
                  className={`h-3.5 w-3.5 ${
                    isGradeMismatch
                      ? "text-amber-600 dark:text-amber-400"
                      : "text-purple-600 dark:text-purple-400"
                  }`}
                />
                Quality Grade
              </span>
              {isGradeMismatch ? (
                <span className="rounded bg-amber-200 px-1.5 py-0.2 text-[10px] font-bold text-amber-900 dark:bg-amber-900 dark:text-amber-200">
                  Mismatch
                </span>
              ) : (
                <span className="text-[10px] text-emerald-700 dark:text-emerald-400">
                  Verified
                </span>
              )}
            </div>

            <div className="mt-2 space-y-1.5">
              <div className="flex items-baseline justify-between">
                <span className="text-xs text-muted-foreground">Hub Assessed:</span>
                <span className="text-lg font-bold text-foreground">
                  {checkinGrade
                    ? `Grade ${checkinGrade}`
                    : listedGrade
                    ? `Grade ${listedGrade}`
                    : "Grade A"}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs text-muted-foreground border-t border-border/60 pt-1">
                <span>Farmer Claimed:</span>
                <span>{listedGrade ? `Grade ${listedGrade}` : "Grade A"}</span>
              </div>
            </div>
          </div>

          <div className="mt-2 pt-1">
            {isGradeMismatch ? (
              <div className="rounded border border-amber-400/80 bg-amber-100/70 p-1.5 text-[11px] font-semibold text-amber-900 dark:bg-amber-950/80 dark:text-amber-200">
                ⚠️ Grade downgraded from {listedGrade} to {checkinGrade}
              </div>
            ) : (
              <div className="flex items-center gap-1 text-[11px] text-emerald-700 dark:text-emerald-400 font-medium">
                <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                <span>Quality grade standards verified</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Photo Modal ────────────────────────────────────────────── */}
      {photoModalOpen && photoUrl && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
        >
          <div className="relative max-h-[90vh] max-w-2xl overflow-hidden rounded-xl bg-card p-2 shadow-2xl">
            <button
              onClick={() => setPhotoModalOpen(false)}
              className="absolute right-4 top-4 z-10 rounded-full bg-black/60 p-1.5 text-white hover:bg-black"
            >
              <X className="h-4 w-4" />
            </button>
            <div className="relative h-[65vh] w-[80vw] max-w-xl">
              <Image
                src={photoUrl}
                alt="Hub inspection photo full"
                fill
                className="rounded-lg object-contain"
              />
            </div>
            <div className="p-3 text-center text-xs text-muted-foreground">
              Intake physical evidence photo recorded by Mandi Hub operator
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
