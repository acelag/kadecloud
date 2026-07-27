import { createContext, useContext, useEffect, useMemo, useState } from "react";
import {
  authApi,
  clearStoredAdminSession,
  clearStoredToken,
  getStoredAdminSession,
  getStoredUser,
  getStoredToken,
  storeAdminSession,
  storeToken,
  storeUser
} from "../api/client.js";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => getStoredUser());
  const [token, setToken] = useState(() => getStoredToken());
  const [adminSession, setAdminSession] = useState(() => getStoredAdminSession());
  const [loading, setLoading] = useState(
    Boolean(getStoredToken() && !getStoredUser())
  );

  useEffect(() => {
    let isMounted = true;

    async function loadUser() {
      if (!token) {
        setLoading(false);
        return;
      }

      try {
        const data = await authApi.me();

        if (isMounted) {
          setUser(data.user);
          storeUser(data.user);
        }
      } catch (_err) {
        clearStoredToken();

        if (isMounted) {
          setToken(null);
          setUser(null);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    loadUser();

    return () => {
      isMounted = false;
    };
  }, [token]);

  async function login(credentials) {
    const data = await authApi.login(credentials);
    storeToken(data.token);
    storeUser(data.user);
    setToken(data.token);
    setUser(data.user);
    return data.user;
  }

  async function register(payload) {
    const data = await authApi.register(payload);
    storeToken(data.token);
    storeUser(data.user);
    setToken(data.token);
    setUser(data.user);
    return data.user;
  }

  async function refreshUser() {
    const data = await authApi.me();
    storeUser(data.user);
    setUser(data.user);
    return data.user;
  }

  function logout() {
    clearStoredToken();
    setToken(null);
    setUser(null);
    setAdminSession(null);
  }

  function impersonate(data) {
    const currentSession = {
      token,
      user
    };

    storeAdminSession(currentSession);
    storeToken(data.token);
    storeUser(data.user);
    setAdminSession(currentSession);
    setToken(data.token);
    setUser(data.user);
  }

  function returnToAdmin() {
    if (!adminSession?.token || !adminSession?.user) {
      return;
    }

    storeToken(adminSession.token);
    storeUser(adminSession.user);
    clearStoredAdminSession();
    setToken(adminSession.token);
    setUser(adminSession.user);
    setAdminSession(null);
  }

  const value = useMemo(
    () => ({
      user,
      token,
      loading,
      isAuthenticated: Boolean(user && token),
      isImpersonating: Boolean(adminSession),
      login,
      register,
      refreshUser,
      logout,
      impersonate,
      returnToAdmin
    }),
    [user, token, loading, adminSession]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }

  return context;
}
