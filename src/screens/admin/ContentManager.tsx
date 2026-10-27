import { useState } from "react";

type Lesson = {
  id: string;
  title: string;
  category: string;
  status: "published" | "draft" | "pending";
  author: string;
  updated: string;
  readMins: number;
};

const INITIAL_LESSONS: Lesson[] = [
  { id: "c1",  title: "The 50/30/20 Budget Rule",               category: "Budgeting Basics", status: "published", author: "admin",   updated: "2026-08-10", readMins: 5 },
  { id: "c2",  title: "Understanding Your Payslip",             category: "Budgeting Basics", status: "published", author: "admin",   updated: "2026-08-10", readMins: 4 },
  { id: "c3",  title: "Building an Emergency Fund",             category: "Saving",           status: "published", author: "admin",   updated: "2026-08-12", readMins: 6 },
  { id: "c4",  title: "What Is Compound Interest?",             category: "Saving",           status: "published", author: "admin",   updated: "2026-08-12", readMins: 5 },
  { id: "c5",  title: "How Credit Scores Work",                 category: "Credit & Debt",    status: "published", author: "admin",   updated: "2026-08-15", readMins: 7 },
  { id: "c6",  title: "Good Debt vs Bad Debt",                  category: "Credit & Debt",    status: "published", author: "admin",   updated: "2026-08-15", readMins: 6 },
  { id: "c7",  title: "Intro to Investing Concepts",            category: "Investing",        status: "published", author: "admin",   updated: "2026-08-20", readMins: 8 },
  { id: "c8",  title: "Understanding Risk and Return",          category: "Investing",        status: "published", author: "admin",   updated: "2026-08-20", readMins: 7 },
  { id: "c9",  title: "Tax Basics for Young Adults",            category: "Tax & Planning",   status: "published", author: "admin",   updated: "2026-08-22", readMins: 9 },
  { id: "c10", title: "Setting and Tracking Financial Goals",   category: "Planning",         status: "published", author: "admin",   updated: "2026-08-25", readMins: 5 },
  { id: "c11", title: "How Mortgages Work",                     category: "Housing",          status: "draft",     author: "editor1", updated: "2026-09-08", readMins: 10 },
  { id: "c12", title: "Student Loan Repayment Strategies",      category: "Credit & Debt",    status: "pending",   author: "editor2", updated: "2026-09-12", readMins: 8 },
  { id: "c13", title: "Side Hustles and Self-Employment Tax",   category: "Tax & Planning",   status: "draft",     author: "editor1", updated: "2026-09-14", readMins: 7 },
];

const statusStyle: Record<Lesson["status"], { bg: string; text: string; label: string }> = {
  published: { bg: "bg-[#D1FAE5]", text: "text-[#065F46]", label: "Published" },
  draft:     { bg: "bg-[#F1F5F9]", text: "text-[#475569]", label: "Draft" },
  pending:   { bg: "bg-[#FEF3C7]", text: "text-[#92400E]", label: "Pending Approval" },
};

type EditState = { title: string; category: string; readMins: string };

export default function AdminContent() {
  const [lessons, setLessons] = useState(INITIAL_LESSONS);
  const [editId, setEditId] = useState<string | null>(null);
  const [editState, setEditState] = useState<EditState>({ title: "", category: "", readMins: "" });
  const [showAdd, setShowAdd] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newCategory, setNewCategory] = useState("Budgeting Basics");
  const [newReadMins, setNewReadMins] = useState("5");
  const [toast, setToast] = useState("");

  const categories = [...new Set(lessons.map((l) => l.category))];

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 2500);
  };

  const startEdit = (l: Lesson) => {
    setEditId(l.id);
    setEditState({ title: l.title, category: l.category, readMins: String(l.readMins) });
  };

  const saveEdit = () => {
    setLessons((prev) =>
      prev.map((l) => l.id === editId ? { ...l, title: editState.title, category: editState.category, readMins: parseInt(editState.readMins) || l.readMins, updated: "2026-09-16" } : l)
    );
    setEditId(null);
    showToast("Lesson updated.");
  };

  const approve = (id: string) => {
    setLessons((prev) => prev.map((l) => l.id === id ? { ...l, status: "published", updated: "2026-09-16" } : l));
    showToast("Lesson approved and published.");
  };

  const unpublish = (id: string) => {
    setLessons((prev) => prev.map((l) => l.id === id ? { ...l, status: "draft" } : l));
    showToast("Lesson moved to draft.");
  };

  const addLesson = () => {
    if (!newTitle.trim()) return;
    const newId = "c" + (lessons.length + 1);
    setLessons((prev) => [...prev, {
      id: newId, title: newTitle.trim(), category: newCategory,
      status: "draft", author: "admin", updated: "2026-09-16", readMins: parseInt(newReadMins) || 5,
    }]);
    setNewTitle(""); setNewReadMins("5"); setShowAdd(false);
    showToast("New lesson created as draft.");
  };

  const published = lessons.filter((l) => l.status === "published").length;
  const pending = lessons.filter((l) => l.status === "pending").length;

  return (
    <div>
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-[#0F172A] text-white text-sm px-5 py-3 rounded-xl shadow-xl z-50">
          {toast}
        </div>
      )}

      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-[#0F172A]">Content Management</h1>
          <p className="text-sm text-[#64748B] mt-1">Add, edit, and approve financial education lessons and source material.</p>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="bg-[#2563EB] text-white text-sm font-semibold px-4 py-2.5 rounded-xl hover:bg-[#1D4ED8] transition-colors flex items-center gap-2"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
          New Lesson
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-5">
        <div className="bg-white rounded-2xl p-4 border border-[#E2E8F0]">
          <div className="text-xs text-[#64748B]">Published</div>
          <div className="text-2xl font-bold text-[#0F172A]">{published}</div>
        </div>
        <div className="bg-white rounded-2xl p-4 border border-[#E2E8F0]">
          <div className="text-xs text-[#64748B]">Pending Approval</div>
          <div className="text-2xl font-bold text-[#F59E0B]">{pending}</div>
        </div>
        <div className="bg-white rounded-2xl p-4 border border-[#E2E8F0]">
          <div className="text-xs text-[#64748B]">Total Lessons</div>
          <div className="text-2xl font-bold text-[#0F172A]">{lessons.length}</div>
        </div>
      </div>

      {/* Add form */}
      {showAdd && (
        <div className="bg-[#EFF6FF] border border-[#BFDBFE] rounded-2xl p-5 mb-4">
          <h3 className="text-sm font-bold text-[#1D4ED8] mb-3">New Lesson</h3>
          <div className="grid grid-cols-[1fr_auto_auto_auto] gap-3 items-end">
            <div>
              <label className="text-xs font-semibold text-[#374151] block mb-1">Title</label>
              <input
                type="text"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="Lesson title…"
                className="w-full border border-[#E2E8F0] rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-[#374151] block mb-1">Category</label>
              <select
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                className="border border-[#E2E8F0] rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB] bg-white"
              >
                {categories.map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-[#374151] block mb-1">Read mins</label>
              <input
                type="number"
                value={newReadMins}
                onChange={(e) => setNewReadMins(e.target.value)}
                className="w-20 border border-[#E2E8F0] rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
              />
            </div>
            <div className="flex gap-2">
              <button onClick={addLesson} className="bg-[#2563EB] text-white text-sm font-semibold px-4 py-2 rounded-xl hover:bg-[#1D4ED8]">Add</button>
              <button onClick={() => setShowAdd(false)} className="text-sm text-[#64748B] px-4 py-2 rounded-xl hover:bg-white">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-2xl border border-[#E2E8F0] overflow-hidden">
        <div className="grid grid-cols-[1fr_140px_120px_80px_80px_140px] gap-4 px-5 py-3 bg-[#F8FAFC] text-xs font-semibold text-[#64748B] uppercase tracking-wide">
          <span>Title</span>
          <span>Category</span>
          <span>Author</span>
          <span>Mins</span>
          <span>Status</span>
          <span>Actions</span>
        </div>
        <div className="divide-y divide-[#F1F5F9]">
          {lessons.map((l) => {
            const s = statusStyle[l.status];
            const isEditing = editId === l.id;
            return (
              <div key={l.id} className="grid grid-cols-[1fr_140px_120px_80px_80px_140px] gap-4 px-5 py-3.5 items-center hover:bg-[#FAFAFA]">
                {isEditing ? (
                  <input
                    value={editState.title}
                    onChange={(e) => setEditState((p) => ({ ...p, title: e.target.value }))}
                    className="border border-[#2563EB] rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                  />
                ) : (
                  <span className="text-sm font-medium text-[#0F172A]">{l.title}</span>
                )}
                {isEditing ? (
                  <select
                    value={editState.category}
                    onChange={(e) => setEditState((p) => ({ ...p, category: e.target.value }))}
                    className="border border-[#2563EB] rounded-lg px-2 py-1 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                  >
                    {categories.map((c) => <option key={c}>{c}</option>)}
                  </select>
                ) : (
                  <span className="text-xs text-[#64748B]">{l.category}</span>
                )}
                <span className="text-xs text-[#94A3B8]">{l.author}</span>
                {isEditing ? (
                  <input
                    type="number"
                    value={editState.readMins}
                    onChange={(e) => setEditState((p) => ({ ...p, readMins: e.target.value }))}
                    className="w-14 border border-[#2563EB] rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                  />
                ) : (
                  <span className="text-xs text-[#64748B]">{l.readMins} min</span>
                )}
                <span className={`text-[10px] font-semibold px-2 py-1 rounded-full ${s.bg} ${s.text}`}>{s.label}</span>
                <div className="flex gap-1.5">
                  {isEditing ? (
                    <>
                      <button onClick={saveEdit} className="text-xs font-semibold text-white bg-[#10B981] px-2.5 py-1 rounded-lg hover:bg-[#059669]">Save</button>
                      <button onClick={() => setEditId(null)} className="text-xs text-[#64748B] px-2.5 py-1 rounded-lg hover:bg-[#F1F5F9]">Cancel</button>
                    </>
                  ) : (
                    <>
                      <button onClick={() => startEdit(l)} className="text-xs font-semibold text-[#2563EB] px-2.5 py-1 rounded-lg hover:bg-[#EFF6FF]">Edit</button>
                      {l.status === "pending" && (
                        <button onClick={() => approve(l.id)} className="text-xs font-semibold text-[#065F46] bg-[#D1FAE5] px-2.5 py-1 rounded-lg hover:bg-[#A7F3D0]">Approve</button>
                      )}
                      {l.status === "published" && (
                        <button onClick={() => unpublish(l.id)} className="text-xs text-[#64748B] px-2.5 py-1 rounded-lg hover:bg-[#F1F5F9]">Unpublish</button>
                      )}
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
