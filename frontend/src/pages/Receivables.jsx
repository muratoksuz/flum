import { useEffect, useState } from "react";
import Layout from "@/components/Layout";
import { PageHeader } from "@/components/Bits";
import { api, fmtTRY, fmtDate, todayISO, API_BASE, formatApiError } from "@/lib/apiClient";
import { CURRENCIES, formatAmount } from "@/lib/currency";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, PencilSimple, Trash, DownloadSimple, Check } from "@phosphor-icons/react";

const emptyForm = { debtor: "", amount: "", due_date: todayISO(), category: "", note: "", status: "pending", currency: "TRY" };

const CATEGORIES = ["Müşteri", "Kira", "Fatura", "Hizmet", "Ürün Satışı", "Diğer"];

export default function Receivables() {
  const [items, setItems] = useState([]);
  const [rates, setRates] = useState({ TRY: 1 });
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);

  const load = async () => {
    const { data } = await api.get("/receivables");
    setItems(data);
  };
  useEffect(() => {
    load();
    api.get("/rates").then(({ data }) => setRates(data.rates_to_try || { TRY: 1 })).catch(() => {});
  }, []);

  const openNew = () => { setEditing(null); setForm(emptyForm); setOpen(true); };
  const openEdit = (it) => {
    setEditing(it);
    setForm({ ...it, amount: String(it.amount) });
    setOpen(true);
  };

  const save = async () => {
    try {
      const payload = { ...form, amount: Number(form.amount) };
      if (editing) await api.put(`/receivables/${editing.id}`, payload);
      else await api.post("/receivables", payload);
      setOpen(false);
      await load();
      toast.success(editing ? "Alacak güncellendi" : "Alacak eklendi");
    } catch (e) { toast.error(formatApiError(e)); }
  };

  const remove = async (id) => {
    if (!window.confirm("Silinsin mi?")) return;
    await api.delete(`/receivables/${id}`);
    await load();
    toast.success("Silindi");
  };

  const togglePaid = async (it) => {
    await api.put(`/receivables/${it.id}`, { ...it, status: it.status === "paid" ? "pending" : "paid" });
    await load();
  };

  const total = items
    .filter(i => i.status === "pending")
    .reduce((s, i) => {
      const r = rates[i.currency || "TRY"];
      return s + (r ? Number(i.amount || 0) * Number(r) : 0);
    }, 0);

  return (
    <Layout>
      <PageHeader
        subtitle="Alacaklar"
        title="Alacaklar Yönetimi"
        testid="receivables-header"
        actions={
          <>
            <a
              href={`${API_BASE}/export/receivables`}
              className="inline-flex items-center gap-2 h-10 px-3 border border-[#D4D4D4] rounded-sm text-sm font-semibold hover:bg-white transition-colors"
              data-testid="export-receivables"
            >
              <DownloadSimple size={16} weight="bold" /> CSV
            </a>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <button className="btn-primary inline-flex items-center gap-2 h-10" onClick={openNew} data-testid="add-receivable-button">
                  <Plus size={16} weight="bold" /> Yeni Alacak
                </button>
              </DialogTrigger>
              <DialogContent className="bg-white" data-testid="receivable-dialog">
                <DialogHeader><DialogTitle className="h-display text-2xl">{editing ? "Alacağı Düzenle" : "Yeni Alacak"}</DialogTitle></DialogHeader>
                <div className="space-y-4 py-2">
                  <div>
                    <Label className="label-mini">Borçlu</Label>
                    <Input value={form.debtor} onChange={(e) => setForm({ ...form, debtor: e.target.value })} data-testid="receivable-debtor" className="mt-1.5 rounded-sm" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="label-mini">Tutar</Label>
                      <Input type="number" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} data-testid="receivable-amount" className="mt-1.5 rounded-sm" />
                    </div>
                    <div>
                      <Label className="label-mini">Para Birimi</Label>
                      <Select value={form.currency} onValueChange={(v) => setForm({ ...form, currency: v })}>
                        <SelectTrigger className="mt-1.5 rounded-sm bg-white" data-testid="receivable-currency"><SelectValue /></SelectTrigger>
                        <SelectContent className="bg-white">
                          {CURRENCIES.map((c) => <SelectItem key={c.code} value={c.code}>{c.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div>
                    <Label className="label-mini">Vade Tarihi</Label>
                    <Input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} data-testid="receivable-due" className="mt-1.5 rounded-sm" />
                  </div>
                  <div>
                    <Label className="label-mini">Kategori</Label>
                    <Select value={form.category || ""} onValueChange={(v) => setForm({ ...form, category: v })}>
                      <SelectTrigger className="mt-1.5 rounded-sm bg-white" data-testid="receivable-category"><SelectValue placeholder="Seçiniz" /></SelectTrigger>
                      <SelectContent className="bg-white">
                        {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="label-mini">Not</Label>
                    <Textarea value={form.note || ""} onChange={(e) => setForm({ ...form, note: e.target.value })} rows={2} data-testid="receivable-note" className="mt-1.5 rounded-sm" />
                  </div>
                </div>
                <DialogFooter>
                  <button onClick={save} className="btn-primary h-10 px-6" data-testid="receivable-save">Kaydet</button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </>
        }
      />

      <div className="card-flat p-6 mb-6">
        <div className="label-mini">Bekleyen Toplam</div>
        <div className="stat-value text-3xl text-[#008A5E] mt-2" data-testid="receivables-total">{fmtTRY(total)}</div>
      </div>

      <div className="card-flat overflow-hidden" data-testid="receivables-list">
        <table className="w-full text-sm">
          <thead className="bg-[#FAFAFA] border-b border-[#E5E5E5]">
            <tr className="text-left">
              <th className="px-4 py-3 label-mini">Borçlu</th>
              <th className="px-4 py-3 label-mini">Kategori</th>
              <th className="px-4 py-3 label-mini">Vade</th>
              <th className="px-4 py-3 label-mini text-right">Tutar</th>
              <th className="px-4 py-3 label-mini">Durum</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-10 text-center text-neutral-500">Henüz alacak kaydınız yok.</td></tr>
            )}
            {items.map((it) => (
              <tr key={it.id} className="border-b border-[#F0F0F0] table-row" data-testid={`receivable-row-${it.id}`}>
                <td className="px-4 py-3 font-medium">{it.debtor}</td>
                <td className="px-4 py-3 text-neutral-600">{it.category || "-"}</td>
                <td className="px-4 py-3 num">{fmtDate(it.due_date)}</td>
                <td className="px-4 py-3 text-right num font-semibold" data-testid={`receivable-amount-${it.id}`}>{formatAmount(it.amount, it.currency || "TRY")}</td>
                <td className="px-4 py-3">
                  <button onClick={() => togglePaid(it)} className={`pill ${it.status === "paid" ? "pill-pos" : ""}`} data-testid={`toggle-paid-${it.id}`}>
                    {it.status === "paid" ? <><Check size={12} weight="bold" /> Ödendi</> : "Bekliyor"}
                  </button>
                </td>
                <td className="px-4 py-3 text-right whitespace-nowrap">
                  <button onClick={() => openEdit(it)} className="p-2 hover:bg-neutral-100 rounded-sm" data-testid={`edit-receivable-${it.id}`} aria-label="Düzenle"><PencilSimple size={16} /></button>
                  <button onClick={() => remove(it.id)} className="p-2 hover:bg-neutral-100 rounded-sm text-[#D32F2F]" data-testid={`delete-receivable-${it.id}`} aria-label="Sil"><Trash size={16} /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Layout>
  );
}
