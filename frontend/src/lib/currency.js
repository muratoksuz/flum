// Currency helpers for Nakit

export const CURRENCIES = [
  { code: "TRY", label: "Türk Lirası (₺)", symbol: "₺", unit: "" },
  { code: "USD", label: "ABD Doları ($)", symbol: "$", unit: "" },
  { code: "EUR", label: "Euro (€)", symbol: "€", unit: "" },
  { code: "XAU", label: "Altın (gram)", symbol: "gr", unit: "Au" },
  { code: "XAG", label: "Gümüş (gram)", symbol: "gr", unit: "Ag" },
];

export const CURRENCY_MAP = Object.fromEntries(CURRENCIES.map((c) => [c.code, c]));

export const formatAmount = (amount, code = "TRY") => {
  const n = Number(amount || 0);
  if (code === "TRY") {
    return new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY", maximumFractionDigits: 2 }).format(n);
  }
  if (code === "USD") return new Intl.NumberFormat("tr-TR", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(n);
  if (code === "EUR") return new Intl.NumberFormat("tr-TR", { style: "currency", currency: "EUR", maximumFractionDigits: 2 }).format(n);
  const g = new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 3 }).format(n);
  if (code === "XAU") return `${g} gr Au`;
  if (code === "XAG") return `${g} gr Ag`;
  return `${g} ${code}`;
};
