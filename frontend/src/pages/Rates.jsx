import { useEffect, useState } from "react";
import Layout from "@/components/Layout";
import { PageHeader } from "@/components/Bits";
import { api, fmtTRY, fmtDate, formatApiError } from "@/lib/apiClient";
import { toast } from "sonner";
import { ArrowsClockwise, CurrencyDollar, CurrencyEur, Coins, Coin } from "@phosphor-icons/react";

const ROWS = [
  { code: "USD", label: "ABD Doları", sub: "1 USD", Icon: CurrencyDollar },
  { code: "EUR", label: "Euro", sub: "1 EUR", Icon: CurrencyEur },
  { code: "XAU", label: "Altın (Gram)", sub: "1 gr Au", Icon: Coins },
  { code: "XAG", label: "Gümüş (Gram)", sub: "1 gr Ag", Icon: Coin },
];

export default function Rates() {
  const [doc, setDoc] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    try { setDoc((await api.get("/rates")).data); }
    catch (e) { toast.error(formatApiError(e)); }
  };
  useEffect(() => { load(); }, []);

  const refresh = async () => {
    setBusy(true);
    try {
      const { data } = await api.post("/rates/refresh");
      setDoc(data);
      toast.success("Kurlar güncellendi");
    } catch (e) { toast.error(formatApiError(e)); }
    finally { setBusy(false); }
  };

  const rates = doc?.rates_to_try || {};

  return (
    <Layout>
      <PageHeader
        subtitle="Kurlar"
        title="Döviz ve Kıymetli Maden Kurları"
        testid="rates-header"
        actions={
          <button onClick={refresh} disabled={busy}
                  className="inline-flex items-center gap-2 h-10 px-4 border border-[#D4D4D4] rounded-full text-sm font-semibold bg-white hover:bg-neutral-50 transition-colors disabled:opacity-50"
                  data-testid="refresh-rates-button">
            <ArrowsClockwise size={16} weight="bold" className={busy ? "animate-spin" : ""} />
            {busy ? "Güncelleniyor..." : "Kurları Yenile"}
          </button>
        }
      />

      <div className="card-flat p-4 mb-6 text-xs text-neutral-500 flex items-center justify-between" data-testid="rates-meta">
        <span>Kaynak tarihi: <strong className="num text-neutral-800">{doc?.source_date || "-"}</strong></span>
        <span>Son çekim: <strong className="num text-neutral-800">{doc?.fetched_at ? fmtDate(doc.fetched_at) : "-"}</strong></span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {ROWS.map(({ code, label, sub, Icon }) => (
          <div key={code} className="card-flat p-6 flex items-center justify-between hover:-translate-y-0.5 transition-transform duration-200" data-testid={`rate-card-${code}`}>
            <div className="flex items-center gap-4">
              <div className="h-11 w-11 bg-neutral-900 text-white flex items-center justify-center rounded-sm">
                <Icon size={22} weight="bold" />
              </div>
              <div>
                <div className="label-mini">{label}</div>
                <div className="h-display text-lg font-bold mt-1">{sub}</div>
              </div>
            </div>
            <div className="text-right">
              <div className="stat-value text-2xl">{rates[code] != null ? fmtTRY(rates[code]) : "-"}</div>
              <div className="text-xs text-neutral-500 mt-1">Türk Lirası cinsinden</div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 text-xs text-neutral-500 leading-relaxed max-w-2xl">
        Kaynak: fawazahmed0/currency-api (CDN, ücretsiz). Kurlar günde birkaç kez otomatik güncellenir; anlık olması gerekmiyorsa yeterli hassasiyettedir. XAU/XAG saf değerlerdir (24 ayar/999); işlenmiş takı fiyatlarını içermez.
      </div>
    </Layout>
  );
}
