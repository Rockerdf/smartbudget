// Voice for the AI agent: "Hey Smartie" wake word, dictation and spoken replies.
// Uses the browser's built-in speech recognition (Chrome, Edge, Safari) and
// speech synthesis. Nothing is listened to unless the person turns it on, and it
// only listens while a SmartBudget tab is open and visible.

/* Minimal typing for the Web Speech API (not in TypeScript's DOM library). */
export type SpeechResultEvent = {
  resultIndex: number;
  results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }>;
};
export type Recognizer = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((e: SpeechResultEvent) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
};

export function createRecognizer(): Recognizer | null {
  const w = window as unknown as { SpeechRecognition?: new () => Recognizer; webkitSpeechRecognition?: new () => Recognizer };
  const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
  if (!Ctor) return null;
  const r = new Ctor();
  r.lang = navigator.language?.startsWith("en") ? navigator.language : "en-AU";
  return r;
}

export const voiceSupported = () =>
  typeof window !== "undefined" && !!((window as unknown as Record<string, unknown>).SpeechRecognition || (window as unknown as Record<string, unknown>).webkitSpeechRecognition);

// Speech recognition hears "Smartie" many ways.
const WAKE = /\b(?:hey|hi|ok|okay|hello)?[\s,]*(smartie|smarty|smarti|smart\s?e|smart\s?ee|smart\s?y|smartee|smartey|marty)\b[\s,.!?]*/i;

/** Returns null when the wake word isn't there, otherwise whatever was said after it. */
export function afterWakeWord(text: string): string | null {
  const m = WAKE.exec(text);
  if (!m) return null;
  // "marty" alone is too common; only accept it right after hey/hi/ok.
  if (/^marty$/i.test(m[1]) && !/\b(hey|hi|ok|okay|hello)\b/i.test(m[0])) return null;
  return text.slice(m.index + m[0].length).trim();
}

// ── Preferences (this device only) ──────────────────────────────────────────
const WAKE_KEY = "sb_wake_word";
const SPEAK_KEY = "sb_speak_replies";
const read = (k: string, d: boolean) => { try { const v = localStorage.getItem(k); return v === null ? d : v === "1"; } catch { return d; } };
const write = (k: string, v: boolean) => { try { localStorage.setItem(k, v ? "1" : "0"); } catch { /* ignore */ } };
export const VOICE_PREFS_CHANGED = "sb-voice-prefs";
export const getWakeEnabled = () => read(WAKE_KEY, false);
export const setWakeEnabled = (v: boolean) => { write(WAKE_KEY, v); window.dispatchEvent(new Event(VOICE_PREFS_CHANGED)); };
export const getSpeakReplies = () => read(SPEAK_KEY, true);
export const setSpeakReplies = (v: boolean) => { write(SPEAK_KEY, v); window.dispatchEvent(new Event(VOICE_PREFS_CHANGED)); };

// Only one microphone session can run at a time, so the wake word pauses while
// the AI Agent page's dictation button is in use.
let dictating = false;
export const isDictating = () => dictating;
export function setDictating(v: boolean) { dictating = v; window.dispatchEvent(new Event(VOICE_PREFS_CHANGED)); }

// ── Speaking replies ────────────────────────────────────────────────────────
function plain(md: string) {
  return md
    .replace(/```[\s\S]*?```/g, "")
    .replace(/\|/g, ", ")
    .replace(/[*_`#>]/g, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/^\s*[-•]\s+/gm, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 900);
}

export function speak(text: string, onEnd?: () => void) {
  if (!("speechSynthesis" in window)) { onEnd?.(); return; }
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(plain(text));
  const voices = window.speechSynthesis.getVoices();
  u.voice = voices.find((v) => v.lang === "en-AU") ?? voices.find((v) => v.lang.startsWith("en") && /female|samantha|karen|google/i.test(v.name)) ?? voices.find((v) => v.lang.startsWith("en")) ?? null;
  u.rate = 1.03;
  u.onend = () => onEnd?.();
  u.onerror = () => onEnd?.();
  window.speechSynthesis.speak(u);
}

export function stopSpeaking() {
  if ("speechSynthesis" in window) window.speechSynthesis.cancel();
}

// ── Opening a chat on the AI Agent page from elsewhere ──────────────────────
const OPEN_KEY = "sb_agent_open";
export function requestOpenChat(conversationId: string) {
  try { sessionStorage.setItem(OPEN_KEY, conversationId); } catch { /* ignore */ }
}
export function takeOpenChatRequest(): string | null {
  try { const v = sessionStorage.getItem(OPEN_KEY); sessionStorage.removeItem(OPEN_KEY); return v; } catch { return null; }
}
