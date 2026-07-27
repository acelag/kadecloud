import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState
} from "react";
import { publicStoreApi } from "../api/client.js";

const StoreHostContext = createContext({
  store: null,
  surface: null,
  loading: true
});

export function StoreHostProvider({ children }) {
  const [store, setStore] = useState(null);
  // Which surface this host serves: "storefront", "admin", or null (platform
  // host / no match — the default admin console).
  const [surface, setSurface] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    const host = window.location.host;

    publicStoreApi
      .resolveByHost(host)
      .then((data) => {
        if (isMounted) {
          setStore(data.store);
          const resolvedSurface = data.store?.surface || "storefront";
          setSurface(resolvedSurface);
          // Brand the browser tab with the store name on storefront hosts.
          // (Admin hosts are branded by DashboardLayout instead.)
          if (data.store && resolvedSurface === "storefront") {
            document.title = data.store.name;
          }
        }
      })
      .catch(() => {
        if (isMounted) {
          setStore(null);
          setSurface(null);
        }
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const value = useMemo(
    () => ({ store, surface, loading }),
    [store, surface, loading]
  );

  return (
    <StoreHostContext.Provider value={value}>
      {children}
    </StoreHostContext.Provider>
  );
}

export function useStoreHost() {
  return useContext(StoreHostContext);
}
