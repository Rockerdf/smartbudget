import { useEffect, useMemo, useState } from "react";
import { fetchTransactions, subscribeTransactionsChanged } from "../lib/transactions";
import type { Transaction as StoredTransaction } from "../lib/transactions";
import { fetchBudget } from "../lib/budgets";
import type { BudgetCategory } from "../lib/budgets";
import { fetchGoals } from "../lib/goals";
import type { SavingsGoal } from "../lib/goals";
import { computeHealth, computeInsights, computeRecurring } from "../lib/insights";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import type { Screen } from "../App";

// ── Types ─────────────────────────────────────────────────────────────────────

// ── Utilities ─────────────────────────────────────────────────────────────────

function greeting(name: string): string {
  const h = new Date().getHours();
  const part = h < 12 ? "morning" : h < 17 ? "afternoon" : "evening";
  return `Good ${part}, ${name}!`;
}

function todayLabel(): string {
  return new Date().toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function fmt(n: number): string {
  return "$" + Math.abs(n).toLocaleString("en-AU", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function fmtDec(n: number): string {
  return "$" + Math.abs(n).toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function isInCalendarMonth(dateStr: string, year: number, monthIndex: number) {
  const [y, m] = dateStr.slice(0, 10).split("-").map(Number);
  return y === year && m === monthIndex + 1;
}

function buildTrendData(txns: StoredTransaction[]) {
  const now = new Date();
  const months: { key: string; month: string; income: number; expenses: number }[] = [];
  for (let i = 5; i >= 0; i -= 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({
      key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
      month: d.toLocaleDateString("en-AU", { month: "short" }),
      income: 0,
      expenses: 0,
    });
  }
  for (const t of txns) {
    const bucket = months.find((item) => item.key === t.date.slice(0, 7));
    if (!bucket) continue;
    const amt = Math.abs(t.amount);
    if (t.type === "income") bucket.income += amt;
    else if (t.type === "expense") bucket.expenses += amt;
  }
  return months.map(({ month, income, expenses }) => ({ month, income, expenses }));
}

const CAT_COLOR: Record<string, string> = {
  "Food & Dining": "#10B981",
  Transport:       "#F59E0B",
  Utilities:       "#8B5CF6",
  Entertainment:   "#EC4899",
  Shopping:        "#F97316",
  Health:          "#14B8A6",
  Housing:         "#2563EB",
  Education:       "#6366F1",
  Income:          "#10B981",
  Other:           "#64748B",
};

// ── Sub-components ────────────────────────────────────────────────────────────

function KpiCard({
  label, value, icon, iconBg, valueColor,
}: {
  label: string; value: string; icon: React.ReactNode;
  iconBg: string; valueColor?: string;
}) {
  return (
    <div className="bg-white rounded-2xl border border-[#E2E8F0] card-shadow p-4 sm:p-5 flex items-center gap-4">
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${iconBg}`}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-xs font-medium text-[#64748B] mb-0.5">{label}</p>
        <p className={`text-lg sm:text-xl font-bold font-mono truncate ${valueColor ?? "text-[#0F172A]"}`}>{value}</p>
      </div>
    </div>
  );
}

function HealthRing({ score }: { score: number }) {
  const size = 80;
  const r = 32;
  const circ = 2 * Math.PI * r;
  const dash = (score / 100) * circ;
  return (
    <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#F1F5F9" strokeWidth="8" />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none"
        stroke="#10B981" strokeWidth="8"
        strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
        style={{ transition: "stroke-dasharray 1s ease" }}
      />
    </svg>
  );
}

function SubScore({ label, pct, color }: { label: string; pct: number | null; color: string }) {
  return (
    <div>
      <div className="flex justify-between mb-1">
        <span className="text-[11px] text-[#64748B]">{label}</span>
        <span className="text-[11px] font-semibold" style={{ color }}>{pct === null ? "no data yet" : `${pct}%`}</span>
      </div>
      <div className="h-1.5 bg-[#F1F5F9] rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct ?? 0}%`, backgroundColor: color }} />
      </div>
    </div>
  );
}

function InsightCard({
  borderColor, iconBg, iconStroke, title, body,
}: {
  borderColor: string; iconBg: string; iconStroke: string;
  title: string; body: string;
}) {
  return (
    <div
      className="bg-white rounded-2xl border border-[#E2E8F0] card-shadow p-4 min-w-[260px] max-w-[300px] shrink-0 flex flex-col gap-3"
      style={{ borderLeftWidth: 3, borderLeftColor: borderColor }}
    >
      <div className="flex items-start gap-3">
        <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${iconBg}`}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={iconStroke} strokeWidth="2.5" strokeLinecap="round">
            {borderColor === "#F59E0B" ? (
              <>
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
              </>
            ) : borderColor === "#3B82F6" ? (
              <>
                <circle cx="12" cy="12" r="10"/>
                <line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
              </>
            ) : (
              <polyline points="20 6 9 17 4 12"/>
            )}
          </svg>
        </div>
        <div className="min-w-0">
          <p className="text-xs font-bold text-[#0F172A] mb-1">{title}</p>
          <p className="text-[11px] text-[#64748B] leading-relaxed">{body}</p>
        </div>
      </div>
      <div className="mt-auto">
        <span className="text-[9px] text-[#94A3B8] bg-[#F8FAFC] border border-[#E2E8F0] px-2 py-0.5 rounded-full">
          Educational information only
        </span>
      </div>
    </div>
  );
}

// ── Main Dashboard ────────────────────────────────────────────────────────────

export default function Dashboard({
  navigate,
  userName = "User",
  userId,
  refreshKey = 0,
}: {
  navigate: (s: Screen) => void;
  userName: string;
  userId: string;
  refreshKey?: number;
}) {
  const firstName = userName.split(" ")[0] || "User";

  const [transactions, setTransactions] = useState<StoredTransaction[]>([]);
  const [txLoading, setTxLoading] = useState(true);
  const [txError, setTxError] = useState("");

  useEffect(() => {
    let cancelled = false;
    let requestId = 0;

    const load = () => {
      const id = ++requestId;
      setTxLoading(true);
      setTxError("");
      fetchTransactions()
        .then((rows) => {
          if (cancelled || id !== requestId) return;
          setTransactions(rows);
          setTxLoading(false);
        })
        .catch((err) => {
          if (cancelled || id !== requestId) return;
          setTransactions([]);
          setTxError(err instanceof Error ? err.message : "Could not load transactions.");
          setTxLoading(false);
        });
    };

    load();
    const unsubscribe = subscribeTransactionsChanged(load);
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [userId, refreshKey]);
  const [budgetData, setBudgetData]   = useState<BudgetCategory[]>([]);
  const [savingsData, setSavingsData]  = useState<SavingsGoal[]>([]);
  useEffect(() => {
    let cancelled = false;
    // Budgets and goals are secondary on this page: if they fail to load the
    // rest of the dashboard still works.
    fetchBudget().then((rows) => { if (!cancelled) setBudgetData(rows); }).catch(() => undefined);
    fetchGoals().then((rows) => { if (!cancelled) setSavingsData(rows); }).catch(() => undefined);
    return () => { cancelled = true; };
  }, [userId, refreshKey]);

  // ── Derived KPIs ─────────────────────────────────────────────────────────────
  const { monthlyIncome, monthlyExpenses, budgetRemaining } = useMemo(() => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear  = now.getFullYear();

    const income = transactions
      .filter((t) => t.type === "income" && isInCalendarMonth(t.date, currentYear, currentMonth))
      .reduce((sum, t) => sum + Math.abs(t.amount), 0);

    const expenses = transactions
      .filter((t) => t.type === "expense" && isInCalendarMonth(t.date, currentYear, currentMonth))
      .reduce((sum, t) => sum + Math.abs(t.amount), 0);

    // Same rule as the Budget page: budgeted amount minus what was spent in the
    // budgeted categories. Spending in categories without a budget is not counted.
    const totalBudgeted = budgetData.reduce((s, b) => s + b.budgeted, 0);
    const spentInBudgets = budgetData.reduce((s, b) => s + b.spent, 0);
    const remaining = totalBudgeted > 0 ? totalBudgeted - spentInBudgets : Number.NaN;

    return { monthlyIncome: income, monthlyExpenses: expenses, budgetRemaining: remaining };
  }, [transactions, budgetData]);

  const netBalance = monthlyIncome - monthlyExpenses;

  // ── Spending trend ────────────────────────────────────────────────────────────
  const trendData = useMemo(() => buildTrendData(transactions), [transactions]);

  // ── Recent transactions (last 5) ─────────────────────────────────────────────
  const recentTx = useMemo(() => {
    const sorted = [...transactions].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
    );
    return sorted.slice(0, 5);
  }, [transactions]);

  // ── Savings goals (first 3) ───────────────────────────────────────────────────
  const topGoals = useMemo(() => savingsData.slice(0, 3), [savingsData]);

  // ── Calculated from the user's own data ──────────────────────────────────────
  const health    = useMemo(() => computeHealth(transactions, budgetData, savingsData), [transactions, budgetData, savingsData]);
  const insights  = useMemo(() => computeInsights(transactions, budgetData), [transactions, budgetData]);
  const recurring = useMemo(() => computeRecurring(transactions).slice(0, 4), [transactions]);

  // ── Empty state ───────────────────────────────────────────────────────────────
  if (!txLoading && !txError && transactions.length === 0) {
    return (
      <div className="p-4 sm:p-6 lg:p-8 max-w-[1200px]">
        <h1 className="text-xl sm:text-2xl font-bold text-[#0F172A] mb-1">{greeting(firstName)}</h1>
        <p className="text-sm text-[#64748B] mb-8">{todayLabel()}</p>
        <div className="bg-white rounded-2xl border border-[#E2E8F0] card-shadow p-10 flex flex-col items-center text-center max-w-md mx-auto">
          <div className="w-16 h-16 rounded-2xl bg-[#EFF6FF] flex items-center justify-center mb-5">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/>
            </svg>
          </div>
          <h2 className="text-lg font-bold text-[#0F172A] mb-2">No transactions yet</h2>
          <p className="text-sm text-[#64748B] leading-relaxed mb-6">
            Add your first income or expense to see your balance, spending trend, budget and insights here.
          </p>
          <button onClick={() => navigate("transactions")}
            className="bg-[#2563EB] text-white font-semibold px-6 py-3 rounded-xl hover:bg-[#1D4ED8] transition-colors">
            Add a transaction
          </button>
          <button onClick={() => navigate("bankConnect")}
            className="mt-3 text-sm text-[#64748B] hover:text-[#0F172A] transition-colors">
            Or try the simulated bank connection (demo only) →
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1200px] space-y-5 sm:space-y-6">

      {/* ── 1. Personalized Header ── */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-[#0F172A]">{greeting(firstName)}</h1>
        <p className="text-sm text-[#64748B] mt-0.5">{todayLabel()}</p>
        {txLoading && <p className="text-xs text-[#64748B] mt-2">Loading your transactions…</p>}
        {txError && (
          <p className="text-sm text-[#DC2626] mt-2 bg-[#FEF2F2] border border-[#FECACA] rounded-xl px-3 py-2">{txError}</p>
        )}
      </div>

      {/* ── 2. KPI Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <KpiCard
          label="Monthly Income"
          value={txLoading ? "…" : fmt(monthlyIncome)}
          iconBg="bg-[#ECFDF5]"
          valueColor="text-[#10B981]"
          icon={
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="2" strokeLinecap="round">
              <line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
            </svg>
          }
        />
        <KpiCard
          label="Monthly Expenses"
          value={txLoading ? "…" : fmt(monthlyExpenses)}
          iconBg="bg-[#FEF2F2]"
          valueColor="text-[#EF4444]"
          icon={
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2" strokeLinecap="round">
              <path d="M20 12V22H4V12"/><path d="M22 7H2v5h20V7z"/><path d="M12 22V7"/><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"/><path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"/>
            </svg>
          }
        />
        <KpiCard
          label="Net Balance"
          value={txLoading ? "…" : netBalance < 0 ? "-" + fmt(netBalance) : fmt(netBalance)}
          iconBg={netBalance >= 0 ? "bg-[#EFF6FF]" : "bg-[#FEF2F2]"}
          valueColor={netBalance >= 0 ? "text-[#2563EB]" : "text-[#EF4444]"}
          icon={
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={netBalance >= 0 ? "#2563EB" : "#EF4444"} strokeWidth="2" strokeLinecap="round">
              <polyline points={netBalance >= 0 ? "23 6 13.5 15.5 8.5 10.5 1 18" : "23 18 13.5 8.5 8.5 13.5 1 6"}/>
              <polyline points={netBalance >= 0 ? "17 6 23 6 23 12" : "17 18 23 18 23 12"}/>
            </svg>
          }
        />
        <KpiCard
          label="Budget Remaining"
          value={txLoading ? "…" : Number.isNaN(budgetRemaining) ? "Not set" : budgetRemaining < 0 ? "-" + fmt(budgetRemaining) : fmt(budgetRemaining)}
          iconBg="bg-[#F5F3FF]"
          valueColor={Number.isNaN(budgetRemaining) ? "text-[#94A3B8]" : budgetRemaining >= 0 ? "text-[#7C3AED]" : "text-[#EF4444]"}
          icon={
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#7C3AED" strokeWidth="2" strokeLinecap="round">
              <path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/>
            </svg>
          }
        />
      </div>

      {/* ── 3. Financial Health Score ── */}
      <div className="bg-white rounded-2xl border border-[#E2E8F0] card-shadow p-5 sm:p-6">
        <div className="flex items-start gap-6 flex-wrap">
          {/* Ring + score */}
          <div className="relative shrink-0">
            <HealthRing score={health.score ?? 0} />
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-xl font-extrabold text-[#0F172A]">{health.score ?? "–"}</span>
              <span className="text-[10px] text-[#94A3B8]">/100</span>
            </div>
          </div>
          {/* Labels + sub-scores */}
          <div className="flex-1 min-w-[180px]">
            <div className="flex items-center gap-3 mb-1">
              <h3 className="font-bold text-[#0F172A]">Financial Health Score</h3>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#ECFDF5] text-[#10B981]">{health.rating}</span>
            </div>
            <p className="text-xs text-[#64748B] mb-4">{health.note}</p>
            <div className="space-y-2.5">
              {health.parts.map((p) => (
                <SubScore key={p.key} label={p.label} pct={p.pct} color={p.color} />
              ))}
            </div>
          </div>
          {/* CTA */}
          <div className="shrink-0 self-center">
            <button
              onClick={() => navigate("healthScore")}
              className="text-xs font-semibold text-[#10B981] border border-[#10B981] px-4 py-2 rounded-xl hover:bg-[#ECFDF5] transition-colors whitespace-nowrap"
            >
              View Full Report →
            </button>
          </div>
        </div>
      </div>

      {/* ── 4. AI Insight Cards ── */}
      <div>
        <h2 className="font-bold text-[#0F172A] mb-3 text-sm uppercase tracking-wide">Insights from your data</h2>
        <div className="flex gap-4 overflow-x-auto pb-2" style={{ scrollbarWidth: "none" }}>
          {insights.map((ins) => (
            <InsightCard
              key={ins.title}
              borderColor={ins.tone === "warn" ? "#F59E0B" : ins.tone === "info" ? "#3B82F6" : "#10B981"}
              iconBg={ins.tone === "warn" ? "bg-[#FEF3C7]" : ins.tone === "info" ? "bg-[#EFF6FF]" : "bg-[#ECFDF5]"}
              iconStroke={ins.tone === "warn" ? "#D97706" : ins.tone === "info" ? "#2563EB" : "#10B981"}
              title={ins.title}
              body={ins.body}
            />
          ))}
        </div>
      </div>

      {/* ── 5. Spending Trend Chart ── */}
      <div className="bg-white rounded-2xl border border-[#E2E8F0] card-shadow p-5 sm:p-6">
        <div className="flex items-center justify-between mb-1">
          <h2 className="font-bold text-[#0F172A]">Spending Trend</h2>
          <button onClick={() => navigate("analytics")} className="text-xs font-medium text-[#2563EB] hover:underline">Analytics →</button>
        </div>
        <p className="text-xs text-[#64748B] mb-5">Last 6 months — income vs expenses</p>
        <ResponsiveContainer width="100%" height={180}>
          <AreaChart data={trendData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="dGradInc" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10B981" stopOpacity={0.18} />
                <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="dGradExp" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#EF4444" stopOpacity={0.15} />
                <stop offset="95%" stopColor="#EF4444" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
            <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#94A3B8" }} axisLine={false} tickLine={false} />
            <YAxis
              tick={{ fontSize: 11, fill: "#94A3B8" }} axisLine={false} tickLine={false}
              tickFormatter={(v: unknown) => typeof v === "number" ? `$${(v / 1000).toFixed(1)}k` : String(v)}
              width={44}
            />
            <Tooltip
              formatter={(v: unknown) => [typeof v === "number" ? "$" + v.toFixed(0) : String(v), ""]}
              contentStyle={{ borderRadius: 10, border: "1px solid #E2E8F0", fontSize: 12 }}
            />
            <Area type="monotone" dataKey="income"   stroke="#10B981" strokeWidth={2} fill="url(#dGradInc)" dot={{ r: 3, fill: "#10B981", strokeWidth: 0 }} name="Income" />
            <Area type="monotone" dataKey="expenses" stroke="#EF4444" strokeWidth={2} fill="url(#dGradExp)" dot={{ r: 3, fill: "#EF4444", strokeWidth: 0 }} name="Expenses" />
          </AreaChart>
        </ResponsiveContainer>
        <div className="flex items-center gap-5 mt-2 justify-end">
          <div className="flex items-center gap-1.5 text-xs text-[#64748B]">
            <span className="w-3 h-1 rounded-full bg-[#10B981] inline-block" /> Income
          </div>
          <div className="flex items-center gap-1.5 text-xs text-[#64748B]">
            <span className="w-3 h-1 rounded-full bg-[#EF4444] inline-block" /> Expenses
          </div>
        </div>
      </div>

      {/* ── 3-column row: Recent Tx · Upcoming Bills · Savings Goals ── */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">

        {/* ── 6. Recent Transactions ── */}
        <div className="bg-white rounded-2xl border border-[#E2E8F0] card-shadow p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-[#0F172A]">Recent Transactions</h3>
            <button onClick={() => navigate("transactions")} className="text-xs font-medium text-[#2563EB] hover:underline shrink-0">
              View all →
            </button>
          </div>
          <div className="space-y-0">
            {txLoading ? (
              <div className="py-6 text-center text-[#94A3B8]">
                <p className="text-sm">Loading transactions…</p>
              </div>
            ) : recentTx.length === 0 ? (
              <div className="py-6 text-center text-[#94A3B8]">
                <p className="text-sm">No transactions yet</p>
                <p className="text-xs mt-1">Add your first transaction above</p>
              </div>
            ) : (
              recentTx.map((tx, i) => {
                const catColor = CAT_COLOR[tx.category] ?? "#64748B";
                const dateStr = new Date(tx.date).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
                return (
                  <div key={tx.id} className={`flex items-center gap-3 py-2.5 ${i < recentTx.length - 1 ? "border-b border-[#F8FAFC]" : ""}`}>
                    <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: catColor + "22" }}>
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: catColor }} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-[#0F172A] truncate">{tx.description}</p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="text-[9px] font-medium px-1.5 py-0.5 rounded-full" style={{ backgroundColor: catColor + "22", color: catColor }}>
                          {tx.category}
                        </span>
                        <span className="text-[10px] text-[#94A3B8]">{dateStr}</span>
                      </div>
                    </div>
                    <span className={`text-xs font-bold font-mono shrink-0 ${tx.type === "income" ? "text-[#10B981]" : "text-[#EF4444]"}`}>
                      {tx.type === "income" ? "+" : "-"}{fmtDec(tx.amount)}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* ── 7. Upcoming Bills ── */}
        <div className="bg-white rounded-2xl border border-[#E2E8F0] card-shadow p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-[#0F172A]">Recurring Payments</h3>
            <button onClick={() => navigate("budget")} className="text-xs font-medium text-[#2563EB] hover:underline shrink-0">
              Budget →
            </button>
          </div>
          {recurring.length === 0 ? (
            <p className="text-xs text-[#94A3B8] py-4 text-center">
              No recurring payments yet. Mark an expense as “recurring” when you add it and it will appear here.
            </p>
          ) : (
            <div className="space-y-3">
              {recurring.map((bill) => {
                const isDueSoon = bill.daysAway <= 7;
                return (
                  <div key={bill.name} className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${isDueSoon ? "bg-[#FEF3C7]" : "bg-[#F8FAFC]"}`}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={isDueSoon ? "#D97706" : "#64748B"} strokeWidth="2" strokeLinecap="round">
                        <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/>
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-[#0F172A] truncate">{bill.name}</p>
                      <p className="text-[10px] text-[#94A3B8]">
                        Next around {bill.due.toLocaleDateString("en-AU", { day: "numeric", month: "short" })}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xs font-bold font-mono text-[#0F172A]">{fmt(bill.amount)}</p>
                      <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full ${isDueSoon ? "bg-[#FEF3C7] text-[#D97706]" : "bg-[#F8FAFC] text-[#64748B]"}`}>
                        {bill.daysAway === 0 ? "Today" : isDueSoon ? `In ${bill.daysAway} days` : "Upcoming"}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── 8. Savings Goals Snapshot ── */}
        <div className="bg-white rounded-2xl border border-[#E2E8F0] card-shadow p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-[#0F172A]">Savings Goals</h3>
            <button onClick={() => navigate("savings")} className="text-xs font-medium text-[#2563EB] hover:underline shrink-0">
              View all →
            </button>
          </div>
          {topGoals.length === 0 ? (
            <div className="py-6 text-center text-[#94A3B8]">
              <p className="text-sm">No goals set yet</p>
              <button onClick={() => navigate("savings")} className="text-xs text-[#2563EB] mt-1 hover:underline">Create your first goal →</button>
            </div>
          ) : (
            <div className="space-y-4">
              {topGoals.map((g, idx) => {
                const pct = Math.min(100, Math.round((g.current / g.target) * 100));
                const colors = ["#2563EB", "#10B981", "#7C3AED"];
                const color  = colors[idx % colors.length];
                return (
                  <div key={g.id}>
                    <div className="flex justify-between items-baseline mb-1.5">
                      <p className="text-xs font-semibold text-[#0F172A] truncate">{g.name}</p>
                      <span className="text-xs font-bold font-mono shrink-0 ml-2" style={{ color }}>{pct}%</span>
                    </div>
                    <div className="h-2 bg-[#F1F5F9] rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{ width: `${pct}%`, backgroundColor: color }}
                      />
                    </div>
                    <div className="flex justify-between mt-1">
                      <span className="text-[10px] text-[#94A3B8] font-mono">{fmt(g.current)} saved</span>
                      <span className="text-[10px] text-[#94A3B8] font-mono">of {fmt(g.target)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── 9. Quick Actions ── */}
      <div>
        <h2 className="font-bold text-[#0F172A] mb-3 text-sm uppercase tracking-wide">Quick Actions</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
          {([
            {
              label: "Add Transaction",
              desc: "Record income or expense",
              screen: "transactions" as Screen,
              iconBg: "bg-[#EFF6FF]",
              icon: (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="2" strokeLinecap="round">
                  <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                </svg>
              ),
            },
            {
              label: "Budget",
              desc: "Manage monthly limits",
              screen: "budget" as Screen,
              iconBg: "bg-[#F5F3FF]",
              icon: (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#7C3AED" strokeWidth="2" strokeLinecap="round">
                  <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
                </svg>
              ),
            },
            {
              label: "Goals",
              desc: "Track savings progress",
              screen: "savings" as Screen,
              iconBg: "bg-[#ECFDF5]",
              icon: (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="2" strokeLinecap="round">
                  <circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>
                </svg>
              ),
            },
            {
              label: "Analytics",
              desc: "Deep spending analysis",
              screen: "analytics" as Screen,
              iconBg: "bg-[#FFF7ED]",
              icon: (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#EA580C" strokeWidth="2" strokeLinecap="round">
                  <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>
                </svg>
              ),
            },
          ] as const).map((c) => (
            <button
              key={c.label}
              onClick={() => navigate(c.screen)}
              className="bg-white rounded-2xl border border-[#E2E8F0] card-shadow p-4 text-left hover:-translate-y-0.5 transition-transform"
            >
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${c.iconBg}`}>
                {c.icon}
              </div>
              <p className="text-sm font-bold text-[#0F172A]">{c.label}</p>
              <p className="text-xs text-[#64748B] mt-0.5">{c.desc}</p>
            </button>
          ))}
        </div>
      </div>

      {/* ── Disclaimer ── */}
      <p className="text-[10px] text-[#94A3B8] text-center pb-2 leading-relaxed">
        SmartBudget provides educational information and budgeting tools only. It does not provide personalised financial,
        investment, tax, legal, insurance, or credit advice.
      </p>
    </div>
  );
}
