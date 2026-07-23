import { createContext, useContext, useEffect, useState } from "react";

const ThemeContext = createContext(null);

const applyTheme = (mode) => {
  const root = document.documentElement;
  if (mode === "dark") root.classList.add("dark");
  else root.classList.remove("dark");
};

export const ThemeProvider = ({ children }) => {
  const [theme, setThemeState] = useState(() => {
    if (typeof window === "undefined") return "light";
    return localStorage.getItem("nakit_theme") || "light";
  });

  useEffect(() => { applyTheme(theme); }, [theme]);

  const setTheme = (mode) => {
    setThemeState(mode);
    localStorage.setItem("nakit_theme", mode);
  };

  const toggle = () => setTheme(theme === "dark" ? "light" : "dark");

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggle }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
