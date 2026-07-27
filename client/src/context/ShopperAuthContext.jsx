import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState
} from "react";
import { shoppersApi } from "../api/client.js";

const TOKEN_KEY = "kadecloud_shopper_token";
const SHOPPER_KEY = "kadecloud_shopper";
const ShopperAuthContext = createContext(null);

function readStoredShopper() {
  const raw = localStorage.getItem(SHOPPER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (_err) {
    localStorage.removeItem(SHOPPER_KEY);
    return null;
  }
}

function storeShopper(token, shopper) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(SHOPPER_KEY, JSON.stringify(shopper));
}

function clearShopper() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(SHOPPER_KEY);
}

export function ShopperAuthProvider({ children }) {
  const [shopper, setShopper] = useState(() => readStoredShopper());
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY));
  const [loading, setLoading] = useState(Boolean(token && !shopper));

  useEffect(() => {
    let isMounted = true;
    if (!token) {
      setLoading(false);
      return;
    }
    shoppersApi
      .me()
      .then((data) => {
        if (!isMounted) return;
        setShopper(data.shopper);
        localStorage.setItem(SHOPPER_KEY, JSON.stringify(data.shopper));
      })
      .catch(() => {
        if (!isMounted) return;
        clearShopper();
        setShopper(null);
        setToken(null);
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });
    return () => {
      isMounted = false;
    };
  }, [token]);

  const adopt = useCallback((data) => {
    storeShopper(data.token, data.shopper);
    setToken(data.token);
    setShopper(data.shopper);
  }, []);

  const logout = useCallback(() => {
    clearShopper();
    setToken(null);
    setShopper(null);
  }, []);

  const updateShopper = useCallback((nextShopper) => {
    setShopper(nextShopper);
    localStorage.setItem(SHOPPER_KEY, JSON.stringify(nextShopper));
  }, []);

  const value = useMemo(
    () => ({
      shopper,
      token,
      loading,
      isAuthenticated: Boolean(shopper && token),
      googleClientId: import.meta.env.VITE_GOOGLE_CLIENT_ID || "",
      async loginWithGoogle(idToken) {
        const data = await shoppersApi.google(idToken);
        adopt(data);
        return data.shopper;
      },
      async login(credentials) {
        const data = await shoppersApi.login(credentials);
        adopt(data);
        return data.shopper;
      },
      async register(payload) {
        const data = await shoppersApi.register(payload);
        adopt(data);
        return data.shopper;
      },
      async refresh() {
        const data = await shoppersApi.me();
        updateShopper(data.shopper);
        return data.shopper;
      },
      updateShopper,
      logout
    }),
    [shopper, token, loading, adopt, logout, updateShopper]
  );

  return (
    <ShopperAuthContext.Provider value={value}>
      {children}
    </ShopperAuthContext.Provider>
  );
}

export function useShopperAuth() {
  const context = useContext(ShopperAuthContext);
  if (!context) {
    throw new Error("useShopperAuth must be used within ShopperAuthProvider");
  }
  return context;
}
