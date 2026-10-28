import { useEffect, useState } from "react";
import { DEFAULT_SETTINGS, fetchAppSettings, saveAppSettings, useAppSettings } from "../../lib/appSettings";
import type { AppSettings } from "../../lib/appSettings";
import { fetchActivityLog, formatDateTime } from "../../lib/admin";
import { SITE } from "../../lib/site";
import { Button, Card, Loadable, PageHeader, useLoader, useToast } from "../../components/admin/ui";

function Row({ title, desc, children }: { title: string; desc: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-start gap-3 py-4 border-t border-[#F1F5F9] first:border-t-0 first:pt-0">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-[#0F172A]">{title}</p>
        <p className="text-xs text-[#64748B] mt-0.5 leading-relaxed">{desc}</p>
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} onClick={() => onChange(!on)}
      className={`w-11 h-6 rounded-full relative transition-colors ${on ? "bg-[#2563EB]" : "bg-[#E2E8F0]"}`}>
      <span className={`w-5 h-5 bg-white rounded-full absolute top-0.5 transition-all shadow ${on ? "left-5" : "left-0.5"}`} />
    </button>
  );
}

async function load() {
  const [settings, history] = await Promise.all([
    fetchAppSettings(),
    fetchActivityLog({ kind: "admin", search: "settings_changed", limit: 5 }).catch(() => ({ total: 0, rows: [] })),
  ]);
  return { settings, history };
}

export default function AdminSystemSettings() {
  const { data, loading, error, reload } = useLoader(load);
  const { refresh: refreshGlobal } = useAppSettings();
  const [draft, setDraft] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [saving, setSaving] = useState(false);
  const [confirmMaintenance, setConfirmMaintenance] = useState(false);
  const toast = useToast();

  useEffect(() => { if (data) setDraft(data.settings); }, [data]);

  const saved = data?.settings ?? DEFAULT_SETTINGS;
  const changes = (Object.keys(draft) as (keyof AppSettings)[]).filter((k) => draft[k] !== saved[k]);
  const set = <K extends keyof AppSettings>(k: K, v: AppSettings[K]) => setDraft((d) => ({ ...d, [k]: v }));

  const save = async () => {
    if (draft.maintenance_mode && !saved.maintenance_mode && !confirmMaintenance) { setConfirmMaintenance(true); return; }
    setConfirmMaintenance(false);
    setSaving(true);
    try {
      const patch: Partial<AppSettings> = {};
      for (const k of changes) (patch as Record<string, unknown>)[k] = draft[k];
      await saveAppSettings(patch);
      await refreshGlobal();
      reload();
      toast.show("Settings saved. They apply to the live site straight away.");
    } catch (e) {
      toast.show(e instanceof Error ? e.message : "Could not save.");
    } finally {
      setSaving(false);
    }
  };

  const supabaseHost = (() => { try { return new URL(import.meta.env.VITE_SUPABASE_URL).host; } catch { return "not configured"; } })();

  return (
    <div className="max-w-[900px]">
      {toast.node}
      <PageHeader title="Site Settings" sub="Switches that change the live site for everyone. Only Super Admins can change them, and every change is recorded."
        actions={<>
          {changes.length > 0 && <Button small variant="ghost" onClick={() => setDraft(saved)} disabled={saving}>Discard</Button>}
          <Button variant="primary" onClick={() => void save()} disabled={!changes.length || saving}>{saving ? "Saving…" : changes.length ? `Save ${changes.length} change${changes.length === 1 ? "" : "s"}` : "Saved"}</Button>
        </>} />

      {confirmMaintenance && (
        <div className="mb-4 rounded-2xl border border-[#FDE68A] bg-[#FFFBEB] p-4 text-sm text-[#92400E]" role="alertdialog">
          <p className="font-semibold">Turn on maintenance mode?</p>
          <p className="mt-1">Everyone except staff will see the maintenance message and won't be able to use SmartBudget until you turn it off.</p>
          <div className="flex gap-2 mt-3">
            <Button small variant="primary" onClick={() => void save()}>Yes, turn it on</Button>
            <Button small variant="ghost" onClick={() => setConfirmMaintenance(false)}>Cancel</Button>
          </div>
        </div>
      )}

      <Loadable loading={loading} error={error} onRetry={reload}>
        <div className="space-y-5">
          <Card title="Access">
            <Row title="Maintenance mode" desc="Shows a holding page to everyone except staff. Use it while you fix a problem or update the database.">
              <Toggle on={draft.maintenance_mode} onChange={(v) => set("maintenance_mode", v)} label="Maintenance mode" />
            </Row>
            {draft.maintenance_mode && (
              <div className="pb-4">
                <label htmlFor="maint-msg" className="text-xs font-semibold text-[#475569]">Message shown to visitors</label>
                <textarea id="maint-msg" rows={2} maxLength={300} value={draft.maintenance_message} onChange={(e) => set("maintenance_message", e.target.value)}
                  className="mt-1 w-full border border-[#E2E8F0] rounded-xl px-3 py-2 text-sm outline-none focus:border-[#2563EB]" />
              </div>
            )}
            <Row title="Allow new sign-ups" desc="When off, the sign-up page says sign-ups are closed and the database refuses new accounts. Existing users can still sign in.">
              <Toggle on={draft.signups_enabled} onChange={(v) => set("signups_enabled", v)} label="Allow new sign-ups" />
            </Row>
          </Card>

          <Card title="Features">
            <Row title="AI agent for users" desc="Shows the AI Agent page to users. Turn off to hide it (staff keep their agent). Needs the agent Edge Function and a Gemini key, see the README.">
              <Toggle on={draft.assistant_enabled} onChange={(v) => set("assistant_enabled", v)} label="AI agent" />
            </Row>
            <Row title="AI messages per person" desc="Keeps the free Gemini quota fair. Staff get three times these limits. Users who hit a limit are told when they can try again.">
              <div className="flex gap-3">
                {([["agent_hourly_limit", "Per hour"], ["agent_daily_limit", "Per day"]] as const).map(([k, label]) => (
                  <label key={k} className="text-xs font-semibold text-[#475569]">
                    {label}
                    <input type="number" min={1} max={5000} step={1} value={draft[k]}
                      onChange={(e) => set(k, Math.max(1, Math.min(5000, Math.round(Number(e.target.value) || 1))))}
                      className="mt-1 block w-24 border border-[#E2E8F0] rounded-xl px-3 py-2 text-sm outline-none focus:border-[#2563EB]" />
                  </label>
                ))}
              </div>
            </Row>
          </Card>

          <Card title="Announcement banner">
            <Row title="Show an announcement" desc="A message bar at the top of the app for every signed-in user, e.g. planned downtime or a new feature. People can dismiss it.">
              <Toggle on={draft.announcement_enabled} onChange={(v) => set("announcement_enabled", v)} label="Show announcement" />
            </Row>
            <div className="pb-1">
              <label htmlFor="ann" className="text-xs font-semibold text-[#475569]">Announcement text</label>
              <textarea id="ann" rows={2} maxLength={300} value={draft.announcement} onChange={(e) => set("announcement", e.target.value)}
                placeholder="e.g. New: export your data as a PDF from Settings › Privacy."
                className="mt-1 w-full border border-[#E2E8F0] rounded-xl px-3 py-2 text-sm outline-none focus:border-[#2563EB]" />
              <p className="text-[11px] text-[#94A3B8] mt-1">{draft.announcement.length}/300</p>
              {draft.announcement_enabled && draft.announcement.trim() && (
                <div className="mt-2 bg-[#EFF6FF] border border-[#BFDBFE] rounded-xl px-3 py-2 text-sm text-[#1E40AF]">Preview: {draft.announcement}</div>
              )}
            </div>
          </Card>

          <Card title="Platform information">
            <dl className="grid sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
              <div><dt className="text-xs text-[#94A3B8]">Database</dt><dd className="text-[#0F172A] font-mono text-xs break-all">{supabaseHost}</dd></div>
              <div><dt className="text-xs text-[#94A3B8]">Site address</dt><dd className="text-[#0F172A] break-all">{window.location.origin}</dd></div>
              <div><dt className="text-xs text-[#94A3B8]">Support email</dt><dd className="text-[#0F172A] break-all">{SITE.supportEmail}</dd></div>
              <div><dt className="text-xs text-[#94A3B8]">Backups</dt><dd className="text-[#0F172A]">Managed by Supabase (Database › Backups in the Supabase dashboard)</dd></div>
            </dl>
          </Card>

          <Card title="Recent setting changes">
            {data?.history.rows.length ? (
              <ul className="space-y-2.5">
                {data.history.rows.map((r, i) => (
                  <li key={i} className="text-sm">
                    <span className="font-medium text-[#0F172A]">{r.who}</span>{" "}
                    <span className="text-[#475569]">changed {Object.keys(r.details ?? {}).map((k) => k.replace(/_/g, " ")).join(", ")}</span>
                    <span className="block text-xs text-[#94A3B8]">{formatDateTime(r.created_at)}</span>
                  </li>
                ))}
              </ul>
            ) : <p className="text-sm text-[#94A3B8]">No changes yet.</p>}
          </Card>
        </div>
      </Loadable>
    </div>
  );
}
