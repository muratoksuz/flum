import { useEffect, useState } from "react";
import { api, fmtTRY } from "@/lib/apiClient";
import { TrendUp } from "@phosphor-icons/react";
import { Link } from "react-router-dom";

const LABELS = { USD: "Dolar", EUR: "Euro", XAU: "Altın/g", XAG: "Gümüş/g" };

export default function RatesTicker() {
  const [rates, setRates] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get("/rates");
        setRates(data.rates_to_try || {});
      } catch { /* silent */ }
    })();
  }, []);

  return (
    <Link to="/kurlar" className="card-flat p-4 mb-6 flex items-center justify-between hover:bg-white transition-colors" data-testid="rates-ticker">
      <div className="flex items-center gap-3">
        <div className="h-8 w-8 bg-neutral-900 text-white flex items-center justify-center rounded-sm">
          <TrendUp size={16} weight="bold" />
        </div>
        <div className="label-mini">Güncel Kurlar</div>
      </div>
      <div className="flex items-center gap-6 flex-wrap">
        {["USD", "EUR", "XAU", "XAG"].map((c) => (
          <div key={c} className="flex items-center gap-1.5" data-testid={`ticker-${c}`}>
            <span className="text-[10px] uppercase tracking-[0.2em] text-neutral-500 font-semibold">{LABELS[c]}</span>
            <span className="num font-semibold text-sm">{rates?.[c] != null ? fmtTRY(rates[c]) : "…"}</span>
          </div>
        ))}
      </div>
    </Link>
  );
}
