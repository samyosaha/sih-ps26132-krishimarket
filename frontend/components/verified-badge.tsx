import { BadgeCheck } from "lucide-react";
import { cn } from "cn";

export function VerifiedBadge({
  verified = false,
  compact = false,
  className,
}: {
  verified?: boolean;
  compact?: boolean;
  className?: string;
}) {
  if (!verified) return null;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full bg-emerald-100 font-semibold text-emerald-700",
        compact ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-0.5 text-xs",
        className
      )}
      title="Verified business"
    >
      <BadgeCheck className={compact ? "h-3 w-3" : "h-3.5 w-3.5"} aria-hidden="true" />
      Verified
    </span>
  );
}