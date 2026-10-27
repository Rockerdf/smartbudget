import { useState } from "react";
import type { Screen } from "../App";
import { isValidEmail, signUpWithEmail } from "../lib/auth";
import type { UserSession } from "../lib/auth";

// --- Hoisted to module scope so React never remounts on re-render ---
function FormField({
  name,
  label,
  type = "text",
  placeholder,
  value,
  error,
  onChange,
}: {
  name: string;
  label: string;
  type?: string;
  placeholder?: string;
  value: string;
  error?: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-[#0F172A] mb-1.5">{label}</label>
      <input
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`w-full border rounded-xl px-4 py-3 text-sm outline-none transition-all focus:border-[#2563EB] focus:ring-2 focus:ring-blue-100 ${
          error ? "border-[#EF4444] bg-[#FEF2F2]" : "border-[#E2E8F0]"
        }`}
      />
      {error && (
        <p className="mt-1 text-xs text-[#EF4444] flex items-center gap-1">
          <span>⚠</span>
          {error}
        </p>
      )}
    </div>
  );
}

function Toast({ msg }: { msg: string }) {
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-[#0F172A] text-white text-sm px-5 py-3 rounded-xl shadow-xl z-50 max-w-[90vw] text-center animate-in">
      {msg}
    </div>
  );
}

function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl p-6 w-full max-w-sm card-shadow-md animate-in">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-[#0F172A]">{title}</h3>
          <button onClick={onClose} className="text-[#94A3B8] hover:text-[#0F172A]">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
// --- End hoisted components ---

export default function Register({
  navigate,
  onSuccess,
}: {
  navigate: (s: Screen) => void;
  onSuccess: (user: UserSession) => void;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [terms, setTerms] = useState(false);
  const [privacy, setPrivacy] = useState(false);
  const [success, setSuccess] = useState<"signed_in" | "confirm_email" | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [toast, setToast] = useState("");
  const [modal, setModal] = useState<"terms" | "privacy" | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 3000);
  };

  const clearError = (key: string) => {
    if (errors[key]) setErrors((e) => ({ ...e, [key]: "" }));
  };

  const passwordStrength = (pw: string) => {
    if (!pw) return 0;
    let score = 0;
    if (pw.length >= 8) score++;
    if (/[A-Z]/.test(pw)) score++;
    if (/[0-9]/.test(pw)) score++;
    if (/[^A-Za-z0-9]/.test(pw)) score++;
    return score;
  };

  const strength = passwordStrength(password);
  const strengthLabels = ["", "Weak", "Fair", "Good", "Strong"];
  const strengthColors = ["", "#EF4444", "#F59E0B", "#10B981", "#22C55E"];

  const validate = () => {
    const e: Record<string, string> = {};
    if (!name.trim()) e.name = "Full name is required";
    if (!isValidEmail(email)) e.email = "Enter a valid email address";
    if (password.length < 8) e.password = "Password must be at least 8 characters";
    if (password !== confirm) e.confirm = "Passwords do not match";
    if (!terms) e.terms = "You must accept the terms to continue";
    if (!privacy) e.privacy = "You must accept the privacy policy to continue";
    return e;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) {
      setErrors(errs);
      return;
    }
    setErrors({});
    setSubmitting(true);
    try {
      const result = await signUpWithEmail(name, email, password);
      if (result.status === "confirm_email") {
        setSuccess("confirm_email");
        return;
      }
      setSuccess("signed_in");
      setTimeout(() => onSuccess(result.session), 1600);
    } catch (err) {
      setSubmitting(false);
      const message = err instanceof Error ? err.message : "Could not create your account.";
      setErrors({ email: message });
    }
  };

  if (success) {
    const needsConfirm = success === "confirm_email";
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl p-10 text-center card-shadow max-w-sm w-full">
          <div className="w-20 h-20 rounded-full bg-[#DCFCE7] flex items-center justify-center mx-auto mb-5">
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#22C55E" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-[#0F172A] mb-2">
            {needsConfirm ? "Check your email" : "Account Created!"}
          </h2>
          <p className="text-[#64748B] text-sm mb-1">
            {needsConfirm
              ? `We sent a confirmation link to ${email.trim().toLowerCase()}. Confirm it, then sign in.`
              : `Welcome to SmartBudget, ${name.split(" ")[0]}.`}
          </p>
          {needsConfirm ? (
            <button
              onClick={() => navigate("login")}
              className="mt-5 w-full bg-[#2563EB] text-white font-semibold py-2.5 rounded-xl hover:bg-[#1D4ED8] text-sm transition-colors"
            >
              Go to Sign In
            </button>
          ) : (
            <p className="text-[#94A3B8] text-xs">Taking you to your dashboard…</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex">
      {toast && <Toast msg={toast} />}

      {/* Terms modal */}
      {modal === "terms" && (
        <Modal title="Terms of Use" onClose={() => setModal(null)}>
          <div className="space-y-3 text-sm text-[#64748B]">
            <p>By using SmartBudget you agree to use it for personal budgeting and educational purposes only.</p>
            <p>You must not use the platform to store sensitive financial credentials or share your account with others.</p>
            <p>SmartBudget does not provide personalised financial advice. Always consult a licensed financial adviser for specific guidance.</p>
            <p>
              <a href="/terms" target="_blank" rel="noopener noreferrer" className="text-[#2563EB] font-medium hover:underline">Read the full Terms of Use ↗</a>
            </p>
          </div>
          <button
            onClick={() => {
              setTerms(true);
              setModal(null);
              clearError("terms");
            }}
            className="mt-5 w-full bg-[#2563EB] text-white font-semibold py-2.5 rounded-xl hover:bg-[#1D4ED8] text-sm transition-colors"
          >
            I Accept
          </button>
        </Modal>
      )}

      {/* Privacy modal */}
      {modal === "privacy" && (
        <Modal title="Privacy Policy" onClose={() => setModal(null)}>
          <div className="space-y-3 text-sm text-[#64748B]">
            <p>SmartBudget collects only the information you provide to power your budgeting experience.</p>
            <p>Your data is never sold to third parties. It is stored securely and used solely to provide the service to you.</p>
            <p>You may request a download or deletion of your data at any time from Settings &gt; Privacy.</p>
            <p>
              <a href="/privacy" target="_blank" rel="noopener noreferrer" className="text-[#2563EB] font-medium hover:underline">Read the full Privacy Policy ↗</a>
            </p>
          </div>
          <button
            onClick={() => {
              setPrivacy(true);
              setModal(null);
              clearError("privacy");
            }}
            className="mt-5 w-full bg-[#2563EB] text-white font-semibold py-2.5 rounded-xl hover:bg-[#1D4ED8] text-sm transition-colors"
          >
            I Consent
          </button>
        </Modal>
      )}

      {/* Left panel */}
      <div className="hidden md:flex flex-col justify-between w-[420px] bg-[#2563EB] p-10 shrink-0">
        <button
          onClick={() => navigate("landing")}
          className="flex items-center gap-2 text-white/80 hover:text-white transition-colors text-sm"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="19" y1="12" x2="5" y2="12" />
            <polyline points="12 19 5 12 12 5" />
          </svg>
          Back to home
        </button>
        <div>
          <div className="flex items-center gap-2 mb-8">
            <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center">
              <span className="text-white font-bold text-sm">S</span>
            </div>
            <span className="font-bold text-white text-lg">SmartBudget</span>
          </div>
          <h2 className="text-3xl font-bold text-white mb-4 leading-tight">
            Start your financial wellness journey today
          </h2>
          <p className="text-blue-200 text-sm leading-relaxed mb-8">
            Free, private and ad-free. Build smarter money habits at your own pace.
          </p>
          <div className="space-y-3">
            {[
              "Track income and expenses",
              "Create realistic budgets",
              "Set and monitor savings goals",
              "Learn financial literacy",
            ].map((item) => (
              <div key={item} className="flex items-center gap-3 text-sm text-blue-100">
                <div className="w-5 h-5 rounded-full bg-[#10B981] flex items-center justify-center shrink-0">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </div>
                {item}
              </div>
            ))}
          </div>
        </div>
        <p className="text-blue-300 text-[11px]">
          Educational information and budgeting tools only. Not financial advice.
        </p>
      </div>

      {/* Right form */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          <button
            onClick={() => navigate("landing")}
            className="md:hidden flex items-center gap-1.5 text-sm text-[#64748B] hover:text-[#0F172A] mb-6 transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="19" y1="12" x2="5" y2="12" />
              <polyline points="12 19 5 12 12 5" />
            </svg>
            Back to home
          </button>

          <div className="mb-8">
            <h1 className="text-2xl font-bold text-[#0F172A] mb-1">Create your account</h1>
            <p className="text-[#64748B] text-sm">
              Already have an account?{" "}
              <button onClick={() => navigate("login")} className="text-[#2563EB] font-medium hover:underline">
                Sign in
              </button>
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <FormField
              name="name"
              label="Full Name"
              placeholder="Jane Smith"
              value={name}
              error={errors.name}
              onChange={(v) => { setName(v); clearError("name"); }}
            />
            <FormField
              name="email"
              label="Email"
              type="email"
              placeholder="you@example.com"
              value={email}
              error={errors.email}
              onChange={(v) => { setEmail(v); clearError("email"); }}
            />
            <FormField
              name="password"
              label="Password"
              type="password"
              placeholder="Min. 8 characters"
              value={password}
              error={errors.password}
              onChange={(v) => { setPassword(v); clearError("password"); }}
            />

            {/* Password strength */}
            {password && (
              <div className="-mt-2">
                <div className="flex gap-1 mb-1">
                  {[1, 2, 3, 4].map((i) => (
                    <div
                      key={i}
                      className="flex-1 h-1 rounded-full transition-all duration-300"
                      style={{ backgroundColor: i <= strength ? strengthColors[strength] : "#E2E8F0" }}
                    />
                  ))}
                </div>
                <p className="text-xs font-medium" style={{ color: strengthColors[strength] }}>
                  {strengthLabels[strength]} password
                  {strength < 3 && " — add uppercase letters, numbers, or symbols"}
                </p>
              </div>
            )}

            <FormField
              name="confirm"
              label="Confirm Password"
              type="password"
              placeholder="Repeat your password"
              value={confirm}
              error={errors.confirm}
              onChange={(v) => { setConfirm(v); clearError("confirm"); }}
            />

            <div className="space-y-3 pt-1">
              <div>
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={terms}
                    onChange={(e) => { setTerms(e.target.checked); clearError("terms"); }}
                    className="mt-0.5 accent-[#2563EB]"
                  />
                  <span className="text-xs text-[#64748B]">
                    I agree to the{" "}
                    <button type="button" onClick={() => setModal("terms")} className="text-[#2563EB] hover:underline font-medium">
                      Terms of Use
                    </button>
                  </span>
                </label>
                {errors.terms && <p className="mt-1 text-xs text-[#EF4444] pl-6">⚠ {errors.terms}</p>}
              </div>
              <div>
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={privacy}
                    onChange={(e) => { setPrivacy(e.target.checked); clearError("privacy"); }}
                    className="mt-0.5 accent-[#2563EB]"
                  />
                  <span className="text-xs text-[#64748B]">
                    I consent to data processing as described in the{" "}
                    <button type="button" onClick={() => setModal("privacy")} className="text-[#2563EB] hover:underline font-medium">
                      Privacy Policy
                    </button>
                  </span>
                </label>
                {errors.privacy && <p className="mt-1 text-xs text-[#EF4444] pl-6">⚠ {errors.privacy}</p>}
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-[#2563EB] text-white font-semibold py-3 rounded-xl hover:bg-[#1D4ED8] transition-all active:scale-[0.99] mt-2 disabled:opacity-70"
            >
              {submitting ? "Creating account…" : "Create Account"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
