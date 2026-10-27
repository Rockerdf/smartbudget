import { useEffect, useState } from "react";
import type { Screen } from "../App";
import { BOOKS as ALL_BOOKS, CATEGORIES, LESSONS as ALL_LESSONS, RESOURCES, VIDEOS as ALL_VIDEOS } from "../content/education";
import { fetchContentSettings, fetchProgress, markCompleted, markStarted } from "../lib/education";
import type { ContentSetting } from "../lib/education";
import type { Difficulty, Lesson, Video } from "../content/education";
import { fetchGoals } from "../lib/goals";
import { fetchBudget } from "../lib/budgets";

type Section = "lessons" | "videos" | "books" | "help";

const SECTIONS: { id: Section; label: string; icon: string }[] = [
  { id: "lessons", label: "Lessons", icon: "📖" },
  { id: "videos",  label: "Videos",  icon: "🎬" },
  { id: "books",   label: "Books",   icon: "📚" },
  { id: "help",    label: "Free help", icon: "🤝" },
];

const difficultyStyle: Record<Difficulty, { bg: string; text: string }> = {
  Beginner:     { bg: "#DCFCE7", text: "#16A34A" },
  Intermediate: { bg: "#FEF3C7", text: "#D97706" },
  Advanced:     { bg: "#FEE2E2", text: "#DC2626" },
};

type Progress = { started: number[]; completed: number[] };

/** Applies the admin's hide/feature choices: hidden items are removed, featured ones come first. */
function arrange<T>(items: T[], keyOf: (t: T) => string, settings: Record<string, ContentSetting>): (T & { featured: boolean })[] {
  return items
    .filter((t) => !settings[keyOf(t)]?.hidden)
    .map((t) => ({ ...t, featured: !!settings[keyOf(t)]?.featured }))
    .sort((x, y) => Number(y.featured) - Number(x.featured));
}

function FeaturedTag() {
  return <span className="text-[10px] font-bold uppercase tracking-wide text-[#B45309] bg-[#FEF3C7] px-2 py-0.5 rounded-full">Featured</span>;
}

/** If an image can't load (offline, blocked network), hide it and keep the placeholder background. */
const hideBroken = (e: { currentTarget: HTMLImageElement }) => { e.currentTarget.style.visibility = "hidden"; };

const thumb = (id: string) => `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
const watchUrl = (id: string) => `https://www.youtube.com/watch?v=${id}`;

/** Privacy-enhanced YouTube embed. Only loaded when the person presses play. */
function VideoPlayer({ id, title, autoplay = false }: { id: string; title: string; autoplay?: boolean }) {
  const [playing, setPlaying] = useState(autoplay);
  return (
    <div className="relative w-full aspect-video rounded-xl overflow-hidden bg-[#0F172A]">
      {playing ? (
        <iframe
          className="absolute inset-0 w-full h-full"
          src={`https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0&modestbranding=1`}
          title={title}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          referrerPolicy="strict-origin-when-cross-origin"
          allowFullScreen
        />
      ) : (
        <button type="button" onClick={() => setPlaying(true)} className="group absolute inset-0 w-full h-full" aria-label={`Play video: ${title}`}>
          <img src={thumb(id)} alt="" loading="lazy" onError={hideBroken} className="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-opacity" />
          <span className="absolute inset-0 flex items-center justify-center">
            <span className="w-16 h-16 rounded-full bg-black/60 group-hover:bg-[#2563EB] transition-colors flex items-center justify-center shadow-lg">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="white"><polygon points="8 5 19 12 8 19 8 5" /></svg>
            </span>
          </span>
        </button>
      )}
    </div>
  );
}

function Breadcrumb({ navigate }: { navigate: (s: Screen) => void }) {
  return (
    <div className="flex items-center gap-1.5 text-xs text-[#94A3B8] mb-4">
      <button onClick={() => navigate("dashboard")} className="hover:text-[#2563EB] transition-colors font-medium">Dashboard</button>
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg>
      <span className="text-[#0F172A] font-medium">Financial Education</span>
    </div>
  );
}

function CloseIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
    </svg>
  );
}

export default function EducationHub({ navigate }: { navigate: (s: Screen) => void }) {
  const [section, setSection] = useState<Section>("lessons");
  const [activeCat, setActiveCat] = useState("all");
  const [progress, setProgress] = useState<Progress>({ started: [], completed: [] });
  const [contentSettings, setContentSettings] = useState<Record<string, ContentSetting>>({});
  const LESSONS = arrange(ALL_LESSONS, (l) => `lesson:${l.id}`, contentSettings);
  const VIDEOS = arrange(ALL_VIDEOS, (v) => `video:${v.id}`, contentSettings);
  const BOOKS = arrange(ALL_BOOKS, (b) => `book:${b.olKey.replace("/works/", "")}`, contentSettings);

  // Progress is saved to the person's account; the visibility of lessons, videos
  // and books is chosen by administrators in Admin › Content.
  useEffect(() => {
    let cancelled = false;
    fetchProgress().then((p) => { if (!cancelled) setProgress(p); }).catch(() => undefined);
    fetchContentSettings().then((c) => { if (!cancelled) setContentSettings(c); }).catch(() => undefined);
    return () => { cancelled = true; };
  }, []);
  const [openLesson, setOpenLesson] = useState<Lesson | null>(null);
  const [openVideo, setOpenVideo] = useState<Video | null>(null);
  const [nudge, setNudge] = useState<{ lesson: Lesson; reason: string } | null>(null);
  const [dismissedCtx, setDismissedCtx] = useState(false);

  // Suggest a lesson based on what the person has (or hasn't) set up yet.
  useEffect(() => {
    let cancelled = false;
    Promise.all([fetchGoals().catch(() => null), fetchBudget().catch(() => null)]).then(([goals, budget]) => {
      if (cancelled) return;
      if (goals && goals.length === 0) {
        setNudge({ lesson: ALL_LESSONS.find((l) => l.id === 1)!, reason: "You haven't set a savings goal yet. An emergency fund is often the best place to start." });
      } else if (budget && budget.length === 0) {
        setNudge({ lesson: ALL_LESSONS.find((l) => l.id === 2)!, reason: "You don't have a budget for this month yet. The 50/30/20 framework is a simple way to begin." });
      }
    });
    return () => { cancelled = true; };
  }, []);

  // Close modals with Escape.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { setOpenLesson(null); setOpenVideo(null); } };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const handleStart = (lesson: Lesson) => {
    if (!progress.started.includes(lesson.id)) {
      setProgress((p) => ({ ...p, started: [...p.started, lesson.id] }));
      void markStarted(lesson.id);
    }
    setOpenLesson(lesson);
  };

  const handleComplete = (id: number) => {
    if (!progress.completed.includes(id)) {
      setProgress((p) => ({ started: p.started.includes(id) ? p.started : [...p.started, id], completed: [...p.completed, id] }));
      void markCompleted(id);
    }
    setOpenLesson(null);
  };

  const filtered = LESSONS.filter((l) => activeCat === "all" || l.category === activeCat);
  const filteredVideos = VIDEOS.filter((v) => activeCat === "all" || v.category === activeCat);
  const completedCount = progress.completed.filter((id) => LESSONS.some((l) => l.id === id)).length;
  const pct = LESSONS.length ? Math.round((completedCount / LESSONS.length) * 100) : 0;

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1100px]">
      {/* Lesson reader */}
      {openLesson && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4" role="dialog" aria-modal="true" aria-label={openLesson.title}
          onClick={(e) => { if (e.target === e.currentTarget) setOpenLesson(null); }}>
          <div className="bg-white rounded-2xl w-full max-w-2xl card-shadow-md animate-in flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between p-5 sm:p-6 border-b border-[#E2E8F0] shrink-0">
              <div>
                <p className="text-xs text-[#64748B] mb-1">{CATEGORIES.find((c) => c.id === openLesson.category)?.label}</p>
                <h2 className="font-bold text-[#0F172A] text-lg leading-tight">{openLesson.title}</h2>
              </div>
              <button type="button" onClick={() => setOpenLesson(null)} className="text-[#94A3B8] hover:text-[#0F172A] ml-4 shrink-0" aria-label="Close lesson"><CloseIcon /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-5 sm:p-6">
              {openLesson.videoId && (
                <div className="mb-5">
                  <VideoPlayer key={openLesson.videoId} id={openLesson.videoId} title={VIDEOS.find((v) => v.id === openLesson.videoId)?.title ?? openLesson.title} />
                  <p className="mt-2 text-[11px] text-[#94A3B8]">
                    Video: {VIDEOS.find((v) => v.id === openLesson.videoId)?.channel ?? "YouTube"} ·{" "}
                    <a href={watchUrl(openLesson.videoId)} target="_blank" rel="noopener noreferrer" className="underline hover:text-[#2563EB]">Watch on YouTube ↗</a>
                  </p>
                </div>
              )}
              <div className="text-sm text-[#374151] leading-relaxed whitespace-pre-line">{openLesson.content}</div>
              <div className="mt-6 p-4 bg-[#FEF3C7] border border-[#FDE68A] rounded-xl">
                <p className="text-xs text-[#92400E]">
                  <strong>Reminder:</strong> This content is for educational purposes only. It does not constitute personalised financial, tax, legal, or investment advice. Third-party videos reflect their creators' views.
                </p>
              </div>
            </div>
            <div className="p-5 sm:p-6 border-t border-[#E2E8F0] shrink-0 flex justify-between items-center">
              <span className="text-xs text-[#94A3B8]">{openLesson.duration} read</span>
              {progress.completed.includes(openLesson.id) ? (
                <span className="text-sm font-semibold text-[#10B981] flex items-center gap-1">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
                  Completed
                </span>
              ) : (
                <button type="button" onClick={() => handleComplete(openLesson.id)}
                  className="bg-[#2563EB] text-white font-semibold text-sm px-5 py-2.5 rounded-xl hover:bg-[#1D4ED8] transition-colors">
                  Mark as complete
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Video player */}
      {openVideo && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4" role="dialog" aria-modal="true" aria-label={openVideo.title}
          onClick={(e) => { if (e.target === e.currentTarget) setOpenVideo(null); }}>
          <div className="bg-white rounded-2xl w-full max-w-3xl p-4 sm:p-5 animate-in">
            <div className="flex items-start justify-between gap-4 mb-3">
              <div>
                <h2 className="font-bold text-[#0F172A] leading-tight">{openVideo.title}</h2>
                <p className="text-xs text-[#64748B] mt-0.5">{openVideo.channel} · {openVideo.length}</p>
              </div>
              <button type="button" onClick={() => setOpenVideo(null)} className="text-[#94A3B8] hover:text-[#0F172A] shrink-0" aria-label="Close video"><CloseIcon /></button>
            </div>
            <VideoPlayer id={openVideo.id} title={openVideo.title} autoplay />
            <div className="mt-3 flex items-center justify-between gap-3 text-xs">
              <p className="text-[#64748B]">{openVideo.blurb}</p>
              <a href={watchUrl(openVideo.id)} target="_blank" rel="noopener noreferrer" className="shrink-0 font-semibold text-[#2563EB] hover:underline">YouTube ↗</a>
            </div>
          </div>
        </div>
      )}

      <Breadcrumb navigate={navigate} />

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#0F172A]">Financial Education Hub</h1>
        <p className="text-sm text-[#64748B] mt-0.5">Short lessons, hand-picked videos, recommended books and free help</p>
      </div>

      {nudge && !dismissedCtx && (
        <div className="bg-[#EFF6FF] border border-[#BFDBFE] rounded-2xl p-5 mb-6 flex items-start gap-4">
          <div className="w-10 h-10 rounded-xl bg-[#DBEAFE] flex items-center justify-center text-xl shrink-0" aria-hidden="true">💡</div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-[#1E40AF] mb-1">Suggested for you</p>
            <p className="text-sm text-[#1D4ED8] mb-3">{nudge.reason}</p>
            <button type="button" onClick={() => handleStart(nudge.lesson)}
              className="text-sm font-semibold text-white bg-[#2563EB] px-4 py-2 rounded-xl hover:bg-[#1D4ED8] transition-colors text-left">
              Read: {nudge.lesson.title}
            </button>
          </div>
          <button type="button" onClick={() => setDismissedCtx(true)} className="text-[#93C5FD] hover:text-[#1D4ED8] shrink-0" aria-label="Dismiss suggestion">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
      )}

      {/* Progress */}
      <div className="bg-gradient-to-r from-[#2563EB] to-[#4F46E5] rounded-2xl p-5 mb-6 flex items-center justify-between">
        <div>
          <h2 className="font-bold text-white mb-1">Your Progress</h2>
          <p className="text-blue-200 text-sm">{completedCount} of {LESSONS.length} lessons completed</p>
          <div className="mt-2 w-48 h-1.5 bg-white/30 rounded-full overflow-hidden">
            <div className="h-full bg-white rounded-full transition-all" style={{ width: `${pct}%` }} />
          </div>
        </div>
        <div className="hidden sm:block text-right">
          <p className="text-5xl font-extrabold text-white">{pct}%</p>
          <p className="text-blue-200 text-sm">complete</p>
        </div>
      </div>

      {/* Section tabs */}
      <div className="flex bg-[#F1F5F9] rounded-xl p-1 mb-5 w-full sm:w-fit overflow-x-auto" role="tablist" aria-label="Education sections">
        {SECTIONS.map((s) => (
          <button key={s.id} type="button" role="tab" aria-selected={section === s.id} onClick={() => setSection(s.id)}
            className={`flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold whitespace-nowrap transition-all ${section === s.id ? "bg-white text-[#0F172A] shadow-sm" : "text-[#64748B] hover:text-[#0F172A]"}`}>
            <span aria-hidden="true">{s.icon}</span>{s.label}
          </button>
        ))}
      </div>

      {(section === "lessons" || section === "videos") && (
        <div className="flex gap-2 flex-wrap mb-6">
          {CATEGORIES.map((c) => (
            <button key={c.id} type="button" onClick={() => setActiveCat(c.id)} aria-pressed={activeCat === c.id}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-medium transition-all ${activeCat === c.id ? "bg-[#2563EB] text-white" : "bg-white border border-[#E2E8F0] text-[#64748B] hover:bg-[#F8FAFC]"}`}>
              <span aria-hidden="true">{c.icon}</span>{c.label}
            </button>
          ))}
        </div>
      )}

      {/* Lessons */}
      {section === "lessons" && (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map((lesson) => {
            const diff = difficultyStyle[lesson.difficulty];
            const isCompleted = progress.completed.includes(lesson.id);
            const isStarted = progress.started.includes(lesson.id) && !isCompleted;
            return (
              <button type="button" key={lesson.id} onClick={() => handleStart(lesson)}
                className={`text-left bg-white rounded-2xl p-5 border card-shadow transition-all hover:-translate-y-0.5 flex flex-col ${isCompleted ? "border-[#86EFAC]" : "border-[#E2E8F0]"}`}>
                {lesson.videoId ? (
                  <div className="relative h-28 rounded-xl mb-4 overflow-hidden bg-[#0F172A]">
                    <img src={thumb(lesson.videoId)} alt="" loading="lazy" onError={hideBroken} className="w-full h-full object-cover opacity-80" />
                    <span className="absolute bottom-2 left-2 text-[10px] font-semibold bg-black/70 text-white px-2 py-0.5 rounded-full flex items-center gap-1">
                      <svg width="9" height="9" viewBox="0 0 24 24" fill="white"><polygon points="6 4 20 12 6 20 6 4" /></svg>
                      Includes video
                    </span>
                  </div>
                ) : (
                  <div className="h-28 rounded-xl mb-4 flex items-center justify-center text-4xl" style={{ backgroundColor: `${diff.bg}80` }}>
                    {CATEGORIES.find((c) => c.id === lesson.category)?.icon ?? "📖"}
                  </div>
                )}
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: diff.bg, color: diff.text }}>{lesson.difficulty}</span>
                  <span className="text-[10px] text-[#94A3B8]">· {lesson.duration}</span>
                  {lesson.featured && <FeaturedTag />}
                  {isCompleted && <span className="ml-auto text-[10px] font-bold text-[#10B981]">✓ Done</span>}
                </div>
                <h3 className="font-semibold text-[#0F172A] text-sm mb-2 leading-snug">{lesson.title}</h3>
                <p className="text-xs text-[#64748B] leading-relaxed mb-4 line-clamp-2 flex-1">{lesson.desc}</p>
                <span className={`w-full py-2 rounded-xl text-sm font-semibold text-center ${isCompleted ? "bg-[#DCFCE7] text-[#16A34A]" : isStarted ? "bg-[#EFF6FF] text-[#2563EB]" : "bg-[#2563EB] text-white"}`}>
                  {isCompleted ? "✓ Completed" : isStarted ? "Continue reading" : "Start lesson"}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* Videos */}
      {section === "videos" && (
        <>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredVideos.map((v) => (
              <button type="button" key={v.id} onClick={() => setOpenVideo(v)}
                className="group text-left bg-white rounded-2xl overflow-hidden border border-[#E2E8F0] card-shadow hover:-translate-y-0.5 transition-all">
                <div className="relative aspect-video bg-[#0F172A]">
                  <img src={thumb(v.id)} alt="" loading="lazy" onError={hideBroken} className="w-full h-full object-cover" />
                  <span className="absolute inset-0 flex items-center justify-center">
                    <span className="w-12 h-12 rounded-full bg-black/60 group-hover:bg-[#2563EB] transition-colors flex items-center justify-center">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="white"><polygon points="8 5 19 12 8 19 8 5" /></svg>
                    </span>
                  </span>
                  <span className="absolute bottom-2 right-2 text-[10px] font-semibold bg-black/75 text-white px-1.5 py-0.5 rounded">{v.length}</span>
                </div>
                <div className="p-4">
                  {v.featured && <div className="mb-1.5"><FeaturedTag /></div>}
                  <h3 className="font-semibold text-sm text-[#0F172A] leading-snug">{v.title}</h3>
                  <p className="text-xs text-[#2563EB] mt-1">{v.channel}</p>
                  <p className="text-xs text-[#64748B] mt-2 leading-relaxed">{v.blurb}</p>
                </div>
              </button>
            ))}
          </div>
          <p className="mt-5 text-xs text-[#94A3B8]">Videos are hosted on YouTube and made by third parties. They play in privacy-enhanced mode and reflect their creators' views, not personal advice.</p>
        </>
      )}

      {/* Books */}
      {section === "books" && (
        <>
          <div className="grid sm:grid-cols-2 gap-4">
            {BOOKS.map((b) => (
              <a key={b.olKey} href={`https://openlibrary.org${b.olKey}`} target="_blank" rel="noopener noreferrer"
                className="flex gap-4 bg-white rounded-2xl p-4 border border-[#E2E8F0] card-shadow hover:border-[#BFDBFE] transition-colors">
                <img src={`https://covers.openlibrary.org/b/id/${b.coverId}-M.jpg`} alt={`Cover of ${b.title}`} loading="lazy" onError={hideBroken}
                  className="w-20 h-[120px] object-cover rounded-lg bg-[#F1F5F9] shrink-0" />
                <div className="min-w-0 flex flex-col">
                  <span className="text-[10px] font-bold uppercase tracking-wide text-[#7C3AED]">{b.tag}{b.featured ? " · Featured" : ""}</span>
                  <h3 className="font-semibold text-[#0F172A] leading-snug mt-0.5">{b.title}</h3>
                  <p className="text-xs text-[#64748B]">{b.author}</p>
                  <p className="text-xs text-[#475569] mt-2 leading-relaxed flex-1">{b.blurb}</p>
                  <span className="text-xs font-semibold text-[#2563EB] mt-2">View on Open Library ↗</span>
                </div>
              </a>
            ))}
          </div>
          <p className="mt-5 text-xs text-[#94A3B8]">Open Library is a free, non-profit book catalogue where you can find editions, borrow some titles, or locate a copy at your local library. Many Australian public libraries also lend these as e-books.</p>
        </>
      )}

      {/* Free help */}
      {section === "help" && (
        <div className="grid sm:grid-cols-2 gap-4">
          {RESOURCES.map((r) => (
            <div key={r.name} className="bg-white rounded-2xl p-5 border border-[#E2E8F0] card-shadow flex flex-col">
              <h3 className="font-semibold text-[#0F172A]">{r.name}</h3>
              <p className="text-sm text-[#64748B] mt-1 flex-1">{r.desc}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                <a href={r.url} target="_blank" rel="noopener noreferrer" className="text-sm font-semibold text-white bg-[#2563EB] px-4 py-2 rounded-xl hover:bg-[#1D4ED8]">Visit website ↗</a>
                {r.phone && (
                  <a href={`tel:${r.phone.replace(/\s/g, "")}`} className="text-sm font-semibold text-[#2563EB] border border-[#BFDBFE] px-4 py-2 rounded-xl hover:bg-[#EFF6FF]">Call {r.phone}</a>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <p className="mt-8 text-xs text-center text-[#94A3B8]">
        All content is for general educational purposes only. SmartBudget does not provide personalised financial, investment, tax, or legal advice.
      </p>
    </div>
  );
}
