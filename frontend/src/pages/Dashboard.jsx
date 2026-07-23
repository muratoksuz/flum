import { useEffect, useState } from "react";
import Layout from "@/components/Layout";
import { PageHeader, StatCard } from "@/components/Bits";
import { api, fmtTRY, fmtDate } from "@/lib/apiClient";
import {
  BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid,
  PieChart, Pie, Cell, Legend,
} from "recharts";
import { ArrowUpRight, ArrowDownRight, Bank, CreditCard, TrendUp } from "@phosphor-icons/react";
import { Link } from "react-router-dom";
import RatesTicker from "@/components/RatesTicker";

const PIE_COLORS = ["#0A0A0A", "#008A5E", "#D32F2F", "#B45309", "#525252", "#737373", "#A3A3A3"];

export default function Dashboard() {
  const [summary, setSummary] = useState(null);
  const [upcoming, setUpcoming] = useState([]);
  const [monthly, setMonthly] = useState([]);
  const [byCat, setByCat] = useState([]);

  useEffect(() => {
    (async () => {
      const [s, u, m, c] = await Promise.all([
        api.get("/dashboard/summary"),
        api.get("/dashboard/upcoming", { params: { days: 30 } }),
        api.get("/analytics/monthly", { params: { months: 6 } }),
        api.get("/analytics/by-category", { params: { kind: "expense" } }),
      ]);
      setSummary(s.data); setUpcoming(u.data); setMonthly(m.data); setByCat(c.data);
    })();
  }, []);

  return (
    <Layout>
      <PageHeader
        subtitle="Yönetim Paneli"
        title="Nakit Akışına Genel Bakış"
        testid="dashboard-header"
      />

      <RatesTicker />

      {/* Stats grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard
          testid="stat-net-position"
          label="Net Pozisyon"
          value={fmtTRY(summary?.net_position || 0)}
          tone={summary && summary.net_position >= 0 ? "pos" : "neg"}
          hint="Banka + Alacak − Gider − Kart Borcu"
        />
        <StatCard
          testid="stat-total-receivables"
          label="Bekleyen Alacak"
          value={fmtTRY(summary?.total_receivable_pending || 0)}
          tone="pos"
        />
        <StatCard
          testid="stat-total-expenses"
          label="Bekleyen Gider"
          value={fmtTRY(summary?.total_expense_pending || 0)}
          tone="neg"
        />
        <StatCard
          testid="stat-bank-balance"
          label="Toplam Banka Bakiyesi"
          value={fmtTRY(summary?.total_bank_balance || 0)}
          hint={`Kart borcu: ${fmtTRY(summary?.total_card_debt || 0)}`}
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-8">
        <div className="card-flat p-6 lg:col-span-2" data-testid="chart-monthly">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="label-mini">Aylık Karşılaştırma</div>
              <div className="h-display text-xl font-bold mt-1">Alacak vs Gider — Son 6 Ay</div>
            </div>
            <TrendUp size={20} />
          </div>
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthly} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E5E5" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#525252" }} />
                <YAxis tick={{ fontSize: 11, fill: "#525252" }} />
                <Tooltip
                  formatter={(v) => fmtTRY(v)}
                  contentStyle={{ background: "#fff", border: "1px solid #D4D4D4", borderRadius: 3 }}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="receivable" name="Alacak" fill="#008A5E" radius={[2, 2, 0, 0]} />
                <Bar dataKey="expense" name="Gider" fill="#D32F2F" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card-flat p-6" data-testid="chart-by-category">
          <div className="label-mini">Kategori Dağılımı</div>
          <div className="h-display text-xl font-bold mt-1 mb-4">Giderler</div>
          {byCat.length === 0 ? (
            <div className="text-sm text-neutral-500 py-16 text-center">Henüz veri yok</div>
          ) : (
            <div className="h-[240px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={byCat} dataKey="amount" nameKey="category" innerRadius={50} outerRadius={80} paddingAngle={2}>
                    {byCat.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v) => fmtTRY(v)} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      {/* Upcoming */}
      <div className="card-flat p-6" data-testid="upcoming-widget">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="label-mini">Yaklaşan 30 Gün</div>
            <div className="h-display text-xl font-bold mt-1">Yaklaşan Ödemeler</div>
          </div>
          <Link to="/yaklasan" className="text-xs font-semibold hover:underline" data-testid="see-all-upcoming">
            Tümünü Gör →
          </Link>
        </div>
        {upcoming.length === 0 ? (
          <div className="text-sm text-neutral-500 py-6">Yaklaşan ödeme bulunmuyor.</div>
        ) : (
          <div className="divide-y divide-[#EFEFEF]">
            {upcoming.slice(0, 6).map((it) => {
              const overdue = it.days_left < 0;
              const soon = it.days_left <= 3 && !overdue;
              return (
                <div key={`${it.type}-${it.id}`} className="flex items-center justify-between py-3 table-row px-2 -mx-2 rounded-sm">
                  <div className="flex items-center gap-3">
                    <div className={`h-9 w-9 flex items-center justify-center rounded-sm ${it.type === "receivable" ? "bg-[#E6F5EF] text-[#008A5E]" : it.type === "expense" ? "bg-[#FDECEC] text-[#D32F2F]" : "bg-neutral-100 text-neutral-800"}`}>
                      {it.type === "receivable" ? <ArrowUpRight size={16} weight="bold" /> : it.type === "expense" ? <ArrowDownRight size={16} weight="bold" /> : <CreditCard size={16} weight="bold" />}
                    </div>
                    <div>
                      <div className="text-sm font-semibold">{it.title}</div>
                      <div className="text-xs text-neutral-500">{it.category || "Kategorisiz"} · {fmtDate(it.due_date)}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`pill ${overdue ? "pill-neg" : soon ? "pill-warn" : ""}`}>
                      {overdue ? `${Math.abs(it.days_left)} gün geçti` : it.days_left === 0 ? "Bugün" : `${it.days_left} gün`}
                    </span>
                    <div className={`num font-semibold ${it.type === "receivable" ? "text-[#008A5E]" : "text-[#D32F2F]"}`}>
                      {it.type === "receivable" ? "+" : "−"} {fmtTRY(it.amount)}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Layout>
  );
}
