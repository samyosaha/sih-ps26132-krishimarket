"use client";

import { useState } from "react";
import { Star } from "lucide-react";
import { cn } from "cn";

export function StarRating({
  value = 0,
  size = "md",
  className,
}: {
  value?: number;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const px = size === "sm" ? "h-3.5 w-3.5" : size === "lg" ? "h-6 w-6" : "h-5 w-5";
  const gap = size === "sm" ? "gap-0.5" : "gap-1";
  return (
    <span className={cn("inline-flex items-center", gap, className)} aria-label={`${value} stars`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          className={cn(
            px,
            i <= Math.round(value)
              ? "fill-amber-400 text-amber-400"
              : "fill-transparent text-slate-300"
          )}
          aria-hidden="true"
        />
      ))}
    </span>
  );
}

export function StarRatingInput({
  value,
  onChange,
  size = "md",
  disabled = false,
}: {
  value: number;
  onChange: (v: number) => void;
  size?: "sm" | "md" | "lg";
  disabled?: boolean;
}) {
  const [hover, setHover] = useState(0);
  const px = size === "sm" ? "h-5 w-5" : size === "lg" ? "h-8 w-8" : "h-7 w-7";
  const active = hover || value;

  return (
    <span className="inline-flex items-center gap-1" role="radiogroup" aria-label="Rating">
      {[1, 2, 3, 4, 5].map((i) => (
        <button
          key={i}
          type="button"
          role="radio"
          aria-checked={value === i}
          disabled={disabled}
          onClick={() => onChange(i)}
          onMouseEnter={() => setHover(i)}
          onMouseLeave={() => setHover(0)}
          className={cn(
            "rounded-sm transition-transform disabled:opacity-60",
            !disabled && "hover:scale-110 active:scale-95"
          )}
        >
          <Star
            className={cn(
              px,
              i <= active
                ? "fill-amber-400 text-amber-400"
                : "fill-transparent text-slate-300"
            )}
            aria-hidden="true"
          />
        </button>
      ))}
    </span>
  );
}