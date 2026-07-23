import { useState } from "react";
import { Navigate, Link } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Wallet } from "@phosphor-icons/react";

export default function Register() {
  const { user, register, error } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  if (user) return <Navigate to="/" replace />;
  if (user === undefined) return null;

  const onSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    await register(name, email, password);
    setLoading(false);
  };

  return (
    <div className="min-h-screen grid grid-cols-1 lg:grid-cols-2" data-testid="register-page">
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
            <div className="label-mini text-white/70 mb-3">Yeni hesap</div>
            <h1 className="h-display text-5xl font-black leading-[0.95] tracking-tighter">
              Finansınızı disiplin altına almanın en hızlı yolu.
            </h1>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-center p-8 lg:p-12 bg-[#F8F9FA]">
        <div className="w-full max-w-sm">
          <div className="label-mini mb-3">Kayıt Ol</div>
          <h2 className="h-display text-3xl font-black tracking-tighter mb-8">Hesap oluşturun.</h2>

          <form onSubmit={onSubmit} className="space-y-5" data-testid="register-form">
            <div>
              <Label className="label-mini block mb-2">Ad Soyad</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} required
                     data-testid="register-name-input" className="h-11 rounded-sm" />
            </div>
            <div>
              <Label className="label-mini block mb-2">E-posta</Label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required
                     data-testid="register-email-input" className="h-11 rounded-sm" />
            </div>
            <div>
              <Label className="label-mini block mb-2">Şifre (en az 6 karakter)</Label>
              <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required
                     data-testid="register-password-input" className="h-11 rounded-sm" />
            </div>

            {error && (
              <div data-testid="register-error"
                   className="text-sm text-[#D32F2F] bg-[#FCE8E8] border border-[#F5B5B5] rounded-sm px-3 py-2">
                {error}
              </div>
            )}

            <button type="submit" disabled={loading}
                    data-testid="register-submit-button"
                    className="btn-primary w-full h-11 disabled:opacity-60">
              {loading ? "Kayıt yapılıyor..." : "Hesap Oluştur"}
            </button>
          </form>

          <div className="mt-6 text-sm text-neutral-600">
            Zaten hesabınız var mı?{" "}
            <Link to="/login" className="font-semibold text-black hover:underline" data-testid="link-login">
              Giriş yapın
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
