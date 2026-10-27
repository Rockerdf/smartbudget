import { useState, useEffect, useMemo } from "react";
import type { Screen } from "../App";
import { SITE } from "../lib/site";

interface ToastProps {
  message: string;
  onDismiss: () => void;
}

function Toast({ message, onDismiss }: ToastProps) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, 2500);
    return () => clearTimeout(timer);
  }, [onDismiss]);

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-gray-900 text-white text-sm px-5 py-3 rounded-full shadow-lg animate-fade-in">
      {message}
    </div>
  );
}

const quickLinks = [
  {
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
    ),
    title: "Getting Started",
    screen: "dashboard" as Screen,
    keyword: "account",
    desc: "Set up your account and explore SmartBudget basics",
    color: "text-blue-600",
    bg: "bg-blue-50",
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" />
      </svg>
    ),
    title: "Managing Budgets",
    screen: "budget" as Screen,
    keyword: "budget",
    desc: "Create, edit, and track your monthly budget categories",
    color: "text-purple-600",
    bg: "bg-purple-50",
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
      </svg>
    ),
    title: "Savings Goals",
    screen: "savings" as Screen,
    keyword: "goal",
    desc: "Set targets, track progress, and reach your financial goals",
    color: "text-green-600",
    bg: "bg-green-50",
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
      </svg>
    ),
    title: "Transactions",
    screen: "transactions" as Screen,
    keyword: "transaction",
    desc: "Log, categorize, and review your income and expenses",
    color: "text-amber-600",
    bg: "bg-amber-50",
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
      </svg>
    ),
    title: "Account & Security",
    screen: "settings" as Screen,
    keyword: "password",
    desc: "Manage your profile, password, and privacy settings",
    color: "text-red-600",
    bg: "bg-red-50",
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
      </svg>
    ),
    title: "AI Assistant",
    screen: "ask" as Screen,
    keyword: "AI",
    desc: "Learn what the AI coach can help you understand about your finances",
    color: "text-indigo-600",
    bg: "bg-indigo-50",
  },
];

const faqs = [
  {
    question: "How do I add a transaction?",
    answer:
      "Open Transactions from the menu and use the add form. Choose Income or Expense, then enter a description, amount, category and date (and an optional note) and save. Your dashboard, budget and charts update straight away.",
  },
  {
    question: "How is the Financial Health Score calculated?",
    answer:
      "Your Financial Health Score (0–100) combines up to four measures: budget adherence (staying within your category budgets), savings rate (how much of your income you keep), goal progress and spending consistency. Measures without enough data are left out, and the score updates as you add transactions, budgets and goals. It is an educational indicator, not a credit score.",
  },
  {
    question: "Can I connect my bank account?",
    answer:
      "Not a real one. SmartBudget includes a simulated 'Harbour Demo Bank' (Settings › Accounts) so you can preview how a bank link might work and import a few labelled [Demo] transactions. No real bank is contacted and no login details are requested. Please log your own transactions manually.",
  },
  {
    question: "How do I set a savings goal?",
    answer:
      "Open Savings from the menu and click 'New Goal'. Enter a goal name (e.g. Emergency Fund), the target amount, how much you've saved so far, a monthly contribution and a target date. SmartBudget estimates when you'll reach it. Use 'Add +' on a goal card to record new savings.",
  },
  {
    question: "What does the AI assistant do?",
    answer:
      "The assistant (Ask AI, or the chat button in the corner) answers budgeting questions with rule-based, educational explanations — for example how the 50/30/20 rule works or how to build an emergency fund. It does not move money, see your bank, or give personal financial advice.",
  },
  {
    question: "How do I change my password?",
    answer:
      "Open Settings and choose the 'Security' tab. Under Change Password, enter your current password, then type and confirm a new one (at least 8 characters) and save. Forgot your password? Use 'Forgot password?' on the sign-in page to get a reset email.",
  },
  {
    question: "Is my data secure?",
    answer:
      "Your transactions, budgets and goals are stored in a Supabase (PostgreSQL) database. Connections use HTTPS, and Row Level Security rules mean you can only read and change your own records. Passwords are handled by Supabase Authentication and are never visible to SmartBudget. This is a university prototype, so please do not enter real bank details.",
  },
  {
    question: "Can I export my data?",
    answer:
      "Yes. In Settings › Privacy you can download all your transactions, budgets and goals as a CSV file (opens in Excel or Google Sheets), or open a printable report and save it as a PDF. The Analytics page also has CSV and PDF export.",
  },
  {
    question: "Is SmartBudget free?",
    answer:
      "Yes. SmartBudget is a free educational project with no subscriptions, ads or premium tiers.",
  },
  {
    question: "How do I delete my account?",
    answer:
      "Go to Settings and select the 'Privacy' tab. In the Danger Zone, click 'Delete Account' and confirm by typing your email address. This permanently deletes your account and all of your data, and cannot be undone. You can download your data first from the same tab.",
  },
];

export default function HelpCenter({ navigate, publicMode = false }: { navigate: (s: Screen) => void; publicMode?: boolean }) {
  const [search, setSearch] = useState("");
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  function showToast(msg: string) {
    setToast(msg);
  }

  function toggleFaq(index: number) {
    setOpenFaq(openFaq === index ? null : index);
  }

  const query = search.trim().toLowerCase();
  const visibleFaqs = useMemo(
    () => faqs.filter((f) => !query || f.question.toLowerCase().includes(query) || f.answer.toLowerCase().includes(query)),
    [query],
  );

  function openTopic(link: (typeof quickLinks)[number]) {
    if (publicMode) {
      setSearch(link.keyword);
      setOpenFaq(null);
      document.getElementById("faq-list")?.scrollIntoView({ behavior: "smooth", block: "start" });
    } else {
      navigate(link.screen);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header bar */}
      <div className="bg-white border-b border-[#E2E8F0]">
        <div className="max-w-4xl mx-auto px-6 py-4">
          {/* Breadcrumb */}
          <nav className="flex items-center gap-2 text-sm text-gray-500 mb-4">
            <button
              onClick={() => navigate(publicMode ? "landing" : "dashboard")}
              className="hover:text-blue-600 transition-colors"
            >
              {publicMode ? "Home" : "Dashboard"}
            </button>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            <span className="text-gray-800 font-medium">Help Center</span>
          </nav>

          {/* Page header */}
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-gray-900">Help Center</h1>
            <p className="text-gray-500 mt-1">
              Find answers, get support, and learn how to use SmartBudget
            </p>
          </div>

          {/* Search bar */}
          <div className="relative max-w-xl">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 105 11a6 6 0 0012 0z" />
              </svg>
            </span>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search for help..."
              className="w-full pl-11 pr-4 py-3 rounded-xl border border-[#E2E8F0] bg-gray-50 text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
            />
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-8 space-y-10">
        {/* Quick links grid */}
        <section>
          <h2 className="text-lg font-semibold text-gray-800 mb-4">Browse by topic</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {quickLinks.map((link) => (
              <button
                key={link.title}
                type="button"
                onClick={() => openTopic(link)}
                className="text-left bg-white border border-[#E2E8F0] rounded-xl p-5 card-shadow hover:border-blue-300 hover:shadow-md transition-all group"
              >
                <div className={`inline-flex items-center justify-center w-11 h-11 rounded-lg ${link.bg} ${link.color} mb-3 group-hover:scale-105 transition-transform`}>
                  {link.icon}
                </div>
                <h3 className="font-semibold text-gray-900 mb-1">{link.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{link.desc}</p>
              </button>
            ))}
          </div>
        </section>

        {/* FAQ accordion */}
        <section id="faq-list" className="scroll-mt-20">
          <div className="flex items-center justify-between gap-3 mb-4">
            <h2 className="text-lg font-semibold text-gray-800">Frequently asked questions</h2>
            {query && (
              <button type="button" onClick={() => setSearch("")} className="text-sm text-blue-600 hover:underline">
                Clear search
              </button>
            )}
          </div>
          {visibleFaqs.length === 0 && (
            <div className="bg-white border border-[#E2E8F0] rounded-xl p-6 text-sm text-gray-500">
              No answers match "{search}". Try another word, or{" "}
              <button type="button" onClick={() => navigate("contact")} className="text-blue-600 font-medium hover:underline">contact us</button>.
            </div>
          )}
          <div className={`bg-white border border-[#E2E8F0] rounded-xl card-shadow overflow-hidden divide-y divide-[#E2E8F0] ${visibleFaqs.length ? "" : "hidden"}`}>
            {visibleFaqs.map((faq, index) => (
              <div key={index}>
                <button
                  onClick={() => toggleFaq(index)}
                  className="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-gray-50 transition-colors"
                >
                  <span className="font-medium text-gray-800 pr-4">{faq.question}</span>
                  <span className={`flex-shrink-0 text-gray-400 transition-transform duration-200 ${openFaq === index ? "rotate-180" : ""}`}>
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </span>
                </button>
                {openFaq === index && (
                  <div className="px-6 pb-5">
                    <p className="text-sm text-gray-600 leading-relaxed">{faq.answer}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* Contact support card */}
        <section>
          <div className="bg-white border border-[#E2E8F0] rounded-xl card-shadow p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Still need help?</h2>
              <p className="text-sm text-gray-500 mt-1 max-w-sm">
                Send us a message and we'll get back to you, usually within one business day.
              </p>
              <p className="text-xs text-gray-400 mt-3">
                Support hours: {SITE.supportHours}
              </p>
            </div>
            <div className="flex-shrink-0">
              <button
                type="button"
                onClick={() => navigate("contact")}
                className="inline-flex items-center gap-2 bg-[#2563EB] hover:bg-blue-700 text-white font-medium text-sm px-5 py-3 rounded-xl transition-colors shadow-sm"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                Contact Support
              </button>
              <a href={`mailto:${SITE.supportEmail}`} className="block mt-2 text-xs text-center text-gray-500 hover:text-blue-600 break-all">
                {SITE.supportEmail}
              </a>
            </div>
          </div>
        </section>

        {/* Financial hardship */}
        <section className="rounded-xl border border-[#FDE68A] bg-[#FFFBEB] p-5 text-sm text-[#92400E] leading-6">
          <strong>Struggling with money?</strong> SmartBudget can't give financial advice, but free and confidential help is available from the National Debt Helpline on{" "}
          <a href="tel:1800007007" className="font-semibold underline">1800 007 007</a> (
          <a href="https://ndh.org.au" target="_blank" rel="noopener noreferrer" className="font-semibold underline">ndh.org.au</a>) and from{" "}
          <a href="https://moneysmart.gov.au" target="_blank" rel="noopener noreferrer" className="font-semibold underline">Moneysmart</a>.
        </section>

        {/* Legal section */}
        <section className="flex flex-wrap items-center justify-center gap-2 pb-4">
          {([
            ["privacy", "Privacy Policy"], ["terms", "Terms of Use"], ["disclaimer", "Disclaimer"],
            ["cookies", "Cookies & Storage"], ["accessibility", "Accessibility"], ["security", "Security"],
          ] as [Screen, string][]).map(([target, label]) => (
            <button
              key={target}
              type="button"
              onClick={() => navigate(target)}
              className="text-sm text-gray-500 border border-[#E2E8F0] bg-white hover:bg-gray-50 hover:text-blue-600 px-4 py-2 rounded-full transition-colors"
            >
              {label}
            </button>
          ))}
        </section>
      </div>

      {/* Toast */}
      {toast && <Toast message={toast} onDismiss={() => setToast(null)} />}
    </div>
  );
}
