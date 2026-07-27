import { Coins } from "lucide-react";
import { useCurrency } from "../../context/CurrencyContext.jsx";

function CurrencySelector({ className = "" }) {
  const { currencies, active, setCurrency, loading } = useCurrency();

  if (loading && currencies.length === 0) {
    return null;
  }

  return (
    <label
      className={`inline-flex h-11 items-center gap-2 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-700 ${className}`}
    >
      <Coins aria-hidden="true" size={16} className="text-slate-500" />
      <span className="sr-only">Currency</span>
      <select
        value={active}
        onChange={(event) => setCurrency(event.target.value)}
        className="bg-transparent text-sm font-semibold outline-none"
      >
        {currencies.map((currency) => (
          <option key={currency.code} value={currency.code}>
            {currency.code} · {currency.symbol}
          </option>
        ))}
      </select>
    </label>
  );
}

export default CurrencySelector;
