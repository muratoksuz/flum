import { useRef, useState } from "react";
import Layout from "@/components/Layout";
import { PageHeader } from "@/components/Bits";
import { api, API_BASE, formatApiError } from "@/lib/apiClient";
import { useTheme } from "@/context/ThemeContext";
import { toast } from "sonner";
import {
  Sun, Moon, FilePdf, DownloadSimple, UploadSimple, Warning,
} from "@phosphor-icons/react";

export default function Settings() {
  const { theme, setTheme } = useTheme();
  const [downloading, setDownloading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [replace, setReplace] = useState(false);
  const fileRef = useRef(null);

  const downloadPdf = async () => {
    setDownloading(true);
    try {
      const { data } = await api.get("/reports/pdf", { responseType: "blob" });
      const url = URL.createObjectURL(new Blob([data], { type: "application/pdf" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = `nakit-rapor-${new Date().toISOString().slice(0, 10)}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("PDF rapor indirildi");
    } catch (e) { toast.error(formatApiError(e)); }
    finally { setDownloading(false); }
  };

  const downloadBackup = async () => {
    try {
      const { data } = await api.get("/backup/export");
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `nakit-yedek-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Yedek indirildi");
    } catch (e) { toast.error(formatApiError(e)); }
  };

  const onImportFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const payload = { version: parsed.version || 1, data: parsed.data || {}, replace };
      const { data } = await api.post("/backup/import", payload);
      const total = Object.values(data.inserted || {}).reduce((s, n) => s + Number(n), 0);
      toast.success(`Yedek geri yüklendi (${total} kayıt)`);
    } catch (err) {
      toast.error(formatApiError(err) || "Yedek dosyası okunamadı");
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <Layout>
      <PageHeader subtitle="Ayarlar" title="Uygulama Ayarları" testid="settings-header" />

      {/* Theme */}
      <div className="card-flat p-6 mb-6" data-testid="theme-section">
        <div className="flex items-center justify-between gap-6">
          <div>
            <div className="label-mini">Görünüm</div>
            <div className="h-display text-xl font-bold mt-1">Tema Modu</div>
            <div className="text-sm text-neutral-600 mt-2 max-w-xl">
              Aydınlık veya karanlık tema arasında geçiş yapın. Tercihiniz bu tarayıcıda saklanır.
            </div>
          </div>
          <div className="flex items-center gap-1 border border-[#D4D4D4] rounded-full p-1 bg-white" data-testid="theme-switch">
            <button onClick={() => setTheme("light")} data-testid="theme-light-button"
                    className={`inline-flex items-center gap-1.5 px-4 h-9 rounded-full text-xs font-semibold transition-colors ${theme === "light" ? "bg-black text-white" : "text-neutral-700 hover:bg-neutral-100"}`}>
              <Sun size={14} weight="bold" /> Aydınlık
            </button>
            <button onClick={() => setTheme("dark")} data-testid="theme-dark-button"
                    className={`inline-flex items-center gap-1.5 px-4 h-9 rounded-full text-xs font-semibold transition-colors ${theme === "dark" ? "bg-black text-white" : "text-neutral-700 hover:bg-neutral-100"}`}>
              <Moon size={14} weight="bold" /> Karanlık
            </button>
          </div>
        </div>
      </div>

      {/* PDF Report */}
      <div className="card-flat p-6 mb-6" data-testid="pdf-section">
        <div className="flex items-start justify-between gap-6">
          <div>
            <div className="label-mini">Rapor</div>
            <div className="h-display text-xl font-bold mt-1">PDF Nakit Akış Raporu</div>
            <div className="text-sm text-neutral-600 mt-2 max-w-xl">
              Tüm alacaklar, giderler, banka hesapları, kredi kartları, yaklaşan ödemeler, kurlar ve yapılacaklar tek bir PDF dosyasında derlenir.
            </div>
          </div>
          <FilePdf size={28} weight="duotone" className="text-neutral-400 shrink-0" />
        </div>
        <button onClick={downloadPdf} disabled={downloading}
                className="btn-primary inline-flex items-center gap-2 h-10 mt-6 disabled:opacity-50"
                data-testid="download-pdf-button">
          <DownloadSimple size={16} weight="bold" />
          {downloading ? "Hazırlanıyor..." : "PDF Raporu İndir"}
        </button>
      </div>

      {/* JSON Backup */}
      <div className="card-flat p-6" data-testid="backup-section">
        <div className="flex items-start justify-between gap-6 mb-4">
          <div>
            <div className="label-mini">Yedekleme</div>
            <div className="h-display text-xl font-bold mt-1">JSON Yedekleme</div>
            <div className="text-sm text-neutral-600 mt-2 max-w-xl">
              Tüm kayıtlarınızı JSON dosyası olarak dışa aktarın veya daha önce aldığınız yedeği geri yükleyin. Yedekleme yerel olarak indirilir; uygulama sunucusunda saklanmaz.
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="border border-[#E5E5E5] rounded-sm p-5">
            <div className="label-mini">Dışa Aktar</div>
            <div className="text-sm text-neutral-700 mt-2 mb-4">Mevcut kayıtlarınızı JSON olarak indirin.</div>
            <button onClick={downloadBackup}
                    className="inline-flex items-center gap-2 h-10 px-4 border border-[#D4D4D4] rounded-full text-sm font-semibold bg-white hover:bg-neutral-50 transition-colors"
                    data-testid="download-backup-button">
              <DownloadSimple size={16} weight="bold" /> Yedeği İndir
            </button>
          </div>

          <div className="border border-[#E5E5E5] rounded-sm p-5">
            <div className="label-mini">İçe Aktar</div>
            <div className="text-sm text-neutral-700 mt-2 mb-3">Bir JSON yedek dosyası seçin.</div>
            <label className="flex items-start gap-2 mb-4 cursor-pointer">
              <input type="checkbox" checked={replace} onChange={(e) => setReplace(e.target.checked)}
                     data-testid="import-replace-checkbox" className="mt-0.5" />
              <span className="text-xs text-neutral-600 leading-relaxed">
                <span className="font-semibold">Mevcut kayıtları sil ve tamamen değiştir.</span> İşaretlenmezse ekleme (append) yapılır.
              </span>
            </label>
            {replace && (
              <div className="pill pill-warn mb-3 text-xs" data-testid="import-warning">
                <Warning size={12} weight="bold" /> Bu işlem geri alınamaz
              </div>
            )}
            <input ref={fileRef} type="file" accept=".json,application/json"
                   onChange={onImportFile} className="hidden" data-testid="import-file-input" />
            <button onClick={() => fileRef.current?.click()} disabled={importing}
                    className="inline-flex items-center gap-2 h-10 px-4 border border-[#D4D4D4] rounded-full text-sm font-semibold bg-white hover:bg-neutral-50 transition-colors disabled:opacity-50"
                    data-testid="import-backup-button">
              <UploadSimple size={16} weight="bold" />
              {importing ? "Yükleniyor..." : "Yedek Dosyası Seç"}
            </button>
          </div>
        </div>
      </div>
    </Layout>
  );
}
