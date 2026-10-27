import { useState } from "react";
import { BOOKS, LESSONS, VIDEOS } from "../../content/education";
import { fetchLessonStats, setContentVisibility } from "../../lib/admin";
import { fetchContentSettings } from "../../lib/education";
import type { ContentSetting } from "../../lib/education";
import { Card, Loadable, PageHeader, RefreshIcon, Button, Tabs, useLoader, useToast } from "../../components/admin/ui";

type Tab = "lessons" | "videos" | "books";
type Item = { key: string; title: string; meta: string; link?: string; stats?: { started: number; completed: number } };

async function load() {
  const [stats, settings] = await Promise.all([fetchLessonStats(), fetchContentSettings()]);
  return { stats, settings };
}

function Switch({ on, onChange, label, disabled }: { on: boolean; onChange: () => void; label: string; disabled?: boolean }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} onClick={onChange} disabled={disabled}
      className={`w-10 h-6 rounded-full relative transition-colors shrink-0 disabled:opacity-50 ${on ? "bg-[#2563EB]" : "bg-[#E2E8F0]"}`}>
      <span className={`w-5 h-5 bg-white rounded-full absolute top-0.5 transition-all shadow ${on ? "left-[18px]" : "left-0.5"}`} />
    </button>
  );
}

export default function AdminContent() {
  const { data, loading, refreshing, error, reload } = useLoader(load);
  const [tab, setTab] = useState<Tab>("lessons");
  const [local, setLocal] = useState<Record<string, ContentSetting>>({});
  const [busy, setBusy] = useState("");
  const toast = useToast();

  const settings = { ...(data?.settings ?? {}), ...local };
  const get = (k: string): ContentSetting => settings[k] ?? { hidden: false, featured: false };

  const items: Record<Tab, Item[]> = {
    lessons: LESSONS.map((l) => ({ key: `lesson:${l.id}`, title: l.title, meta: `${l.difficulty} · ${l.duration} · ${l.category}`, stats: data?.stats[String(l.id)] ?? { started: 0, completed: 0 } })),
    videos: VIDEOS.map((v) => ({ key: `video:${v.id}`, title: v.title, meta: `${v.channel} · ${v.length}`, link: `https://www.youtube.com/watch?v=${v.id}` })),
    books: BOOKS.map((b) => ({ key: `book:${b.olKey.replace("/works/", "")}`, title: b.title, meta: b.author, link: `https://openlibrary.org${b.olKey}` })),
  };

  const update = async (item: Item, change: Partial<ContentSetting>) => {
    const next = { ...get(item.key), ...change };
    setBusy(item.key);
    try {
      await setContentVisibility(item.key, next.hidden, next.featured, item.title);
      setLocal((l) => ({ ...l, [item.key]: next }));
      toast.show(`"${item.title}" is now ${next.hidden ? "hidden" : "visible"}${next.featured ? " and featured" : ""}`);
    } catch (e) {
      toast.show(e instanceof Error ? e.message : "Could not save.");
    } finally {
      setBusy("");
    }
  };

  const hiddenCount = (t: Tab) => items[t].filter((i) => get(i.key).hidden).length;

  return (
    <div className="max-w-[1100px]">
      {toast.node}
      <PageHeader title="Content"
        sub="Everything in the Education Hub. Hide an item to remove it for all users, or feature it to show it first. Changes apply straight away and are recorded in the activity log."
        actions={<Button small onClick={reload} disabled={refreshing}><RefreshIcon spinning={refreshing} /> Refresh</Button>} />
      <Loadable loading={loading} error={error} onRetry={reload}>
        <div className="space-y-4">
          <Tabs value={tab} onChange={setTab} items={[
            { id: "lessons", label: `Lessons (${LESSONS.length})` },
            { id: "videos", label: `Videos (${VIDEOS.length})` },
            { id: "books", label: `Books (${BOOKS.length})` },
          ]} />
          <Card title={tab === "lessons" ? "Lessons" : tab === "videos" ? "Videos" : "Books"}
            sub={`${items[tab].length - hiddenCount(tab)} visible · ${hiddenCount(tab)} hidden`}>
            <ul className="divide-y divide-[#F1F5F9]">
              {items[tab].map((item) => {
                const st = get(item.key);
                const rate = item.stats && item.stats.started ? Math.round((item.stats.completed / item.stats.started) * 100) : null;
                return (
                  <li key={item.key} className={`py-3.5 flex flex-col sm:flex-row sm:items-center gap-3 ${st.hidden ? "opacity-60" : ""}`}>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-[#0F172A] flex flex-wrap items-center gap-2">
                        {item.title}
                        {st.featured && <span className="text-[10px] font-bold uppercase text-[#B45309] bg-[#FEF3C7] px-2 py-0.5 rounded-full">Featured</span>}
                        {st.hidden && <span className="text-[10px] font-bold uppercase text-[#64748B] bg-[#F1F5F9] px-2 py-0.5 rounded-full">Hidden</span>}
                      </p>
                      <p className="text-xs text-[#94A3B8] mt-0.5 capitalize">{item.meta}</p>
                      {item.stats && (
                        <p className="text-xs text-[#475569] mt-1">
                          {item.stats.started} started · {item.stats.completed} completed{rate !== null ? ` · ${rate}% completion` : ""}
                        </p>
                      )}
                      {item.link && <a href={item.link} target="_blank" rel="noopener noreferrer" className="text-xs text-[#2563EB] hover:underline">Open ↗</a>}
                    </div>
                    <div className="flex items-center gap-5 shrink-0">
                      <label className="flex items-center gap-2 text-xs text-[#475569]">
                        Visible
                        <Switch on={!st.hidden} label={`Show ${item.title}`} disabled={busy === item.key} onChange={() => void update(item, { hidden: !st.hidden })} />
                      </label>
                      <label className="flex items-center gap-2 text-xs text-[#475569]">
                        Featured
                        <Switch on={st.featured} label={`Feature ${item.title}`} disabled={busy === item.key || st.hidden} onChange={() => void update(item, { featured: !st.featured })} />
                      </label>
                    </div>
                  </li>
                );
              })}
            </ul>
          </Card>
          <p className="text-xs text-[#94A3B8] text-center">To add new lessons, videos or books, edit <code>src/content/education.ts</code> and push the change; it appears here automatically.</p>
        </div>
      </Loadable>
    </div>
  );
}
