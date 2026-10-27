import { useState, useRef, useEffect } from "react";
import type { Screen } from "../App";
import type { UserRole } from "../lib/auth";
import { canAccess, ROLE_META } from "../lib/permissions";
import type { AdminScreen } from "../lib/permissions";

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

// ── Main layout ───────────────────────────────────────────────────────────────

export default function AdminLayout({
  screen, navigate, onLogout, children, userName = "Administrator", userRole,
}: Props) {
  const pageLabel = NAV_ITEMS.find((n) => n.screen === screen)?.label ?? "Dashboard";
  const m = ROLE_META[userRole];

  return (
    <div className="flex h-screen bg-[#0F172A] overflow-hidden">
      {/* Sidebar */}
      <aside className="w-60 shrink-0 flex flex-col border-r border-white/10">
        {/* Logo / brand */}
        <div className="h-16 flex items-center gap-2.5 px-5 border-b border-white/10 shrink-0">
          <div className="w-8 h-8 rounded-lg bg-[#2563EB] flex items-center justify-center shrink-0">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
              <path d="M12 2l9 4v6c0 5.25-3.75 10.14-9 11.5C6.75 22.14 3 17.25 3 12V6l9-4z"/>
            </svg>
          </div>
          <div>
            <div className="text-white font-bold text-sm leading-none">SmartBudget</div>
            <div className="text-[10px] font-semibold tracking-widest uppercase leading-none mt-0.5" style={{ color: m.avatarBg }}>
              {m.badge} Panel
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 overflow-y-auto space-y-5">
          {NAV_SECTIONS.map((section) => {
            // Filter to only items this role can access
            const visible = section.screens
              .map((s) => NAV_ITEMS.find((n) => n.screen === s)!)
              .filter((item) => item && canAccess(userRole, item.screen));

            if (visible.length === 0) return null;

            return (
              <div key={section.heading}>
                <p className="text-[9px] font-bold uppercase tracking-widest text-[#475569] px-3 mb-1.5">
                  {section.heading}
                </p>
                <div className="space-y-0.5">
                  {visible.map((item) => {
                    const active = screen === item.screen;
                    return (
                      <button
                        key={item.screen}
                        onClick={() => navigate(item.screen)}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all text-left ${
                          active
                            ? "bg-[#2563EB] text-white"
                            : "text-[#94A3B8] hover:bg-white/5 hover:text-white"
                        }`}>
                        <span className={active ? "text-white" : "text-[#475569]"}>{item.icon}</span>
                        <span className="flex-1 truncate">{item.label}</span>
                        {item.badge ? (
                          <span className="text-[10px] font-bold bg-[#EF4444] text-white rounded-full px-1.5 py-0.5 shrink-0">
                            {item.badge}
                          </span>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </nav>

        {/* Sign out */}
        <div className="px-3 pb-4 pt-3 border-t border-white/10 shrink-0">
          <button
            onClick={onLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-[#94A3B8] hover:bg-white/5 hover:text-white transition-all">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
            Sign out
          </button>
        </div>
      </aside>

      {/* Main area */}
      <div className="flex-1 flex flex-col overflow-hidden bg-[#F8FAFC]">
        {/* Top bar */}
        <header className="h-14 bg-[#0F172A] border-b border-white/10 flex items-center justify-between px-6 shrink-0">
          <div className="text-sm text-[#64748B] flex items-center gap-1.5">
            <span
              style={{ color: m.avatarBg }}
              className="font-semibold text-xs">
              {m.badge}
            </span>
            <span className="text-[#334155]">/</span>
            <span className="text-white font-medium">{pageLabel}</span>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-xs text-[#475569]">
              <span className="w-2 h-2 rounded-full bg-[#10B981] inline-block animate-pulse" />
              All systems operational
            </div>
            <AdminProfileDropdown userName={userName} userRole={userRole} onLogout={onLogout} />
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-6">
          {screen !== "adminUsers" && screen !== "adminDashboard" && (
            <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs text-amber-800">
              Prototype screen: the figures and records shown here are sample data for demonstration. They are not read from the live database.
            </div>
          )}
          {children}
        </main>
      </div>
    </div>
  );
}
