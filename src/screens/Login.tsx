import { useState } from "react";
import type { Screen } from "../App";
import { isValidEmail, sendPasswordReset, signInWithEmail } from "../lib/auth";
import type { UserSession } from "../lib/auth";

function EyeIcon({ open }: { open: boolean }) {
  return open ? (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
    </svg>
  ) : (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
      <line x1="1" y1="1" x2="23" y2="23"/>
    </svg>
  );
}

export default function Login({ navigate, onSuccess }: { navigate: (s: Screen) => void; onSuccess: (user: UserSession) => void }) {
  const [email, setEmail]           = useState("");
  const [password, setPassword]     = useState("");
  const [showPw, setShowPw]         = useState(false);
  const [remember, setRemember]     = useState(true);
  const [error, setError]           = useState("");
  const [loading, setLoading]       = useState(false);
  const [showForgot, setShowForgot] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotSent, setForgotSent]   = useState(false);
  const [toast, setToast]           = useState("");

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(""), 3000); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) { setError("Please enter your email address."); return; }
    if (!isValidEmail(email)) { setError("Please enter a valid email address."); return; }
    if (!password) { setError("Please enter your password."); return; }
    setError("");
    setLoading(true);

    try {
      const session = await signInWithEmail(email, password, remember);
      onSuccess(session);
    } catch (err) {
      setLoading(false);
      setError(err instanceof Error ? err.message : "Could not sign in.");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#F0F7FF] via-[#F8FAFC] to-[#EEF2FF] flex items-center justify-center p-4 sm:p-6">
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-[#0F172A] text-white text-sm px-5 py-3 rounded-xl shadow-xl z-50 animate-in">
          {toast}
        </div>
      )}

      {/* Forgot password modal */}
      {showForgot && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm card-shadow-md animate-scale">
            {!forgotSent ? (
              <>
                <div className="flex items-center justify-between mb-5">
                  <div>
                    <h3 className="font-bold text-[#0F172A]">Reset your password</h3>
                    <p className="text-xs text-[#64748B] mt-0.5">We'll send a reset link to your email</p>
                  </div>
                  <button onClick={() => setShowForgot(false)} className="w-8 h-8 rounded-lg flex items-center justify-center text-[#94A3B8] hover:bg-[#F1F5F9] hover:text-[#0F172A] transition-colors">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                  </button>
                </div>
                <label className="block text-sm font-medium text-[#0F172A] mb-1.5">Email address</label>
                <input
                  type="email"
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full border border-[#E2E8F0] rounded-xl px-4 py-3 text-sm outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-blue-100 mb-4"
                />
                <div className="flex gap-3">
                  <button onClick={() => setShowForgot(false)} className="flex-1 border border-[#E2E8F0] text-[#64748B] font-medium py-2.5 rounded-xl hover:bg-[#F8FAFC] text-sm transition-colors">Cancel</button>
                  <button
                    onClick={async () => {
                      if (!forgotEmail.includes("@")) return;
                      try {
                        await sendPasswordReset(forgotEmail);
                        setForgotSent(true);
                      } catch (err) {
                        showToast(err instanceof Error ? err.message : "Could not send a reset email.");
                      }
                    }}
                    disabled={!forgotEmail.includes("@")}
                    className="flex-1 bg-[#2563EB] text-white font-semibold py-2.5 rounded-xl hover:bg-[#1D4ED8] text-sm transition-colors disabled:opacity-40"
                  >Send Reset Link</button>
                </div>
              </>
            ) : (
              <div className="text-center py-4">
                <div className="w-14 h-14 rounded-full bg-[#ECFDF5] flex items-center justify-center mx-auto mb-4">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
                </div>
                <h3 className="font-bold text-[#0F172A] mb-2">Check your inbox</h3>
                <p className="text-sm text-[#64748B] mb-1">If an account uses this email, we've sent a reset link to</p>
                <p className="text-sm font-semibold text-[#0F172A] mb-3">{forgotEmail}</p>
                <p className="text-xs text-[#94A3B8] mb-5">It can take a minute or two. Check your spam folder too. The link works once, for one hour.</p>
                <button
                  onClick={() => { setShowForgot(false); setForgotSent(false); setForgotEmail(""); }}
                  className="w-full bg-[#2563EB] text-white font-semibold py-2.5 rounded-xl hover:bg-[#1D4ED8] text-sm transition-colors"
                >Back to Sign In</button>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="w-full max-w-sm">
        {/* Back to home */}
        <button
          onClick={() => navigate("landing")}
          className="flex items-center gap-1.5 text-sm text-[#64748B] hover:text-[#0F172A] mb-8 transition-colors"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
          Back to home
        </button>

        {/* Logo */}
        <div className="flex justify-center mb-8">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-[#2563EB] flex items-center justify-center shadow-lg shadow-blue-200">
              <span className="text-white font-bold text-lg">S</span>
            </div>
            <span className="font-bold text-[#0F172A] text-xl tracking-tight">SmartBudget</span>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 sm:p-8 card-shadow-md border border-[#E2E8F0]">
          {/* Header */}
          <div className="text-center mb-6">
            <h1 className="text-2xl font-bold text-[#0F172A] mb-1">Welcome back</h1>
            <p className="text-sm text-[#64748B]">Sign in to your account to continue</p>
          </div>

          {/* Error */}
          {error && (
            <div className="bg-[#FEF2F2] border border-[#FECACA] rounded-xl px-4 py-3 mb-5 flex items-start gap-2.5">
              <svg className="shrink-0 mt-0.5" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              <span className="text-xs text-[#DC2626] leading-relaxed">{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-[#0F172A] mb-1.5">Email address</label>
              <input
                type="email"
                value={email}
                onChange={(e) => { setEmail(e.target.value); if (error) setError(""); }}
                placeholder="you@example.com"
                autoComplete="email"
                className={`w-full border rounded-xl px-4 py-3 text-sm outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-blue-100 transition-all ${error ? "border-[#EF4444] bg-[#FFF8F8]" : "border-[#E2E8F0]"}`}
              />
            </div>

            {/* Password */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-sm font-medium text-[#0F172A]">Password</label>
                <button type="button" onClick={() => setShowForgot(true)} className="text-xs text-[#2563EB] hover:underline font-medium">
                  Forgot password?
                </button>
              </div>
              <div className="relative">
                <input
                  type={showPw ? "text" : "password"}
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); if (error) setError(""); }}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  className={`w-full border rounded-xl px-4 py-3 pr-11 text-sm outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-blue-100 transition-all ${error ? "border-[#EF4444] bg-[#FFF8F8]" : "border-[#E2E8F0]"}`}
                />
                <button
                  type="button"
                  onClick={() => setShowPw((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#94A3B8] hover:text-[#64748B] transition-colors p-1"
                  aria-label={showPw ? "Hide password" : "Show password"}
                >
                  <EyeIcon open={showPw} />
                </button>
              </div>
            </div>

            {/* Remember me */}
            <label className="flex items-center gap-2.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
                className="w-4 h-4 accent-[#2563EB]"
              />
              <span className="text-sm text-[#64748B]">Remember me for 30 days</span>
            </label>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#2563EB] text-white font-semibold py-3 rounded-xl hover:bg-[#1D4ED8] transition-all active:scale-[0.99] disabled:opacity-70 flex items-center justify-center gap-2 shadow-lg shadow-blue-200 mt-2"
            >
              {loading ? (
                <>
                  <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" stroke="rgba(255,255,255,0.3)" strokeWidth="3"/>
                    <path d="M12 2a10 10 0 0 1 10 10" stroke="white" strokeWidth="3" strokeLinecap="round"/>
                  </svg>
                  Signing in…
                </>
              ) : "Sign In"}
            </button>
          </form>

        </div>

        <p className="text-center text-sm text-[#64748B] mt-6">
          Don't have an account?{" "}
          <button onClick={() => navigate("register")} className="text-[#2563EB] font-semibold hover:underline">Create account</button>
        </p>

        <p className="text-center text-[11px] text-[#94A3B8] mt-4 leading-relaxed px-4">
          This platform provides educational budgeting tools only.<br />Not financial advice.
        </p>
        <nav className="flex flex-wrap justify-center gap-x-4 gap-y-1 mt-3 text-[11px] text-[#94A3B8]" aria-label="Legal">
          <button type="button" onClick={() => navigate("helpCenter")} className="hover:text-[#2563EB]">Help</button>
          <button type="button" onClick={() => navigate("privacy")} className="hover:text-[#2563EB]">Privacy</button>
          <button type="button" onClick={() => navigate("terms")} className="hover:text-[#2563EB]">Terms</button>
          <button type="button" onClick={() => navigate("contact")} className="hover:text-[#2563EB]">Contact</button>
        </nav>
      </div>
    </div>
  );
}
