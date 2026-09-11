"use client";

import { type DeliveryStatus } from "@/lib/market-types";

/**
 * Ordered linear states for the progress line.
 * "disputed" is NOT in this array — it renders as a side-branch.
 */
const LINEAR_STEPS: { key: DeliveryStatus; label: string }[] = [
  { key: "listed", label: "Listed" },
  { key: "hub_checkin_pending", label: "Hub Check-in" },
  { key: "verified_at_hub", label: "Verified at Hub" },
  { key: "dispatched", label: "Dispatched" },
  { key: "in_transit", label: "In Transit" },
  { key: "delivered", label: "Delivered" },
];

interface Props {
  /** Current delivery status of the transaction. */
  status?: DeliveryStatus | null;
  /** Delivery method string shown once dispatched. */
  deliveryMethod?: string | null;
  /** The state the transaction was in before it moved to disputed (if known).
   *  Falls back to scanning the linear steps if not provided. */
  disputedFrom?: DeliveryStatus | null;
}

/**
 * Visual delivery-status tracker.
 *
 * Renders a horizontal progress line for the happy-path flow and,
 * when the status is "disputed", a distinct visual break-off from
 * the state it was triggered from.
 */
export function DeliveryStatusTracker({
  status,
  deliveryMethod,
  disputedFrom,
}: Props) {
  const currentStatus = status ?? "listed";
  const isDisputed = currentStatus === "disputed";

  // Index of the current state in the linear flow.
  const currentIdx = isDisputed
    ? -1
    : LINEAR_STEPS.findIndex((s) => s.key === currentStatus);

  // For disputed: figure out which linear step was the branch point.
  // If `disputedFrom` is provided, use it; otherwise guess from the last
  // reachable state that allows DISPUTE (verified_at_hub is the earliest).
  let branchIdx = -1;
  if (isDisputed) {
    if (disputedFrom) {
      branchIdx = LINEAR_STEPS.findIndex((s) => s.key === disputedFrom);
    }
    if (branchIdx < 0) {
      // Default to verified_at_hub (index 2)
      branchIdx = 2;
    }
  }

  return (
    <div className="w-full py-2">
      {/* ── Linear progress line ──────────────────────────────── */}
      <div className="relative flex items-start justify-between gap-1 sm:gap-0">
        {LINEAR_STEPS.map((step, idx) => {
          const isCompleted =
            !isDisputed && currentIdx >= 0 && idx < currentIdx;
          const isCurrent = !isDisputed && idx === currentIdx;
          const isBranch = isDisputed && idx === branchIdx;
          const isBeforeBranch = isDisputed && idx <= branchIdx;

          return (
            <div
              key={step.key}
              className="relative flex flex-1 flex-col items-center"
            >
              {/* Connector line (before this node) */}
              {idx > 0 && (
                <div
                  className={`absolute top-3 right-1/2 left-[-50%] h-0.5 transition-colors duration-500 ${
                    isCompleted || isCurrent || isBeforeBranch
                      ? "bg-emerald-600 dark:bg-emerald-500"
                      : "bg-border"
                  }`}
                  style={{ zIndex: 0 }}
                />
              )}

              {/* Node circle */}
              <div
                className={`relative z-10 flex h-6 w-6 items-center justify-center rounded-full border-2 text-[10px] font-bold transition-all duration-300 ${
                  isCompleted || (isDisputed && idx < branchIdx)
                    ? "border-emerald-600 bg-emerald-600 text-white dark:border-emerald-500 dark:bg-emerald-500"
                    : isCurrent
                    ? "border-emerald-600 bg-card text-emerald-700 ring-4 ring-emerald-500/20 dark:border-emerald-400 dark:text-emerald-300 dark:ring-emerald-400/20"
                    : isBranch
                    ? "border-amber-500 bg-amber-500 text-white ring-4 ring-amber-500/20"
                    : isBeforeBranch
                    ? "border-emerald-600 bg-emerald-600 text-white dark:border-emerald-500 dark:bg-emerald-500"
                    : "border-border bg-card text-muted-foreground"
                }`}
              >
                {isCompleted || (isDisputed && idx < branchIdx) ? (
                  <CheckIcon />
                ) : isCurrent ? (
                  <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-600 dark:bg-emerald-400" />
                ) : (
                  <span>{idx + 1}</span>
                )}
              </div>

              {/* Label */}
              <span
                className={`mt-1.5 text-center text-[10px] font-medium leading-tight sm:text-xs ${
                  isCompleted || isCurrent || (isDisputed && idx <= branchIdx)
                    ? "font-semibold text-foreground"
                    : "text-muted-foreground"
                }`}
              >
                {step.label}
              </span>

              {/* Show delivery_method below the Dispatched node */}
              {step.key === "dispatched" &&
                deliveryMethod &&
                deliveryMethod !== "pending" && (
                  <span className="mt-1 inline-block max-w-[5.5rem] truncate rounded bg-emerald-50 px-1.5 py-0.5 text-center text-[9px] font-semibold text-emerald-800 border border-emerald-200 dark:bg-emerald-950/50 dark:border-emerald-800 dark:text-emerald-300 sm:max-w-[7.5rem]">
                    {deliveryMethod.replace(/_/g, " ")}
                  </span>
                )}

              {/* ── Disputed branch-off ──────────────────────── */}
              {isBranch && isDisputed && (
                <div className="relative mt-1 flex flex-col items-center">
                  <svg
                    className="h-5 w-8 text-destructive"
                    viewBox="0 0 40 24"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M20 0 L30 24"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeDasharray="4 2"
                    />
                  </svg>
                  <div className="flex items-center gap-1 rounded-full border border-destructive/40 bg-destructive/10 px-2 py-0.5 text-destructive dark:bg-destructive/20">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-destructive" />
                    <span className="text-[9px] font-bold sm:text-[10px]">
                      Disputed
                    </span>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function CheckIcon() {
  return (
    <svg
      className="h-3 w-3"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={3}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M5 13l4 4L19 7"
      />
    </svg>
  );
}
