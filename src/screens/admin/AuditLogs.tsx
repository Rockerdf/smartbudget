import { useEffect, useState } from "react";
import { actionLabel, describeActivity, describeAgent, fetchActivityLog, formatDateTime, logAdminAction } from "../../lib/admin";
import { downloadCsv, todayStamp } from "../../lib/exportData";
import { Button, Card, DownloadIcon, Empty, Loadable, PageHeader, RefreshIcon, TableWrap, Tabs, td, th, useLoader, useToast } from "../../components/admin/ui";

type Kind = "all" | "admin" | "auth" | "security";
type Period = "24h" | "7d" | "30d" | "all";
const PAGE = 25;

const PERIODS: { id: Period; label: string; ms: number | null }[] = [
  { id: "24h", label: "24 hours", ms: 864e5 },
  { id: "7d", label: "7 days", ms: 7 * 864e5 },
  { id: "30d", label: "30 days", ms: 30 * 864e5 },
  { id: "all", label: "All time", ms: null },
];

const BAD = new Set(["login_failed", "suspended_login_blocked", "user_suspended", "account_deleted"]);

export default function AdminAuditLogs() {
  const [kind, setKind] = useState<Kind>("all");
  const [period, setPeriod] = useState<Period>("7d");
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);
  const toast = useToast();

  // Search runs shortly after typing stops.
  useEffect(() => { const t = setTimeout(() => { setQuery(search.trim()); setPage(0); }, 350); return () => clearTimeout(t); }, [search]);

  const since = () => {
    const ms = PERIODS.find((p) => p.id === period)?.ms;
    return ms ? new Date(Date.now() - ms).toISOString() : null;
  };
  const { data, loading, refreshing, error, reload } = useLoader(
    () => fetchActivityLog({ kind, search: query, limit: PAGE, offset: page * PAGE, since: since() }),
    [kind, query, page, period],
  );

  const pages = data ? Math.max(1, Math.ceil(data.total / PAGE)) : 1;

  const exportCsv = async () => {
    try {
      const all = await fetchActivityLog({ kind, search: query, limit: 500, offset: 0, since: since() });
      downloadCsv(`smartbudget-activity-${todayStamp()}.csv`, [
        ["When", "Type", "Who", "Role", "Action", "Details", "IP address", "Device"],
        ...all.rows.map((r) => [formatDateTime(r.created_at), r.kind === "admin" ? "Admin action" : "Sign-in event", r.who ?? "", r.who_role ?? "",
          actionLabel(r.action), describeActivity(r), r.ip ?? "", r.agent ? describeAgent(r.agent) : ""]),
      ]);
      void logAdminAction("audit_exported", `${all.rows.length} rows`, { kind, period, search: query });
      toast.show(`Downloaded ${all.rows.length} entries${all.total > 500 ? " (latest 500)" : ""}`);
    } catch (e) {
      toast.show(e instanceof Error ? e.message : "Could not export.");
    }
  };

  return (
    <div className="max-w-[1200px]">
      {toast.node}
      <PageHeader
        title="Activity Log"
        sub="Every staff action and sign-in event, recorded by the database. Entries can't be edited or deleted from the app."
        actions={<>
          <Button small onClick={reload} disabled={refreshing}><RefreshIcon spinning={refreshing} /> Refresh</Button>
          <Button small onClick={() => void exportCsv()} disabled={!data?.total}><DownloadIcon /> Export CSV</Button>
        </>}
      />

      <div className="flex flex-col lg:flex-row gap-3 mb-4">
        <Tabs value={kind} onChange={(k) => { setKind(k); setPage(0); }} items={[
          { id: "all", label: "Everything" }, { id: "admin", label: "Admin actions" },
          { id: "auth", label: "Sign-in events" }, { id: "security", label: "Security" },
        ]} />
        <select value={period} onChange={(e) => { setPeriod(e.target.value as Period); setPage(0); }} aria-label="Period"
          className="border border-[#E2E8F0] rounded-xl px-3 py-2 text-sm bg-white">
          {PERIODS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
        </select>
        <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search email, action or IP"
          aria-label="Search the activity log" className="flex-1 border border-[#E2E8F0] rounded-xl px-4 py-2 text-sm bg-white outline-none focus:border-[#2563EB]" />
      </div>

      <Loadable loading={loading} error={error} onRetry={reload}>
        {data && (
          <Card title={`${data.total.toLocaleString()} entr${data.total === 1 ? "y" : "ies"}`}
            actions={pages > 1 ? <span className="text-xs text-[#94A3B8] shrink-0">Page {page + 1} of {pages}</span> : undefined}>
            {data.rows.length === 0 ? <Empty>No activity matches these filters.</Empty> : (
              <TableWrap>
                <thead><tr><th className={th}>When</th><th className={th}>Who</th><th className={th}>Action</th><th className={th}>Details</th><th className={th}>IP / device</th></tr></thead>
                <tbody>
                  {data.rows.map((r, i) => (
                    <tr key={i}>
                      <td className={`${td} whitespace-nowrap text-[#475569]`}>{formatDateTime(r.created_at)}</td>
                      <td className={td}>
                        <p className="font-medium text-[#0F172A]">{r.who ?? "—"}</p>
                        {r.who_role && <p className="text-[11px] text-[#94A3B8] capitalize">{r.who_role}</p>}
                      </td>
                      <td className={td}>
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full whitespace-nowrap ${BAD.has(r.action) ? "bg-[#FEF2F2] text-[#B91C1C]" : r.kind === "admin" ? "bg-[#F5F3FF] text-[#6D28D9]" : "bg-[#EFF6FF] text-[#1D4ED8]"}`}>
                          {actionLabel(r.action)}
                        </span>
                      </td>
                      <td className={`${td} text-[#475569] max-w-[280px]`}>{describeActivity(r) || "—"}</td>
                      <td className={`${td} text-xs text-[#64748B]`}>
                        <span className="font-mono">{r.ip ?? "—"}</span>
                        {r.agent && <span className="block">{describeAgent(r.agent)}</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </TableWrap>
            )}
            {pages > 1 && (
              <div className="flex justify-between items-center mt-4">
                <Button small variant="ghost" onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0}>← Newer</Button>
                <Button small variant="ghost" onClick={() => setPage((p) => Math.min(pages - 1, p + 1))} disabled={page >= pages - 1}>Older →</Button>
              </div>
            )}
          </Card>
        )}
      </Loadable>
    </div>
  );
}
