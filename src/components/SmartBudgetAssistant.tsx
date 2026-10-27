import { useState, useRef, useEffect, useCallback, type ReactNode } from "react";
import { generateResponse, FINANCIAL_DISCLAIMER } from "../lib/aiEngine";
import type { Screen } from "../App";

// ── Types ─────────────────────────────────────────────────────────────────────

type Message = {
  id:          number;
  role:        "user" | "assistant";
  text:        string;
  disclaimer?: boolean;
  ts:          string;
};

type Props = {
  navigate:  (s: Screen) => void;
  userName?: string;
  screen?:   Screen;
};

// ── Quick actions ─────────────────────────────────────────────────────────────

const QUICK_ACTIONS: { label: string; icon: ReactNode; screen: Screen }[] = [
  {
    label: "Dashboard",
    screen: "dashboard",
    icon: (
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
        <rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
      </svg>
    ),
  },
  {
    label: "Transactions",
    screen: "transactions",
    icon: (
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
      </svg>
    ),
  },
  {
    label: "Budget",
    screen: "budget",
    icon: (
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <path d="M2 20h20M5 20V10l7-7 7 7v10"/>
      </svg>
    ),
  },
  {
    label: "Savings Goals",
    screen: "savings",
    icon: (
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
      </svg>
    ),
  },
  {
    label: "Analytics",
    screen: "analytics",
    icon: (
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
      </svg>
    ),
  },
  {
    label: "Account Settings",
    screen: "settings",
    icon: (
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <circle cx="12" cy="12" r="3"/><path d="M19.07 4.93l-1.41 1.41M4.93 4.93l1.41 1.41M20 12h2M2 12h2M19.07 19.07l-1.41-1.41M4.93 19.07l1.41-1.41M12 20v2M12 2v2"/>
      </svg>
    ),
  },
];

const SUGGESTED_QUESTIONS = [
  "Why are my expenses high?",
  "How do I create a budget?",
  "Help me reach my savings goal.",
  "Explain my spending trends.",
  "How do I add a transaction?",
];

const WELCOME: Message = {
  id: 0,
  role: "assistant",
  text: "Hi! I'm SmartBudget Assistant. How can I help you today?",
  ts: now(),
};

// ── Helpers ───────────────────────────────────────────────────────────────────

let uid = 1;

function now() {
  return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function renderText(raw: string) {
  return raw.split("\n").map((line, i) => {
    const parts = line.split(/(\*\*[^*]+\*\*)/g).map((p, j) =>
      p.startsWith("**") && p.endsWith("**")
        ? <strong key={j}>{p.slice(2, -2)}</strong>
        : <span key={j}>{p}</span>
    );
    const bullet = line.trim().startsWith("•") || line.trim().startsWith("-");
    return (
      <span key={i} className={`block ${bullet ? "pl-3" : ""} ${i > 0 ? "mt-1.5" : ""}`}>
        {parts}
      </span>
    );
  });
}

// ── Typing dots ───────────────────────────────────────────────────────────────

function TypingDots() {
  return (
    <div className="flex items-end gap-2.5">
      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#2563EB] to-[#1D4ED8] flex items-center justify-center shrink-0 shadow-md">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
        </svg>
      </div>
      <div className="bg-white border border-[#E2E8F0] rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm flex items-center gap-1.5">
        {[0, 1, 2].map((i) => (
          <span key={i} className="w-2 h-2 rounded-full bg-[#CBD5E1] animate-bounce inline-block"
            style={{ animationDelay: `${i * 160}ms`, animationDuration: "1s" }} />
        ))}
      </div>
    </div>
  );
}

// ── Disclaimer ────────────────────────────────────────────────────────────────

function Disclaimer() {
  return (
    <div className="flex items-start gap-2 bg-[#FFFBEB] border border-[#FDE68A] rounded-xl px-3 py-2 mt-2">
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#D97706" strokeWidth="2" strokeLinecap="round" className="shrink-0 mt-0.5">
        <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
      </svg>
      <p className="text-[10px] text-[#92400E] leading-snug">{FINANCIAL_DISCLAIMER}</p>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function SmartBudgetAssistant({ navigate, userName, screen }: Props) {
  const [open, setOpen]          = useState(false);
  const [messages, setMessages]  = useState<Message[]>([WELCOME]);
  const [input, setInput]        = useState("");
  const [typing, setTyping]      = useState(false);
  const [unread, setUnread]      = useState(0);
  const bottomRef                = useRef<HTMLDivElement>(null);
  const inputRef                 = useRef<HTMLInputElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, typing]);

  useEffect(() => {
    if (open) {
      setUnread(0);
      setTimeout(() => inputRef.current?.focus(), 80);
    }
  }, [open]);

  useEffect(() => {
    if (screen === "transactions") setOpen(false);
  }, [screen]);

  const send = useCallback((text: string) => {
    if (!text.trim() || typing) return;
    const userMsg: Message = { id: uid++, role: "user", text: text.trim(), ts: now() };
    setMessages((p) => [...p, userMsg]);
    setInput("");
    setTyping(true);

    setTimeout(() => {
      const resp = generateResponse("dashboard", text, { userName });
      const botMsg: Message = { id: uid++, role: "assistant", text: resp.text, disclaimer: resp.disclaimer, ts: now() };
      setMessages((p) => [...p, botMsg]);
      setTyping(false);
      if (!open) setUnread((n) => n + 1);
    }, 500 + Math.random() * 600);
  }, [typing, open, userName]);

  const handleSubmit = (e: React.FormEvent) => { e.preventDefault(); send(input); };

  const clearChat = () => setMessages([WELCOME]);

  const handleQuickAction = (screen: Screen, label: string) => {
    const navMsg: Message = {
      id: uid++, role: "assistant",
      text: `Navigating you to **${label}** now…`,
      ts: now(),
    };
    setMessages((p) => [...p, navMsg]);
    setTimeout(() => { navigate(screen); setOpen(false); }, 600);
  };

  // Keep row actions clickable on Transactions; Ask AI in the nav still opens the assistant.
  if (screen === "transactions") return null;

  // ── Collapsed button ──────────────────────────────────────────────────────

  if (!open) {
    return (
      <div className="fixed bottom-24 right-4 z-50 sm:bottom-24 sm:right-6">
        <button
          onClick={() => setOpen(true)}
          className="relative w-14 h-14 rounded-full bg-gradient-to-br from-[#2563EB] to-[#1D4ED8] shadow-xl flex items-center justify-center text-white hover:scale-105 active:scale-95 transition-transform group"
          aria-label="Open SmartBudget Assistant"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
          </svg>
          {/* Pulse */}
          <span className="absolute inset-0 rounded-full bg-[#2563EB] animate-ping opacity-25" />
          {/* Unread badge */}
          {unread > 0 && (
            <span className="absolute -top-1 -right-1 w-5 h-5 bg-[#EF4444] text-white text-[10px] font-bold rounded-full flex items-center justify-center">
              {unread}
            </span>
          )}
          {/* Tooltip */}
          <span className="absolute right-full mr-3 bg-[#0F172A] text-white text-xs font-medium px-3 py-1.5 rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-lg">
            SmartBudget Assistant
          </span>
        </button>
      </div>
    );
  }

  // ── Open panel ────────────────────────────────────────────────────────────

  return (
    <div className="fixed bottom-0 right-0 z-50 flex items-end justify-end p-0 sm:p-4 pointer-events-none">
      <div
        className="pointer-events-auto flex flex-col bg-white border border-[#E2E8F0] shadow-2xl overflow-hidden"
        style={{
          width: "min(420px, 100vw)",
          height: "min(680px, 100dvh)",
          borderRadius: "1.25rem 1.25rem 0 0",
        }}
      >
        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="bg-gradient-to-r from-[#1E40AF] via-[#2563EB] to-[#3B82F6] px-4 py-4 shrink-0">
          <div className="flex items-center gap-3">
            {/* Bot avatar */}
            <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center shrink-0 border border-white/30">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white font-semibold text-sm leading-tight">SmartBudget Assistant</p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[#4ADE80] animate-pulse" />
                <p className="text-white/70 text-[11px]">Online · Educational AI only</p>
              </div>
            </div>
            {/* Actions */}
            <div className="flex items-center gap-1">
              <button
                onClick={clearChat}
                title="Clear chat"
                className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round">
                  <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
                </svg>
              </button>
              <button
                onClick={() => setOpen(false)}
                className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round">
                  <polyline points="18 15 12 9 6 15"/>
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* ── Quick navigation ────────────────────────────────────────────── */}
        <div className="px-4 pt-3 pb-2 border-b border-[#F1F5F9] shrink-0 bg-[#FAFBFF]">
          <p className="text-[10px] font-bold text-[#94A3B8] uppercase tracking-wide mb-2">Quick navigation</p>
          <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
            {QUICK_ACTIONS.map(({ label, icon, screen }) => (
              <button
                key={label}
                onClick={() => handleQuickAction(screen, label)}
                className="flex items-center gap-1.5 shrink-0 text-xs font-medium px-3 py-1.5 rounded-full border border-[#E2E8F0] bg-white text-[#374151] hover:border-[#93C5FD] hover:bg-[#EFF6FF] hover:text-[#2563EB] transition-all"
              >
                <span className="text-[#64748B]">{icon}</span>
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* ── Messages ────────────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 bg-[#F8FAFC]">
          {messages.map((msg) => (
            <div key={msg.id} className={`flex gap-2.5 ${msg.role === "user" ? "flex-row-reverse" : "flex-row"}`}>
              {/* Bot avatar */}
              {msg.role === "assistant" && (
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#2563EB] to-[#1D4ED8] flex items-center justify-center shrink-0 shadow-md mt-1">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                  </svg>
                </div>
              )}

              {/* Bubble */}
              <div className={`flex flex-col max-w-[80%] ${msg.role === "user" ? "items-end" : "items-start"}`}>
                <div
                  className={`px-4 py-3 rounded-2xl text-sm leading-relaxed shadow-sm ${
                    msg.role === "user"
                      ? "bg-gradient-to-br from-[#2563EB] to-[#1D4ED8] text-white rounded-br-sm"
                      : "bg-white text-[#0F172A] rounded-bl-sm border border-[#E8EEF8]"
                  }`}
                >
                  {renderText(msg.text)}
                </div>
                <span className="text-[10px] text-[#94A3B8] mt-1 px-1">{msg.ts}</span>
                {msg.disclaimer && <Disclaimer />}
              </div>
            </div>
          ))}

          {typing && <TypingDots />}
          <div ref={bottomRef} />
        </div>

        {/* ── Suggested questions (show only at start) ────────────────────── */}
        {messages.length <= 1 && !typing && (
          <div className="px-4 pt-2 pb-2 shrink-0 bg-[#F8FAFC] border-t border-[#F1F5F9]">
            <p className="text-[10px] font-bold text-[#94A3B8] uppercase tracking-wide mb-2">Suggested questions</p>
            <div className="space-y-1">
              {SUGGESTED_QUESTIONS.map((q) => (
                <button
                  key={q}
                  onClick={() => send(q)}
                  className="w-full text-left text-xs text-[#374151] bg-white border border-[#E2E8F0] rounded-xl px-3 py-2 hover:border-[#93C5FD] hover:bg-[#EFF6FF] hover:text-[#2563EB] transition-all flex items-center gap-2"
                >
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="2.5" strokeLinecap="round">
                    <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
                  </svg>
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── Input bar ───────────────────────────────────────────────────── */}
        <div className="px-4 py-3 border-t border-[#E8EEF8] bg-white shrink-0">
          <form onSubmit={handleSubmit} className="flex gap-2 items-center">
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask me anything…"
              disabled={typing}
              className="flex-1 border border-[#E2E8F0] rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#93C5FD] focus:border-[#2563EB] disabled:opacity-50 disabled:cursor-not-allowed bg-[#F8FAFC] transition-colors"
            />
            <button
              type="submit"
              disabled={!input.trim() || typing}
              className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#2563EB] to-[#1D4ED8] flex items-center justify-center text-white disabled:opacity-40 hover:opacity-90 transition-opacity shrink-0 shadow-sm"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
              </svg>
            </button>
          </form>
          <p className="text-[9px] text-[#CBD5E1] text-center mt-2 leading-tight">
            SmartBudget AI provides educational information only. Not financial advice.
          </p>
        </div>
      </div>
    </div>
  );
}
