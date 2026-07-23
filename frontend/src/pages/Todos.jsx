import { useEffect, useState } from "react";
import Layout from "@/components/Layout";
import { PageHeader } from "@/components/Bits";
import { api, fmtDate, formatApiError } from "@/lib/apiClient";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Plus, Trash, PencilSimple } from "@phosphor-icons/react";

const empty = { title: "", description: "", due_date: "", priority: "medium", completed: false };

const PRIORITY_LABEL = { low: "Düşük", medium: "Orta", high: "Yüksek" };
const PRIORITY_PILL = { low: "", medium: "pill-warn", high: "pill-neg" };

export default function Todos() {
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(empty);

  const load = async () => setItems((await api.get("/todos")).data);
  useEffect(() => { load(); }, []);

  const save = async () => {
    try {
      const payload = { ...form, due_date: form.due_date || null };
      if (editing) await api.put(`/todos/${editing.id}`, payload);
      else await api.post("/todos", payload);
      setOpen(false); await load();
      toast.success("Kaydedildi");
    } catch (e) { toast.error(formatApiError(e)); }
  };

  const remove = async (id) => {
    if (!window.confirm("Silinsin mi?")) return;
    await api.delete(`/todos/${id}`); await load();
  };

  const toggle = async (it) => {
    await api.put(`/todos/${it.id}`, { ...it, completed: !it.completed });
    await load();
  };

  const remaining = items.filter(i => !i.completed).length;

  return (
    <Layout>
      <PageHeader
        subtitle="Yapılacaklar"
        title="Görev Listesi"
        testid="todos-header"
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <button className="btn-primary inline-flex items-center gap-2 h-10" onClick={() => { setEditing(null); setForm(empty); setOpen(true); }} data-testid="add-todo-button">
                <Plus size={16} weight="bold" /> Yeni Görev
              </button>
            </DialogTrigger>
            <DialogContent className="bg-white">
              <DialogHeader><DialogTitle className="h-display text-2xl">{editing ? "Görevi Düzenle" : "Yeni Görev"}</DialogTitle></DialogHeader>
              <div className="space-y-4 py-2">
                <div><Label className="label-mini">Başlık</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} data-testid="todo-title" className="mt-1.5 rounded-sm" /></div>
                <div><Label className="label-mini">Açıklama</Label><Textarea value={form.description || ""} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} data-testid="todo-description" className="mt-1.5 rounded-sm" /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label className="label-mini">Bitiş Tarihi</Label><Input type="date" value={form.due_date || ""} onChange={(e) => setForm({ ...form, due_date: e.target.value })} data-testid="todo-due" className="mt-1.5 rounded-sm" /></div>
                  <div>
                    <Label className="label-mini">Öncelik</Label>
                    <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v })}>
                      <SelectTrigger className="mt-1.5 rounded-sm bg-white" data-testid="todo-priority"><SelectValue /></SelectTrigger>
                      <SelectContent className="bg-white">
                        <SelectItem value="low">Düşük</SelectItem>
                        <SelectItem value="medium">Orta</SelectItem>
                        <SelectItem value="high">Yüksek</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
              <DialogFooter><button onClick={save} className="btn-primary h-10 px-6" data-testid="todo-save">Kaydet</button></DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="card-flat p-6 mb-6">
        <div className="label-mini">Bekleyen Görev</div>
        <div className="stat-value text-3xl mt-2" data-testid="todos-remaining">{remaining}</div>
      </div>

      <div className="card-flat divide-y divide-[#F0F0F0]" data-testid="todos-list">
        {items.length === 0 && <div className="p-10 text-center text-neutral-500">Henüz görev eklemediniz.</div>}
        {items.map((it) => (
          <div key={it.id} className="flex items-start gap-3 p-5 table-row" data-testid={`todo-row-${it.id}`}>
            <Checkbox checked={!!it.completed} onCheckedChange={() => toggle(it)} data-testid={`todo-check-${it.id}`} className="mt-1" />
            <div className="flex-1 min-w-0">
              <div className={`font-semibold ${it.completed ? "line-through text-neutral-400" : ""}`}>{it.title}</div>
              {it.description && <div className="text-sm text-neutral-600 mt-0.5">{it.description}</div>}
              <div className="flex items-center gap-2 mt-2">
                <span className={`pill ${PRIORITY_PILL[it.priority]}`}>{PRIORITY_LABEL[it.priority] || "Orta"}</span>
                {it.due_date && <span className="pill">{fmtDate(it.due_date)}</span>}
              </div>
            </div>
            <div className="flex gap-1">
              <button onClick={() => { setEditing(it); setForm({ ...empty, ...it, due_date: it.due_date || "" }); setOpen(true); }} className="p-2 hover:bg-neutral-100 rounded-sm" data-testid={`edit-todo-${it.id}`}><PencilSimple size={16} /></button>
              <button onClick={() => remove(it.id)} className="p-2 hover:bg-neutral-100 rounded-sm text-[#D32F2F]" data-testid={`delete-todo-${it.id}`}><Trash size={16} /></button>
            </div>
          </div>
        ))}
      </div>
    </Layout>
  );
}
