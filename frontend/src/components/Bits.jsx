import { Toaster as SonnerToaster } from "@/components/ui/sonner";

export const PageHeader = ({ title, subtitle, actions, testid }) => (
  <div className="flex items-start justify-between gap-4 mb-8" data-testid={testid}>
    <div>
      <div className="label-mini mb-2">{subtitle}</div>
      <h1 className="h-display text-3xl sm:text-4xl font-black tracking-tighter">{title}</h1>
    </div>
    <div className="flex items-center gap-2">{actions}</div>
  </div>
);

export const StatCard = ({ label, value, tone, testid, hint }) => {
  const toneColor =
    tone === "pos" ? "text-[#008A5E]" :
    tone === "neg" ? "text-[#D32F2F]" :
    tone === "warn" ? "text-[#B45309]" :
    "text-neutral-900";
  return (
    <div className="card-flat p-6" data-testid={testid}>
      <div className="label-mini mb-3">{label}</div>
      <div className={`stat-value text-3xl ${toneColor}`}>{value}</div>
      {hint && <div className="text-xs text-neutral-500 mt-2">{hint}</div>}
    </div>
  );
};

export const AppToaster = () => (
  <SonnerToaster position="top-right" richColors closeButton />
);
