import { useEffect, useState } from "react";
import Layout from "@/components/Layout";
import { PageHeader } from "@/components/Bits";
import { api, fmtTRY, fmtDate } from "@/lib/apiClient";
import { ArrowUpRight, ArrowDownRight, CreditCard, WarningCircle } from "@phosphor-icons/react";

export default function UpcomingPayments() {
  const [items, setItems] = useState([]);
  const [days, setDays] = useState(30);

  useEffect(() => {
    (async () => {
      const { data } = await api.get("/dashboard/upcoming", { params: { days } });
      setItems(data);
    })();
  }, [days]);

  const totalIn = items.filter(i => i.type === "receivable").reduce((s, i) => s + i.amount, 0);
  const totalOut = items.filter(i => i.type !== "receivable").reduce((s, i) => s + i.amount, 0);

  return (
    <Layout>
      <PageHeader
        subtitle="Yaklaşan Ödemeler"
        title="Vadeye Yakın Hareketler"
        testid="upcoming-header"
        actions={
          <div className="flex items-center gap-1 border border-[#D4D4D4] rounded-sm p-0.5 bg-white" data-testid="days-filter">
            {[7, 30, 60].map((d) => (
              <button key={d} onClick={() => setDays(d)}
                      className={`px-3 h-8 text-xs font-semibold rounded-sm transition-colors ${days === d ? "bg-black text-white" : "hover:bg-neutral-100"}`}
                      data-testid={`days-${d}`}>
                {d} Gün
              </button>
            ))}
          </div>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="card-flat p-6"><div className="label-mini">Gelen</div><div className="stat-value text-3xl text-[#008A5E] mt-2" data-testid="upcoming-in">{fmtTRY(totalIn)}</div></div>
        <div className="card-flat p-6"><div className="label-mini">Giden</div><div className="stat-value text-3xl text-[#D32F2F] mt-2" data-testid="upcoming-out">{fmtTRY(totalOut)}</div></div>
        <div className="card-flat p-6"><div className="label-mini">Net Etki</div><div className={`stat-value text-3xl mt-2 ${totalIn - totalOut >= 0 ? "text-[#008A5E]" : "text-[#D32F2F]"}`} data-testid="upcoming-net">{fmtTRY(totalIn - totalOut)}</div></div>
      </div>

      <div className="card-flat" data-testid="upcoming-list">
        {items.length === 0 && <div className="p-10 text-center text-neutral-500">Bu dönemde yaklaşan ödeme yok.</div>}
        {items.map((it) => {
          const overdue = it.days_left < 0;
          const soon = it.days_left <= 3 && !overdue;
          return (
            <div key={`${it.type}-${it.id}`} className="flex items-center justify-between px-6 py-4 border-b border-[#F0F0F0] last:border-0 table-row" data-testid={`upcoming-item-${it.id}`}>
              <div className="flex items-center gap-4">
                <div className={`h-10 w-10 flex items-center justify-center rounded-sm ${it.type === "receivable" ? "bg-[#E6F5EF] text-[#008A5E]" : it.type === "expense" ? "bg-[#FDECEC] text-[#D32F2F]" : "bg-neutral-100 text-neutral-800"}`}>
                  {it.type === "receivable" ? <ArrowUpRight size={18} weight="bold" /> :
                   it.type === "expense"    ? <ArrowDownRight size={18} weight="bold" /> :
                                              <CreditCard size={18} weight="bold" />}
                </div>
                <div>
                  <div className="font-semibold">{it.title}</div>
                  <div className="text-xs text-neutral-500">{it.category || "Kategorisiz"} · {fmtDate(it.due_date)}</div>
                </div>
              </div>
              <div className="flex items-center gap-4">
                {overdue && <span className="pill pill-neg"><WarningCircle size={12} weight="bold" /> Gecikmiş {Math.abs(it.days_left)}g</span>}
                {soon && <span className="pill pill-warn">Yaklaşıyor · {it.days_left}g</span>}
                {!overdue && !soon && <span className="pill">{it.days_left === 0 ? "Bugün" : `${it.days_left} gün`}</span>}
                <div className={`num font-semibold text-lg ${it.type === "receivable" ? "text-[#008A5E]" : "text-[#D32F2F]"}`}>
                  {it.type === "receivable" ? "+" : "−"} {fmtTRY(it.amount)}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </Layout>
  );
}
