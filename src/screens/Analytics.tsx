import { useState, useMemo, useEffect } from "react";
import { fetchTransactions, subscribeTransactionsChanged } from "../lib/transactions";
import type { Transaction } from "../lib/transactions";
import { fetchBudget } from "../lib/budgets";
import type { BudgetCategory } from "../lib/budgets";
import { fetchGoals } from "../lib/goals";
import type { SavingsGoal } from "../lib/goals";
import { computeHealth, computeInsights } from "../lib/insights";
import { downloadCsv, printReport, todayStamp } from "../lib/exportData";
import {
  LineChart, Line, AreaChart, Area,
  PieChart, Pie, Cell,
  RadarChart, Radar, PolarGrid, PolarAngleAxis,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import type { Screen } from "../App";

// Every figure on this page is calculated from the signed-in user's own
// transactions, budgets and goals. Nothing here is sample data.

const VIEWS = ["Monthly", "Quarterly", "Annual"] as const;
type View = typeof VIEWS[number];

const DATE_RANGES = ["Last 3 Months", "Last 6 Months", "This Year"] as const;
type DateRange = typeof DATE_RANGES[number];

const PIE_COLORS = ["#2563EB", "#10B981", "#F59E0B", "#8B5CF6", "#EC4899", "#14B8A6", "#64748B"];

type Bucket = { key: string; label: string; income: number; expenses: number; savings: number };

const money = (n: number) => n.toLocaleString("en-AU", { style: "currency", currency: "AUD", maximumFractionDigits: 0 });
const moneyCents = (n: number) => n.toLocaleString("en-AU", { style: "currency", currency: "AUD" });
const abs = Math.abs;

function axisFmt(n: number) {
  if (Math.abs(n) >= 1000) return `$${(n / 1000).toFixed(Math.abs(n) >= 10000 ? 0 : 1)}k`;
  return `$${Math.round(n)}`;
}

/** First day of the selected date range. */
function rangeStart(range: DateRange, now = new Date()): Date {
  if (range === "This Year") return new Date(now.getFullYear(), 0, 1);
  const months = range === "Last 3 Months" ? 3 : 6;
  return new Date(now.getFullYear(), now.getMonth() - (months - 1), 1);
}

function bucketKey(dateStr: string, view: View) {
  const [y, m] = dateStr.split("-").map(Number);
  if (view === "Annual") return `${y}`;
  if (view === "Quarterly") return `${y}-Q${Math.floor((m - 1) / 3) + 1}`;
  return `${y}-${String(m).padStart(2, "0")}`;
}

function bucketLabel(key: string, view: View) {
  if (view === "Annual") return key;
  if (view === "Quarterly") { const [y, q] = key.split("-"); return `${q} '${y.slice(2)}`; }
  const [y, m] = key.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-AU", { month: "short", year: "2-digit" });
}

/** All bucket keys between start and now, so empty periods still show as zero. */
function bucketKeys(start: Date, view: View, now = new Date()): string[] {
  const keys: string[] = [];
  const d = new Date(start.getFullYear(), start.getMonth(), 1);
  while (d <= now) {
    const k = bucketKey(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`, view);
    if (!keys.includes(k)) keys.push(k);
    d.setMonth(d.getMonth() + 1);
  }
  return keys;
}

function buildBuckets(txs: Transaction[], start: Date, view: View): Bucket[] {
  const keys = bucketKeys(start, view);
  const map = new Map<string, Bucket>(keys.map((k) => [k, { key: k, label: bucketLabel(k, view), income: 0, expenses: 0, savings: 0 }]));
  for (const t of txs) {
    const b = map.get(bucketKey(t.date, view));
    if (!b) continue;
    if (t.type === "income") b.income += abs(t.amount); else b.expenses += abs(t.amount);
  }
  for (const b of map.values()) {
    b.income = Math.round(b.income * 100) / 100;
    b.expenses = Math.round(b.expenses * 100) / 100;
    b.savings = Math.round((b.income - b.expenses) * 100) / 100;
  }
  return keys.map((k) => map.get(k)!);
}

function pctChange(curr: number, prev: number): string | null {
  if (!prev) return null;
  const p = ((curr - prev) / prev) * 100;
  return `${p >= 0 ? "+" : ""}${p.toFixed(1)}%`;
}

function Toast({ msg }: { msg: string }) {
  return (
    <div className="fixed bottom-24 md:bottom-6 left-1/2 -translate-x-1/2 bg-[#0F172A] text-white text-sm px-5 py-3 rounded-xl shadow-xl z-50 max-w-[90vw] text-center animate-in">
      {msg}
    </div>
  );
}

function Breadcrumb({ navigate }: { navigate: (s: Screen) => void }) {
  return (
    <div className="flex items-center gap-1.5 text-xs text-[#94A3B8] mb-4">
      <button onClick={() => navigate("dashboard")} className="hover:text-[#2563EB] transition-colors font-medium">
        Dashboard
      </button>
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <polyline points="9 18 15 12 9 6" />
      </svg>
      <span className="text-[#0F172A] font-medium">Analytics</span>
    </div>
  );
}

function EfficiencyBar({ label, budget, spent }: { label: string; budget: number; spent: number }) {
  const pct = budget > 0 ? Math.min(100, Math.round((spent / budget) * 100)) : 0;
  const over = spent > budget;
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="text-[#64748B] truncate mr-2">{label}</span>
        <div className="flex items-center gap-1.5 shrink-0">
          <span className={`font-semibold ${over ? "text-[#EF4444]" : "text-[#0F172A]"}`}>{money(spent)}</span>
          <span className="text-[#94A3B8]">/ {money(budget)}</span>
          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${over ? "bg-[#FEF2F2] text-[#EF4444]" : "bg-[#ECFDF5] text-[#16A34A]"}`}>
            {budget > 0 ? Math.round((spent / budget) * 100) : 0}%
          </span>
        </div>
      </div>
      <div className="h-2 bg-[#F1F5F9] rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all"
          style={{ width: `${pct}%`, backgroundColor: over ? "#EF4444" : pct >= 85 ? "#F59E0B" : "#10B981" }} />
      </div>
    </div>
  );
}

function EmptyChart({ text, action, onAction }: { text: string; action?: string; onAction?: () => void }) {
  return (
    <div className="h-[190px] flex flex-col items-center justify-center text-center rounded-xl bg-[#F8FAFC] border border-dashed border-[#E2E8F0] px-4">
      <p className="text-sm text-[#64748B]">{text}</p>
      {action && onAction && (
        <button type="button" onClick={onAction} className="mt-2 text-sm font-semibold text-[#2563EB] hover:underline">{action}</button>
      )}
    </div>
  );
}

export default function Analytics({
  navigate,
  userId,
  refreshKey = 0,
}: {
  navigate: (s: Screen) => void;
  userId: string;
  refreshKey?: number;
}) {
  const [view, setView] = useState<View>("Monthly");
  const [dateRange, setDateRange] = useState<DateRange>("Last 6 Months");
  const [toast, setToast] = useState("");
  const [txs, setTxs] = useState<Transaction[]>([]);
  const [budget, setBudget] = useState<BudgetCategory[]>([]);
  const [goals, setGoals] = useState<SavingsGoal[]>([]);
  const [txError, setTxError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    let requestId = 0;
    const load = () => {
      const id = ++requestId;
      setLoading(true);
      setTxError("");
      fetchTransactions()
        .then((rows) => { if (!cancelled && id === requestId) setTxs(rows); })
        .catch((err) => { if (!cancelled && id === requestId) setTxError(err instanceof Error ? err.message : "Could not load transactions."); })
        .finally(() => { if (!cancelled && id === requestId) setLoading(false); });
      fetchBudget().then((rows) => { if (!cancelled) setBudget(rows); }).catch(() => undefined);
      fetchGoals().then((rows) => { if (!cancelled) setGoals(rows); }).catch(() => undefined);
    };
    load();
    const unsubscribe = subscribeTransactionsChanged(load);
    return () => { cancelled = true; unsubscribe(); };
  }, [userId, refreshKey]);

  const start = useMemo(() => rangeStart(dateRange), [dateRange]);
  const startStr = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}-01`;
  const inRange = useMemo(() => txs.filter((t) => t.date >= startStr), [txs, startStr]);
  const buckets = useMemo(() => buildBuckets(txs, start, view), [txs, start, view]);

  // Cumulative net savings across the range.
  const growth = useMemo(() => {
    let running = 0;
    return buckets.map((b) => { running += b.savings; return { label: b.label, total: Math.round(running * 100) / 100 }; });
  }, [buckets]);

  // Spending by category within the range.
  const categories = useMemo(() => {
    const m = new Map<string, number>();
    for (const t of inRange) if (t.type === "expense") m.set(t.category || "Other", (m.get(t.category || "Other") ?? 0) + abs(t.amount));
    return [...m.entries()].sort((a, b) => b[1] - a[1]).map(([name, value]) => ({ name, value: Math.round(value * 100) / 100 }));
  }, [inRange]);
  const pie = useMemo(() => {
    const top = categories.slice(0, 6);
    const other = categories.slice(6).reduce((s, c) => s + c.value, 0);
    const rows = other > 0 ? [...top, { name: "Other", value: Math.round(other * 100) / 100 }] : top;
    return rows.map((r, i) => ({ ...r, color: PIE_COLORS[i % PIE_COLORS.length] }));
  }, [categories]);
  const totalSpendRange = categories.reduce((s, c) => s + c.value, 0);

  const totals = useMemo(() => {
    const income = inRange.filter((t) => t.type === "income").reduce((s, t) => s + abs(t.amount), 0);
    const expenses = inRange.filter((t) => t.type === "expense").reduce((s, t) => s + abs(t.amount), 0);
    const monthsInRange = bucketKeys(start, "Monthly").length || 1;
    return { income, expenses, net: income - expenses, rate: income > 0 ? Math.round(((income - expenses) / income) * 100) : null, avgSpend: expenses / monthsInRange };
  }, [inRange, start]);

  const current = buckets[buckets.length - 1];
  const previous = buckets[buckets.length - 2];
  const health = useMemo(() => computeHealth(txs, budget, goals), [txs, budget, goals]);
  const insights = useMemo(() => computeInsights(txs, budget).slice(0, 4), [txs, budget]);
  const radar = health.parts.filter((p) => p.pct !== null).map((p) => ({ dimension: p.label, score: p.pct as number }));

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(""), 3500); };

  const handleExportCSV = () => {
    downloadCsv(`smartbudget-analytics-${view.toLowerCase()}-${todayStamp()}.csv`, [
      [`SmartBudget analytics — ${view} — ${dateRange}`],
      [],
      ["Period", "Income (AUD)", "Expenses (AUD)", "Net savings (AUD)"],
      ...buckets.map((b) => [b.label, b.income.toFixed(2), b.expenses.toFixed(2), b.savings.toFixed(2)]),
      [],
      ["Category", "Spent in range (AUD)", "Share"],
      ...categories.map((c) => [c.name, c.value.toFixed(2), totalSpendRange ? `${Math.round((c.value / totalSpendRange) * 100)}%` : "0%"]),
    ]);
    showToast("CSV downloaded");
  };

  const handleExportPDF = () => {
    const ok = printReport(`Analytics report — ${view}`, dateRange, [
      { heading: "Summary", rows: [["Measure", "Value"], ["Income", moneyCents(totals.income)], ["Expenses", moneyCents(totals.expenses)], ["Net savings", moneyCents(totals.net)], ["Savings rate", totals.rate === null ? "—" : `${totals.rate}%`], ["Financial Health Score", health.score === null ? "Not enough data" : `${health.score}/100 (${health.rating})`]] },
      { heading: "Income vs expenses", rows: [["Period", "Income", "Expenses", "Net savings"], ...buckets.map((b) => [b.label, moneyCents(b.income), moneyCents(b.expenses), moneyCents(b.savings)])] },
      { heading: "Spending by category", rows: [["Category", "Spent", "Share"], ...categories.map((c) => [c.name, moneyCents(c.value), totalSpendRange ? `${Math.round((c.value / totalSpendRange) * 100)}%` : "0%"])] },
      { heading: "Budgets this month", rows: [["Category", "Budgeted", "Spent", "Remaining"], ...budget.map((b) => [b.category, moneyCents(b.budgeted), moneyCents(b.spent), moneyCents(b.budgeted - b.spent)])] },
    ]);
    showToast(ok ? "Report opened. Choose \"Save as PDF\" in the print window." : "Please allow pop-ups for this site to open the report.");
  };

  const hasData = txs.length > 0;
  const kpiStrip = [
    { label: "Avg Monthly Spend", value: loading ? "…" : money(totals.avgSpend), sub: dateRange.toLowerCase(), accent: "#EF4444" },
    { label: "Largest Category", value: loading ? "…" : categories[0]?.name ?? "—", sub: categories[0] ? `${money(categories[0].value)} in range` : "no spending yet", accent: "#F59E0B" },
    { label: "Savings Rate", value: loading ? "…" : totals.rate === null ? "—" : `${totals.rate}%`, sub: "of income kept in range", accent: "#10B981" },
    { label: "Health Score", value: loading ? "…" : health.score === null ? "—" : `${health.score}/100`, sub: health.rating.toLowerCase(), accent: "#2563EB" },
  ];

  const periodWord = view === "Monthly" ? "month" : view === "Quarterly" ? "quarter" : "year";
  const kpiRow = [
    { label: `This ${periodWord}'s income`, value: current ? money(current.income) : "$0", change: current && previous ? pctChange(current.income, previous.income) : null, goodWhenUp: true, sub: previous ? `nothing recorded last ${periodWord}` : `first ${periodWord} in range` },
    { label: `This ${periodWord}'s expenses`, value: current ? money(current.expenses) : "$0", change: current && previous ? pctChange(current.expenses, previous.expenses) : null, goodWhenUp: false, sub: previous ? `nothing recorded last ${periodWord}` : `first ${periodWord} in range` },
    { label: "Net savings in range", value: money(totals.net), change: null, goodWhenUp: true, sub: "income minus expenses" },
    { label: `Last ${periodWord}'s net`, value: previous ? money(previous.savings) : "—", change: null, goodWhenUp: true, sub: `previous ${periodWord}` },
  ];

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1200px]">
      {toast && <Toast msg={toast} />}

      <Breadcrumb navigate={navigate} />
      {txError && (
        <div className="mb-4 rounded-2xl border border-[#FECACA] bg-[#FEF2F2] px-4 py-3 text-sm text-[#DC2626]">{txError}</div>
      )}

      {/* ── Header ── */}
      <div className="flex items-start justify-between mb-6 gap-4 flex-wrap">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-[#0F172A]">Analytics & Reports</h1>
          <p className="text-xs sm:text-sm text-[#64748B] mt-0.5">Trends calculated from the transactions you have recorded</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex bg-[#F1F5F9] rounded-xl p-1" role="group" aria-label="Group by">
            {VIEWS.map((v) => (
              <button key={v} type="button" onClick={() => setView(v)} aria-pressed={view === v}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${view === v ? "bg-white text-[#0F172A] shadow-sm" : "text-[#64748B] hover:text-[#0F172A]"}`}>
                {v}
              </button>
            ))}
          </div>
          <div className="flex gap-1.5">
            {(["PDF", "CSV"] as const).map((type) => (
              <button key={type} type="button" disabled={!hasData}
                onClick={type === "CSV" ? handleExportCSV : handleExportPDF}
                className="flex items-center gap-1.5 text-xs font-medium border border-[#E2E8F0] px-3 py-2 rounded-xl hover:bg-[#F8FAFC] text-[#64748B] transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
                </svg>
                {type}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Date range ── */}
      <div className="flex items-center gap-2 mb-5 flex-wrap">
        <span className="text-xs text-[#64748B] font-medium shrink-0">Date range:</span>
        <div className="flex bg-[#F1F5F9] rounded-xl p-1 gap-0.5" role="group" aria-label="Date range">
          {DATE_RANGES.map((r) => (
            <button key={r} type="button" onClick={() => setDateRange(r)} aria-pressed={dateRange === r}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${dateRange === r ? "bg-white text-[#0F172A] shadow-sm" : "text-[#64748B] hover:text-[#0F172A]"}`}>
              {r}
            </button>
          ))}
        </div>
      </div>

      {!loading && !hasData && !txError && (
        <div className="mb-6 rounded-2xl border border-[#BFDBFE] bg-[#EFF6FF] p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <p className="font-semibold text-[#1E40AF]">No transactions yet</p>
            <p className="text-sm text-[#1D4ED8] mt-0.5">Add a few income and expense entries and your charts will appear here.</p>
          </div>
          <button type="button" onClick={() => navigate("transactions")} className="shrink-0 bg-[#2563EB] text-white text-sm font-semibold px-4 py-2.5 rounded-xl hover:bg-[#1D4ED8]">
            Add a transaction
          </button>
        </div>
      )}

      {/* ── Summary strip ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-4">
        {kpiStrip.map((k) => (
          <div key={k.label} className="bg-white rounded-2xl p-4 border border-[#E2E8F0] card-shadow flex flex-col gap-1 min-w-0">
            <p className="text-[10px] text-[#94A3B8] uppercase tracking-wide font-medium">{k.label}</p>
            <p className="text-lg font-bold truncate" style={{ color: k.accent }}>{k.value}</p>
            <p className="text-[10px] text-[#64748B]">{k.sub}</p>
          </div>
        ))}
      </div>

      {/* ── Period KPIs ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
        {kpiRow.map((k) => {
          const up = k.change?.startsWith("+") ?? false;
          const good = k.goodWhenUp ? up : !up;
          return (
            <div key={k.label} className="bg-white rounded-2xl p-4 sm:p-5 border border-[#E2E8F0] card-shadow">
              <p className="text-xs text-[#64748B] mb-2">{k.label}</p>
              <p className="text-lg sm:text-xl font-bold text-[#0F172A]">{loading ? "…" : k.value}</p>
              {k.change ? (
                <p className={`text-xs font-medium mt-1 ${good ? "text-[#10B981]" : "text-[#EF4444]"}`}>{k.change} vs previous {periodWord}</p>
              ) : (
                <p className="text-xs text-[#94A3B8] mt-1">{k.sub}</p>
              )}
            </div>
          );
        })}
      </div>

      {/* ── Insights ── */}
      <div className="bg-white rounded-2xl p-5 border border-[#E2E8F0] card-shadow mb-6">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-5 h-5 rounded-lg bg-[#EFF6FF] flex items-center justify-center shrink-0">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="2" strokeLinecap="round"><path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z" /></svg>
          </div>
          <span className="text-xs font-semibold text-[#2563EB] uppercase tracking-wide">Key insights from your data</span>
          <span className="ml-auto text-[10px] text-[#94A3B8] italic hidden sm:inline">Educational only · not financial advice</span>
        </div>
        {insights.length === 0 ? (
          <p className="text-sm text-[#64748B]">Insights appear once you have a few transactions and a monthly budget.</p>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {insights.map((ins, i) => {
              const style = ins.tone === "warn" ? { cls: "bg-[#FFFBEB] text-[#B45309]", icon: "⚠️" } : ins.tone === "good" ? { cls: "bg-[#ECFDF5] text-[#047857]", icon: "✅" } : { cls: "bg-[#EFF6FF] text-[#1D4ED8]", icon: "💡" };
              return (
                <div key={i} className={`flex items-start gap-2.5 p-3 rounded-xl border border-[#E2E8F0] ${style.cls}`}>
                  <span className="text-base shrink-0 leading-none mt-0.5" aria-hidden="true">{style.icon}</span>
                  <div>
                    <p className="text-xs font-semibold">{ins.title}</p>
                    <p className="text-xs leading-relaxed mt-0.5">{ins.body}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Charts row 1 ── */}
      <div className="grid lg:grid-cols-2 gap-4 sm:gap-6 mb-4 sm:mb-6">
        <div className="bg-white rounded-2xl p-5 sm:p-6 border border-[#E2E8F0] card-shadow">
          <h3 className="font-semibold text-[#0F172A] mb-0.5">Income vs Expenses</h3>
          <p className="text-xs text-[#64748B] mb-4">{view} totals · {dateRange.toLowerCase()}</p>
          {hasData ? (
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={buckets}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#94A3B8" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: "#94A3B8" }} axisLine={false} tickLine={false} tickFormatter={axisFmt} width={44} />
                <Tooltip formatter={(v: unknown) => [typeof v === "number" ? moneyCents(v) : String(v), ""]} contentStyle={{ borderRadius: 10, border: "1px solid #E2E8F0", fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Line type="monotone" dataKey="income" stroke="#2563EB" strokeWidth={2} dot={{ r: 2 }} name="Income" />
                <Line type="monotone" dataKey="expenses" stroke="#EF4444" strokeWidth={2} dot={{ r: 2 }} name="Expenses" />
                <Line type="monotone" dataKey="savings" stroke="#10B981" strokeWidth={2} dot={false} name="Net savings" strokeDasharray="5 3" />
              </LineChart>
            </ResponsiveContainer>
          ) : <EmptyChart text="No transactions in this range yet." action="Add a transaction" onAction={() => navigate("transactions")} />}
        </div>

        <div className="bg-white rounded-2xl p-5 sm:p-6 border border-[#E2E8F0] card-shadow">
          <h3 className="font-semibold text-[#0F172A] mb-0.5">Budget Efficiency</h3>
          <p className="text-xs text-[#64748B] mb-5">Spent vs budgeted this month</p>
          {budget.length ? (
            <div className="space-y-4">
              {budget.map((row) => <EfficiencyBar key={row.id} label={row.category} budget={row.budgeted} spent={row.spent} />)}
            </div>
          ) : <EmptyChart text="You haven't set a budget for this month." action="Create a budget" onAction={() => navigate("budget")} />}
        </div>
      </div>

      {/* ── Charts row 2 ── */}
      <div className="grid lg:grid-cols-2 gap-4 sm:gap-6">
        <div className="bg-white rounded-2xl p-5 sm:p-6 border border-[#E2E8F0] card-shadow">
          <h3 className="font-semibold text-[#0F172A] mb-0.5">Savings Growth</h3>
          <p className="text-xs text-[#64748B] mb-4">Cumulative income minus expenses · {dateRange.toLowerCase()}</p>
          {hasData ? (
            <ResponsiveContainer width="100%" height={190}>
              <AreaChart data={growth}>
                <defs>
                  <linearGradient id="savGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10B981" stopOpacity={0.18} />
                    <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#94A3B8" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: "#94A3B8" }} axisLine={false} tickLine={false} tickFormatter={axisFmt} width={44} />
                <Tooltip formatter={(v: unknown) => [typeof v === "number" ? moneyCents(v) : String(v), "Running total"]} contentStyle={{ borderRadius: 10, border: "1px solid #E2E8F0", fontSize: 12 }} />
                <Area type="monotone" dataKey="total" stroke="#10B981" strokeWidth={2.5} fill="url(#savGrad)" dot={{ r: 3, fill: "#10B981", strokeWidth: 0 }} />
              </AreaChart>
            </ResponsiveContainer>
          ) : <EmptyChart text="Your running savings total will appear here." />}
        </div>

        <div className="bg-white rounded-2xl p-5 sm:p-6 border border-[#E2E8F0] card-shadow">
          <h3 className="font-semibold text-[#0F172A] mb-0.5">Spending Mix</h3>
          <p className="text-xs text-[#64748B] mb-4">Where your money went · {dateRange.toLowerCase()}</p>
          {pie.length ? (
            <div className="grid grid-cols-[140px_1fr] gap-4 items-center">
              <ResponsiveContainer width="100%" height={140}>
                <PieChart>
                  <Pie data={pie} cx="50%" cy="50%" innerRadius={38} outerRadius={64} dataKey="value" paddingAngle={2}>
                    {pie.map((entry) => <Cell key={entry.name} fill={entry.color} />)}
                  </Pie>
                  <Tooltip formatter={(v: unknown) => [typeof v === "number" ? moneyCents(v) : String(v), ""]} contentStyle={{ borderRadius: 10, border: "1px solid #E2E8F0", fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
              <ul className="space-y-2 min-w-0">
                {pie.map((item) => (
                  <li key={item.name} className="flex items-center gap-2 text-xs">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                    <span className="text-[#475569] truncate flex-1">{item.name}</span>
                    <span className="font-semibold text-[#0F172A]">{money(item.value)}</span>
                    <span className="text-[#94A3B8] w-9 text-right">{totalSpendRange ? Math.round((item.value / totalSpendRange) * 100) : 0}%</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : <EmptyChart text="No spending recorded in this range." />}
        </div>
      </div>

      {/* ── Financial health ── */}
      <div className="bg-white rounded-2xl p-5 sm:p-6 border border-[#E2E8F0] card-shadow mt-4 sm:mt-6">
        <div className="flex items-start justify-between flex-wrap gap-3 mb-4">
          <div>
            <h3 className="font-semibold text-[#0F172A]">Financial Health Breakdown</h3>
            <p className="text-xs text-[#64748B] mt-0.5">{health.note}</p>
          </div>
          <button type="button" onClick={() => navigate("healthScore")} className="flex items-center gap-2 bg-[#EFF6FF] rounded-xl px-3 py-2 hover:bg-[#DBEAFE]">
            <span className="text-xs font-bold text-[#2563EB]">Overall</span>
            <span className="text-lg font-extrabold text-[#2563EB]">{health.score ?? "—"}</span>
            <span className="text-[10px] text-[#60A5FA]">/ 100</span>
          </button>
        </div>
        <div className="grid sm:grid-cols-2 gap-6 items-center">
          {radar.length >= 3 ? (
            <ResponsiveContainer width="100%" height={240}>
              <RadarChart data={radar} cx="50%" cy="50%" outerRadius={85}>
                <PolarGrid stroke="#E2E8F0" />
                <PolarAngleAxis dataKey="dimension" tick={{ fontSize: 10, fill: "#64748B" }} />
                <Radar name="Score" dataKey="score" stroke="#2563EB" fill="#2563EB" fillOpacity={0.15} strokeWidth={2} />
                <Tooltip formatter={(v: unknown) => [typeof v === "number" ? `${v}/100` : String(v), "Score"]} contentStyle={{ borderRadius: 10, border: "1px solid #E2E8F0", fontSize: 12 }} />
              </RadarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyChart text="The radar chart appears once at least three measures have data." />
          )}
          <div className="space-y-3">
            {health.parts.map((p) => {
              const color = p.pct === null ? "#CBD5E1" : p.pct >= 80 ? "#10B981" : p.pct >= 60 ? "#F59E0B" : "#EF4444";
              return (
                <div key={p.key} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-[#64748B]">{p.label}</span>
                    <span className="font-semibold" style={{ color }}>{p.pct === null ? "no data yet" : `${p.pct}/100`}</span>
                  </div>
                  <div className="h-1.5 bg-[#F1F5F9] rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${p.pct ?? 0}%`, backgroundColor: color }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <p className="mt-6 text-[10px] text-[#94A3B8] text-center">
        SmartBudget provides educational information and budgeting tools only. It does not provide personalised financial, investment, tax, or legal advice.
      </p>
    </div>
  );
}
