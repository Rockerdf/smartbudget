import type { User } from "@supabase/supabase-js";
import { supabase } from "./supabase";

// ─────────────────────────────────────────────────────────────────────────────
// Authentication and account helpers.
//
// Security notes
//  - Passwords are handled ONLY by Supabase Auth (bcrypt hashing). This file
//    never stores, compares or logs a password.
//  - The user's role is read from the database (public.users) every time a
//    session is restored. It is never read from localStorage, so editing
//    browser storage cannot grant access. The database also enforces roles
//    with Row Level Security and checked functions (see supabase/schema.sql).
// ─────────────────────────────────────────────────────────────────────────────

export type UserRole   = "user" | "support" | "admin" | "superadmin";
export type UserStatus = "active" | "suspended";

/** A row of the users table as shown on the admin Users screen. */
export type UserRecord = {
  id:           string;
  name:         string;
  email:        string;
  role:         UserRole;
  status:       UserStatus;
  registeredAt: string;   // ISO date "YYYY-MM-DD" or ""
  lastLogin:    string;   // ISO date "YYYY-MM-DD" or ""
};

export type UserSession = {
  userId: string;
  firstName: string;
  lastName: string;
  name: string;
  email: string;
  role: UserRole;
  loginTimestamp: string;
  rememberMe: boolean;
};

export const MIN_PASSWORD_LENGTH = 8;

// Only a harmless preference is kept in the browser (never a role or password).
const REMEMBER_KEY = "sb_remember";          // "1" | "0"
const MARKER_KEY   = "sb_session_active";    // sessionStorage marker

export function normaliseRole(r: unknown): UserRole {
  if (r === "superadmin" || r === "admin" || r === "support") return r;
  return "user";
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim());
}

function authErrorMessage(error: unknown, fallback: string): string {
  if (error && typeof error === "object" && "message" in error) {
    const lower = String((error as { message: string }).message).toLowerCase();
    if (lower.includes("already registered") || lower.includes("already been registered")) {
      return "An account with this email already exists.";
    }
    if (lower.includes("invalid login credentials")) {
      return "Incorrect email or password. Please check your details and try again.";
    }
    if (lower.includes("email not confirmed")) {
      return "Please confirm your email before signing in. Check your inbox.";
    }
    if (lower.includes("password") && lower.includes("characters")) {
      return `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
    }
    if (lower.includes("rate limit") || lower.includes("too many")) {
      return "Too many attempts. Please wait a minute and try again.";
    }
    if (lower.includes("failed to fetch") || lower.includes("network")) {
      return "We could not reach the server. Check your connection and try again.";
    }
    // Do not show raw technical text to users; keep it in the console only.
    console.error("[auth]", (error as { message: string }).message);
  }
  return fallback;
}

function splitName(name: string): { firstName: string; lastName: string } {
  const [firstName = "", ...rest] = name.trim().split(/\s+/);
  return { firstName, lastName: rest.join(" ") };
}

function dateOnly(value: unknown): string {
  return typeof value === "string" && value ? value.slice(0, 10) : "";
}

// ── Sign-in event log (shown to admins in the Security Center) ───────────────

/** Records a sign-in related event. Never blocks or breaks the sign-in flow. */
export function recordAuthEvent(
  event: "login_failed" | "password_reset_requested" | "logout" | "suspended_login_blocked",
  email?: string,
): Promise<void> {
  return Promise.resolve(supabase.rpc("record_auth_event", { p_event: event, p_email: email ?? null }))
    .then(() => undefined)
    .catch(() => undefined);
}

// ── Session ──────────────────────────────────────────────────────────────────

async function buildSession(user: User, rememberMe: boolean): Promise<UserSession> {
  const email = (user.email ?? "").trim().toLowerCase();

  // Role and status come from the database, under Row Level Security.
  const { data: profile, error } = await supabase
    .from("users")
    .select("name, role, status")
    .eq("id", user.id)
    .maybeSingle();

  if (error) {
    console.error("[auth] profile load failed:", error.message);
    throw new Error("We could not load your account. Please try again.");
  }
  if (!profile) {
    throw new Error("Your account profile is missing. Please contact support.");
  }
  if (profile.status === "suspended") {
    await recordAuthEvent("suspended_login_blocked");
    await supabase.auth.signOut();
    throw new Error("Your account has been suspended. Please contact support for assistance.");
  }

  let name = typeof profile.name === "string" ? profile.name.trim() : "";
  if (!name && typeof user.user_metadata?.full_name === "string") {
    name = user.user_metadata.full_name.trim();
  }
  if (!name) name = email.split("@")[0] || "User";

  return {
    userId: user.id,
    ...splitName(name),
    name,
    email,
    role: normaliseRole(profile.role),
    loginTimestamp: new Date().toISOString(),
    rememberMe,
  };
}

function setRememberPreference(rememberMe: boolean) {
  try {
    localStorage.setItem(REMEMBER_KEY, rememberMe ? "1" : "0");
    if (rememberMe) sessionStorage.removeItem(MARKER_KEY);
    else sessionStorage.setItem(MARKER_KEY, "true");
  } catch {
    /* storage blocked: ignore */
  }
}

// ── Sign up / sign in / sign out ─────────────────────────────────────────────

export type SignUpResult =
  | { status: "signed_in"; session: UserSession }
  | { status: "confirm_email" };

export async function signUpWithEmail(
  name: string,
  email: string,
  password: string
): Promise<SignUpResult> {
  const trimmedName  = name.trim();
  const trimmedEmail = email.trim().toLowerCase();

  // The server (Supabase) also enforces these; checking here gives clear messages.
  if (!trimmedName) throw new Error("Please enter your full name.");
  if (!isValidEmail(trimmedEmail)) throw new Error("Enter a valid email address.");
  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
  }

  const { data, error } = await supabase.auth.signUp({
    email: trimmedEmail,
    password,
    options: { data: { full_name: trimmedName } },
  });

  if (error) {
    // The database refuses new accounts while an administrator has closed sign-ups.
    if (/database error saving new user/i.test(error.message)) {
      throw new Error("New sign-ups are currently closed. Please try again later.");
    }
    throw new Error(authErrorMessage(error, "Could not create your account."));
  }
  if (!data.user || !data.session) return { status: "confirm_email" };

  setRememberPreference(true);
  return { status: "signed_in", session: await buildSession(data.user, true) };
}

export async function signInWithEmail(
  email: string,
  password: string,
  rememberMe = true
): Promise<UserSession> {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim().toLowerCase(),
    password,
  });

  if (error) {
    void recordAuthEvent("login_failed", email);
    throw new Error(authErrorMessage(error, "Could not sign in."));
  }
  if (!data.user) throw new Error("Could not sign in.");

  setRememberPreference(rememberMe);
  const session = await buildSession(data.user, rememberMe);

  // Records the sign-in time for this user only (checked function in the database).
  const { error: loginError } = await supabase.rpc("touch_last_login");
  if (loginError) console.error("[auth] last_login not recorded:", loginError.message);

  return session;
}

export async function signOutRemote(): Promise<void> {
  try {
    localStorage.removeItem(REMEMBER_KEY);
    sessionStorage.removeItem(MARKER_KEY);
  } catch {
    /* ignore */
  }
  await recordAuthEvent("logout");
  await supabase.auth.signOut();
}

/** Rebuilds the session from Supabase on page load. Returns null if signed out. */
export async function restoreRemoteSession(opts: { fromResetLink?: boolean } = {}): Promise<UserSession | null> {
  const { data } = await supabase.auth.getSession();
  if (!data.session?.user) return null;
  if (opts.fromResetLink) {
    try { sessionStorage.setItem(MARKER_KEY, "true"); } catch { /* ignore */ }
  }

  // "Remember me" unticked: end the session when the browser was closed.
  let rememberMe = true;
  try {
    rememberMe = localStorage.getItem(REMEMBER_KEY) !== "0";
    if (!rememberMe && sessionStorage.getItem(MARKER_KEY) !== "true") {
      await supabase.auth.signOut();
      localStorage.removeItem(REMEMBER_KEY);
      return null;
    }
  } catch {
    /* ignore */
  }

  try {
    return await buildSession(data.session.user, rememberMe);
  } catch {
    return null;
  }
}

/** Sets a new password for the signed-in account (used after opening a reset link). */
export async function setNewPassword(next: string): Promise<void> {
  if (next.length < MIN_PASSWORD_LENGTH) throw new Error(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
  const { error } = await supabase.auth.updateUser({ password: next });
  if (error) {
    const m = String(error.message).toLowerCase();
    if (m.includes("different from the old")) throw new Error("Please choose a password different from your old one.");
    if (m.includes("session") || m.includes("jwt") || m.includes("expired")) throw new Error("This reset link has expired. Please request a new one.");
    if (m.includes("weak") || m.includes("pwned")) throw new Error("That password is too easy to guess. Please choose a stronger one.");
    throw new Error(authErrorMessage(error, "Could not save your new password. Please try again."));
  }
}

export async function sendPasswordReset(email: string): Promise<void> {
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
    redirectTo: window.location.origin,
  });
  if (error) throw new Error(authErrorMessage(error, "Could not send a reset email."));
  void recordAuthEvent("password_reset_requested", email);
}

// ── Own profile ──────────────────────────────────────────────────────────────

/** Updates the signed-in user's display name (the only column users may change). */
export async function updateOwnName(name: string): Promise<void> {
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Please enter your name.");
  if (trimmed.length > 100) throw new Error("Name is too long.");

  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error("You need to sign in again.");

  const { data, error } = await supabase
    .from("users")
    .update({ name: trimmed })
    .eq("id", auth.user.id)
    .select("id");

  if (error) {
    console.error("[auth] name update failed:", error.message);
    throw new Error("Something went wrong. Please try again.");
  }
  if (!data || data.length === 0) throw new Error("You are not allowed to do this.");
}

/** Changes the password after re-checking the current one. */
export async function changePassword(current: string, next: string): Promise<void> {
  if (next.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`New password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
  }
  const { data: auth } = await supabase.auth.getUser();
  const email = auth.user?.email;
  if (!email) throw new Error("You need to sign in again.");

  const { error: checkError } = await supabase.auth.signInWithPassword({ email, password: current });
  if (checkError) throw new Error("Your current password is incorrect.");

  const { error } = await supabase.auth.updateUser({ password: next });
  if (error) throw new Error(authErrorMessage(error, "Could not update your password."));
}

/** Signs this account out on every other device. */
export async function signOutOtherDevices(): Promise<void> {
  const { error } = await supabase.auth.signOut({ scope: "others" });
  if (error) throw new Error(authErrorMessage(error, "Could not sign out other devices."));
}

/** Permanently deletes the signed-in user's account and all of their data. */
export async function deleteOwnAccount(): Promise<void> {
  const { error } = await supabase.rpc("delete_my_account");
  if (error) {
    console.error("[auth] account deletion failed:", error.message);
    throw new Error("We could not delete your account. Please try again.");
  }
  await signOutRemote();
}

// ── Administrator functions (enforced again by the database) ─────────────────

type UserRow = {
  id: string; name: string | null; email: string; role: string; status: string;
  last_login: string | null; created_at: string;
};

/** Lists users. Row Level Security returns every row only to support/admin/superadmin. */
export async function fetchAllUsers(): Promise<UserRecord[]> {
  const { data, error } = await supabase
    .from("users")
    .select("id, name, email, role, status, last_login, created_at")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[admin] user list failed:", error.message);
    throw new Error("We could not load the users. Please try again.");
  }
  return (data as UserRow[]).map((u) => ({
    id: u.id,
    name: u.name ?? "",
    email: u.email,
    role: normaliseRole(u.role),
    status: u.status === "suspended" ? "suspended" : "active",
    registeredAt: dateOnly(u.created_at),
    lastLogin: dateOnly(u.last_login),
  }));
}

function adminErrorMessage(error: { message: string; code?: string }): string {
  console.error("[admin]", error.message);
  if (error.code === "42501") return "You are not allowed to do this.";
  if (error.message.includes("last superadmin")) return "You cannot remove the last superadmin.";
  return "Something went wrong. Please try again.";
}

/** Superadmin only (checked in the database). */
export async function setUserRole(id: string, role: UserRole): Promise<void> {
  const { error } = await supabase.rpc("admin_set_role", { target: id, new_role: role });
  if (error) throw new Error(adminErrorMessage(error));
}

/** Admin or superadmin (checked in the database). */
export async function setUserStatus(id: string, status: UserStatus): Promise<void> {
  const { error } = await supabase.rpc("admin_set_status", { target: id, new_status: status });
  if (error) throw new Error(adminErrorMessage(error));
}
