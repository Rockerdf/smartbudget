import { useState, useEffect } from "react";
import type { Screen } from "../App";

import { fetchGoals, createGoal, updateGoal, deleteGoal, addContribution } from "../lib/goals";
import type { SavingsGoal } from "../lib/goals";

const ICON_OPTIONS = ["🏠", "🚗", "✈️", "💊", "🎓", "💰"];
const COLOR_OPTIONS = ["#10B981", "#3B82F6", "#8B5CF6", "#F59E0B", "#EF4444"];

function fmt(n: number) {
  return "$" + n.toLocaleString("en-AU", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function fmtDeadline(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-AU", { month: "short", year: "numeric" });
}

function estimatedCompletion(goal: SavingsGoal): { months: number; date: Date } | null {
  const remaining = goal.target - goal.current;
  if (remaining <= 0) return null;
  if (goal.monthlyContribution <= 0) return null;
  const months = Math.ceil(remaining / goal.monthlyContribution);
  const date = new Date();
  date.setMonth(date.getMonth() + months);
  return { months, date };
}

function isOnTrack(goal: SavingsGoal): boolean {
  const est = estimatedCompletion(goal);
  if (!est) return true;
  const deadline = new Date(goal.deadline + "T00:00:00");
  return est.date <= deadline;
}

function fmtMonthYear(date: Date) {
  return date.toLocaleDateString("en-AU", { month: "long", year: "numeric" });
}

const EMPTY_FORM = {
  name: "",
  target: "",
  current: "",
  monthlyContribution: "",
  deadline: "",
  icon: ICON_OPTIONS[0],
  color: COLOR_OPTIONS[0],
};

type FormState = typeof EMPTY_FORM;

export default function SavingsGoals({ navigate }: { navigate: (s: Screen) => void }) {
  const [goals, setGoals] = useState<SavingsGoal[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [saving, setSaving] = useState(false);
  const [modalMode, setModalMode] = useState<"none" | "add" | "edit">("none");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [formError, setFormError] = useState("");
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [contributionGoalId, setContributionGoalId] = useState<string | null>(null);
  const [contributionAmount, setContributionAmount] = useState("");
  const [contributionError, setContributionError] = useState("");

  const reload = async () => {
    try {
      setGoals(await fetchGoals());
      setLoadError("");
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "We could not load your goals.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void reload(); }, []);

  const totalSaved = goals.reduce((s, g) => s + g.current, 0);
  const totalTarget = goals.reduce((s, g) => s + g.target, 0);
  const onTrackCount = goals.filter(isOnTrack).length;

  function openAdd() {
    setForm(EMPTY_FORM);
    setFormError("");
    setEditingId(null);
    setModalMode("add");
  }

  function openEdit(g: SavingsGoal) {
    setForm({
      name: g.name,
      target: String(g.target),
      current: String(g.current),
      monthlyContribution: String(g.monthlyContribution),
      deadline: g.deadline,
      icon: g.icon,
      color: g.color,
    });
    setFormError("");
    setEditingId(g.id);
    setModalMode("edit");
  }

  function closeModal() {
    setModalMode("none");
    setEditingId(null);
    setFormError("");
  }

  function validateForm(): boolean {
    if (!form.name.trim()) { setFormError("Goal name is required."); return false; }
    const t = parseFloat(form.target);
    const c = parseFloat(form.current);
    const m = parseFloat(form.monthlyContribution);
    if (isNaN(t) || t <= 0) { setFormError("Target amount must be greater than 0."); return false; }
    if (isNaN(c) || c < 0) { setFormError("Current amount must be 0 or more."); return false; }
    if (isNaN(m) || m <= 0) { setFormError("Monthly contribution must be greater than 0."); return false; }
    if (!form.deadline) { setFormError("Deadline is required."); return false; }
    return true;
  }

  async function handleSave() {
    if (!validateForm()) return;
    const input = {
      name: form.name,
      target: parseFloat(form.target),
      current: parseFloat(form.current),
      deadline: form.deadline,
      color: form.color,
      icon: form.icon,
      monthlyContribution: parseFloat(form.monthlyContribution),
    };
    setSaving(true);
    try {
      if (modalMode === "add") await createGoal(input);
      else if (editingId) await updateGoal(editingId, input);
      await reload();
      closeModal();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    setSaving(true);
    try {
      await deleteGoal(id);
      await reload();
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setSaving(false);
      setDeleteConfirmId(null);
    }
  }

  async function handleContribution() {
    const amt = parseFloat(contributionAmount);
    if (isNaN(amt) || amt <= 0) { setContributionError("Enter a positive amount."); return; }
    if (!contributionGoalId) return;
    setSaving(true);
    try {
      await addContribution(contributionGoalId, amt);
      await reload();
      setContributionGoalId(null);
      setContributionAmount("");
      setContributionError("");
    } catch (err) {
      setContributionError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  // For forecast panel: goal furthest from completion
  const incompleteGoals = goals.filter((g) => g.current < g.target);
  const forecastGoal = incompleteGoals.length > 0
    ? incompleteGoals.reduce((worst, g) => {
        const wPct = worst.current / worst.target;
        const gPct = g.current / g.target;
        return gPct < wPct ? g : worst;
      })
    : null;

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1100px]">
      {/* Breadcrumb */}
      <div className="flex items-center gap-1.5 text-xs text-[#94A3B8] mb-4">
        <button onClick={() => navigate("dashboard")} className="hover:text-[#2563EB] transition-colors font-medium">Dashboard</button>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="9 18 15 12 9 6" /></svg>
        <span className="text-[#0F172A] font-medium">Savings Goals</span>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between mb-6 gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-[#0F172A]">Savings Goals</h1>
          <p className="text-sm text-[#64748B] mt-0.5">Track your financial milestones</p>
        </div>
        <button
          onClick={openAdd}
          className="bg-[#2563EB] text-white font-semibold text-sm px-4 py-2.5 rounded-xl hover:bg-[#1D4ED8] transition-colors flex items-center gap-2 shrink-0"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          New Goal
        </button>
      </div>

      {loadError && (
        <p className="text-sm text-[#991B1B] bg-[#FEF2F2] border border-[#FECACA] rounded-xl px-4 py-3 mb-4">{loadError}</p>
      )}
      {loading && <p className="text-sm text-[#64748B] mb-4">Loading your goals…</p>}
      {!loading && !loadError && goals.length === 0 && (
        <p className="text-sm text-[#64748B] bg-white border border-[#E2E8F0] rounded-xl px-4 py-3 mb-4">
          You have no savings goals yet. Add your first goal to start tracking it.
        </p>
      )}

      {/* Summary strip */}
      <div className="grid grid-cols-3 gap-3 sm:gap-4 mb-8">
        <div className="bg-white rounded-xl p-4 border border-[#E2E8F0] card-shadow text-center">
          <p className="text-xs text-[#64748B] mb-1">Total Saved</p>
          <p className="text-xl font-bold text-[#10B981] font-mono">{fmt(totalSaved)}</p>
        </div>
        <div className="bg-white rounded-xl p-4 border border-[#E2E8F0] card-shadow text-center">
          <p className="text-xs text-[#64748B] mb-1">Total Target</p>
          <p className="text-xl font-bold text-[#0F172A] font-mono">{fmt(totalTarget)}</p>
        </div>
        <div className="bg-white rounded-xl p-4 border border-[#E2E8F0] card-shadow text-center">
          <p className="text-xs text-[#64748B] mb-1">Goals on Track</p>
          <p className="text-xl font-bold text-[#2563EB]">{onTrackCount} / {goals.length}</p>
        </div>
      </div>

      {/* Goals grid */}
      <div className="grid sm:grid-cols-2 gap-5 mb-8">
        {goals.map((g) => {
          const pct = g.target > 0 ? Math.min(100, Math.round((g.current / g.target) * 100)) : 0;
          const achieved = g.current >= g.target;
          const est = estimatedCompletion(g);
          const onTrack = isOnTrack(g);
          const isDeleteConfirm = deleteConfirmId === g.id;
          const isContributing = contributionGoalId === g.id;

          return (
            <div
              key={g.id}
              className="bg-white rounded-2xl border border-[#E2E8F0] card-shadow overflow-hidden relative"
              style={{ borderTop: `4px solid ${g.color}` }}
            >
              {/* Achieved overlay */}
              {achieved && (
                <div className="absolute inset-0 bg-white/90 flex flex-col items-center justify-center z-10 rounded-2xl">
                  <div className="text-5xl mb-2">🎉</div>
                  <p className="text-lg font-bold text-[#0F172A]">Goal Achieved!</p>
                  <p className="text-sm text-[#64748B] mt-1">{g.name} — {fmt(g.target)} reached</p>
                  <button
                    onClick={() => openEdit(g)}
                    className="mt-4 text-xs border border-[#E2E8F0] px-3 py-1.5 rounded-lg text-[#64748B] hover:bg-[#F8FAFC] transition-colors"
                  >
                    Edit goal
                  </button>
                </div>
              )}

              <div className="p-5">
                {/* Card header */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">{g.icon}</span>
                    <div>
                      <h3 className="font-bold text-[#0F172A] leading-tight">{g.name}</h3>
                      <span className="text-xs text-[#94A3B8]">Due {fmtDeadline(g.deadline)}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <span
                      className="text-xs font-bold px-2 py-0.5 rounded-full"
                      style={{ backgroundColor: `${g.color}22`, color: g.color }}
                    >
                      {pct}%
                    </span>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="mb-3">
                  <div className="h-2.5 bg-[#F1F5F9] rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full progress-fill"
                      style={{ width: `${pct}%`, backgroundColor: g.color, transition: "width 0.6s ease" }}
                    />
                  </div>
                </div>

                {/* Amounts */}
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm text-[#64748B]">
                    <span className="font-mono font-semibold text-[#0F172A]">{fmt(g.current)}</span>
                    <span className="text-[#94A3B8]"> saved of </span>
                    <span className="font-mono font-semibold text-[#0F172A]">{fmt(g.target)}</span>
                  </span>
                </div>

                {/* Status row */}
                <div className="flex items-center justify-between mb-4">
                  <div className="text-xs text-[#64748B]">
                    Monthly: <span className="font-mono font-semibold text-[#0F172A]">{fmt(g.monthlyContribution)}</span>
                  </div>
                  {est ? (
                    <span
                      className="text-xs font-medium px-2 py-0.5 rounded-full"
                      style={
                        onTrack
                          ? { backgroundColor: "#DCFCE7", color: "#16A34A" }
                          : { backgroundColor: "#FEF3C7", color: "#D97706" }
                      }
                    >
                      {onTrack ? "On track ✓" : "Behind schedule"}
                    </span>
                  ) : null}
                </div>

                {/* Estimated completion */}
                {est && (
                  <p className="text-xs text-[#94A3B8] mb-4">
                    Est. completion: <span className="text-[#64748B] font-medium">{fmtMonthYear(est.date)}</span>
                    {" "}({est.months} month{est.months !== 1 ? "s" : ""} away)
                  </p>
                )}

                {/* Contribution inline */}
                {isContributing && (
                  <div className="mb-3 flex gap-2 items-start">
                    <div className="flex-1">
                      <input
                        type="number"
                        min="0"
                        placeholder="Amount"
                        value={contributionAmount}
                        onChange={(e) => { setContributionAmount(e.target.value); setContributionError(""); }}
                        className="w-full border border-[#E2E8F0] rounded-lg px-3 py-2 text-sm outline-none focus:border-[#2563EB] font-mono"
                        autoFocus
                      />
                      {contributionError && <p className="text-xs text-[#EF4444] mt-1">{contributionError}</p>}
                    </div>
                    <button
                      onClick={() => void handleContribution()} disabled={saving}
                      className="px-3 py-2 text-sm font-semibold text-white rounded-lg transition-colors"
                      style={{ backgroundColor: g.color }}
                    >
                      Add
                    </button>
                    <button
                      onClick={() => { setContributionGoalId(null); setContributionAmount(""); setContributionError(""); }}
                      className="px-3 py-2 text-sm text-[#64748B] border border-[#E2E8F0] rounded-lg hover:bg-[#F8FAFC] transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                )}

                {/* Delete confirm */}
                {isDeleteConfirm && (
                  <div className="mb-3 bg-[#FEF2F2] border border-[#FECACA] rounded-xl p-3 text-xs text-[#DC2626]">
                    <p className="font-semibold mb-2">Delete "{g.name}"?</p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => void handleDelete(g.id)} disabled={saving}
                        className="px-3 py-1.5 bg-[#EF4444] text-white rounded-lg font-medium hover:bg-[#DC2626] transition-colors"
                      >
                        Delete
                      </button>
                      <button
                        onClick={() => setDeleteConfirmId(null)}
                        className="px-3 py-1.5 border border-[#FECACA] text-[#64748B] rounded-lg hover:bg-white transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                {/* Actions */}
                {!achieved && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => { setContributionGoalId(g.id); setContributionAmount(""); setContributionError(""); }}
                      className="flex-1 py-2 text-sm font-semibold rounded-xl text-white transition-opacity hover:opacity-90"
                      style={{ backgroundColor: g.color }}
                    >
                      Add +
                    </button>
                    <button
                      onClick={() => openEdit(g)}
                      className="px-3 py-2 border border-[#E2E8F0] rounded-xl text-[#64748B] hover:bg-[#F8FAFC] transition-colors"
                      title="Edit"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => setDeleteConfirmId(g.id)}
                      className="px-3 py-2 border border-[#E2E8F0] rounded-xl text-[#94A3B8] hover:border-[#FECACA] hover:text-[#EF4444] transition-colors"
                      title="Delete"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                        <polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                      </svg>
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {/* Add placeholder */}
        <button
          onClick={openAdd}
          className="border-2 border-dashed border-[#E2E8F0] rounded-2xl p-6 text-center hover:border-[#2563EB] hover:bg-[#F8FAFC] transition-all group min-h-[180px] flex flex-col items-center justify-center"
        >
          <div className="w-12 h-12 rounded-full bg-[#F1F5F9] group-hover:bg-[#EFF6FF] flex items-center justify-center mb-3 transition-colors">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="2" strokeLinecap="round" className="group-hover:stroke-[#2563EB] transition-colors">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </div>
          <p className="text-sm font-medium text-[#64748B] group-hover:text-[#2563EB] transition-colors">Add a new goal</p>
        </button>
      </div>

      {/* Goal Forecasting panel */}
      {forecastGoal && (() => {
        const est = estimatedCompletion(forecastGoal);
        if (!est) return null;
        const rows = [1, 1.25, 1.5, 2].map((mult) => {
          const contrib = Math.round(forecastGoal.monthlyContribution * mult);
          const remaining = forecastGoal.target - forecastGoal.current;
          const months = Math.ceil(remaining / contrib);
          const d = new Date();
          d.setMonth(d.getMonth() + months);
          return { contrib, months, date: d };
        });
        return (
          <div className="bg-white rounded-2xl border border-[#E2E8F0] card-shadow p-5 mb-8">
            <h2 className="font-bold text-[#0F172A] mb-1">Goal Forecasting</h2>
            <p className="text-sm text-[#64748B] mb-4">
              Showing projections for <strong>{forecastGoal.name}</strong> — your goal furthest from completion.
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-[#94A3B8] border-b border-[#F1F5F9]">
                    <th className="pb-2 font-medium">Monthly Contribution</th>
                    <th className="pb-2 font-medium">Months to Goal</th>
                    <th className="pb-2 font-medium">Target Month</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={i} className={`border-b border-[#F8FAFC] ${i === 0 ? "font-semibold" : ""}`}>
                      <td className="py-2.5 font-mono text-[#0F172A]">{fmt(r.contrib)}/mo{i === 0 ? " (current)" : ""}</td>
                      <td className="py-2.5 text-[#64748B]">{r.months} month{r.months !== 1 ? "s" : ""}</td>
                      <td className="py-2.5 text-[#0F172A]">{fmtMonthYear(r.date)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-[#94A3B8] mt-3">
              At <span className="font-mono font-semibold">{fmt(forecastGoal.monthlyContribution)}/month</span> you'll reach your goal in {est.months} months ({fmtMonthYear(est.date)}).
            </p>
          </div>
        );
      })()}

      {/* Add / Edit modal */}
      {modalMode !== "none" && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md card-shadow overflow-y-auto max-h-[90vh]">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-bold text-[#0F172A]">{modalMode === "add" ? "New Savings Goal" : "Edit Goal"}</h2>
              <button onClick={closeModal} className="text-[#94A3B8] hover:text-[#0F172A] transition-colors">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            {/* Icon picker */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-[#0F172A] mb-2">Icon</label>
              <div className="flex gap-2 flex-wrap">
                {ICON_OPTIONS.map((ic) => (
                  <button
                    key={ic}
                    onClick={() => setForm((f) => ({ ...f, icon: ic }))}
                    className="w-10 h-10 rounded-xl text-xl flex items-center justify-center transition-all"
                    style={form.icon === ic ? { backgroundColor: "#EFF6FF", outline: "2px solid #2563EB" } : { backgroundColor: "#F8FAFC" }}
                  >
                    {ic}
                  </button>
                ))}
              </div>
            </div>

            {/* Color picker */}
            <div className="mb-5">
              <label className="block text-sm font-medium text-[#0F172A] mb-2">Color</label>
              <div className="flex gap-2">
                {COLOR_OPTIONS.map((c) => (
                  <button
                    key={c}
                    onClick={() => setForm((f) => ({ ...f, color: c }))}
                    className="w-8 h-8 rounded-full transition-transform hover:scale-110"
                    style={{
                      backgroundColor: c,
                      outline: form.color === c ? `3px solid ${c}` : "none",
                      outlineOffset: "2px",
                    }}
                  />
                ))}
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[#0F172A] mb-1.5">Goal Name</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Emergency Fund"
                  className="w-full border border-[#E2E8F0] rounded-xl px-4 py-2.5 text-sm outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-blue-100"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#0F172A] mb-1.5">Target Amount ($)</label>
                <input
                  type="number"
                  min="0"
                  value={form.target}
                  onChange={(e) => setForm((f) => ({ ...f, target: e.target.value }))}
                  placeholder="10000"
                  className="w-full border border-[#E2E8F0] rounded-xl px-4 py-2.5 text-sm outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-blue-100 font-mono"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#0F172A] mb-1.5">Current Amount Saved ($)</label>
                <input
                  type="number"
                  min="0"
                  value={form.current}
                  onChange={(e) => setForm((f) => ({ ...f, current: e.target.value }))}
                  placeholder="0"
                  className="w-full border border-[#E2E8F0] rounded-xl px-4 py-2.5 text-sm outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-blue-100 font-mono"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#0F172A] mb-1.5">Monthly Contribution ($)</label>
                <input
                  type="number"
                  min="0"
                  value={form.monthlyContribution}
                  onChange={(e) => setForm((f) => ({ ...f, monthlyContribution: e.target.value }))}
                  placeholder="300"
                  className="w-full border border-[#E2E8F0] rounded-xl px-4 py-2.5 text-sm outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-blue-100 font-mono"
                />
                {form.monthlyContribution && form.target && parseFloat(form.monthlyContribution) > 0 && parseFloat(form.target) > 0 && (
                  <p className="mt-1.5 text-xs text-[#64748B]">
                    At {fmt(parseFloat(form.monthlyContribution))}/mo — approximately{" "}
                    <strong className="text-[#0F172A]">
                      {Math.ceil((parseFloat(form.target) - (parseFloat(form.current) || 0)) / parseFloat(form.monthlyContribution))} months
                    </strong>{" "}
                    from current savings.
                  </p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-[#0F172A] mb-1.5">Deadline</label>
                <input
                  type="date"
                  value={form.deadline}
                  onChange={(e) => setForm((f) => ({ ...f, deadline: e.target.value }))}
                  className="w-full border border-[#E2E8F0] rounded-xl px-4 py-2.5 text-sm outline-none focus:border-[#2563EB]"
                />
              </div>
            </div>

            {formError && (
              <p className="mt-3 text-xs text-[#EF4444] bg-[#FEF2F2] border border-[#FECACA] rounded-lg px-3 py-2">{formError}</p>
            )}

            <div className="flex gap-3 mt-5">
              <button onClick={closeModal} className="flex-1 border border-[#E2E8F0] text-[#64748B] font-medium py-2.5 rounded-xl hover:bg-[#F8FAFC] text-sm transition-colors">
                Cancel
              </button>
              <button
                onClick={() => void handleSave()} disabled={saving}
                className="flex-1 text-white font-semibold py-2.5 rounded-xl text-sm transition-colors hover:opacity-90"
                style={{ backgroundColor: form.color || "#2563EB" }}
              >
                {modalMode === "add" ? "Create Goal" : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
