import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import type { Screen } from "../App";
import { SITE, mailto } from "../lib/site";
import { isValidEmail } from "../lib/auth";

const TOPICS = [
  "General question",
  "Help using SmartBudget",
  "Report a problem",
  "Account or sign-in",
  "Privacy request",
  "Accessibility feedback",
  "Feedback or idea",
];

export default function Contact({ navigate, defaultName = "", defaultEmail = "" }: {
  navigate: (s: Screen) => void; defaultName?: string; defaultEmail?: string;
}) {
  const [name, setName] = useState(defaultName);
  const [email, setEmail] = useState(defaultEmail);
  const [topic, setTopic] = useState(TOPICS[0]);
  const [message, setMessage] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [sent, setSent] = useState(false);

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
    document.title = `Contact · ${SITE.name}`;
    return () => { document.title = SITE.name; };
  }, []);

  const to = topic === "Privacy request" ? SITE.privacyEmail : SITE.supportEmail;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const next: Record<string, string> = {};
    if (!name.trim()) next.name = "Please enter your name.";
    if (!isValidEmail(email.trim())) next.email = "Please enter a valid email address.";
    if (message.trim().length < 10) next.message = "Please write at least a short sentence (10+ characters).";
    setErrors(next);
    if (Object.keys(next).length) return;
    const body = `${message.trim()}\n\n—\nFrom: ${name.trim()} <${email.trim()}>\nTopic: ${topic}\nSent from the ${SITE.name} contact page`;
    window.location.href = mailto(to, `[${SITE.name}] ${topic}`, body);
    setSent(true);
  };

  const field = "w-full border rounded-xl px-4 py-3 text-sm outline-none bg-white focus:border-[#2563EB] focus:ring-2 focus:ring-blue-100";

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
      <nav className="flex items-center gap-1.5 text-xs text-[#94A3B8] mb-5" aria-label="Breadcrumb">
        <button type="button" onClick={() => navigate("landing")} className="hover:text-[#2563EB] font-medium">Home</button>
        <span aria-hidden="true">›</span>
        <span className="text-[#0F172A] font-medium">Contact</span>
      </nav>
      <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-[#0F172A]">Contact us</h1>
      <p className="mt-3 text-[17px] text-[#64748B] max-w-2xl">
        Questions, feedback or something not working? Send us a message and we'll get back to you, usually within one business day.
      </p>

      <div className="mt-10 grid lg:grid-cols-[1fr_340px] gap-8">
        <div className="bg-white rounded-2xl border border-[#E2E8F0] card-shadow p-6 sm:p-8">
          {sent ? (
            <div className="text-center py-10">
              <div className="w-16 h-16 rounded-full bg-[#DCFCE7] mx-auto flex items-center justify-center mb-4">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#16A34A" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
              </div>
              <h2 className="text-xl font-semibold text-[#0F172A]">Almost done</h2>
              <p className="mt-2 text-sm text-[#64748B] max-w-md mx-auto">
                Your email app should have opened with your message ready to send. If nothing happened, email us directly at{" "}
                <a href={`mailto:${to}`} className="text-[#2563EB] underline">{to}</a>.
              </p>
              <button type="button" onClick={() => { setSent(false); setMessage(""); }} className="mt-6 text-sm font-semibold text-[#2563EB] hover:underline">
                Write another message
              </button>
            </div>
          ) : (
            <form onSubmit={submit} noValidate className="space-y-5">
              <div className="grid sm:grid-cols-2 gap-5">
                <div>
                  <label htmlFor="c-name" className="block text-sm font-medium text-[#0F172A] mb-1.5">Your name</label>
                  <input id="c-name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name"
                    className={`${field} ${errors.name ? "border-[#FCA5A5]" : "border-[#E2E8F0]"}`} />
                  {errors.name && <p className="mt-1 text-xs text-[#DC2626]">{errors.name}</p>}
                </div>
                <div>
                  <label htmlFor="c-email" className="block text-sm font-medium text-[#0F172A] mb-1.5">Email address</label>
                  <input id="c-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email"
                    className={`${field} ${errors.email ? "border-[#FCA5A5]" : "border-[#E2E8F0]"}`} />
                  {errors.email && <p className="mt-1 text-xs text-[#DC2626]">{errors.email}</p>}
                </div>
              </div>
              <div>
                <label htmlFor="c-topic" className="block text-sm font-medium text-[#0F172A] mb-1.5">Topic</label>
                <select id="c-topic" value={topic} onChange={(e) => setTopic(e.target.value)} className={`${field} border-[#E2E8F0]`}>
                  {TOPICS.map((t) => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="c-msg" className="block text-sm font-medium text-[#0F172A] mb-1.5">Message</label>
                <textarea id="c-msg" rows={6} value={message} onChange={(e) => setMessage(e.target.value)} maxLength={4000}
                  placeholder="How can we help? Please don't include passwords or bank details."
                  className={`${field} resize-y ${errors.message ? "border-[#FCA5A5]" : "border-[#E2E8F0]"}`} />
                {errors.message && <p className="mt-1 text-xs text-[#DC2626]">{errors.message}</p>}
              </div>
              <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
                <p className="text-xs text-[#94A3B8]">
                  Sending opens your email app. See our{" "}
                  <button type="button" onClick={() => navigate("privacy")} className="underline hover:text-[#2563EB]">Privacy Policy</button>.
                </p>
                <button type="submit" className="bg-[#2563EB] text-white font-semibold px-6 py-3 rounded-xl hover:bg-[#1D4ED8] transition-colors text-sm">
                  Send message
                </button>
              </div>
            </form>
          )}
        </div>

        <aside className="space-y-4">
          <div className="bg-white rounded-2xl border border-[#E2E8F0] card-shadow p-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-[#94A3B8]">Email</p>
            <a href={`mailto:${SITE.supportEmail}`} className="mt-1 block font-semibold text-[#2563EB] break-all">{SITE.supportEmail}</a>
            <p className="mt-4 text-xs font-semibold uppercase tracking-wider text-[#94A3B8]">Support hours</p>
            <p className="mt-1 text-sm text-[#334155]">{SITE.supportHours}</p>
          </div>
          <div className="bg-white rounded-2xl border border-[#E2E8F0] card-shadow p-5">
            <p className="font-semibold text-[#0F172A]">Looking for a quick answer?</p>
            <p className="mt-1 text-sm text-[#64748B]">Most questions are answered in our Help Center.</p>
            <button type="button" onClick={() => navigate("helpCenter")} className="mt-3 text-sm font-semibold text-[#2563EB] hover:underline">Open the Help Center →</button>
          </div>
          <div className="rounded-2xl border border-[#FDE68A] bg-[#FFFBEB] p-5">
            <p className="font-semibold text-[#92400E]">Worried about money?</p>
            <p className="mt-1 text-sm text-[#92400E] leading-6">
              We can't give financial advice, but free, confidential help is available from the National Debt Helpline on{" "}
              <a href="tel:1800007007" className="font-semibold underline">1800 007 007</a> or{" "}
              <a href="https://ndh.org.au" target="_blank" rel="noopener noreferrer" className="font-semibold underline">ndh.org.au</a>.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
