import { useState } from "react";

type ToggleProps = { label: string; description: string; value: boolean; onChange: (v: boolean) => void };
function Toggle({ label, description, value, onChange }: ToggleProps) {
  return (
    <div className="flex items-start justify-between gap-4 py-4 border-b border-[#F1F5F9] last:border-0">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-[#0F172A]">{label}</p>
        <p className="text-xs text-[#64748B] mt-0.5">{description}</p>
      </div>
      <button onClick={() => onChange(!value)}
        className={`relative shrink-0 w-11 h-6 rounded-full transition-colors duration-200 focus:outline-none ${value ? "bg-[#2563EB]" : "bg-[#CBD5E1]"}`}>
        <span className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow transition-transform duration-200 ${value ? "translate-x-5" : "translate-x-0"}`} />
      </button>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-[#E2E8F0] overflow-hidden">
      <div className="px-5 py-3.5 bg-[#F8FAFC] border-b border-[#E2E8F0]">
        <h2 className="text-sm font-semibold text-[#0F172A]">{title}</h2>
      </div>
      <div className="px-5">{children}</div>
    </div>
  );
}

function Field({ label, description, value, onChange, type = "text" }: {
  label: string; description?: string; value: string;
  onChange: (v: string) => void; type?: string;
}) {
  return (
    <div className="py-4 border-b border-[#F1F5F9] last:border-0">
      <label className="block text-sm font-medium text-[#0F172A] mb-0.5">{label}</label>
      {description && <p className="text-xs text-[#64748B] mb-2">{description}</p>}
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)}
        className="w-full max-w-sm border border-[#E2E8F0] rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB]" />
    </div>
  );
}

function SelectField({ label, description, value, options, onChange }: {
  label: string; description?: string; value: string;
  options: { value: string; label: string }[]; onChange: (v: string) => void;
}) {
  return (
    <div className="py-4 border-b border-[#F1F5F9] last:border-0">
      <label className="block text-sm font-medium text-[#0F172A] mb-0.5">{label}</label>
      {description && <p className="text-xs text-[#64748B] mb-2">{description}</p>}
      <select value={value} onChange={(e) => onChange(e.target.value)}
        className="w-full max-w-sm border border-[#E2E8F0] rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#2563EB]">
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}

export default function AdminSystemSettings() {
  const [toast, setToast] = useState("");
  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(""), 2500); };

  // Platform
  const [platformName, setPlatformName] = useState("SmartBudget");
  const [supportEmail, setSupportEmail] = useState("support@smartbudget.com");
  const [timezone, setTimezone] = useState("UTC");
  const [currency, setCurrency] = useState("AUD");
  const [dateFormat, setDateFormat] = useState("DD/MM/YYYY");

  // Auth
  const [requireEmailVerify, setRequireEmailVerify] = useState(true);
  const [allowRegistration, setAllowRegistration] = useState(true);
  const [sessionTimeout, setSessionTimeout] = useState("60");
  const [maxFailedLogins, setMaxFailedLogins] = useState("5");
  const [twoFactorAdmin, setTwoFactorAdmin] = useState(false);

  // AI
  const [aiEnabled, setAiEnabled] = useState(true);
  const [aiRateLimit, setAiRateLimit] = useState("100");
  const [aiSafetyFilter, setAiSafetyFilter] = useState(true);
  const [aiDisclaimer, setAiDisclaimer] = useState(true);

  // Notifications
  const [emailNotifs, setEmailNotifs] = useState(true);
  const [securityAlerts, setSecurityAlerts] = useState(true);
  const [weeklyDigest, setWeeklyDigest] = useState(false);

  // Maintenance
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [debugMode, setDebugMode] = useState(false);

  return (
    <div>
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-[#0F172A] text-white text-sm px-5 py-3 rounded-xl shadow-xl z-50 max-w-[90vw] text-center">{toast}</div>
      )}

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-[#0F172A]">System Settings</h1>
          <p className="text-sm text-[#64748B] mt-1">Configure platform-wide behaviour, authentication, AI, and notifications.</p>
        </div>
        <button onClick={() => showToast("✓ Saved for this session. These preview settings don't change the live app yet.")}
          className="bg-[#2563EB] text-white text-sm font-semibold px-5 py-2.5 rounded-xl hover:bg-[#1D4ED8] transition-colors">
          Save All Changes
        </button>
      </div>

      {maintenanceMode && (
        <div className="flex items-center gap-3 bg-[#FEF3C7] border border-[#FDE68A] rounded-2xl px-5 py-4 mb-5">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#92400E" strokeWidth="2" strokeLinecap="round">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
          </svg>
          <p className="text-sm text-[#92400E] font-semibold">Maintenance mode is ON — the platform is unavailable to regular users.</p>
        </div>
      )}

      <div className="space-y-5">
        {/* Platform */}
        <Section title="Platform">
          <Field label="Platform Name" value={platformName} onChange={setPlatformName} />
          <Field label="Support Email" value={supportEmail} onChange={setSupportEmail} type="email" />
          <SelectField label="Timezone" description="Used for timestamps and scheduled jobs." value={timezone} onChange={setTimezone}
            options={[{ value: "UTC", label: "UTC" }, { value: "Australia/Sydney", label: "Sydney (AEDT)" }, { value: "America/New_York", label: "New York (ET)" }, { value: "Europe/London", label: "London (GMT)" }]} />
          <SelectField label="Currency" value={currency} onChange={setCurrency}
            options={[{ value: "AUD", label: "AUD — Australian Dollar" }, { value: "USD", label: "USD — US Dollar" }, { value: "GBP", label: "GBP — British Pound" }, { value: "EUR", label: "EUR — Euro" }]} />
          <SelectField label="Date Format" value={dateFormat} onChange={setDateFormat}
            options={[{ value: "DD/MM/YYYY", label: "DD/MM/YYYY" }, { value: "MM/DD/YYYY", label: "MM/DD/YYYY" }, { value: "YYYY-MM-DD", label: "YYYY-MM-DD (ISO)" }]} />
        </Section>

        {/* Authentication */}
        <Section title="Authentication">
          <Toggle label="Allow New Registrations" description="When off, new users cannot create accounts." value={allowRegistration} onChange={setAllowRegistration} />
          <Toggle label="Require Email Verification" description="New accounts must verify their email before accessing the platform." value={requireEmailVerify} onChange={setRequireEmailVerify} />
          <Toggle label="Two-Factor Auth for Admins" description="Admins must complete 2FA on every login." value={twoFactorAdmin} onChange={setTwoFactorAdmin} />
          <Field label="Session Timeout (minutes)" description="Sessions expire after this many minutes of inactivity." value={sessionTimeout} onChange={setSessionTimeout} type="number" />
          <Field label="Max Failed Login Attempts" description="Account is temporarily locked after this many consecutive failures." value={maxFailedLogins} onChange={setMaxFailedLogins} type="number" />
        </Section>

        {/* AI */}
        <Section title="AI Financial Assistant">
          <div className="py-3 bg-[#F0F9FF] rounded-xl px-4 my-3 border border-[#BAE6FD]">
            <p className="text-xs text-[#0369A1] leading-relaxed">
              <strong>AI Constraint:</strong> The AI in this product must always be educational, never prescriptive: it explains patterns and concepts, drafts suggestions the user can edit, and never recommends specific investments, loans, credit products, or tax treatments.
            </p>
          </div>
          <Toggle label="Enable AI Assistant" description="When off, the Ask AI feature is hidden from all users." value={aiEnabled} onChange={setAiEnabled} />
          <Toggle label="Safety Filter" description="Block prompt injection and jailbreak attempts. Highly recommended." value={aiSafetyFilter} onChange={setAiSafetyFilter} />
          <Toggle label="Show Educational Disclaimer" description="Display the disclaimer before AI responses." value={aiDisclaimer} onChange={setAiDisclaimer} />
          <Field label="Daily Message Limit per User" description="Maximum AI messages a single user can send per day." value={aiRateLimit} onChange={setAiRateLimit} type="number" />
        </Section>

        {/* Notifications */}
        <Section title="Notifications">
          <Toggle label="Email Notifications" description="Send transactional emails (registration, password reset, etc.)." value={emailNotifs} onChange={setEmailNotifs} />
          <Toggle label="Security Alerts" description="Email administrators when a critical security event is detected." value={securityAlerts} onChange={setSecurityAlerts} />
          <Toggle label="Weekly Activity Digest" description="Send admins a weekly summary of platform activity." value={weeklyDigest} onChange={setWeeklyDigest} />
        </Section>

        {/* Maintenance */}
        <Section title="Maintenance">
          <Toggle label="Maintenance Mode" description="Take the platform offline for all non-admin users. Enable before running major updates." value={maintenanceMode} onChange={setMaintenanceMode} />
          <Toggle label="Debug Logging" description="Write verbose logs to the server console. Disable in production." value={debugMode} onChange={setDebugMode} />
          <div className="py-4">
            <p className="text-sm font-medium text-[#0F172A] mb-2">Danger Zone</p>
            <div className="flex gap-3 flex-wrap">
              <button onClick={() => showToast("Cache cleared (prototype)")}
                className="text-sm font-semibold text-[#F97316] border border-[#FED7AA] bg-[#FFF7ED] px-4 py-2 rounded-xl hover:bg-[#FFEDD5] transition-colors">
                Clear Cache
              </button>
              <button onClick={() => showToast("Backup triggered (prototype)")}
                className="text-sm font-semibold text-[#0891B2] border border-[#A5F3FC] bg-[#ECFEFF] px-4 py-2 rounded-xl hover:bg-[#CFFAFE] transition-colors">
                Trigger Manual Backup
              </button>
              <button onClick={() => showToast("Resetting data is not available in this prototype.")}
                className="text-sm font-semibold text-[#EF4444] border border-[#FECACA] bg-[#FEF2F2] px-4 py-2 rounded-xl hover:bg-[#FEE2E2] transition-colors">
                Reset Platform Data…
              </button>
            </div>
          </div>
        </Section>

        {/* Disclaimer */}
        <div className="bg-[#F8FAFC] rounded-2xl border border-[#E2E8F0] p-5">
          <p className="text-xs font-semibold text-[#475569] uppercase tracking-wide mb-2">Platform Disclaimer</p>
          <p className="text-xs text-[#64748B] leading-relaxed">
            This platform provides educational information and budgeting tools only. It does not provide personalised financial, investment, tax, legal, insurance, or credit advice.
          </p>
        </div>
      </div>
    </div>
  );
}
