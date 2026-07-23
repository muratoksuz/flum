import { useEffect, useState } from "react";
import Layout from "@/components/Layout";
import { PageHeader } from "@/components/Bits";
import { api, fmtTRY, formatApiError } from "@/lib/apiClient";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { Plus, PencilSimple, Trash, CreditCard } from "@phosphor-icons/react";

const empty = { bank_name: "", card_name: "", last_four: "", credit_limit: 0, current_debt: 0, statement_day: 1, due_day: 10 };

export default function CreditCards() {
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(empty);

  const load = async () => setItems((await api.get("/credit-cards")).data);
  useEffect(() => { load(); }, []);

  const save = async () => {
    try {
      const payload = {
        ...form,
        credit_limit: Number(form.credit_limit),
        current_debt: Number(form.current_debt),
        statement_day: Number(form.statement_day),
        due_day: Number(form.due_day),
      };
      if (editing) await api.put(`/credit-cards/${editing.id}`, payload);
      else await api.post("/credit-cards", payload);
      setOpen(false); await load();
      toast.success("Kaydedildi");
    } catch (e) { toast.error(formatApiError(e)); }
  };

  const remove = async (id) => {
    if (!window.confirm("Silinsin mi?")) return;
    await api.delete(`/credit-cards/${id}`); await load();
  };

  const totalDebt = items.reduce((s, i) => s + Number(i.current_debt || 0), 0);
  const totalLimit = items.reduce((s, i) => s + Number(i.credit_limit || 0), 0);

  return (
    <Layout>
      <PageHeader
        subtitle="Kredi Kartları"
        title="Kartlarınız"
        testid="cards-header"
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <button className="btn-primary inline-flex items-center gap-2 h-10" onClick={() => { setEditing(null); setForm(empty); setOpen(true); }} data-testid="add-card-button">
                <Plus size={16} weight="bold" /> Yeni Kart
              </button>
            </DialogTrigger>
            <DialogContent className="bg-white">
              <DialogHeader><DialogTitle className="h-display text-2xl">{editing ? "Kartı Düzenle" : "Yeni Kredi Kartı"}</DialogTitle></DialogHeader>
              <div className="space-y-4 py-2">
                <div className="grid grid-cols-2 gap-3">
                  <div><Label className="label-mini">Banka</Label><Input value={form.bank_name} onChange={(e) => setForm({ ...form, bank_name: e.target.value })} data-testid="card-bank" className="mt-1.5 rounded-sm" /></div>
                  <div><Label className="label-mini">Kart Adı</Label><Input value={form.card_name} onChange={(e) => setForm({ ...form, card_name: e.target.value })} data-testid="card-name" className="mt-1.5 rounded-sm" /></div>
                </div>
                <div>
                  <Label className="label-mini">Son 4 Hane</Label>
                  <Input value={form.last_four || ""} maxLength={4} onChange={(e) => setForm({ ...form, last_four: e.target.value })} data-testid="card-last4" className="mt-1.5 rounded-sm" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label className="label-mini">Kredi Limiti</Label><Input type="number" step="0.01" value={form.credit_limit} onChange={(e) => setForm({ ...form, credit_limit: e.target.value })} data-testid="card-limit" className="mt-1.5 rounded-sm" /></div>
                  <div><Label className="label-mini">Güncel Borç</Label><Input type="number" step="0.01" value={form.current_debt} onChange={(e) => setForm({ ...form, current_debt: e.target.value })} data-testid="card-debt" className="mt-1.5 rounded-sm" /></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label className="label-mini">Ekstre Kesim (Gün)</Label><Input type="number" min="1" max="31" value={form.statement_day} onChange={(e) => setForm({ ...form, statement_day: e.target.value })} data-testid="card-statement" className="mt-1.5 rounded-sm" /></div>
                  <div><Label className="label-mini">Son Ödeme (Gün)</Label><Input type="number" min="1" max="31" value={form.due_day} onChange={(e) => setForm({ ...form, due_day: e.target.value })} data-testid="card-due" className="mt-1.5 rounded-sm" /></div>
                </div>
              </div>
              <DialogFooter><button onClick={save} className="btn-primary h-10 px-6" data-testid="card-save">Kaydet</button></DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="card-flat p-6"><div className="label-mini">Toplam Borç</div><div className="stat-value text-3xl text-[#D32F2F] mt-2" data-testid="cards-total-debt">{fmtTRY(totalDebt)}</div></div>
        <div className="card-flat p-6"><div className="label-mini">Toplam Limit</div><div className="stat-value text-3xl mt-2" data-testid="cards-total-limit">{fmtTRY(totalLimit)}</div></div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4" data-testid="cards-list">
        {items.length === 0 && <div className="text-sm text-neutral-500 col-span-full">Henüz kart eklemediniz.</div>}
        {items.map((it) => {
          const util = it.credit_limit > 0 ? Math.min(100, (it.current_debt / it.credit_limit) * 100) : 0;
          return (
            <div key={it.id} className="card-flat p-6 hover:-translate-y-0.5 transition-transform duration-200" data-testid={`card-item-${it.id}`}>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 bg-neutral-900 text-white flex items-center justify-center rounded-sm"><CreditCard size={20} weight="bold" /></div>
                  <div>
                    <div className="label-mini">{it.bank_name}</div>
                    <div className="h-display text-lg font-bold">{it.card_name}</div>
                  </div>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => { setEditing(it); setForm(it); setOpen(true); }} className="p-2 hover:bg-neutral-100 rounded-sm" data-testid={`edit-card-${it.id}`}><PencilSimple size={16} /></button>
                  <button onClick={() => remove(it.id)} className="p-2 hover:bg-neutral-100 rounded-sm text-[#D32F2F]" data-testid={`delete-card-${it.id}`}><Trash size={16} /></button>
                </div>
              </div>
              <div className="mt-4 num text-sm text-neutral-500">•••• {it.last_four || "----"}</div>
              <div className="mt-4 flex items-end justify-between">
                <div>
                  <div className="label-mini">Güncel Borç</div>
                  <div className="stat-value text-2xl text-[#D32F2F]">{fmtTRY(it.current_debt)}</div>
                </div>
                <div className="text-right">
                  <div className="label-mini">Limit</div>
                  <div className="num font-semibold">{fmtTRY(it.credit_limit)}</div>
                </div>
              </div>
              <Progress value={util} className="h-1.5 mt-3" />
              <div className="mt-3 flex justify-between text-xs text-neutral-500">
                <span>Ekstre: her ayın {it.statement_day}. günü</span>
                <span>Son ödeme: {it.due_day}. gün</span>
              </div>
            </div>
          );
        })}
      </div>
    </Layout>
  );
}
