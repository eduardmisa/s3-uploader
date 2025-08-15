import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import axios from "axios";
import { useRouter } from "next/router";

const BACKEND_API_URL = process.env.NEXT_PUBLIC_BACKEND_API_URL || "";

interface User {
  email: string;
  name?: string;
}

interface AuthContextValue {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  getAuthHeader: () => { Authorization?: string };
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Load token from localStorage (client-only)
    try {
      const stor = typeof window !== "undefined" ? localStorage.getItem("s3u_token") : null;
      const storUser = typeof window !== "undefined" ? localStorage.getItem("s3u_user") : null;
      if (stor) {
        setToken(stor);
      }
      if (storUser) {
        try {
          setUser(JSON.parse(storUser));
        } catch {
          setUser(null);
        }
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const login = async (email: string, password: string) => {
    const resp = await axios.post(`${BACKEND_API_URL}/auth/login`, { email, password }, { headers: { "Content-Type": "application/json" } });
    const { token: tkn, user: u } = resp.data;
    if (!tkn) throw new Error("No token returned");
    setToken(tkn);
    setUser(u || null);
    if (typeof window !== "undefined") {
      localStorage.setItem("s3u_token", tkn);
      localStorage.setItem("s3u_user", JSON.stringify(u || null));
    }
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    if (typeof window !== "undefined") {
      localStorage.removeItem("s3u_token");
      localStorage.removeItem("s3u_user");
    }
  };

  const getAuthHeader = () => {
    if (token) return { Authorization: `Bearer ${token}` };
    // fallback to looking into localStorage (for modules that import this function)
    if (typeof window !== "undefined") {
      const t = localStorage.getItem("s3u_token");
      if (t) return { Authorization: `Bearer ${t}` };
    }
    return {};
  };

  const value = useMemo(
    () => ({
      user,
      token,
      loading,
      login,
      logout,
      getAuthHeader,
    }),
    [user, token, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextValue => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};

/**
 * Component to protect routes. Place this inside _app so that it wraps pages.
 * It redirects to /login for unauthenticated access.
 *
 * Usage:
 *  <AuthGuard>
 *    <Component {...pageProps} />
 *  </AuthGuard>
 */
export const AuthGuard: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { token, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    const publicPaths = ["/login", "/_next", "/api"]; // allow login and next internals
    const pathname = router.pathname;

    // Allow if the path starts with any public prefix
    const isPublic = publicPaths.some((p) => pathname === p || pathname.startsWith(p));
    if (!isPublic && !token) {
      router.replace("/login");
    }
  }, [token, loading, router]);

  // While we determine auth status, avoid flashing
  if (loading) return null;

  return <>{children}</>;
};
