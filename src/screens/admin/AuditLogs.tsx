import { useState } from "react";
import AIAssistant from "../../components/AIAssistant";

type LogEntry = {
  id: number;
  ts: string;
  actor: string;
  role: "admin" | "user";
  action: string;
  target: string;
  ip: string;
  category: "auth" | "user" | "content" | "settings" | "ai" | "data";
  severity: "info" | "warning" | "critical";
};

const ALL_LOGS: LogEntry[] = [
  { id:  1, ts: "2026-09-22 23:41", actor: "system",              role: "admin", action: "IP Blocked",          target: "103.21.244.0",            ip: "—",              category: "auth",     severity: "critical" },
  { id:  2, ts: "2026-09-22 22:10", actor: "admin@smartbudget.com", role: "admin", action: "Admin Login",        target: "Session created",         ip: "185.220.101.14", category: "auth",     severity: "info"     },
  { id:  3, ts: "2026-09-22 21:55", actor: "admin@smartbudget.com", role: "admin", action: "User Suspended",     target: "riley.s@email.com",       ip: "185.220.101.14", category: "user",     severity: "warning"  },
  { id:  4, ts: "2026-09-22 21:30", actor: "admin@smartbudget.com", role: "admin", action: "Role Updated",       target: "Editor → casey.n",        ip: "185.220.101.14", category: "user",     severity: "info"     },
  { id:  5, ts: "2026-09-22 20:44", actor: "morgan.l@email.com",  role: "user",  action: "User Login",          target: "Session created",         ip: "141.101.72.55",  category: "auth",     severity: "info"     },
  { id:  6, ts: "2026-09-22 20:10", actor: "admin@smartbudget.com", role: "admin", action: "Content Published",  target: "Lesson: Compound Interest",ip: "185.220.101.14", category: "content",  severity: "info"     },
  { id:  7, ts: "2026-09-22 19:05", actor: "system",              role: "admin", action: "IP Blocked",          target: "45.142.212.10",           ip: "—",              category: "auth",     severity: "critical" },
  { id:  8, ts: "2026-09-22 18:30", actor: "sam.o@email.com",     role: "user",  action: "User Login",          target: "Session created",         ip: "46.101.44.88",   category: "auth",     severity: "info"     },
  { id:  9, ts: "2026-09-22 17:45", actor: "admin@smartbudget.com", role: "admin", action: "Settings Updated",   target: "AI rate limit → 100",     ip: "185.220.101.14", category: "settings", severity: "warning"  },
  { id: 10, ts: "2026-09-22 16:55", actor: "casey.n@email.com",   role: "user",  action: "User Login",          target: "Session created",         ip: "37.120.10.201",  category: "auth",     severity: "info"     },
  { id: 11, ts: "2026-09-22 16:00", actor: "morgan.l@email.com",  role: "user",  action: "AI Chat",             target: "38 messages sent",        ip: "141.101.72.55",  category: "ai",       severity: "info"     },
  { id: 12, ts: "2026-09-22 15:30", actor: "admin@smartbudget.com", role: "admin", action: "User Deleted",       target: "old_test@example.com",    ip: "185.220.101.14", category: "user",     severity: "warning"  },
  { id: 13, ts: "2026-09-22 15:02", actor: "jamie.c@email.com",   role: "user",  action: "User Login",          target: "Session created",         ip: "82.44.112.55",   category: "auth",     severity: "info"     },
  { id: 14, ts: "2026-09-22 14:20", actor: "jordan.w@email.com",  role: "user",  action: "AI Flag Triggered",   target: "Jailbreak prompt detected",ip: "91.240.118.61",  category: "ai",       severity: "critical" },
  { id: 15, ts: "2026-09-22 13:45", actor: "admin@smartbudget.com", role: "admin", action: "Backup Created",     target: "Full DB snapshot",        ip: "185.220.101.14", category: "data",     severity: "info"     },
  { id: 16, ts: "2026-09-22 12:18", actor: "morgan.l@email.com",  role: "user",  action: "User Login",          target: "Session created",         ip: "141.101.72.55",  category: "auth",     severity: "info"     },
  { id: 17, ts: "2026-09-22 11:00", actor: "admin@smartbudget.com", role: "admin", action: "Content Created",    target: "Draft: Emergency Savings", ip: "185.220.101.14", category: "content",  severity: "info"     },
  { id: 18, ts: "2026-09-22 09:30", actor: "system",              role: "admin", action: "Scheduled Backup",    target: "Nightly snapshot",        ip: "—",              category: "data",     severity: "info"     },
  { id: 19, ts: "2026-09-21 22:10", actor: "sam.o@email.com",     role: "user",  action: "Savings Goal Created","target": "Goal: Holiday Fund",    ip: "46.101.44.88",   category: "data",     severity: "info"     },
  { id: 20, ts: "2026-09-21 14:33", actor: "system",              role: "admin", action: "Failed Login",        target: "admin@smartbudget.com",   ip: "185.220.101.14", category: "auth",     severity: "warning"  },
];

const CATEGORIES = ["all", "auth", "user", "content", "settings", "ai", "data"] as const;
const SEVERITIES = ["all", "info", "warning", "critical"] as const;

const catStyle: Record<string, { label: string; color: string; bg: string }> = {
  auth:     { label: "Auth",     color: "#1D4ED8", bg: "#EFF6FF" },
  user:     { label: "User",     color: "#065F46", bg: "#D1FAE5" },
  content:  { label: "Content",  color: "#6B21A8", bg: "#FAF5FF" },
  settings: { label: "Settings", color: "#92400E", bg: "#FEF3C7" },
  ai:       { label: "AI",       color: "#0891B2", bg: "#ECFEFF" },
  data:     { label: "Data",     color: "#475569", bg: "#F1F5F9" },
};

const sevStyle: Record<string, { label: string; color: string; bg: string; dot: string }> = {
  info:     { label: "Info",     color: "#1D4ED8", bg: "#EFF6FF", dot: "bg-[#60A5FA]" },
  warning:  { label: "Warning",  color: "#92400E", bg: "#FEF3C7", dot: "bg-[#F59E0B]" },
  critical: { label: "Critical", color: "#991B1B", bg: "#FEE2E2", dot: "bg-[#EF4444]" },
};

function exportCSV(logs: LogEntry[]) {
  const header = "ID,Timestamp,Actor,Role,Action,Target,IP,Category,Severity\n";
  const rows = logs.map((l) =>
    [l.id, l.ts, l.actor, l.role, `"${l.action}"`, `"${l.target}"`, l.ip, l.category, l.severity].join(",")
  ).join("\n");
  const blob = new Blob([header + rows], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = "audit-logs.csv"; a.click();
  URL.revokeObjectURL(url);
}

export default function AdminAuditLogs() {
  const [categoryFilter, setCategoryFilter] = useState<typeof CATEGORIES[number]>("all");
  const [severityFilter, setSeverityFilter] = useState<typeof SEVERITIES[number]>("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const PER_PAGE = 10;

  const filtered = ALL_LOGS.filter((l) => {
    if (categoryFilter !== "all" && l.category !== categoryFilter) return false;
    if (severityFilter !== "all" && l.severity !== severityFilter) return false;
    if (search && ![l.actor, l.action, l.target, l.ip].some((f) => f.toLowerCase().includes(search.toLowerCase()))) return false;
    return true;
  });

  const totalPages = Math.ceil(filtered.length / PER_PAGE);
  const pageData = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  const critCount = ALL_LOGS.filter((l) => l.severity === "critical").length;
  const warnCount = ALL_LOGS.filter((l) => l.severity === "warning").length;

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-[#0F172A]">Audit Logs</h1>
          <p className="text-sm text-[#64748B] mt-1">Full history of all system, admin, and user actions.</p>
        </div>
        <button onClick={() => exportCSV(filtered)}
          className="flex items-center gap-2 text-sm font-semibold text-[#2563EB] border border-[#BFDBFE] bg-[#EFF6FF] px-4 py-2.5 rounded-xl hover:bg-[#DBEAFE] transition-colors">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
          Export CSV
        </button>
      </div>

      {/* Summary strip */}
      <div className="grid grid-cols-3 sm:grid-cols-4 gap-4 mb-6">
        {[
          { label: "Total Events",    value: ALL_LOGS.length, color: "#0F172A" },
          { label: "Critical",        value: critCount,       color: "#EF4444" },
          { label: "Warnings",        value: warnCount,       color: "#F59E0B" },
          { label: "Last 24 h",       value: ALL_LOGS.filter((l) => l.ts.startsWith("2026-09-22")).length, color: "#2563EB" },
        ].map((s) => (
          <div key={s.label} className="bg-white rounded-2xl border border-[#E2E8F0] p-4">
            <p className="text-xs text-[#64748B]">{s.label}</p>
            <p className="text-2xl font-bold mt-1" style={{ color: s.color }}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-[#E2E8F0] p-4 mb-4 flex flex-wrap gap-3 items-center">
        <input
          value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          placeholder="Search actor, action, target, IP…"
          className="flex-1 min-w-[180px] border border-[#E2E8F0] rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
        />
        <div className="flex gap-1 bg-[#F1F5F9] rounded-xl p-1">
          {CATEGORIES.map((c) => (
            <button key={c} onClick={() => { setCategoryFilter(c); setPage(1); }}
              className={`text-xs font-medium px-3 py-1.5 rounded-lg capitalize transition-colors ${categoryFilter === c ? "bg-white text-[#0F172A] shadow-sm" : "text-[#64748B] hover:text-[#0F172A]"}`}>
              {c}
            </button>
          ))}
        </div>
        <div className="flex gap-1 bg-[#F1F5F9] rounded-xl p-1">
          {SEVERITIES.map((s) => (
            <button key={s} onClick={() => { setSeverityFilter(s); setPage(1); }}
              className={`text-xs font-medium px-3 py-1.5 rounded-lg capitalize transition-colors ${severityFilter === s ? "bg-white text-[#0F172A] shadow-sm" : "text-[#64748B] hover:text-[#0F172A]"}`}>
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-[#E2E8F0] overflow-hidden">
        <div className="grid grid-cols-[140px_1fr_160px_120px_90px_80px] gap-3 px-5 py-3 bg-[#F8FAFC] text-xs font-semibold text-[#64748B] uppercase tracking-wide">
          <span>Timestamp</span><span>Actor</span><span>Action</span><span>Target</span><span>Category</span><span>Severity</span>
        </div>

        {pageData.length === 0
          ? <p className="text-sm text-[#94A3B8] text-center py-12">No log entries match the current filters.</p>
          : (
            <div className="divide-y divide-[#F8FAFC]">
              {pageData.map((l) => {
                const cat = catStyle[l.category];
                const sev = sevStyle[l.severity];
                return (
                  <div key={l.id} className={`grid grid-cols-[140px_1fr_160px_120px_90px_80px] gap-3 px-5 py-3.5 items-center ${l.severity === "critical" ? "bg-[#FFF5F5]" : "hover:bg-[#FAFAFA]"}`}>
                    <span className="text-xs font-mono text-[#64748B] leading-tight">{l.ts}</span>
                    <div className="min-w-0">
                      <p className="text-sm text-[#0F172A] font-medium truncate">{l.actor}</p>
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${l.role === "admin" ? "bg-[#FEF3C7] text-[#92400E]" : "bg-[#EFF6FF] text-[#1D4ED8]"}`}>
                        {l.role}
                      </span>
                    </div>
                    <span className="text-sm text-[#0F172A] font-medium truncate">{l.action}</span>
                    <span className="text-xs text-[#64748B] truncate">{l.target}</span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full w-fit" style={{ backgroundColor: cat.bg, color: cat.color }}>{cat.label}</span>
                    <div className="flex items-center gap-1.5">
                      <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${sev.dot}`} />
                      <span className="text-[10px] font-bold" style={{ color: sev.color }}>{sev.label}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-[#F1F5F9]">
            <p className="text-xs text-[#94A3B8]">
              Showing {(page - 1) * PER_PAGE + 1}–{Math.min(page * PER_PAGE, filtered.length)} of {filtered.length}
            </p>
            <div className="flex gap-1">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
                className="text-xs font-medium px-3 py-1.5 border border-[#E2E8F0] rounded-lg disabled:opacity-40 hover:bg-[#F8FAFC] transition-colors">
                Prev
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
                <button key={n} onClick={() => setPage(n)}
                  className={`text-xs font-medium w-8 h-8 rounded-lg transition-colors ${n === page ? "bg-[#2563EB] text-white" : "border border-[#E2E8F0] hover:bg-[#F8FAFC]"}`}>
                  {n}
                </button>
              ))}
              <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                className="text-xs font-medium px-3 py-1.5 border border-[#E2E8F0] rounded-lg disabled:opacity-40 hover:bg-[#F8FAFC] transition-colors">
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      <AIAssistant
        context="admin-audit"
        assistantName="Audit Log Assistant"
        accentColor="#0F172A"
        admin
        contextData={{ auditCount: ALL_LOGS.length }}
      />
    </div>
  );
}
