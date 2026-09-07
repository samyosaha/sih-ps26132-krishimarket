/* ------------------------------------------------------------------ */
/*  Anti-spam utilities (honeypot + client-side rate limiting)          */
/* ------------------------------------------------------------------ */

/**
 * Honeypot field component — renders a hidden field that bots fill in.
 * If the field has a value on submit, the form was likely filled by a bot.
 *
 * Usage:
 *   const hp = useHoneypot();
 *   <form onSubmit={e => { if (hp.isFilled()) return; ... }}>
 *     <HoneypotField {...hp.fieldProps} />
 *   </form>
 */

import { useRef, useCallback } from "react";

export interface HoneypotFieldProps {
  name: string;
  inputRef: React.Ref<HTMLInputElement>;
}

export function useHoneypot() {
  const inputRef = useRef<HTMLInputElement | null>(null);

  const isFilled = useCallback(() => {
    return !!inputRef.current?.value;
  }, []);

  return {
    isFilled,
    fieldProps: {
      name: "website_url", // looks like a real field to bots
      inputRef,
    } as HoneypotFieldProps,
  };
}

export function HoneypotField({ name, inputRef }: HoneypotFieldProps) {
  return (
    <div
      aria-hidden="true"
      style={{
        position: "absolute",
        left: "-9999px",
        top: "-9999px",
        width: 0,
        height: 0,
        overflow: "hidden",
        opacity: 0,
        pointerEvents: "none",
      }}
      tabIndex={-1}
    >
      <label htmlFor={`hp-${name}`}>
        Do not fill this field
      </label>
      <input
        ref={inputRef}
        id={`hp-${name}`}
        name={name}
        type="text"
        tabIndex={-1}
        autoComplete="off"
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Client-side rate limiter                                           */
/* ------------------------------------------------------------------ */

const submissionTimestamps: Map<string, number[]> = new Map();

/**
 * Check if a form action is being submitted too frequently.
 * Returns true if the submission should be blocked.
 *
 * @param formId  Unique identifier for the form (e.g. "register", "login")
 * @param limit   Max number of submissions allowed in the window
 * @param windowMs  Time window in milliseconds (default: 60s)
 */
export function isRateLimited(
  formId: string,
  limit: number = 5,
  windowMs: number = 60_000
): boolean {
  const now = Date.now();
  const timestamps = submissionTimestamps.get(formId) || [];

  // Remove expired timestamps
  const valid = timestamps.filter((t) => now - t < windowMs);

  if (valid.length >= limit) {
    submissionTimestamps.set(formId, valid);
    return true;
  }

  valid.push(now);
  submissionTimestamps.set(formId, valid);
  return false;
}
