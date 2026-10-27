import { useState, useEffect } from "react";
import type { Screen } from "../App";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

import { fetchBudget, saveBudgetLine, deleteBudgetLine } from "../lib/budgets";
import type { BudgetCategory } from "../lib/budgets";

const PRESET_COLORS = [
  "#2563EB",
  "#10B981",
  "#F59E0B",
  "#EF4444",
  "#8B5CF6",
  "#EC4899",
];

const PREDEFINED_CATEGORIES = [
  "Housing",
  "Food & Dining",
  "Transport",
  "Entertainment",
  "Healthcare",
  "Shopping",
  "Utilities",
  "Education",
  "Savings",
  "Travel",
  "Subscriptions",
  "Personal Care",
];

function utilizationColor(pct: number): string {
  if (pct > 100) return "#EF4444";
  if (pct >= 90) return "#EF4444";
  if (pct >= 70) return "#F59E0B";
  return "#10B981";
}

function currentMonthLabel(): string {
  return new Date().toLocaleDateString("en-AU", { month: "long", year: "numeric" });
}

type ModalMode = "add" | "edit";

interface ModalState {
  mode: ModalMode;
  id?: string;
  category: string;
  budgeted: string;
  color: string;
}

const EMPTY_MODAL: ModalState = {
  mode: "add",
  category: "",
  budgeted: "",
  color: PRESET_COLORS[0],
};

export default function Budget({ navigate }: { navigate: (s: Screen) => void }) {
  const [categories, setCategories] = useState<BudgetCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [saving, setSaving] = useState(false);
  const [modal, setModal] = useState<ModalState | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [modalError, setModalError] = useState("");

  const reload = async () => {
    try {
      setCategories(await fetchBudget());
      setLoadError("");
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "We could not load your budget.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void reload(); }, []);

  const totalBudgeted = categories.reduce((s, c) => s + c.budgeted, 0);
  const totalSpent = categories.reduce((s, c) => s + c.spent, 0);
  const remaining = totalBudgeted - totalSpent;
  const overallPct = totalBudgeted > 0 ? Math.min(((totalSpent / totalBudgeted) * 100), 100) : 0;
  const isOverBudget = remaining < 0;

  const alertCategories = categories.filter(
    (c) => c.budgeted > 0 && (c.spent / c.budgeted) * 100 >= 80
  );

  function openAdd() {
    setModal({ ...EMPTY_MODAL, mode: "add" });
    setModalError("");
  }

  function openEdit(cat: BudgetCategory) {
    setModal({
      mode: "edit",
      id: cat.id,
      category: cat.category,
      budgeted: String(cat.budgeted),
      color: cat.color,
    });
    setModalError("");
  }

  function closeModal() {
    setModal(null);
    setModalError("");
  }

  async function handleModalSave() {
    if (!modal) return;
    const name = modal.category.trim();
    if (!name) { setModalError("Category name is required."); return; }
    const amount = parseFloat(modal.budgeted);
    if (isNaN(amount) || amount <= 0) { setModalError("Amount must be greater than 0."); return; }

    setSaving(true);
    try {
      await saveBudgetLine({
        id: modal.mode === "edit" ? modal.id : undefined,
        category: name,
        budgeted: amount,
        color: modal.color,
      });
      await reload();
      closeModal();
    } catch (err) {
      setModalError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    setSaving(true);
    try {
      await deleteBudgetLine(id);
      await reload();
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setSaving(false);
      setDeleteId(null);
    }
  }

  const chartData = categories.map((c) => ({
    name: c.category.length > 10 ? c.category.slice(0, 10) + "…" : c.category,
    Budgeted: c.budgeted,
    Spent: c.spent,
  }));

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[960px]">
      {/* Header */}
      <div className="flex items-start justify-between mb-6 gap-3 flex-wrap">
        <div>
          <div className="flex items-center gap-1.5 text-xs text-[#94A3B8] mb-1">
            <button
              onClick={() => navigate("dashboard")}
              className="hover:text-[#2563EB] transition-colors font-medium"
            >
              Dashboard
            </button>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <polyline points="9 18 15 12 9 6" />
            </svg>
            <span className="text-[#0F172A] font-medium">Budget Planner</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-[#0F172A]">Budget Planner</h1>
          <p className="text-sm text-[#64748B] mt-0.5">Monthly budget — {currentMonthLabel()}</p>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 bg-[#2563EB] text-white text-sm font-semibold px-4 py-2.5 rounded-xl hover:bg-[#1D4ED8] transition-colors"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Add Category
        </button>
      </div>

      {loadError && (
        <p className="text-sm text-[#991B1B] bg-[#FEF2F2] border border-[#FECACA] rounded-xl px-4 py-3 mb-4">{loadError}</p>
      )}
      {loading && <p className="text-sm text-[#64748B] mb-4">Loading your budget…</p>}
      {!loading && !loadError && categories.length === 0 && (
        <p className="text-sm text-[#64748B] bg-white border border-[#E2E8F0] rounded-xl px-4 py-3 mb-4">
          You have not set a budget for this month yet. Use “Add Category” to create your first one.
          “Spent” is added up automatically from your transactions.
        </p>
      )}

      {/* Summary bar */}
      <div className="bg-white rounded-2xl p-5 border border-[#E2E8F0] card-shadow mb-6">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
          <div>
            <p className="text-xs text-[#64748B] mb-0.5">Total Budgeted</p>
            <p className="text-lg font-bold font-mono text-[#0F172A]">${totalBudgeted.toLocaleString()}</p>
          </div>
          <div>
            <p className="text-xs text-[#64748B] mb-0.5">Total Spent</p>
            <p className="text-lg font-bold font-mono text-[#0F172A]">${totalSpent.toLocaleString()}</p>
          </div>
          <div>
            <p className="text-xs text-[#64748B] mb-0.5">{isOverBudget ? "Over Budget" : "Remaining"}</p>
            <p className={`text-lg font-bold font-mono ${isOverBudget ? "text-[#EF4444]" : "text-[#10B981]"}`}>
              {isOverBudget ? "-" : "+"}${Math.abs(remaining).toLocaleString()}
            </p>
          </div>
          <div>
            <p className="text-xs text-[#64748B] mb-0.5">Used</p>
            <p className={`text-lg font-bold font-mono ${isOverBudget ? "text-[#EF4444]" : "text-[#0F172A]"}`}>
              {totalBudgeted > 0 ? Math.round((totalSpent / totalBudgeted) * 100) : 0}%
            </p>
          </div>
        </div>
        <div className="h-3 bg-[#F1F5F9] rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${overallPct}%`,
              backgroundColor: utilizationColor(totalBudgeted > 0 ? (totalSpent / totalBudgeted) * 100 : 0),
            }}
          />
        </div>
        {isOverBudget && (
          <p className="text-xs text-[#EF4444] font-semibold mt-2">
            Warning: You are ${Math.abs(remaining).toLocaleString()} over your total budget this month.
          </p>
        )}
      </div>

      {/* Categories grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        {categories.map((cat) => {
          const pct = cat.budgeted > 0 ? (cat.spent / cat.budgeted) * 100 : 0;
          const barColor = utilizationColor(pct);
          const isOver = cat.spent > cat.budgeted;
          const barWidth = Math.min(pct, 100);

          return (
            <div key={cat.id} className="bg-white rounded-2xl p-4 border border-[#E2E8F0] card-shadow relative">
              {/* Edit / Delete */}
              <div className="absolute top-3 right-3 flex gap-1">
                <button
                  onClick={() => openEdit(cat)}
                  className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-[#F1F5F9] text-[#94A3B8] hover:text-[#2563EB] transition-colors"
                  title="Edit"
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                  </svg>
                </button>
                <button
                  onClick={() => setDeleteId(cat.id)}
                  className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-[#FEF2F2] text-[#94A3B8] hover:text-[#EF4444] transition-colors"
                  title="Delete"
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                    <path d="M10 11v6M14 11v6" />
                    <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                  </svg>
                </button>
              </div>

              {/* Category name + dot */}
              <div className="flex items-center gap-2 mb-3 pr-16">
                <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />
                <span className="text-sm font-semibold text-[#0F172A] truncate">{cat.category}</span>
                {isOver && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#FEF2F2] text-[#EF4444] whitespace-nowrap">
                    Over budget
                  </span>
                )}
              </div>

              {/* Amounts */}
              <div className="flex items-end justify-between mb-2">
                <div>
                  <p className="text-xs text-[#94A3B8]">Spent</p>
                  <p className="text-base font-bold font-mono text-[#0F172A]">${cat.spent.toLocaleString()}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-[#94A3B8]">Budgeted</p>
                  <p className="text-base font-bold font-mono text-[#64748B]">${cat.budgeted.toLocaleString()}</p>
                </div>
              </div>

              {/* Progress bar */}
              <div className="h-2 bg-[#F1F5F9] rounded-full overflow-hidden mb-1">
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{ width: `${barWidth}%`, backgroundColor: barColor }}
                />
              </div>
              <p className="text-xs text-right" style={{ color: barColor }}>
                {Math.round(pct)}%
              </p>
            </div>
          );
        })}
      </div>

      {/* Budget Alerts */}
      <div className="bg-white rounded-2xl p-5 border border-[#E2E8F0] card-shadow mb-6">
        <h2 className="text-sm font-bold text-[#0F172A] mb-3">Budget Alerts</h2>
        {alertCategories.length === 0 ? (
          <div className="flex items-center gap-2 text-[#10B981]">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
            <span className="text-sm font-medium">You&apos;re on track — all categories are within 80% of budget.</span>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {alertCategories.map((cat) => {
              const pct = Math.round((cat.spent / cat.budgeted) * 100);
              const isOver = cat.spent > cat.budgeted;
              return (
                <span
                  key={cat.id}
                  className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full"
                  style={{
                    backgroundColor: isOver ? "#FEF2F2" : "#FEF3C7",
                    color: isOver ? "#EF4444" : "#D97706",
                  }}
                >
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: isOver ? "#EF4444" : "#F59E0B" }}
                  />
                  {cat.category} — {pct}%{isOver ? " over!" : " warning"}
                </span>
              );
            })}
          </div>
        )}
      </div>

      {/* Monthly Overview chart */}
      <div className="bg-white rounded-2xl p-5 border border-[#E2E8F0] card-shadow mb-6">
        <h2 className="text-sm font-bold text-[#0F172A] mb-4">Monthly Overview</h2>
        <ResponsiveContainer width="100%" height={categories.length * 52 + 40}>
          <BarChart
            layout="vertical"
            data={chartData}
            margin={{ top: 0, right: 16, left: 0, bottom: 0 }}
            barCategoryGap="30%"
          >
            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#F1F5F9" />
            <XAxis
              type="number"
              tick={{ fontSize: 11, fill: "#94A3B8" }}
              tickFormatter={(v) => "$" + v.toLocaleString()}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              type="category"
              dataKey="name"
              tick={{ fontSize: 11, fill: "#64748B" }}
              width={80}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              formatter={(v: unknown) => [typeof v === "number" ? "$" + v.toLocaleString() : String(v), ""] as [string, string]}
              contentStyle={{ fontSize: 12, borderRadius: 10, border: "1px solid #E2E8F0" }}
            />
            <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
            <Bar dataKey="Budgeted" fill="#BFDBFE" radius={[0, 4, 4, 0]} />
            <Bar dataKey="Spent" fill="#2563EB" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Add / Edit Modal */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={closeModal} />
          <div className="relative bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl">
            <h3 className="text-base font-bold text-[#0F172A] mb-4">
              {modal.mode === "add" ? "Add Category" : "Edit Category"}
            </h3>

            <div className="space-y-4">
              {/* Category name */}
              <div>
                <label className="block text-xs font-semibold text-[#374151] mb-1">Category Name</label>
                <input
                  list="category-suggestions"
                  value={modal.category}
                  onChange={(e) => setModal({ ...modal, category: e.target.value })}
                  placeholder="e.g. Housing"
                  className="w-full border border-[#E2E8F0] rounded-xl px-3 py-2 text-sm text-[#0F172A] outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-blue-100"
                />
                <datalist id="category-suggestions">
                  {PREDEFINED_CATEGORIES.map((c) => <option key={c} value={c} />)}
                </datalist>
              </div>

              {/* Monthly budget */}
              <div>
                <label className="block text-xs font-semibold text-[#374151] mb-1">Monthly Budget ($)</label>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={modal.budgeted}
                  onChange={(e) => setModal({ ...modal, budgeted: e.target.value })}
                  placeholder="0.00"
                  className="w-full border border-[#E2E8F0] rounded-xl px-3 py-2 text-sm font-mono text-[#0F172A] outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-blue-100"
                />
              </div>

              {/* Color */}
              <div>
                <label className="block text-xs font-semibold text-[#374151] mb-2">Color</label>
                <div className="flex gap-2">
                  {PRESET_COLORS.map((col) => (
                    <button
                      key={col}
                      onClick={() => setModal({ ...modal, color: col })}
                      className="w-8 h-8 rounded-full border-2 transition-transform hover:scale-110"
                      style={{
                        backgroundColor: col,
                        borderColor: modal.color === col ? "#0F172A" : "transparent",
                      }}
                    />
                  ))}
                </div>
              </div>

              {modalError && (
                <p className="text-xs text-[#EF4444] font-medium">{modalError}</p>
              )}
            </div>

            <div className="flex gap-2 mt-5">
              <button
                onClick={closeModal}
                className="flex-1 border border-[#E2E8F0] text-[#64748B] text-sm font-semibold py-2.5 rounded-xl hover:bg-[#F8FAFC] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => void handleModalSave()} disabled={saving}
                className="flex-1 bg-[#2563EB] text-white text-sm font-semibold py-2.5 rounded-xl hover:bg-[#1D4ED8] transition-colors"
              >
                {modal.mode === "add" ? "Add" : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setDeleteId(null)} />
          <div className="relative bg-white rounded-2xl p-6 w-full max-w-xs shadow-xl text-center">
            <div className="w-12 h-12 bg-[#FEF2F2] rounded-full flex items-center justify-center mx-auto mb-3">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2" strokeLinecap="round">
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                <path d="M10 11v6M14 11v6" />
                <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
              </svg>
            </div>
            <h3 className="text-base font-bold text-[#0F172A] mb-1">Delete category?</h3>
            <p className="text-sm text-[#64748B] mb-4">This action cannot be undone.</p>
            <div className="flex gap-2">
              <button
                onClick={() => setDeleteId(null)}
                className="flex-1 border border-[#E2E8F0] text-[#64748B] text-sm font-semibold py-2.5 rounded-xl hover:bg-[#F8FAFC] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => void handleDelete(deleteId)} disabled={saving}
                className="flex-1 bg-[#EF4444] text-white text-sm font-semibold py-2.5 rounded-xl hover:bg-[#DC2626] transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      <p className="mt-2 text-[10px] text-[#94A3B8] text-center">
        SmartBudget provides educational budgeting tools only. It does not provide personalised financial advice.
      </p>
    </div>
  );
}
