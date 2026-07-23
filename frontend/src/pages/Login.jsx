import { useState } from "react";
import { Navigate, Link } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Wallet } from "@phosphor-icons/react";

export default function Login() {
  const { user, login, error } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  if (user) return <Navigate to="/" replace />;
  if (user === undefined) return null;

  const onSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    await login(email, password);
    setLoading(false);
  };

  return (
    <div className="min-h-screen grid grid-cols-1 lg:grid-cols-2" data-testid="login-page">
      {/* Left visual */}
      <div className="hidden lg:block relative overflow-hidden bg-neutral-950">
        <img
          src="https://images.pexels.com/photos/34764468/pexels-photo-34764468.jpeg"
          alt=""
          className="absolute inset-0 h-full w-full object-cover opacity-80"
        />
        <div className="absolute inset-0 bg-black/40" />
        <div className="relative h-full flex flex-col justify-between p-12 text-white">
          <div className="flex items-center gap-3 h-display">
            <div className="h-10 w-10 bg-white text-black flex items-center justify-center rounded-sm">
              <Wallet size={22} weight="bold" />
            </div>
            <div>
              <div className="text-2xl font-black tracking-tight leading-none">NAKİT</div>
              <div className="text-[10px] uppercase tracking-[0.28em] mt-1 opacity-80">Akış Yönetimi</div>
            </div>
          </div>
          <div className="max-w-md">
            <div className="label-mini text-white/70 mb-3">Kişisel Finans Kontrolü</div>
            <h1 className="h-display text-5xl font-black leading-[0.95] tracking-tighter">
              Alacaklarınızı, giderlerinizi ve ödemelerinizi tek panelde takip edin.
            </h1>
            <p className="mt-6 text-sm text-white/70 max-w-sm leading-relaxed">
              Nakit akışınızı disiplinli ve güvenli bir şekilde yönetin. Sadece siz erişebilirsiniz.
            </p>
          </div>
        </div>
      </div>

      {/* Right form */}
      <div className="flex items-center justify-center p-8 lg:p-12 bg-[#F8F9FA]">
        <div className="w-full max-w-sm">
          <div className="label-mini mb-3">Hesabınıza Giriş</div>
          <h2 className="h-display text-3xl font-black tracking-tighter mb-8">
            Tekrar hoş geldiniz.
          </h2>

          <form onSubmit={onSubmit} className="space-y-5" data-testid="login-form">
            <div>
              <Label className="label-mini block mb-2">E-posta</Label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                data-testid="login-email-input"
                placeholder="ornek@nakit.app"
                className="h-11 rounded-sm"
              />
            </div>
            <div>
              <Label className="label-mini block mb-2">Şifre</Label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                data-testid="login-password-input"
                placeholder="••••••••"
                className="h-11 rounded-sm"
              />
            </div>

            {error && (
              <div
                data-testid="login-error"
                className="text-sm text-[#D32F2F] bg-[#FCE8E8] border border-[#F5B5B5] rounded-sm px-3 py-2"
              >
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              data-testid="login-submit-button"
              className="btn-primary w-full h-11 disabled:opacity-60"
            >
              {loading ? "Giriş yapılıyor..." : "Giriş Yap"}
            </button>
          </form>

          <div className="mt-6 text-sm text-neutral-600">
            Hesabınız yok mu?{" "}
            <Link to="/register" className="font-semibold text-black hover:underline" data-testid="link-register">
              Kayıt olun
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
