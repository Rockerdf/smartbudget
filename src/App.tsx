import { useState, useRef, useEffect } from "react";
import { restoreRemoteSession, signOutRemote } from "./lib/auth";
import { supabase, RESET_LINK } from "./lib/supabase";
import ResetPassword from "./screens/ResetPassword";
import type { UserSession } from "./lib/auth";
import { ADMIN_PANEL_ROLES, ALL_ADMIN_SCREENS, canAccess } from "./lib/permissions";
import type { AdminScreen } from "./lib/permissions";
import Landing from "./screens/Landing";
import Register from "./screens/Register";
import Login from "./screens/Login";
import Dashboard from "./screens/Dashboard";
import Transactions from "./screens/Transactions";
import Budget from "./screens/Budget";
import SavingsGoals from "./screens/SavingsGoals";
import EducationHub from "./screens/EducationHub";
import Analytics from "./screens/Analytics";
import Agent from "./screens/Agent";
import Settings from "./screens/Settings";
import BankConnect from "./screens/BankConnect";
import AccessDenied from "./screens/AccessDenied";
import HealthScore from "./screens/HealthScore";
import HelpCenter from "./screens/HelpCenter";
import Notifications from "./screens/Notifications";
import Onboarding from "./screens/Onboarding";
import InfoPage from "./screens/InfoPage";
import Contact from "./screens/Contact";
import { PublicShell, Logo } from "./components/SiteChrome";
import { useAppSettings } from "./lib/appSettings";
import { SITE } from "./lib/site";
import { INFO_PATHS } from "./content/legal";
import type { InfoKey } from "./content/legal";
import AppLayout, { PageSkeleton } from "./components/AppLayout";
import { DEMO_ACCOUNT, loadDemoConnection, saveDemoConnection } from "./lib/demoBank";
import { removeDemoTransactions } from "./lib/demoBankActions";
import AdminLayout from "./components/AdminLayout";
import AdminDashboard from "./screens/admin/Dashboard";
import AdminUsers from "./screens/admin/Users";
import AdminRoles from "./screens/admin/Roles";
import AdminReports from "./screens/admin/Reports";
import AdminContent from "./screens/admin/ContentManager";
import AdminSecurityCenter from "./screens/admin/SecurityCenter";
import AdminAuditLogs from "./screens/admin/AuditLogs";
import AdminSystemSettings from "./screens/admin/SystemSettings";

export type Screen =
  | "landing" | "register" | "login" | "bankConnect" | "accessDenied" | "onboarding"
  | "dashboard" | "agent" | "transactions" | "budget" | "savings" | "education" | "analytics" | "settings"
  | "healthScore" | "helpCenter" | "notifications"
  | InfoKey
  | "adminDashboard" | "adminAgent" | "adminUsers" | "adminRoles" | "adminReports"
  | "adminContent" | "adminSecurity" | "adminAuditLogs" | "adminSystemSettings";

export type ConnectedAccount = {
  id: string;
  bank: string;
  name: string;
  last4: string;
  type: "checking" | "savings";
  sampleBalance?: number;
  demo?: boolean;
};

const DEPTH: Record<Screen, number> = {
  landing: 0, register: 1, login: 1, bankConnect: 1, accessDenied: 1, onboarding: 1,
  dashboard: 2, transactions: 3, budget: 3, savings: 3,
  education: 3, analytics: 3, agent: 3, settings: 3,
  healthScore: 3, helpCenter: 3, notifications: 3,
  about: 1, contact: 1, privacy: 1, terms: 1, disclaimer: 1, cookies: 1, accessibility: 1, security: 1,
  adminDashboard: 1, adminAgent: 1, adminUsers: 1, adminRoles: 1, adminReports: 1,
  adminContent: 1, adminSecurity: 1, adminAuditLogs: 1, adminSystemSettings: 1,
};

function isAdminScreen(s: Screen): s is AdminScreen {
  return (ALL_ADMIN_SCREENS as string[]).includes(s);
}

// Public pages have their own URL (e.g. /privacy) so they can be linked to and
// bookmarked. Everything else lives at "/" and is switched in memory.
const PATH_TO_INFO = Object.fromEntries(
  Object.entries(INFO_PATHS).map(([k, path]) => [path, k as InfoKey]),
) as Record<string, InfoKey>;
const EXTRA_PATHS: Record<string, Screen> = { "/help": "helpCenter", "/login": "login", "/register": "register", "/signup": "register" };
const SCREEN_TO_PATH: Partial<Record<Screen, string>> = { ...INFO_PATHS, helpCenter: "/help" };

function isInfoScreen(s: Screen): s is InfoKey {
  return s in INFO_PATHS;
}

function screenFromPath(pathname: string): Screen | null {
  const clean = pathname.replace(/\/+$/, "") || "/";
  return PATH_TO_INFO[clean] ?? EXTRA_PATHS[clean] ?? null;
}

/** Shown to everyone except staff while an administrator has turned on maintenance mode. */
function MaintenanceScreen({ message, signedIn, onSignIn, onSignOut }: {
  message: string; signedIn: boolean; onSignIn: () => void; onSignOut: () => void;
}) {
  return (
    <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center p-6">
      <div className="bg-white rounded-3xl border border-[#E2E8F0] card-shadow-md p-8 sm:p-10 max-w-lg w-full text-center">
        <div className="flex justify-center mb-6"><Logo /></div>
        <div className="w-14 h-14 rounded-2xl bg-[#FEF3C7] mx-auto flex items-center justify-center mb-4" aria-hidden="true">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#B45309" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>
        </div>
        <h1 className="text-2xl font-bold text-[#0F172A]">We'll be back soon</h1>
        <p className="mt-3 text-[#475569] leading-relaxed">{message}</p>
        <p className="mt-4 text-sm text-[#94A3B8]">Questions? Email <a href={`mailto:${SITE.supportEmail}`} className="text-[#2563EB] underline">{SITE.supportEmail}</a></p>
        <button type="button" onClick={signedIn ? onSignOut : onSignIn} className="mt-6 text-sm font-semibold text-[#2563EB] hover:underline">
          {signedIn ? "Sign out" : "Staff sign in"}
        </button>
      </div>
    </div>
  );
}

export default function App() {
  const { settings } = useAppSettings();
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem("sb_theme") === "dark");

  useEffect(() => {
    const root = document.documentElement;
    if (darkMode) { root.setAttribute("data-theme", "dark"); localStorage.setItem("sb_theme", "dark"); }
    else { root.removeAttribute("data-theme"); localStorage.setItem("sb_theme", "light"); }
  }, [darkMode]);

  // Nothing about the signed-in user is read from browser storage. The session
  // (including the role) is rebuilt from Supabase on load; see the effect below.
  const [screen, setScreen] = useState<Screen>(() => screenFromPath(window.location.pathname) ?? "landing");
  const [dir, setDir]                   = useState<"forward" | "back">("forward");
  const [transitioning, setTransitioning] = useState(false);
  const [currentUser, setCurrentUser]   = useState<UserSession | null>(null);
  const [authReady, setAuthReady]       = useState(false);
  const [deniedScreen, setDeniedScreen] = useState<Screen | null>(null);
  // The bank connection is a simulation (no real accounts). It starts empty.
  const [bankConnected, setBankConnected] = useState(false);
  const [txRevision, setTxRevision] = useState(0);
  const [connectedAccounts, setConnectedAccounts] = useState<ConnectedAccount[]>([]);
  const pending = useRef<Screen | null>(null);
  // Set when the visitor opened a "reset your password" email link.
  const [resetMode, setResetMode] = useState<"recovery" | "expired" | null>(RESET_LINK);

  useEffect(() => {
    let cancelled = false;

    restoreRemoteSession({ fromResetLink: RESET_LINK === "recovery" })
      .then((remote) => {
        if (cancelled || !remote) return;
        setCurrentUser(remote);
        setScreen((current) => {
          if (current === "landing" || current === "login" || current === "register") {
            return ADMIN_PANEL_ROLES.includes(remote.role) ? "adminDashboard" : "dashboard";
          }
          return current;
        });
      })
      .finally(() => {
        if (!cancelled) setAuthReady(true);
      });

    // If the session ends elsewhere (sign-out in another tab, expiry), return to login.
    const { data: listener } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setResetMode("recovery");
      if (event === "SIGNED_OUT") {
        setCurrentUser(null);
        setBankConnected(false);
        setConnectedAccounts([]);
        setScreen("login");
      }
    });

    return () => { cancelled = true; listener.subscription.unsubscribe(); };
  }, []);

  useEffect(() => {
    if (!currentUser?.userId) return;
    const saved = loadDemoConnection(currentUser.userId);
    if (saved) {
      setBankConnected(true);
      setConnectedAccounts([saved]);
    }
  }, [currentUser?.userId]);

  // Keep the address bar in step with public pages, and support Back/Forward.
  useEffect(() => {
    const path = SCREEN_TO_PATH[screen] ?? "/";
    if (window.location.pathname !== path) window.history.pushState({ screen }, "", path);
    // Each new page starts at the top (the landing page handles its own section scrolling).
    if (screen !== "landing") requestAnimationFrame(() => window.scrollTo({ top: 0, left: 0, behavior: "instant" }));
  }, [screen]);

  useEffect(() => {
    const onPop = () => {
      const target = screenFromPath(window.location.pathname);
      setScreen(target ?? (currentUser ? (ADMIN_PANEL_ROLES.includes(currentUser.role) ? "adminDashboard" : "dashboard") : "landing"));
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [currentUser]);

  const go = (s: Screen) => {
    setDir("forward");
    setTransitioning(true);
    setTimeout(() => { setScreen(s); setTransitioning(false); }, 200);
  };

  const navigate = (s: Screen) => {
    if (!currentUser) { go(s); return; }

    if (s === "landing" || s === "login" || s === "register") {
      go(ADMIN_PANEL_ROLES.includes(currentUser.role) ? "adminDashboard" : "dashboard");
      return;
    }

    // Admin-panel screen requested
    if (isAdminScreen(s)) {
      if (!ADMIN_PANEL_ROLES.includes(currentUser.role)) {
        setDeniedScreen(s); go("accessDenied"); return;
      }
      if (!canAccess(currentUser.role, s)) {
        setDeniedScreen(s); go("accessDenied"); return;
      }
    }

    if (transitioning || s === screen) return;
    if (isInfoScreen(s)) { go(s); return; }
    if (s === "dashboard" || s === "analytics") {
      setTxRevision((n) => n + 1);
    }
    setDir(DEPTH[s] >= DEPTH[screen] ? "forward" : "back");
    setTransitioning(true);
    pending.current = s;
    setTimeout(() => { setScreen(pending.current!); setTransitioning(false); }, 200);
  };

  const handleLoginSuccess = (user: UserSession) => {
    setCurrentUser(user);
    go(ADMIN_PANEL_ROLES.includes(user.role) ? "adminDashboard" : "dashboard");
  };

  const handleRegisterSuccess = (user: UserSession) => {
    setCurrentUser(user);
    go("onboarding");
  };

  const handleOnboardingComplete = () => {
    go("dashboard");
  };

  const handleProfileUpdate = (name: string) => {
    if (!currentUser) return;
    const [firstName = "", ...lastNameParts] = name.trim().split(/\s+/);
    const updated = {
      ...currentUser,
      name: name.trim(),
      firstName,
      lastName: lastNameParts.join(" "),
    };
    setCurrentUser(updated);
  };

  const handleLogout = () => {
    void signOutRemote();
    setCurrentUser(null);
    setBankConnected(false);
    setConnectedAccounts([]);
    setDir("back");
    setTransitioning(true);
    setTimeout(() => { setScreen("login"); setTransitioning(false); }, 200);
  };

  const unlinkDemoBank = () => {
    setBankConnected(false);
    setConnectedAccounts([]);
    if (currentUser?.userId) saveDemoConnection(currentUser.userId, false);
  };

  const handleBankConnected = (accounts: ConnectedAccount[]) => {
    setBankConnected(true);
    setConnectedAccounts(accounts);
    if (currentUser?.userId) saveDemoConnection(currentUser.userId, true);
  };
  const handleBankSkipped = () => {
    go("dashboard");
  };
  const handleDisconnect = (id: string) => {
    void (async () => {
      if (id === DEMO_ACCOUNT.id) {
        try {
          await removeDemoTransactions();
        } catch {
          /* still unlink the demo account */
        }
        setTxRevision((n) => n + 1);
      }
      unlinkDemoBank();
    })();
  };

  const cx = `transition-all duration-200 ease-in-out ${
    transitioning
      ? dir === "forward" ? "opacity-0 translate-x-4" : "opacity-0 -translate-x-4"
      : "opacity-100 translate-x-0"
  }`;

  if (!authReady) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center">
        <p className="text-sm text-[#64748B]">Loading SmartBudget…</p>
      </div>
    );
  }

  // ── Opened from a password-reset email: ask for the new password first ──────
  if (resetMode) {
    return (
      <ResetPassword
        mode={resetMode}
        email={currentUser?.email}
        onDone={() => {
          setResetMode(null);
          if (currentUser) go(ADMIN_PANEL_ROLES.includes(currentUser.role) ? "adminDashboard" : "dashboard");
          else go("login");
        }}
        onBackToSignIn={() => {
          const wasSignedIn = !!currentUser;
          setResetMode(null);
          if (wasSignedIn) handleLogout(); else go("login");
        }}
      />
    );
  }

  // ── Maintenance mode: everyone except staff sees a holding page ─────────────
  const isStaff = !!currentUser && ADMIN_PANEL_ROLES.includes(currentUser.role);
  if (settings.maintenance_mode && !isStaff && screen !== "login" && !isInfoScreen(screen)) {
    return (
      <MaintenanceScreen
        message={settings.maintenance_message}
        signedIn={!!currentUser}
        onSignIn={() => navigate("login")}
        onSignOut={handleLogout}
      />
    );
  }

  // ── Public pages (legal, contact, and the Help Center when signed out) ───────
  if (isInfoScreen(screen) || (screen === "helpCenter" && !currentUser)) {
    return (
      <div className={cx}>
        <PublicShell navigate={navigate} signedIn={!!currentUser}>
          {screen === "contact" ? (
            <Contact navigate={navigate} defaultName={currentUser?.name ?? ""} defaultEmail={currentUser?.email ?? ""} />
          ) : screen === "helpCenter" ? (
            <HelpCenter navigate={navigate} publicMode />
          ) : (
            <InfoPage page={screen as Exclude<InfoKey, "contact">} navigate={navigate} />
          )}
        </PublicShell>
      </div>
    );
  }

  // ── Unauthenticated ──────────────────────────────────────────────────────────
  if (!currentUser) {
    return (
      <div className={cx}>
        {screen !== "register" && screen !== "login" && <Landing navigate={navigate} />}
        {screen === "register" && <Register navigate={navigate} onSuccess={handleRegisterSuccess} signupsOpen={settings.signups_enabled} />}
        {screen === "login"    && <Login    navigate={navigate} onSuccess={handleLoginSuccess} />}
      </div>
    );
  }

  // ── Onboarding (authenticated new users) ─────────────────────────────────────
  if (screen === "onboarding") {
    return (
      <div className={cx}>
        <Onboarding onComplete={handleOnboardingComplete} />
      </div>
    );
  }

  // ── Access denied ────────────────────────────────────────────────────────────
  if (screen === "accessDenied") {
    return (
      <AccessDenied
        navigate={navigate}
        currentRole={currentUser.role}
        attemptedScreen={deniedScreen}
        isAdminUser={ADMIN_PANEL_ROLES.includes(currentUser.role)}
      />
    );
  }

  // ── Bank connect onboarding ──────────────────────────────────────────────────
  if (screen === "bankConnect" && currentUser.role === "user") {
    return (
      <div className={cx}>
        <BankConnect
          alreadyConnected={bankConnected}
          onComplete={handleBankConnected}
          onSkip={handleBankSkipped}
          onDisconnect={unlinkDemoBank}
        />
      </div>
    );
  }

  const userName = currentUser.name;

  // ── Admin-panel branch (superadmin / admin / support) ─────────────────────────
  if (ADMIN_PANEL_ROLES.includes(currentUser.role)) {
    return (
      <AdminLayout
        screen={screen}
        navigate={navigate}
        onLogout={handleLogout}
        userName={userName}
        userRole={currentUser.role}
        darkMode={darkMode}
        onToggleDark={() => setDarkMode((d) => !d)}
      >
        <div className={`${cx} ${screen === "adminAgent" ? "h-full" : ""}`} key={screen}>
          {screen === "adminDashboard"      && <AdminDashboard navigate={navigate} role={currentUser.role} />}
          {screen === "adminAgent"          && <Agent navigate={navigate} userName={userName} role={currentUser.role} />}
          {screen === "adminUsers"          && <AdminUsers currentUserRole={currentUser.role} currentUserEmail={currentUser.email} />}
          {screen === "adminRoles"          && <AdminRoles navigate={navigate} />}
          {screen === "adminReports"        && <AdminReports />}
          {screen === "adminContent"        && <AdminContent />}
          {screen === "adminSecurity"       && <AdminSecurityCenter navigate={navigate} />}
          {screen === "adminAuditLogs"      && <AdminAuditLogs />}
          {screen === "adminSystemSettings" && <AdminSystemSettings />}
        </div>
      </AdminLayout>
    );
  }

  // ── Regular user branch ──────────────────────────────────────────────────────
  return (
    <AppLayout
      screen={screen} navigate={navigate} onLogout={handleLogout}
      userName={userName} userRole="user"
      darkMode={darkMode} onToggleDark={() => setDarkMode((d) => !d)}
      assistantEnabled={settings.assistant_enabled}
      announcement={settings.announcement_enabled ? settings.announcement : ""}
    >
      {transitioning ? <PageSkeleton /> : (
        <div className={`${cx} ${screen === "agent" ? "h-full" : ""}`} key={screen}>
          {screen === "dashboard"    && <Dashboard navigate={navigate} userName={userName} userId={currentUser.userId} refreshKey={txRevision} />}
          {screen === "transactions" && <Transactions navigate={navigate} userId={currentUser.userId} />}
          {screen === "budget"       && <Budget navigate={navigate} />}
          {screen === "savings"      && <SavingsGoals navigate={navigate} />}
          {screen === "education"    && <EducationHub navigate={navigate} />}
          {screen === "analytics"    && <Analytics navigate={navigate} userId={currentUser.userId} refreshKey={txRevision} />}
          {screen === "agent"        && (settings.assistant_enabled ? <Agent navigate={navigate} userName={userName} role={currentUser.role} /> : (
            <div className="p-6 lg:p-8 max-w-xl">
              <h1 className="text-xl font-bold text-[#0F172A]">The AI agent is turned off</h1>
              <p className="text-sm text-[#64748B] mt-2">An administrator has switched the AI agent off for now. You can still add transactions yourself, browse Learn or visit the Help Center.</p>
              <div className="flex gap-2 mt-4">
                <button type="button" onClick={() => navigate("transactions")} className="text-sm font-semibold text-white bg-[#2563EB] px-4 py-2 rounded-xl">Transactions</button>
                <button type="button" onClick={() => navigate("helpCenter")} className="text-sm font-semibold text-[#2563EB] border border-[#BFDBFE] px-4 py-2 rounded-xl">Help Center</button>
              </div>
            </div>
          ))}
          {screen === "healthScore"  && <HealthScore navigate={navigate} />}
          {screen === "helpCenter"   && <HelpCenter navigate={navigate} />}
          {screen === "notifications" && <Notifications navigate={navigate} />}
          {screen === "settings"     && (
            <Settings
              navigate={navigate}
              onLogout={handleLogout}
              connectedAccounts={connectedAccounts}
              onDisconnect={handleDisconnect}
              onConnectMore={() => navigate("bankConnect")}
              currentUser={currentUser}
              onProfileUpdate={handleProfileUpdate}
            />
          )}
        </div>
      )}
    </AppLayout>
  );
}
