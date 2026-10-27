// Lesson progress (saved to the user's account) and the content visibility
// chosen by administrators (Admin › Content).
import { supabase } from "./supabase";

export type Progress = { started: number[]; completed: number[] };
export type ContentSetting = { hidden: boolean; featured: boolean };

const LOCAL_KEY = "sb_edu_progress";

function loadLocal(): Progress {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    if (raw) {
      const p = JSON.parse(raw);
      return { started: Array.isArray(p.started) ? p.started : [], completed: Array.isArray(p.completed) ? p.completed : [] };
    }
  } catch { /* ignore */ }
  return { started: [], completed: [] };
}

/** Loads progress from the account. Older browser-only progress is moved into the account once. */
export async function fetchProgress(): Promise<Progress> {
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth.user?.id;
  if (!uid) return loadLocal();
  const { data, error } = await supabase.from("lesson_progress").select("lesson_id, completed_at");
  if (error) return loadLocal();
  const rows = (data ?? []) as { lesson_id: number; completed_at: string | null }[];
  const progress: Progress = {
    started: rows.map((r) => r.lesson_id),
    completed: rows.filter((r) => r.completed_at).map((r) => r.lesson_id),
  };
  const local = loadLocal();
  const missing = local.started.filter((id) => !progress.started.includes(id));
  if (missing.length) {
    await supabase.from("lesson_progress").insert(missing.map((id) => ({
      user_id: uid, lesson_id: id, completed_at: local.completed.includes(id) ? new Date().toISOString() : null,
    })));
    progress.started.push(...missing);
    progress.completed.push(...missing.filter((id) => local.completed.includes(id)));
  }
  try { localStorage.removeItem(LOCAL_KEY); } catch { /* ignore */ }
  return progress;
}

export async function markStarted(lessonId: number): Promise<void> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return;
  await supabase.from("lesson_progress").upsert(
    { user_id: auth.user.id, lesson_id: lessonId },
    { onConflict: "user_id,lesson_id", ignoreDuplicates: true },
  );
}

export async function markCompleted(lessonId: number): Promise<void> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return;
  await supabase.from("lesson_progress").upsert(
    { user_id: auth.user.id, lesson_id: lessonId, completed_at: new Date().toISOString() },
    { onConflict: "user_id,lesson_id" },
  );
}

/** content_key → setting, e.g. "lesson:3" → { hidden: true, featured: false }. */
export async function fetchContentSettings(): Promise<Record<string, ContentSetting>> {
  const { data, error } = await supabase.from("content_settings").select("content_key, hidden, featured");
  if (error || !data) return {};
  const out: Record<string, ContentSetting> = {};
  for (const r of data as { content_key: string; hidden: boolean; featured: boolean }[]) {
    out[r.content_key] = { hidden: r.hidden, featured: r.featured };
  }
  return out;
}
