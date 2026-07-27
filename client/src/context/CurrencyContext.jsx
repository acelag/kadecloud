import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState
} from "react";
import { currenciesApi } from "../api/client.js";

const STORAGE_KEY = "kadecloud_display_currency";
const CurrencyContext = createContext(null);

function readStoredCurrency() {
  if (typeof window === "undefined") {
    return null;
  }
  return window.localStorage.getItem(STORAGE_KEY) || null;
}

function writeStoredCurrency(code) {
  if (typeof window === "undefined") {
    return;
  }
  if (code) {
    window.localStorage.setItem(STORAGE_KEY, code);
  } else {
    window.localStorage.removeItem(STORAGE_KEY);
  }
}

export function CurrencyProvider({ children }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState(() => readStoredCurrency());
  const [storeCurrency, setStoreCurrencyState] = useState(null);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);

    currenciesApi
      .list()
      .then((payload) => {
        if (isMounted) {
          setData(payload);
        }
      })
      .catch((err) => {
        if (isMounted) {
          setError(err.message || "Unable to load currencies");
        }
      })
      .finally(() => {
        if (isMounted) {
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const fallback = storeCurrency || data?.platform_default_currency || "LKR";
  const active = selected || fallback;

  const setCurrency = useCallback((code) => {
    setSelected(code || null);
    writeStoredCurrency(code || null);
  }, []);

  const setStoreCurrency = useCallback((code) => {
    setStoreCurrencyState(code || null);
  }, []);

  const value = useMemo(() => {
    const rates = data?.rates || {};
    const currencies = data?.currencies || [];
    const symbolByCode = new Map(currencies.map((c) => [c.code, c.symbol]));
    const nameByCode = new Map(currencies.map((c) => [c.code, c.name]));

    function convert(amount, sourceCode, targetCode = active) {
      const value = Number(amount);
      if (!Number.isFinite(value)) {
        return 0;
      }
      if (!sourceCode || !targetCode || sourceCode === targetCode) {
        return value;
      }
      const sourceRate = rates[sourceCode];
      const targetRate = rates[targetCode];
      if (!sourceRate || !targetRate) {
        return value;
      }
      return value * (targetRate / sourceRate);
    }

    function format(amount, targetCode = active) {
      const value = Number(amount);
      if (!Number.isFinite(value)) {
        return symbolByCode.get(targetCode) || targetCode;
      }

      let fractionDigits = 2;
      if (targetCode === "JPY") {
        fractionDigits = 0;
      } else if (Math.abs(value) >= 100000) {
        fractionDigits = 0;
      }

      try {
        return new Intl.NumberFormat("en-LK", {
          style: "currency",
          currency: targetCode,
          minimumFractionDigits: fractionDigits,
          maximumFractionDigits: fractionDigits
        }).format(value);
      } catch (_err) {
        const symbol = symbolByCode.get(targetCode) || `${targetCode} `;
        return `${symbol}${value.toLocaleString("en-LK", {
          minimumFractionDigits: fractionDigits,
          maximumFractionDigits: fractionDigits
        })}`;
      }
    }

    function formatFromSource(amount, sourceCode, targetCode = active) {
      return format(convert(amount, sourceCode, targetCode), targetCode);
    }

    return {
      loading,
      error,
      currencies,
      rates,
      ratesSource: data?.source || null,
      fetchedAt: data?.fetched_at || null,
      base: data?.base || null,
      platformDefault: data?.platform_default_currency || null,
      storeCurrency,
      active,
      setCurrency,
      setStoreCurrency,
      convert,
      format,
      formatFromSource,
      getSymbol: (code) => symbolByCode.get(code) || code,
      getName: (code) => nameByCode.get(code) || code
    };
  }, [data, loading, error, active, storeCurrency, setCurrency, setStoreCurrency]);

  return (
    <CurrencyContext.Provider value={value}>{children}</CurrencyContext.Provider>
  );
}

export function useCurrency() {
  const context = useContext(CurrencyContext);
  if (!context) {
    throw new Error("useCurrency must be used within CurrencyProvider");
  }
  return context;
}
