import { useState, useRef, useEffect } from "react";

type Role = "user" | "assistant";
type Message = { id: number; role: Role; text: string; ts: string };

// --- Canned AI responses — keyword-matched, educational, non-prescriptive ---
const RESPONSES: { match: RegExp; reply: string }[] = [
  {
    match: /emergency fund|buffer|rainy day/i,
    reply: `An emergency fund is a dedicated cash reserve — typically 3 to 6 months of essential living expenses — held in a liquid account you can access quickly without selling assets or borrowing.\n\nThe general reasoning behind having one before other financial goals: it prevents a short-term problem (unexpected expense) from turning into a long-term one (debt you're paying interest on).\n\nHow much makes sense for someone varies. Someone with very stable employment and predictable expenses might feel comfortable at 3 months. Someone self-employed or in a field with volatile income often keeps closer to 6. Some people prefer even more — there's no universally right number.\n\nNote: this is a general explanation. I can't tell you the right amount for your personal situation.`,
  },
  {
    match: /budget|50.?30.?20|zero.?based|envelope/i,
    reply: `There are several common approaches to budgeting:\n\n**50/30/20**: Allocate roughly 50% of take-home pay to needs (housing, food, utilities), 30% to wants (dining out, entertainment), and 20% to savings and debt repayment. It's a useful starting structure, though the "right" percentages vary a lot by location and income level.\n\n**Zero-based budgeting**: Every dollar of income is assigned a category before the month begins — including savings. Income minus all assigned expenses equals zero. This approach creates high awareness of where money is going.\n\n**Envelope method**: Physically or digitally allocate fixed cash amounts to spending categories. When the envelope is empty, you stop spending in that category for the period.\n\nAll three have trade-offs — the right one depends on how much detail you want to manage and what motivates you to stick with it.`,
  },
  {
    match: /invest|stocks|shares|etf|index fund|superannuation|super|retirement/i,
    reply: `I can explain concepts around investing, but I want to be clear upfront: I can't tell you what to invest in, when to invest, or whether any specific product is right for you. That's the domain of a licensed financial adviser.\n\nGenerally, common frameworks people discuss in personal finance education:\n\n• **Superannuation/retirement accounts** (structure varies by country) — tax-advantaged savings vehicles for retirement. Contribution rules and tax treatment vary significantly.\n\n• **Index funds and ETFs** — these are pooled investments that track a market index. They're commonly discussed in financial education because of their low fees relative to actively managed funds, but past performance isn't a guide to future performance.\n\n• **Time horizon and risk tolerance** — two concepts that often come up: how long until you need the money, and how much volatility you could withstand without selling. These are genuinely personal factors.\n\nFor personalised investment guidance, a licensed financial adviser is the right resource.`,
  },
  {
    match: /debt|loan|credit card|repay|pay off|interest/i,
    reply: `Managing multiple debts is a common topic in personal finance. A few frameworks that educators often discuss:\n\n**Debt Avalanche**: Make minimum repayments on all debts, then direct any extra toward the highest-interest debt. Once that's paid, roll that payment to the next highest. This minimises total interest paid over time.\n\n**Debt Snowball**: Focus extra payments on the smallest balance first, regardless of interest rate. The argument for it is psychological — closing out accounts quickly can build motivation.\n\nWhich approach is mathematically optimal depends on the specific interest rates and balances involved. Which works better for a specific person depends on their psychology and ability to stay consistent.\n\nFor high-interest debt specifically (credit cards, payday loans), most financial education emphasises addressing it before lower-interest debt, since the interest accumulates quickly. But this is a general principle, not advice for your specific situation.`,
  },
  {
    match: /savings? goal|save for|saving up|how (long|much) to save/i,
    reply: `Setting a specific, time-bound savings goal changes the psychology of saving — "I'm saving $3,000 for travel by March" behaves differently in the brain than "I'm trying to save more."\n\nA few things that often come up in this area:\n\n• **Working backwards from a target**: If you need $5,000 in 18 months, that's roughly $278/month or $64/week. Making the number concrete helps you decide whether the goal is realistic at your current income.\n\n• **Separate accounts per goal**: Naming accounts after their purpose (Emergency Fund, Travel 2027) is a widely used technique for making goals feel real rather than abstract.\n\n• **Automation**: Setting up automatic transfers on payday — before the money reaches your everyday account — is one of the most consistently effective habits in personal finance.\n\nSmartBudget's Savings Goals feature can calculate your required monthly pace based on target amount and date.`,
  },
  {
    match: /credit score|credit history|credit report|credit rating/i,
    reply: `Credit scores summarise your borrowing history into a number lenders use to assess risk. The exact model varies by country, but the factors are broadly similar:\n\n**Payment history** (~35% in many models): Paying on time is the most impactful factor. A single missed payment can have a notable effect.\n\n**Credit utilisation** (~30%): The proportion of your available credit limit you're using. Generally, lower utilisation is better — below 30% is a common rule of thumb.\n\n**Length of credit history** (~15%): Older accounts help. Closing old accounts can reduce your average account age.\n\n**New credit enquiries** (~10%): Applying for credit generates a hard enquiry, which has a small temporary effect.\n\n**Credit mix** (~10%): Having different types of credit can help, but taking on debt purely to diversify isn't generally recommended in educational contexts.\n\nI can't tell you whether your specific score is good or bad for your situation — that's something to discuss with a financial professional.`,
  },
  {
    match: /tax|deduction|tax return|ATO|HMRC|IRS/i,
    reply: `I'm not able to provide tax advice — tax rules are highly specific to your country, income type, circumstances, and change regularly. This is an area where a qualified tax professional or accountant is the right resource.\n\nWhat I can say generally: most financial education resources suggest keeping records of income and major expenses year-round rather than scrambling at tax time. The specifics of what's deductible, what returns you need to file, and what strategies make sense are really outside what an educational tool like this can helpfully address.\n\nFor country-specific guidance, the tax authority's website (ATO in Australia, HMRC in the UK, IRS in the US, etc.) has official information, and a registered tax agent or accountant can give you advice specific to your situation.`,
  },
  {
    match: /insurance|life insurance|income protection|health insurance/i,
    reply: `Insurance is a risk management tool — you pay a regular premium to transfer the financial risk of certain events to an insurer.\n\nCommon types that come up in personal finance:\n\n• **Health insurance**: Coverage for medical costs. The cost/benefit calculation depends heavily on your country's public health system, your income, and your expected healthcare needs.\n\n• **Income protection**: Replaces a portion of income if you're unable to work due to illness or injury. Relevant for people who are self-employed or don't have significant sick leave entitlements.\n\n• **Life insurance**: Provides a payout to dependents on your death. Generally more relevant if others depend on your income.\n\nWhether any specific type of insurance is right for you, what coverage amount makes sense, and which products to consider are questions for a licensed insurance adviser — I can only explain the concepts.`,
  },
  {
    match: /house|home (loan|deposit|buying)|mortgage|property|rent vs buy/i,
    reply: `The "rent vs buy" question is one of the most frequently discussed in personal finance, and it doesn't have a universal answer.\n\nFactors that tend to feature in this discussion:\n\n• **Time horizon**: Buying has significant upfront and transaction costs (stamp duty, legal fees, inspections). These typically need to be amortised over several years for buying to "break even" vs renting and investing the difference.\n\n• **Opportunity cost**: A deposit tied up in a property isn't invested elsewhere. The comparison depends on assumptions about property appreciation and investment returns — both of which are uncertain.\n\n• **Stability value**: Owning provides certainty about your housing costs (with a fixed mortgage) and the ability to modify the space. These are real but hard to quantify.\n\nThe right answer genuinely depends on your specific market, financial position, how long you plan to stay, and your priorities. A mortgage broker can explain loan structures; a financial adviser can help think through the broader picture.`,
  },
  {
    match: /how (do|does|can|should)|what is|explain|tell me about|help me understand/i,
    reply: `Happy to help explain financial concepts. Could you tell me more specifically what you'd like to understand? For example:\n\n• How budgeting frameworks work (50/30/20, zero-based, etc.)\n• How debt repayment strategies compare (avalanche vs snowball)\n• How emergency funds are generally structured\n• How credit scores are calculated\n• How savings goals can be structured with timelines\n\nI can explain concepts and trade-offs in general terms. I can't recommend specific financial products, investments, or tell you what you personally should do with your money — for that, a licensed financial adviser is the right resource.`,
  },
];

const DEFAULT_REPLY = `That's an interesting question. I can share some general financial education context, though I want to be upfront about what I'm able to do:\n\nI can:\n• Explain financial concepts and terminology\n• Describe how different budgeting, saving, or debt strategies work\n• Explain trade-offs between approaches\n• Point you toward types of professionals who can help with specific decisions\n\nI can't:\n• Recommend specific investments, products, or providers\n• Tell you what you personally should do with your money\n• Give tax, legal, or insurance advice\n\nCould you rephrase your question around a concept you'd like explained, or a topic you want to understand better?`;

const SUGGESTIONS = [
  "What is an emergency fund and how much should I have?",
  "How does the 50/30/20 budget work?",
  "What's the difference between debt avalanche and snowball?",
  "How are credit scores calculated?",
  "How can I structure a savings goal with a timeline?",
];

function now() {
  return new Date().toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit" });
}

function getReply(text: string): string {
  const match = RESPONSES.find((r) => r.match.test(text));
  return match ? match.reply : DEFAULT_REPLY;
}

function TypingIndicator() {
  return (
    <div className="flex items-center gap-1 px-4 py-3">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="w-2 h-2 rounded-full bg-[#94A3B8]"
          style={{ animation: `bounce 1.2s ${i * 0.2}s infinite ease-in-out` }}
        />
      ))}
      <style>{`
        @keyframes bounce {
          0%, 80%, 100% { transform: translateY(0); }
          40% { transform: translateY(-6px); }
        }
      `}</style>
    </div>
  );
}

function MessageBubble({ msg }: { msg: Message }) {
  const isUser = msg.role === "user";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"} mb-4`}>
      {!isUser && (
        <div className="w-7 h-7 rounded-full bg-[#EFF6FF] flex items-center justify-center mr-2 mt-0.5 shrink-0">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="2" strokeLinecap="round">
            <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z"/>
          </svg>
        </div>
      )}
      <div className="max-w-[80%]">
        <div
          className={`rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-line ${
            isUser
              ? "bg-[#2563EB] text-white rounded-tr-sm"
              : "bg-white border border-[#E2E8F0] text-[#0F172A] rounded-tl-sm card-shadow"
          }`}
        >
          {msg.text}
        </div>
        <p className={`text-[10px] text-[#94A3B8] mt-1 ${isUser ? "text-right" : "text-left"}`}>{msg.ts}</p>
      </div>
    </div>
  );
}

const INITIAL_MESSAGES: Message[] = [
  {
    id: 1,
    role: "assistant",
    ts: now(),
    text: `Hi, I'm SmartBudget's educational assistant. I can explain financial concepts and help you understand how budgeting, saving, and debt management work.\n\nA few things to know:\n• I explain options and trade-offs — I don't tell you what to do with your money\n• I never recommend specific investments, products, or providers\n• For personalised financial advice, a licensed financial adviser is the right resource\n\nWhat would you like to understand?`,
  },
];

export default function Ask() {
  const [messages, setMessages] = useState<Message[]>(INITIAL_MESSAGES);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, typing]);

  const send = (text: string) => {
    if (!text.trim() || typing) return;
    const userMsg: Message = { id: Date.now(), role: "user", text: text.trim(), ts: now() };
    setMessages((m) => [...m, userMsg]);
    setInput("");
    setTyping(true);

    const delay = 800 + Math.random() * 700;
    setTimeout(() => {
      const reply = getReply(text);
      setMessages((m) => [...m, { id: Date.now() + 1, role: "assistant", text: reply, ts: now() }]);
      setTyping(false);
    }, delay);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); }
  };

  return (
    <div className="flex flex-col h-full max-h-screen">
      {/* Header */}
      <div className="px-6 lg:px-8 py-5 border-b border-[#E2E8F0] bg-white shrink-0">
        <div className="flex items-center gap-3 max-w-[800px]">
          <div className="w-10 h-10 rounded-xl bg-[#EFF6FF] flex items-center justify-center">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="2" strokeLinecap="round">
              <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z"/>
            </svg>
          </div>
          <div>
            <h1 className="font-bold text-[#0F172A]">Ask AI</h1>
            <p className="text-xs text-[#64748B]">Educational financial questions, explained clearly</p>
          </div>
          <div className="ml-auto flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-[#10B981]" />
            <span className="text-xs text-[#64748B]">Online</span>
          </div>
        </div>
      </div>

      {/* Message list */}
      <div className="flex-1 overflow-y-auto px-6 lg:px-8 py-5 bg-[#F8FAFC]">
        <div className="max-w-[800px] mx-auto">
          {messages.map((msg) => <MessageBubble key={msg.id} msg={msg} />)}
          {typing && (
            <div className="flex justify-start mb-4">
              <div className="w-7 h-7 rounded-full bg-[#EFF6FF] flex items-center justify-center mr-2 mt-0.5 shrink-0">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="2" strokeLinecap="round">
                  <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z"/>
                </svg>
              </div>
              <div className="bg-white border border-[#E2E8F0] rounded-2xl rounded-tl-sm card-shadow">
                <TypingIndicator />
              </div>
            </div>
          )}

          {/* Suggested questions — only shown before first user message */}
          {messages.length === 1 && (
            <div className="mt-2">
              <p className="text-xs text-[#94A3B8] mb-3 text-center">Suggested questions</p>
              <div className="flex flex-wrap gap-2 justify-center">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => send(s)}
                    className="text-xs bg-white border border-[#E2E8F0] text-[#64748B] px-3 py-1.5 rounded-xl hover:border-[#2563EB] hover:text-[#2563EB] transition-colors card-shadow"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>
      </div>

      {/* Input area */}
      <div className="shrink-0 border-t border-[#E2E8F0] bg-white px-6 lg:px-8 py-4">
        <div className="max-w-[800px] mx-auto">
          <div className="bg-[#FEF3C7] border border-[#FDE68A] rounded-xl px-4 py-2 mb-3">
            <p className="text-xs text-[#92400E]">
              <strong>Educational tool only</strong> — Responses explain concepts and options, never recommend specific products, investments, or personal actions. Not a substitute for a licensed financial adviser.
            </p>
          </div>
          <div className="flex gap-3 items-end">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about budgeting, saving, debt, credit…"
              rows={1}
              style={{ resize: "none" }}
              className="flex-1 border border-[#E2E8F0] rounded-xl px-4 py-3 text-sm outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-blue-100 max-h-32 overflow-y-auto"
              onInput={(e) => {
                const el = e.currentTarget;
                el.style.height = "auto";
                el.style.height = `${Math.min(el.scrollHeight, 128)}px`;
              }}
            />
            <button
              onClick={() => send(input)}
              disabled={!input.trim() || typing}
              className="w-10 h-10 rounded-xl bg-[#2563EB] flex items-center justify-center hover:bg-[#1D4ED8] transition-colors disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
              </svg>
            </button>
          </div>
          <p className="text-[10px] text-[#94A3B8] text-center mt-2">
            Press Enter to send · Shift+Enter for new line
          </p>
        </div>
      </div>
    </div>
  );
}
