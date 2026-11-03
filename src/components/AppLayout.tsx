import { useState, useRef, useEffect, type ReactNode } from "react";
import type { Screen } from "../App";
import { NOTIFICATIONS_CHANGED, countUnread } from "../lib/notifications";
import { subscribeTransactionsChanged } from "../lib/transactions";
import { VoiceButton } from "./VoiceAssistant";

const navItems = [
  { id: "dashboard",    label: "Dashboard",   icon: GridIcon },
  { id: "agent",        label: "AI Agent",    icon: SparkleIcon },
  { id: "transactions", label: "Transactions", icon: ReceiptIcon },
  { id: "budget",       label: "Budget",       icon: SliderIcon },
  { id: "savings",      label: "Savings",      icon: PiggyIcon },
  { id: "analytics",   label: "Analytics",    icon: ChartIcon },
  { id: "healthScore", label: "Health Score", icon: HeartIcon },
  { id: "education",   label: "Learn",        icon: BookIcon },
  { id: "helpCenter",  label: "Help",         icon: HelpIcon },
  { id: "settings",   label: "Settings",     icon: GearIcon },
] as const;

interface Props {
  screen: Screen;
  navigate: (s: Screen) => void;
  onLogout: () => void;
  children: ReactNode;
  userName?: string;
  userRole?: "user" | "admin";
  darkMode?: boolean;
  onToggleDark?: () => void;
  /** Hidden when an administrator switches the assistant off. */
  assistantEnabled?: boolean;
  /** Site-wide message set in Admin › System Settings (empty = none). */
  announcement?: string;
}

/** Announcement from the administrators; dismissed per message on this device. */
function AnnouncementBar({ text }: { text: string }) {
  const key = "sb_announcement_dismissed";
  const [hidden, setHidden] = useState(() => {
    try { return localStorage.getItem(key) === text; } catch { return false; }
  });
  if (!text.trim() || hidden) return null;
  return (
    <div className="bg-[#EFF6FF] border-b border-[#BFDBFE] px-4 sm:px-6 py-2.5 flex items-start gap-3 text-sm text-[#1E40AF]" role="status">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="mt-0.5 shrink-0"><path d="M3 11l18-5v12L3 14v-3z"/><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6"/></svg>
      <p className="flex-1">{text}</p>
      <button type="button" aria-label="Dismiss announcement" className="text-[#60A5FA] hover:text-[#1E40AF] shrink-0"
        onClick={() => { setHidden(true); try { localStorage.setItem(key, text); } catch { /* ignore */ } }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    </div>
  );
}

// ---- Profile dropdown shown in the top-right header ----
function RoleBadge({ role }: { role: "user" | "admin" }) {
  if (role === "admin") {
    return (
      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-[#FEF3C7] text-[#92400E] uppercase tracking-wide">
        Admin
      </span>
    );
  }
  return (
    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-[#EFF6FF] text-[#1D4ED8] uppercase tracking-wide">
      User
    </span>
  );
}

function ProfileDropdown({
  userName,
  userRole,
  onNavigate,
  onLogout,
}: {
  userName: string;
  userRole: "user" | "admin";
  onNavigate: (s: Screen) => void;
  onLogout: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const initial = userName.charAt(0).toUpperCase();
  const firstName = userName.split(" ")[0];

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2.5 pl-2 pr-3 py-1.5 rounded-xl hover:bg-[#F1F5F9] transition-colors group"
        aria-label="User menu"
      >
        {/* Avatar */}
        <div className="w-8 h-8 rounded-full bg-[#2563EB] flex items-center justify-center shrink-0 shadow-sm">
          <span className="text-white font-bold text-sm leading-none">{initial}</span>
        </div>
        {/* Name + role — hidden on small screens */}
        <div className="hidden sm:flex flex-col items-start">
          <span className="text-sm font-semibold text-[#0F172A] max-w-[110px] truncate leading-tight">{firstName}</span>
          <RoleBadge role={userRole} />
        </div>
        {/* Chevron */}
        <svg
          width="14" height="14" viewBox="0 0 24 24" fill="none"
          stroke="#94A3B8" strokeWidth="2.5" strokeLinecap="round"
          className={`hidden sm:block transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {/* Dropdown panel */}
      {open && (
        <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-2xl border border-[#E2E8F0] shadow-lg shadow-black/8 z-50 overflow-hidden animate-in">
          {/* User info header */}
          <div className="px-4 py-3.5 border-b border-[#F1F5F9]">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[#2563EB] flex items-center justify-center shrink-0">
                <span className="text-white font-bold text-base leading-none">{initial}</span>
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-[#0F172A] truncate">{userName}</p>
                <div className="mt-0.5"><RoleBadge role={userRole} /></div>
              </div>
            </div>
          </div>

          {/* Menu items */}
          <div className="py-1.5">
            <DropdownItem
              icon={<UserIcon />}
              label="Profile"
              onClick={() => { setOpen(false); onNavigate("settings"); }}
            />
            <DropdownItem
              icon={<GearSmallIcon />}
              label="Settings"
              onClick={() => { setOpen(false); onNavigate("settings"); }}
            />
          </div>

          {/* Logout */}
          <div className="border-t border-[#F1F5F9] py-1.5">
            <button
              onClick={() => { setOpen(false); onLogout(); }}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-[#EF4444] hover:bg-[#FEF2F2] transition-colors text-left"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
              <span className="font-semibold">Sign out</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function DropdownItem({ icon, label, onClick }: { icon: ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-[#374151] hover:bg-[#F8FAFC] transition-colors text-left"
    >
      <span className="text-[#94A3B8]">{icon}</span>
      <span className="font-medium">{label}</span>
    </button>
  );
}

// ---- Dark mode toggle button ----
export function DarkToggle({ dark, onToggle }: { dark: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      title={dark ? "Switch to light mode" : "Switch to dark mode"}
      className="w-8 h-8 rounded-xl flex items-center justify-center text-[#64748B] hover:bg-[#F1F5F9] hover:text-[#0F172A] transition-colors"
      aria-label="Toggle dark mode"
    >
      {dark ? (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/>
          <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
          <line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/>
          <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
        </svg>
      ) : (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
        </svg>
      )}
    </button>
  );
}

// ---- Top header bar shown on every authenticated page ----
function TopHeader({
  screen, userName, userRole, navigate, onLogout, darkMode = false, onToggleDark, voiceOn = false,
}: {
  voiceOn?: boolean;
  screen: Screen; userName: string; userRole: "user" | "admin";
  navigate: (s: Screen) => void; onLogout: () => void;
  darkMode?: boolean; onToggleDark?: () => void;
}) {
  const activeNav = navItems.find((n) => n.id === screen);
  const pageTitle = activeNav?.label ?? (screen === "notifications" ? "Notifications" : screen === "bankConnect" ? "Demo bank" : "Dashboard");

  // Unread count comes from the user's real budgets and goals (lib/notifications.ts).
  const [unread, setUnread] = useState(0);
  useEffect(() => {
    let cancelled = false;
    const refresh = () => { countUnread().then((n) => { if (!cancelled) setUnread(n); }).catch(() => undefined); };
    refresh();
    window.addEventListener(NOTIFICATIONS_CHANGED, refresh);
    const unsubscribe = subscribeTransactionsChanged(refresh);
    return () => {
      cancelled = true;
      window.removeEventListener(NOTIFICATIONS_CHANGED, refresh);
      unsubscribe();
    };
  }, [screen]);

  return (
    <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-sm border-b border-[#E2E8F0] px-4 sm:px-6 flex items-center justify-between h-14 shrink-0">
      <div className="flex items-center gap-3">
        <div className="md:hidden flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-[#2563EB] flex items-center justify-center">
            <span className="text-white font-bold text-xs">S</span>
          </div>
          <span className="font-bold text-[#0F172A] text-base tracking-tight">SmartBudget</span>
        </div>
        <span className="hidden md:block text-sm font-semibold text-[#0F172A]">{pageTitle}</span>
      </div>

      <div className="flex items-center gap-1">
        {/* Notifications bell */}
        <button
          onClick={() => navigate("notifications" as Screen)}
          title={unread ? `Notifications (${unread} unread)` : "Notifications"}
          aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"}
          className="relative w-8 h-8 rounded-xl flex items-center justify-center text-[#64748B] hover:bg-[#F1F5F9] hover:text-[#0F172A] transition-colors"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>
          </svg>
          {unread > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 bg-[#EF4444] text-white text-[9px] font-bold rounded-full border-2 border-white flex items-center justify-center leading-none">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </button>
        {voiceOn && <VoiceButton />}
        {/* Dark mode toggle */}
        {onToggleDark && <DarkToggle dark={darkMode} onToggle={onToggleDark} />}
        <ProfileDropdown userName={userName} userRole={userRole} onNavigate={navigate} onLogout={onLogout} />
      </div>
    </header>
  );
}

export default function AppLayout({ screen, navigate, onLogout, children, userName = "User", userRole = "user", darkMode = false, onToggleDark, assistantEnabled = true, announcement = "" }: Props) {
  const items = navItems.filter((n) => assistantEnabled || n.id !== "agent");
  // Start each screen at the top instead of keeping the previous page's scroll position.
  const mainRef = useRef<HTMLElement>(null);
  useEffect(() => { mainRef.current?.scrollTo(0, 0); }, [screen]);

  return (
    <div className="flex h-screen bg-[#F8FAFC] overflow-hidden">
      {/* Sidebar */}
      <aside className="hidden md:flex flex-col w-60 bg-white border-r border-[#E2E8F0] shrink-0">
        <div className="px-6 py-5 border-b border-[#E2E8F0]">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[#2563EB] flex items-center justify-center">
              <span className="text-white font-bold text-sm">S</span>
            </div>
            <span className="font-bold text-[#0F172A] text-lg tracking-tight">SmartBudget</span>
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          {items.map(({ id, label, icon: Icon }) => {
            const active = screen === id;
            return (
              <button
                key={id}
                onClick={() => navigate(id as Screen)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 ${
                  active
                    ? "bg-[#EFF6FF] text-[#2563EB]"
                    : "text-[#64748B] hover:bg-[#F8FAFC] hover:text-[#0F172A]"
                }`}
              >
                <Icon size={18} active={active} />
                {label}
                {id === "agent" && (
                  <span className="ml-auto text-[9px] font-bold bg-[#2563EB] text-white px-1.5 py-0.5 rounded-full">AI</span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Sidebar footer — user chip */}
        <div className="px-4 py-4 border-t border-[#E2E8F0]">
          <div className="flex items-center gap-2.5 px-1 mb-3">
            <div className="w-8 h-8 rounded-full bg-[#2563EB] flex items-center justify-center shrink-0">
              <span className="text-white font-bold text-sm leading-none">{userName.charAt(0).toUpperCase()}</span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-[#0F172A] truncate">{userName}</p>
              <p className="text-[10px] text-[#94A3B8]">Personal account</p>
            </div>
          </div>
          <p className="text-[10px] leading-relaxed text-[#94A3B8] mb-2">
            Educational budgeting tools only. Not financial advice.
          </p>
          <div className="flex flex-wrap gap-x-2.5 gap-y-0.5 text-[10px] text-[#94A3B8] mb-3">
            <button type="button" onClick={() => navigate("privacy")} className="hover:text-[#2563EB]">Privacy</button>
            <button type="button" onClick={() => navigate("terms")} className="hover:text-[#2563EB]">Terms</button>
            <button type="button" onClick={() => navigate("disclaimer")} className="hover:text-[#2563EB]">Disclaimer</button>
            <button type="button" onClick={() => navigate("contact")} className="hover:text-[#2563EB]">Contact</button>
          </div>
          <button
            onClick={onLogout}
            className="w-full text-left text-xs text-[#64748B] hover:text-[#EF4444] transition-colors flex items-center gap-2"
          >
            <LogoutIcon />
            Sign out
          </button>
        </div>
      </aside>

      {/* Right pane: header + scrollable content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <TopHeader screen={screen} userName={userName} userRole={userRole} navigate={navigate} onLogout={onLogout} darkMode={darkMode} onToggleDark={onToggleDark} voiceOn={assistantEnabled} />

        <AnnouncementBar text={announcement} />
        <main ref={mainRef} className={screen === "agent" ? "flex-1 min-h-0 overflow-hidden relative pb-[calc(58px+env(safe-area-inset-bottom))] md:pb-0" : "flex-1 overflow-y-auto pb-20 md:pb-0 relative"}>
          {children}
        </main>
      </div>

      <MobileNav screen={screen} navigate={navigate} onLogout={onLogout} hideAsk={!assistantEnabled} />
    </div>
  );
}

// ---- Mobile bottom nav: four main sections plus a "More" sheet with the rest ----
const MOBILE_PRIMARY = ["dashboard", "agent", "transactions", "budget"] as const;

function MobileNav({ screen, navigate, onLogout, hideAsk = false }: { screen: Screen; navigate: (s: Screen) => void; onLogout: () => void; hideAsk?: boolean }) {
  const [open, setOpen] = useState(false);
  const primary = navItems.filter((n) => (MOBILE_PRIMARY as readonly string[]).includes(n.id) && !(hideAsk && n.id === "agent"));
  const rest = navItems.filter((n) => !(MOBILE_PRIMARY as readonly string[]).includes(n.id) && !(hideAsk && n.id === "agent"));
  const moreActive = rest.some((n) => n.id === screen);
  const go = (s: Screen) => { setOpen(false); navigate(s); };

  useEffect(() => { setOpen(false); }, [screen]);

  return (
    <>
      {open && (
        <div className="md:hidden fixed inset-0 z-[60]" role="dialog" aria-modal="true" aria-label="More pages">
          <button type="button" aria-label="Close menu" className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={() => setOpen(false)} />
          <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-3xl p-5 pb-8 animate-up max-h-[80vh] overflow-y-auto">
            <div className="w-10 h-1 rounded-full bg-[#E2E8F0] mx-auto mb-4" />
            <div className="grid grid-cols-3 gap-2">
              {rest.map(({ id, label, icon: Icon }) => (
                <button key={id} type="button" onClick={() => go(id as Screen)}
                  className={`flex flex-col items-center gap-1.5 rounded-2xl py-3.5 text-xs font-medium ${screen === id ? "bg-[#EFF6FF] text-[#2563EB]" : "bg-[#F8FAFC] text-[#475569]"}`}>
                  <Icon size={20} active={screen === id} />
                  {label}
                </button>
              ))}
              <button type="button" onClick={() => go("notifications")}
                className={`flex flex-col items-center gap-1.5 rounded-2xl py-3.5 text-xs font-medium ${screen === "notifications" ? "bg-[#EFF6FF] text-[#2563EB]" : "bg-[#F8FAFC] text-[#475569]"}`}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
                Alerts
              </button>
            </div>
            <div className="mt-5 pt-4 border-t border-[#F1F5F9] flex flex-wrap gap-x-4 gap-y-2 text-xs text-[#64748B]">
              <button type="button" onClick={() => go("privacy")}>Privacy</button>
              <button type="button" onClick={() => go("terms")}>Terms</button>
              <button type="button" onClick={() => go("disclaimer")}>Disclaimer</button>
              <button type="button" onClick={() => go("contact")}>Contact</button>
              <button type="button" onClick={() => { setOpen(false); onLogout(); }} className="ml-auto text-[#EF4444] font-semibold">Sign out</button>
            </div>
          </div>
        </div>
      )}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-[#E2E8F0] flex z-50 pb-[env(safe-area-inset-bottom)]" aria-label="Main">
        {primary.map(({ id, label, icon: Icon }) => {
          const active = screen === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => navigate(id as Screen)}
              aria-current={active ? "page" : undefined}
              className={`flex-1 flex flex-col items-center gap-0.5 py-2.5 text-[10px] font-medium transition-colors ${active ? "text-[#2563EB]" : "text-[#94A3B8]"}`}
            >
              <Icon size={20} active={active} />
              {label}
            </button>
          );
        })}
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className={`flex-1 flex flex-col items-center gap-0.5 py-2.5 text-[10px] font-medium transition-colors ${moreActive || open ? "text-[#2563EB]" : "text-[#94A3B8]"}`}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/></svg>
          More
        </button>
      </nav>
    </>
  );
}

// ---- Skeleton loader shown during page transitions ----
export function PageSkeleton() {
  return (
    <div className="p-6 lg:p-8 max-w-[1200px] animate-pulse">
      <div className="h-7 bg-[#E2E8F0] rounded-xl w-48 mb-2" />
      <div className="h-4 bg-[#F1F5F9] rounded-xl w-64 mb-8" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-white rounded-2xl p-5 border border-[#E2E8F0] h-24">
            <div className="h-3 bg-[#F1F5F9] rounded w-20 mb-3" />
            <div className="h-7 bg-[#E2E8F0] rounded w-28 mb-2" />
            <div className="h-3 bg-[#F1F5F9] rounded w-16" />
          </div>
        ))}
      </div>
      <div className="bg-white rounded-2xl border border-[#E2E8F0] h-40 mb-6" />
      <div className="grid lg:grid-cols-3 gap-6">
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-white rounded-2xl border border-[#E2E8F0] h-56" />
        ))}
      </div>
    </div>
  );
}

// ---- Icon components ----

function UserIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
    </svg>
  );
}
function GearSmallIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}
function GridIcon({ size, active }: { size: number; active?: boolean }) {
  const c = active ? "#2563EB" : "currentColor";
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" />
      <rect x="3" y="14" width="7" height="7" /><rect x="14" y="14" width="7" height="7" />
    </svg>
  );
}
function ReceiptIcon({ size, active }: { size: number; active?: boolean }) {
  const c = active ? "#2563EB" : "currentColor";
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 2v20l3-3 2 3 3-3 2 3 3-3 3 3V2z" /><line x1="8" y1="9" x2="16" y2="9" /><line x1="8" y1="13" x2="14" y2="13" />
    </svg>
  );
}
function SliderIcon({ size, active }: { size: number; active?: boolean }) {
  const c = active ? "#2563EB" : "currentColor";
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="4" y1="6" x2="20" y2="6" /><line x1="4" y1="12" x2="20" y2="12" /><line x1="4" y1="18" x2="20" y2="18" />
      <circle cx="9" cy="6" r="2" fill={c} /><circle cx="15" cy="12" r="2" fill={c} /><circle cx="10" cy="18" r="2" fill={c} />
    </svg>
  );
}
function PiggyIcon({ size, active }: { size: number; active?: boolean }) {
  const c = active ? "#2563EB" : "currentColor";
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 5c-1.5 0-2.8.56-3.77 1.47A8 8 0 0 0 4 13c0 .93.16 1.83.45 2.67A2 2 0 0 0 6 19h1l1 2h6l1-2h1a2 2 0 0 0 1.55-2.33A8.04 8.04 0 0 0 20 13V9a2 2 0 0 0-2-2" />
      <path d="M2 11h2" /><circle cx="15.5" cy="9.5" r=".5" fill={c} />
    </svg>
  );
}
function ChartIcon({ size, active }: { size: number; active?: boolean }) {
  const c = active ? "#2563EB" : "currentColor";
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" />
    </svg>
  );
}
function BookIcon({ size, active }: { size: number; active?: boolean }) {
  const c = active ? "#2563EB" : "currentColor";
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
    </svg>
  );
}
function SparkleIcon({ size, active }: { size: number; active?: boolean }) {
  const c = active ? "#2563EB" : "currentColor";
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z" />
    </svg>
  );
}
function GearIcon({ size, active }: { size: number; active?: boolean }) {
  const c = active ? "#2563EB" : "currentColor";
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}
function LogoutIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  );
}
function HeartIcon({ size, active }: { size: number; active?: boolean }) {
  const c = active ? "#EF4444" : "currentColor";
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
    </svg>
  );
}
function HelpIcon({ size, active }: { size: number; active?: boolean }) {
  const c = active ? "#2563EB" : "currentColor";
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/>
    </svg>
  );
}
