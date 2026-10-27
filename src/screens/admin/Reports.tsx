import { useState } from "react";

// ── Sample report data ────────────────────────────────────────────────────────

type ReportType = "userActivity" | "aiUsage" | "contentEngagement" | "financialSummary" | "security";

const REPORT_DEFS: { id: ReportType; name: string; desc: string; icon: string; lastGenerated: string; size: string }[] = [
  { id: "userActivity",        name: "User Activity Report",        desc: "Registration, login frequency, session lengths, feature usage breakdown",          icon: "👤", lastGenerated: "Today 09:17",    size: "42 KB"  },
  { id: "aiUsage",             name: "AI Usage & Compliance",       desc: "Call volumes, flagged interactions, refusal rates, boundary adherence statistics",  icon: "🤖", lastGenerated: "Today 08:00",    size: "31 KB"  },
  { id: "contentEngagement",   name: "Education Engagement",        desc: "Lesson views, completion rates, quiz scores, popular topics by cohort",             icon: "📚", lastGenerated: "Yesterday 22:00", size: "58 KB"  },
  { id: "financialSummary",    name: "Aggregate Financial Trends",  desc: "Anonymised spending patterns by category across the user base — no PII included",  icon: "📊", lastGenerated: "Sep 20, 2026",   size: "76 KB"  },
  { id: "security",            name: "Security & Access Report",    desc: "Failed logins, access denials, IP flags, admin actions log summary",               icon: "🔒", lastGenerated: "Today 06:00",    size: "28 KB"  },
];

const USER_ACTIVITY_ROWS = [
  { user: "morgan.l",  logins: 18, sessions: 21, avgLength: "9.2m", features: "Budgeting, AI, Education", lastSeen: "Today" },
  { user: "sam.o",     logins: 12, sessions: 14, avgLength: "6.8m", features: "Expense Tracking, Goals",   lastSeen: "Today" },
  { user: "jamie.c",   logins: 9,  sessions: 10, avgLength: "11.4m",features: "All features",              lastSeen: "Yesterday" },
  { user: "casey.n",   logins: 6,  sessions: 7,  avgLength: "4.1m", features: "AI, Education",             lastSeen: "Yesterday" },
  { user: "taylor.b",  logins: 3,  sessions: 3,  avgLength: "3.7m", features: "Dashboard only",            lastSeen: "Sep 18" },
  { user: "riley.s",   logins: 2,  sessions: 2,  avgLength: "2.1m", features: "Dashboard, AI",             lastSeen: "Sep 15" },
  { user: "jordan.w",  logins: 1,  sessions: 1,  avgLength: "1.8m", features: "AI",                        lastSeen: "Sep 15" },
  { user: "morgan.l",  logins: 18, sessions: 21, avgLength: "9.2m", features: "Budgeting, AI, Education", lastSeen: "Today" },
];

const AI_USAGE_ROWS = [
  { type: "Chat",     calls: 623, passed: 609, flagged: 14, refusals: 11, complianceRate: "98.2%" },
  { type: "Category", calls: 312, passed: 312, flagged: 0,  refusals: 0,  complianceRate: "100%"  },
  { type: "Budget",   calls: 198, passed: 198, flagged: 0,  refusals: 0,  complianceRate: "100%"  },
  { type: "Insight",  calls: 64,  passed: 63,  flagged: 1,  refusals: 0,  complianceRate: "98.4%" },
];

const CONTENT_ROWS = [
  { lesson: "Understanding Compound Interest", views: 89, completions: 71, avgScore: "84%", rating: "4.6★" },
  { lesson: "Budgeting with the 50/30/20 Rule", views: 112, completions: 98, avgScore: "91%", rating: "4.8★" },
  { lesson: "What Is a Credit Score?",          views: 76,  completions: 62, avgScore: "78%", rating: "4.3★" },
  { lesson: "Emergency Fund Fundamentals",      views: 68,  completions: 54, avgScore: "88%", rating: "4.7★" },
  { lesson: "Introduction to Investing",        views: 55,  completions: 31, avgScore: "72%", rating: "4.1★" },
  { lesson: "How Tax Brackets Work",            views: 43,  completions: 28, avgScore: "69%", rating: "4.0★" },
];

// ── CSV export helpers ────────────────────────────────────────────────────────

function exportCsv(filename: string, headers: string[], rows: string[][]) {
  const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Sub-components ────────────────────────────────────────────────────────────

function ReportCard({
  def,
  onGenerate,
  onExport,
}: {
  def: typeof REPORT_DEFS[number];
  onGenerate: (id: ReportType) => void;
  onExport: (id: ReportType) => void;
}) {
  return (
    <div className="bg-white rounded-2xl border border-[#E2E8F0] p-5 flex items-start gap-4 hover:shadow-sm transition-shadow">
      <div className="w-12 h-12 rounded-xl bg-[#F8FAFC] flex items-center justify-center text-2xl shrink-0 border border-[#E2E8F0]">
        {def.icon}
      </div>
      <div className="flex-1 min-w-0">
        <h3 className="font-semibold text-[#0F172A] mb-0.5">{def.name}</h3>
        <p className="text-xs text-[#64748B] leading-relaxed mb-3">{def.desc}</p>
        <div className="flex flex-wrap gap-3 text-[10px] text-[#94A3B8]">
          <span>Last generated: {def.lastGenerated}</span>
          <span>·</span>
          <span>Est. size: {def.size}</span>
        </div>
      </div>
      <div className="flex flex-col gap-2 shrink-0">
        <button
          onClick={() => onGenerate(def.id)}
          className="text-xs font-semibold text-[#2563EB] bg-[#EFF6FF] px-3 py-1.5 rounded-lg hover:bg-[#DBEAFE] transition-colors"
        >
          Preview
        </button>
        <button
          onClick={() => onExport(def.id)}
          className="text-xs font-semibold text-white bg-[#0F172A] px-3 py-1.5 rounded-lg hover:bg-[#1E293B] transition-colors flex items-center gap-1.5"
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          CSV
        </button>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function AdminReports() {
  const [preview, setPreview] = useState<ReportType | null>(null);
  const [toast, setToast] = useState("");

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(""), 2500); };

  const handleGenerate = (id: ReportType) => setPreview(id === preview ? null : id);

  const handleExport = (id: ReportType) => {
    if (id === "userActivity") {
      exportCsv(
        "user-activity-report.csv",
        ["User", "Logins", "Sessions", "Avg Length", "Features Used", "Last Seen"],
        USER_ACTIVITY_ROWS.map((r) => [r.user, String(r.logins), String(r.sessions), r.avgLength, `"${r.features}"`, r.lastSeen])
      );
    } else if (id === "aiUsage") {
      exportCsv(
        "ai-usage-report.csv",
        ["Type", "Total Calls", "Passed", "Flagged", "Refusals", "Compliance Rate"],
        AI_USAGE_ROWS.map((r) => [r.type, String(r.calls), String(r.passed), String(r.flagged), String(r.refusals), r.complianceRate])
      );
    } else if (id === "contentEngagement") {
      exportCsv(
        "content-engagement-report.csv",
        ["Lesson", "Views", "Completions", "Avg Score", "Rating"],
        CONTENT_ROWS.map((r) => [`"${r.lesson}"`, String(r.views), String(r.completions), r.avgScore, r.rating])
      );
    } else {
      showToast(`${REPORT_DEFS.find((d) => d.id === id)?.name} needs server-side data and isn't available in this prototype yet.`);
      return;
    }
    showToast("✓ Export downloaded");
  };

  return (
    <div>
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-[#0F172A] text-white text-sm px-5 py-3 rounded-xl shadow-xl z-50 max-w-[90vw] text-center">
          {toast}
        </div>
      )}

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-[#0F172A]">Reports</h1>
          <p className="text-sm text-[#64748B] mt-1">Generate and export platform reports. All exports are anonymised — no individual financial data is included.</p>
        </div>
      </div>

      {/* Disclaimer banner */}
      <div className="flex items-start gap-3 bg-[#FFFBEB] border border-[#FDE68A] rounded-2xl px-5 py-4 mb-6">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" strokeWidth="2" strokeLinecap="round" className="mt-0.5 shrink-0">
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
          <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
        <p className="text-sm text-[#92400E]">
          <strong>Data minimisation:</strong> Reports contain aggregate statistics only. Individual financial transaction data, account balances, and personal financial details are never exported.
        </p>
      </div>

      {/* Report cards */}
      <div className="space-y-3 mb-6">
        {REPORT_DEFS.map((def) => (
          <ReportCard key={def.id} def={def} onGenerate={handleGenerate} onExport={handleExport} />
        ))}
      </div>

      {/* Preview panel */}
      {preview && (
        <div className="bg-white rounded-2xl border border-[#E2E8F0] overflow-hidden">
          <div className="px-5 py-4 border-b border-[#F1F5F9] flex items-center justify-between">
            <div>
              <h2 className="font-bold text-[#0F172A]">{REPORT_DEFS.find((d) => d.id === preview)?.name} — Preview</h2>
              <p className="text-xs text-[#94A3B8] mt-0.5">Showing sample data · Generated {new Date().toLocaleTimeString()}</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleExport(preview)}
                className="text-xs font-semibold text-white bg-[#2563EB] px-3 py-1.5 rounded-lg hover:bg-[#1D4ED8] transition-colors flex items-center gap-1.5"
              >
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                Export CSV
              </button>
              <button onClick={() => setPreview(null)} className="text-[#94A3B8] hover:text-[#0F172A] p-1">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            {preview === "userActivity" && (
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[#F8FAFC] text-xs font-semibold text-[#64748B] uppercase tracking-wide">
                    {["User", "Logins", "Sessions", "Avg Length", "Features", "Last Seen"].map((h) => (
                      <th key={h} className="px-5 py-3 text-left">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F8FAFC]">
                  {USER_ACTIVITY_ROWS.map((r, i) => (
                    <tr key={i} className="hover:bg-[#FAFAFA]">
                      <td className="px-5 py-3 font-mono text-xs text-[#94A3B8]">{r.user}</td>
                      <td className="px-5 py-3 text-[#0F172A] font-semibold">{r.logins}</td>
                      <td className="px-5 py-3 text-[#64748B]">{r.sessions}</td>
                      <td className="px-5 py-3 text-[#64748B]">{r.avgLength}</td>
                      <td className="px-5 py-3 text-xs text-[#64748B]">{r.features}</td>
                      <td className="px-5 py-3 text-xs text-[#94A3B8]">{r.lastSeen}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {preview === "aiUsage" && (
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[#F8FAFC] text-xs font-semibold text-[#64748B] uppercase tracking-wide">
                    {["Type", "Total Calls", "Passed", "Flagged", "Refusals", "Compliance"].map((h) => (
                      <th key={h} className="px-5 py-3 text-left">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F8FAFC]">
                  {AI_USAGE_ROWS.map((r, i) => (
                    <tr key={i} className="hover:bg-[#FAFAFA]">
                      <td className="px-5 py-3 font-semibold text-[#0F172A]">{r.type}</td>
                      <td className="px-5 py-3 text-[#64748B]">{r.calls}</td>
                      <td className="px-5 py-3 text-[#10B981] font-semibold">{r.passed}</td>
                      <td className="px-5 py-3 text-[#EF4444] font-semibold">{r.flagged}</td>
                      <td className="px-5 py-3 text-[#F59E0B] font-semibold">{r.refusals}</td>
                      <td className="px-5 py-3">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${r.complianceRate === "100%" ? "bg-[#D1FAE5] text-[#065F46]" : "bg-[#FEF3C7] text-[#92400E]"}`}>
                          {r.complianceRate}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {preview === "contentEngagement" && (
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[#F8FAFC] text-xs font-semibold text-[#64748B] uppercase tracking-wide">
                    {["Lesson", "Views", "Completions", "Avg Score", "Rating"].map((h) => (
                      <th key={h} className="px-5 py-3 text-left">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F8FAFC]">
                  {CONTENT_ROWS.map((r, i) => (
                    <tr key={i} className="hover:bg-[#FAFAFA]">
                      <td className="px-5 py-3 text-[#0F172A] font-medium">{r.lesson}</td>
                      <td className="px-5 py-3 text-[#64748B]">{r.views}</td>
                      <td className="px-5 py-3 text-[#10B981] font-semibold">{r.completions}</td>
                      <td className="px-5 py-3 text-[#0F172A]">{r.avgScore}</td>
                      <td className="px-5 py-3 text-[#F59E0B] font-semibold">{r.rating}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {(preview === "financialSummary" || preview === "security") && (
              <div className="px-5 py-10 text-center">
                <div className="text-4xl mb-3">📊</div>
                <p className="text-sm text-[#64748B]">Preview not available for this report type. Click <strong>Export CSV</strong> to download.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
