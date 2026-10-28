import { useState, useEffect } from "react";
import type { Screen } from "../App";
import { SiteFooter, consumePendingSection } from "../components/SiteChrome";

export default function Landing({ navigate }: { navigate: (s: Screen) => void }) {
  const [scrolled, setScrolled] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  useEffect(() => { consumePendingSection(); }, []);

  const scrollTo = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 10);
    window.addEventListener("scroll", handler, { passive: true });
    return () => window.removeEventListener("scroll", handler);
  }, []);


  const faqs = [
    {
      q: "Is SmartBudget free to use?",
      a: "Yes. The full platform is free for educational and personal finance use. There are no hidden fees, subscriptions, or premium tiers.",
    },
    {
      q: "Does SmartBudget give financial advice?",
      a: "No. SmartBudget provides educational budgeting tools only. Nothing on this platform constitutes financial, investment, or tax advice. Always consult a qualified professional.",
    },
    {
      q: "Is my data secure?",
      a: "Your account is protected by Supabase Authentication, and your data is stored in a database where Row Level Security lets each person read and change only their own records. This is a university prototype, so please do not enter real bank details.",
    },
    {
      q: "Can I connect my real bank account?",
      a: "This prototype simulates bank connections for demonstration and educational purposes only. No real banking credentials are ever requested or stored.",
    },
    {
      q: "What is the Financial Health Score?",
      a: "A 0–100 score calculated from your budget adherence, savings rate, expense patterns, and goal progress. It is an educational metric — not an official credit or financial rating.",
    },
    {
      q: "How does the AI agent work?",
      a: "Ask in plain English or send a photo of a receipt, a bank statement, a spreadsheet or a video. The agent (powered by Google Gemini) answers questions and records transactions, budgets and goals in your own account, and asks before deleting anything. It never moves real money and gives educational information, not financial advice.",
    },
  ];

  const features = [
    {
      title: "Expense Tracking",
      desc: "Log and categorise every transaction in seconds. See exactly where your money goes with beautiful visual breakdowns.",
      color: "#2563EB",
      bg: "#EFF6FF",
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
          <polyline points="14 2 14 8 20 8"/>
          <line x1="16" y1="13" x2="8" y2="13"/>
          <line x1="16" y1="17" x2="8" y2="17"/>
          <polyline points="10 9 9 9 8 9"/>
        </svg>
      ),
    },
    {
      title: "Budget Planning",
      desc: "Build smart monthly budgets by category. Get real-time alerts before you overspend and stay on track effortlessly.",
      color: "#7C3AED",
      bg: "#F5F3FF",
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="4" y1="21" x2="4" y2="14"/>
          <line x1="4" y1="10" x2="4" y2="3"/>
          <line x1="12" y1="21" x2="12" y2="12"/>
          <line x1="12" y1="8" x2="12" y2="3"/>
          <line x1="20" y1="21" x2="20" y2="16"/>
          <line x1="20" y1="12" x2="20" y2="3"/>
          <line x1="1" y1="14" x2="7" y2="14"/>
          <line x1="9" y1="8" x2="15" y2="8"/>
          <line x1="17" y1="16" x2="23" y2="16"/>
        </svg>
      ),
    },
    {
      title: "Savings Goals",
      desc: "Set meaningful savings targets — emergency fund, travel, or a home deposit — and track progress with milestone celebrations.",
      color: "#059669",
      bg: "#ECFDF5",
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10"/>
          <circle cx="12" cy="12" r="6"/>
          <circle cx="12" cy="12" r="2"/>
        </svg>
      ),
    },
    {
      title: "Financial Insights",
      desc: "Deep analytics with trend charts, spending patterns, and personalised recommendations to improve your financial wellbeing.",
      color: "#D97706",
      bg: "#FFFBEB",
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
        </svg>
      ),
    },
    {
      title: "AI Agent",
      desc: "Snap a receipt and it's recorded. Ask questions, import statements, set budgets and goals: tell the agent what you need and it does the work.",
      color: "#4F46E5",
      bg: "#EEF2FF",
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"/>
        </svg>
      ),
    },
  ];

  const barHeights = [45, 62, 55, 78, 68, 90];
  const barMonths = ["Apr", "May", "Jun", "Jul", "Aug", "Sep"];

  return (
    <div className="min-h-screen bg-white" style={{ fontFamily: "'DM Sans', system-ui, sans-serif" }}>

      {/* ── Navigation ─────────────────────────────────────────────────────── */}
      <nav
        className="fixed top-0 left-0 right-0 z-50 glass-light transition-all duration-300"
        style={{ borderBottom: scrolled ? "1px solid rgba(0,0,0,0.08)" : "1px solid transparent" }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <div className="flex items-center gap-2.5 cursor-pointer" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>
              <div style={{ background: "#2563EB", borderRadius: 10, width: 36, height: 36, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <span style={{ color: "#fff", fontWeight: 700, fontSize: 18, fontFamily: "'DM Sans', sans-serif" }}>S</span>
              </div>
              <span style={{ fontWeight: 700, fontSize: 17, color: "#0F172A", letterSpacing: "-0.3px" }}>SmartBudget</span>
            </div>

            {/* Nav actions */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => scrollTo("how")}
                className="hidden md:block px-4 py-2 text-sm font-medium transition-colors"
                style={{ color: "#374151" }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = "#2563EB"; e.currentTarget.style.color = "#2563EB"; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = "#D1D5DB"; e.currentTarget.style.color = "#374151"; }}
              >
                How it works
              </button>
              <button
                onClick={() => navigate("login")}
                className="px-3 sm:px-4 py-2 text-sm font-medium transition-colors"
                style={{ color: "#374151" }}
                onMouseEnter={e => (e.currentTarget.style.color = "#2563EB")}
                onMouseLeave={e => (e.currentTarget.style.color = "#374151")}
              >
                Sign in
              </button>
              <button
                onClick={() => navigate("register")}
                className="px-4 py-2 text-sm font-semibold rounded-full transition-all"
                style={{ background: "#2563EB", color: "#fff" }}
                onMouseEnter={e => (e.currentTarget.style.background = "#1D4ED8")}
                onMouseLeave={e => (e.currentTarget.style.background = "#2563EB")}
              >
                Get Started
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* ── Hero ───────────────────────────────────────────────────────────── */}
      <section className="hero-mesh pt-16 min-h-screen flex items-center">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 lg:py-28 w-full">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 lg:gap-20 items-center">

            {/* Left column */}
            <div className="animate-up">
              {/* Eyebrow */}
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full mb-6"
                style={{ background: "rgba(37,99,235,0.18)", border: "1px solid rgba(37,99,235,0.35)", boxShadow: "0 0 20px rgba(37,99,235,0.2)" }}>
                <span style={{ fontSize: 13, color: "#93C5FD", fontWeight: 500 }}>🏆 Financial Wellness Platform</span>
              </div>

              {/* H1 */}
              <h1 className="font-serif mb-6"
                style={{ fontSize: "clamp(2.2rem, 5vw, 3.5rem)", lineHeight: 1.12, color: "#FFFFFF", fontStyle: "italic" }}>
                Take Control of Your<br />Financial Future
              </h1>

              {/* Subheading */}
              <p className="mb-8" style={{ fontSize: 18, color: "rgba(255,255,255,0.7)", lineHeight: 1.65, maxWidth: 480 }}>
                Track spending, build budgets, achieve savings goals and improve financial wellbeing — all in one place.
              </p>

              {/* CTA row */}
              <div className="flex flex-wrap gap-3 mb-8">
                <button
                  onClick={() => navigate("register")}
                  className="flex items-center gap-2 px-6 py-3 rounded-full font-semibold transition-all"
                  style={{ background: "#2563EB", color: "#fff", fontSize: 15 }}
                  onMouseEnter={e => (e.currentTarget.style.background = "#1D4ED8")}
                  onMouseLeave={e => (e.currentTarget.style.background = "#2563EB")}
                >
                  Get Started Free
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
                  </svg>
                </button>
                <button
                  onClick={() => scrollTo("how")}
                  className="flex items-center gap-2 px-6 py-3 rounded-full font-semibold transition-all border"
                  style={{ borderColor: "rgba(255,255,255,0.35)", color: "#fff", fontSize: 15 }}
                  onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.08)")}
                  onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                >
                  See how it works
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="6 9 12 15 18 9"/>
                  </svg>
                </button>
              </div>

              {/* Trust badges */}
              <div className="flex flex-wrap gap-4">
                {[
                  { icon: "🔒", label: "Secure Login" },
                  { icon: "🛡", label: "Privacy Protected" },
                  { icon: "✨", label: "Free to use" },
                ].map(b => (
                  <div key={b.label} className="flex items-center gap-1.5">
                    <span style={{ fontSize: 14 }}>{b.icon}</span>
                    <span style={{ fontSize: 13, color: "rgba(255,255,255,0.55)", fontWeight: 500 }}>{b.label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Right column — dashboard mockup */}
            <div className="animate-float">
              <div className="glass rounded-2xl p-5 max-w-sm mx-auto" style={{ boxShadow: "0 24px 64px rgba(0,0,0,0.5)" }}>

                {/* Header */}
                <div className="flex items-center justify-between mb-5">
                  <div>
                    <p style={{ fontSize: 11, color: "rgba(255,255,255,0.45)", textTransform: "uppercase", letterSpacing: 1 }}>Financial Health</p>
                    <p className="font-mono" style={{ fontSize: 28, color: "#fff", fontWeight: 600 }}>84<span style={{ fontSize: 14, color: "rgba(255,255,255,0.5)" }}>/100</span></p>
                  </div>
                  <div className="rounded-full flex items-center justify-center" style={{ width: 44, height: 44, background: "rgba(16,185,129,0.2)", border: "1px solid rgba(16,185,129,0.4)" }}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
                    </svg>
                  </div>
                </div>

                {/* Health bar */}
                <div className="mb-5">
                  <div className="rounded-full overflow-hidden" style={{ height: 8, background: "rgba(255,255,255,0.12)" }}>
                    <div className="rounded-full h-full transition-all" style={{ width: "84%", background: "linear-gradient(90deg, #10B981, #34D399)" }} />
                  </div>
                  <p style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginTop: 4 }}>Example preview</p>
                </div>

                {/* Stat cards */}
                <div className="grid grid-cols-3 gap-2 mb-5">
                  {[
                    { label: "Income", value: "$5,800", color: "#10B981" },
                    { label: "Expenses", value: "$3,940", color: "#F87171" },
                    { label: "Saved", value: "$1,860", color: "#60A5FA" },
                  ].map(s => (
                    <div key={s.label} className="rounded-xl p-3" style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.1)" }}>
                      <p style={{ fontSize: 10, color: "rgba(255,255,255,0.45)", marginBottom: 4, fontWeight: 500 }}>{s.label}</p>
                      <p className="amount" style={{ fontSize: 13, color: s.color, fontWeight: 600 }}>{s.value}</p>
                    </div>
                  ))}
                </div>

                {/* Mini bar chart */}
                <div>
                  <p style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginBottom: 8, fontWeight: 500 }}>6-Month Savings Trend</p>
                  <div className="flex items-end gap-1.5" style={{ height: 64 }} aria-hidden="true">
                    {barHeights.map((h, i) => (
                      <div key={i} className="flex-1 flex flex-col items-center justify-end gap-1 h-full">
                        <div className="w-full rounded-t" style={{ height: Math.round(h * 0.48), background: i === 5 ? "linear-gradient(180deg,#34D399,#10B981)" : "rgba(255,255,255,0.18)" }} />
                        <span style={{ fontSize: 9, color: "rgba(255,255,255,0.3)" }}>{barMonths[i]}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Floating badge */}
                <div className="mt-4 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full" style={{ background: "rgba(16,185,129,0.2)", border: "1px solid rgba(16,185,129,0.35)" }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="#10B981">
                    <polyline points="18 15 12 9 6 15"/>
                  </svg>
                  <span style={{ fontSize: 12, color: "#34D399", fontWeight: 600 }}>+14% savings vs last month</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Features ───────────────────────────────────────────────────────── */}
      <section id="features" className="py-20 bg-white scroll-mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="text-center mb-14">
            <h2 className="font-serif mb-4" style={{ fontSize: "clamp(1.8rem, 3.5vw, 2.6rem)", color: "#0F172A", fontStyle: "italic" }}>
              Everything you need to thrive financially
            </h2>
            <p style={{ color: "#64748B", fontSize: 17, maxWidth: 520, margin: "0 auto", lineHeight: 1.6 }}>
              A complete toolkit for building healthy money habits and reaching your financial goals.
            </p>
          </div>

          {/* Cards grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map(f => (
              <div
                key={f.title}
                className="bg-white rounded-2xl border p-6 card-shadow transition-all duration-200 cursor-default"
                style={{ borderColor: "#E2E8F0" }}
                onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.transform = "translateY(-4px)"; (e.currentTarget as HTMLDivElement).style.boxShadow = "0 12px 40px rgba(0,0,0,0.10)"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.transform = "translateY(0)"; (e.currentTarget as HTMLDivElement).style.boxShadow = ""; }}
              >
                <div className="inline-flex items-center justify-center w-11 h-11 rounded-xl mb-4" style={{ background: f.bg, color: f.color }}>
                  {f.icon}
                </div>
                <h3 className="font-semibold mb-2" style={{ color: "#0F172A", fontSize: 16 }}>{f.title}</h3>
                <p style={{ color: "#64748B", fontSize: 14, lineHeight: 1.65 }}>{f.desc}</p>
              </div>
            ))}

            {/* CTA card */}
            <div className="rounded-2xl p-6 flex flex-col justify-between" style={{ background: "linear-gradient(135deg, #2563EB 0%, #4F46E5 100%)" }}>
              <div>
                <div className="inline-flex items-center justify-center w-11 h-11 rounded-xl mb-4" style={{ background: "rgba(255,255,255,0.15)" }}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                  </svg>
                </div>
                <h3 className="font-semibold mb-2" style={{ color: "#fff", fontSize: 16 }}>Start your journey today</h3>
                <p style={{ color: "rgba(255,255,255,0.75)", fontSize: 14, lineHeight: 1.65, marginBottom: 20 }}>
                  Set up your free account in about a minute. Private, ad-free and built for learning.
                </p>
              </div>
              <button
                onClick={() => navigate("register")}
                className="w-full py-2.5 rounded-xl font-semibold text-sm transition-all"
                style={{ background: "#fff", color: "#2563EB" }}
                onMouseEnter={e => (e.currentTarget.style.background = "#EFF6FF")}
                onMouseLeave={e => (e.currentTarget.style.background = "#fff")}
              >
                Create Free Account
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ── How It Works ───────────────────────────────────────────────────── */}
      <section id="how" className="py-20 gradient-section scroll-mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <h2 className="font-serif mb-4" style={{ fontSize: "clamp(1.8rem, 3.5vw, 2.6rem)", color: "#0F172A", fontStyle: "italic" }}>
              Up and running in minutes
            </h2>
            <p style={{ color: "#64748B", fontSize: 17, maxWidth: 480, margin: "0 auto" }}>
              Three simple steps to financial clarity. No complex setup required.
            </p>
          </div>

          <div className="flex flex-col lg:flex-row items-stretch gap-6 lg:gap-0">
            {[
              {
                num: "01",
                title: "Track Spending",
                desc: "Add your transactions manually or simulate a bank connection. Categorise expenses and see your full financial picture at a glance.",
                icon: (
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/>
                  </svg>
                ),
              },
              {
                num: "02",
                title: "Build Your Budget",
                desc: "Set smart monthly budgets by category. Receive real-time alerts, track remaining balances, and adjust allocations on the fly.",
                icon: (
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#7C3AED" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 20V10"/><path d="M18 20V4"/><path d="M6 20v-4"/>
                  </svg>
                ),
              },
              {
                num: "03",
                title: "Reach Your Goals",
                desc: "Set meaningful savings targets and watch your progress grow. AI coaching explains every step and celebrates your milestones.",
                icon: (
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
                  </svg>
                ),
              },
            ].map((step, i, arr) => (
              <div key={step.num} className="flex items-stretch flex-1 w-full">
                <div className="bg-white rounded-2xl p-6 card-shadow-md flex-1" style={{ border: "1px solid #E2E8F0" }}>
                  <div className="font-mono font-bold mb-3" style={{ fontSize: 13, color: "#93C5FD", letterSpacing: 1 }}>{step.num}</div>
                  <div className="mb-3">{step.icon}</div>
                  <h3 className="font-semibold mb-2" style={{ fontSize: 17, color: "#0F172A" }}>{step.title}</h3>
                  <p style={{ fontSize: 14, color: "#64748B", lineHeight: 1.65 }}>{step.desc}</p>
                </div>
                {i < arr.length - 1 && (
                  <div className="hidden lg:flex items-center justify-center px-3 flex-shrink-0" aria-hidden="true">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#CBD5E1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
                    </svg>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FAQ ────────────────────────────────────────────────────────────── */}
      <section id="faq" className="py-20 bg-white scroll-mt-16" style={{ borderTop: "1px solid #F1F5F9" }}>
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="font-serif mb-4" style={{ fontSize: "clamp(1.8rem, 3.5vw, 2.6rem)", color: "#0F172A", fontStyle: "italic" }}>
              Frequently asked questions
            </h2>
            <p style={{ color: "#64748B", fontSize: 17 }}>Everything you need to know about SmartBudget.</p>
          </div>

          <div className="space-y-3">
            {faqs.map((faq, i) => (
              <div key={i} className="bg-white rounded-xl border overflow-hidden" style={{ borderColor: "#E2E8F0" }}>
                <button
                  className="w-full flex items-center justify-between px-5 py-4 text-left transition-colors"
                  style={{ color: "#0F172A" }}
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  onMouseEnter={e => (e.currentTarget.style.background = "#F8FAFC")}
                  onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                >
                  <span className="font-medium" style={{ fontSize: 15 }}>{faq.q}</span>
                  <svg
                    width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                    style={{ transform: openFaq === i ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s ease", flexShrink: 0, marginLeft: 12 }}
                  >
                    <polyline points="6 9 12 15 18 9"/>
                  </svg>
                </button>
                {openFaq === i && (
                  <div className="px-5 pb-4 animate-in">
                    <p style={{ fontSize: 14, color: "#64748B", lineHeight: 1.7 }}>{faq.a}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Disclaimer Banner ──────────────────────────────────────────────── */}
      <div style={{ background: "#FFFBEB", borderTop: "1px solid #FDE68A", borderBottom: "1px solid #FDE68A" }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-start gap-3">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#D97706" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 1 }}>
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
          </svg>
          <p style={{ fontSize: 13, color: "#92400E", lineHeight: 1.6 }}>
            <strong>Educational Use Only.</strong> SmartBudget is a prototype financial wellness tool for educational and demonstration purposes only. It does not provide financial, investment, legal, or tax advice. Your data is stored in your own account, protected by database access rules. Always consult a qualified financial professional before making financial decisions.{" "}
            <button type="button" onClick={() => navigate("disclaimer")} style={{ color: "#92400E", fontWeight: 600, textDecoration: "underline" }}>Read the full disclaimer</button>
          </p>
        </div>
      </div>

      {/* ── Footer ─────────────────────────────────────────────────────────── */}
      <SiteFooter navigate={navigate} onLanding />

    </div>
  );
}
