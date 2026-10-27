// Site-wide switches stored in public.app_settings and controlled from
// Admin › System Settings. Everyone can read them; only a superadmin can change
// them (through the checked admin_update_settings database function).
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { supabase } from "./supabase";

export type AppSettings = {
  maintenance_mode: boolean;
  maintenance_message: string;
  signups_enabled: boolean;
  assistant_enabled: boolean;
  announcement_enabled: boolean;
  announcement: string;
};

export const DEFAULT_SETTINGS: AppSettings = {
  maintenance_mode: false,
  maintenance_message: "SmartBudget is down for a short maintenance break. Please try again soon.",
  signups_enabled: true,
  assistant_enabled: true,
  announcement_enabled: false,
  announcement: "",
};

export async function fetchAppSettings(): Promise<AppSettings> {
  const { data, error } = await supabase.from("app_settings").select("key, value");
  if (error || !data) return { ...DEFAULT_SETTINGS };
  const out: Record<string, unknown> = { ...DEFAULT_SETTINGS };
  for (const row of data as { key: string; value: unknown }[]) {
    if (row.key in DEFAULT_SETTINGS && typeof row.value === typeof (DEFAULT_SETTINGS as Record<string, unknown>)[row.key]) {
      out[row.key] = row.value;
    }
  }
  return out as AppSettings;
}

export async function saveAppSettings(changes: Partial<AppSettings>): Promise<void> {
  const { error } = await supabase.rpc("admin_update_settings", { p_settings: changes });
  if (error) {
    console.error("[settings]", error.message);
    if (error.code === "42501") throw new Error("Only a Super Admin can change site settings.");
    throw new Error("Could not save the settings. Please try again.");
  }
}

type Ctx = { settings: AppSettings; loaded: boolean; refresh: () => Promise<void> };
const SettingsContext = createContext<Ctx>({ settings: DEFAULT_SETTINGS, loaded: false, refresh: async () => {} });

export function AppSettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [loaded, setLoaded] = useState(false);
  const refresh = useCallback(async () => {
    setSettings(await fetchAppSettings());
    setLoaded(true);
  }, []);
  useEffect(() => {
    void refresh();
    // Pick up changes made by an administrator while the app is open.
    const t = setInterval(() => { void refresh(); }, 120_000);
    return () => clearInterval(t);
  }, [refresh]);
  return <SettingsContext.Provider value={{ settings, loaded, refresh }}>{children}</SettingsContext.Provider>;
}

export function useAppSettings(): Ctx {
  return useContext(SettingsContext);
}
