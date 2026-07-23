import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { api, setAuthToken, formatApiError } from "@/lib/apiClient";

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(undefined); // undefined=loading, null=guest, obj=user
  const [error, setError] = useState("");

  const refreshMe = useCallback(async () => {
    try {
      const { data } = await api.get("/auth/me");
      setUser(data);
    } catch (err) {
      if (err?.response?.status && err.response.status !== 401) {
        console.warn("Auth me check failed:", err.message);
      }
      setUser(null);
    }
  }, []);

  useEffect(() => { refreshMe(); }, [refreshMe]);

  const login = async (email, password) => {
    setError("");
    try {
      const { data } = await api.post("/auth/login", { email, password });
      if (data.token) setAuthToken(data.token);
      setUser(data);
      return true;
    } catch (e) {
      setError(formatApiError(e));
      return false;
    }
  };

  const register = async (name, email, password) => {
    setError("");
    try {
      const { data } = await api.post("/auth/register", { name, email, password });
      if (data.token) setAuthToken(data.token);
      setUser(data);
      return true;
    } catch (e) {
      setError(formatApiError(e));
      return false;
    }
  };

  const logout = async () => {
    try {
      await api.post("/auth/logout");
    } catch (err) {
      console.warn("Logout request failed:", err?.message || err);
    }
    setAuthToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, error, login, register, logout, refreshMe, setError }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
