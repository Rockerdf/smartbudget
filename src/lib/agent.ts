// Browser side of the AI agent. The thinking happens in the Supabase Edge
// Function "agent" (supabase/functions/agent), which holds the Gemini key.
// Files are uploaded to the private "agent-files" storage bucket, into a folder
// that only the signed-in person can read.
import { supabase } from "./supabase";
import { clearCategoryCache } from "./categories";
import { markTransactionsChanged } from "./transactions";

export const AGENT_BUCKET = "agent-files";
export const MAX_FILE_MB = 50;
export const MAX_FILES = 6;
export const ACCEPT =
  "image/*,application/pdf,text/csv,text/plain,.csv,.txt,.md,.json,.xlsx,.xls,.ods,.docx,video/*,audio/*";

export type AgentFile = { path: string; name: string; mime: string; size: number };
export type AgentAction = {
  id: string;
  tool: string;
  kind: "read" | "write";
  status: "done" | "failed" | "pending" | "cancelled";
  label: string;
  detail?: string;
  items?: string[];
  page?: string;
};
export type AgentMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  attachments: AgentFile[];
  actions: AgentAction[];
  created_at: string;
};
export type Conversation = { id: string; title: string; updated_at: string };

const NOT_SET_UP =
  "The AI agent isn't set up on the server yet. An administrator needs to run supabase/agent_upgrade.sql and deploy the \"agent\" Edge Function (see README).";

function setupError(message: string | undefined): Error {
  const m = message ?? "";
  if (/agent_conversations|agent_messages|schema cache|does not exist|404/i.test(m)) return new Error(NOT_SET_UP);
  return new Error(m || "Something went wrong. Please try again.");
}

async function userId(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  const id = data.session?.user.id;
  if (!id) throw new Error("Please sign in again.");
  return id;
}

export async function listConversations(): Promise<Conversation[]> {
  const { data, error } = await supabase
    .from("agent_conversations")
    .select("id, title, updated_at")
    .order("updated_at", { ascending: false })
    .limit(100);
  if (error) throw setupError(error.message);
  return (data ?? []) as Conversation[];
}

export async function loadMessages(conversationId: string): Promise<AgentMessage[]> {
  const { data, error } = await supabase
    .from("agent_messages")
    .select("id, role, content, attachments, actions, created_at")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true })
    .limit(500);
  if (error) throw setupError(error.message);
  return (data ?? []) as AgentMessage[];
}

export async function renameConversation(id: string, title: string): Promise<void> {
  const clean = title.trim().slice(0, 120) || "New chat";
  const { error } = await supabase.from("agent_conversations").update({ title: clean }).eq("id", id);
  if (error) throw new Error("Could not rename the chat.");
}

/** Deletes a chat and its uploaded files, except files kept as transaction receipts. */
export async function deleteConversation(id: string): Promise<void> {
  const msgs = await loadMessages(id).catch(() => [] as AgentMessage[]);
  const paths = [...new Set(msgs.flatMap((m) => (m.attachments ?? []).map((f) => f.path)))];
  if (paths.length) {
    const { data: kept } = await supabase.from("transactions").select("receipt_path").in("receipt_path", paths);
    const keep = new Set((kept ?? []).map((r: { receipt_path: string | null }) => r.receipt_path));
    const remove = paths.filter((p) => !keep.has(p));
    if (remove.length) await supabase.storage.from(AGENT_BUCKET).remove(remove);
  }
  const { error } = await supabase.from("agent_conversations").delete().eq("id", id);
  if (error) throw new Error("Could not delete the chat.");
}

export function fileProblem(f: File): string | null {
  if (f.size === 0) return `${f.name} is empty.`;
  if (f.size > MAX_FILE_MB * 1024 * 1024) return `${f.name} is larger than ${MAX_FILE_MB} MB.`;
  return null;
}

export async function uploadFile(file: File): Promise<AgentFile> {
  const id = await userId();
  const safe = file.name.replace(/[^A-Za-z0-9._-]+/g, "_").replace(/^_+/, "").slice(-80) || "file";
  const path = `${id}/${crypto.randomUUID()}-${safe}`;
  const mime = file.type || guessMime(file.name);
  const { error } = await supabase.storage.from(AGENT_BUCKET).upload(path, file, { contentType: mime, upsert: false });
  if (error) {
    if (/bucket not found/i.test(error.message)) throw new Error(NOT_SET_UP);
    if (/exceeded|too large|maximum/i.test(error.message)) throw new Error(`${file.name} is too large.`);
    throw new Error(`Could not upload ${file.name}.`);
  }
  return { path, name: file.name.slice(0, 150), mime, size: file.size };
}

export async function removeUpload(path: string): Promise<void> {
  await supabase.storage.from(AGENT_BUCKET).remove([path]);
}

function guessMime(name: string): string {
  const ext = name.toLowerCase().split(".").pop() ?? "";
  const map: Record<string, string> = {
    csv: "text/csv", txt: "text/plain", md: "text/markdown", json: "application/json", pdf: "application/pdf",
    xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", xls: "application/vnd.ms-excel",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", heic: "image/heic",
  };
  return map[ext] ?? "application/octet-stream";
}

const urlCache = new Map<string, { url: string; at: number }>();
/** Short-lived private link to one of your own files. */
export async function fileUrl(path: string): Promise<string | null> {
  const hit = urlCache.get(path);
  if (hit && Date.now() - hit.at < 50 * 60 * 1000) return hit.url;
  const { data, error } = await supabase.storage.from(AGENT_BUCKET).createSignedUrl(path, 3600);
  if (error || !data?.signedUrl) return null;
  urlCache.set(path, { url: data.signedUrl, at: Date.now() });
  return data.signedUrl;
}

async function invoke<T>(body: Record<string, unknown>): Promise<T> {
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const { data, error } = await supabase.functions.invoke("agent", { body: { ...body, timezone } });
  if (error) {
    const ctx = (error as { context?: Response }).context;
    let msg = "";
    if (ctx && typeof ctx.json === "function") {
      try { msg = (await ctx.json())?.error ?? ""; } catch { /* not JSON */ }
      if (!msg && ctx.status === 404) throw new Error(NOT_SET_UP);
    }
    if (!msg && /Failed to send a request|fetch/i.test(error.message)) {
      throw new Error("Couldn't reach the AI agent. Check your connection, or ask an administrator whether the \"agent\" function is deployed.");
    }
    throw new Error(msg || error.message || "The AI agent couldn't answer. Please try again.");
  }
  return data as T;
}

function afterChange(changed: boolean) {
  if (!changed) return;
  clearCategoryCache();
  markTransactionsChanged();
}

export async function sendToAgent(input: { conversationId: string | null; message: string; attachments: AgentFile[] }) {
  const res = await invoke<{ conversation: { id: string; title: string }; messages: AgentMessage[]; changed: boolean }>({
    conversation_id: input.conversationId,
    message: input.message,
    attachments: input.attachments,
  });
  afterChange(res.changed);
  return res;
}

export async function decideAction(messageId: string, actionId: string, approve: boolean) {
  const res = await invoke<{ message: AgentMessage; changed: boolean }>({ op: "decide", message_id: messageId, action_id: actionId, approve });
  afterChange(res.changed);
  return res.message;
}

/** Removes every file you uploaded to the agent (used before deleting an account). */
export async function deleteAllMyAgentFiles(): Promise<void> {
  try {
    const id = await userId();
    for (let i = 0; i < 20; i++) {
      const { data } = await supabase.storage.from(AGENT_BUCKET).list(id, { limit: 100 });
      if (!data?.length) return;
      await supabase.storage.from(AGENT_BUCKET).remove(data.map((f) => `${id}/${f.name}`));
      if (data.length < 100) return;
    }
  } catch {
    /* storage not set up: nothing to remove */
  }
}

/** Every chat and message, for "Export my data". */
export async function exportMyChats(): Promise<{ conversation: string; date: string; role: string; message: string; files: string }[]> {
  const { data, error } = await supabase
    .from("agent_messages")
    .select("role, content, attachments, created_at, agent_conversations(title)")
    .order("created_at", { ascending: true })
    .limit(5000);
  if (error) return [];
  return (data ?? []).map((m: any) => ({
    conversation: (Array.isArray(m.agent_conversations) ? m.agent_conversations[0]?.title : m.agent_conversations?.title) ?? "",
    date: m.created_at,
    role: m.role,
    message: m.content,
    files: (m.attachments ?? []).map((f: AgentFile) => f.name).join("; "),
  }));
}
