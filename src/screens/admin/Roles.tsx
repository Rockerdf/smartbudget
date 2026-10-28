import { useEffect, useState } from "react";
import type { Screen } from "../../App";
import type { UserRole } from "../../lib/auth";
import { ALL_ADMIN_SCREENS, ROLE_META, SCREEN_PERMISSIONS, USER_PAGE_PERMISSIONS } from "../../lib/permissions";
import type { AdminScreen, UserPageAction } from "../../lib/permissions";
import { useUsers } from "../../contexts/UsersContext";
import { Card, Empty, Loadable, PageHeader, TableWrap, td, th } from "../../components/admin/ui";

const ROLES: UserRole[] = ["superadmin", "admin", "support", "user"];

const ROLE_DESC: Record<UserRole, string> = {
  superadmin: "Full control: everything an Admin can do, plus changing roles, site settings and content.",
  admin: "Runs the platform day to day: manages users, reviews security and the activity log.",
  support: "Helps people: can look up accounts, send password resets and view reports.",
  user: "A regular SmartBudget member. Uses the app; no access to the admin panel.",
};

const SCREEN_LABEL: Record<AdminScreen, string> = {
  adminDashboard: "Admin dashboard", adminAgent: "AI agent (staff tools)", adminUsers: "View users", adminRoles: "Roles & permissions",
  adminReports: "Reports", adminContent: "Content (hide/feature)", adminSecurity: "Security Center",
  adminAuditLogs: "Activity log", adminSystemSettings: "Site settings",
};

const ACTION_LABEL: Record<UserPageAction, string> = {
  view: "View accounts", edit: "Edit accounts", suspend: "Suspend users", activate: "Reactivate users",
  resetPassword: "Send password resets", changeRole: "Change roles",
};

// These rules are also enforced by the database functions, so the table is a
// true description of what each role can do, not just what the screens show.
const DB_RULES: { label: string; roles: UserRole[] }[] = [
  { label: "Can only see and change their own budget, transactions and goals", roles: ["user", "support", "admin", "superadmin"] },
  { label: "Suspend or reactivate other admins / super admins", roles: ["superadmin"] },
  { label: "Cannot change their own role or suspend themselves", roles: ["support", "admin", "superadmin"] },
  { label: "The last Super Admin can never be removed", roles: ["superadmin"] },
];

function Tick({ on }: { on: boolean }) {
  return on
    ? <span className="inline-flex w-6 h-6 rounded-full bg-[#DCFCE7] text-[#16A34A] items-center justify-center" aria-label="Allowed">✓</span>
    : <span className="inline-flex w-6 h-6 rounded-full bg-[#F1F5F9] text-[#CBD5E1] items-center justify-center" aria-label="Not allowed">–</span>;
}

export default function AdminRoles({ navigate }: { navigate: (s: Screen) => void }) {
  const { users, loading, error, refresh } = useUsers();
  const [selected, setSelected] = useState<UserRole>("admin");
  useEffect(() => { void refresh(); }, [refresh]);

  const members = users.filter((u) => u.role === selected);

  return (
    <div className="max-w-[1200px]">
      <PageHeader title="Roles & Permissions"
        sub="What each role can do. These rules are enforced by the database, not just hidden in the app. To give someone a different role, open Users." />
      <Loadable loading={loading && !users.length} error={error} onRetry={() => void refresh()}>
        <div className="space-y-5">
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            {ROLES.map((r) => {
              const m = ROLE_META[r];
              const n = users.filter((u) => u.role === r).length;
              return (
                <button key={r} type="button" onClick={() => setSelected(r)} aria-pressed={selected === r}
                  className={`text-left bg-white rounded-2xl border p-4 transition-all ${selected === r ? "border-[#2563EB] ring-2 ring-[#DBEAFE]" : "border-[#E2E8F0] hover:border-[#BFDBFE]"}`}>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide" style={{ backgroundColor: m.bg, color: m.text }}>{m.label}</span>
                  <p className="text-2xl font-bold font-mono text-[#0F172A] mt-2">{n}</p>
                  <p className="text-xs text-[#64748B] mt-1 leading-relaxed">{ROLE_DESC[r]}</p>
                </button>
              );
            })}
          </div>

          <div className="grid lg:grid-cols-3 gap-4 sm:gap-5">
            <Card title="Permission matrix" className="lg:col-span-2">
              <TableWrap>
                <thead><tr><th className={th}>Permission</th>{ROLES.map((r) => <th key={r} className={`${th} text-center`}>{ROLE_META[r].label}</th>)}</tr></thead>
                <tbody>
                  <tr><td colSpan={5} className="pt-3 pb-1 text-[11px] font-bold uppercase tracking-wide text-[#94A3B8]">Admin panel pages</td></tr>
                  {ALL_ADMIN_SCREENS.map((sc) => (
                    <tr key={sc}><td className={`${td} text-[#0F172A]`}>{SCREEN_LABEL[sc]}</td>
                      {ROLES.map((r) => <td key={r} className={`${td} text-center`}><Tick on={SCREEN_PERMISSIONS[sc].includes(r)} /></td>)}</tr>
                  ))}
                  <tr><td colSpan={5} className="pt-4 pb-1 text-[11px] font-bold uppercase tracking-wide text-[#94A3B8]">Account actions</td></tr>
                  {(Object.keys(ACTION_LABEL) as UserPageAction[]).map((a) => (
                    <tr key={a}><td className={`${td} text-[#0F172A]`}>{ACTION_LABEL[a]}</td>
                      {ROLES.map((r) => <td key={r} className={`${td} text-center`}><Tick on={USER_PAGE_PERMISSIONS[r].includes(a)} /></td>)}</tr>
                  ))}
                  <tr><td colSpan={5} className="pt-4 pb-1 text-[11px] font-bold uppercase tracking-wide text-[#94A3B8]">Database safety rules</td></tr>
                  {DB_RULES.map((rule) => (
                    <tr key={rule.label}><td className={`${td} text-[#0F172A]`}>{rule.label}</td>
                      {ROLES.map((r) => <td key={r} className={`${td} text-center`}><Tick on={rule.roles.includes(r)} /></td>)}</tr>
                  ))}
                </tbody>
              </TableWrap>
            </Card>

            <Card title={`${ROLE_META[selected].label}s (${members.length})`} sub="Pick a role above to see who has it."
              actions={<button type="button" onClick={() => navigate("adminUsers")} className="text-xs font-semibold text-[#2563EB] hover:underline shrink-0">Change roles →</button>}>
              {members.length === 0 ? <Empty>No one has this role.</Empty> : (
                <ul className="space-y-2.5 max-h-[460px] overflow-y-auto">
                  {members.map((u) => (
                    <li key={u.id} className="flex items-center gap-3">
                      <span className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0"
                        style={{ backgroundColor: ROLE_META[selected].avatarBg, color: ROLE_META[selected].avatarFg }}>{(u.name || u.email).charAt(0).toUpperCase()}</span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-[#0F172A] truncate">{u.name || "No name"}</p>
                        <p className="text-xs text-[#94A3B8] truncate">{u.email}</p>
                      </div>
                      {u.status === "suspended" && <span className="text-[10px] font-bold text-[#B91C1C] bg-[#FEF2F2] px-2 py-0.5 rounded-full">Suspended</span>}
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
        </div>
      </Loadable>
    </div>
  );
}
