export const SUPPORTED_CURRENCIES = [
  { code: "LKR", name: "Sri Lankan Rupee", symbol: "Rs" },
  { code: "USD", name: "US Dollar", symbol: "$" },
  { code: "EUR", name: "Euro", symbol: "€" },
  { code: "GBP", name: "British Pound", symbol: "£" },
  { code: "INR", name: "Indian Rupee", symbol: "₹" },
  { code: "AUD", name: "Australian Dollar", symbol: "A$" },
  { code: "CAD", name: "Canadian Dollar", symbol: "C$" },
  { code: "SGD", name: "Singapore Dollar", symbol: "S$" },
  { code: "AED", name: "UAE Dirham", symbol: "AED" },
  { code: "JPY", name: "Japanese Yen", symbol: "¥" }
];

const FALLBACK_RATES = {
  USD: 1,
  LKR: 320,
  EUR: 0.92,
  GBP: 0.79,
  INR: 83,
  AUD: 1.5,
  CAD: 1.36,
  SGD: 1.34,
  AED: 3.67,
  JPY: 150
};

const FX_BASE = "USD";
const FX_URL = `https://open.er-api.com/v6/latest/${FX_BASE}`;
const FX_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

let cache = null;

function buildFallback() {
  return {
    base: FX_BASE,
    rates: FALLBACK_RATES,
    fetched_at: new Date().toISOString(),
    source: "fallback"
  };
}

async function fetchRates() {
  const response = await fetch(FX_URL, {
    headers: { Accept: "application/json" }
  });

  if (!response.ok) {
    throw new Error(`FX provider returned ${response.status}`);
  }

  const data = await response.json();

  if (data.result !== "success" || !data.rates) {
    throw new Error("FX provider response was malformed");
  }

  const codes = SUPPORTED_CURRENCIES.map((c) => c.code);
  const rates = {};

  for (const code of codes) {
    if (typeof data.rates[code] === "number") {
      rates[code] = data.rates[code];
    } else if (FALLBACK_RATES[code] !== undefined) {
      rates[code] = FALLBACK_RATES[code];
    }
  }

  rates[FX_BASE] = 1;

  return {
    base: FX_BASE,
    rates,
    fetched_at: new Date().toISOString(),
    source: "open.er-api.com"
  };
}

export async function getCurrencyRates() {
  const now = Date.now();
  const cacheAge = cache ? now - new Date(cache.fetched_at).getTime() : Infinity;

  if (cache && cacheAge < FX_CACHE_TTL_MS) {
    return cache;
  }

  try {
    cache = await fetchRates();
    return cache;
  } catch (err) {
    console.error("FX rate fetch failed:", err.message);

    if (!cache) {
      cache = buildFallback();
    }

    return cache;
  }
}

export async function primeCurrencyRates() {
  return getCurrencyRates();
}
