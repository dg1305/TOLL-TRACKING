import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { authApi, setToken } from "./client.js";

const Ctx = createContext(null);

function isTruthy(v) {
  return v === "1" || v === 1 || v === true || v === "true";
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const t = localStorage.getItem("3i_token");
    if (!t) {
      setLoading(false);
      return;
    }
    authApi
      .me()
      .then((u) => setUser(u))
      .catch(() => setToken(null))
      .finally(() => setLoading(false));
  }, []);

  const permissions = user?.permissions && typeof user.permissions === "object" ? user.permissions : {};
  const isAdmin = isTruthy(permissions.superuser) || isTruthy(permissions.admin);

  const can = useCallback(
    (permission) => {
      if (isTruthy(permissions.superuser) || isTruthy(permissions.admin)) return true;
      return isTruthy(permissions[permission]);
    },
    [permissions],
  );

  const value = useMemo(
    () => ({
      user,
      loading,
      permissions,
      isAdmin,
      can,
      displayName: user?.name || [user?.first_name, user?.last_name].filter(Boolean).join(" ") || user?.email || "User",
      async login(email, password) {
        const res = await authApi.login(email, password);
        setToken(res.token);
        setUser(res.user);
        return res.user;
      },
      logout() {
        authApi.logout();
        setToken(null);
        setUser(null);
      },
      async refreshUser() {
        const u = await authApi.me();
        setUser(u);
      },
    }),
    [user, loading, permissions, isAdmin, can],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth outside provider");
  return ctx;
}
