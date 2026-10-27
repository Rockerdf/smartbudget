import { useState, useMemo, useEffect } from "react";
import { useUsers } from "../../contexts/UsersContext";
import type { UserRecord, UserRole, UserStatus } from "../../lib/auth";
import AIAssistant from "../../components/AIAssistant";
import { canDoUserAction, assignableRoles, ROLE_META } from "../../lib/permissions";

// ── Palette maps ──────────────────────────────────────────────────────────────

const STATUS_META: Record<UserStatus, { label: string; dot: string; bg: string; text: string }> = {
  active:    { label: "Active",    dot: "#10B981", bg: "#D1FAE5", text: "#065F46" },
  suspended: { label: "Suspended", dot: "#EF4444", bg: "#FEE2E2", text: "#991B1B" },
};

const AVATAR_COLORS = [
  ["#DBEAFE", "#1D4ED8"], ["#D1FAE5", "#065F46"], ["#FAF5FF", "#6B21A8"],
  ["#FEF3C7", "#92400E"], ["#FCE7F3", "#9D174D"], ["#ECFEFF", "#0E7490"],
];

function avatarColor(email: string) {
  let h = 0;
  for (let i = 0; i < email.length; i++) h = (h * 31 + email.charCodeAt(i)) & 0xffff;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

// ── Tiny shared pieces ────────────────────────────────────────────────────────

function Avatar({ name, email, size = 36 }: { name: string; email: string; size?: number }) {
  const [bg, fg] = avatarColor(email);
  return (
    <div style={{ width: size, height: size, backgroundColor: bg, color: fg, fontSize: size * 0.38 }}
      className="rounded-full flex items-center justify-center font-bold shrink-0 select-none">
      {name.charAt(0).toUpperCase()}
    </div>
  );
}

function RoleBadge({ role }: { role: UserRole }) {
  const m = ROLE_META[role];
  return (
    <span style={{ backgroundColor: m.bg, color: m.text }}
      className="text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap">
      {m.label}
    </span>
  );
}


function StatusBadge({ status }: { status: UserStatus }) {
  const m = STATUS_META[status];
  return (
    <span style={{ backgroundColor: m.bg, color: m.text }}
      className="inline-flex items-center gap-1.5 text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap">
      <span style={{ backgroundColor: m.dot }} className="w-1.5 h-1.5 rounded-full shrink-0" />
      {m.label}
    </span>
  );
}

function StatCard({ label, value, sub, accent = "#0F172A" }: { label: string; value: number; sub: string; accent?: string }) {
  return (
    <div className="bg-white rounded-2xl border border-[#E2E8F0] p-5 flex flex-col gap-1">
      <p className="text-xs text-[#64748B]">{label}</p>
      <p className="text-2xl font-bold" style={{ color: accent }}>{value}</p>
      <p className="text-xs text-[#94A3B8]">{sub}</p>
    </div>
  );
}

function ActionBtn({
  icon, label, color = "#2563EB", bg = "#EFF6FF", hoverBg = "#DBEAFE", onClick, disabled, title,
}: {
  icon: React.ReactNode; label?: string; color?: string; bg?: string; hoverBg?: string;
  onClick: () => void; disabled?: boolean; title?: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      style={{ color, backgroundColor: bg }}
      className={`flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-lg transition-colors whitespace-nowrap
        ${disabled ? "opacity-30 cursor-not-allowed" : `hover:opacity-90`}`}
      onMouseEnter={(e) => { if (!disabled) (e.currentTarget as HTMLElement).style.backgroundColor = hoverBg; }}
      onMouseLeave={(e) => { if (!disabled) (e.currentTarget as HTMLElement).style.backgroundColor = bg; }}>
      {icon}
      {label && <span>{label}</span>}
    </button>
  );
}

// ── Confirm dialog ────────────────────────────────────────────────────────────

type ConfirmVariant = "suspend" | "activate";

const CONFIRM_COPY: Record<ConfirmVariant, {
  title: string; body: (name: string) => string; warn?: string;
  confirmLabel: string; confirmColor: string; confirmBg: string; confirmHover: string;
  iconBg: string; iconStroke: string;
}> = {
  suspend: {
    title: "Suspend User",
    body: (n) => `Are you sure you want to suspend ${n}?`,
    warn: "The user will be immediately blocked from logging in.",
    confirmLabel: "Suspend",
    confirmColor: "#fff", confirmBg: "#F97316", confirmHover: "#EA580C",
    iconBg: "#FFF7ED", iconStroke: "#F97316",
  },
  activate: {
    title: "Activate User",
    body: (n) => `Reactivate ${n}'s account?`,
    confirmLabel: "Activate",
    confirmColor: "#fff", confirmBg: "#10B981", confirmHover: "#059669",
    iconBg: "#D1FAE5", iconStroke: "#10B981",
  },
};

function ConfirmDialog({
  variant, user, onConfirm, onClose,
}: {
  variant: ConfirmVariant; user: UserRecord; onConfirm: () => void; onClose: () => void;
}) {
  const c = CONFIRM_COPY[variant];
  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 animate-in">
        <div style={{ backgroundColor: c.iconBg }} className="w-12 h-12 rounded-full flex items-center justify-center mb-4">
          {variant === "suspend" && (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={c.iconStroke} strokeWidth="2" strokeLinecap="round">
              <circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/>
            </svg>
          )}
          {variant === "activate" && (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={c.iconStroke} strokeWidth="2" strokeLinecap="round">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
          )}
        </div>
        <h3 className="font-bold text-[#0F172A] mb-1">{c.title}</h3>
        <div className="flex items-center gap-2.5 my-3">
          <Avatar name={user.name} email={user.email} size={32} />
          <div>
            <p className="text-sm font-semibold text-[#0F172A]">{user.name}</p>
            <p className="text-xs text-[#94A3B8]">{user.email}</p>
          </div>
        </div>
        <p className="text-sm text-[#64748B] mb-3">{c.body(user.name)}</p>
        {c.warn && (
          <p className="text-xs bg-[#FEF2F2] border border-[#FECACA] text-[#991B1B] rounded-xl px-3 py-2 mb-4">{c.warn}</p>
        )}
        <div className="flex gap-3 mt-5">
          <button onClick={onClose}
            className="flex-1 border border-[#E2E8F0] text-[#64748B] font-semibold py-2.5 rounded-xl text-sm hover:bg-[#F8FAFC] transition-colors">
            Cancel
          </button>
          <button onClick={onConfirm}
            style={{ backgroundColor: c.confirmBg, color: c.confirmColor }}
            className="flex-1 font-semibold py-2.5 rounded-xl text-sm transition-colors hover:opacity-90">
            {c.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── View User drawer ──────────────────────────────────────────────────────────

function ViewUserPanel({ user, onClose, onEdit }: { user: UserRecord; onClose: () => void; onEdit?: () => void }) {
  const rm = ROLE_META[user.role];
  const sm = STATUS_META[user.status];
  const [bg] = avatarColor(user.email);
  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        {/* Header */}
        <div style={{ backgroundColor: bg }} className="px-6 pt-8 pb-6 text-center relative">
          <button onClick={onClose}
            className="absolute right-4 top-4 w-8 h-8 rounded-lg bg-white/60 flex items-center justify-center text-[#64748B] hover:bg-white transition-colors">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
          <Avatar name={user.name} email={user.email} size={72} />
          <h3 className="font-bold text-[#0F172A] text-lg mt-3">{user.name}</h3>
          <p className="text-sm text-[#64748B]">{user.email}</p>
          <div className="flex items-center justify-center gap-2 mt-3">
            <RoleBadge role={user.role} />
            <StatusBadge status={user.status} />
          </div>
        </div>
        {/* Details */}
        <div className="px-6 py-5 space-y-3">
          {[
            { label: "Registered",  value: user.registeredAt || "—" },
            { label: "Last Login",  value: user.lastLogin || "Not yet recorded" },
            { label: "Role",        value: rm.label },
            { label: "Status",      value: sm.label },
          ].map((r) => (
            <div key={r.label} className="flex justify-between items-center py-2 border-b border-[#F1F5F9] last:border-0">
              <span className="text-xs font-semibold text-[#94A3B8] uppercase tracking-wide">{r.label}</span>
              <span className="text-sm text-[#0F172A] font-medium">{r.value}</span>
            </div>
          ))}
        </div>
        {onEdit && (
          <div className="px-6 pb-5">
            <button onClick={onEdit}
              className="w-full bg-[#2563EB] text-white font-semibold py-2.5 rounded-xl text-sm hover:bg-[#1D4ED8] transition-colors">
              Edit User
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Edit modal (role and status only) ─────────────────────────────────────────
// Names and emails belong to the account owner; passwords are never visible.

function EditUserModal({
  user, canChangeRole, canChangeStatus, onSave, onClose,
}: {
  user: UserRecord;
  canChangeRole: boolean;
  canChangeStatus: boolean;
  onSave: (role: UserRole, status: UserStatus) => Promise<string | null>;
  onClose: () => void;
}) {
  const [role, setRole]     = useState<UserRole>(user.role);
  const [status, setStatus] = useState<UserStatus>(user.status);
  const [err, setErr]       = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    setSaving(true);
    const result = await onSave(role, status);
    setSaving(false);
    if (result) setErr(result);
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="px-6 py-4 border-b border-[#F1F5F9] flex items-center justify-between">
          <h3 className="font-bold text-[#0F172A]">Edit User</h3>
          <button onClick={onClose}
            className="w-8 h-8 rounded-lg hover:bg-[#F1F5F9] flex items-center justify-center text-[#94A3B8] transition-colors">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
        <div className="px-6 py-5 space-y-4">
          {err && (
            <p className="text-xs text-[#991B1B] bg-[#FEF2F2] border border-[#FECACA] rounded-xl px-4 py-3">{err}</p>
          )}
          <div className="flex items-center gap-3">
            <Avatar name={user.name} email={user.email} size={40} />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-[#0F172A] truncate">{user.name}</p>
              <p className="text-xs text-[#94A3B8] truncate">{user.email}</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[#475569] mb-1.5">Role</label>
              <select value={role} disabled={!canChangeRole} onChange={(e) => setRole(e.target.value as UserRole)}
                className="w-full border border-[#E2E8F0] rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#2563EB] disabled:bg-[#F8FAFC] disabled:text-[#94A3B8]">
                {(["user", "support", "admin", "superadmin"] as UserRole[]).map((r) => (
                  <option key={r} value={r}>{ROLE_META[r].label}</option>
                ))}
              </select>
              {!canChangeRole && <p className="text-[11px] text-[#94A3B8] mt-1">Only a super admin can change roles.</p>}
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#475569] mb-1.5">Status</label>
              <select value={status} disabled={!canChangeStatus} onChange={(e) => setStatus(e.target.value as UserStatus)}
                className="w-full border border-[#E2E8F0] rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#2563EB] disabled:bg-[#F8FAFC] disabled:text-[#94A3B8]">
                <option value="active">Active</option>
                <option value="suspended">Suspended</option>
              </select>
            </div>
          </div>
          <p className="text-[11px] text-[#94A3B8]">
            Changes are checked by the database, which refuses any change you are not allowed to make.
          </p>
        </div>
        <div className="px-6 py-4 border-t border-[#F1F5F9] flex gap-3">
          <button onClick={onClose}
            className="flex-1 border border-[#E2E8F0] text-[#64748B] font-semibold py-2.5 rounded-xl text-sm hover:bg-[#F8FAFC] transition-colors">
            Cancel
          </button>
          <button onClick={submit} disabled={saving}
            className="flex-1 bg-[#2563EB] text-white font-semibold py-2.5 rounded-xl text-sm hover:bg-[#1D4ED8] transition-colors disabled:opacity-60">
            {saving ? "Saving…" : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Password reset (sends the user an email) ──────────────────────────────────

function ResetPasswordModal({ user, onSend, onClose }: {
  user: UserRecord; onSend: () => Promise<void>; onClose: () => void;
}) {
  const [sending, setSending] = useState(false);
  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
        <h3 className="font-bold text-[#0F172A] mb-1">Send password reset email</h3>
        <p className="text-sm text-[#64748B] mb-4">
          <strong>{user.name}</strong> ({user.email}) will receive a link to choose a new password.
          Administrators never see or set passwords.
        </p>
        <div className="flex gap-3">
          <button onClick={onClose}
            className="flex-1 border border-[#E2E8F0] text-[#64748B] font-semibold py-2.5 rounded-xl text-sm hover:bg-[#F8FAFC] transition-colors">
            Cancel
          </button>
          <button disabled={sending} onClick={async () => { setSending(true); await onSend(); setSending(false); }}
            className="flex-1 bg-[#2563EB] text-white font-semibold py-2.5 rounded-xl text-sm hover:bg-[#1D4ED8] transition-colors disabled:opacity-60">
            {sending ? "Sending…" : "Send email"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Toast ─────────────────────────────────────────────────────────────────────

function Toast({ message }: { message: string }) {
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[70] pointer-events-none">
      <div className="bg-[#0F172A] text-white text-sm px-5 py-3 rounded-xl shadow-2xl flex items-center gap-2.5 whitespace-nowrap">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="2.5" strokeLinecap="round">
          <polyline points="20 6 9 17 4 12"/>
        </svg>
        {message}
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

type ModalState =
  | { type: "edit";           user: UserRecord }
  | { type: "view";           user: UserRecord }
  | { type: "resetPassword";  user: UserRecord }
  | { type: "confirm"; variant: ConfirmVariant; user: UserRecord };

const THIS_MONTH = new Date().toISOString().slice(0, 7);

export default function AdminUsers({ currentUserRole, currentUserEmail }: { currentUserRole: UserRole; currentUserEmail: string }) {
  const { users, loading, error, refresh, setStatus, setRole, resetPassword } = useUsers();

  useEffect(() => { void refresh(); }, [refresh]);

  const [search,       setSearch]       = useState("");
  const [filterRole,   setFilterRole]   = useState<"all" | UserRole>("all");
  const [filterStatus, setFilterStatus] = useState<"all" | UserStatus>("all");
  const [modal,        setModal]        = useState<ModalState | null>(null);
  const [toastMsg,     setToastMsg]     = useState("");

  const can = (action: Parameters<typeof canDoUserAction>[1]) => canDoUserAction(currentUserRole, action);

  const showToast = (msg: string) => { setToastMsg(msg); setTimeout(() => setToastMsg(""), 2800); };
  const closeModal = () => setModal(null);

  // ── Derived stats ─────────────────────────────────────────────────────────

  const stats = useMemo(() => ({
    total:      users.length,
    active:     users.filter((u) => u.status === "active").length,
    suspended:  users.filter((u) => u.status === "suspended").length,
    admins:     users.filter((u) => u.role === "admin" || u.role === "superadmin").length,
    newMonth:   users.filter((u) => u.registeredAt?.startsWith(THIS_MONTH)).length,
  }), [users]);

  // ── Filtered list ─────────────────────────────────────────────────────────

  const filtered = useMemo(() => users.filter((u) => {
    if (filterRole   !== "all" && u.role   !== filterRole)   return false;
    if (filterStatus !== "all" && u.status !== filterStatus) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!u.name.toLowerCase().includes(q) && !u.email.toLowerCase().includes(q)) return false;
    }
    return true;
  }), [users, filterRole, filterStatus, search]);

  // ── Action handlers ───────────────────────────────────────────────────────

  const isSelf = (email: string) => email.toLowerCase() === currentUserEmail.toLowerCase();

  const errorText = (err: unknown) =>
    err instanceof Error ? err.message : "Something went wrong. Please try again.";

  const handleEdit = async (user: UserRecord, role: UserRole, status: UserStatus): Promise<string | null> => {
    try {
      if (role !== user.role) await setRole(user.id, role);
      if (status !== user.status) await setStatus(user.id, status);
    } catch (err) {
      return errorText(err);
    }
    closeModal();
    showToast("User updated");
    return null;
  };

  const executeConfirm = async () => {
    if (!modal || modal.type !== "confirm") return;
    const { variant, user } = modal;
    try {
      if (variant === "suspend") {
        await setStatus(user.id, "suspended");
        showToast(`${user.name} suspended`);
      } else {
        await setStatus(user.id, "active");
        showToast(`${user.name} reactivated`);
      }
    } catch (err) {
      showToast(errorText(err));
    }
    closeModal();
  };

  const handleResetPassword = async (user: UserRecord) => {
    try {
      await resetPassword(user.email);
      showToast(`Reset email sent to ${user.email}`);
    } catch (err) {
      showToast(errorText(err));
    }
    closeModal();
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div>
      {toastMsg && <Toast message={toastMsg} />}

      {/* Modals */}
      {modal?.type === "edit" && (
        <EditUserModal user={modal.user}
          canChangeRole={can("changeRole")}
          canChangeStatus={can("suspend")}
          onSave={(role, status) => handleEdit(modal.user, role, status)}
          onClose={closeModal} />
      )}
      {modal?.type === "view" && (
        <ViewUserPanel user={modal.user}
          onClose={closeModal}
          onEdit={can("edit") ? () => setModal({ type: "edit", user: modal.user }) : undefined} />
      )}
      {modal?.type === "resetPassword" && (
        <ResetPasswordModal user={modal.user}
          onSend={() => handleResetPassword(modal.user)}
          onClose={closeModal} />
      )}
      {modal?.type === "confirm" && (
        <ConfirmDialog variant={modal.variant} user={modal.user}
          onConfirm={executeConfirm} onClose={closeModal} />
      )}

      {/* Page header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-[#0F172A]">User Management</h1>
          <p className="text-sm text-[#64748B] mt-1">All registered accounts, read live from the database.</p>
        </div>
      </div>

      {error && (
        <p className="text-xs text-[#991B1B] bg-[#FEF2F2] border border-[#FECACA] rounded-xl px-4 py-3 mb-4">{error}</p>
      )}
      {loading && users.length === 0 && (
        <p className="text-xs text-[#64748B] mb-4">Loading users…</p>
      )}

      {/* Stats strip */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 mb-6">
        <StatCard label="Total Users"    value={stats.total}     sub="all accounts"   accent="#0F172A" />
        <StatCard label="Active"         value={stats.active}    sub="can log in"     accent="#10B981" />
        <StatCard label="Suspended"      value={stats.suspended} sub="blocked"        accent="#EF4444" />
        <StatCard label="Admins"         value={stats.admins}    sub="elevated"       accent="#D97706" />
        <StatCard label="New This Month" value={stats.newMonth}  sub={new Date().toLocaleString("en", { month: "long" })} accent="#2563EB" />
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-[#E2E8F0] overflow-hidden">
        <div className="flex flex-wrap items-center gap-3 px-5 py-4 border-b border-[#F1F5F9]">
          {/* Search */}
          <div className="relative flex-1 min-w-[180px]">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name or email…"
              className="w-full pl-9 pr-3 py-2 border border-[#E2E8F0] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB]" />
          </div>

          {/* Role filter */}
          <div className="flex gap-1 bg-[#F1F5F9] rounded-xl p-1">
            {(["all", "user", "support", "admin", "superadmin"] as const).map((r) => (
              <button key={r} onClick={() => setFilterRole(r)}
                className={`text-xs font-semibold px-3 py-1.5 rounded-lg capitalize transition-colors ${filterRole === r ? "bg-white text-[#0F172A] shadow-sm" : "text-[#64748B] hover:text-[#0F172A]"}`}>
                {r === "all" ? "All Roles" : ROLE_META[r as UserRole].label}
              </button>
            ))}
          </div>

          {/* Status filter */}
          <div className="flex gap-1 bg-[#F1F5F9] rounded-xl p-1">
            {(["all", "active", "suspended"] as const).map((s) => (
              <button key={s} onClick={() => setFilterStatus(s)}
                className={`text-xs font-semibold px-3 py-1.5 rounded-lg capitalize transition-colors ${filterStatus === s ? "bg-white text-[#0F172A] shadow-sm" : "text-[#64748B] hover:text-[#0F172A]"}`}>
                {s === "all" ? "All Status" : s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
          </div>

          <span className="text-xs text-[#94A3B8] shrink-0 ml-auto">{filtered.length} of {stats.total}</span>
        </div>

        {/* Table header */}
        <div className="hidden lg:grid grid-cols-[44px_minmax(160px,1fr)_minmax(180px,1fr)_90px_100px_110px_100px_auto] gap-3 px-5 py-3 bg-[#F8FAFC] text-[10px] font-bold text-[#64748B] uppercase tracking-wider border-b border-[#F1F5F9]">
          <span />
          <span>Full Name</span>
          <span>Email</span>
          <span>Role</span>
          <span>Status</span>
          <span>Registered</span>
          <span>Last Login</span>
          <span>Actions</span>
        </div>

        {/* Rows */}
        <div className="divide-y divide-[#F8FAFC]">
          {filtered.length === 0 ? (
            <div className="px-5 py-16 text-center">
              <div className="w-12 h-12 rounded-full bg-[#F1F5F9] flex items-center justify-center mx-auto mb-3">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="1.5" strokeLinecap="round">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                </svg>
              </div>
              <p className="text-sm font-semibold text-[#0F172A] mb-1">
                {stats.total === 0 ? "No users yet" : "No matching users"}
              </p>
              <p className="text-xs text-[#94A3B8]">
                {stats.total === 0
                  ? "Users will appear here once someone registers via the sign-up page."
                  : "Try adjusting your search or filters."}
              </p>
            </div>
          ) : filtered.map((u) => (
            <div key={u.id}
              className="grid grid-cols-[44px_1fr_auto] lg:grid-cols-[44px_minmax(160px,1fr)_minmax(180px,1fr)_90px_100px_110px_100px_auto] gap-3 px-5 py-4 items-center hover:bg-[#FAFAFA] transition-colors">

              {/* Avatar */}
              <Avatar name={u.name} email={u.email} size={36} />

              {/* Name */}
              <div className="min-w-0">
                <p className="text-sm font-semibold text-[#0F172A] truncate">{u.name}</p>
                <p className="text-xs text-[#94A3B8] truncate lg:hidden">{u.email}</p>
              </div>

              {/* Email — desktop */}
              <span className="hidden lg:block text-sm text-[#64748B] truncate">{u.email}</span>

              {/* Role */}
              <div className="hidden lg:block"><RoleBadge role={u.role} /></div>

              {/* Status */}
              <div className="hidden lg:block"><StatusBadge status={u.status} /></div>

              {/* Registered */}
              <span className="hidden lg:block text-xs text-[#94A3B8]">{u.registeredAt || "—"}</span>

              {/* Last login */}
              <span className="hidden lg:block text-xs text-[#94A3B8]">{u.lastLogin || "—"}</span>

              {/* Actions */}
              <div className="flex items-center gap-1 flex-wrap">
                {/* View — always visible */}
                <ActionBtn icon={<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>}
                  onClick={() => setModal({ type: "view", user: u })}
                  color="#6B21A8" bg="#FAF5FF" hoverBg="#EDE9FE" title="View user" />

                {/* Edit */}
                {can("edit") && !isSelf(u.email) && (
                  <ActionBtn icon={<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>}
                    onClick={() => setModal({ type: "edit", user: u })}
                    color="#2563EB" bg="#EFF6FF" hoverBg="#DBEAFE" title="Edit user" />
                )}

                {/* Suspend / Activate */}
                {can("suspend") && !isSelf(u.email) && u.status === "active" && (
                  <ActionBtn icon={<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>}
                    onClick={() => setModal({ type: "confirm", variant: "suspend", user: u })}
                    color="#C2410C" bg="#FFF7ED" hoverBg="#FFEDD5" title="Suspend account" />
                )}
                {can("activate") && !isSelf(u.email) && u.status === "suspended" && (
                  <ActionBtn icon={<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>}
                    onClick={() => setModal({ type: "confirm", variant: "activate", user: u })}
                    color="#065F46" bg="#D1FAE5" hoverBg="#A7F3D0" title="Activate account" />
                )}

                {/* Reset password */}
                {can("resetPassword") && (
                  <ActionBtn icon={<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>}
                    onClick={() => setModal({ type: "resetPassword", user: u })}
                    color="#0891B2" bg="#ECFEFF" hoverBg="#CFFAFE" title="Reset password" />
                )}

              </div>
            </div>
          ))}
        </div>
      </div>

      <p className="text-xs text-[#94A3B8] mt-3 text-center">
        Financial transactions, balances, and personal data are never displayed here — data minimisation principle.
      </p>

      <AIAssistant
        context="admin-users"
        assistantName="User Management Assistant"
        accentColor="#6D28D9"
        admin
        contextData={{
          totalUsers: users.length,
          activeUsers: users.filter((u) => u.status !== "suspended").length,
          suspendedUsers: users.filter((u) => u.status === "suspended").length,
        }}
      />
    </div>
  );
}
