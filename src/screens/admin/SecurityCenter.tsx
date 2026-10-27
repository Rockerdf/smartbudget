import { useMemo, useState } from "react";
import type { Screen } from "../../App";
import { describeAgent, fetchSecurityOverview, formatDateTime, logAdminAction, timeAgo } from "../../lib/admin";
import type { SecurityOverview } from "../../lib/admin";
import { downloadCsv, todayStamp } from "../../lib/exportData";
import { Button, Card, DownloadIcon, Empty, Loadable, PageHeader, RefreshIcon, Stat, TableWrap, Tabs, td, th, useLoader, useToast } from "../../components/admin/ui";

type Tab = "alerts" | "failed" | "logins";
type Alert = { key: string; severity: "high" | "medium" | "low"; title: string; body: string; at: string };

/** Alerts are worked out from real sign-in events and admin actions. */
function buildAlerts(s: SecurityOverview): Alert[] {
  const out: Alert[] = [];
  for (const f of s.repeated_failures) {
    out.push({
      key: `repeated:${f.email}:${f.last_at.slice(0, 10)}`,
      severity: f.attempts >= 15 ? "high" : "medium",
      title: `${f.attempts} failed sign-ins for ${f.email}`,
      body: `In the last 24 hours, from ${f.ips} IP address${f.ips === 1 ? "" : "es"}${f.last_ip ? ` (latest ${f.last_ip})` : ""}. If this isn't the account owner, consider suspending the account or sending a password reset.`,
      at: f.last_at,
    });
  }
  for (const b of s.blocked_suspended) {
    out.push({ key: `suspended:${b.email}:${b.at}`, severity: "medium", title: `Suspended account tried to sign in`, body: `${b.email}${b.ip ? ` from ${b.ip}` : ""}. The sign-in was blocked.`, at: b.at });
  }
  for (const p of s.privilege_changes) {
    out.push({ key: `privilege:${p.id}`, severity: p.details.to === "superadmin" || p.details.to === "admin" ? "medium" : "low",
      title: `${p.target ?? "A user"} was given the ${p.details.to} role`, body: `Changed by ${p.by ?? "unknown"} (was ${p.details.from ?? "?"}). Check this was expected.`, at: p.at });
  }
  return out.sort((a, b) => b.at.localeCompare(a.at));
}

const sevStyle = {
  high: "border-[#FECACA] bg-[#FEF2F2] text-[#991B1B]",
  medium: "border-[#FDE68A] bg-[#FFFBEB] text-[#92400E]",
  low: "border-[#BFDBFE] bg-[#EFF6FF] text-[#1E40AF]",
};

export default function AdminSecurityCenter({ navigate }: { navigate: (s: Screen) => void }) {
  const { data: s, loading, refreshing, error, reload } = useLoader(fetchSecurityOverview);
  const [tab, setTab] = useState<Tab>("alerts");
  const [showResolved, setShowResolved] = useState(false);
  const [justResolved, setJustResolved] = useState<string[]>([]);
  const toast = useToast();

  const alerts = useMemo(() => (s ? buildAlerts(s) : []), [s]);
  const resolved = new Set([...(s?.resolved_keys ?? []), ...justResolved]);
  const open = alerts.filter((a) => !resolved.has(a.key));
  const visible = showResolved ? alerts : open;

  const resolve = async (a: Alert) => {
    await logAdminAction("alert_resolved", a.title, { key: a.key });
    setJustResolved((k) => [...k, a.key]);
    toast.show("Alert marked as resolved");
  };

  const exportCsv = () => {
    if (!s) return;
    const rows = tab === "logins"
      ? [["When", "Email", "IP address", "Device"], ...s.recent_logins.map((l) => [formatDateTime(l.at), l.email, l.ip ?? "", describeAgent(l.agent)])]
      : tab === "failed"
      ? [["When", "Email", "Existing account", "IP address", "Device"], ...s.recent_failed.map((l) => [formatDateTime(l.at), l.email, l.known_user ? "Yes" : "No", l.ip ?? "", describeAgent(l.agent)])]
      : [["When", "Severity", "Alert", "Details", "Status"], ...alerts.map((a) => [formatDateTime(a.at), a.severity, a.title, a.body, resolved.has(a.key) ? "Resolved" : "Open"])];
    downloadCsv(`smartbudget-security-${tab}-${todayStamp()}.csv`, rows);
    void logAdminAction("report_exported", `Security: ${tab}`, { format: "csv" });
    toast.show("Downloaded");
  };

  return (
    <div className="max-w-[1200px]">
      {toast.node}
      <PageHeader
        title="Security Center"
        sub={s ? `Real sign-in activity · updated ${timeAgo(s.generated_at)}` : "Real sign-in activity"}
        actions={<>
          <Button small onClick={reload} disabled={refreshing}><RefreshIcon spinning={refreshing} /> Refresh</Button>
          <Button small onClick={exportCsv} disabled={!s}><DownloadIcon /> Export</Button>
        </>}
      />
      <Loadable loading={loading} error={error} onRetry={reload}>
        {s && (
          <div className="space-y-5">
            {open.length > 0 ? (
              <div className="rounded-2xl border border-[#FECACA] bg-[#FEF2F2] px-5 py-3.5 text-sm font-semibold text-[#991B1B] flex items-center gap-2.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#EF4444] animate-pulse" />
                {open.length} open security alert{open.length === 1 ? "" : "s"} need{open.length === 1 ? "s" : ""} your attention.
              </div>
            ) : (
              <div className="rounded-2xl border border-[#BBF7D0] bg-[#F0FDF4] px-5 py-3.5 text-sm font-semibold text-[#166534] flex items-center gap-2.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#22C55E]" /> No open security alerts.
              </div>
            )}

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              <Stat label="Failed sign-ins (24 h)" value={s.failed_24h} tone={s.failed_24h ? "warn" : "default"} sub={`${s.failed_7d} in the last 7 days`} onClick={() => setTab("failed")} />
              <Stat label="Successful sign-ins (24 h)" value={s.success_24h} tone="good" onClick={() => setTab("logins")} />
              <Stat label="Suspended accounts" value={s.suspended_accounts} tone={s.suspended_accounts ? "bad" : "default"} sub="Manage in Users" onClick={() => navigate("adminUsers")} />
              <Stat label="Password resets (7 days)" value={s.resets_7d} sub={`${s.staff_accounts} staff accounts`} />
            </div>

            <Tabs value={tab} onChange={setTab} items={[
              { id: "alerts", label: "Alerts", count: open.length },
              { id: "failed", label: "Failed sign-ins" },
              { id: "logins", label: "Successful sign-ins" },
            ]} />

            {tab === "alerts" && (
              <Card title="Security alerts" sub="Raised automatically: 5+ failed sign-ins in 24 hours, suspended accounts trying to sign in, and new staff roles."
                actions={<label className="text-xs text-[#64748B] flex items-center gap-2 shrink-0"><input type="checkbox" checked={showResolved} onChange={(e) => setShowResolved(e.target.checked)} /> Show resolved</label>}>
                {visible.length === 0 ? <Empty>{alerts.length ? "All alerts are resolved." : "Nothing suspicious detected."}</Empty> : (
                  <ul className="space-y-3">
                    {visible.map((a) => {
                      const done = resolved.has(a.key);
                      return (
                        <li key={a.key} className={`rounded-xl border p-4 ${done ? "border-[#E2E8F0] bg-[#F8FAFC] text-[#64748B]" : sevStyle[a.severity]}`}>
                          <div className="flex flex-col sm:flex-row sm:items-start gap-3">
                            <div className="flex-1 min-w-0">
                              <p className="font-semibold text-sm">{a.title}</p>
                              <p className="text-xs mt-1 leading-relaxed">{a.body}</p>
                              <p className="text-[11px] mt-2 opacity-75">{formatDateTime(a.at)} · {a.severity} severity</p>
                            </div>
                            {done ? <span className="text-xs font-semibold text-[#16A34A] shrink-0">✓ Resolved</span> : (
                              <div className="flex gap-2 shrink-0">
                                {a.key.startsWith("repeated:") || a.key.startsWith("suspended:") ? <Button small variant="ghost" onClick={() => navigate("adminUsers")}>Open Users</Button> : null}
                                <Button small onClick={() => void resolve(a)}>Mark resolved</Button>
                              </div>
                            )}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </Card>
            )}

            {tab === "failed" && (
              <Card title="Failed sign-ins" sub="Latest 100 attempts with a wrong email or password">
                {s.recent_failed.length === 0 ? <Empty>No failed sign-ins recorded.</Empty> : (
                  <TableWrap>
                    <thead><tr><th className={th}>When</th><th className={th}>Email</th><th className={th}>Account exists</th><th className={th}>IP address</th><th className={th}>Device</th></tr></thead>
                    <tbody>{s.recent_failed.map((l, i) => (
                      <tr key={i}>
                        <td className={`${td} text-[#475569] whitespace-nowrap`}>{formatDateTime(l.at)}</td>
                        <td className={`${td} font-medium text-[#0F172A]`}>{l.email}</td>
                        <td className={td}>{l.known_user ? <span className="text-xs font-semibold text-[#B45309]">Yes</span> : <span className="text-xs text-[#94A3B8]">No</span>}</td>
                        <td className={`${td} font-mono text-xs text-[#475569]`}>{l.ip ?? "—"}</td>
                        <td className={`${td} text-[#475569]`}>{describeAgent(l.agent)}</td>
                      </tr>
                    ))}</tbody>
                  </TableWrap>
                )}
              </Card>
            )}

            {tab === "logins" && (
              <Card title="Successful sign-ins" sub="Latest 100 sign-ins">
                {s.recent_logins.length === 0 ? <Empty>No sign-ins recorded yet. New sign-ins appear here from now on.</Empty> : (
                  <TableWrap>
                    <thead><tr><th className={th}>When</th><th className={th}>Email</th><th className={th}>IP address</th><th className={th}>Device</th></tr></thead>
                    <tbody>{s.recent_logins.map((l, i) => (
                      <tr key={i}>
                        <td className={`${td} text-[#475569] whitespace-nowrap`}>{formatDateTime(l.at)}</td>
                        <td className={`${td} font-medium text-[#0F172A]`}>{l.email}</td>
                        <td className={`${td} font-mono text-xs text-[#475569]`}>{l.ip ?? "—"}</td>
                        <td className={`${td} text-[#475569]`}>{describeAgent(l.agent)}</td>
                      </tr>
                    ))}</tbody>
                  </TableWrap>
                )}
              </Card>
            )}
          </div>
        )}
      </Loadable>
    </div>
  );
}
