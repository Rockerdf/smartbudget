import type { Screen } from "../App";
import type { UserRole } from "../lib/auth";
import { ROLE_META, ADMIN_PANEL_ROLES } from "../lib/permissions";

const SCREEN_LABELS: Partial<Record<Screen, string>> = {
  adminDashboard:      "Admin Dashboard",
  adminUsers:          "User Management",
  adminRoles:          "Roles & Permissions",
  adminReports:        "Reports",
  adminContent:        "Content Management",
  adminSecurity:       "Security Center",
  adminAuditLogs:      "Audit Logs",
  adminSystemSettings: "System Settings",
};

type Props = {
  navigate:        (s: Screen) => void;
  currentRole?:    UserRole;
  attemptedScreen?: Screen | null;
  isAdminUser?:    boolean;
};

export default function AccessDenied({ navigate, currentRole = "user", attemptedScreen, isAdminUser }: Props) {
  const roleMeta   = ROLE_META[currentRole];
  const screenLabel = attemptedScreen ? SCREEN_LABELS[attemptedScreen] : null;
  const isAdminPanel = isAdminUser ?? ADMIN_PANEL_ROLES.includes(currentRole);

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl p-10 text-center max-w-sm w-full border border-[#FECACA] shadow-lg">

        {/* Icon */}
        <div className="w-20 h-20 rounded-full bg-[#FEE2E2] flex items-center justify-center mx-auto mb-5">
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2l9 4v6c0 5.25-3.75 10.14-9 11.5C6.75 22.14 3 17.25 3 12V6l9-4z"/>
            <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
          </svg>
        </div>

        <h2 className="text-2xl font-bold text-[#0F172A] mb-2">Access Denied</h2>

        {/* Role badge */}
        <div className="flex items-center justify-center gap-2 mb-4">
          <span className="text-sm text-[#64748B]">Signed in as</span>
          <span
            style={{ backgroundColor: roleMeta.bg, color: roleMeta.text }}
            className="text-xs font-bold px-2.5 py-1 rounded-full">
            {roleMeta.label}
          </span>
        </div>

        {screenLabel ? (
          <p className="text-[#64748B] text-sm mb-1">
            Your role does not have permission to access <strong>{screenLabel}</strong>.
          </p>
        ) : (
          <p className="text-[#64748B] text-sm mb-1">
            You don't have permission to view this page.
          </p>
        )}

        {/* Role-specific explanation */}
        <p className="text-[#94A3B8] text-xs mb-6 leading-relaxed">
          {currentRole === "user"
            ? "This area is restricted to administrators and support staff. Contact your administrator if you need access."
            : currentRole === "support"
            ? "Support accounts can access the Dashboard, User Management, and Reports. Contact a Super Admin to request elevated permissions."
            : currentRole === "admin"
            ? "Admin accounts cannot access this area. Only Super Admins have full platform access. Contact a Super Admin if you need this."
            : "Contact your platform administrator for access."}
        </p>

        {/* Required role notice */}
        {screenLabel && (
          <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl px-4 py-3 mb-6 text-left">
            <p className="text-[10px] font-bold uppercase tracking-wide text-[#94A3B8] mb-2">Required Access</p>
            <div className="flex flex-wrap gap-1.5">
              {currentRole === "support"
                ? (["superadmin", "admin"] as UserRole[]).map((r) => (
                    <span key={r} style={{ backgroundColor: ROLE_META[r].bg, color: ROLE_META[r].text }}
                      className="text-[10px] font-bold px-2 py-0.5 rounded-full">{ROLE_META[r].label}</span>
                  ))
                : (["superadmin"] as UserRole[]).map((r) => (
                    <span key={r} style={{ backgroundColor: ROLE_META[r].bg, color: ROLE_META[r].text }}
                      className="text-[10px] font-bold px-2 py-0.5 rounded-full">{ROLE_META[r].label}</span>
                  ))
              }
            </div>
          </div>
        )}

        <button
          onClick={() => navigate(isAdminPanel ? "adminDashboard" : "dashboard")}
          className="w-full bg-[#2563EB] text-white font-semibold py-3 rounded-xl hover:bg-[#1D4ED8] transition-colors">
          {isAdminPanel ? "Back to Admin Dashboard" : "Back to My Dashboard"}
        </button>
      </div>
    </div>
  );
}
