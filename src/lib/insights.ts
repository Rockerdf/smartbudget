import type { Transaction } from "./transactions";
import type { BudgetCategory } from "./budgets";
import type { SavingsGoal } from "./goals";

// Everything here is calculated from the signed-in user's own data. Nothing is
// invented. The wording is educational and never personal financial advice.

const clamp = (n: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, n));
const monthKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
const abs = (n: number) => Math.abs(n);

export type HealthPart = { key: string; label: string; pct: number | null; color: string };
export type Health = { score: number | null; rating: string; parts: HealthPart[]; note: string };

function totalsByMonth(txs: Transaction[]) {
  const map = new Map<string, { income: number; expense: number }>();
  for (const t of txs) {
    const key = t.date.slice(0, 7);
    const row = map.get(key) ?? { income: 0, expense: 0 };
    if (t.type === "income") row.income += abs(t.amount);
    else row.expense += abs(t.amount);
    map.set(key, row);
  }
  return map;
}

export function computeHealth(
  txs: Transaction[], budget: BudgetCategory[], goals: SavingsGoal[], now = new Date()
): Health {
  const months = totalsByMonth(txs);
  const thisMonth = months.get(monthKey(now)) ?? { income: 0, expense: 0 };

  // Savings rate: 20% of income saved counts as full marks.
  const savingsPct = thisMonth.income > 0
    ? clamp(((thisMonth.income - thisMonth.expense) / thisMonth.income / 0.2) * 100)
    : null;

  // Budget adherence: share of this month's budget lines that are not over budget.
  const adherencePct = budget.length > 0
    ? Math.round((budget.filter((b) => b.spent <= b.budgeted).length / budget.length) * 100)
    : null;

  // Spending consistency: how steady monthly spending was over the last 3 months.
  const recent: number[] = [];
  for (let i = 0; i < 3; i += 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const m = months.get(monthKey(d));
    if (m && m.expense > 0) recent.push(m.expense);
  }
  let consistencyPct: number | null = null;
  if (recent.length >= 2) {
    const mean = recent.reduce((s, n) => s + n, 0) / recent.length;
    const variance = recent.reduce((s, n) => s + (n - mean) ** 2, 0) / recent.length;
    consistencyPct = clamp(100 - (Math.sqrt(variance) / mean) * 100);
  }

  // Goal progress: saved so far across all goals.
  const targetSum = goals.reduce((s, g) => s + g.target, 0);
  const goalPct = targetSum > 0 ? clamp((goals.reduce((s, g) => s + g.current, 0) / targetSum) * 100) : null;

  const parts: HealthPart[] = [
    { key: "adherence",   label: "Budget adherence",     pct: adherencePct,   color: "#10B981" },
    { key: "savings",     label: "Savings rate",         pct: savingsPct === null ? null : Math.round(savingsPct), color: "#2563EB" },
    { key: "consistency", label: "Spending consistency", pct: consistencyPct === null ? null : Math.round(consistencyPct), color: "#F59E0B" },
    { key: "goals",       label: "Goal progress",        pct: goalPct === null ? null : Math.round(goalPct), color: "#7C3AED" },
  ];
  const known = parts.filter((p) => p.pct !== null) as (HealthPart & { pct: number })[];
  if (known.length === 0) {
    return {
      score: null, rating: "Not enough data", parts,
      note: "Add transactions, a monthly budget and a savings goal to see your score.",
    };
  }
  const score = Math.round(known.reduce((s, p) => s + p.pct, 0) / known.length);
  const rating = score >= 85 ? "Excellent" : score >= 70 ? "Good" : score >= 50 ? "Fair" : "Needs attention";
  const missing = parts.length - known.length;
  return {
    score, rating, parts,
    note: missing > 0
      ? `Based on ${known.length} of 4 measures. Add more data (budget, goals, a few months of transactions) for a fuller score.`
      : "Based on your budget, savings rate, spending pattern and goals.",
  };
}

export type Insight = { tone: "warn" | "info" | "good"; title: string; body: string };

const money = (n: number) => "$" + Math.round(n).toLocaleString("en-AU");

export function computeInsights(
  txs: Transaction[], budget: BudgetCategory[], now = new Date()
): Insight[] {
  const out: Insight[] = [];
  const thisKey = monthKey(now);
  const prevKey = monthKey(new Date(now.getFullYear(), now.getMonth() - 1, 1));

  const spendBy = (key: string) => {
    const m = new Map<string, number>();
    for (const t of txs) {
      if (t.type !== "expense" || t.date.slice(0, 7) !== key) continue;
      m.set(t.category, (m.get(t.category) ?? 0) + abs(t.amount));
    }
    return m;
  };
  const thisSpend = spendBy(thisKey);
  const prevSpend = spendBy(prevKey);

  // Biggest category change versus last month (needs both months).
  let best: { cat: string; pct: number; diff: number } | null = null;
  for (const [cat, amt] of thisSpend) {
    const before = prevSpend.get(cat);
    if (!before || before < 20) continue;
    const diff = amt - before;
    const pct = (diff / before) * 100;
    if (Math.abs(pct) >= 10 && Math.abs(diff) >= 20 && (!best || Math.abs(diff) > Math.abs(best.diff))) {
      best = { cat, pct, diff };
    }
  }
  if (best) {
    const up = best.diff > 0;
    out.push({
      tone: up ? "warn" : "good",
      title: `${best.cat} spending ${up ? "up" : "down"} ${Math.round(Math.abs(best.pct))}%`,
      body: `You have spent ${money(thisSpend.get(best.cat) ?? 0)} on ${best.cat} so far this month, compared with ${money(prevSpend.get(best.cat) ?? 0)} in all of last month.`,
    });
  }

  // Largest category this month.
  const totalSpend = [...thisSpend.values()].reduce((s, n) => s + n, 0);
  const top = [...thisSpend.entries()].sort((a, b) => b[1] - a[1])[0];
  if (top && totalSpend > 0) {
    out.push({
      tone: "info",
      title: `Biggest category: ${top[0]}`,
      body: `${top[0]} is ${Math.round((top[1] / totalSpend) * 100)}% of this month’s spending (${money(top[1])} of ${money(totalSpend)}).`,
    });
  }

  // Savings rate this month.
  const m = totalsByMonth(txs).get(thisKey);
  if (m && m.income > 0) {
    const rate = Math.round(((m.income - m.expense) / m.income) * 100);
    out.push(rate >= 10
      ? { tone: "good", title: `Saving ${rate}% of income this month`,
          body: "A common guideline is to save 10–20% of income. This figure is based only on the transactions you have entered." }
      : { tone: "warn", title: rate < 0 ? "Spending is above income this month" : `Saving ${rate}% of income this month`,
          body: "A common guideline is to save 10–20% of income. This figure is based only on the transactions you have entered." });
  }

  // Budget lines close to or over their limit.
  const hot = budget.filter((b) => b.budgeted > 0 && b.spent / b.budgeted >= 0.9);
  if (hot.length > 0 && out.length < 4) {
    const b = hot[0];
    out.push({
      tone: "warn",
      title: b.spent > b.budgeted ? `${b.category} is over budget` : `${b.category} budget almost used`,
      body: `${money(b.spent)} spent of a ${money(b.budgeted)} budget this month.`,
    });
  }

  if (out.length === 0) {
    out.push({
      tone: "info",
      title: "Insights appear as you add data",
      body: "Add a few transactions (and a budget) and this panel will show spending changes, your biggest category and your savings rate.",
    });
  }
  return out.slice(0, 3);
}

export type Recurring = { name: string; amount: number; due: Date; daysAway: number };

/** Recurring expenses, with the next monthly date worked out from the latest one. */
export function computeRecurring(txs: Transaction[], now = new Date()): Recurring[] {
  const latest = new Map<string, Transaction>();
  for (const t of txs) {
    if (!t.recurring || t.type !== "expense") continue;
    const key = t.description.trim().toLowerCase();
    const seen = latest.get(key);
    if (!seen || t.date > seen.date) latest.set(key, t);
  }
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return [...latest.values()].map((t) => {
    const [y, mo, d] = t.date.slice(0, 10).split("-").map(Number);
    let due = new Date(y, mo - 1, d);
    while (due < today) due = new Date(due.getFullYear(), due.getMonth() + 1, d);
    return {
      name: t.description,
      amount: abs(t.amount),
      due,
      daysAway: Math.round((due.getTime() - today.getTime()) / 86_400_000),
    };
  }).sort((a, b) => a.daysAway - b.daysAway);
}
