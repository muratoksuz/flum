import { useEffect, useState } from "react";
import Layout from "@/components/Layout";
import { PageHeader } from "@/components/Bits";
import { api, formatApiError } from "@/lib/apiClient";
import { toast } from "sonner";
import { Bell, CheckCircle, XCircle, PaperPlaneTilt, ArrowsClockwise } from "@phosphor-icons/react";
import { useAuth } from "@/context/AuthContext";

export default function Notifications() {
  const { user } = useAuth();
  const [status, setStatus] = useState(null);
  const [sending, setSending] = useState(false);
  const [running, setRunning] = useState(false);

  const load = async () => {
    try { setStatus((await api.get("/notifications/status")).data); }
    catch (e) { toast.error(formatApiError(e)); }
  };
  useEffect(() => { load(); }, []);

  const sendTest = async () => {
    setSending(true);
    try {
      const { data } = await api.post("/notifications/send-test");
      toast.success(`Test e-postası gönderildi (${data.count} kalem)`);
    } catch (e) { toast.error(formatApiError(e)); }
    finally { setSending(false); }
  };

  const runNow = async () => {
    setRunning(true);
    try {
      const { data } = await api.post("/notifications/run-now");
      if (data.skipped) toast.error("API key eksik — .env dosyasına RESEND_API_KEY ekleyin");
      else toast.success(`${data.sent}/${data.users} kullanıcıya gönderildi`);
    } catch (e) { toast.error(formatApiError(e)); }
    finally { setRunning(false); }
  };

  const enabled = !!status?.email_enabled;

  return (
    <Layout>
      <PageHeader subtitle="Bildirimler" title="E-posta Hatırlatıcıları" testid="notifications-header" />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <div className="card-flat p-6 lg:col-span-2">
          <div className="flex items-start gap-3">
            <div className={`h-11 w-11 flex items-center justify-center rounded-sm ${enabled ? "bg-[#E6F5EF] text-[#008A5E]" : "bg-neutral-100 text-neutral-500"}`}>
              {enabled ? <CheckCircle size={22} weight="bold" /> : <XCircle size={22} weight="bold" />}
            </div>
            <div>
              <div className="label-mini">Durum</div>
              <div className="h-display text-xl font-bold mt-1" data-testid="notif-status">
                {enabled ? "E-posta hatırlatıcıları aktif" : "E-posta hatırlatıcıları devre dışı"}
              </div>
              {!enabled && (
                <div className="text-sm text-neutral-600 mt-2 leading-relaxed">
                  E-posta göndermek için <code className="px-1.5 py-0.5 bg-neutral-100 rounded-sm text-xs">/app/backend/.env</code> dosyasındaki
                  {" "}<code className="px-1.5 py-0.5 bg-neutral-100 rounded-sm text-xs">RESEND_API_KEY</code>{" "}
                  değerini doldurun. Ücretsiz key: <a className="underline font-semibold" href="https://resend.com/api-keys" target="_blank" rel="noreferrer">resend.com/api-keys</a>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="card-flat p-6">
          <div className="label-mini">Gönderici</div>
          <div className="font-semibold mt-1 num text-sm" data-testid="notif-sender">{status?.sender_email || "-"}</div>
          <div className="label-mini mt-4">Alıcı</div>
          <div className="font-semibold mt-1 num text-sm">{user?.email}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div className="card-flat p-6">
          <div className="label-mini">Vade Uyarı Aralığı</div>
          <div className="stat-value text-3xl mt-2" data-testid="notif-days">{status?.reminder_days_before ?? 3} gün</div>
          <div className="text-xs text-neutral-500 mt-2">Vadeye bu kadar (veya daha az) gün kalan hareketler için e-posta gönderilir.</div>
        </div>
        <div className="card-flat p-6">
          <div className="label-mini">Günlük Kontrol Saati</div>
          <div className="stat-value text-3xl mt-2" data-testid="notif-hour">{String(status?.reminder_hour ?? 9).padStart(2, "0")}:00</div>
          <div className="text-xs text-neutral-500 mt-2">Europe/Istanbul zaman dilimi.</div>
        </div>
      </div>

      <div className="card-flat p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="label-mini">Manuel Kontrol</div>
            <div className="h-display text-xl font-bold mt-1">Şimdi Dene</div>
            <div className="text-sm text-neutral-600 mt-2 max-w-lg">
              Kendi hesabınıza bir test e-postası gönderin veya günlük hatırlatıcıyı manuel olarak çalıştırın.
            </div>
          </div>
          <Bell size={28} weight="duotone" className="text-neutral-400" />
        </div>
        <div className="flex flex-wrap gap-3 mt-6">
          <button onClick={sendTest} disabled={sending || !enabled}
                  className="btn-primary inline-flex items-center gap-2 h-10 disabled:opacity-50"
                  data-testid="send-test-email-button">
            <PaperPlaneTilt size={16} weight="bold" />
            {sending ? "Gönderiliyor..." : "Bana Test E-postası Gönder"}
          </button>
          <button onClick={runNow} disabled={running || !enabled}
                  className="inline-flex items-center gap-2 h-10 px-4 border border-[#D4D4D4] rounded-full text-sm font-semibold hover:bg-white transition-colors disabled:opacity-50"
                  data-testid="run-reminders-button">
            <ArrowsClockwise size={16} weight="bold" />
            {running ? "Çalıştırılıyor..." : "Günlük Hatırlatıcıyı Şimdi Çalıştır"}
          </button>
        </div>
      </div>
    </Layout>
  );
}
