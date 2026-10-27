import { createContext, useContext, useState, useCallback } from "react";
import type { ReactNode } from "react";
import { fetchAllUsers, sendPasswordReset, setUserRole, setUserStatus } from "../lib/auth";
import type { UserRecord, UserRole, UserStatus } from "../lib/auth";
import { logAdminAction } from "../lib/admin";

// The user list comes from the database. Row Level Security returns every user
// only to support/admin/superadmin; role and status changes go through checked
// database functions, so this context cannot grant anything the database refuses.

type UsersContextValue = {
  users:         UserRecord[];
  loading:       boolean;
  error:         string;
  /** Loads (or reloads) the user list. Call it from screens that show users. */
  refresh:       () => Promise<void>;
  setStatus:     (id: string, status: UserStatus) => Promise<void>;
  setRole:       (id: string, role: UserRole) => Promise<void>;
  /** Sends the user a password reset email (admins never see or set passwords). */
  resetPassword: (email: string) => Promise<void>;
};

const UsersContext = createContext<UsersContextValue | null>(null);

export function UsersProvider({ children }: { children: ReactNode }) {
  const [users, setUsers]     = useState<UserRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setUsers(await fetchAllUsers());
    } catch (err) {
      setError(err instanceof Error ? err.message : "We could not load the users.");
    } finally {
      setLoading(false);
    }
  }, []);

  const setStatus = useCallback(async (id: string, status: UserStatus) => {
    await setUserStatus(id, status);
    setUsers(await fetchAllUsers());
  }, []);

  const setRole = useCallback(async (id: string, role: UserRole) => {
    await setUserRole(id, role);
    setUsers(await fetchAllUsers());
  }, []);

  const resetPassword = useCallback(async (email: string) => {
    await sendPasswordReset(email);
    await logAdminAction("password_reset_sent", email);
  }, []);

  return (
    <UsersContext.Provider value={{ users, loading, error, refresh, setStatus, setRole, resetPassword }}>
      {children}
    </UsersContext.Provider>
  );
}

export function useUsers(): UsersContextValue {
  const ctx = useContext(UsersContext);
  if (!ctx) throw new Error("useUsers must be used inside <UsersProvider>");
  return ctx;
}
