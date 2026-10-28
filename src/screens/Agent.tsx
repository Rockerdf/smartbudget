import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent, ClipboardEvent, DragEvent, KeyboardEvent } from "react";
import type { Screen } from "../App";
import type { UserRole } from "../lib/auth";
import Markdown from "../components/Markdown";
import {
  ACCEPT, MAX_FILES, decideAction, deleteConversation, fileProblem, fileUrl, listConversations, loadMessages,
  removeUpload, renameConversation, sendToAgent, uploadFile,
} from "../lib/agent";
import type { AgentAction, AgentFile, AgentMessage, Conversation } from "../lib/agent";

type Props = { navigate: (s: Screen) => void; userName: string; role: UserRole };

type Draft = { key: string; file: File; preview?: string; status: "uploading" | "ready" | "error"; uploaded?: AgentFile; error?: string };
type Pending = { text: string; files: Draft[] };

const PAGE_LABELS: Record<string, string> = {
  dashboard: "Dashboard", transactions: "Transactions", budget: "Budget", savings: "Savings", analytics: "Analytics",
  healthScore: "Health Score", education: "Learn", notifications: "Notifications", settings: "Settings", helpCenter: "Help",
  adminDashboard: "Dashboard", adminUsers: "Users", adminReports: "Reports", adminSecurity: "Security Center",
  adminAuditLogs: "Activity Log", adminContent: "Content", adminSystemSettings: "Site Settings", adminRoles: "Roles",
};

const THINKING = ["Thinking…", "Reading your request…", "Working on it…", "Checking your data…", "Almost there…"];

const isStaffRole = (r: UserRole) => r === "support" || r === "admin" || r === "superadmin";
const fmtSize = (n: number) => (n > 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

function suggestionsFor(role: UserRole) {
  if (!isStaffRole(role)) {
    return [
      { icon: "📸", title: "Add a receipt", text: "", attach: true },
      { icon: "📊", title: "How am I doing this month?", text: "How am I doing this month? Summarise my income, spending and budgets." },
      { icon: "🛒", title: "Set a grocery budget", text: "Set my Food & Dining budget to $400 for this month." },
      { icon: "🏦", title: "Import a bank statement", text: "I'll attach my bank statement. Please add all the transactions in it.", attach: true },
      { icon: "✈️", title: "Start a savings goal", text: "Create a savings goal called Holiday for $3,000 by next June." },
      { icon: "🔎", title: "Find spending", text: "What did I spend on transport in the last 30 days?" },
    ];
  }
  const s = [
    { icon: "📈", title: "Platform overview", text: "Give me today's platform overview: users, activity and anything unusual." },
    { icon: "🧑‍🤝‍🧑", title: "New sign-ups", text: "Who signed up in the last 7 days?" },
    { icon: "🗓️", title: "3-month report", text: "Summarise the last 3 months: user growth, engagement and lessons." },
  ];
  if (role !== "support") s.push({ icon: "🛡️", title: "Security check", text: "Are there any security issues or failed sign-in patterns I should know about?" });
  if (role === "superadmin") s.push({ icon: "📣", title: "Post an announcement", text: "Turn on the announcement banner saying: New AI agent available! Snap a receipt to add it." });
  return s;
}

function groupLabel(iso: string) {
  const d = new Date(iso);
  const days = (Date.now() - d.getTime()) / 86400000;
  if (days < 1 && new Date().toDateString() === d.toDateString()) return "Today";
  if (days < 7) return "Previous 7 days";
  if (days < 30) return "Previous 30 days";
  return "Older";
}

// ── Icons ────────────────────────────────────────────────────────────────────
const Ico = {
  clip: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>,
  camera: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>,
  send: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></svg>,
  plus: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>,
  chats: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>,
  x: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
  trash: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M9 6V4h6v2"/></svg>,
  pen: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>,
  check: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>,
  copy: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>,
  file: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>,
  video: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/></svg>,
  arrow: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>,
};

function Sparkle({ size = 16 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l2.2 6.3L20.5 10l-6.3 2.2L12 18.5l-2.2-6.3L3.5 10l6.3-1.7z"/><path d="M19 15l.9 2.6 2.6.9-2.6.9L19 22l-.9-2.6-2.6-.9 2.6-.9z" opacity=".7"/></svg>;
}

function AgentAvatar() {
  return (
    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#2563EB] to-[#7C3AED] text-white flex items-center justify-center shrink-0 shadow-sm" aria-hidden="true">
      <Sparkle size={15} />
    </div>
  );
}

// ── Attachments in sent messages ─────────────────────────────────────────────
function SentFile({ f, localPreview }: { f: AgentFile; localPreview?: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const isImage = f.mime.startsWith("image/") && !/heic|heif/i.test(f.mime);
  useEffect(() => {
    let live = true;
    void fileUrl(f.path).then((u) => { if (live) setUrl(u); });
    return () => { live = false; };
  }, [f.path]);
  const src = localPreview ?? url;
  const linkProps = { href: url ?? undefined, target: "_blank", rel: "noopener noreferrer", title: f.name, onClick: (e: React.MouseEvent) => { if (!url) e.preventDefault(); } };
  if (isImage) {
    return (
      <a {...linkProps} className="block rounded-xl overflow-hidden border border-white/30 bg-[#DBEAFE]">
        {src ? <img src={src} alt={f.name} className="h-28 w-28 sm:h-36 sm:w-36 object-cover" /> : <div className="h-28 w-28 sm:h-36 sm:w-36 animate-pulse" />}
      </a>
    );
  }
  const isVideo = f.mime.startsWith("video/") || f.mime.startsWith("audio/");
  return (
    <a {...linkProps} className="flex items-center gap-2 bg-white/15 hover:bg-white/25 rounded-xl px-3 py-2 text-left max-w-[240px]">
      <span className="shrink-0">{isVideo ? Ico.video : Ico.file}</span>
      <span className="min-w-0">
        <span className="block text-xs font-semibold truncate">{f.name}</span>
        <span className="block text-[10px] opacity-80">{fmtSize(f.size)}</span>
      </span>
    </a>
  );
}

// ── Action cards ─────────────────────────────────────────────────────────────
function ActionCard({ a, onDecide, busy }: { a: AgentAction; onDecide?: (approve: boolean) => void; busy: boolean }) {
  const tone =
    a.status === "pending" ? { box: "border-[#FCD34D] bg-[#FFFBEB]", dot: "bg-[#F59E0B]", text: "text-[#92400E]", tag: "Needs your approval" }
    : a.status === "failed" ? { box: "border-[#FECACA] bg-[#FEF2F2]", dot: "bg-[#EF4444]", text: "text-[#991B1B]", tag: "Not done" }
    : a.status === "cancelled" ? { box: "border-[#E2E8F0] bg-[#F8FAFC]", dot: "bg-[#94A3B8]", text: "text-[#64748B]", tag: "Cancelled" }
    : { box: "border-[#BBF7D0] bg-[#F0FDF4]", dot: "bg-[#16A34A]", text: "text-[#166534]", tag: "Done" };
  return (
    <div className={`border rounded-xl px-3.5 py-3 ${tone.box}`}>
      <div className="flex items-start gap-2">
        <span className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${tone.dot}`} aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <p className={`text-[10px] font-bold uppercase tracking-wide ${tone.text}`}>{tone.tag}</p>
          <p className="text-sm font-semibold text-[#0F172A] mt-0.5">{a.label}</p>
          {a.items && a.items.length > 0 && (
            <ul className="mt-1.5 space-y-0.5">
              {a.items.slice(0, 12).map((it, i) => <li key={i} className="text-xs text-[#475569] tabular-nums">{it}</li>)}
              {a.items.length > 12 && <li className="text-xs text-[#94A3B8]">…and {a.items.length - 12} more</li>}
            </ul>
          )}
          {a.detail && <p className="text-xs text-[#991B1B] mt-1">{a.detail}</p>}
          {a.status === "pending" && onDecide && (
            <div className="flex gap-2 mt-3">
              <button type="button" disabled={busy} onClick={() => onDecide(true)}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-white bg-[#2563EB] hover:bg-[#1D4ED8] disabled:opacity-60 px-3.5 py-2 rounded-lg">
                {busy ? "Working…" : <>{Ico.check} Approve</>}
              </button>
              <button type="button" disabled={busy} onClick={() => onDecide(false)}
                className="text-xs font-semibold text-[#475569] bg-white border border-[#E2E8F0] hover:bg-[#F8FAFC] disabled:opacity-60 px-3.5 py-2 rounded-lg">
                Cancel
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function AssistantMessage({ m, navigate, onUpdate, onError }: {
  m: AgentMessage; navigate: (s: Screen) => void; onUpdate: (m: AgentMessage) => void; onError: (e: string) => void;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const reads = m.actions.filter((a) => a.kind === "read" && a.tool !== "open_page");
  const writes = m.actions.filter((a) => a.kind === "write");
  const pages = [...new Set(m.actions.filter((a) => a.page && a.status === "done").map((a) => a.page!))].filter((p) => PAGE_LABELS[p]);

  const decide = async (a: AgentAction, approve: boolean) => {
    setBusy(a.id);
    try { onUpdate(await decideAction(m.id, a.id, approve)); }
    catch (e) { onError(e instanceof Error ? e.message : "That didn't work."); }
    finally { setBusy(null); }
  };

  return (
    <div className="flex gap-3">
      <AgentAvatar />
      <div className="min-w-0 flex-1 pt-0.5">
        {reads.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-2">
            {reads.map((a) => (
              <span key={a.id} className="inline-flex items-center gap-1 text-[11px] text-[#64748B] bg-[#F1F5F9] rounded-full px-2.5 py-1">
                <span className="text-[#16A34A]">{Ico.check}</span>{a.label}
              </span>
            ))}
          </div>
        )}
        {m.content && <div className="text-[15px] text-[#1E293B]"><Markdown text={m.content} /></div>}
        {writes.length > 0 && (
          <div className="mt-3 space-y-2">
            {writes.map((a) => <ActionCard key={a.id} a={a} busy={busy === a.id} onDecide={(ok) => void decide(a, ok)} />)}
          </div>
        )}
        <div className="flex flex-wrap items-center gap-2 mt-2.5">
          {pages.map((p) => (
            <button key={p} type="button" onClick={() => navigate(p as Screen)}
              className="inline-flex items-center gap-1 text-xs font-semibold text-[#2563EB] bg-[#EFF6FF] hover:bg-[#DBEAFE] px-3 py-1.5 rounded-lg">
              Open {PAGE_LABELS[p]} {Ico.arrow}
            </button>
          ))}
          {m.content && (
            <button type="button" aria-label="Copy reply"
              onClick={() => { void navigator.clipboard?.writeText(m.content).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); }); }}
              className="inline-flex items-center gap-1 text-[11px] text-[#94A3B8] hover:text-[#475569] px-1.5 py-1 rounded-md">
              {copied ? Ico.check : Ico.copy}{copied ? "Copied" : ""}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function UserMessage({ text, files, previews }: { text: string; files: AgentFile[]; previews?: Record<string, string> }) {
  return (
    <div className="flex flex-col items-end gap-1.5">
      {files.length > 0 && (
        <div className="flex flex-wrap justify-end gap-1.5 max-w-[85%]">
          {files.map((f) => (
            <div key={f.path} className="bg-[#2563EB] text-white rounded-xl p-0.5"><SentFile f={f} localPreview={previews?.[f.path]} /></div>
          ))}
        </div>
      )}
      {text && <div className="bg-[#2563EB] text-white rounded-2xl rounded-br-md px-4 py-2.5 max-w-[85%] text-[15px] whitespace-pre-wrap break-words">{text}</div>}
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────
export default function Agent({ navigate, userName, role }: Props) {
  const staff = isStaffRole(role);
  const firstName = userName.split(" ")[0] || "there";
  const [convs, setConvs] = useState<Conversation[]>([]);
  const [convsLoaded, setConvsLoaded] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [loadingChat, setLoadingChat] = useState(false);
  const [text, setText] = useState("");
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [pending, setPending] = useState<Pending | null>(null);
  const [error, setError] = useState<{ msg: string; retry?: Pending } | null>(null);
  const [setupProblem, setSetupProblem] = useState<string | null>(null);
  const [drawer, setDrawer] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [thinkingIdx, setThinkingIdx] = useState(0);
  const [renaming, setRenaming] = useState<{ id: string; title: string } | null>(null);
  const previews = useRef<Record<string, string>>({});
  const fileInput = useRef<HTMLInputElement>(null);
  const cameraInput = useRef<HTMLInputElement>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const dragDepth = useRef(0);

  const refreshConvs = useCallback(async () => {
    try { setConvs(await listConversations()); setSetupProblem(null); }
    catch (e) { setSetupProblem(e instanceof Error ? e.message : "The AI agent is not available."); }
    finally { setConvsLoaded(true); }
  }, []);
  useEffect(() => { void refreshConvs(); }, [refreshConvs]);

  useEffect(() => {
    if (!pending) return;
    setThinkingIdx(0);
    const t = setInterval(() => setThinkingIdx((i) => Math.min(i + 1, THINKING.length - 1)), 2600);
    return () => clearInterval(t);
  }, [pending]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [messages, pending, error]);

  useEffect(() => {
    const el = textRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, [text]);

  const openChat = async (id: string) => {
    setDrawer(false);
    if (id === activeId) return;
    setActiveId(id);
    setMessages([]);
    setError(null);
    setLoadingChat(true);
    try { setMessages(await loadMessages(id)); }
    catch (e) { setError({ msg: e instanceof Error ? e.message : "Could not open that chat." }); }
    finally { setLoadingChat(false); }
  };

  const newChat = () => {
    setDrawer(false);
    setActiveId(null);
    setMessages([]);
    setError(null);
    setTimeout(() => textRef.current?.focus(), 50);
  };

  const removeChat = async (c: Conversation) => {
    if (!window.confirm(`Delete "${c.title}"? Its messages and uploaded files are removed (receipts saved with transactions are kept).`)) return;
    try {
      await deleteConversation(c.id);
      setConvs((cs) => cs.filter((x) => x.id !== c.id));
      if (activeId === c.id) newChat();
    } catch (e) { setError({ msg: e instanceof Error ? e.message : "Could not delete the chat." }); }
  };

  const saveRename = async () => {
    if (!renaming) return;
    const { id, title } = renaming;
    setRenaming(null);
    setConvs((cs) => cs.map((c) => (c.id === id ? { ...c, title: title.trim() || c.title } : c)));
    try { await renameConversation(id, title); } catch { void refreshConvs(); }
  };

  // ── Files ──
  const addFiles = (list: FileList | File[]) => {
    const files = Array.from(list);
    if (!files.length) return;
    setError(null);
    const room = MAX_FILES - drafts.length;
    if (room <= 0) { setError({ msg: `You can attach up to ${MAX_FILES} files per message.` }); return; }
    const accepted = files.slice(0, room);
    if (files.length > room) setError({ msg: `Only the first ${room} file${room > 1 ? "s were" : " was"} added (max ${MAX_FILES} per message).` });
    for (const file of accepted) {
      const key = crypto.randomUUID();
      const problem = fileProblem(file);
      const preview = file.type.startsWith("image/") && !/heic|heif/i.test(file.type) ? URL.createObjectURL(file) : undefined;
      const d: Draft = { key, file, preview, status: problem ? "error" : "uploading", error: problem ?? undefined };
      setDrafts((ds) => [...ds, d]);
      if (problem) continue;
      void uploadFile(file)
        .then((uploaded) => {
          if (preview) previews.current[uploaded.path] = preview;
          setDrafts((ds) => ds.map((x) => (x.key === key ? { ...x, status: "ready", uploaded } : x)));
        })
        .catch((e) => setDrafts((ds) => ds.map((x) => (x.key === key ? { ...x, status: "error", error: e instanceof Error ? e.message : "Upload failed" } : x))));
    }
  };
  const removeDraft = (d: Draft) => {
    setDrafts((ds) => ds.filter((x) => x.key !== d.key));
    if (d.uploaded) void removeUpload(d.uploaded.path);
  };
  const onPick = (e: ChangeEvent<HTMLInputElement>) => { if (e.target.files) addFiles(e.target.files); e.target.value = ""; };
  const onPaste = (e: ClipboardEvent) => {
    const files = Array.from(e.clipboardData.files ?? []);
    if (files.length) { e.preventDefault(); addFiles(files); }
  };
  const onDragEnter = (e: DragEvent) => { if (e.dataTransfer.types.includes("Files")) { e.preventDefault(); dragDepth.current++; setDragging(true); } };
  const onDragLeave = () => { dragDepth.current = Math.max(0, dragDepth.current - 1); if (!dragDepth.current) setDragging(false); };
  const onDrop = (e: DragEvent) => { e.preventDefault(); dragDepth.current = 0; setDragging(false); if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files); };

  // ── Sending ──
  const uploading = drafts.some((d) => d.status === "uploading");
  const ready = drafts.filter((d) => d.status === "ready");
  const canSend = !pending && !uploading && (text.trim().length > 0 || ready.length > 0);

  const run = async (p: Pending) => {
    setPending(p);
    setError(null);
    try {
      const res = await sendToAgent({ conversationId: activeId, message: p.text, attachments: p.files.map((d) => d.uploaded!) });
      setActiveId(res.conversation.id);
      setMessages((ms) => [...ms, ...res.messages]);
      setConvs((cs) => [
        { id: res.conversation.id, title: res.conversation.title, updated_at: new Date().toISOString() },
        ...cs.filter((c) => c.id !== res.conversation.id),
      ]);
    } catch (e) {
      setError({ msg: e instanceof Error ? e.message : "The AI agent couldn't answer.", retry: p });
    } finally {
      setPending(null);
    }
  };

  const send = (preset?: string) => {
    const body = (preset ?? text).trim();
    if (pending || uploading) return;
    if (!body && !ready.length) return;
    const p: Pending = { text: body, files: ready };
    setText("");
    setDrafts((ds) => ds.filter((d) => d.status === "error"));
    void run(p);
  };

  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    const touch = window.matchMedia?.("(pointer: coarse)").matches;
    if (e.key === "Enter" && !e.shiftKey && !touch && !e.nativeEvent.isComposing) { e.preventDefault(); send(); }
  };

  const updateMessage = (m: AgentMessage) => setMessages((ms) => ms.map((x) => (x.id === m.id ? m : x)));

  const grouped = useMemo(() => {
    const g: { label: string; items: Conversation[] }[] = [];
    for (const c of convs) {
      const label = groupLabel(c.updated_at);
      const last = g[g.length - 1];
      if (last && last.label === label) last.items.push(c);
      else g.push({ label, items: [c] });
    }
    return g;
  }, [convs]);

  const empty = !activeId && messages.length === 0 && !pending;
  const title = convs.find((c) => c.id === activeId)?.title ?? "New chat";

  const sidebar = (
    <div className="flex flex-col h-full">
      <div className="p-3 border-b border-[#E2E8F0]">
        <button type="button" onClick={newChat}
          className="w-full flex items-center justify-center gap-2 text-sm font-semibold text-white bg-[#2563EB] hover:bg-[#1D4ED8] px-3 py-2.5 rounded-xl">
          {Ico.plus} New chat
        </button>
      </div>
      <nav className="flex-1 overflow-y-auto p-2" aria-label="Chats">
        {!convsLoaded && <p className="text-xs text-[#94A3B8] p-3">Loading chats…</p>}
        {convsLoaded && convs.length === 0 && <p className="text-xs text-[#94A3B8] p-3 leading-relaxed">Your chats appear here. They're private to you.</p>}
        {grouped.map((g) => (
          <div key={g.label} className="mb-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-[#94A3B8] px-2.5 py-1.5">{g.label}</p>
            {g.items.map((c) => (
              <div key={c.id} className={`group flex items-center gap-1 rounded-lg ${c.id === activeId ? "bg-[#EFF6FF]" : "hover:bg-[#F8FAFC]"}`}>
                {renaming?.id === c.id ? (
                  <input autoFocus value={renaming.title} maxLength={120} aria-label="Chat name"
                    onChange={(e) => setRenaming({ id: c.id, title: e.target.value })}
                    onBlur={() => void saveRename()}
                    onKeyDown={(e) => { if (e.key === "Enter") void saveRename(); if (e.key === "Escape") setRenaming(null); }}
                    className="flex-1 min-w-0 text-sm px-2.5 py-2 bg-white border border-[#2563EB] rounded-lg outline-none" />
                ) : (
                  <button type="button" onClick={() => void openChat(c.id)} title={c.title}
                    className={`flex-1 min-w-0 text-left text-sm px-2.5 py-2 truncate ${c.id === activeId ? "text-[#1D4ED8] font-semibold" : "text-[#334155]"}`}>
                    {c.title}
                  </button>
                )}
                {renaming?.id !== c.id && (
                  <span className="flex opacity-100 lg:opacity-0 lg:group-hover:opacity-100 focus-within:opacity-100 pr-1">
                    <button type="button" aria-label={`Rename ${c.title}`} onClick={() => setRenaming({ id: c.id, title: c.title })} className="p-1.5 text-[#94A3B8] hover:text-[#2563EB] rounded">{Ico.pen}</button>
                    <button type="button" aria-label={`Delete ${c.title}`} onClick={() => void removeChat(c)} className="p-1.5 text-[#94A3B8] hover:text-[#EF4444] rounded">{Ico.trash}</button>
                  </span>
                )}
              </div>
            ))}
          </div>
        ))}
      </nav>
      <p className="text-[10px] text-[#94A3B8] leading-relaxed p-3 border-t border-[#E2E8F0]">
        {staff ? "Staff agent: platform totals and admin tasks only. Every change it makes is in the Activity Log." : "The agent only ever sees your own records. Not financial advice."}
      </p>
    </div>
  );

  return (
    <div className="flex h-full min-h-0 bg-white" onDragEnter={onDragEnter} onDragOver={(e) => e.preventDefault()} onDragLeave={onDragLeave} onDrop={onDrop}>
      {/* Chat list: side panel on large screens, drawer on small ones */}
      <aside className="hidden lg:flex flex-col w-64 border-r border-[#E2E8F0] bg-white shrink-0">{sidebar}</aside>
      {drawer && (
        <div className="lg:hidden fixed inset-0 z-[70]" role="dialog" aria-modal="true" aria-label="Chats">
          <button type="button" aria-label="Close chats" className="absolute inset-0 bg-black/40" onClick={() => setDrawer(false)} />
          <div className="absolute left-0 top-0 bottom-0 w-[82%] max-w-xs bg-white shadow-xl">{sidebar}</div>
        </div>
      )}

      <section className="flex-1 min-w-0 flex flex-col relative">
        {/* Top bar */}
        <div className="flex items-center gap-2 px-3 sm:px-5 h-12 border-b border-[#F1F5F9] shrink-0">
          <button type="button" onClick={() => setDrawer(true)} aria-label="Show chats" className="lg:hidden p-2 -ml-1 text-[#475569] hover:bg-[#F1F5F9] rounded-lg">{Ico.chats}</button>
          <div className="min-w-0 flex-1">
            <h1 className="text-sm font-semibold text-[#0F172A] truncate">{empty ? "New chat" : title}</h1>
          </div>
          <span className="hidden sm:inline text-[10px] font-semibold text-[#7C3AED] bg-[#F5F3FF] px-2 py-1 rounded-full">{staff ? "Staff tools" : "Your money"}</span>
          {!empty && <button type="button" onClick={newChat} aria-label="New chat" className="p-2 text-[#475569] hover:bg-[#F1F5F9] rounded-lg">{Ico.plus}</button>}
        </div>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 space-y-6">
            {setupProblem && (
              <div className="bg-[#FFFBEB] border border-[#FCD34D] rounded-xl p-4 text-sm text-[#92400E]">{setupProblem}</div>
            )}
            {empty && (
              <div className="pt-4 sm:pt-10 text-center">
                <div className="w-14 h-14 mx-auto rounded-2xl bg-gradient-to-br from-[#2563EB] to-[#7C3AED] text-white flex items-center justify-center shadow-md"><Sparkle size={26} /></div>
                <h2 className="text-2xl sm:text-3xl font-bold text-[#0F172A] mt-5 tracking-tight">Hi {firstName}, what can I do for you?</h2>
                <p className="text-sm text-[#64748B] mt-2 max-w-md mx-auto">
                  {staff
                    ? "Ask about the platform, or tell me what to do. I'll ask before changing anything important."
                    : "Ask anything, or just tell me what to do. Send a photo of a receipt, a bank statement, a spreadsheet or a video and I'll handle it."}
                </p>
                <div className="grid sm:grid-cols-2 gap-2.5 mt-7 text-left">
                  {suggestionsFor(role).map((s) => (
                    <button key={s.title} type="button"
                      onClick={() => {
                        if (s.attach) { if (s.text) setText(s.text); fileInput.current?.click(); }
                        else send(s.text);
                      }}
                      className="flex items-start gap-3 text-left bg-white border border-[#E2E8F0] hover:border-[#BFDBFE] hover:bg-[#F8FBFF] rounded-xl px-4 py-3 transition-colors">
                      <span className="text-lg leading-none mt-0.5" aria-hidden="true">{s.icon}</span>
                      <span>
                        <span className="block text-sm font-semibold text-[#0F172A]">{s.title}</span>
                        {s.text && <span className="block text-xs text-[#64748B] mt-0.5 line-clamp-2">{s.text}</span>}
                        {!s.text && <span className="block text-xs text-[#64748B] mt-0.5">Photo or PDF, and I'll record it</span>}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
            {loadingChat && <p className="text-sm text-[#94A3B8] text-center">Loading chat…</p>}

            {messages.map((m) =>
              m.role === "user" ? (
                <UserMessage key={m.id} text={m.content} files={m.attachments ?? []} previews={previews.current} />
              ) : (
                <AssistantMessage key={m.id} m={m} navigate={navigate} onUpdate={updateMessage} onError={(msg) => setError({ msg })} />
              ),
            )}

            {pending && (
              <>
                <UserMessage text={pending.text} files={pending.files.map((d) => d.uploaded!)} previews={previews.current} />
                <div className="flex gap-3 items-center" role="status" aria-live="polite">
                  <AgentAvatar />
                  <div className="flex items-center gap-2 text-sm text-[#64748B]">
                    <span className="flex gap-1" aria-hidden="true">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#2563EB] animate-bounce [animation-delay:-0.3s]" />
                      <span className="w-1.5 h-1.5 rounded-full bg-[#2563EB] animate-bounce [animation-delay:-0.15s]" />
                      <span className="w-1.5 h-1.5 rounded-full bg-[#2563EB] animate-bounce" />
                    </span>
                    {pending.files.length && thinkingIdx === 1 ? "Reading your files…" : THINKING[thinkingIdx]}
                  </div>
                </div>
              </>
            )}

            {error && (
              <div className="flex gap-3" role="alert">
                <div className="w-8 shrink-0" />
                <div className="flex-1 bg-[#FEF2F2] border border-[#FECACA] text-[#991B1B] text-sm rounded-xl px-4 py-3">
                  <p>{error.msg}</p>
                  <div className="flex gap-3 mt-2">
                    {error.retry && <button type="button" onClick={() => void run(error.retry!)} className="font-semibold underline">Try again</button>}
                    <button type="button" onClick={() => setError(null)} className="text-[#B91C1C]/80 underline">Dismiss</button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Composer */}
        <div className="shrink-0 px-3 sm:px-6 pb-3 pt-2 bg-white">
          <div className="max-w-3xl mx-auto">
            <div className="border border-[#E2E8F0] focus-within:border-[#93C5FD] focus-within:ring-4 focus-within:ring-[#DBEAFE] rounded-2xl bg-white shadow-sm transition-shadow">
              {drafts.length > 0 && (
                <div className="flex flex-wrap gap-2 px-3 pt-3">
                  {drafts.map((d) => (
                    <div key={d.key} className={`relative flex items-center gap-2 rounded-xl border pr-7 ${d.status === "error" ? "border-[#FECACA] bg-[#FEF2F2]" : "border-[#E2E8F0] bg-[#F8FAFC]"} ${d.preview ? "p-1" : "pl-2.5 py-2"}`}>
                      {d.preview ? (
                        <img src={d.preview} alt={d.file.name} className={`h-12 w-12 rounded-lg object-cover ${d.status === "uploading" ? "opacity-50" : ""}`} />
                      ) : (
                        <span className="text-[#64748B]">{d.file.type.startsWith("video/") ? Ico.video : Ico.file}</span>
                      )}
                      <span className="max-w-[140px] min-w-0">
                        <span className="block text-xs font-medium text-[#0F172A] truncate">{d.file.name}</span>
                        <span className={`block text-[10px] ${d.status === "error" ? "text-[#B91C1C]" : "text-[#94A3B8]"}`}>
                          {d.status === "uploading" ? "Uploading…" : d.status === "error" ? d.error : fmtSize(d.file.size)}
                        </span>
                      </span>
                      <button type="button" onClick={() => removeDraft(d)} aria-label={`Remove ${d.file.name}`}
                        className="absolute top-1 right-1 w-5 h-5 rounded-full bg-white border border-[#E2E8F0] text-[#64748B] hover:text-[#EF4444] flex items-center justify-center">
                        {Ico.x}
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <textarea
                ref={textRef}
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={onKey}
                onPaste={onPaste}
                rows={1}
                maxLength={8000}
                placeholder={staff ? "Ask about the platform or give me a task…" : "Message the AI agent, or drop a receipt here…"}
                aria-label="Message"
                className="agent-input w-full resize-none bg-transparent px-4 pt-3.5 pb-1 text-[15px] text-[#0F172A] placeholder:text-[#94A3B8] outline-none max-h-[200px]"
              />
              <div className="flex items-center gap-1 px-2 pb-2">
                <button type="button" onClick={() => fileInput.current?.click()} aria-label="Attach files" title="Attach files (images, PDF, CSV, Excel, Word, video)"
                  className="p-2 rounded-lg text-[#64748B] hover:text-[#2563EB] hover:bg-[#EFF6FF]">{Ico.clip}</button>
                <button type="button" onClick={() => cameraInput.current?.click()} aria-label="Take a photo" title="Take a photo"
                  className="p-2 rounded-lg text-[#64748B] hover:text-[#2563EB] hover:bg-[#EFF6FF] sm:hidden">{Ico.camera}</button>
                <span className="text-[11px] text-[#94A3B8] ml-1 hidden sm:inline">{uploading ? "Uploading files…" : "Enter to send · Shift+Enter for a new line"}</span>
                <button type="button" onClick={() => send()} disabled={!canSend} aria-label="Send"
                  className="ml-auto w-9 h-9 rounded-xl bg-[#2563EB] text-white flex items-center justify-center hover:bg-[#1D4ED8] disabled:bg-[#CBD5E1] transition-colors">
                  {Ico.send}
                </button>
              </div>
              <input ref={fileInput} type="file" multiple accept={ACCEPT} className="hidden" onChange={onPick} />
              <input ref={cameraInput} type="file" accept="image/*" capture="environment" className="hidden" onChange={onPick} />
            </div>
            <p className="text-[10px] text-[#94A3B8] text-center mt-2 leading-relaxed">
              AI can make mistakes, so check important details. Messages and files are processed by Google Gemini. Don't upload documents with passwords or full card numbers.
            </p>
          </div>
        </div>

        {dragging && (
          <div className="absolute inset-0 z-20 bg-[#EFF6FF]/90 border-2 border-dashed border-[#2563EB] rounded-xl m-2 flex flex-col items-center justify-center pointer-events-none">
            <span className="text-[#2563EB]">{Ico.clip}</span>
            <p className="text-sm font-semibold text-[#1D4ED8] mt-2">Drop files to attach</p>
            <p className="text-xs text-[#3B82F6]">Receipts, statements, spreadsheets, documents, videos</p>
          </div>
        )}
      </section>
    </div>
  );
}
