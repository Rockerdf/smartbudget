import { useState } from "react";
import { Logo } from "../components/SiteChrome";
import { MIN_PASSWORD_LENGTH, sendPasswordReset, setNewPassword } from "../lib/auth";

type Props = {
  /** "recovery": the link worked, ask for a new password. "expired": the link no longer works. */
  mode: "recovery" | "expired";
  email?: string;
  onDone: () => void;
  onBackToSignIn: () => void;
};

function strength(pw: string) {
  let score = 0;
  if (pw.length >= MIN_PASSWORD_LENGTH) score++;
  if (pw.length >= 12) score++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++;
  if (/\d/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  return Math.min(score, 4);
}
const LABELS = ["Too short", "Weak", "Okay", "Good", "Strong"];
const COLORS = ["#EF4444", "#F97316", "#EAB308", "#22C55E", "#16A34A"];

export default function ResetPassword({ mode, email, onDone, onBackToSignIn }: Props) {
  const [pw, setPw] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [expired, setExpired] = useState(mode === "expired");
  const [resendEmail, setResendEmail] = useState(email ?? "");
  const [resent, setResent] = useState(false);

  const s = strength(pw);
  const tooShort = pw.length > 0 && pw.length < MIN_PASSWORD_LENGTH;
  const mismatch = confirm.length > 0 && confirm !== pw;
  const canSave = pw.length >= MIN_PASSWORD_LENGTH && pw === confirm && !busy;

  const save = async () => {
    if (!canSave) return;
    setBusy(true);
    setError("");
    try {
      await setNewPassword(pw);
      setDone(true);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Could not save your new password.";
      if (/expired/i.test(msg)) setExpired(true);
      setError(msg);
    } finally {
      setBusy(false);
    }
  };

  const resend = async () => {
    if (!resendEmail.includes("@")) return;
    setBusy(true);
    setError("");
    try {
      await sendPasswordReset(resendEmail);
      setResent(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not send a reset email.");
    } finally {
      setBusy(false);
    }
  };

  const input = "w-full border border-[#E2E8F0] rounded-xl px-4 py-3 text-sm text-[#0F172A] outline-none focus:border-[#2563EB] focus:ring-4 focus:ring-[#DBEAFE] bg-white";

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center p-4 sm:p-6">
      <div className="bg-white rounded-3xl border border-[#E2E8F0] card-shadow-md p-6 sm:p-9 w-full max-w-md">
        <div className="flex justify-center mb-6"><Logo /></div>

        {done ? (
          <div className="text-center">
            <div className="w-14 h-14 rounded-full bg-[#ECFDF5] flex items-center justify-center mx-auto mb-4">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12" /></svg>
            </div>
            <h1 className="text-xl font-bold text-[#0F172A]">Password changed</h1>
            <p className="text-sm text-[#64748B] mt-2">Your new password is saved and you're signed in. Use it next time you sign in.</p>
            <button type="button" onClick={onDone} className="mt-6 w-full bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-semibold py-3 rounded-xl text-sm">
              Continue to SmartBudget
            </button>
          </div>
        ) : expired ? (
          <div>
            <h1 className="text-xl font-bold text-[#0F172A] text-center">This reset link has expired</h1>
            <p className="text-sm text-[#64748B] mt-2 text-center">
              Reset links work once and only for a short time. Enter your email and we'll send a fresh one.
            </p>
            {resent ? (
              <div className="mt-5 bg-[#ECFDF5] border border-[#BBF7D0] text-[#166534] text-sm rounded-xl px-4 py-3">
                If an account uses <strong>{resendEmail}</strong>, a new link is on its way. Check your inbox and spam folder, and open the newest email.
              </div>
            ) : (
              <>
                <label htmlFor="reset-email" className="block text-xs font-semibold text-[#475569] mt-5 mb-1.5">Email</label>
                <input id="reset-email" type="email" autoComplete="email" value={resendEmail} onChange={(e) => setResendEmail(e.target.value)} className={input} placeholder="you@example.com" />
                <button type="button" onClick={() => void resend()} disabled={busy || !resendEmail.includes("@")}
                  className="mt-4 w-full bg-[#2563EB] hover:bg-[#1D4ED8] disabled:opacity-50 text-white font-semibold py-3 rounded-xl text-sm">
                  {busy ? "Sending…" : "Send a new link"}
                </button>
              </>
            )}
            {error && !resent && <p className="text-sm text-[#B91C1C] mt-3" role="alert">{error}</p>}
            <button type="button" onClick={onBackToSignIn} className="mt-4 w-full text-sm font-semibold text-[#2563EB] hover:underline">Back to sign in</button>
          </div>
        ) : (
          <form onSubmit={(e) => { e.preventDefault(); void save(); }}>
            <h1 className="text-xl font-bold text-[#0F172A] text-center">Choose a new password</h1>
            <p className="text-sm text-[#64748B] mt-2 text-center">{email ? <>For <strong className="text-[#0F172A]">{email}</strong>. </> : null}At least {MIN_PASSWORD_LENGTH} characters.</p>

            <label htmlFor="new-pw" className="block text-xs font-semibold text-[#475569] mt-6 mb-1.5">New password</label>
            <div className="relative">
              <input id="new-pw" type={show ? "text" : "password"} autoComplete="new-password" autoFocus value={pw}
                onChange={(e) => setPw(e.target.value)} className={`${input} pr-16`} />
              <button type="button" onClick={() => setShow((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-[#2563EB]">
                {show ? "Hide" : "Show"}
              </button>
            </div>
            {pw && (
              <div className="mt-2 flex items-center gap-2" aria-live="polite">
                <div className="flex-1 flex gap-1">
                  {[0, 1, 2, 3].map((i) => <span key={i} className="h-1.5 flex-1 rounded-full" style={{ background: i < s ? COLORS[s] : "#E2E8F0" }} />)}
                </div>
                <span className="text-[11px] font-semibold" style={{ color: COLORS[tooShort ? 0 : s] }}>{tooShort ? LABELS[0] : LABELS[s]}</span>
              </div>
            )}

            <label htmlFor="confirm-pw" className="block text-xs font-semibold text-[#475569] mt-4 mb-1.5">Confirm new password</label>
            <input id="confirm-pw" type={show ? "text" : "password"} autoComplete="new-password" value={confirm}
              onChange={(e) => setConfirm(e.target.value)} className={input} />
            {mismatch && <p className="text-xs text-[#B91C1C] mt-1.5">The passwords don't match.</p>}

            {error && <p className="text-sm text-[#B91C1C] mt-4" role="alert">{error}</p>}

            <button type="submit" disabled={!canSave}
              className="mt-6 w-full bg-[#2563EB] hover:bg-[#1D4ED8] disabled:opacity-50 text-white font-semibold py-3 rounded-xl text-sm">
              {busy ? "Saving…" : "Save new password"}
            </button>
            <button type="button" onClick={onBackToSignIn} className="mt-3 w-full text-sm text-[#64748B] hover:text-[#0F172A]">Cancel</button>
          </form>
        )}
      </div>
    </div>
  );
}
