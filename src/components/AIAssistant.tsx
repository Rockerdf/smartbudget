import { useState, useRef, useEffect, useCallback } from "react";
import {
  generateResponse,
  SUGGESTED_PROMPTS,
  FINANCIAL_DISCLAIMER,
} from "../lib/aiEngine";
import type { AssistantContext, ContextData } from "../lib/aiEngine";

// ── Types ─────────────────────────────────────────────────────────────────────

type ChatMessage = {
  id:          number;
  role:        "user" | "assistant";
  text:        string;
  disclaimer?: boolean;
  typing?:     boolean;
};

type Props = {
  context:       AssistantContext;
  contextData?:  ContextData;
  assistantName: string;
  /** Accent colour for the widget button + header */
  accentColor?:  string;
  /** Whether this is an admin assistant (different visual style) */
  admin?:        boolean;
};

// ── Markdown-lite renderer ────────────────────────────────────────────────────
// Handles **bold**, bullet lists, and newlines only.

function renderText(raw: string) {
  const lines = raw.split("\n");
  return lines.map((line, i) => {
    // Bold
    const parts = line.split(/(\*\*[^*]+\*\*)/g).map((part, j) => {
      if (part.startsWith("**") && part.endsWith("**")) {
        return <strong key={j}>{part.slice(2, -2)}</strong>;
      }
      return <span key={j}>{part}</span>;
    });
    // Bullet
    const isBullet = line.trim().startsWith("•") || line.trim().startsWith("-");
    return (
      <span key={i} className={`block ${isBullet ? "pl-2" : ""} ${i > 0 ? "mt-1" : ""}`}>
        {parts}
      </span>
    );
  });
}

// ── Typing dots ───────────────────────────────────────────────────────────────

function TypingIndicator() {
  return (
    <div className="flex items-center gap-1 px-4 py-3 bg-white rounded-2xl rounded-bl-sm w-fit border border-[#F1F5F9] shadow-sm">
      {[0, 1, 2].map((i) => (
        <span key={i} className="w-1.5 h-1.5 rounded-full bg-[#94A3B8] inline-block animate-bounce"
          style={{ animationDelay: `${i * 150}ms`, animationDuration: "0.9s" }} />
      ))}
    </div>
  );
}

// ── Avatar icons ──────────────────────────────────────────────────────────────

function BotAvatar({ color, admin }: { color: string; admin?: boolean }) {
  return (
    <div
      style={{ backgroundColor: color }}
      className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 shadow-sm">
      {admin ? (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="white">
          <path d="M12 2l9 4v6c0 5.25-3.75 10.14-9 11.5C6.75 22.14 3 17.25 3 12V6l9-4z"/>
        </svg>
      ) : (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round">
          <circle cx="12" cy="12" r="3"/><path d="M19.07 4.93l-1.41 1.41M4.93 4.93l1.41 1.41M20 12h2M2 12h2M19.07 19.07l-1.41-1.41M4.93 19.07l1.41-1.41M12 20v2M12 2v2"/>
        </svg>
      )}
    </div>
  );
}

// ── Disclaimer badge ──────────────────────────────────────────────────────────

function DisclaimerBadge() {
  return (
    <div className="mt-2 flex items-start gap-1.5 bg-[#FFFBEB] border border-[#FDE68A] rounded-xl px-3 py-2">
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#D97706" strokeWidth="2" strokeLinecap="round" className="shrink-0 mt-0.5">
        <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
      </svg>
      <p className="text-[10px] text-[#92400E] leading-tight">{FINANCIAL_DISCLAIMER}</p>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

let msgId = 0;

export default function AIAssistant({
  context,
  contextData = {},
  assistantName,
  accentColor = "#2563EB",
  admin = false,
}: Props) {
  const [open, setOpen]         = useState(false);
  const [input, setInput]       = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const bottomRef               = useRef<HTMLDivElement>(null);
  const inputRef                = useRef<HTMLInputElement>(null);

  const suggestions = SUGGESTED_PROMPTS[context];

  // Greeting on first open
  useEffect(() => {
    if (open && messages.length === 0) {
      const greeting = generateResponse(context, "hello", contextData);
      setMessages([{ id: ++msgId, role: "assistant", text: greeting.text, disclaimer: greeting.disclaimer }]);
    }
  }, [open]);

  // Scroll to bottom on new message
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  // Focus input when opened
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 100);
  }, [open]);

  const sendMessage = useCallback((text: string) => {
    if (!text.trim() || isTyping) return;
    const userMsg: ChatMessage = { id: ++msgId, role: "user", text: text.trim() };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsTyping(true);

    // Simulate network latency (400–900ms)
    const delay = 400 + Math.random() * 500;
    setTimeout(() => {
      const resp = generateResponse(context, text, contextData);
      setMessages((prev) => [
        ...prev,
        { id: ++msgId, role: "assistant", text: resp.text, disclaimer: resp.disclaimer },
      ]);
      setIsTyping(false);
    }, delay);
  }, [context, contextData, isTyping]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  // ── Closed state: floating button ──────────────────────────────────────────

  if (!open) {
    return (
      <div className="fixed bottom-6 right-6 z-40">
        <button
          onClick={() => setOpen(true)}
          style={{ backgroundColor: accentColor }}
          className="w-14 h-14 rounded-full shadow-xl flex items-center justify-center text-white hover:scale-105 active:scale-95 transition-transform relative group"
          title={`Open ${assistantName}`}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
          </svg>
          {/* Pulse ring */}
          <span className="absolute inset-0 rounded-full animate-ping opacity-20" style={{ backgroundColor: accentColor }} />
          {/* Tooltip */}
          <span className="absolute right-full mr-3 bg-[#0F172A] text-white text-xs font-medium px-3 py-1.5 rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
            {assistantName}
          </span>
        </button>
      </div>
    );
  }

  // ── Open state: side panel ─────────────────────────────────────────────────

  return (
    <div className="fixed bottom-0 right-0 z-40 flex flex-col"
      style={{ width: 380, height: "min(640px, 90vh)" }}>

      {/* Panel */}
      <div className="flex flex-col h-full bg-white rounded-tl-2xl rounded-bl-2xl shadow-2xl border border-[#E2E8F0] overflow-hidden">

        {/* Header */}
        <div style={{ backgroundColor: accentColor }} className="px-4 py-3.5 flex items-center gap-3 shrink-0">
          <BotAvatar color="rgba(255,255,255,0.25)" admin={admin} />
          <div className="flex-1 min-w-0">
            <p className="text-white font-semibold text-sm leading-none">{assistantName}</p>
            <p className="text-white/60 text-[10px] mt-0.5 leading-none">AI Assistant · Educational only</p>
          </div>
          <button onClick={() => setOpen(false)}
            className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {/* Message list */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 bg-[#F8FAFC]">
          {messages.map((msg) => (
            <div key={msg.id} className={`flex gap-2.5 ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
              {msg.role === "assistant" && <BotAvatar color={accentColor} admin={admin} />}
              <div className={`max-w-[85%] ${msg.role === "user" ? "items-end" : "items-start"} flex flex-col`}>
                <div
                  className={`px-4 py-3 rounded-2xl text-sm leading-relaxed shadow-sm ${
                    msg.role === "user"
                      ? "text-white rounded-br-sm"
                      : "bg-white text-[#0F172A] rounded-bl-sm border border-[#F1F5F9]"
                  }`}
                  style={msg.role === "user" ? { backgroundColor: accentColor } : {}}>
                  {renderText(msg.text)}
                </div>
                {msg.disclaimer && <DisclaimerBadge />}
              </div>
            </div>
          ))}

          {isTyping && (
            <div className="flex gap-2.5">
              <BotAvatar color={accentColor} admin={admin} />
              <TypingIndicator />
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Suggested prompts */}
        {messages.length <= 1 && !isTyping && (
          <div className="px-4 pb-3 shrink-0 bg-[#F8FAFC]">
            <p className="text-[10px] font-bold text-[#94A3B8] uppercase tracking-wide mb-2">Try asking…</p>
            <div className="flex flex-wrap gap-1.5">
              {suggestions.slice(0, 4).map((prompt) => (
                <button
                  key={prompt}
                  onClick={() => sendMessage(prompt)}
                  className="text-xs px-3 py-1.5 rounded-full border border-[#E2E8F0] bg-white text-[#475569] hover:border-[#BFDBFE] hover:text-[#2563EB] transition-colors">
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Input */}
        <div className="px-4 py-3 border-t border-[#F1F5F9] bg-white shrink-0">
          <form onSubmit={handleSubmit} className="flex gap-2">
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask anything…"
              disabled={isTyping}
              className="flex-1 border border-[#E2E8F0] rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ ["--tw-ring-color" as string]: accentColor }}
            />
            <button
              type="submit"
              disabled={!input.trim() || isTyping}
              style={{ backgroundColor: accentColor }}
              className="w-10 h-10 rounded-xl flex items-center justify-center text-white disabled:opacity-40 hover:opacity-90 transition-opacity shrink-0">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
              </svg>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
