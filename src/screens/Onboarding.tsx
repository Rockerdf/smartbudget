import { useState, useEffect } from "react";

type OnboardingData = {
  monthlyIncome: number;
  budgets: Record<string, number>;
  savingsGoalName: string;
  savingsTarget: number;
  savingsMonthly: number;
};

function roundToNearest50(n: number): number {
  return Math.round(n / 50) * 50;
}

function calcDefaultBudgets(income: number): Record<string, number> {
  return {
    Housing: roundToNearest50(Math.min(income * 0.35, 1400)),
    "Food & Dining": Math.min(Math.round(income * 0.12), 500),
    Transport: Math.min(Math.round(income * 0.1), 350),
    Utilities: Math.min(Math.round(income * 0.05), 200),
    Entertainment: Math.min(Math.round(income * 0.05), 150),
    Shopping: Math.min(Math.round(income * 0.07), 250),
    Health: Math.min(Math.round(income * 0.04), 150),
    Savings: Math.min(Math.round(income * 0.15), 600),
  };
}

const BUDGET_EMOJIS: Record<string, string> = {
  Housing: "🏠",
  "Food & Dining": "🍽️",
  Transport: "🚌",
  Utilities: "💡",
  Entertainment: "🎬",
  Shopping: "🛍️",
  Health: "💊",
  Savings: "💰",
};

const GOAL_OPTIONS = [
  "Emergency Fund",
  "Holiday Fund",
  "Car Fund",
  "House Deposit",
  "Other",
];

const DEFAULTS: OnboardingData = {
  monthlyIncome: 0,
  budgets: calcDefaultBudgets(4200),
  savingsGoalName: "Emergency Fund",
  savingsTarget: 5000,
  savingsMonthly: 600,
};

// Icons
function WalletIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
      <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
      <path d="M12 12h.01" />
    </svg>
  );
}

function SlidersIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="4" y1="21" x2="4" y2="14" />
      <line x1="4" y1="10" x2="4" y2="3" />
      <line x1="12" y1="21" x2="12" y2="12" />
      <line x1="12" y1="8" x2="12" y2="3" />
      <line x1="20" y1="21" x2="20" y2="16" />
      <line x1="20" y1="12" x2="20" y2="3" />
      <line x1="1" y1="14" x2="7" y2="14" />
      <line x1="9" y1="8" x2="15" y2="8" />
      <line x1="17" y1="16" x2="23" y2="16" />
    </svg>
  );
}

function TargetIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="6" />
      <circle cx="12" cy="12" r="2" />
    </svg>
  );
}

function CheckCircleIcon({ size = 80 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

// Step progress indicator
function StepIndicator({ current }: { current: number }) {
  const steps = ["Income", "Budget", "Goal", "Complete"];
  return (
    <div className="flex items-center justify-center mb-8 px-2">
      {steps.map((label, i) => {
        const stepNum = i + 1;
        const completed = stepNum < current;
        const active = stepNum === current;
        return (
          <div key={label} className="flex items-center">
            <div className="flex flex-col items-center gap-1">
              <div
                className="flex items-center justify-center w-8 h-8 rounded-full text-sm font-semibold transition-all duration-300"
                style={{
                  backgroundColor: completed ? "#2563EB" : active ? "#2563EB" : "transparent",
                  border: completed || active ? "2px solid #2563EB" : "2px solid #CBD5E1",
                  color: completed || active ? "#fff" : "#94A3B8",
                }}
              >
                {completed ? <CheckIcon /> : stepNum}
              </div>
              <span
                className="text-xs font-medium hidden sm:block"
                style={{ color: active ? "#2563EB" : completed ? "#64748B" : "#94A3B8" }}
              >
                {label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div
                className="h-0.5 mx-1 sm:mx-2 transition-all duration-500"
                style={{
                  width: "40px",
                  backgroundColor: stepNum < current ? "#2563EB" : "#E2E8F0",
                  marginBottom: "18px",
                }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

// Shared input styles
const inputBase =
  "border border-[#E2E8F0] rounded-xl px-4 py-3 w-full focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-[#2563EB] text-[#1E293B] text-base transition-all";
const inputError =
  "border-red-400 focus:ring-red-200 focus:border-red-400";

function DollarInput({
  value,
  onChange,
  placeholder = "0.00",
  hasError = false,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  hasError?: boolean;
}) {
  return (
    <div className="flex rounded-xl overflow-hidden border border-[#E2E8F0] focus-within:ring-2 focus-within:ring-blue-200 focus-within:border-[#2563EB] transition-all"
      style={{ borderColor: hasError ? "#f87171" : undefined }}>
      <span
        className="flex items-center px-3 py-3 text-[#64748B] text-base select-none"
        style={{ backgroundColor: "#F8FAFC", borderRight: "1px solid #E2E8F0" }}
      >
        $
      </span>
      <input
        type="number"
        min="0"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="flex-1 px-4 py-3 text-[#1E293B] text-base focus:outline-none"
        style={{ backgroundColor: "#fff" }}
      />
    </div>
  );
}

// Step 1 — Income
function Step1({
  income,
  setIncome,
  onContinue,
  onSkip,
}: {
  income: string;
  setIncome: (v: string) => void;
  onContinue: () => void;
  onSkip: () => void;
}) {
  const incomeNum = parseFloat(income);
  const valid = !isNaN(incomeNum) && incomeNum > 0;
  const showError = income !== "" && !valid;

  return (
    <div className="animate-in fade-in slide-in-from-right-4 duration-300">
      <div className="flex flex-col items-center mb-6">
        <div
          className="flex items-center justify-center w-16 h-16 rounded-full mb-4"
          style={{ backgroundColor: "#EFF6FF", color: "#2563EB" }}
        >
          <WalletIcon />
        </div>
        <h2 className="text-2xl font-bold text-[#1E293B] text-center mb-2">
          What's your monthly income?
        </h2>
        <p className="text-[#64748B] text-center text-sm leading-relaxed">
          We'll use this to help set realistic budgets and savings targets.
        </p>
      </div>

      <div className="mb-2">
        <label className="block text-sm font-medium text-[#374151] mb-2">
          Monthly take-home income
        </label>
        <DollarInput
          value={income}
          onChange={setIncome}
          placeholder="0.00"
          hasError={showError}
        />
        {showError && (
          <p className="text-red-500 text-xs mt-1.5">Please enter a valid income amount greater than 0.</p>
        )}
      </div>

      <div className="mt-8 flex flex-col gap-3">
        <button
          onClick={onContinue}
          disabled={!valid}
          className="w-full py-3.5 rounded-xl text-white font-semibold text-base transition-all"
          style={{
            backgroundColor: valid ? "#2563EB" : "#CBD5E1",
            cursor: valid ? "pointer" : "not-allowed",
          }}
        >
          Continue →
        </button>
        <button
          onClick={onSkip}
          className="text-[#94A3B8] text-sm text-center hover:text-[#64748B] transition-colors py-1"
        >
          I'll set this up later
        </button>
      </div>
    </div>
  );
}

// Step 2 — Budget Setup
function Step2({
  budgets,
  setBudgets,
  income,
  onContinue,
  onBack,
}: {
  budgets: Record<string, number>;
  setBudgets: (b: Record<string, number>) => void;
  income: number;
  onContinue: () => void;
  onBack: () => void;
}) {
  const total = Object.values(budgets).reduce((a, b) => a + b, 0);
  const overBudget = income > 0 && total > income;

  function updateBudget(key: string, val: string) {
    const n = parseFloat(val);
    setBudgets({ ...budgets, [key]: isNaN(n) ? 0 : Math.max(0, n) });
  }

  return (
    <div className="animate-in fade-in slide-in-from-right-4 duration-300">
      <div className="flex flex-col items-center mb-6">
        <div
          className="flex items-center justify-center w-16 h-16 rounded-full mb-4"
          style={{ backgroundColor: "#F5F3FF", color: "#7C3AED" }}
        >
          <SlidersIcon />
        </div>
        <h2 className="text-2xl font-bold text-[#1E293B] text-center mb-2">
          Set your monthly budgets
        </h2>
        <p className="text-[#64748B] text-center text-sm leading-relaxed">
          These are AI-suggested starting points — you can adjust anytime.
        </p>
      </div>

      <div className="flex flex-col gap-2 mb-4">
        {Object.entries(budgets).map(([key, val]) => (
          <div key={key} className="flex items-center gap-3 py-1">
            <span className="text-xl w-7 text-center flex-shrink-0">{BUDGET_EMOJIS[key]}</span>
            <span className="text-sm font-medium text-[#374151] flex-1 min-w-0">
              {key}
              {key === "Savings" && (
                <span
                  className="ml-2 text-xs font-semibold px-1.5 py-0.5 rounded-full"
                  style={{ backgroundColor: "#EFF6FF", color: "#2563EB" }}
                >
                  AI Suggested
                </span>
              )}
            </span>
            <div
              className="flex rounded-lg overflow-hidden border border-[#E2E8F0] focus-within:ring-1 focus-within:ring-blue-200 focus-within:border-[#2563EB] transition-all"
              style={{ width: "120px" }}
            >
              <span
                className="flex items-center px-2 py-2 text-[#64748B] text-sm select-none"
                style={{ backgroundColor: "#F8FAFC", borderRight: "1px solid #E2E8F0" }}
              >
                $
              </span>
              <input
                type="number"
                min="0"
                value={val || ""}
                onChange={(e) => updateBudget(key, e.target.value)}
                className="w-full px-2 py-2 text-[#1E293B] text-sm focus:outline-none"
                style={{ backgroundColor: "#fff" }}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Total vs income */}
      <div
        className="flex items-center justify-between rounded-xl px-4 py-3 mb-4"
        style={{ backgroundColor: overBudget ? "#FEF2F2" : "#F8FAFC", border: overBudget ? "1px solid #FCA5A5" : "1px solid #E2E8F0" }}
      >
        <span className="text-sm font-medium" style={{ color: overBudget ? "#DC2626" : "#374151" }}>
          Total budgeted
        </span>
        <div className="text-right">
          <span className="text-sm font-bold" style={{ color: overBudget ? "#DC2626" : "#1E293B" }}>
            ${total.toLocaleString()}
          </span>
          {income > 0 && (
            <span className="text-sm text-[#94A3B8] ml-1">/ ${income.toLocaleString()}</span>
          )}
        </div>
      </div>
      {overBudget && (
        <p className="text-red-500 text-xs mb-3 flex items-center gap-1">
          <span>⚠</span> Budgets exceed income by ${(total - income).toLocaleString()}
        </p>
      )}

      <div className="flex gap-3 mt-2">
        <button
          onClick={onBack}
          className="flex-1 py-3.5 rounded-xl font-semibold text-base border border-[#E2E8F0] text-[#64748B] hover:bg-[#F8FAFC] transition-all"
        >
          ← Back
        </button>
        <button
          onClick={onContinue}
          className="flex-1 py-3.5 rounded-xl text-white font-semibold text-base transition-all"
          style={{ backgroundColor: "#2563EB" }}
        >
          Continue →
        </button>
      </div>
    </div>
  );
}

// Step 3 — Savings Goal
function Step3({
  goalName,
  setGoalName,
  target,
  setTarget,
  monthly,
  setMonthly,
  onContinue,
  onBack,
}: {
  goalName: string;
  setGoalName: (v: string) => void;
  target: string;
  setTarget: (v: string) => void;
  monthly: string;
  setMonthly: (v: string) => void;
  onContinue: () => void;
  onBack: () => void;
}) {
  const isOther = goalName === "Other";
  const [customName, setCustomName] = useState("");

  const displayName = isOther ? customName : goalName;
  const targetNum = parseFloat(target);
  const monthlyNum = parseFloat(monthly);
  const monthsNeeded =
    !isNaN(targetNum) && !isNaN(monthlyNum) && monthlyNum > 0
      ? Math.ceil(targetNum / monthlyNum)
      : null;

  return (
    <div className="animate-in fade-in slide-in-from-right-4 duration-300">
      <div className="flex flex-col items-center mb-6">
        <div
          className="flex items-center justify-center w-16 h-16 rounded-full mb-4"
          style={{ backgroundColor: "#F0FDF4", color: "#16A34A" }}
        >
          <TargetIcon />
        </div>
        <h2 className="text-2xl font-bold text-[#1E293B] text-center mb-2">
          Set your first savings goal
        </h2>
        <p className="text-[#64748B] text-center text-sm leading-relaxed">
          Having a clear goal makes it 3× more likely you'll save consistently.
        </p>
      </div>

      <div className="flex flex-col gap-4">
        <div>
          <label className="block text-sm font-medium text-[#374151] mb-2">Goal Name</label>
          <select
            value={goalName}
            onChange={(e) => setGoalName(e.target.value)}
            className={inputBase}
            style={{ backgroundColor: "#fff" }}
          >
            {GOAL_OPTIONS.map((o) => (
              <option key={o} value={o}>{o}</option>
            ))}
          </select>
        </div>

        {isOther && (
          <div>
            <label className="block text-sm font-medium text-[#374151] mb-2">Custom Goal Name</label>
            <input
              type="text"
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
              placeholder="Enter your goal name"
              className={inputBase}
              style={{ backgroundColor: "#fff" }}
            />
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-[#374151] mb-2">Target Amount</label>
          <DollarInput value={target} onChange={setTarget} placeholder="5000" />
        </div>

        <div>
          <label className="block text-sm font-medium text-[#374151] mb-2">Monthly Contribution</label>
          <DollarInput value={monthly} onChange={setMonthly} placeholder="500" />
        </div>

        {monthsNeeded !== null && (
          <div
            className="rounded-xl px-4 py-3 text-sm"
            style={{ backgroundColor: "#F0FDF4", border: "1px solid #BBF7D0", color: "#15803D" }}
          >
            At <strong>${monthlyNum.toLocaleString()}/month</strong>, you'll reach your goal in approximately{" "}
            <strong>
              {monthsNeeded} {monthsNeeded === 1 ? "month" : "months"}
            </strong>
            {monthsNeeded > 12 && ` (${Math.floor(monthsNeeded / 12)}y ${monthsNeeded % 12}m)`}.
          </div>
        )}
      </div>

      <div className="flex gap-3 mt-6">
        <button
          onClick={onBack}
          className="flex-1 py-3.5 rounded-xl font-semibold text-base border border-[#E2E8F0] text-[#64748B] hover:bg-[#F8FAFC] transition-all"
        >
          ← Back
        </button>
        <button
          onClick={onContinue}
          className="flex-1 py-3.5 rounded-xl text-white font-semibold text-base transition-all"
          style={{ backgroundColor: "#16A34A" }}
        >
          Create Goal →
        </button>
      </div>
    </div>
  );
}

// Step 4 — Complete
function Step4({
  income,
  goalName,
  onComplete,
}: {
  income: number;
  goalName: string;
  onComplete: () => void;
}) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 80);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="animate-in fade-in slide-in-from-right-4 duration-300 flex flex-col items-center text-center">
      <div
        className="flex items-center justify-center w-24 h-24 rounded-full mb-6 transition-all duration-500"
        style={{
          backgroundColor: "#F0FDF4",
          color: "#16A34A",
          transform: visible ? "scale(1)" : "scale(0.5)",
          opacity: visible ? 1 : 0,
        }}
      >
        <CheckCircleIcon size={52} />
      </div>

      <h2
        className="text-3xl font-bold text-[#1E293B] mb-2 font-serif"
        style={{ fontFamily: "'Instrument Serif', Georgia, serif" }}
      >
        You're all set!
      </h2>
      <p className="text-[#64748B] text-sm mb-8 leading-relaxed">
        Your financial wellness journey starts now. Here's what's ready:
      </p>

      <div
        className="w-full rounded-xl p-5 mb-8 flex flex-col gap-3 text-left"
        style={{ backgroundColor: "#F8FAFC", border: "1px solid #E2E8F0" }}
      >
        {[
          {
            label: `Monthly income recorded: $${income.toLocaleString()}`,
            color: "#2563EB",
            bg: "#EFF6FF",
          },
          {
            label: "8 budget categories configured",
            color: "#7C3AED",
            bg: "#F5F3FF",
          },
          {
            label: `First savings goal created: ${goalName}`,
            color: "#16A34A",
            bg: "#F0FDF4",
          },
        ].map((item, i) => (
          <div key={i} className="flex items-center gap-3">
            <div
              className="flex-shrink-0 flex items-center justify-center w-6 h-6 rounded-full"
              style={{ backgroundColor: item.bg, color: item.color }}
            >
              <CheckIcon />
            </div>
            <span className="text-sm font-medium text-[#374151]">{item.label}</span>
          </div>
        ))}
      </div>

      <button
        onClick={onComplete}
        className="w-full py-4 rounded-xl text-white font-semibold text-base mb-4 transition-all hover:opacity-90 active:scale-[0.98]"
        style={{ backgroundColor: "#2563EB" }}
      >
        Go to My Dashboard →
      </button>

      <p className="text-[#94A3B8] text-xs">
        You can update all settings in the Budget Planner and Savings Goals pages.
      </p>
    </div>
  );
}

export default function Onboarding({ onComplete }: { onComplete: (data: OnboardingData) => void }) {
  const [step, setStep] = useState(1);
  const [income, setIncome] = useState("4200");
  const [budgets, setBudgets] = useState<Record<string, number>>(calcDefaultBudgets(4200));
  const [goalName, setGoalName] = useState("Emergency Fund");
  const [target, setTarget] = useState("5000");
  const [monthly, setMonthly] = useState(String(calcDefaultBudgets(4200)["Savings"]));

  // Keep budgets in sync when income changes (only when navigating forward from step 1)
  function handleStep1Continue() {
    const n = parseFloat(income);
    if (!isNaN(n) && n > 0) {
      const newBudgets = calcDefaultBudgets(n);
      setBudgets(newBudgets);
      setMonthly(String(newBudgets["Savings"]));
      setStep(2);
    }
  }

  function handleSkip() {
    const data: OnboardingData = DEFAULTS;
    localStorage.setItem("sb_onboarding", JSON.stringify(data));
    onComplete(data);
  }

  function handleStep2Continue() {
    setStep(3);
  }

  function handleStep3Continue() {
    setStep(4);
  }

  function handleComplete() {
    const incomeNum = parseFloat(income) || 0;
    const targetNum = parseFloat(target) || 5000;
    const monthlyNum = parseFloat(monthly) || budgets["Savings"] || 600;
    const effectiveGoalName = goalName === "Other" ? "Custom Goal" : goalName;

    const data: OnboardingData = {
      monthlyIncome: incomeNum,
      budgets,
      savingsGoalName: effectiveGoalName,
      savingsTarget: targetNum,
      savingsMonthly: monthlyNum,
    };

    localStorage.setItem("sb_onboarding", JSON.stringify(data));
    onComplete(data);
  }

  return (
    <div
      className="min-h-screen w-full flex items-center justify-center p-4"
      style={{
        backgroundColor: "#0A1628",
        backgroundImage:
          "radial-gradient(ellipse at 20% 50%, rgba(37,99,235,0.15) 0%, transparent 60%), radial-gradient(ellipse at 80% 20%, rgba(124,58,237,0.1) 0%, transparent 50%)",
      }}
    >
      <div
        className="w-full rounded-2xl p-8 sm:p-10"
        style={{
          maxWidth: "560px",
          backgroundColor: "#fff",
          boxShadow: "0 25px 60px -12px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.05)",
        }}
      >
        <StepIndicator current={step} />

        {step === 1 && (
          <Step1
            income={income}
            setIncome={setIncome}
            onContinue={handleStep1Continue}
            onSkip={handleSkip}
          />
        )}
        {step === 2 && (
          <Step2
            budgets={budgets}
            setBudgets={setBudgets}
            income={parseFloat(income) || 0}
            onContinue={handleStep2Continue}
            onBack={() => setStep(1)}
          />
        )}
        {step === 3 && (
          <Step3
            goalName={goalName}
            setGoalName={setGoalName}
            target={target}
            setTarget={setTarget}
            monthly={monthly}
            setMonthly={setMonthly}
            onContinue={handleStep3Continue}
            onBack={() => setStep(2)}
          />
        )}
        {step === 4 && (
          <Step4
            income={parseFloat(income) || 0}
            goalName={goalName === "Other" ? "Custom Goal" : goalName}
            onComplete={handleComplete}
          />
        )}
      </div>
    </div>
  );
}
