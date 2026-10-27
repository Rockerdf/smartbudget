import { useState } from "react";
import AIAssistant from "../../components/AIAssistant";
import { downloadCsv, todayStamp } from "../../lib/exportData";

const FAILED_LOGINS = [
  { id: 1, ts: "2026-09-22 23:41", ip: "103.21.244.0",  email: "admin@smartbudget.com", reason: "Wrong password",      attempts: 7, blocked: true  },
  { id: 2, ts: "2026-09-22 21:18", ip: "91.240.118.61", email: "jordan.w@email.com",    reason: "Account suspended",   attempts: 3, blocked: false },
  { id: 3, ts: "2026-09-22 19:05", ip: "45.142.212.10", email: "unknown@proton.me",     reason: "No account found",    attempts: 12, blocked: true  },
  { id: 4, ts: "2026-09-21 14:33", ip: "185.220.101.14",email: "admin@smartbudget.com", reason: "Wrong password",      attempts: 2, blocked: false },
  { id: 5, ts: "2026-09-21 09:12", ip: "62.232.101.5",  email: "riley.s@email.com",     reason: "Account suspended",   attempts: 1, blocked: false },
  { id: 6, ts: "2026-09-20 22:54", ip: "37.120.10.201", email: "test@test.com",          reason: "No account found",    attempts: 5, blocked: true  },
];

const RECENT_LOGINS = [
  { id: 1, ts: "2026-09-22 22:10", email: "admin@smartbudget.com", ip: "185.220.101.14", device: "Chrome / macOS",      role: "admin", status: "success" },
  { id: 2, ts: "2026-09-22 20:44", email: "morgan.l@email.com",    ip: "141.101.72.55",  device: "Safari / iPhone",     role: "user",  status: "success" },
  { id: 3, ts: "2026-09-22 18:30", email: "sam.o@email.com",       ip: "46.101.44.88",   device: "Firefox / Windows",   role: "user",  status: "success" },
  { id: 4, ts: "2026-09-22 16:55", email: "casey.n@email.com",     ip: "37.120.10.201",  device: "Chrome / Android",    role: "user",  status: "success" },
  { id: 5, ts: "2026-09-22 15:02", email: "jamie.c@email.com",     ip: "82.44.112.55",   device: "Chrome / macOS",      role: "user",  status: "success" },
  { id: 6, ts: "2026-09-22 12:18", email: "morgan.l@email.com",    ip: "141.101.72.55",  device: "Chrome / Windows",    role: "user",  status: "success" },
];

const ALERTS = [
  { id: 1, severity: "critical", icon: "🚨", title: "Brute-force attempt detected",      body: "IP 103.21.244.0 made 7 failed login attempts targeting the admin account. IP has been blocked.",  time: "1h ago",   resolved: false },
  { id: 2, severity: "high",     icon: "⚠️",  title: "Credential stuffing probe",          body: "IP 45.142.212.10 attempted 12 logins using invalid email addresses. IP blocked automatically.", time: "3h ago",   resolved: false },
  { id: 3, severity: "medium",   icon: "🔔", title: "Suspended user login attempt",       body: "riley.s@email.com (suspended) attempted to log in from a new device.",                            time: "Yesterday", resolved: true  },
  { id: 4, severity: "low",      icon: "ℹ️",  title: "Admin login from known IP",          body: "Administrator logged in from 185.220.101.14. Device: Chrome / macOS. No action required.",      time: "2h ago",   resolved: true  },
  { id: 5, severity: "high",     icon: "⚠️",  title: "Prompt injection attempt",           body: "User jordan.w attempted a jailbreak prompt. AI boundary held. Interaction flagged for review.",  time: "Sep 15",   resolved: true  },
];

const sevStyle = {
  critical: { dot: "bg-[#EF4444]", badge: "bg-[#FEE2E2] text-[#991B1B]", border: "border-[#FECACA]", label: "Critical" },
  high:     { dot: "bg-[#F97316]", badge: "bg-[#FFF7ED] text-[#9A3412]", border: "border-[#FED7AA]", label: "High"     },
  medium:   { dot: "bg-[#F59E0B]", badge: "bg-[#FEF3C7] text-[#92400E]", border: "border-[#FDE68A]", label: "Medium"   },
  low:      { dot: "bg-[#10B981]", badge: "bg-[#D1FAE5] text-[#065F46]", border: "border-[#A7F3D0]", label: "Low"      },
};

type Tab = "alerts" | "failed" | "logins";

function StatTile({ label, value, sub, color }: { label: string; value: string | number; sub: string; color: string }) {
  return (
    <div className="bg-white rounded-2xl p-5 border border-[#E2E8F0]">
      <p className="text-xs text-[#64748B] mb-1">{label}</p>
      <p className="text-2xl font-bold" style={{ color }}>{value}</p>
      <p className="text-xs text-[#94A3B8] mt-0.5">{sub}</p>
    </div>
  );
}

export default function AdminSecurityCenter() {
  const [tab, setTab] = useState<Tab>("alerts");
  const [alerts, setAlerts] = useState(ALERTS);
  const [toast, setToast] = useState("");

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(""), 2500); };
  const openAlerts = alerts.filter((a) => !a.resolved).length;
  const blockedIPs  = FAILED_LOGINS.filter((l) => l.blocked).length;

  return (
    <div>
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-[#0F172A] text-white text-sm px-5 py-3 rounded-xl shadow-xl z-50 max-w-[90vw] text-center">{toast}</div>
      )}

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-[#0F172A]">Security Center</h1>
          <p className="text-sm text-[#64748B] mt-1">Monitor platform security, login activity, and threat alerts in real time.</p>
        </div>
        <button onClick={() => {
            downloadCsv(`security-alerts-sample-${todayStamp()}.csv`, [
              ["Severity", "Title", "Details", "When", "Status"],
              ...alerts.map((a) => [a.severity, a.title, a.body, a.time, a.resolved ? "Resolved" : "Open"]),
            ]);
            showToast("✓ Security alerts exported (sample data)");
          }}
          className="flex items-center gap-2 text-sm font-semibold text-[#2563EB] border border-[#BFDBFE] bg-[#EFF6FF] px-4 py-2.5 rounded-xl hover:bg-[#DBEAFE] transition-colors">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
          Export Report
        </button>
      </div>

      {/* Open-alerts banner */}
      {openAlerts > 0 && (
        <div className="flex items-center gap-3 bg-[#FEF2F2] border border-[#FECACA] rounded-2xl px-5 py-4 mb-5">
          <div className="w-2.5 h-2.5 rounded-full bg-[#EF4444] animate-pulse shrink-0" />
          <p className="text-sm text-[#991B1B] font-semibold">{openAlerts} open security alert{openAlerts !== 1 ? "s" : ""} require your attention.</p>
        </div>
      )}

      {/* KPI strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <StatTile label="Open Alerts"       value={openAlerts}               sub="require review"      color="#EF4444" />
        <StatTile label="Failed Logins (7d)" value={FAILED_LOGINS.length}    sub="last 7 days"         color="#F97316" />
        <StatTile label="Blocked IPs"        value={blockedIPs}               sub="auto-blocked"        color="#8B5CF6" />
        <StatTile label="Successful Logins"  value={RECENT_LOGINS.length}    sub="last 24 hours"       color="#10B981" />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-[#F1F5F9] rounded-xl p-1 w-fit mb-5">
        {([
          { id: "alerts" as const, label: "Security Alerts", badge: openAlerts },
          { id: "failed" as const, label: "Failed Logins",   badge: 0 },
          { id: "logins" as const, label: "Recent Logins",   badge: 0 },
        ]).map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-lg transition-colors ${tab === t.id ? "bg-white text-[#0F172A] shadow-sm" : "text-[#64748B] hover:text-[#0F172A]"}`}>
            {t.label}
            {t.badge > 0 ? <span className="text-[10px] font-bold bg-[#EF4444] text-white px-1.5 py-0.5 rounded-full">{t.badge}</span> : null}
          </button>
        ))}
      </div>

      {/* Security Alerts */}
      {tab === "alerts" && (
        <div className="space-y-3">
          {alerts.map((alert) => {
            const s = sevStyle[alert.severity as keyof typeof sevStyle];
            return (
              <div key={alert.id} className={`bg-white rounded-2xl border ${s.border} p-5 flex gap-4 ${alert.resolved ? "opacity-60" : ""}`}>
                <span className="text-2xl leading-none mt-0.5 shrink-0">{alert.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${s.badge}`}>{s.label}</span>
                    {alert.resolved
                      ? <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#D1FAE5] text-[#065F46]">Resolved</span>
                      : <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#FEE2E2] text-[#991B1B]">Open</span>}
                    <span className="text-xs text-[#94A3B8]">{alert.time}</span>
                  </div>
                  <p className="font-semibold text-[#0F172A] text-sm mb-0.5">{alert.title}</p>
                  <p className="text-xs text-[#64748B] leading-relaxed">{alert.body}</p>
                </div>
                {!alert.resolved && (
                  <button
                    onClick={() => { setAlerts((prev) => prev.map((a) => a.id === alert.id ? { ...a, resolved: true } : a)); showToast("Alert resolved"); }}
                    className="text-xs font-semibold text-[#10B981] bg-[#D1FAE5] px-3 py-1.5 rounded-lg hover:bg-[#A7F3D0] transition-colors shrink-0 self-start">
                    Resolve
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Failed Logins */}
      {tab === "failed" && (
        <div className="bg-white rounded-2xl border border-[#E2E8F0] overflow-hidden">
          <div className="grid grid-cols-[1fr_130px_100px_80px_80px] gap-3 px-5 py-3 bg-[#F8FAFC] text-xs font-semibold text-[#64748B] uppercase tracking-wide">
            <span>Email / IP</span><span>Timestamp</span><span>Reason</span><span>Attempts</span><span>Status</span>
          </div>
          <div className="divide-y divide-[#F8FAFC]">
            {FAILED_LOGINS.map((l) => (
              <div key={l.id} className={`grid grid-cols-[1fr_130px_100px_80px_80px] gap-3 px-5 py-3.5 items-center ${l.attempts >= 5 ? "bg-[#FFF5F5]" : ""}`}>
                <div>
                  <p className="text-sm text-[#0F172A] font-medium truncate">{l.email}</p>
                  <p className="text-xs font-mono text-[#94A3B8]">{l.ip}</p>
                </div>
                <span className="text-xs text-[#64748B]">{l.ts}</span>
                <span className="text-xs text-[#64748B]">{l.reason}</span>
                <span className={`text-xs font-bold ${l.attempts >= 5 ? "text-[#EF4444]" : "text-[#64748B]"}`}>{l.attempts}</span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${l.blocked ? "bg-[#FEE2E2] text-[#991B1B]" : "bg-[#D1FAE5] text-[#065F46]"}`}>
                  {l.blocked ? "Blocked" : "Allowed"}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* AI Assistant */}
      <AIAssistant
        context="admin-security"
        assistantName="Security Assistant"
        accentColor="#DC2626"
        admin
        contextData={{ openAlerts }}
      />

      {/* Recent Logins */}
      {tab === "logins" && (
        <div className="bg-white rounded-2xl border border-[#E2E8F0] overflow-hidden">
          <div className="grid grid-cols-[1fr_130px_130px_100px_80px] gap-3 px-5 py-3 bg-[#F8FAFC] text-xs font-semibold text-[#64748B] uppercase tracking-wide">
            <span>Account</span><span>Timestamp</span><span>Device</span><span>IP</span><span>Role</span>
          </div>
          <div className="divide-y divide-[#F8FAFC]">
            {RECENT_LOGINS.map((l) => (
              <div key={l.id} className="grid grid-cols-[1fr_130px_130px_100px_80px] gap-3 px-5 py-3.5 items-center hover:bg-[#FAFAFA]">
                <p className="text-sm text-[#0F172A] font-medium truncate">{l.email}</p>
                <span className="text-xs text-[#64748B]">{l.ts}</span>
                <span className="text-xs text-[#64748B] truncate">{l.device}</span>
                <span className="text-xs font-mono text-[#94A3B8]">{l.ip}</span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${l.role === "admin" ? "bg-[#FEF3C7] text-[#92400E]" : "bg-[#EFF6FF] text-[#1D4ED8]"}`}>
                  {l.role === "admin" ? "Admin" : "User"}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
