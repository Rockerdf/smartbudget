import { useState, useEffect } from "react";
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell,
} from "recharts";
import { useUsers } from "../../contexts/UsersContext";
import type { UserRecord } from "../../lib/auth";

// ── Sample platform data (illustrative only: not read from the database) ─ ──────────────────────────────────────────────────────

const userGrowth = [
  { month: "Apr", users: 41, active: 30 },
  { month: "May", users: 58, active: 44 },
  { month: "Jun", users: 74, active: 58 },
  { month: "Jul", users: 93, active: 72 },
  { month: "Aug", users: 112, active: 89 },
  { month: "Sep", users: 134, active: 108 },
];

const aiVolume = [
  { day: "Mon", calls: 142, flagged: 3 },
  { day: "Tue", calls: 198, flagged: 5 },
  { day: "Wed", calls: 176, flagged: 2 },
  { day: "Thu", calls: 231, flagged: 7 },
  { day: "Fri", calls: 289, flagged: 4 },
  { day: "Sat", calls: 94,  flagged: 1 },
  { day: "Sun", calls: 67,  flagged: 0 },
];

const engagementDist = [
  { name: "Expense Tracking", value: 38, color: "#2563EB" },
  { name: "Budget Planner",   value: 24, color: "#10B981" },
  { name: "AI Assistant",     value: 18, color: "#8B5CF6" },
  { name: "Education Hub",    value: 12, color: "#F59E0B" },
  { name: "Savings Goals",    value: 8,  color: "#EC4899" },
];

const lessonCompletions = [
  { week: "Wk 31", completions: 42 },
  { week: "Wk 32", completions: 67 },
  { week: "Wk 33", completions: 58 },
  { week: "Wk 34", completions: 89 },
  { week: "Wk 35", completions: 73 },
];

const recentActivity = [
  { id: 1, type: "user",    icon: "👤", msg: "New registration: sam.o@email.com",               time: "2m ago",   severity: "info" },
  { id: 2, type: "flag",    icon: "🚩", msg: "Prompt injection attempt flagged — jordan.w",     time: "18m ago",  severity: "warning" },
  { id: 3, type: "content", icon: "📖", msg: "Lesson 'Understanding Inflation' published",       time: "1h ago",   severity: "info" },
  { id: 4, type: "security",icon: "🔒", msg: "Failed admin login — IP 103.21.244.0 blocked",    time: "2h ago",   severity: "danger" },
  { id: 5, type: "ai",      icon: "🤖", msg: "AI boundary held — prescriptive request deflected",time: "3h ago",  severity: "success" },
  { id: 6, type: "user",    icon: "👤", msg: "Account suspended: riley.s (AI misuse policy)",   time: "5h ago",   severity: "warning" },
];

// 7-day system load (0–100)
const systemLoad = [62, 74, 58, 81, 77, 45, 69];
const loadDays   = ["M", "T", "W", "T", "F", "S", "S"];


// ── Sub-components ────────────────────────────────────────────────────────────

function SectionHeader({ title, sub }: { title: string; sub: string }) {
  return (
    <div className="mb-4">
      <h2 className="font-bold text-[#0F172A]">{title}</h2>
      <p className="text-xs text-[#94A3B8] mt-0.5">{sub}</p>
    </div>
  );
}

const severityStyle = {
  info:    { dot: "bg-[#2563EB]", bg: "" },
  success: { dot: "bg-[#10B981]", bg: "" },
  warning: { dot: "bg-[#F59E0B]", bg: "bg-[#FFFBEB]" },
  danger:  { dot: "bg-[#EF4444]", bg: "bg-[#FFF5F5]" },
};

// ── Premium KPI card ──────────────────────────────────────────────────────────

function PremiumKpiCard({
  label, value, delta, up, sub, color, icon,
}: {
  label: string; value: string; delta: string; up: boolean; sub: string;
  color: string; icon: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-2xl p-5 border border-[#E2E8F0] shadow-sm hover:shadow-md transition-shadow flex flex-col gap-3">
      <div className="flex items-start justify-between">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
          style={{ backgroundColor: color + "1A" }}
        >
          <span style={{ color }}>{icon}</span>
        </div>
        <span
          className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
            up ? "bg-[#ECFDF5] text-[#059669]" : "bg-[#FEF2F2] text-[#DC2626]"
          }`}
        >
          {delta ? `${up ? "▲" : "▼"} ${delta}` : "Live"}
        </span>
      </div>
      <div>
        <p className="text-[28px] font-bold text-[#0F172A] font-mono leading-none tracking-tight">
          {value}
        </p>
        <p className="text-xs font-semibold text-[#64748B] mt-1 uppercase tracking-wide">{label}</p>
      </div>
      <p className="text-[11px] text-[#94A3B8]">{sub}</p>
    </div>
  );
}

// ── Role badge ────────────────────────────────────────────────────────────────

const ROLE_COLORS: Record<string, { bg: string; text: string }> = {
  superadmin: { bg: "#FEF3C7", text: "#92400E" },
  admin:      { bg: "#EDE9FE", text: "#5B21B6" },
  support:    { bg: "#DBEAFE", text: "#1E40AF" },
  user:       { bg: "#F1F5F9", text: "#475569" },
};

function RoleBadge({ role }: { role: string }) {
  const c = ROLE_COLORS[role] ?? ROLE_COLORS.user;
  return (
    <span
      style={{ backgroundColor: c.bg, color: c.text }}
      className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide whitespace-nowrap"
    >
      {role}
    </span>
  );
}

// ── Toast ─────────────────────────────────────────────────────────────────────

function Toast({ message, onDone }: { message: string; onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 3000);
    return () => clearTimeout(t);
  }, [onDone]);
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-[#0F172A] text-white text-sm font-medium px-5 py-3 rounded-2xl shadow-xl border border-white/10 flex items-center gap-2.5 animate-[fadeInUp_0.2s_ease]">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#60A5FA" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
      </svg>
      {message}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function AdminDashboard() {
  const [toast, setToast] = useState<string | null>(null);

  const now  = new Date();
  const time = now.toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit" });
  const today = now.toLocaleDateString("en-AU", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  const { users: registeredUsers, refresh } = useUsers();
  useEffect(() => { void refresh(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const totalUsers    = registeredUsers.length;
  const activeUsers   = registeredUsers.filter((u) => u.status !== "suspended").length;
  const thisMonth     = now.toISOString().slice(0, 7);
  const newThisMonth  = registeredUsers.filter((u) => u.registeredAt?.startsWith(thisMonth)).length;

  const suspendedUsers = registeredUsers.filter((u) => u.status === "suspended").length;
  const staffUsers     = registeredUsers.filter((u) => u.role !== "user").length;

  // Recent users table — read from real registered users only
  const recentUsers: UserRecord[] = [...registeredUsers]
    .sort((a, b) => (b.registeredAt ?? "").localeCompare(a.registeredAt ?? ""))
    .slice(0, 5);

  const showToast = (label: string) => setToast(`Navigate to ${label} from the sidebar`);

  const maxLoad = Math.max(...systemLoad);

  return (
    <div className="space-y-6">

      {/* ── Blue accent banner ─────────────────────────────────────────────────── */}
      <div
        className="rounded-2xl px-6 py-4 flex items-center justify-between"
        style={{ background: "linear-gradient(135deg, #1E3A8A 0%, #2563EB 60%, #3B82F6 100%)" }}
      >
        <div>
          <h1 className="text-white font-bold text-lg tracking-tight">Admin Command Center</h1>
          <p className="text-blue-200 text-xs mt-0.5">{today}</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right hidden sm:block">
            <p className="text-xs text-blue-200">Last updated</p>
            <p className="text-white font-mono text-sm font-semibold">{time}</p>
          </div>
        </div>
      </div>

      {/* ── KPI stat cards ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <PremiumKpiCard
          label="Total Users"
          value={String(totalUsers)}
          delta={`+${newThisMonth} this month`}
          up
          sub="Registered accounts all time"
          color="#2563EB"
          icon={
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
            </svg>
          }
        />
        <PremiumKpiCard
          label="Active Today"
          value={String(activeUsers)}
          delta={totalUsers > 0 ? `${Math.round(activeUsers / totalUsers * 100)}% of total` : "0%"}
          up
          sub="Non-suspended accounts"
          color="#10B981"
          icon={
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
            </svg>
          }
        />
        <PremiumKpiCard
          label="Suspended Accounts"
          value={String(suspendedUsers)}
          delta=""
          up
          sub="Currently blocked from signing in"
          color="#8B5CF6"
          icon={
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
            </svg>
          }
        />
        <PremiumKpiCard
          label="Staff Accounts"
          value={String(staffUsers)}
          delta=""
          up
          sub="Support, admin and superadmin roles"
          color="#F59E0B"
          icon={
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2l9 4v6c0 5.25-3.75 10.14-9 11.5C6.75 22.14 3 17.25 3 12V6l9-4z"/>
            </svg>
          }
        />
      </div>

      {/* ── System Overview + Quick Actions row ───────────────────────────────── */}
      <div className="grid lg:grid-cols-2 gap-5">

        {/* System Overview sparkline */}
        <div className="bg-white rounded-2xl p-5 border border-[#E2E8F0] shadow-sm">
          <SectionHeader title="System Overview" sub="Sample data — System load — last 7 days (%)" />
          <div className="flex items-end gap-2 h-24 mt-2">
            {systemLoad.map((v, i) => {
              const pct = (v / maxLoad) * 100;
              const barColor = v > 80 ? "#EF4444" : v > 65 ? "#F59E0B" : "#2563EB";
              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-1.5">
                  <div className="w-full flex items-end justify-center" style={{ height: 72 }}>
                    <div
                      className="w-full rounded-t-md transition-all"
                      style={{ height: `${pct}%`, backgroundColor: barColor, opacity: 0.85 }}
                    />
                  </div>
                  <span className="text-[10px] text-[#94A3B8]">{loadDays[i]}</span>
                </div>
              );
            })}
          </div>
          <div className="flex items-center gap-4 mt-4 pt-3 border-t border-[#F1F5F9]">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-[#2563EB] inline-block" />
              <span className="text-[11px] text-[#64748B]">Normal (&lt;65%)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-[#F59E0B] inline-block" />
              <span className="text-[11px] text-[#64748B]">Elevated</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-[#EF4444] inline-block" />
              <span className="text-[11px] text-[#64748B]">High (&gt;80%)</span>
            </div>
          </div>
        </div>

        {/* Quick action tiles */}
        <div className="bg-white rounded-2xl p-5 border border-[#E2E8F0] shadow-sm">
          <SectionHeader title="Quick Actions" sub="Jump to a management section" />
          <div className="grid grid-cols-2 gap-3">
            {[
              {
                label: "Manage Users", target: "adminUsers", color: "#2563EB", bg: "#EFF6FF",
                icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
              },
              {
                label: "View Reports", target: "adminReports", color: "#8B5CF6", bg: "#FAF5FF",
                icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>,
              },
              {
                label: "Security Center", target: "adminSecurity", color: "#EF4444", bg: "#FEF2F2",
                icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>,
              },
              {
                label: "System Settings", target: "adminSystemSettings", color: "#10B981", bg: "#ECFDF5",
                icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.07 4.93l-1.41 1.41M4.93 4.93l1.41 1.41M20 12h2M2 12h2M19.07 19.07l-1.41-1.41M4.93 19.07l1.41-1.41M12 20v2M12 2v2"/></svg>,
              },
            ].map((a) => (
              <button
                key={a.target}
                onClick={() => showToast(a.label)}
                className="flex flex-col items-start gap-3 p-4 rounded-xl border border-[#E2E8F0] hover:border-transparent hover:shadow-md transition-all group text-left"
                style={{ "--hover-bg": a.bg } as React.CSSProperties}
              >
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-colors"
                  style={{ backgroundColor: a.bg, color: a.color }}
                >
                  {a.icon}
                </div>
                <span className="text-sm font-semibold text-[#0F172A] leading-tight">{a.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Recent User Activity table ─────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-[#E2E8F0] shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-[#F1F5F9] flex items-center justify-between">
          <div>
            <h2 className="font-bold text-[#0F172A]">Recent User Activity</h2>
            <p className="text-xs text-[#94A3B8] mt-0.5">Last 5 registered users</p>
          </div>
          <span className="text-xs text-[#94A3B8]">Showing {recentUsers.length} users</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#F1F5F9]">
                {["Name", "Email", "Role", "Registered", "Status"].map((h) => (
                  <th key={h} className="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-[#94A3B8]">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F8FAFC]">
              {recentUsers.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-5 py-10 text-center text-[#94A3B8] text-sm">
                    No users registered yet. Users will appear here once they create accounts.
                  </td>
                </tr>
              )}
              {recentUsers.map((u, idx) => {
                const isToday = u.registeredAt === new Date().toISOString().slice(0, 10);
                return (
                  <tr key={u.email + idx} className="hover:bg-[#F8FAFC] transition-colors">
                    <td className="px-5 py-3.5 font-semibold text-[#0F172A]">
                      <div className="flex items-center gap-2.5">
                        <div
                          className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 text-white"
                          style={{ backgroundColor: ["#2563EB","#10B981","#8B5CF6","#F59E0B","#EC4899"][idx % 5] }}
                        >
                          {u.name.charAt(0).toUpperCase()}
                        </div>
                        {u.name}
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-[#64748B]">{u.email}</td>
                    <td className="px-5 py-3.5"><RoleBadge role={u.role} /></td>
                    <td className="px-5 py-3.5 text-[#64748B] font-mono text-xs">
                      {isToday ? <span className="text-[#2563EB] font-semibold">Today</span> : u.registeredAt}
                    </td>
                    <td className="px-5 py-3.5">
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide ${
                          u.status === "suspended"
                            ? "bg-[#FEF2F2] text-[#DC2626]"
                            : "bg-[#ECFDF5] text-[#059669]"
                        }`}
                      >
                        {u.status === "suspended" ? "Inactive" : "Active"}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Charts row 1 ──────────────────────────────────────────────────────── */}
      <div className="grid lg:grid-cols-3 gap-5">

        {/* User growth */}
        <div className="lg:col-span-2 bg-white rounded-2xl p-5 border border-[#E2E8F0] shadow-sm">
          <SectionHeader title="User Growth" sub="Sample data — Total vs active users — last 6 months" />
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={userGrowth} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="totalGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#2563EB" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#2563EB" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="activeGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#10B981" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#94A3B8" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "#94A3B8" }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ borderRadius: 12, border: "1px solid #E2E8F0", fontSize: 12 }}
                formatter={(v: unknown) => [String(v), ""]}
              />
              <Area type="monotone" dataKey="users"  stroke="#2563EB" strokeWidth={2} fill="url(#totalGrad)"  name="Total" />
              <Area type="monotone" dataKey="active" stroke="#10B981" strokeWidth={2} fill="url(#activeGrad)" name="Active" />
            </AreaChart>
          </ResponsiveContainer>
          <div className="flex gap-4 mt-2">
            <div className="flex items-center gap-1.5"><span className="w-3 h-0.5 bg-[#2563EB] inline-block rounded" /><span className="text-xs text-[#64748B]">Total</span></div>
            <div className="flex items-center gap-1.5"><span className="w-3 h-0.5 bg-[#10B981] inline-block rounded" /><span className="text-xs text-[#64748B]">Active</span></div>
          </div>
        </div>

        {/* Feature engagement */}
        <div className="bg-white rounded-2xl p-5 border border-[#E2E8F0] shadow-sm">
          <SectionHeader title="Feature Usage" sub="Sample data — By percentage of sessions" />
          <ResponsiveContainer width="100%" height={140}>
            <PieChart>
              <Pie
                data={engagementDist}
                cx="50%" cy="50%"
                innerRadius={42} outerRadius={62}
                paddingAngle={3}
                dataKey="value"
              >
                {engagementDist.map((d, i) => (
                  <Cell key={i} fill={d.color} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{ borderRadius: 12, border: "1px solid #E2E8F0", fontSize: 11 }}
                formatter={(v: unknown) => [`${String(v)}%`, ""]}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="space-y-1.5 mt-1">
            {engagementDist.map((d) => (
              <div key={d.name} className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: d.color }} />
                  <span className="text-xs text-[#64748B]">{d.name}</span>
                </div>
                <span className="text-xs font-semibold text-[#0F172A]">{d.value}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Charts row 2 ──────────────────────────────────────────────────────── */}
      <div className="grid lg:grid-cols-2 gap-5">

        {/* AI call volume */}
        <div className="bg-white rounded-2xl p-5 border border-[#E2E8F0] shadow-sm">
          <SectionHeader title="AI Call Volume" sub="Sample data — This week — calls vs flagged" />
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={aiVolume} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
              <XAxis dataKey="day" tick={{ fontSize: 11, fill: "#94A3B8" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "#94A3B8" }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ borderRadius: 12, border: "1px solid #E2E8F0", fontSize: 12 }}
                formatter={(v: unknown) => [String(v), ""]}
              />
              <Bar dataKey="calls"   fill="#8B5CF6" radius={[4, 4, 0, 0]} name="Total calls" />
              <Bar dataKey="flagged" fill="#FCA5A5" radius={[4, 4, 0, 0]} name="Flagged" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Lesson completions */}
        <div className="bg-white rounded-2xl p-5 border border-[#E2E8F0] shadow-sm">
          <SectionHeader title="Education Completions" sub="Sample data — Lessons completed per week" />
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={lessonCompletions} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
              <XAxis dataKey="week" tick={{ fontSize: 11, fill: "#94A3B8" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "#94A3B8" }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ borderRadius: 12, border: "1px solid #E2E8F0", fontSize: 12 }}
                formatter={(v: unknown) => [String(v), "completions"]}
              />
              <Line type="monotone" dataKey="completions" stroke="#F59E0B" strokeWidth={2.5} dot={{ fill: "#F59E0B", r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── Recent activity feed ──────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-[#E2E8F0] shadow-sm">
        <div className="px-5 py-4 border-b border-[#F1F5F9] flex items-center justify-between">
          <div>
            <h2 className="font-bold text-[#0F172A]">Recent Activity</h2>
            <p className="text-xs text-[#94A3B8] mt-0.5">Sample data — illustrative events, not live</p>
          </div>
          <span className="text-xs text-[#94A3B8]">Showing latest 6</span>
        </div>
        <div className="divide-y divide-[#F8FAFC]">
          {recentActivity.map((a) => {
            const s = severityStyle[a.severity as keyof typeof severityStyle];
            return (
              <div key={a.id} className={`flex items-start gap-3 px-5 py-3.5 ${s.bg}`}>
                <span className="text-lg leading-none mt-0.5">{a.icon}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-[#0F172A] leading-snug">{a.msg}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className={`w-2 h-2 rounded-full shrink-0 ${s.dot}`} />
                  <span className="text-xs text-[#94A3B8] whitespace-nowrap">{a.time}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Quick stats strip ─────────────────────────────────────────────────── */}
      <p className="text-xs text-[#94A3B8] -mb-2">Sample figures below — illustrative only.</p>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Lessons published",    value: "12",   icon: "📚", color: "#F59E0B", bg: "#FFFBEB" },
          { label: "Avg. session length",  value: "8.4m", icon: "⏱",  color: "#2563EB", bg: "#EFF6FF" },
          { label: "AI refusals today",    value: "11",   icon: "🛡️", color: "#10B981", bg: "#ECFDF5" },
          { label: "Pending content",      value: "3",    icon: "📝",  color: "#8B5CF6", bg: "#FAF5FF" },
        ].map((s) => (
          <div key={s.label} className="bg-white rounded-2xl p-4 border border-[#E2E8F0] shadow-sm flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0" style={{ backgroundColor: s.bg }}>
              {s.icon}
            </div>
            <div>
              <p className="text-lg font-bold text-[#0F172A] font-mono">{s.value}</p>
              <p className="text-xs text-[#94A3B8]">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Disclaimer */}
      <p className="text-[10px] text-[#94A3B8] text-center pb-2">
        All metrics are prototype data for educational purposes. No real user financial information is displayed here.
      </p>

      {/* Toast notification */}
      {toast && <Toast message={toast} onDone={() => setToast(null)} />}
    </div>
  );
}
