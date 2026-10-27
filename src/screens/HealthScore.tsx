import { useState, useEffect, useMemo } from "react";
import type { ReactElement } from "react";
import type { Screen } from "../App";
import { fetchTransactions } from "../lib/transactions";
import type { Transaction } from "../lib/transactions";
import { fetchBudget } from "../lib/budgets";
import type { BudgetCategory } from "../lib/budgets";
import { fetchGoals } from "../lib/goals";
import type { SavingsGoal } from "../lib/goals";
import { computeHealth } from "../lib/insights";

// Educational wording for each measure. Nothing here claims facts about the user.
const TIPS: Record<string, { low: string; mid: string; high: string; action: string }> = {
  adherence: {
    low: "Several budget lines are over their limit this month.",
    mid: "Most budget lines are on track.",
    high: "You are within budget on every line this month.",
    action: "Review the budget lines that went over and decide whether the limit or the spending should change.",
  },
  savings: {
    low: "You are saving little of this month’s income so far.",
    mid: "You are saving a reasonable share of income.",
    high: "You are saving 20% or more of this month’s income.",
    action: "Some people choose to move money to savings on payday so it is set aside before spending.",
  },
  consistency: {
    low: "Your monthly spending has varied a lot recently.",
    mid: "Your monthly spending is fairly steady.",
    high: "Your monthly spending has been very steady.",
    action: "Comparing months on the Analytics screen can show where the swings come from.",
  },
  goals: {
    low: "Your goals are at an early stage.",
    mid: "You are part of the way to your goals.",
    high: "You are close to reaching your goals.",
    action: "A short monthly check of each goal’s contribution keeps it on track.",
  },
};
const tierOf = (pct: number) => (pct >= 70 ? "high" : pct >= 40 ? "mid" : "low");

export default function HealthScore({ navigate }: { navigate: (s: Screen) => void }) {
  const [ringOffset, setRingOffset] = useState(565);
  const [txs, setTxs] = useState<Transaction[]>([]);
  const [budget, setBudget] = useState<BudgetCategory[]>([]);
  const [goals, setGoals] = useState<SavingsGoal[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    let cancelled = false;
    Promise.all([fetchTransactions(), fetchBudget(), fetchGoals()])
      .then(([t, b, g]) => {
        if (cancelled) return;
        setTxs(t); setBudget(b); setGoals(g); setLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        setLoadError(err instanceof Error ? err.message : "We could not load your data.");
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  const health = useMemo(() => computeHealth(txs, budget, goals), [txs, budget, goals]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setRingOffset(565 * (1 - (health.score ?? 0) / 100));
    }, 100);
    return () => clearTimeout(timer);
  }, [health.score]);

  const ICONS: Record<string, ReactElement> = {
    adherence: <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="2" y="3" width="20" height="14" rx="2" /><path d="M8 21h8M12 17v4" /></svg>,
    savings: <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></svg>,
    consistency: <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12" /></svg>,
    goals: <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
  };

  const categories = health.parts.map((p) => ({
    label: p.label,
    score: p.pct,
    color: p.color,
    icon: ICONS[p.key],
    tip: p.pct === null
      ? "Not enough data yet. Add the related information and this measure will appear."
      : TIPS[p.key][tierOf(p.pct)],
  }));

  const strengths = health.parts
    .filter((p) => p.pct !== null && p.pct >= 70)
    .map((p) => `${p.label}: ${TIPS[p.key].high}`);
  const improvements = health.parts
    .filter((p) => p.pct !== null && p.pct < 50)
    .map((p) => `${p.label}: ${TIPS[p.key].low}`);

  const recommendations = health.parts
    .filter((p) => p.pct !== null && p.pct < 70)
    .map((p) => ({
      title: `About ${p.label.toLowerCase()}`,
      body: TIPS[p.key].action,
      icon: <span style={{ color: p.color }}>{ICONS[p.key]}</span>,
    }));

  return (
    <div className="min-h-screen bg-slate-50 pb-16">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-4 sm:px-8 py-4">
        <nav className="flex items-center gap-2 text-sm text-slate-500 mb-3">
          <button
            onClick={() => navigate("dashboard")}
            className="hover:text-blue-600 transition-colors font-medium"
          >
            Dashboard
          </button>
          <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <polyline points="9 18 15 12 9 6" />
          </svg>
          <span className="text-slate-800 font-medium">Financial Health</span>
        </nav>
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate("dashboard")}
            className="p-2 rounded-lg hover:bg-slate-100 transition-colors text-slate-500"
            aria-label="Back to dashboard"
          >
            <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Financial Health Score</h1>
            <p className="text-slate-500 text-sm mt-0.5">Calculated from the transactions, budget and goals you have entered</p>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-8 py-8 space-y-8">

        {/* Hero card */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8">
          <div className="flex flex-col sm:flex-row items-center gap-8">
            {/* Ring */}
            <div className="flex-shrink-0 flex flex-col items-center">
              <div className="relative">
                <svg width="200" height="200" viewBox="0 0 200 200">
                  {/* Background ring */}
                  <circle
                    cx="100"
                    cy="100"
                    r="90"
                    fill="none"
                    stroke="#E2E8F0"
                    strokeWidth="16"
                  />
                  {/* Score ring */}
                  <circle
                    cx="100"
                    cy="100"
                    r="90"
                    fill="none"
                    stroke="#10B981"
                    strokeWidth="16"
                    strokeLinecap="round"
                    strokeDasharray="565"
                    strokeDashoffset={ringOffset}
                    transform="rotate(-90 100 100)"
                    style={{ transition: "stroke-dashoffset 1.2s cubic-bezier(0.4, 0, 0.2, 1)" }}
                  />
                  {/* Center text */}
                  <text x="100" y="92" textAnchor="middle" fill="#0F172A" fontSize="36" fontWeight="700" fontFamily="system-ui, sans-serif">
                    {health.score ?? "–"}
                  </text>
                  <text x="100" y="112" textAnchor="middle" fill="#64748B" fontSize="13" fontFamily="system-ui, sans-serif">
                    out of 100
                  </text>
                </svg>
              </div>
              <p className="text-xs text-slate-400 mt-2 text-center">Calculated when you open this page</p>
            </div>

            {/* Interpretation */}
            <div className="flex-1 text-center sm:text-left">
              <div className="inline-flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-full px-4 py-1.5 mb-4">
                <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block"></span>
                <span className="text-emerald-700 font-semibold text-sm">{health.rating}</span>
              </div>
              <h2 className="text-3xl font-bold text-slate-900 mb-2">
                {loading ? "Calculating…" : health.score === null ? "Not enough data yet" : `Your score: ${health.score}`}
              </h2>
              <p className="text-slate-600 leading-relaxed mb-4">
                {loadError || health.note}
              </p>
              <div className="grid grid-cols-2 gap-4 mt-6 pt-5 border-t border-slate-100">
                <div className="text-center">
                  <p className="text-2xl font-bold text-slate-900">{health.score ?? "–"}</p>
                  <p className="text-xs text-slate-500 mt-0.5">Overall</p>
                </div>
                <div className="text-center border-l border-slate-100">
                  <p className="text-2xl font-bold text-slate-900">{health.parts.filter((p) => p.pct !== null).length} of 4</p>
                  <p className="text-xs text-slate-500 mt-0.5">measures with data</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Category breakdown */}
        <div>
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Score Breakdown</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {categories.map((cat) => (
              <div
                key={cat.label}
                className="bg-white rounded-xl border border-slate-200 shadow-sm p-5"
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2.5">
                    <div
                      className="p-2 rounded-lg"
                      style={{ backgroundColor: cat.color + "15", color: cat.color }}
                    >
                      {cat.icon}
                    </div>
                    <span className="font-medium text-slate-800 text-sm">{cat.label}</span>
                  </div>
                  <span className="text-xl font-bold text-slate-900">{cat.score ?? "–"}</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2 mb-3">
                  <div
                    className="h-2 rounded-full"
                    style={{ width: `${cat.score ?? 0}%`, backgroundColor: cat.color }}
                  />
                </div>
                <p className="text-xs text-slate-500 leading-relaxed">{cat.tip}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Strengths and improvements side by side */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Strengths */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
            <div className="flex items-center gap-2 mb-4">
              <div className="p-1.5 rounded-lg bg-emerald-50">
                <svg width="16" height="16" fill="none" stroke="#10B981" strokeWidth="2.5" viewBox="0 0 24 24">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                  <polyline points="22 4 12 14.01 9 11.01" />
                </svg>
              </div>
              <h3 className="font-semibold text-slate-900">Strengths</h3>
            </div>
            <ul className="space-y-3">
              {strengths.length === 0 && <li className="text-sm text-slate-500">Nothing to show yet.</li>}
              {strengths.map((item, i) => (
                <li key={i} className="flex items-start gap-2.5 text-sm text-slate-700">
                  <svg className="flex-shrink-0 mt-0.5" width="15" height="15" fill="none" stroke="#10B981" strokeWidth="2.5" viewBox="0 0 24 24">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  {item}
                </li>
              ))}
            </ul>
          </div>

          {/* Areas for improvement */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
            <div className="flex items-center gap-2 mb-4">
              <div className="p-1.5 rounded-lg bg-amber-50">
                <svg width="16" height="16" fill="none" stroke="#F59E0B" strokeWidth="2.5" viewBox="0 0 24 24">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                  <line x1="12" y1="9" x2="12" y2="13" />
                  <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
              </div>
              <h3 className="font-semibold text-slate-900">Areas to Improve</h3>
            </div>
            <ul className="space-y-3">
              {improvements.length === 0 && <li className="text-sm text-slate-500">Nothing to show yet.</li>}
              {improvements.map((item, i) => (
                <li key={i} className="flex items-start gap-2.5 text-sm text-slate-700">
                  <svg className="flex-shrink-0 mt-0.5" width="15" height="15" fill="none" stroke="#F59E0B" strokeWidth="2.5" viewBox="0 0 24 24">
                    <line x1="12" y1="9" x2="12" y2="13" />
                    <line x1="12" y1="17" x2="12.01" y2="17" />
                  </svg>
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Recommendations */}
        <div>
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Recommended Actions</h2>
          <div className="space-y-3">
            {recommendations.map((rec, i) => (
              <div
                key={i}
                className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 flex items-start gap-4"
              >
                <div className="flex-shrink-0 p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                  {rec.icon}
                </div>
                <div>
                  <h3 className="font-semibold text-slate-900 mb-1">{rec.title}</h3>
                  <p className="text-sm text-slate-600 leading-relaxed">{rec.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Score scale reference */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <h3 className="font-semibold text-slate-900 mb-4 text-sm">Score Scale Reference</h3>
          <div className="space-y-2">
            {[
              { range: "85–100", label: "Excellent", color: "#10B981", bg: "#F0FDF4", border: "#BBF7D0", active: health.rating === "Excellent" },
              { range: "70–84", label: "Good", color: "#2563EB", bg: "#EFF6FF", border: "#BFDBFE", active: health.rating === "Good" },
              { range: "50–69", label: "Fair", color: "#F59E0B", bg: "#FFFBEB", border: "#FDE68A", active: health.rating === "Fair" },
              { range: "0–49", label: "Needs Attention", color: "#EF4444", bg: "#FFF1F2", border: "#FECDD3", active: health.rating === "Needs attention" },
            ].map((tier) => (
              <div
                key={tier.label}
                className="flex items-center justify-between rounded-lg px-4 py-2.5 border text-sm"
                style={{
                  backgroundColor: tier.active ? tier.bg : "transparent",
                  borderColor: tier.active ? tier.border : "#E2E8F0",
                }}
              >
                <div className="flex items-center gap-2">
                  <span
                    className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: tier.color }}
                  />
                  <span className="font-medium" style={{ color: tier.active ? tier.color : "#475569" }}>
                    {tier.label}
                  </span>
                  {tier.active && (
                    <span className="text-xs font-semibold px-1.5 py-0.5 rounded-full" style={{ backgroundColor: tier.color, color: "#fff" }}>
                      You
                    </span>
                  )}
                </div>
                <span className="text-slate-500 tabular-nums">{tier.range}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Disclaimer */}
        <div className="flex items-start gap-3 bg-slate-100 rounded-xl px-5 py-4 border border-slate-200">
          <svg className="flex-shrink-0 mt-0.5" width="16" height="16" fill="none" stroke="#64748B" strokeWidth="2" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <p className="text-xs text-slate-500 leading-relaxed">
            Educational information only — this score is based on your in-app activity only and does not constitute personalised financial, investment, tax, or legal advice.
          </p>
        </div>

      </div>
    </div>
  );
}
