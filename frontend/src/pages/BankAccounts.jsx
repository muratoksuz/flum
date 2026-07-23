import { useEffect, useState } from "react";
import Layout from "@/components/Layout";
import { PageHeader } from "@/components/Bits";
import { api, fmtTRY, formatApiError } from "@/lib/apiClient";
import { CURRENCIES, formatAmount } from "@/lib/currency";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, PencilSimple, Trash, Bank } from "@phosphor-icons/react";

const empty = { bank_name: "", account_name: "", iban: "", balance: 0, currency: "TRY" };

export default function BankAccounts() {
  const [items, setItems] = useState([]);
  const [rates, setRates] = useState({ TRY: 1 });
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(empty);

  const load = async () => setItems((await api.get("/bank-accounts")).data);
  useEffect(() => {
    load();
    api.get("/rates").then(({ data }) => setRates(data.rates_to_try || { TRY: 1 })).catch(() => {});
  }, []);

  const save = async () => {
    try {
      const payload = { ...form, balance: Number(form.balance) };
      if (editing) await api.put(`/bank-accounts/${editing.id}`, payload);
      else await api.post("/bank-accounts", payload);
      setOpen(false); await load();
      toast.success("Kaydedildi");
    } catch (e) { toast.error(formatApiError(e)); }
  };

  const remove = async (id) => {
    if (!window.confirm("Silinsin mi?")) return;
    await api.delete(`/bank-accounts/${id}`); await load();
  };

  const total = items.reduce((s, i) => {
    const r = rates[i.currency || "TRY"];
    return s + (r ? Number(i.balance || 0) * Number(r) : 0);
  }, 0);

  return (
    <Layout>
      <PageHeader
        subtitle="Banka Hesapları"
        title="Hesaplarınız"
        testid="banks-header"
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <button className="btn-primary inline-flex items-center gap-2 h-10" onClick={() => { setEditing(null); setForm(empty); setOpen(true); }} data-testid="add-bank-button">
                <Plus size={16} weight="bold" /> Yeni Hesap
              </button>
            </DialogTrigger>
            <DialogContent className="bg-white">
              <DialogHeader><DialogTitle className="h-display text-2xl">{editing ? "Hesabı Düzenle" : "Yeni Banka Hesabı"}</DialogTitle></DialogHeader>
              <div className="space-y-4 py-2">
                <div><Label className="label-mini">Banka</Label><Input value={form.bank_name} onChange={(e) => setForm({ ...form, bank_name: e.target.value })} data-testid="bank-name" className="mt-1.5 rounded-sm" /></div>
                <div><Label className="label-mini">Hesap Adı</Label><Input value={form.account_name} onChange={(e) => setForm({ ...form, account_name: e.target.value })} data-testid="bank-account-name" className="mt-1.5 rounded-sm" /></div>
                <div><Label className="label-mini">IBAN</Label><Input value={form.iban || ""} onChange={(e) => setForm({ ...form, iban: e.target.value })} data-testid="bank-iban" className="mt-1.5 rounded-sm" /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label className="label-mini">Bakiye</Label><Input type="number" step="0.01" value={form.balance} onChange={(e) => setForm({ ...form, balance: e.target.value })} data-testid="bank-balance" className="mt-1.5 rounded-sm" /></div>
                  <div>
                    <Label className="label-mini">Para Birimi</Label>
                    <Select value={form.currency} onValueChange={(v) => setForm({ ...form, currency: v })}>
                      <SelectTrigger className="mt-1.5 rounded-sm bg-white" data-testid="bank-currency"><SelectValue /></SelectTrigger>
                      <SelectContent className="bg-white">
                        {CURRENCIES.map((c) => <SelectItem key={c.code} value={c.code}>{c.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
              <DialogFooter><button onClick={save} className="btn-primary h-10 px-6" data-testid="bank-save">Kaydet</button></DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="card-flat p-6 mb-6">
        <div className="label-mini">Toplam Bakiye (₺ karşılığı)</div>
        <div className="stat-value text-3xl mt-2" data-testid="banks-total">{fmtTRY(total)}</div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" data-testid="banks-list">
        {items.length === 0 && <div className="text-sm text-neutral-500 col-span-full">Henüz banka hesabı eklemediniz.</div>}
        {items.map((it) => (
          <div key={it.id} className="card-flat p-5 hover:-translate-y-0.5 transition-transform duration-200" data-testid={`bank-card-${it.id}`}>
            <div className="flex items-start justify-between">
              <div className="h-9 w-9 bg-neutral-900 text-white flex items-center justify-center rounded-sm"><Bank size={18} weight="bold" /></div>
              <div className="flex gap-1">
                <button onClick={() => { setEditing(it); setForm(it); setOpen(true); }} className="p-2 hover:bg-neutral-100 rounded-sm" data-testid={`edit-bank-${it.id}`}><PencilSimple size={16} /></button>
                <button onClick={() => remove(it.id)} className="p-2 hover:bg-neutral-100 rounded-sm text-[#D32F2F]" data-testid={`delete-bank-${it.id}`}><Trash size={16} /></button>
              </div>
            </div>
            <div className="mt-4">
              <div className="label-mini">{it.bank_name}</div>
              <div className="h-display text-lg font-bold mt-1">{it.account_name}</div>
              <div className="text-xs text-neutral-500 num mt-1">{it.iban || "IBAN yok"}</div>
            </div>
            <div className="mt-4 pt-4 border-t border-[#EFEFEF]">
              <div className="stat-value text-2xl">{formatAmount(it.balance, it.currency || "TRY")}</div>
              <div className="text-xs text-neutral-500 mt-1">{it.currency}</div>
            </div>
          </div>
        ))}
      </div>
    </Layout>
  );
}
