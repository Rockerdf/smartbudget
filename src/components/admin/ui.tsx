// Shared building blocks for the admin screens.
import { useEffect, useState } from "react";
import type { ReactNode } from "react";

export function PageHeader({ title, sub, actions }: { title: string; sub?: string; actions?: ReactNode }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-6">
      <div className="min-w-0">
        <h1 className="text-xl font-bold text-[#0F172A]">{title}</h1>
        {sub && <p className="text-sm text-[#64748B] mt-1">{sub}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2 shrink-0">{actions}</div>}
    </div>
  );
}

export function Card({ title, sub, actions, children, className = "" }: {
  title?: string; sub?: string; actions?: ReactNode; children: ReactNode; className?: string;
}) {
  return (
    <section className={`bg-white rounded-2xl border border-[#E2E8F0] shadow-sm p-5 min-w-0 ${className}`}>
      {(title || actions) && (
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="min-w-0">
            {title && <h2 className="font-semibold text-[#0F172A]">{title}</h2>}
            {sub && <p className="text-xs text-[#94A3B8] mt-0.5">{sub}</p>}
          </div>
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}

export function Stat({ label, value, sub, tone = "default", onClick }: {
  label: string; value: ReactNode; sub?: ReactNode; tone?: "default" | "good" | "warn" | "bad" | "info"; onClick?: () => void;
}) {
  const color = { default: "text-[#0F172A]", good: "text-[#059669]", warn: "text-[#D97706]", bad: "text-[#DC2626]", info: "text-[#2563EB]" }[tone];
  const Tag = onClick ? "button" : "div";
  return (
    <Tag type={onClick ? "button" : undefined} onClick={onClick}
      className={`text-left bg-white rounded-2xl border border-[#E2E8F0] shadow-sm p-4 sm:p-5 min-w-0 ${onClick ? "hover:border-[#BFDBFE] hover:shadow-md transition-all" : ""}`}>
      <p className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wide">{label}</p>
      <p className={`text-2xl sm:text-[28px] font-bold font-mono leading-tight mt-1.5 tabular-nums ${color}`}>{value}</p>
      {sub && <p className="text-[11px] text-[#94A3B8] mt-1">{sub}</p>}
    </Tag>
  );
}

export function Button({ children, onClick, variant = "secondary", disabled, type = "button", small }: {
  children: ReactNode; onClick?: () => void; variant?: "primary" | "secondary" | "danger" | "ghost";
  disabled?: boolean; type?: "button" | "submit"; small?: boolean;
}) {
  const v = {
    primary: "bg-[#2563EB] text-white hover:bg-[#1D4ED8]",
    secondary: "bg-white text-[#2563EB] border border-[#BFDBFE] hover:bg-[#EFF6FF]",
    danger: "bg-white text-[#DC2626] border border-[#FECACA] hover:bg-[#FEF2F2]",
    ghost: "text-[#475569] hover:bg-[#F1F5F9]",
  }[variant];
  return (
    <button type={type} onClick={onClick} disabled={disabled}
      className={`inline-flex items-center gap-1.5 font-semibold rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${small ? "text-xs px-3 py-1.5" : "text-sm px-4 py-2.5"} ${v}`}>
      {children}
    </button>
  );
}

export function DownloadIcon() {
  return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>;
}

export function RefreshIcon({ spinning = false }: { spinning?: boolean }) {
  return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className={spinning ? "animate-spin" : ""}><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>;
}

/** Loading / error / content switch used by every screen that fetches data. */
export function Loadable({ loading, error, onRetry, children }: { loading: boolean; error: string; onRetry: () => void; children: ReactNode }) {
  if (error) {
    return (
      <div className="rounded-2xl border border-[#FECACA] bg-[#FEF2F2] p-5 text-sm text-[#991B1B]">
        <p className="font-semibold">Couldn't load this page</p>
        <p className="mt-1">{error}</p>
        <button type="button" onClick={onRetry} className="mt-3 font-semibold underline">Try again</button>
      </div>
    );
  }
  if (loading) {
    return (
      <div className="space-y-4 animate-pulse" aria-busy="true" aria-label="Loading">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">{[1, 2, 3, 4].map((i) => <div key={i} className="h-24 bg-white border border-[#E2E8F0] rounded-2xl" />)}</div>
        <div className="h-64 bg-white border border-[#E2E8F0] rounded-2xl" />
      </div>
    );
  }
  return <>{children}</>;
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="text-sm text-[#94A3B8] text-center py-8 px-4 border border-dashed border-[#E2E8F0] rounded-xl">{children}</div>;
}

export function Toast({ message, onDone }: { message: string; onDone: () => void }) {
  useEffect(() => { const t = setTimeout(onDone, 3500); return () => clearTimeout(t); }, [message, onDone]);
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-[#0F172A] text-white text-sm px-5 py-3 rounded-xl shadow-xl z-50 max-w-[90vw] text-center" role="status">
      {message}
    </div>
  );
}

export function useToast() {
  const [msg, setMsg] = useState("");
  const node = msg ? <Toast message={msg} onDone={() => setMsg("")} /> : null;
  return { show: setMsg, node };
}

/** Horizontal scroll wrapper so wide tables never stretch the page on phones. */
export function TableWrap({ children }: { children: ReactNode }) {
  return <div className="overflow-x-auto -mx-5 px-5"><table className="w-full text-sm min-w-[560px]">{children}</table></div>;
}

export const th = "text-left text-[11px] font-semibold uppercase tracking-wide text-[#94A3B8] pb-2 pr-4 whitespace-nowrap";
export const td = "py-2.5 pr-4 border-t border-[#F1F5F9] align-top";

export function Tabs<T extends string>({ value, onChange, items }: { value: T; onChange: (v: T) => void; items: { id: T; label: string; count?: number }[] }) {
  return (
    <div className="flex bg-[#F1F5F9] rounded-xl p-1 gap-0.5 overflow-x-auto max-w-full" role="tablist">
      {items.map((t) => (
        <button key={t.id} type="button" role="tab" aria-selected={value === t.id} onClick={() => onChange(t.id)}
          className={`px-3.5 py-1.5 rounded-lg text-sm font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 ${value === t.id ? "bg-white text-[#0F172A] shadow-sm" : "text-[#64748B] hover:text-[#0F172A]"}`}>
          {t.label}
          {t.count !== undefined && t.count > 0 && <span className="text-[10px] font-bold bg-[#EF4444] text-white rounded-full px-1.5 py-0.5">{t.count}</span>}
        </button>
      ))}
    </div>
  );
}

/** Re-runs a loader and tracks loading/error state. */
export function useLoader<T>(load: () => Promise<T>, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    load()
      .then((d) => { if (!cancelled) setData(d); })
      .catch((e) => { if (!cancelled) setError(e instanceof Error ? e.message : "Something went wrong."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick, ...deps]);
  return { data, loading: loading && !data, refreshing: loading, error, reload: () => setTick((n) => n + 1) };
}
