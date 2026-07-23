import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import {
  ChartLineUp, HandCoins, Receipt, Bank, CreditCard,
  Calendar, CheckSquare, SignOut, Wallet,
} from "@phosphor-icons/react";

const nav = [
  { to: "/", label: "Özet", icon: ChartLineUp, testid: "nav-dashboard" },
  { to: "/alacaklar", label: "Alacaklar", icon: HandCoins, testid: "nav-receivables" },
  { to: "/giderler", label: "Giderler", icon: Receipt, testid: "nav-expenses" },
  { to: "/hesaplar", label: "Banka Hesapları", icon: Bank, testid: "nav-banks" },
  { to: "/kartlar", label: "Kredi Kartları", icon: CreditCard, testid: "nav-cards" },
  { to: "/yaklasan", label: "Yaklaşan Ödemeler", icon: Calendar, testid: "nav-upcoming" },
  { to: "/yapilacaklar", label: "Yapılacaklar", icon: CheckSquare, testid: "nav-todos" },
];

export default function Layout({ children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  return (
    <div className="min-h-screen flex bg-[#F8F9FA]" data-testid="app-shell">
      {/* Sidebar */}
      <aside className="w-64 border-r border-[#D4D4D4] bg-white flex flex-col" data-testid="sidebar">
        <div className="px-6 py-6 border-b border-[#E5E5E5] flex items-center gap-2.5">
          <div className="h-9 w-9 bg-black flex items-center justify-center rounded-sm">
            <Wallet size={20} color="#fff" weight="bold" />
          </div>
          <div className="h-display">
            <div className="text-lg font-black leading-none tracking-tight">NAKİT</div>
            <div className="text-[10px] uppercase tracking-[0.28em] text-neutral-500 mt-1">Akış Yönetimi</div>
          </div>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-0.5">
          {nav.map((it) => (
            <NavLink
              key={it.to}
              to={it.to}
              end={it.to === "/"}
              data-testid={it.testid}
              className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}
            >
              <it.icon size={18} weight="duotone" />
              <span className="text-sm">{it.label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-[#E5E5E5] p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-sm font-semibold truncate" data-testid="current-user-name">{user?.name || "Kullanıcı"}</div>
              <div className="text-xs text-neutral-500 truncate">{user?.email}</div>
            </div>
            <button
              onClick={handleLogout}
              data-testid="logout-button"
              className="p-2 rounded-sm hover:bg-neutral-100 transition-colors"
              aria-label="Çıkış Yap"
            >
              <SignOut size={18} weight="bold" />
            </button>
          </div>
        </div>
      </aside>

      <main className="flex-1 overflow-auto">
        <div className="max-w-[1400px] mx-auto px-8 py-8 fade-in">
          {children}
        </div>
      </main>
    </div>
  );
}
