/* ------------------------------------------------------------------ */
/*  Shared client-side form validation helpers                         */
/* ------------------------------------------------------------------ */

export interface ValidationError {
  field: string;
  message: string;
}

export function validateEmail(email: string): string | null {
  if (!email.trim()) return "Email is required.";
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!re.test(email)) return "Please enter a valid email address.";
  return null;
}

export function validatePassword(password: string): string | null {
  if (!password) return "Password is required.";
  if (password.length < 8) return "Password must be at least 8 characters.";
  if (password.length > 128) return "Password is too long.";
  if (!/[A-Za-z]/.test(password)) return "Password must contain at least one letter.";
  if (!/\d/.test(password)) return "Password must contain at least one digit.";
  return null;
}

export function validatePhone(phone: string): string | null {
  if (!phone.trim()) return "Phone number is required.";
  // Accept Indian phone numbers (10 digits, optional +91 prefix)
  const cleaned = phone.replace(/[\s\-().+]/g, "");
  const re = /^(91)?[6-9]\d{9}$/;
  if (!re.test(cleaned))
    return "Please enter a valid 10-digit Indian phone number.";
  return null;
}

export function validateName(name: string): string | null {
  if (!name.trim()) return "Name is required.";
  if (name.trim().length < 2) return "Name must be at least 2 characters.";
  if (name.trim().length > 100) return "Name is too long.";
  return null;
}

export function validatePositiveNumber(
  value: number | "",
  fieldLabel: string
): string | null {
  if (value === "" || value === 0) return `${fieldLabel} is required.`;
  if (typeof value !== "number" || isNaN(value))
    return `${fieldLabel} must be a number.`;
  if (value <= 0) return `${fieldLabel} must be greater than zero.`;
  if (value > 10_000_000) return `${fieldLabel} seems too high — please check.`;
  return null;
}

export function validateRequired(
  value: string,
  fieldLabel: string
): string | null {
  if (!value || !value.trim()) return `${fieldLabel} is required.`;
  return null;
}
