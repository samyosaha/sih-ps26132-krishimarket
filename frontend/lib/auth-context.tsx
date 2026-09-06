"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  useCallback,
} from "react";
import { apiFetch, setToken as persistToken, clearToken as removeToken } from "./api";

export type UserRole = "farmer" | "buyer";

export interface User {
  id?: string | number;
  name: string;
  phone?: string;
  email: string;
  role: UserRole;
  [key: string]: unknown;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface RegisterPayload {
  name: string;
  phone: string;
  email: string;
  password: string;
  role: UserRole;
}

interface AuthContextValue {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (payload: LoginPayload) => Promise<void>;
  register: (payload: RegisterPayload) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const TOKEN_KEY = "auth_token";

function getStoredToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setTokenState] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const fetchCurrentUser = useCallback(async (): Promise<void> => {
    const currentToken = getStoredToken();
    if (!currentToken) {
      setIsLoading(false);
      return;
    }
    setTokenState(currentToken);
    try {
      const me = await apiFetch<User>("/auth/me");
      setUser(me);
    } catch {
      removeToken();
      setTokenState(null);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCurrentUser();
  }, [fetchCurrentUser]);

  const login = useCallback(async (payload: LoginPayload): Promise<void> => {
    const res = await apiFetch<{ access_token: string }>("/auth/login", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    const accessToken = res.access_token;
    persistToken(accessToken);
    setTokenState(accessToken);
    const me = await apiFetch<User>("/auth/me");
    setUser(me);
  }, []);

  const register = useCallback(
    async (payload: RegisterPayload): Promise<void> => {
      await apiFetch("/auth/register", {
        method: "POST",
        body: JSON.stringify(payload),
      });
    },
    []
  );

  const logout = useCallback((): void => {
    removeToken();
    setTokenState(null);
    setUser(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      token,
      isAuthenticated: !!user && !!token,
      isLoading,
      login,
      register,
      logout,
      refreshUser: fetchCurrentUser,
    }),
    [user, token, isLoading, login, register, logout, fetchCurrentUser]
  );

  return (
    <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
}
