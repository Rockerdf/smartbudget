import { useState } from "react";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { fetchReports, logAdminAction, timeAgo } from "../../lib/admin";
import type { ReportData } from "../../lib/admin";
import { LESSONS } from "../../content/education";
import { downloadCsv, printReport, todayStamp } from "../../lib/exportData";
import { Button, Card, DownloadIcon, Empty, Loadable, PageHeader, RefreshIcon, TableWrap, Tabs, td, th, useLoader, useToast } from "../../components/admin/ui";

type Section = "users" | "finance" | "categories" | "education" | "security";
const RANGES = [3, 6, 12] as const;

const money = (n: number) => n.toLocaleString("en-AU", { style: "currency", currency: "AUD", maximumFractionDigits: 0 });
const monthLabel = (m: string) => {
  const [y, mo] = m.split("-").map(Number);
  return new Date(y, mo - 1, 1).toLocaleDateString("en-AU", { month: "short", year: "2-digit" });
};
const lessonTitle = (id: number) => LESSONS.find((l) => l.id === id)?.title ?? `Lesson ${id}`;

type Table = { title: string; head: string[]; rows: (string | number)[][] };

function tablesFor(r: ReportData): Record<Section, Table> {
  return {
    users: {
      title: "User activity",
      head: ["Month", "New sign-ups", "People who signed in", "Sign-ins", "People recording transactions"],
      rows: r.user_activity.map((m) => [monthLabel(m.month), m.signups, m.active_users, m.logins, m.users_with_transactions]),
    },
    finance: {
      title: "Financial activity (all users combined)",
      head: ["Month", "Transactions", "Income recorded", "Expenses recorded", "People tracking"],
      rows: r.financial_trends.map((m) => [monthLabel(m.month), m.transactions, money(m.income_total), money(m.expense_total), m.active_trackers]),
    },
    categories: {
      title: "Spending by category (anonymised)",
      head: ["Category", "Total spent", "People", "Transactions"],
      rows: r.spending_by_category.map((c) => [c.category, money(c.total), c.people, c.transactions]),
    },
    education: {
      title: "Education engagement",
      head: ["Lesson", "Started", "Completed", "Completion rate"],
      rows: r.education.map((e) => [lessonTitle(e.lesson_id), e.started, e.completed, e.started ? `${Math.round((e.completed / e.started) * 100)}%` : "—"]),
    },
    security: {
      title: "Security summary",
      head: ["Month", "Sign-ins", "Failed sign-ins", "Password resets", "Admin actions"],
      rows: r.security.map((m) => [monthLabel(m.month), m.logins, m.failed_logins, m.password_resets, m.admin_actions]),
    },
  };
}

export default function AdminReports() {
  const [months, setMonths] = useState<(typeof RANGES)[number]>(6);
  const [section, setSection] = useState<Section>("users");
  const { data: r, loading, refreshing, error, reload } = useLoader(() => fetchReports(months), [months]);
  const toast = useToast();

  const exportCsv = (which: Section) => {
    if (!r) return;
    const t = tablesFor(r)[which];
    downloadCsv(`smartbudget-${which}-report-${todayStamp()}.csv`, [[`${t.title} · last ${months} months`], [], t.head, ...t.rows]);
    void logAdminAction("report_exported", t.title, { format: "csv", months });
    toast.show(`${t.title} downloaded`);
  };

  const exportPdf = () => {
    if (!r) return;
    const all = tablesFor(r);
    const ok = printReport("SmartBudget platform report", `Last ${months} months · generated ${new Date().toLocaleDateString("en-AU")}`,
      (Object.keys(all) as Section[]).map((k) => ({ heading: all[k].title, rows: [all[k].head, ...all[k].rows] })));
    if (ok) void logAdminAction("report_exported", "Full platform report", { format: "pdf", months });
    toast.show(ok ? "Report opened. Choose \"Save as PDF\" in the print window." : "Please allow pop-ups for this site to open the report.");
  };

  const t = r ? tablesFor(r) : null;
  const chartData: Record<Section, Record<string, string | number>[]> | null = r ? {
    users: r.user_activity.map((m) => ({ label: monthLabel(m.month), "New sign-ups": m.signups, "People who signed in": m.active_users })),
    finance: r.financial_trends.map((m) => ({ label: monthLabel(m.month), Income: m.income_total, Expenses: m.expense_total })),
    categories: r.spending_by_category.slice(0, 10).map((c) => ({ label: c.category, Spent: c.total })),
    education: r.education.map((e) => ({ label: `L${e.lesson_id}`, Started: e.started, Completed: e.completed })),
    security: r.security.map((m) => ({ label: monthLabel(m.month), "Sign-ins": m.logins, "Failed sign-ins": m.failed_logins })),
  } : null;

  const notes: Record<Section, string> = {
    users: "Sign-ups and sign-ins each month.",
    finance: "Totals across everyone. No individual's records are shown.",
    categories: "Only categories used by at least 3 different people are listed, so no one can be identified.",
    education: "How many people started and finished each lesson.",
    security: "Sign-ins, failed attempts, reset requests and staff actions each month.",
  };

  return (
    <div className="max-w-[1200px]">
      {toast.node}
      <PageHeader
        title="Reports"
        sub={r ? `Calculated from live data · updated ${timeAgo(r.generated_at)}` : "Calculated from live data"}
        actions={<>
          <div className="flex bg-[#F1F5F9] rounded-xl p-1" role="group" aria-label="Period">
            {RANGES.map((m) => (
              <button key={m} type="button" onClick={() => setMonths(m)} aria-pressed={months === m}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${months === m ? "bg-white shadow-sm text-[#0F172A]" : "text-[#64748B]"}`}>{m} months</button>
            ))}
          </div>
          <Button small onClick={reload} disabled={refreshing}><RefreshIcon spinning={refreshing} /> Refresh</Button>
          <Button small variant="primary" onClick={exportPdf} disabled={!r}><DownloadIcon /> Full report (PDF)</Button>
        </>}
      />

      <Loadable loading={loading} error={error} onRetry={reload}>
        {r && t && chartData && (
          <div className="space-y-5">
            <Tabs value={section} onChange={setSection} items={[
              { id: "users", label: "User activity" }, { id: "finance", label: "Financial" },
              { id: "categories", label: "Categories" }, { id: "education", label: "Education" }, { id: "security", label: "Security" },
            ]} />

            <Card title={t[section].title} sub={notes[section]}
              actions={<Button small onClick={() => exportCsv(section)} disabled={!t[section].rows.length}><DownloadIcon /> CSV</Button>}>
              {t[section].rows.length === 0 ? <Empty>No data for this period yet.</Empty> : (
                <>
                  <ResponsiveContainer width="100%" height={240}>
                    {section === "finance" || section === "security" ? (
                      <LineChart data={chartData[section]}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                        <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#94A3B8" }} axisLine={false} tickLine={false} />
                        <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: "#94A3B8" }} axisLine={false} tickLine={false} width={50}
                          tickFormatter={section === "finance" ? (v: number) => (v >= 1000 ? `$${Math.round(v / 1000)}k` : `$${v}`) : undefined} />
                        <Tooltip contentStyle={{ borderRadius: 10, border: "1px solid #E2E8F0", fontSize: 12 }}
                          formatter={section === "finance" ? (v: unknown) => [typeof v === "number" ? money(v) : String(v), ""] : undefined} />
                        <Legend wrapperStyle={{ fontSize: 11 }} />
                        {Object.keys(chartData[section][0] ?? {}).filter((k) => k !== "label").map((k, i) => (
                          <Line key={k} type="monotone" dataKey={k} stroke={["#2563EB", "#EF4444", "#10B981"][i]} strokeWidth={2} dot={{ r: 3 }} />
                        ))}
                      </LineChart>
                    ) : (
                      <BarChart data={chartData[section]} layout={section === "categories" ? "vertical" : "horizontal"}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                        {section === "categories" ? (
                          <>
                            <XAxis type="number" tick={{ fontSize: 10, fill: "#94A3B8" }} axisLine={false} tickLine={false} tickFormatter={(v: number) => `$${v}`} />
                            <YAxis type="category" dataKey="label" tick={{ fontSize: 10, fill: "#64748B" }} axisLine={false} tickLine={false} width={110} />
                          </>
                        ) : (
                          <>
                            <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#94A3B8" }} axisLine={false} tickLine={false} />
                            <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: "#94A3B8" }} axisLine={false} tickLine={false} width={30} />
                          </>
                        )}
                        <Tooltip contentStyle={{ borderRadius: 10, border: "1px solid #E2E8F0", fontSize: 12 }}
                          formatter={section === "categories" ? (v: unknown) => [typeof v === "number" ? money(v) : String(v), "Spent"] : undefined} />
                        <Legend wrapperStyle={{ fontSize: 11 }} />
                        {Object.keys(chartData[section][0] ?? {}).filter((k) => k !== "label").map((k, i) => (
                          <Bar key={k} dataKey={k} fill={["#2563EB", "#10B981", "#F59E0B"][i]} radius={[3, 3, 0, 0]} />
                        ))}
                      </BarChart>
                    )}
                  </ResponsiveContainer>
                  <div className="mt-5">
                    <TableWrap>
                      <thead><tr>{t[section].head.map((h) => <th key={h} className={th}>{h}</th>)}</tr></thead>
                      <tbody>
                        {t[section].rows.map((row, i) => (
                          <tr key={i}>{row.map((c, j) => <td key={j} className={`${td} ${j === 0 ? "font-medium text-[#0F172A] whitespace-nowrap" : "text-[#475569] tabular-nums"}`}>{c}</td>)}</tr>
                        ))}
                      </tbody>
                    </TableWrap>
                  </div>
                </>
              )}
            </Card>

            <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-3">
              {(Object.keys(t) as Section[]).map((k) => (
                <button key={k} type="button" onClick={() => exportCsv(k)} disabled={!t[k].rows.length}
                  className="text-left bg-white border border-[#E2E8F0] rounded-xl p-3.5 hover:border-[#BFDBFE] disabled:opacity-50">
                  <p className="text-sm font-semibold text-[#0F172A]">{t[k].title}</p>
                  <p className="text-xs text-[#2563EB] mt-1 flex items-center gap-1"><DownloadIcon /> Download CSV · {t[k].rows.length} rows</p>
                </button>
              ))}
            </div>
            <p className="text-xs text-[#94A3B8] text-center">Every export is recorded in the activity log. Reports never include individual people's financial records.</p>
          </div>
        )}
      </Loadable>
    </div>
  );
}
