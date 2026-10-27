import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { fetchTransactions } from "../lib/transactions";
import { fetchBudget } from "../lib/budgets";
import { fetchGoals } from "../lib/goals";
import { loadNotificationPrefs, saveNotificationPrefs } from "../lib/notifications";
import type { NotificationPrefs } from "../lib/notifications";
import { downloadCsv, printReport, todayStamp } from "../lib/exportData";
import type { Screen, ConnectedAccount } from "../App";
import type { UserSession } from "../lib/auth";
import { changePassword, deleteOwnAccount, signOutOtherDevices, updateOwnName, MIN_PASSWORD_LENGTH } from "../lib/auth";

type Tab = "profile" | "security" | "privacy" | "accounts";

function Toast({ msg, type = "success" }: { msg: string; type?: "success" | "error" }) {
  return (
    <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 text-white text-sm px-5 py-3 rounded-xl shadow-xl z-50 max-w-[90vw] text-center animate-in ${
      type === "error" ? "bg-[#EF4444]" : "bg-[#0F172A]"
    }`}>
      {msg}
    </div>
  );
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: () => void; label?: string }) {
  return (
    <button
      type="button"
      className={`w-11 h-6 rounded-full relative transition-colors cursor-pointer shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-300 ${checked ? "bg-[#2563EB]" : "bg-[#E2E8F0]"}`}
      onClick={onChange}
      role="switch"
      aria-checked={checked}
      aria-label={label}
    >
      <span className={`w-5 h-5 bg-white rounded-full absolute top-0.5 transition-all shadow ${checked ? "left-5" : "left-0.5"}`} />
    </button>
  );
}

function Breadcrumb({ navigate }: { navigate: (s: Screen) => void }) {
  return (
    <div className="flex items-center gap-1.5 text-xs text-[#94A3B8] mb-4">
      <button onClick={() => navigate("dashboard")} className="hover:text-[#2563EB] transition-colors font-medium">
        Dashboard
      </button>
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <polyline points="9 18 15 12 9 6" />
      </svg>
      <span className="text-[#0F172A] font-medium">Settings</span>
    </div>
  );
}

type Props = {
  navigate: (s: Screen) => void;
  onLogout: () => void;
  connectedAccounts?: ConnectedAccount[];
  onDisconnect?: (id: string) => void;
  onConnectMore?: () => void;
  currentUser?: UserSession | null;
  onProfileUpdate?: (name: string) => void;
};

export default function Settings({ navigate, onLogout, connectedAccounts = [], onDisconnect, onConnectMore, currentUser, onProfileUpdate }: Props) {
  const [tab, setTab] = useState<Tab>("profile");
  const [profile, setProfile] = useState({
    name: currentUser?.name ?? "User", email: currentUser?.email ?? "",
  });
  const [notifPrefs, setNotifPrefs] = useState<NotificationPrefs>(() => loadNotificationPrefs());
  const [memberSince, setMemberSince] = useState("");
  const [exporting, setExporting] = useState<"" | "csv" | "pdf">("");

  // "Member since" comes from the account's real creation date.
  useEffect(() => {
    let cancelled = false;
    supabase.auth.getUser().then(({ data }) => {
      const created = data.user?.created_at;
      if (!cancelled && created) {
        setMemberSince(new Date(created).toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric" }));
      }
    }).catch(() => undefined);
    return () => { cancelled = true; };
  }, []);

  const loadAll = async () => {
    const [transactions, budget, goals] = await Promise.all([fetchTransactions(), fetchBudget(), fetchGoals()]);
    return { transactions, budget, goals };
  };

  const handleExportCsv = async () => {
    setExporting("csv");
    try {
      const { transactions, budget, goals } = await loadAll();
      const rows: (string | number)[][] = [
        ["SmartBudget data export", `Exported ${new Date().toLocaleString("en-AU")}`],
        [],
        ["TRANSACTIONS"],
        ["Date", "Description", "Category", "Type", "Amount (AUD)", "Recurring", "Note"],
        ...transactions.map((t) => [t.date, t.description, t.category, t.type, Math.abs(t.amount).toFixed(2), t.recurring ? "Yes" : "No", t.note ?? ""]),
        [],
        ["BUDGETS (this month)"],
        ["Category", "Budgeted (AUD)", "Spent (AUD)", "Remaining (AUD)"],
        ...budget.map((b) => [b.category, b.budgeted.toFixed(2), b.spent.toFixed(2), (b.budgeted - b.spent).toFixed(2)]),
        [],
        ["SAVINGS GOALS"],
        ["Goal", "Target (AUD)", "Saved (AUD)", "Monthly contribution (AUD)", "Target date"],
        ...goals.map((g) => [g.name, g.target.toFixed(2), g.current.toFixed(2), g.monthlyContribution.toFixed(2), g.deadline]),
      ];
      downloadCsv(`smartbudget-data-${todayStamp()}.csv`, rows);
      showToast(`✓  Downloaded ${transactions.length} transactions, ${budget.length} budgets and ${goals.length} goals`);
    } catch (err) {
      showToast(`⚠  ${err instanceof Error ? err.message : "Could not export your data."}`, "error");
    } finally {
      setExporting("");
    }
  };

  const handleExportPdf = async () => {
    setExporting("pdf");
    try {
      const { transactions, budget, goals } = await loadAll();
      const income = transactions.filter((t) => t.type === "income").reduce((a, t) => a + Math.abs(t.amount), 0);
      const expenses = transactions.filter((t) => t.type === "expense").reduce((a, t) => a + Math.abs(t.amount), 0);
      const money = (n: number) => n.toLocaleString("en-AU", { style: "currency", currency: "AUD" });
      const ok = printReport("Financial summary", `${profile.name} · all recorded data`, [
        { heading: "Totals", rows: [["Measure", "Amount"], ["Total income recorded", money(income)], ["Total expenses recorded", money(expenses)], ["Difference", money(income - expenses)]] },
        { heading: "Budgets this month", rows: [["Category", "Budgeted", "Spent", "Remaining"], ...budget.map((b) => [b.category, money(b.budgeted), money(b.spent), money(b.budgeted - b.spent)])] },
        { heading: "Savings goals", rows: [["Goal", "Saved", "Target", "Progress", "Target date"], ...goals.map((g) => [g.name, money(g.current), money(g.target), g.target > 0 ? `${Math.round((g.current / g.target) * 100)}%` : "—", g.deadline])] },
        { heading: "Transactions", rows: [["Date", "Description", "Category", "Type", "Amount"], ...transactions.map((t) => [t.date, t.description, t.category, t.type, money(Math.abs(t.amount))])] },
      ]);
      if (ok) showToast("✓  Report opened. Choose \"Save as PDF\" in the print window");
      else showToast("⚠  Please allow pop-ups for this site to open the report", "error");
    } catch (err) {
      showToast(`⚠  ${err instanceof Error ? err.message : "Could not create the report."}`, "error");
    } finally {
      setExporting("");
    }
  };

  const updateNotifPref = (key: keyof NotificationPrefs) => {
    const next = { ...notifPrefs, [key]: !notifPrefs[key] };
    setNotifPrefs(next);
    saveNotificationPrefs(next);
    showToast(`✓  ${key === "budgetAlerts" ? "Budget alerts" : "Savings milestones"} ${next[key] ? "on" : "off"}`);
  };
  const [passwords, setPasswords] = useState({ current: "", next: "", confirm: "" });
  const [passwordError, setPasswordError] = useState("");
  const [busy, setBusy] = useState(false);
  const [deleteEmail, setDeleteEmail] = useState("");
  const [consents, setConsents] = useState<{ analytics: boolean; usage: boolean }>(() => {
    try {
      const raw = localStorage.getItem("sb_consents");
      if (raw) return { analytics: false, usage: false, ...JSON.parse(raw) };
    } catch { /* ignore */ }
    return { analytics: false, usage: false };
  });
  const [toast, setToast] = useState<{ msg: string; type?: "success" | "error" } | null>(null);
  const [showDelete, setShowDelete] = useState(false);
  const [disconnectConfirm, setDisconnectConfirm] = useState<string | null>(null);

  const showToast = (msg: string, type: "success" | "error" = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleSaveProfile = async () => {
    if (!profile.name.trim()) { showToast("⚠  Name cannot be empty", "error"); return; }
    setBusy(true);
    try {
      await updateOwnName(profile.name.trim());
      if (onProfileUpdate) onProfileUpdate(profile.name.trim());
      showToast("✓  Profile saved successfully");
    } catch (err) {
      showToast(`⚠  ${err instanceof Error ? err.message : "Something went wrong. Please try again."}`, "error");
    } finally {
      setBusy(false);
    }
  };

  const handleUpdatePassword = async () => {
    if (!passwords.current) { setPasswordError("Enter your current password"); return; }
    if (passwords.next.length < MIN_PASSWORD_LENGTH) { setPasswordError(`New password must be at least ${MIN_PASSWORD_LENGTH} characters`); return; }
    if (passwords.next !== passwords.confirm) { setPasswordError("New passwords do not match"); return; }
    setPasswordError("");
    setBusy(true);
    try {
      await changePassword(passwords.current, passwords.next);
      setPasswords({ current: "", next: "", confirm: "" });
      showToast("✓  Password updated successfully");
    } catch (err) {
      setPasswordError(err instanceof Error ? err.message : "Could not update your password.");
    } finally {
      setBusy(false);
    }
  };

  const handleSignOutOthers = async () => {
    setBusy(true);
    try {
      await signOutOtherDevices();
      showToast("✓  Signed out of all other devices");
    } catch (err) {
      showToast(`⚠  ${err instanceof Error ? err.message : "Something went wrong. Please try again."}`, "error");
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteAccount = async () => {
    setBusy(true);
    try {
      await deleteOwnAccount();
      onLogout();
    } catch (err) {
      setBusy(false);
      showToast(`⚠  ${err instanceof Error ? err.message : "Something went wrong. Please try again."}`, "error");
    }
  };

  const TABS: { id: Tab; label: string; icon: string }[] = [
    { id: "profile",  label: "Profile",   icon: "👤" },
    { id: "security", label: "Security",  icon: "🔒" },
    { id: "privacy",  label: "Privacy",   icon: "🛡️" },
    { id: "accounts", label: "Accounts",  icon: "🏦" },
  ];

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[820px]">
      {toast && <Toast msg={toast.msg} type={toast.type} />}

      {/* Delete confirm modal */}
      {showDelete && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm card-shadow-md animate-in">
            <div className="text-center mb-5">
              <div className="w-14 h-14 rounded-full bg-[#FEE2E2] flex items-center justify-center mx-auto mb-3">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2" strokeLinecap="round">
                  <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
              </div>
              <h2 className="font-bold text-[#0F172A] mb-2">Delete Account?</h2>
              <p className="text-sm text-[#64748B]">This will permanently delete your account and all your data. This action cannot be reversed.</p>
              <label className="block text-xs text-[#64748B] mt-4 mb-1.5 text-left">Type your email address to confirm</label>
              <input value={deleteEmail} onChange={(e) => setDeleteEmail(e.target.value)} placeholder={currentUser?.email ?? ""}
                className="w-full border border-[#E2E8F0] rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#EF4444]" />
            </div>
            <div className="flex gap-3">
              <button onClick={() => { setShowDelete(false); setDeleteEmail(""); }}
                className="flex-1 border border-[#E2E8F0] text-[#64748B] font-medium py-2.5 rounded-xl hover:bg-[#F8FAFC] text-sm transition-colors">
                Cancel
              </button>
              <button onClick={handleDeleteAccount}
                disabled={busy || !currentUser || deleteEmail.trim().toLowerCase() !== currentUser.email.toLowerCase()}
                className="flex-1 bg-[#EF4444] text-white font-semibold py-2.5 rounded-xl hover:bg-[#DC2626] text-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                Delete Account
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Disconnect confirm modal */}
      {disconnectConfirm && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm card-shadow-md animate-in">
            <h3 className="font-bold text-[#0F172A] mb-2">Disconnect demo bank?</h3>
            <p className="text-sm text-[#64748B] mb-5">This removes the simulated connection and labelled sample transactions only. Transactions you entered yourself are not deleted.</p>
            <div className="flex gap-3">
              <button onClick={() => setDisconnectConfirm(null)}
                className="flex-1 border border-[#E2E8F0] text-[#64748B] font-medium py-2.5 rounded-xl hover:bg-[#F8FAFC] text-sm transition-colors">
                Cancel
              </button>
              <button
                onClick={() => { onDisconnect?.(disconnectConfirm); setDisconnectConfirm(null); showToast("✓  Account disconnected"); }}
                className="flex-1 bg-[#EF4444] text-white font-semibold py-2.5 rounded-xl hover:bg-[#DC2626] text-sm transition-colors">
                Disconnect
              </button>
            </div>
          </div>
        </div>
      )}

      <Breadcrumb navigate={navigate} />

      {/* ── Header ── */}
      <div className="flex items-start justify-between mb-6 gap-3 flex-wrap">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-[#0F172A]">Settings</h1>
          <p className="text-xs sm:text-sm text-[#64748B] mt-0.5">Manage your account, security, and privacy</p>
        </div>
        <button
          onClick={onLogout}
          className="flex items-center gap-2 text-xs font-medium border border-[#E2E8F0] px-3.5 py-2.5 rounded-xl hover:border-[#FECACA] hover:text-[#EF4444] text-[#64748B] transition-colors"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
            <polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
          </svg>
          Sign out
        </button>
      </div>

      {/* ── Tabs — horizontal scroll on mobile ── */}
      <div className="mb-6 overflow-x-auto pb-1 -mx-1 px-1">
        <div className="grid grid-cols-4 sm:flex gap-1 bg-[#F1F5F9] rounded-xl p-1 sm:w-fit" role="tablist" aria-label="Settings sections">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center justify-center gap-1.5 px-1.5 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all whitespace-nowrap ${
                tab === t.id ? "bg-white text-[#0F172A] shadow-sm" : "text-[#64748B] hover:text-[#0F172A]"
              }`}
            >
              <span className="hidden sm:inline" aria-hidden="true">{t.icon}</span>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Profile tab ── */}
      {tab === "profile" && (
        <div className="space-y-5 animate-in">
          {/* Profile card */}
          <div className="bg-white rounded-2xl p-5 sm:p-6 border border-[#E2E8F0] card-shadow">
            <h2 className="font-semibold text-[#0F172A] mb-5">Profile Information</h2>
            <div className="flex items-center gap-4 mb-6">
              <div className="w-14 h-14 rounded-full bg-gradient-to-br from-[#2563EB] to-[#4F46E5] flex items-center justify-center text-xl font-bold text-white shrink-0">
                {profile.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
              </div>
              <div>
                <p className="font-semibold text-[#0F172A]">{profile.name}</p>
                <p className="text-sm text-[#64748B]">{profile.email}</p>
                <span className="text-[10px] font-semibold text-[#10B981] bg-[#ECFDF5] px-2 py-0.5 rounded-full mt-1 inline-block">Active account</span>
              </div>
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-[#0F172A] mb-1.5">Full Name</label>
                <input
                  type="text" value={profile.name}
                  onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                  className="w-full border border-[#E2E8F0] rounded-xl px-4 py-3 text-sm outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-blue-100"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#0F172A] mb-1.5">Email Address</label>
                <input
                  type="email" value={profile.email} readOnly title="Email changes are not supported yet"
                  onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                  className="w-full border border-[#E2E8F0] rounded-xl px-4 py-3 text-sm outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-blue-100"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#0F172A] mb-1.5">Currency</label>
                <input type="text" value="AUD — Australian dollar" readOnly title="All amounts in SmartBudget are in Australian dollars"
                  className="w-full border border-[#F1F5F9] bg-[#F8FAFC] rounded-xl px-4 py-3 text-sm text-[#64748B] cursor-default" />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#0F172A] mb-1.5">Member Since</label>
                <input type="text" value={memberSince || "—"} readOnly
                  className="w-full border border-[#F1F5F9] bg-[#F8FAFC] rounded-xl px-4 py-3 text-sm text-[#64748B] cursor-default" />
              </div>
            </div>
          </div>

          {/* Notification preferences */}
          <div className="bg-white rounded-2xl p-5 sm:p-6 border border-[#E2E8F0] card-shadow">
            <h2 className="font-semibold text-[#0F172A] mb-4">Notification Preferences</h2>
            <div className="space-y-4 divide-y divide-[#F8FAFC]">
              {([
                { key: "budgetAlerts" as const, label: "Budget alerts", desc: "Show an alert when a category reaches 80% of its budget or goes over" },
                { key: "goalMilestones" as const, label: "Savings milestones", desc: "Show an alert when a goal passes halfway or is reached" },
              ] as const).map(({ key, label, desc }) => (
                <div key={key} className="flex items-center justify-between pt-4 first:pt-0">
                  <div className="pr-4">
                    <p className="text-sm font-medium text-[#0F172A]">{label}</p>
                    <p className="text-xs text-[#64748B] mt-0.5">{desc}</p>
                  </div>
                  <Toggle label={label} checked={notifPrefs[key]} onChange={() => updateNotifPref(key)} />
                </div>
              ))}
            </div>
            <p className="text-[11px] text-[#94A3B8] mt-4">Alerts appear in the bell menu. Saved automatically on this device.</p>
          </div>

          <button onClick={handleSaveProfile}
            className="bg-[#2563EB] text-white font-semibold px-6 py-3 rounded-xl hover:bg-[#1D4ED8] transition-colors text-sm">
            Save Changes
          </button>
        </div>
      )}

      {/* ── Security tab ── */}
      {tab === "security" && (
        <div className="space-y-5 animate-in">
          {/* Change password */}
          <div className="bg-white rounded-2xl p-5 sm:p-6 border border-[#E2E8F0] card-shadow">
            <h2 className="font-semibold text-[#0F172A] mb-5">Change Password</h2>
            {passwordError && (
              <div className="bg-[#FEF2F2] border border-[#FECACA] rounded-xl px-4 py-3 mb-4 text-xs text-[#EF4444] flex items-center gap-2">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/></svg>
                {passwordError}
              </div>
            )}
            <div className="grid sm:grid-cols-2 gap-4 max-w-lg">
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-[#0F172A] mb-1.5">Current Password</label>
                <input type="password" placeholder="••••••••" value={passwords.current}
                  onChange={(e) => { setPasswords({ ...passwords, current: e.target.value }); if (passwordError) setPasswordError(""); }}
                  className="w-full border border-[#E2E8F0] rounded-xl px-4 py-3 text-sm outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-blue-100" />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#0F172A] mb-1.5">New Password</label>
                <input type="password" placeholder="Min. 8 characters" value={passwords.next}
                  onChange={(e) => { setPasswords({ ...passwords, next: e.target.value }); if (passwordError) setPasswordError(""); }}
                  className="w-full border border-[#E2E8F0] rounded-xl px-4 py-3 text-sm outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-blue-100" />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#0F172A] mb-1.5">Confirm New Password</label>
                <input type="password" placeholder="Repeat new password" value={passwords.confirm}
                  onChange={(e) => { setPasswords({ ...passwords, confirm: e.target.value }); if (passwordError) setPasswordError(""); }}
                  className="w-full border border-[#E2E8F0] rounded-xl px-4 py-3 text-sm outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-blue-100" />
              </div>
            </div>
            <button onClick={handleUpdatePassword} disabled={busy}
              className="mt-4 disabled:opacity-60 bg-[#2563EB] text-white font-semibold px-5 py-2.5 rounded-xl hover:bg-[#1D4ED8] transition-colors text-sm">
              Update Password
            </button>
          </div>

          {/* 2FA */}
          <div className="bg-white rounded-2xl p-5 sm:p-6 border border-[#E2E8F0] card-shadow">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#F1F5F9] flex items-center justify-center shrink-0 text-lg">🔐</div>
              <div>
                <h2 className="font-semibold text-[#0F172A]">Two-Factor Authentication</h2>
                <p className="text-sm text-[#64748B] mt-0.5">Not available yet. It is planned for a later release.</p>
              </div>
            </div>
          </div>

          {/* Sessions */}
          <div className="bg-white rounded-2xl p-5 sm:p-6 border border-[#E2E8F0] card-shadow">
            <h2 className="font-semibold text-[#0F172A] mb-1">Signed-in Devices</h2>
            <p className="text-sm text-[#64748B] mb-4">Sign out everywhere else if you used a shared or lost device. This device stays signed in.</p>
            <button onClick={handleSignOutOthers} disabled={busy}
              className="text-sm font-semibold text-[#EF4444] border border-[#FECACA] px-4 py-2 rounded-xl hover:bg-[#FEF2F2] transition-colors disabled:opacity-60">
              Sign out of all other devices
            </button>
          </div>
        </div>
      )}

      {/* ── Privacy tab ── */}
      {tab === "privacy" && (
        <div className="space-y-5 animate-in">
          <div className="bg-white rounded-2xl p-5 sm:p-6 border border-[#E2E8F0] card-shadow">
            <h2 className="font-semibold text-[#0F172A] mb-4">Data Management</h2>
            <div className="space-y-3">
              {[
                { label: "Download Your Data", desc: "All transactions, budgets and goals as a CSV file (opens in Excel or Google Sheets)", btn: exporting === "csv" ? "Preparing…" : "Export CSV", action: () => void handleExportCsv() },
                { label: "Download PDF Report", desc: "A printable financial summary. Choose \"Save as PDF\" in the print window", btn: exporting === "pdf" ? "Preparing…" : "Export PDF", action: () => void handleExportPdf() },
              ].map((item) => (
                <div key={item.label} className="flex items-center justify-between p-4 bg-[#F8FAFC] rounded-xl border border-[#E2E8F0]">
                  <div>
                    <p className="text-sm font-semibold text-[#0F172A]">{item.label}</p>
                    <p className="text-xs text-[#64748B]">{item.desc}</p>
                  </div>
                  <button type="button" onClick={item.action} disabled={exporting !== ""}
                    className="disabled:opacity-60 text-sm font-medium text-[#2563EB] border border-[#BFDBFE] px-3.5 py-1.5 rounded-xl hover:bg-[#EFF6FF] transition-colors shrink-0 ml-3">
                    {item.btn}
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-2xl p-5 sm:p-6 border border-[#E2E8F0] card-shadow">
            <h2 className="font-semibold text-[#0F172A] mb-4">Consent Management</h2>
            <div className="space-y-4 divide-y divide-[#F8FAFC]">
              {([
                { key: "analytics" as const, label: "Product analytics",     desc: "Allow anonymous usage statistics if we add them in future. SmartBudget does not use analytics today." },
                { key: "usage"     as const, label: "Research participation", desc: "Allow us to contact you about optional, anonymous feedback surveys for this project." },
              ] as const).map(({ key, label, desc }) => {
                const labels = { analytics: label, usage: label };
                return (
                  <div key={key} className="flex items-center justify-between pt-4 first:pt-0">
                    <div className="pr-4">
                      <p className="text-sm font-medium text-[#0F172A]">{labels[key]}</p>
                      <p className="text-xs text-[#64748B] mt-0.5">{desc}</p>
                    </div>
                    <Toggle label={labels[key]} checked={consents[key]} onChange={() => {
                      const next = { ...consents, [key]: !consents[key] };
                      setConsents(next);
                      try { localStorage.setItem("sb_consents", JSON.stringify(next)); } catch { /* ignore */ }
                      showToast(`✓  ${labels[key]} ${next[key] ? "enabled" : "disabled"}`);
                    }} />
                  </div>
                );
              })}
            </div>
          </div>

          <div className="bg-white rounded-2xl p-5 sm:p-6 border border-[#E2E8F0] card-shadow">
            <h2 className="font-semibold text-[#0F172A] mb-1">Policies</h2>
            <p className="text-xs text-[#64748B] mb-4">How SmartBudget handles your information and the rules for using it.</p>
            <div className="flex flex-wrap gap-2">
              {([
                ["privacy", "Privacy Policy"], ["terms", "Terms of Use"], ["disclaimer", "Disclaimer"],
                ["cookies", "Cookies & Storage"], ["security", "Security"],
              ] as [Screen, string][]).map(([target, label]) => (
                <button key={target} type="button" onClick={() => navigate(target)}
                  className="text-sm text-[#475569] border border-[#E2E8F0] bg-[#F8FAFC] hover:border-[#BFDBFE] hover:text-[#2563EB] px-3.5 py-1.5 rounded-full transition-colors">
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-2xl p-5 sm:p-6 border border-[#FEE2E2] card-shadow">
            <h2 className="font-semibold text-[#EF4444] mb-2">Danger Zone</h2>
            <p className="text-sm text-[#64748B] mb-4">
              Permanently delete your account and all associated data. This cannot be undone.
            </p>
            <button onClick={() => setShowDelete(true)}
              className="text-sm font-semibold text-[#EF4444] border border-[#FECACA] px-4 py-2 rounded-xl hover:bg-[#FEF2F2] transition-colors">
              Delete Account
            </button>
          </div>
        </div>
      )}

      {/* ── Connected Accounts tab ── */}
      {tab === "accounts" && (
        <div className="space-y-5 animate-in">
          <div className="bg-white rounded-2xl p-5 sm:p-6 border border-[#E2E8F0] card-shadow">
            <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
              <div>
                <h2 className="font-semibold text-[#0F172A]">Demo bank account</h2>
                <p className="text-sm text-[#64748B] mt-0.5">Simulated connection only — not a real financial institution</p>
              </div>
              <button onClick={onConnectMore}
                className="flex items-center gap-1.5 text-sm font-semibold text-[#2563EB] border border-[#BFDBFE] bg-[#EFF6FF] px-3.5 py-2 rounded-xl hover:bg-[#DBEAFE] transition-colors shrink-0">
                Open demo bank
              </button>
            </div>

            {connectedAccounts.length === 0 ? (
              <div className="flex flex-col items-center text-center py-10">
                <div className="w-14 h-14 rounded-2xl bg-[#F1F5F9] flex items-center justify-center mb-3 text-2xl">🏦</div>
                <p className="text-sm font-medium text-[#0F172A] mb-1">No demo bank connected</p>
                <p className="text-xs text-[#94A3B8] mb-5 max-w-xs">Connect the simulated Harbour Demo Bank to preview a bank link. This is not a real bank.</p>
                <button onClick={onConnectMore}
                  className="bg-[#2563EB] text-white font-semibold text-sm px-5 py-2.5 rounded-xl hover:bg-[#1D4ED8] transition-colors">
                  Simulate connection
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {connectedAccounts.map((acc) => (
                  <div key={acc.id} className="flex items-center gap-3.5 p-4 rounded-2xl border border-[#E2E8F0] bg-[#FAFAFA]">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#2563EB] to-[#4F46E5] flex items-center justify-center text-white font-bold text-sm shrink-0">
                      {acc.bank.slice(0, 2).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-[#0F172A] truncate">{acc.name}</p>
                      <p className="text-xs text-[#64748B] capitalize">{acc.bank} · {acc.type} ••{acc.last4}</p>
                      {typeof acc.sampleBalance === "number" && (
                        <p className="text-xs font-mono text-[#0F172A] mt-0.5">
                          {acc.sampleBalance.toLocaleString("en-AU", { style: "currency", currency: "AUD" })}
                          <span className="text-[#94A3B8] font-sans"> sample balance</span>
                        </p>
                      )}
                    </div>
                    <span className="text-[10px] font-semibold text-[#92400E] bg-[#FEF3C7] px-2.5 py-1 rounded-full shrink-0">Demo</span>
                    <button onClick={() => setDisconnectConfirm(acc.id)}
                      className="text-xs font-medium text-[#EF4444] hover:underline shrink-0">Disconnect</button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-[#FEF3C7] border border-[#FDE68A] rounded-2xl px-5 py-4 flex items-start gap-3">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#92400E" strokeWidth="2" strokeLinecap="round" className="mt-0.5 shrink-0">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
              <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
            <p className="text-xs text-[#92400E] leading-relaxed">
              <strong>Demo bank connection — simulated, not a real bank.</strong> No credentials are requested or stored. Sample imports are labelled [Demo] and can be removed without deleting your own transactions.
            </p>
          </div>
        </div>
      )}

    </div>
  );
}
