import { useState } from "react";

type Permission = {
  id: string;
  label: string;
  description: string;
  category: "data" | "content" | "admin" | "ai";
};

type Role = {
  id: string;
  name: string;
  badge: string;
  color: string;
  bg: string;
  description: string;
  userCount: number;
  editable: boolean;
  permissions: string[];
};

const ALL_PERMISSIONS: Permission[] = [
  { id: "view_dashboard",    label: "View Dashboard",        description: "Access the user-facing personal finance dashboard",   category: "data"    },
  { id: "manage_budget",     label: "Manage Budgets",        description: "Create, edit, and delete budget plans",               category: "data"    },
  { id: "track_expenses",    label: "Track Expenses",        description: "Add and categorise transactions",                     category: "data"    },
  { id: "savings_goals",     label: "Savings Goals",         description: "Create and track savings goals",                      category: "data"    },
  { id: "view_analytics",    label: "View Analytics",        description: "Access personal spending analytics",                  category: "data"    },
  { id: "use_ai_chat",       label: "AI Financial Assistant","description": "Chat with the educational AI assistant",            category: "ai"      },
  { id: "view_content",      label: "View Education Hub",    description: "Access financial literacy lessons",                   category: "content" },
  { id: "create_content",    label: "Create Content",        description: "Draft new educational lessons and articles",          category: "content" },
  { id: "publish_content",   label: "Publish Content",       description: "Approve and publish education content",               category: "content" },
  { id: "manage_users",      label: "Manage Users",          description: "View, edit, suspend, and delete user accounts",       category: "admin"   },
  { id: "promote_users",     label: "Promote Users",         description: "Change user roles up to (but not including) Admin",   category: "admin"   },
  { id: "view_reports",      label: "View Reports",          description: "Access platform-wide analytics and reports",          category: "admin"   },
  { id: "export_reports",    label: "Export Reports",        description: "Download CSV and PDF platform reports",               category: "admin"   },
  { id: "view_audit_logs",   label: "View Audit Logs",       description: "Read system access and activity logs",               category: "admin"   },
  { id: "manage_categories", label: "Manage Categories",     description: "Add, edit, and remove expense categories",            category: "admin"   },
  { id: "security_center",   label: "Security Center",       description: "Access failed login logs and security alerts",        category: "admin"   },
  { id: "system_settings",   label: "System Settings",       description: "Configure platform-wide settings",                   category: "admin"   },
  { id: "manage_roles",      label: "Manage Roles",          description: "Create and edit roles and permission sets",           category: "admin"   },
  { id: "review_ai_flags",   label: "Review AI Flags",       description: "Moderate flagged AI interactions",                   category: "ai"      },
  { id: "view_ai_log",       label: "View AI Log",           description: "Read the AI evaluation log",                         category: "ai"      },
];

const INITIAL_ROLES: Role[] = [
  {
    id: "r1", name: "Administrator", badge: "Admin", color: "#92400E", bg: "#FEF3C7",
    description: "Full platform access. Can manage all users, content, settings, and security.",
    userCount: 1, editable: false,
    permissions: ALL_PERMISSIONS.map((p) => p.id),
  },
  {
    id: "r2", name: "Editor", badge: "Editor", color: "#1D4ED8", bg: "#EFF6FF",
    description: "Can create and publish educational content. No access to user data or admin tools.",
    userCount: 2, editable: true,
    permissions: ["view_content", "create_content", "publish_content", "use_ai_chat"],
  },
  {
    id: "r3", name: "User", badge: "User", color: "#065F46", bg: "#D1FAE5",
    description: "Standard account. Access to personal finance tools and education hub only.",
    userCount: 131, editable: true,
    permissions: [
      "view_dashboard", "manage_budget", "track_expenses", "savings_goals",
      "view_analytics", "use_ai_chat", "view_content",
    ],
  },
  {
    id: "r4", name: "Read-Only", badge: "Read-Only", color: "#475569", bg: "#F1F5F9",
    description: "Can view the dashboard and education hub but cannot add or modify any data.",
    userCount: 0, editable: true,
    permissions: ["view_dashboard", "view_content"],
  },
];

const CATEGORY_LABELS: Record<Permission["category"], { label: string; color: string; bg: string }> = {
  data:    { label: "Personal Finance", color: "#065F46", bg: "#D1FAE5" },
  content: { label: "Content",          color: "#1D4ED8", bg: "#EFF6FF" },
  admin:   { label: "Administration",   color: "#92400E", bg: "#FEF3C7" },
  ai:      { label: "AI",               color: "#6B21A8", bg: "#FAF5FF" },
};

function PermissionRow({ perm, checked, onChange, disabled }: {
  perm: Permission; checked: boolean; onChange: () => void; disabled: boolean;
}) {
  const cat = CATEGORY_LABELS[perm.category];
  return (
    <label className={`flex items-start gap-3 px-4 py-3 rounded-xl transition-colors ${checked ? "bg-[#F0F9FF]" : "hover:bg-[#F8FAFC]"} ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}>
      <input
        type="checkbox" checked={checked} onChange={onChange} disabled={disabled}
        className="mt-0.5 accent-[#2563EB] w-4 h-4 shrink-0"
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-sm font-medium text-[#0F172A]">{perm.label}</span>
          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${cat.bg}`} style={{ color: cat.color }}>{cat.label}</span>
        </div>
        <p className="text-xs text-[#64748B]">{perm.description}</p>
      </div>
    </label>
  );
}

export default function AdminRoles() {
  const [roles, setRoles] = useState(INITIAL_ROLES);
  const [selected, setSelected] = useState<string>("r1");
  const [toast, setToast] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(""), 2500); };

  const active = roles.find((r) => r.id === selected)!;
  const groupedPerms = (["data", "content", "admin", "ai"] as const).map((cat) => ({
    cat,
    perms: ALL_PERMISSIONS.filter((p) => p.category === cat),
  }));

  const togglePerm = (permId: string) => {
    if (!active.editable) return;
    setRoles((prev) => prev.map((r) => {
      if (r.id !== selected) return r;
      const has = r.permissions.includes(permId);
      return { ...r, permissions: has ? r.permissions.filter((p) => p !== permId) : [...r.permissions, permId] };
    }));
  };

  const handleSave = () => showToast(`✓ "${active.name}" role saved`);

  const handleCreateRole = () => {
    if (!newName.trim()) return;
    setRoles((prev) => [
      ...prev,
      {
        id: `r${Date.now()}`, name: newName.trim(), badge: newName.trim(),
        color: "#475569", bg: "#F1F5F9", description: newDesc.trim(),
        userCount: 0, editable: true, permissions: [],
      },
    ]);
    setNewName(""); setNewDesc(""); setShowNew(false);
    showToast("✓ New role created");
  };

  return (
    <div>
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-[#0F172A] text-white text-sm px-5 py-3 rounded-xl shadow-xl z-50 max-w-[90vw] text-center">{toast}</div>
      )}

      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-[#0F172A]">Roles &amp; Permissions</h1>
          <p className="text-sm text-[#64748B] mt-1">Define what each role can access. The Administrator role cannot be modified.</p>
        </div>
        <button onClick={() => setShowNew(true)}
          className="flex items-center gap-2 bg-[#2563EB] text-white text-sm font-semibold px-4 py-2.5 rounded-xl hover:bg-[#1D4ED8] transition-colors">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          New Role
        </button>
      </div>

      {/* New role modal */}
      {showNew && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl">
            <h3 className="font-bold text-[#0F172A] mb-4">Create New Role</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-[#64748B] mb-1.5">Role Name *</label>
                <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g. Moderator"
                  className="w-full border border-[#E2E8F0] rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB]" />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#64748B] mb-1.5">Description</label>
                <textarea value={newDesc} onChange={(e) => setNewDesc(e.target.value)} rows={2} placeholder="What can this role do?"
                  className="w-full border border-[#E2E8F0] rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB] resize-none" />
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setShowNew(false)} className="flex-1 border border-[#E2E8F0] text-[#64748B] font-medium py-2.5 rounded-xl text-sm hover:bg-[#F8FAFC] transition-colors">Cancel</button>
              <button onClick={handleCreateRole} disabled={!newName.trim()} className="flex-1 bg-[#2563EB] text-white font-semibold py-2.5 rounded-xl text-sm hover:bg-[#1D4ED8] transition-colors disabled:opacity-40">Create</button>
            </div>
          </div>
        </div>
      )}

      <div className="grid lg:grid-cols-[280px_1fr] gap-5">
        {/* Role list */}
        <div className="space-y-2">
          {roles.map((role) => (
            <button key={role.id} onClick={() => setSelected(role.id)}
              className={`w-full text-left p-4 rounded-2xl border transition-all ${selected === role.id ? "border-[#2563EB] bg-[#EFF6FF] shadow-sm" : "border-[#E2E8F0] bg-white hover:border-[#BFDBFE]"}`}>
              <div className="flex items-center gap-2 mb-1">
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full`} style={{ backgroundColor: role.bg, color: role.color }}>{role.badge}</span>
                {!role.editable && <span className="text-[10px] text-[#94A3B8]">Protected</span>}
              </div>
              <p className="font-semibold text-[#0F172A] text-sm">{role.name}</p>
              <p className="text-xs text-[#94A3B8] mt-0.5">{role.userCount} {role.userCount === 1 ? "user" : "users"} · {role.permissions.length} permissions</p>
            </button>
          ))}
        </div>

        {/* Permission editor */}
        <div className="bg-white rounded-2xl border border-[#E2E8F0] overflow-hidden">
          <div className="px-5 py-4 border-b border-[#F1F5F9] flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 mb-0.5">
                <span className="font-bold text-[#0F172A]">{active.name}</span>
                <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: active.bg, color: active.color }}>{active.badge}</span>
              </div>
              <p className="text-xs text-[#64748B]">{active.description}</p>
            </div>
            {active.editable && (
              <button onClick={handleSave} className="text-sm font-semibold text-white bg-[#2563EB] px-4 py-2 rounded-xl hover:bg-[#1D4ED8] transition-colors shrink-0">
                Save Changes
              </button>
            )}
          </div>

          <div className="p-4 space-y-5 max-h-[calc(100vh-300px)] overflow-y-auto">
            {!active.editable && (
              <div className="flex items-center gap-2 bg-[#FFFBEB] border border-[#FDE68A] rounded-xl px-4 py-3">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" strokeWidth="2" strokeLinecap="round">
                  <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
                <p className="text-xs text-[#92400E]">The Administrator role has all permissions and cannot be modified.</p>
              </div>
            )}
            {groupedPerms.map(({ cat, perms }) => {
              const meta = CATEGORY_LABELS[cat];
              return (
                <div key={cat}>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs font-bold uppercase tracking-wide" style={{ color: meta.color }}>{meta.label}</span>
                    <div className="flex-1 h-px bg-[#F1F5F9]" />
                  </div>
                  <div className="space-y-1">
                    {perms.map((perm) => (
                      <PermissionRow
                        key={perm.id}
                        perm={perm}
                        checked={active.permissions.includes(perm.id)}
                        onChange={() => togglePerm(perm.id)}
                        disabled={!active.editable}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
