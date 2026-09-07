/**
 * Inline field error message — renders below a form field.
 * Only visible when `message` is truthy.
 */
export function FieldError({ message }: { message?: string | null }) {
  if (!message) return null;
  return (
    <p className="text-[13px] font-medium text-red-600 mt-1.5" role="alert">
      {message}
    </p>
  );
}
