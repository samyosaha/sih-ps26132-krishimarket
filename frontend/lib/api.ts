export interface ApiErrorData {
  detail?: string | { message: string }[];
  message?: string;
  [key: string]: unknown;
}

export class ApiError extends Error {
  public status: number;
  public data: ApiErrorData;

  constructor(message: string, status: number, data: ApiErrorData = {}) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.data = data;
  }
}

export interface FetchOptions extends RequestInit {
  params?: Record<string, string | number | boolean | undefined>;
}

const TOKEN_KEY = "auth_token";

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(TOKEN_KEY);
}

function buildUrlWithParams(
  base: string,
  params?: Record<string, string | number | boolean | undefined>
): string {
  if (!params) return base;
  const usp = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null) {
      usp.append(key, String(value));
    }
  }
  const qs = usp.toString();
  return qs ? `${base}${base.includes("?") ? "&" : "?"}${qs}` : base;
}

function extractErrorMessage(status: number, data: ApiErrorData): string {
  if (data.detail) {
    if (typeof data.detail === "string") return data.detail;
    if (Array.isArray(data.detail)) {
      const first = data.detail[0];
      if (first && typeof first === "object" && "message" in first) {
        return String(first.message);
      }
      return data.detail.map((d) => (typeof d === "object" && d ? d : String(d))).join(", ");
    }
  }
  if (data.message && typeof data.message === "string") return data.message;
  switch (status) {
    case 400:
      return "Bad request — please check your input.";
    case 401:
      return "Authentication required — please log in.";
    case 403:
      return "Access forbidden.";
    case 404:
      return "Resource not found.";
    case 409:
      return "Conflict — resource already exists.";
    case 422:
      return "Validation error — please check your input.";
    case 500:
      return "Server error — please try again later.";
    default:
      return `Request failed with status ${status}.`;
  }
}

export async function apiFetch<T = unknown>(
  path: string,
  options: FetchOptions = {}
): Promise<T> {
  const baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
  const { params, headers: customHeaders, ...rest } = options;

  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const url = buildUrlWithParams(`${baseUrl}${normalizedPath}`, params);

  const headers: Record<string, string> = {
    Accept: "application/json",
    ...(rest.body && !(rest.body instanceof FormData)
      ? { "Content-Type": "application/json" }
      : {}),
    ...(customHeaders as Record<string, string> | undefined),
  };

  const token = getToken();
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetch(url, {
    ...rest,
    headers,
  });

  let data: ApiErrorData | T;
  const text = await response.text();
  try {
    data = text ? (JSON.parse(text) as T | ApiErrorData) : ({} as T);
  } catch {
    data = { message: text } as ApiErrorData;
  }

  if (!response.ok) {
    const message = extractErrorMessage(
      response.status,
      data as ApiErrorData
    );
    throw new ApiError(message, response.status, data as ApiErrorData);
  }

  return data as T;
}
