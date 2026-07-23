import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API_BASE = `${BACKEND_URL}/api`;

// Auth is primarily handled via httpOnly cookies (secure, samesite=none).
// A short-lived in-memory token is kept as a fallback for the current tab session
// only — it is NOT persisted to localStorage/sessionStorage (XSS surface).
export const api = axios.create({
  baseURL: API_BASE,
  withCredentials: true,
});

export const setAuthToken = (token) => {
  if (token) {
    api.defaults.headers.common["Authorization"] = `Bearer ${token}`;
  } else {
    delete api.defaults.headers.common["Authorization"];
  }
};

export const formatApiError = (err) => {
  const d = err?.response?.data?.detail;
  if (d == null) return err?.message || "Bir hata oluştu";
  if (typeof d === "string") return d;
  if (Array.isArray(d)) return d.map((e) => e?.msg || JSON.stringify(e)).join(" · ");
  if (typeof d?.msg === "string") return d.msg;
  return String(d);
};

export const fmtTRY = (n) =>
  new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY", maximumFractionDigits: 2 })
    .format(Number(n || 0));

export const fmtDate = (iso) => {
  if (!iso) return "-";
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("tr-TR", { day: "2-digit", month: "2-digit", year: "numeric" });
  } catch { return iso; }
};

export const todayISO = () => new Date().toISOString().slice(0, 10);
