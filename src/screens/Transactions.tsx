import { useState, useMemo, useEffect } from "react";
import type { Screen } from "../App";
import {
  fetchTransactions,
  insertTransaction,
  updateTransaction,
  deleteTransaction,
  asTransactionType,
} from "../lib/transactions";
import type { Transaction as StoredTransaction } from "../lib/transactions";
import { fileUrl } from "../lib/agent";

/** Link to a receipt the AI agent saved with this transaction (private, short-lived link). */
function ReceiptLink({ path }: { path: string }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    void fileUrl(path).then((u) => { if (live) setUrl(u); });
    return () => { live = false; };
  }, [path]);
  return (
    <a href={url ?? undefined} target="_blank" rel="noopener noreferrer" title="View receipt" aria-label="View receipt"
      aria-disabled={!url} onClick={(e) => { if (!url) e.preventDefault(); }}
      className={`inline-flex items-center gap-0.5 text-[10px] font-semibold text-[#2563EB] bg-[#EFF6FF] px-1.5 py-0.5 rounded-md hover:bg-[#DBEAFE] shrink-0 ${url ? "" : "opacity-50"}`}>
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>
      Receipt
    </a>
  );
}

// ── Types ──────────────────────────────────────────────────────────────────

type Transaction = StoredTransaction;

type DateRange = "thisMonth" | "lastMonth" | "last3Months" | "allTime";
type TypeFilter = "all" | "income" | "expense";

// ── Constants ──────────────────────────────────────────────────────────────

const CATEGORIES = [
  "Housing", "Food & Dining", "Transport", "Entertainment",
  "Healthcare", "Shopping", "Education", "Utilities", "Income",
  "Savings", "Other",
];

const CAT_COLORS: Record<string, { bg: string; text: string; dot: string }> = {
  "Housing":       { bg: "#EFF6FF", text: "#1D4ED8", dot: "#2563EB" },
  "Food & Dining": { bg: "#F0FDF4", text: "#15803D", dot: "#16A34A" },
  "Transport":     { bg: "#FFFBEB", text: "#B45309", dot: "#D97706" },
  "Entertainment": { bg: "#FDF4FF", text: "#7E22CE", dot: "#9333EA" },
  "Healthcare":    { bg: "#F0FDFA", text: "#0F766E", dot: "#0D9488" },
  "Shopping":      { bg: "#FFF7ED", text: "#C2410C", dot: "#EA580C" },
  "Education":     { bg: "#EEF2FF", text: "#3730A3", dot: "#4F46E5" },
  "Utilities":     { bg: "#F5F3FF", text: "#6D28D9", dot: "#7C3AED" },
  "Income":        { bg: "#F0FDF4", text: "#15803D", dot: "#22C55E" },
  "Savings":       { bg: "#ECFEFF", text: "#0E7490", dot: "#0891B2" },
  "Other":         { bg: "#F8FAFC", text: "#475569", dot: "#64748B" },
};


// ── Date range helpers ─────────────────────────────────────────────────────

function getDateBounds(range: DateRange): { from: string; to: string } | null {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const fmt = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

  if (range === "allTime") return null;

  if (range === "thisMonth") {
    const from = new Date(now.getFullYear(), now.getMonth(), 1);
    const to = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return { from: fmt(from), to: fmt(to) };
  }
  if (range === "lastMonth") {
    const from = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const to = new Date(now.getFullYear(), now.getMonth(), 0);
    return { from: fmt(from), to: fmt(to) };
  }
  // last3Months
  const from = new Date(now.getFullYear(), now.getMonth() - 2, 1);
  const to = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return { from: fmt(from), to: fmt(to) };
}

function formatMonthHeader(yyyyMM: string): string {
  const [y, m] = yyyyMM.split("-");
  const d = new Date(parseInt(y), parseInt(m) - 1, 1);
  return d.toLocaleDateString("en-AU", { month: "long", year: "numeric" });
}

function formatDate(dateStr: string): string {
  const [y, m, d] = dateStr.split("-");
  const dt = new Date(parseInt(y), parseInt(m) - 1, parseInt(d));
  return dt.toLocaleDateString("en-AU", { day: "numeric", month: "short" });
}

// ── CSV export ─────────────────────────────────────────────────────────────

function exportCSV(txs: Transaction[]): void {
  const headers = ["Date", "Description", "Category", "Type", "Amount", "Recurring", "Note"];
  const rows = txs.map((t) => [
    t.date, `"${t.description.replace(/"/g, '""')}"`, t.category, t.type,
    t.amount.toFixed(2), t.recurring ? "Yes" : "No",
    t.note ? `"${t.note.replace(/"/g, '""')}"` : "",
  ]);
  const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "transactions.csv";
  a.click();
  URL.revokeObjectURL(url);
}

// ── Sub-components ─────────────────────────────────────────────────────────

function CategoryBadge({ category }: { category: string }) {
  const c = CAT_COLORS[category] ?? CAT_COLORS["Other"];
  return (
    <span
      className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap"
      style={{ backgroundColor: c.bg, color: c.text }}
    >
      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: c.dot }} />
      {category}
    </span>
  );
}

function RecurringIcon() {
  return (
    <span title="Recurring" className="text-[#94A3B8]">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/>
      </svg>
    </span>
  );
}

// ── Modal: Add / Edit ──────────────────────────────────────────────────────

type ModalMode = "add" | "edit";

interface TxModalProps {
  mode: ModalMode;
  initial?: Transaction;
  onSave: (t: Omit<Transaction, "id"> & { id?: string }) => Promise<void>;
  onClose: () => void;
}

function TxModal({ mode, initial, onSave, onClose }: TxModalProps) {
  const today = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState(initial?.date ?? today);
  const [description, setDescription] = useState(initial?.description ?? "");
  const [category, setCategory] = useState(initial?.category ?? "Food & Dining");
  const [entryKind, setEntryKind] = useState<"income" | "expense">(
    initial?.type === "income" ? "income" : "expense"
  );
  const [amount, setAmount] = useState(initial ? String(Math.abs(initial.amount)) : "");
  const [recurring, setRecurring] = useState(initial?.recurring ?? false);
  const [note, setNote] = useState(initial?.note ?? "");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setError("");
    if (!description.trim()) { setError("Please enter a description."); return; }
    const amtNum = parseFloat(amount);
    if (!amount || isNaN(amtNum) || amtNum <= 0) { setError("Please enter a valid amount greater than zero."); return; }
    const entryKindValue: "income" | "expense" = entryKind === "income" ? "income" : "expense";
    setSaving(true);
    try {
      await onSave({
        id: initial?.id,
        date,
        description: description.trim(),
        category,
        amount: Math.abs(amtNum),
        type: entryKindValue,
        recurring: recurring === true,
        note: note.trim() || undefined,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save transaction.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl p-6 w-full max-w-md card-shadow" style={{ maxHeight: "90vh", overflowY: "auto" }}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-bold text-[#0F172A] text-lg">{mode === "add" ? "Add Transaction" : "Edit Transaction"}</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center text-[#94A3B8] hover:bg-[#F1F5F9] hover:text-[#0F172A] transition-colors">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        {error && (
          <p className="text-xs text-[#EF4444] bg-[#FEF2F2] border border-[#FECACA] rounded-xl px-3 py-2 mb-4">{error}</p>
        )}

        <div className="space-y-4">
          <div className="flex gap-1.5 bg-[#F1F5F9] rounded-xl p-1" role="group" aria-label="Transaction type">
            <button
              type="button"
              onClick={() => setEntryKind("income")}
              aria-pressed={entryKind === "income"}
              className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${entryKind === "income" ? "bg-white text-[#16A34A] shadow-sm" : "text-[#64748B] hover:text-[#0F172A]"}`}
            >
              Income
            </button>
            <button
              type="button"
              onClick={() => setEntryKind("expense")}
              aria-pressed={entryKind === "expense"}
              className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${entryKind === "expense" ? "bg-white text-[#EF4444] shadow-sm" : "text-[#64748B] hover:text-[#0F172A]"}`}
            >
              Expense
            </button>
          </div>

          {/* Date */}
          <div>
            <label className="block text-sm font-medium text-[#0F172A] mb-1.5">Date</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full border border-[#E2E8F0] rounded-xl px-4 py-2.5 text-sm outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-blue-100"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-[#0F172A] mb-1.5">Description</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Woolworths Supermarket"
              className="w-full border border-[#E2E8F0] rounded-xl px-4 py-2.5 text-sm outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-blue-100"
            />
          </div>

          {/* Category */}
          <div>
            <label className="block text-sm font-medium text-[#0F172A] mb-1.5">Category</label>
            <select
              value={category}
              onChange={(e) => {
                const next = e.target.value;
                setCategory(next);
                if (next === "Income") setEntryKind("income");
              }}
              className="w-full border border-[#E2E8F0] rounded-xl px-4 py-2.5 text-sm outline-none focus:border-[#2563EB] bg-white text-[#0F172A]"
            >
              {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
            </select>
          </div>

          {/* Amount */}
          <div>
            <label className="block text-sm font-medium text-[#0F172A] mb-1.5">Amount ($)</label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              className="w-full border border-[#E2E8F0] rounded-xl px-4 py-2.5 text-sm outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-blue-100 font-mono"
            />
          </div>

          {/* Note */}
          <div>
            <label className="block text-sm font-medium text-[#0F172A] mb-1.5">Note <span className="font-normal text-[#94A3B8]">(optional)</span></label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Any additional notes…"
              rows={2}
              className="w-full border border-[#E2E8F0] rounded-xl px-4 py-2.5 text-sm outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-blue-100 resize-none"
            />
          </div>

          {/* Recurring */}
          <label className="flex items-center gap-3 cursor-pointer select-none">
            <div
              onClick={() => setRecurring(!recurring)}
              className={`w-10 h-5 rounded-full relative transition-colors ${recurring ? "bg-[#2563EB]" : "bg-[#CBD5E1]"}`}
            >
              <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${recurring ? "left-5" : "left-0.5"}`} />
            </div>
            <span className="text-sm font-medium text-[#0F172A]">Recurring transaction</span>
          </label>
        </div>

        <div className="flex gap-3 mt-6">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="flex-1 border border-[#E2E8F0] text-[#64748B] font-medium py-2.5 rounded-xl hover:bg-[#F8FAFC] text-sm transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="flex-1 bg-[#2563EB] text-white font-semibold py-2.5 rounded-xl hover:bg-[#1D4ED8] text-sm transition-colors disabled:opacity-70"
          >
            {saving ? "Saving…" : mode === "add" ? "Add Transaction" : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────

export default function Transactions({
  navigate,
  userId,
}: {
  navigate: (s: Screen) => void;
  userId: string;
}) {
  const [txs, setTxs] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  // Filters
  const [search, setSearch] = useState("");
  const [filterCat, setFilterCat] = useState("All");
  const [dateRange, setDateRange] = useState<DateRange>("allTime");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");

  // Modal state
  const [showAdd, setShowAdd] = useState(false);
  const [editTx, setEditTx] = useState<Transaction | null>(null);
  const [deletePending, setDeletePending] = useState<string | null>(null);

  // Toast
  const [toast, setToast] = useState<{ msg: string; error?: boolean } | null>(null);

  const notify = (msg: string, error = false) => {
    setToast({ msg, error });
    setTimeout(() => setToast(null), 4000);
  };

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError("");
    fetchTransactions()
      .then((rows) => {
        if (cancelled) return;
        setTxs(rows);
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : "Could not load transactions.";
        setLoadError(message);
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, [userId]);

  const handleSave = async (data: Omit<Transaction, "id"> & { id?: string }) => {
    const selectedType = asTransactionType(data.type);
    try {
      if (data.id) {
        const updated = await updateTransaction({ ...data, id: data.id, type: selectedType });
        setTxs((prev) => prev.map((t) => t.id === updated.id ? updated : t));
        setEditTx(null);
        notify("Transaction updated");
      } else {
        const created = await insertTransaction({ ...data, type: selectedType });
        setTxs((prev) => [created, ...prev.filter((t) => t.id !== created.id)]);
        setShowAdd(false);
        notify("Transaction added");
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not save transaction.";
      notify(message, true);
      throw err;
    }
  };

  const handleDelete = async () => {
    if (!deletePending) return;
    try {
      await deleteTransaction(deletePending);
      setTxs((prev) => prev.filter((t) => t.id !== deletePending));
      setDeletePending(null);
      notify("Transaction deleted");
    } catch (err) {
      notify(err instanceof Error ? err.message : "Could not delete transaction.", true);
    }
  };

  // ── Filtered list ────────────────────────────────────────────────────────

  const filtered = useMemo(() => {
    const bounds = getDateBounds(dateRange);
    const q = search.toLowerCase();
    return txs.filter((t) => {
      if (bounds && (t.date < bounds.from || t.date > bounds.to)) return false;
      if (filterCat !== "All" && t.category !== filterCat) return false;
      if (typeFilter !== "all" && t.type !== typeFilter) return false;
      if (q && !t.description.toLowerCase().includes(q) && !t.category.toLowerCase().includes(q) && !(t.note ?? "").toLowerCase().includes(q)) return false;
      return true;
    });
  }, [txs, search, filterCat, dateRange, typeFilter]);

  // Sort descending by date
  const sorted = useMemo(() => [...filtered].sort((a, b) => b.date.localeCompare(a.date)), [filtered]);

  // ── Summary ──────────────────────────────────────────────────────────────

  const totalIncome = filtered.filter((t) => t.type === "income").reduce((s, t) => s + Math.abs(t.amount), 0);
  const totalExpenses = filtered.filter((t) => t.type === "expense").reduce((s, t) => s + -Math.abs(t.amount), 0);
  const net = totalIncome + totalExpenses;

  // ── Group by month ───────────────────────────────────────────────────────

  const grouped = useMemo(() => {
    const map: Record<string, Transaction[]> = {};
    for (const t of sorted) {
      const key = t.date.slice(0, 7); // "YYYY-MM"
      if (!map[key]) map[key] = [];
      map[key].push(t);
    }
    return Object.entries(map).sort((a, b) => b[0].localeCompare(a[0]));
  }, [sorted]);

  const hasFilters = search !== "" || filterCat !== "All" || dateRange !== "allTime" || typeFilter !== "all";
  const deleteTx = txs.find((t) => t.id === deletePending);

  // ── Date range label map ─────────────────────────────────────────────────

  const DATE_RANGE_LABELS: Record<DateRange, string> = {
    thisMonth: "This Month",
    lastMonth: "Last Month",
    last3Months: "Last 3 Months",
    allTime: "All Time",
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1040px]">

      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 text-white text-sm px-4 py-3 rounded-xl shadow-xl z-[60] flex items-center gap-2 ${toast.error ? "bg-[#DC2626]" : "bg-[#0F172A]"}`}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={toast.error ? "#FECACA" : "#22C55E"} strokeWidth="3" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
          {toast.msg}
        </div>
      )}

      {/* ── Header ── */}
      <div className="flex items-start justify-between mb-5 gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 text-xs text-[#94A3B8] mb-1">
            <button onClick={() => navigate("dashboard")} className="hover:text-[#2563EB] transition-colors font-medium">Dashboard</button>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg>
            <span className="text-[#0F172A] font-medium">Transactions</span>
          </div>
          <h1 className="text-2xl font-bold text-[#0F172A]">Transactions</h1>
          <p className="text-sm text-[#64748B] mt-0.5">
            {loading ? "Loading from Supabase…" : `${filtered.length} of ${txs.length} transaction${txs.length !== 1 ? "s" : ""}`}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => exportCSV(filtered)}
            className="flex items-center gap-1.5 border border-[#E2E8F0] text-[#64748B] font-medium text-sm px-3.5 py-2.5 rounded-xl hover:bg-[#F8FAFC] hover:text-[#0F172A] transition-colors"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            Export CSV
          </button>
          <button
            onClick={() => setShowAdd(true)}
            disabled={loading || !!loadError}
            className="bg-[#2563EB] text-white font-semibold text-sm px-4 py-2.5 rounded-xl hover:bg-[#1D4ED8] transition-colors flex items-center gap-1.5 disabled:opacity-50"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            Add Transaction
          </button>
        </div>
      </div>

      {/* ── Search + Filter bar ── */}
      <div className="bg-white rounded-2xl border border-[#E2E8F0] card-shadow p-4 mb-4">
        <div className="flex flex-wrap gap-3">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px]">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search transactions…"
              className="w-full pl-9 pr-4 py-2.5 text-sm border border-[#E2E8F0] rounded-xl outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-blue-100 bg-white text-[#0F172A]"
            />
          </div>

          {/* Category */}
          <select
            value={filterCat}
            onChange={(e) => setFilterCat(e.target.value)}
            className="border border-[#E2E8F0] rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#2563EB] text-[#0F172A] bg-white"
          >
            <option value="All">All categories</option>
            {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
          </select>

          {/* Date range */}
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value as DateRange)}
            className="border border-[#E2E8F0] rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#2563EB] text-[#0F172A] bg-white"
          >
            {(Object.keys(DATE_RANGE_LABELS) as DateRange[]).map((k) => (
              <option key={k} value={k}>{DATE_RANGE_LABELS[k]}</option>
            ))}
          </select>

          {/* Type toggle */}
          <div className="flex bg-[#F1F5F9] rounded-xl p-1 gap-1">
            {(["all", "income", "expense"] as TypeFilter[]).map((t) => (
              <button
                key={t}
                onClick={() => setTypeFilter(t)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all ${typeFilter === t ? "bg-white text-[#0F172A] shadow-sm" : "text-[#64748B] hover:text-[#0F172A]"}`}
              >
                {t === "all" ? "All" : t === "income" ? "Income" : "Expense"}
              </button>
            ))}
          </div>

          {/* Clear filters */}
          {hasFilters && (
            <button
              onClick={() => { setSearch(""); setFilterCat("All"); setDateRange("allTime"); setTypeFilter("all"); }}
              className="flex items-center gap-1.5 text-xs font-semibold text-[#EF4444] border border-[#FECACA] bg-[#FEF2F2] px-3 py-2.5 rounded-xl hover:bg-[#FEE2E2] transition-colors"
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              Clear filters
            </button>
          )}
        </div>
      </div>

      {/* ── Summary strip ── */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        <div className="bg-white rounded-2xl border border-[#E2E8F0] card-shadow p-4">
          <p className="text-xs font-medium text-[#64748B] mb-1">Total Income</p>
          <p className="text-xl font-bold text-[#16A34A] font-mono">+${totalIncome.toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
          <p className="text-[10px] text-[#94A3B8] mt-0.5">filtered results</p>
        </div>
        <div className="bg-white rounded-2xl border border-[#E2E8F0] card-shadow p-4">
          <p className="text-xs font-medium text-[#64748B] mb-1">Total Expenses</p>
          <p className="text-xl font-bold text-[#EF4444] font-mono">${Math.abs(totalExpenses).toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
          <p className="text-[10px] text-[#94A3B8] mt-0.5">filtered results</p>
        </div>
        <div className="bg-white rounded-2xl border border-[#E2E8F0] card-shadow p-4">
          <p className="text-xs font-medium text-[#64748B] mb-1">Net</p>
          <p className={`text-xl font-bold font-mono ${net >= 0 ? "text-[#2563EB]" : "text-[#EF4444]"}`}>
            {net >= 0 ? "+" : ""}${net.toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          <p className="text-[10px] text-[#94A3B8] mt-0.5">income − expenses</p>
        </div>
      </div>

      {loadError && (
        <div className="mb-5 rounded-2xl border border-[#FECACA] bg-[#FEF2F2] px-4 py-3 text-sm text-[#DC2626]">
          {loadError}
        </div>
      )}

      {/* ── Transaction list ── */}
      <div className="bg-white rounded-2xl border border-[#E2E8F0] card-shadow overflow-hidden">
        {loading ? (
          <div className="py-20 text-center text-sm text-[#64748B]">Loading transactions…</div>
        ) : sorted.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center px-8">
            <div className="w-16 h-16 rounded-2xl bg-[#F1F5F9] flex items-center justify-center mb-4">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
            </div>
            <p className="text-base font-semibold text-[#0F172A] mb-1">No transactions found</p>
            <p className="text-sm text-[#94A3B8]">
              {loadError ? loadError : hasFilters ? "Try adjusting your filters or search query." : "Add your first transaction to get started."}
            </p>
            {hasFilters && (
              <button
                onClick={() => { setSearch(""); setFilterCat("All"); setDateRange("allTime"); setTypeFilter("all"); }}
                className="mt-4 text-sm font-semibold text-[#2563EB] hover:underline"
              >
                Clear all filters
              </button>
            )}
          </div>
        ) : (
          <>
            {/* Desktop table (≥ md) */}
            <div className="hidden md:block">
              {grouped.map(([monthKey, monthTxs]) => (
                <div key={monthKey}>
                  {/* Sticky month header */}
                  <div
                    className="px-5 py-2.5 bg-[#F8FAFC] border-b border-[#E2E8F0] flex items-center justify-between"
                    style={{ position: "sticky", top: 0, zIndex: 10 }}
                  >
                    <span className="text-xs font-bold text-[#475569] uppercase tracking-wide">{formatMonthHeader(monthKey)}</span>
                    <span className="text-xs text-[#94A3B8]">{monthTxs.length} transaction{monthTxs.length !== 1 ? "s" : ""}</span>
                  </div>
                  <table className="w-full">
                    <tbody>
                      {monthTxs.map((tx) => (
                        <tr
                          key={tx.id}
                          className="border-b border-[#F1F5F9] hover:bg-[#F8FAFC] transition-colors group last:border-0"
                        >
                          {/* Date */}
                          <td className="pl-5 pr-3 py-3.5 whitespace-nowrap">
                            <span className="text-xs text-[#64748B]">{formatDate(tx.date)}</span>
                          </td>
                          {/* Description + note */}
                          <td className="px-3 py-3.5 min-w-0" style={{ maxWidth: 260 }}>
                            <div className="flex items-center gap-1.5">
                              <p className="text-sm font-semibold text-[#0F172A] truncate">{tx.description}</p>
                              {tx.recurring && <RecurringIcon />}
                              {tx.receiptPath && <ReceiptLink path={tx.receiptPath} />}
                            </div>
                            {tx.note && <p className="text-[11px] text-[#94A3B8] truncate mt-0.5">{tx.note}</p>}
                          </td>
                          {/* Category badge */}
                          <td className="px-3 py-3.5 whitespace-nowrap">
                            <CategoryBadge category={tx.category} />
                          </td>
                          {/* Amount */}
                          <td className="px-3 py-3.5 whitespace-nowrap text-right">
                            <span className={`text-sm font-semibold font-mono ${tx.type === "income" ? "text-[#16A34A]" : "text-[#EF4444]"}`}>
                              {tx.type === "income" ? "+" : "−"}${Math.abs(tx.amount).toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                          </td>
                          {/* Actions */}
                          <td className="pl-3 pr-5 py-3.5 whitespace-nowrap">
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity justify-end">
                              <button
                                onClick={() => setEditTx(tx)}
                                title="Edit"
                                className="w-7 h-7 rounded-lg bg-[#F1F5F9] text-[#64748B] hover:bg-[#EFF6FF] hover:text-[#2563EB] transition-colors flex items-center justify-center"
                              >
                                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                                </svg>
                              </button>
                              <button
                                onClick={() => setDeletePending(tx.id)}
                                title="Delete"
                                className="w-7 h-7 rounded-lg bg-[#F1F5F9] text-[#64748B] hover:bg-[#FEE2E2] hover:text-[#EF4444] transition-colors flex items-center justify-center"
                              >
                                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                                  <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/>
                                  <path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
                                </svg>
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
            </div>

            {/* Mobile card layout (< md) */}
            <div className="md:hidden">
              {grouped.map(([monthKey, monthTxs]) => (
                <div key={monthKey}>
                  <div
                    className="px-4 py-2.5 bg-[#F8FAFC] border-b border-[#E2E8F0]"
                    style={{ position: "sticky", top: 0, zIndex: 10 }}
                  >
                    <span className="text-xs font-bold text-[#475569] uppercase tracking-wide">{formatMonthHeader(monthKey)}</span>
                  </div>
                  <div className="divide-y divide-[#F1F5F9]">
                    {monthTxs.map((tx) => (
                      <div key={tx.id} className="px-4 py-4">
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <p className="text-sm font-semibold text-[#0F172A] truncate">{tx.description}</p>
                              {tx.recurring && <RecurringIcon />}
                              {tx.receiptPath && <ReceiptLink path={tx.receiptPath} />}
                            </div>
                            {tx.note && <p className="text-[11px] text-[#94A3B8] mt-0.5">{tx.note}</p>}
                          </div>
                          <span className={`text-sm font-bold font-mono shrink-0 ${tx.type === "income" ? "text-[#16A34A]" : "text-[#EF4444]"}`}>
                            {tx.type === "income" ? "+" : "−"}${Math.abs(tx.amount).toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-[11px] text-[#94A3B8]">{formatDate(tx.date)}</span>
                            <CategoryBadge category={tx.category} />
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              onClick={() => setEditTx(tx)}
                              className="w-7 h-7 rounded-lg bg-[#F1F5F9] text-[#64748B] flex items-center justify-center"
                            >
                              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                              </svg>
                            </button>
                            <button
                              onClick={() => setDeletePending(tx.id)}
                              className="w-7 h-7 rounded-lg bg-[#F1F5F9] text-[#64748B] flex items-center justify-center"
                            >
                              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                                <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/>
                                <path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
                              </svg>
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* ── Add modal ── */}
      {showAdd && (
        <TxModal
          mode="add"
          onSave={handleSave}
          onClose={() => setShowAdd(false)}
        />
      )}

      {/* ── Edit modal ── */}
      {editTx && (
        <TxModal
          mode="edit"
          initial={editTx}
          onSave={handleSave}
          onClose={() => setEditTx(null)}
        />
      )}

      {/* ── Delete confirmation modal ── */}
      {deletePending && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm card-shadow">
            <div className="w-12 h-12 rounded-full bg-[#FEE2E2] flex items-center justify-center mx-auto mb-4">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2" strokeLinecap="round">
                <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/>
                <path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
              </svg>
            </div>
            <h3 className="font-bold text-[#0F172A] text-center mb-2">Delete transaction?</h3>
            <p className="text-sm text-[#64748B] text-center mb-6">
              <span className="font-semibold text-[#0F172A]">"{deleteTx?.description}"</span> will be permanently removed. This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeletePending(null)}
                className="flex-1 border border-[#E2E8F0] text-[#64748B] font-medium py-2.5 rounded-xl hover:bg-[#F8FAFC] text-sm transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                className="flex-1 bg-[#EF4444] text-white font-semibold py-2.5 rounded-xl hover:bg-[#DC2626] text-sm transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
