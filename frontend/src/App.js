import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { AppToaster } from "@/components/Bits";
import Login from "@/pages/Login";
import Register from "@/pages/Register";
import Dashboard from "@/pages/Dashboard";
import Receivables from "@/pages/Receivables";
import Expenses from "@/pages/Expenses";
import BankAccounts from "@/pages/BankAccounts";
import CreditCards from "@/pages/CreditCards";
import UpcomingPayments from "@/pages/UpcomingPayments";
import Todos from "@/pages/Todos";

const Protected = ({ children }) => {
  const { user } = useAuth();
  if (user === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8F9FA]" data-testid="auth-loading">
        <div className="text-sm text-neutral-500">Yükleniyor…</div>
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  return children;
};

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/" element={<Protected><Dashboard /></Protected>} />
      <Route path="/alacaklar" element={<Protected><Receivables /></Protected>} />
      <Route path="/giderler" element={<Protected><Expenses /></Protected>} />
      <Route path="/hesaplar" element={<Protected><BankAccounts /></Protected>} />
      <Route path="/kartlar" element={<Protected><CreditCards /></Protected>} />
      <Route path="/yaklasan" element={<Protected><UpcomingPayments /></Protected>} />
      <Route path="/yapilacaklar" element={<Protected><Todos /></Protected>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <div className="App">
      <BrowserRouter>
        <AuthProvider>
          <AppRoutes />
          <AppToaster />
        </AuthProvider>
      </BrowserRouter>
    </div>
  );
}

export default App;
