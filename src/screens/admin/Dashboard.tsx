import { useEffect } from "react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import type { Screen } from "../../App";
import type { UserRole } from "../../lib/auth";
import { canAccess } from "../../lib/permissions";
import type { AdminScreen } from "../../lib/permissions";
import { useUsers } from "../../contexts/UsersContext";
import { fetchDashboardStats, actionLabel, describeActivity, timeAgo, logAdminAction } from "../../lib/admin";
import { downloadCsv, todayStamp } from "../../lib/exportData";
import { Button, Card, Empty, Loadable, PageHeader, RefreshIcon, Stat, useLoader, useToast } from "../../components/admin/ui";

const ROLE_ORDER: UserRole[] = ["superadmin", "admin", "support", "user"];
const ROLE_LABEL: Record<UserRole, string> = { superadmin: "Super Admin", admin: "Admin", support: "Support", user: "User" };

function pct(n: number, of: number) {
  return of > 0 ? Math.round((n / of) * 100) : 0;
}

export default function AdminDashboard({ navigate, role }: { navigate: (s: Screen) => void; role: UserRole }) {
  const { data: s, loading, refreshing, error, reload } = useLoader(fetchDashboardStats);
  const { users, refresh: refreshUsers } = useUsers();
  const toast = useToast();

  useEffect(() => { void refreshUsers(); }, [refreshUsers]);

  const exportUsers = () => {
    if (!users.length) { toast.show("No users to export yet."); return; }
    downloadCsv(`smartbudget-users-${todayStamp()}.csv`, [
      ["Name", "Email", "Role", "Status", "Registered", "Last sign-in"],
      ...users.map((u) => [u.name, u.email, u.role, u.status, u.registeredAt, u.lastLogin]),
    ]);
    void logAdminAction("users_exported", `${users.length} users`);
    toast.show(`Downloaded ${users.length} users`);
  };

  const quickActions: { label: string; desc: string; screen?: AdminScreen; onClick?: () => void; icon: string }[] = ([
    { label: "Manage users", desc: "Search, suspend, reset passwords", screen: "adminUsers", icon: "👥" },
    { label: "Reports", desc: "Usage, finance and learning trends", screen: "adminReports", icon: "📊" },
    { label: "Security Center", desc: "Sign-ins and alerts", screen: "adminSecurity", icon: "🔒" },
    { label: "Activity log", desc: "Every admin action and sign-in", screen: "adminAuditLogs", icon: "📜" },
    { label: "Content", desc: "Hide or feature lessons", screen: "adminContent", icon: "📚" },
    { label: "Site settings", desc: "Maintenance, sign-ups, banner", screen: "adminSystemSettings", icon: "⚙️" },
    { label: "Export users (CSV)", desc: "Name, email, role, status", onClick: exportUsers, icon: "⬇️" },
  ] satisfies { label: string; desc: string; screen?: AdminScreen; onClick?: () => void; icon: string }[]).filter((a) => !("screen" in a) || !a.screen || canAccess(role, a.screen));

  const latest = [...users].sort((a, b) => (b.registeredAt || "").localeCompare(a.registeredAt || "")).slice(0, 5);
  const weekDelta = s ? s.new_users_7d - s.new_users_prev_7d : 0;

  return (
    <div className="max-w-[1200px]">
      {toast.node}
      <PageHeader
        title="Dashboard"
        sub={s ? `Live figures from the database · updated ${timeAgo(s.generated_at)}` : "Live figures from the database"}
        actions={<Button small onClick={reload} disabled={refreshing}><RefreshIcon spinning={refreshing} /> Refresh</Button>}
      />

      <Loadable loading={loading} error={error} onRetry={reload}>
        {s && (
          <div className="space-y-5">
            {/* Headline numbers */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              <Stat label="Total users" value={s.users_total.toLocaleString()} tone="info"
                sub={`${s.new_users_7d} new this week${weekDelta !== 0 ? ` (${weekDelta > 0 ? "+" : ""}${weekDelta} vs last week)` : ""}`}
                onClick={() => navigate("adminUsers")} />
              <Stat label="Active (7 days)" value={s.active_users_7d.toLocaleString()} tone="good"
                sub={`${pct(s.active_users_7d, s.users_total)}% of users signed in`} />
              <Stat label="Transactions (30 days)" value={s.transactions_30d.toLocaleString()}
                sub={`${s.transactions_total.toLocaleString()} recorded in total`} />
              <Stat label="Lessons completed" value={s.lessons_completed.toLocaleString()}
                sub={`${s.lessons_started.toLocaleString()} started`} />
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              <Stat label="Sign-ins (24 h)" value={s.logins_24h} />
              <Stat label="Failed sign-ins (24 h)" value={s.failed_logins_24h} tone={s.failed_logins_24h > 0 ? "warn" : "default"}
                sub={canAccess(role, "adminSecurity") ? "Open Security Center" : undefined}
                onClick={canAccess(role, "adminSecurity") ? () => navigate("adminSecurity") : undefined} />
              <Stat label="Suspended accounts" value={s.users_suspended} tone={s.users_suspended ? "bad" : "default"} />
              <Stat label="Savings goals reached" value={s.goals_completed} sub={`of ${s.goals_total} goals · ${s.budgets_this_month} budgets this month`} />
            </div>

            <div className="grid lg:grid-cols-3 gap-4 sm:gap-5">
              <Card title="Sign-ups and active users" sub="Last 30 days" className="lg:col-span-2">
                <ResponsiveContainer width="100%" height={230}>
                  <AreaChart data={s.signups_by_day.map((d) => ({ ...d, label: new Date(d.day + "T00:00:00").toLocaleDateString("en-AU", { day: "numeric", month: "short" }) }))}>
                    <defs>
                      <linearGradient id="gSign" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#2563EB" stopOpacity={0.25} /><stop offset="95%" stopColor="#2563EB" stopOpacity={0} /></linearGradient>
                      <linearGradient id="gLog" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#10B981" stopOpacity={0.2} /><stop offset="95%" stopColor="#10B981" stopOpacity={0} /></linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                    <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#94A3B8" }} axisLine={false} tickLine={false} interval={4} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: "#94A3B8" }} axisLine={false} tickLine={false} width={28} />
                    <Tooltip contentStyle={{ borderRadius: 10, border: "1px solid #E2E8F0", fontSize: 12 }} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Area type="monotone" dataKey="signups" name="New sign-ups" stroke="#2563EB" strokeWidth={2} fill="url(#gSign)" />
                    <Area type="monotone" dataKey="logins" name="People who signed in" stroke="#10B981" strokeWidth={2} fill="url(#gLog)" />
                  </AreaChart>
                </ResponsiveContainer>
              </Card>

              <Card title="Users by role">
                <ul className="space-y-3">
                  {ROLE_ORDER.map((r) => {
                    const n = s.users_by_role[r] ?? 0;
                    return (
                      <li key={r}>
                        <div className="flex justify-between text-sm"><span className="text-[#475569]">{ROLE_LABEL[r]}</span><span className="font-semibold text-[#0F172A] tabular-nums">{n}</span></div>
                        <div className="h-1.5 bg-[#F1F5F9] rounded-full mt-1 overflow-hidden"><div className="h-full bg-[#2563EB] rounded-full" style={{ width: `${pct(n, s.users_total)}%` }} /></div>
                      </li>
                    );
                  })}
                </ul>
                {canAccess(role, "adminRoles") && (
                  <button type="button" onClick={() => navigate("adminRoles")} className="mt-4 text-xs font-semibold text-[#2563EB] hover:underline">Roles &amp; permissions →</button>
                )}
              </Card>
            </div>

            <div className="grid lg:grid-cols-3 gap-4 sm:gap-5">
              <Card title="Feature adoption" sub="Share of users who have used each feature">
                <ul className="space-y-3">
                  {([
                    ["Transactions", s.feature_adoption.transactions],
                    ["Budgets", s.feature_adoption.budgets],
                    ["Savings goals", s.feature_adoption.goals],
                    ["Lessons", s.feature_adoption.lessons],
                  ] as [string, number][]).map(([label, n]) => (
                    <li key={label}>
                      <div className="flex justify-between text-sm"><span className="text-[#475569]">{label}</span><span className="text-[#0F172A] font-semibold tabular-nums">{pct(n, s.users_total)}% <span className="text-[#94A3B8] font-normal">({n})</span></span></div>
                      <div className="h-1.5 bg-[#F1F5F9] rounded-full mt-1 overflow-hidden"><div className="h-full bg-[#10B981] rounded-full" style={{ width: `${pct(n, s.users_total)}%` }} /></div>
                    </li>
                  ))}
                </ul>
              </Card>

              <Card title="Recent activity" sub="Admin actions, new accounts and failed sign-ins" className="lg:col-span-2"
                actions={canAccess(role, "adminAuditLogs") ? <button type="button" onClick={() => navigate("adminAuditLogs")} className="text-xs font-semibold text-[#2563EB] hover:underline shrink-0">Full log →</button> : undefined}>
                {s.recent_activity.length === 0 ? <Empty>Nothing yet. Activity appears here as people sign up and staff make changes.</Empty> : (
                  <ul className="divide-y divide-[#F1F5F9]">
                    {s.recent_activity.map((a, i) => {
                      const bad = a.action === "login_failed" || a.action === "suspended_login_blocked" || a.action === "user_suspended";
                      return (
                        <li key={i} className="py-2.5 flex items-start gap-3">
                          <span className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${bad ? "bg-[#F59E0B]" : a.kind === "admin" ? "bg-[#7C3AED]" : "bg-[#2563EB]"}`} />
                          <div className="min-w-0 flex-1">
                            <p className="text-sm text-[#0F172A]"><span className="font-medium">{a.who ?? "Someone"}</span> <span className="text-[#475569]">· {actionLabel(a.action)}</span></p>
                            {describeActivity(a) && <p className="text-xs text-[#94A3B8] truncate">{describeActivity(a)}</p>}
                          </div>
                          <span className="text-xs text-[#94A3B8] shrink-0">{timeAgo(a.at)}</span>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </Card>
            </div>

            <div className="grid lg:grid-cols-3 gap-4 sm:gap-5">
              <Card title="Quick actions" className="lg:col-span-2">
                <div className="grid sm:grid-cols-2 gap-2.5">
                  {quickActions.map((a) => (
                    <button key={a.label} type="button" onClick={a.onClick ?? (() => navigate(a.screen!))}
                      className="text-left flex items-start gap-3 p-3.5 rounded-xl border border-[#E2E8F0] hover:border-[#BFDBFE] hover:bg-[#F8FAFC] transition-colors">
                      <span className="text-xl leading-none" aria-hidden="true">{a.icon}</span>
                      <span><span className="block text-sm font-semibold text-[#0F172A]">{a.label}</span><span className="block text-xs text-[#64748B] mt-0.5">{a.desc}</span></span>
                    </button>
                  ))}
                </div>
              </Card>
              <Card title="Newest accounts" actions={<button type="button" onClick={() => navigate("adminUsers")} className="text-xs font-semibold text-[#2563EB] hover:underline">All users →</button>}>
                {latest.length === 0 ? <Empty>No accounts yet.</Empty> : (
                  <ul className="space-y-3">
                    {latest.map((u) => (
                      <li key={u.id} className="flex items-center gap-3">
                        <span className="w-8 h-8 rounded-full bg-[#EFF6FF] text-[#2563EB] font-bold text-sm flex items-center justify-center shrink-0">{(u.name || u.email).charAt(0).toUpperCase()}</span>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-[#0F172A] truncate">{u.name || "No name"}</p>
                          <p className="text-xs text-[#94A3B8] truncate">{u.email}</p>
                        </div>
                        <span className="text-[11px] text-[#94A3B8] shrink-0">{u.registeredAt}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            </div>

            <p className="text-xs text-[#94A3B8] text-center">
              Staff only ever see totals. Individual people's transactions, balances and goals are never shown here.
            </p>
          </div>
        )}
      </Loadable>
    </div>
  );
}
