import { useState, useRef, useEffect } from "react";
import type { Screen } from "../App";
import type { UserRole } from "../lib/auth";
import { canAccess, ROLE_META } from "../lib/permissions";
import type { AdminScreen } from "../lib/permissions";
import { supabase } from "../lib/supabase";

// ── Props ─────────────────────────────────────────────────────────────────────

type Props = {
  screen:    Screen;
  navigate:  (s: Screen) => void;
  onLogout:  () => void;
  children:  React.ReactNode;
  userName?: string;
  userRole:  UserRole;
};

// ── Nav definition ────────────────────────────────────────────────────────────

type NavItem = {
  label:  string;
  screen: AdminScreen;
  icon:   React.ReactNode;
  badge?: number;
};

const NAV_ITEMS: NavItem[] = [
  {
    label: "Dashboard", screen: "adminDashboard",
    icon: <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>,
  },
  {
    label: "Users", screen: "adminUsers",
    icon: <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
  },
  {
    label: "Roles & Permissions", screen: "adminRoles",
    icon: <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.07 4.93l-1.41 1.41M4.93 4.93l1.41 1.41M20 12h2M2 12h2M19.07 19.07l-1.41-1.41M4.93 19.07l1.41-1.41M12 20v2M12 2v2"/></svg>,
  },
  {
    label: "Reports", screen: "adminReports",
    icon: <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>,
  },
  {
    label: "Content", screen: "adminContent",
    icon: <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>,
  },
  {
    label: "Security Center", screen: "adminSecurity",
    icon: <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>,
  },
  {
    label: "Audit Logs", screen: "adminAuditLogs",
    icon: <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>,
  },
  {
    label: "System Settings", screen: "adminSystemSettings",
    icon: <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.07 4.93l-1.41 1.41M4.93 4.93l1.41 1.41M20 12h2M2 12h2M19.07 19.07l-1.41-1.41M4.93 19.07l1.41-1.41M12 20v2M12 2v2"/></svg>,
  },
];

// ── Role badge component ──────────────────────────────────────────────────────

function RolePill({ role }: { role: UserRole }) {
  const m = ROLE_META[role];
  return (
    <span
      style={{ backgroundColor: m.bg, color: m.text }}
      className="text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wide whitespace-nowrap">
      {m.badge}
    </span>
  );
}

// ── Profile dropdown ──────────────────────────────────────────────────────────

function AdminProfileDropdown({ userName, userRole, onLogout }: {
  userName: string; userRole: UserRole; onLogout: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const m   = ROLE_META[userRole];

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2.5 pl-2 pr-3 py-1.5 rounded-xl hover:bg-white/10 transition-colors">
        <div
          style={{ backgroundColor: m.avatarBg, color: m.avatarFg }}
          className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 font-bold text-sm">
          {userName.charAt(0).toUpperCase()}
        </div>
        <div className="hidden sm:flex flex-col items-start leading-none gap-1">
          <span className="text-sm font-semibold text-white">{userName}</span>
          <RolePill role={userRole} />
        </div>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="2.5" strokeLinecap="round"
          className={`hidden sm:block transition-transform duration-200 ${open ? "rotate-180" : ""}`}>
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-2xl border border-[#E2E8F0] shadow-xl z-50 overflow-hidden">
          <div className="px-4 py-3.5 border-b border-[#F1F5F9]">
            <div className="flex items-center gap-3">
              <div
                style={{ backgroundColor: m.avatarBg, color: m.avatarFg }}
                className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 font-bold text-base">
                {userName.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-[#0F172A] truncate">{userName}</p>
                <RolePill role={userRole} />
              </div>
            </div>
          </div>
          <div className="py-1.5">
            <button
              onClick={() => { setOpen(false); onLogout(); }}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-[#EF4444] hover:bg-[#FEF2F2] transition-colors font-semibold">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
              </svg>
              Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Section separator for nav ─────────────────────────────────────────────────

const NAV_SECTIONS: { heading: string; screens: AdminScreen[] }[] = [
  { heading: "Overview",    screens: ["adminDashboard"] },
  { heading: "Management",  screens: ["adminUsers", "adminRoles"] },
  { heading: "Analytics",   screens: ["adminReports", "adminContent"] },
  { heading: "Platform",    screens: ["adminSecurity", "adminAuditLogs", "adminSystemSettings"] },
];

// ── Live database status (replaces a hard-coded "all systems operational") ────

function useDbStatus() {
  const [state, setState] = useState<{ ok: boolean | null; ms: number }>({ ok: null, ms: 0 });
  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      const t0 = performance.now();
      const { error } = await supabase.from("app_settings").select("key").limit(1);
      if (!cancelled) setState({ ok: !error, ms: Math.round(performance.now() - t0) });
    };
    void check();
    const t = setInterval(() => { void check(); }, 60_000);
    return () => { cancelled = true; clearInterval(t); };
  }, []);
  return state;
}

function DbStatus() {
  const { ok, ms } = useDbStatus();
  const color = ok === null ? "bg-[#64748B]" : ok ? "bg-[#10B981]" : "bg-[#EF4444]";
  const text = ok === null ? "Checking database…" : ok ? `Database connected · ${ms} ms` : "Database unreachable";
  return (
    <div className="hidden md:flex items-center gap-2 text-xs text-[#94A3B8]" title="Checked every minute">
      <span className={`w-2 h-2 rounded-full inline-block ${color} ${ok ? "animate-pulse" : ""}`} />
      {text}
    </div>
  );
}

// ── Main layout ───────────────────────────────────────────────────────────────

export default function AdminLayout({
  screen, navigate, onLogout, children, userName = "Administrator", userRole,
}: Props) {
  const pageLabel = NAV_ITEMS.find((n) => n.screen === screen)?.label ?? "Dashboard";
  const m = ROLE_META[userRole];
  const [menuOpen, setMenuOpen] = useState(false);
  const mainRef = useRef<HTMLElement>(null);
  useEffect(() => { setMenuOpen(false); mainRef.current?.scrollTo(0, 0); }, [screen]);

  const sidebar = (
    <>
      <div className="h-16 flex items-center gap-2.5 px-5 border-b border-white/10 shrink-0">
        <div className="w-8 h-8 rounded-lg bg-[#2563EB] flex items-center justify-center shrink-0">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="white"><path d="M12 2l9 4v6c0 5.25-3.75 10.14-9 11.5C6.75 22.14 3 17.25 3 12V6l9-4z"/></svg>
        </div>
        <div className="flex-1">
          <div className="text-white font-bold text-sm leading-none">SmartBudget</div>
          <div className="text-[10px] font-semibold tracking-widest uppercase leading-none mt-0.5" style={{ color: m.avatarBg }}>{m.badge} Panel</div>
        </div>
        <button type="button" onClick={() => setMenuOpen(false)} className="lg:hidden text-[#94A3B8] hover:text-white" aria-label="Close menu">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>
      <nav className="flex-1 px-3 py-4 overflow-y-auto space-y-5" aria-label="Admin">
        {NAV_SECTIONS.map((section) => {
          const visible = section.screens
            .map((sc) => NAV_ITEMS.find((n) => n.screen === sc)!)
            .filter((item) => item && canAccess(userRole, item.screen));
          if (visible.length === 0) return null;
          return (
            <div key={section.heading}>
              <p className="text-[9px] font-bold uppercase tracking-widest text-[#64748B] px-3 mb-1.5">{section.heading}</p>
              <div className="space-y-0.5">
                {visible.map((item) => {
                  const active = screen === item.screen;
                  return (
                    <button key={item.screen} type="button" onClick={() => { setMenuOpen(false); navigate(item.screen); }} aria-current={active ? "page" : undefined}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all text-left ${active ? "bg-[#2563EB] text-white" : "text-[#94A3B8] hover:bg-white/5 hover:text-white"}`}>
                      <span className={active ? "text-white" : "text-[#64748B]"}>{item.icon}</span>
                      <span className="flex-1 truncate">{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </nav>
      <div className="px-3 pb-4 pt-3 border-t border-white/10 shrink-0 space-y-1">
        <button type="button" onClick={() => navigate("privacy")} className="w-full text-left px-3 py-1.5 text-xs text-[#64748B] hover:text-white">Privacy &amp; policies</button>
        <button type="button" onClick={onLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-[#94A3B8] hover:bg-white/5 hover:text-white transition-all">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
          Sign out
        </button>
      </div>
    </>
  );

  return (
    <div className="flex h-screen bg-[#0F172A] overflow-hidden">
      {/* Sidebar (desktop) */}
      <aside className="hidden lg:flex w-60 shrink-0 flex-col border-r border-white/10">{sidebar}</aside>

      {/* Sidebar (phones and tablets) */}
      {menuOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex" role="dialog" aria-modal="true" aria-label="Admin menu">
          <aside className="w-72 max-w-[85vw] bg-[#0F172A] flex flex-col shadow-2xl">{sidebar}</aside>
          <button type="button" className="flex-1 bg-black/50" aria-label="Close menu" onClick={() => setMenuOpen(false)} />
        </div>
      )}

      {/* Main area */}
      <div className="flex-1 flex flex-col overflow-hidden bg-[#F8FAFC] min-w-0">
        <header className="h-14 bg-[#0F172A] border-b border-white/10 flex items-center justify-between px-3 sm:px-6 shrink-0 gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <button type="button" onClick={() => setMenuOpen(true)} className="lg:hidden w-9 h-9 rounded-lg flex items-center justify-center text-white hover:bg-white/10" aria-label="Open menu">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
            </button>
            <div className="text-sm text-[#64748B] flex items-center gap-1.5 min-w-0">
              <span style={{ color: m.avatarBg }} className="font-semibold text-xs hidden sm:inline">{m.badge}</span>
              <span className="text-[#334155] hidden sm:inline">/</span>
              <span className="text-white font-medium truncate">{pageLabel}</span>
            </div>
          </div>
          <div className="flex items-center gap-4 shrink-0">
            <DbStatus />
            <AdminProfileDropdown userName={userName} userRole={userRole} onLogout={onLogout} />
          </div>
        </header>
        <main ref={mainRef} className="flex-1 overflow-y-auto p-4 sm:p-6 pb-28">{children}</main>
      </div>
    </div>
  );
}
