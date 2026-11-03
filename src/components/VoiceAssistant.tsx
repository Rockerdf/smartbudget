import { useCallback, useEffect, useRef, useState } from "react";
import type { Screen } from "../App";
import { sendToAgent } from "../lib/agent";
import type { AgentMessage } from "../lib/agent";
import {
  afterWakeWord, createRecognizer, getSpeakReplies, isDictating, getWakeEnabled, requestOpenChat, setSpeakReplies, setWakeEnabled,
  speak, stopSpeaking, voiceSupported, VOICE_PREFS_CHANGED,
} from "../lib/voice";
import type { Recognizer } from "../lib/voice";
import { AssistantMessage } from "../screens/Agent";

// "Hey Smartie": a Siri-style pop-up for the AI agent. Opened by saying the wake
// word (when switched on), by the mic button in the header, or Ctrl + Shift + Space.

export const OPEN_VOICE_EVENT = "sb-open-voice";
export const openVoice = () => window.dispatchEvent(new Event(OPEN_VOICE_EVENT));
export const OPEN_CHAT_EVENT = "sb-open-chat";

type Phase = "ready" | "listening" | "thinking" | "answered" | "error";
type Props = { navigate: (s: Screen) => void; agentScreen: Screen; userName: string };

const CONV_KEY = "sb_voice_conversation";
const voiceConversation = () => {
  try {
    let id = sessionStorage.getItem(CONV_KEY);
    if (!id) { id = crypto.randomUUID(); sessionStorage.setItem(CONV_KEY, id); }
    return id;
  } catch { return crypto.randomUUID(); }
};

function MicIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="9" y="2" width="6" height="12" rx="3" /><path d="M5 10v1a7 7 0 0 0 14 0v-1" /><line x1="12" y1="18" x2="12" y2="22" />
    </svg>
  );
}

/** Header button that opens the pop-up. */
export function VoiceButton() {
  return (
    <button type="button" onClick={openVoice} aria-label="Talk to Smartie" title="Talk to Smartie (Ctrl + Shift + Space)"
      className="w-8 h-8 rounded-xl flex items-center justify-center text-[#64748B] hover:bg-[#F1F5F9] hover:text-[#2563EB] transition-colors">
      <MicIcon size={16} />
    </button>
  );
}

function Orb({ phase }: { phase: Phase }) {
  const active = phase === "listening";
  const thinking = phase === "thinking";
  return (
    <div className="relative w-28 h-28 mx-auto" aria-hidden="true">
      <div className={`absolute inset-0 rounded-full bg-gradient-to-br from-[#60A5FA] via-[#7C3AED] to-[#EC4899] blur-xl opacity-70 ${active ? "animate-pulse" : ""}`} />
      <div className={`absolute inset-2 rounded-full bg-gradient-to-br from-[#2563EB] via-[#7C3AED] to-[#DB2777] ${thinking ? "animate-spin" : ""}`} style={thinking ? { animationDuration: "2.5s" } : undefined} />
      <div className="absolute inset-[18px] rounded-full bg-[#0F172A]/25 backdrop-blur-sm flex items-center justify-center text-white">
        {thinking ? (
          <span className="flex gap-1"><span className="w-1.5 h-1.5 rounded-full bg-white animate-bounce [animation-delay:-0.3s]" /><span className="w-1.5 h-1.5 rounded-full bg-white animate-bounce [animation-delay:-0.15s]" /><span className="w-1.5 h-1.5 rounded-full bg-white animate-bounce" /></span>
        ) : active ? (
          <span className="flex items-end gap-1 h-8">
            {[0, 1, 2, 3, 4].map((i) => <span key={i} className="w-1.5 rounded-full bg-white animate-pulse" style={{ height: `${[14, 26, 32, 22, 12][i]}px`, animationDelay: `${i * 0.12}s` }} />)}
          </span>
        ) : <MicIcon size={30} />}
      </div>
    </div>
  );
}

export default function VoiceAssistant({ navigate, agentScreen, userName }: Props) {
  const supported = voiceSupported();
  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState<Phase>("ready");
  const [live, setLive] = useState("");
  const [question, setQuestion] = useState("");
  const [reply, setReply] = useState<AgentMessage | null>(null);
  const [error, setError] = useState("");
  const [typed, setTyped] = useState("");
  const [wakeOn, setWakeOn] = useState(getWakeEnabled);
  const [speakOn, setSpeakOn] = useState(getSpeakReplies);
  const [visible, setVisible] = useState(() => document.visibilityState === "visible");
  const [micBlocked, setMicBlocked] = useState(false);
  const [dictating, setDictatingState] = useState(isDictating);

  const rec = useRef<Recognizer | null>(null);
  const mode = useRef<"off" | "wake" | "command">("off");
  const commandTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const phaseRef = useRef<Phase>("ready");
  phaseRef.current = phase;
  const openRef = useRef(false);
  openRef.current = open;
  const ask = useRef<(text: string) => void>(() => {});

  useEffect(() => {
    const sync = () => { setWakeOn(getWakeEnabled()); setSpeakOn(getSpeakReplies()); setDictatingState(isDictating()); };
    const vis = () => setVisible(document.visibilityState === "visible");
    window.addEventListener(VOICE_PREFS_CHANGED, sync);
    document.addEventListener("visibilitychange", vis);
    return () => { window.removeEventListener(VOICE_PREFS_CHANGED, sync); document.removeEventListener("visibilitychange", vis); };
  }, []);

  const stopRec = useCallback(() => {
    mode.current = "off";
    if (commandTimer.current) clearTimeout(commandTimer.current);
    const r = rec.current;
    rec.current = null;
    if (r) { r.onend = null; r.onresult = null; r.onerror = null; try { r.abort(); } catch { /* already stopped */ } }
  }, []);

  /** Starts the microphone: "wake" waits for "Hey Smartie", "command" captures one request. */
  const startRec = useCallback((m: "wake" | "command") => {
    stopRec();
    const r = createRecognizer();
    if (!r) return;
    r.continuous = true;
    r.interimResults = true;
    mode.current = m;
    let heard = "";
    if (m === "command") {
      setLive("");
      setPhase("listening");
      commandTimer.current = setTimeout(() => {
        if (mode.current === "command" && !heard.trim()) {
          stopRec();
          setPhase("ready");
          setError("I didn't hear anything. Tap the mic and try again.");
        }
      }, 8000);
    }
    r.onresult = (e) => {
      let interim = "";
      let finalText = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) finalText += t; else interim += t;
      }
      if (mode.current === "wake") {
        const said = finalText || interim;
        const rest = afterWakeWord(said);
        if (rest === null) return;
        // Wake word heard: open the pop-up and keep listening for the request.
        mode.current = "command";
        heard = "";
        setOpen(true);
        setReply(null);
        setError("");
        setPhase("listening");
        setLive(rest);
        if (finalText && rest) { heard = rest; stopRec(); ask.current(rest); }
        else {
          commandTimer.current = setTimeout(() => {
            if (mode.current === "command" && !heard.trim()) { stopRec(); setPhase("ready"); setError("I didn't catch that. Tap the mic and try again."); }
          }, 8000);
        }
        return;
      }
      if (mode.current === "command") {
        const cleaned = (t: string) => { const after = afterWakeWord(t); return (after ?? t).trim(); };
        if (interim) setLive(cleaned(heard + " " + interim));
        if (finalText) {
          heard = cleaned(heard + " " + finalText);
          setLive(heard);
          if (heard) { stopRec(); ask.current(heard); }
        }
      }
    };
    r.onerror = (e) => {
      if (e.error === "not-allowed" || e.error === "service-not-allowed") {
        setMicBlocked(true);
        setWakeEnabled(false);
        stopRec();
        if (openRef.current) { setPhase("error"); setError("Microphone access is blocked. Allow the microphone for this site in your browser’s address bar, then try again."); }
      }
    };
    r.onend = () => {
      // Browsers end long sessions on their own; carry on while we still should.
      if (rec.current !== r) return;
      const m2 = mode.current;
      rec.current = null;
      if (m2 === "off") return;
      setTimeout(() => { if (mode.current === m2 && !rec.current) startRec(m2); }, 250);
    };
    rec.current = r;
    try { r.start(); } catch { /* already started */ }
  }, [stopRec]);

  // Listen for the wake word whenever it's switched on, the tab is visible and the pop-up isn't busy.
  useEffect(() => {
    if (!supported) return;
    const shouldWake = wakeOn && visible && !dictating && (!open || phaseRef.current === "answered" || phaseRef.current === "ready");
    if (shouldWake && mode.current !== "command") { if (mode.current !== "wake") startRec("wake"); }
    else if (!shouldWake && mode.current === "wake") stopRec();
  }, [supported, wakeOn, visible, dictating, open, phase, startRec, stopRec]);

  useEffect(() => () => { stopRec(); stopSpeaking(); }, [stopRec]);

  ask.current = async (text: string) => {
    const q = text.trim();
    if (!q) return;
    stopRec();
    stopSpeaking();
    setQuestion(q);
    setLive("");
    setTyped("");
    setReply(null);
    setError("");
    setPhase("thinking");
    try {
      const res = await sendToAgent({ conversationId: voiceConversation(), message: q, attachments: [] });
      const bot = res.messages.find((m) => m.role === "assistant") ?? null;
      setReply(bot);
      setPhase("answered");
      if (bot && speakOn && bot.content) speak(bot.content);
    } catch (e) {
      setPhase("error");
      setError(e instanceof Error ? e.message : "Smartie couldn't answer. Please try again.");
    }
  };

  const listenNow = () => {
    if (!supported) return;
    stopSpeaking();
    setError("");
    setReply(null);
    setQuestion("");
    startRec("command");
  };

  const show = useCallback((startListening: boolean) => {
    setOpen(true);
    setError("");
    if (startListening && supported) { setReply(null); setQuestion(""); startRec("command"); }
    else setPhase((p) => (p === "thinking" ? p : "ready"));
  }, [supported, startRec]);

  const close = useCallback(() => {
    stopRec();
    stopSpeaking();
    setOpen(false);
    setPhase("ready");
    setLive("");
  }, [stopRec]);

  useEffect(() => {
    const onOpen = () => show(true);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === " " && e.ctrlKey && e.shiftKey) { e.preventDefault(); if (openRef.current) close(); else show(true); }
      if (e.key === "Escape" && openRef.current) close();
    };
    window.addEventListener(OPEN_VOICE_EVENT, onOpen);
    window.addEventListener("keydown", onKey);
    return () => { window.removeEventListener(OPEN_VOICE_EVENT, onOpen); window.removeEventListener("keydown", onKey); };
  }, [show, close]);

  const openInChat = () => {
    const id = voiceConversation();
    requestOpenChat(id);
    close();
    navigate(agentScreen);
    window.dispatchEvent(new Event(OPEN_CHAT_EVENT));
  };

  const toggleWake = (v: boolean) => {
    setMicBlocked(false);
    setWakeEnabled(v);
    if (!v) stopRec();
  };

  const status =
    phase === "listening" ? (live ? "" : "Listening…")
    : phase === "thinking" ? "Thinking…"
    : phase === "answered" ? ""
    : wakeOn ? "Say “Hey Smartie”, tap the mic, or type below" : "Tap the mic and ask, or type below";

  return (
    <>
      {/* Small "listening" indicator so it is always clear the mic is on */}
      {wakeOn && supported && !open && (
        <button type="button" onClick={() => show(false)}
          className="fixed z-[55] right-4 bottom-[calc(76px+env(safe-area-inset-bottom))] md:bottom-5 flex items-center gap-2 pl-2.5 pr-3.5 py-2 rounded-full bg-[#0F172A] text-white text-xs font-semibold shadow-lg hover:bg-[#1E293B]"
          aria-label="Hey Smartie is listening. Open Smartie">
          <span className="relative flex w-2.5 h-2.5"><span className="absolute inline-flex w-full h-full rounded-full bg-[#F472B6] opacity-75 animate-ping" /><span className="relative inline-flex w-2.5 h-2.5 rounded-full bg-[#EC4899]" /></span>
          Hey Smartie is on
        </button>
      )}

      {open && (
        <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center p-0 sm:p-6" role="dialog" aria-modal="true" aria-label="Smartie voice assistant">
          <button type="button" aria-label="Close Smartie" className="absolute inset-0 bg-[#0F172A]/55 backdrop-blur-sm" onClick={close} />
          <div className="relative w-full sm:max-w-lg bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[88vh] flex flex-col overflow-hidden animate-up">
            <div className="flex items-center justify-between px-5 pt-4">
              <p className="text-xs font-bold uppercase tracking-widest text-[#7C3AED]">Smartie</p>
              <button type="button" onClick={close} aria-label="Close" className="w-8 h-8 rounded-full flex items-center justify-center text-[#64748B] hover:bg-[#F1F5F9]">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 pb-4">
              {!reply && phase !== "error" && (
                <div className="pt-4 pb-2 text-center">
                  <Orb phase={phase} />
                  {phase === "ready" && !question && <p className="text-xl font-bold text-[#0F172A] mt-5">Hi {userName.split(" ")[0] || "there"}, what can I do?</p>}
                  {live && <p className="text-2xl font-semibold text-[#0F172A] mt-5 leading-snug" aria-live="polite">“{live}”</p>}
                  {question && phase === "thinking" && <p className="text-lg font-semibold text-[#0F172A] mt-5">“{question}”</p>}
                  {status && <p className="text-sm text-[#64748B] mt-3" aria-live="polite">{status}</p>}
                  {!supported && <p className="text-xs text-[#92400E] bg-[#FFFBEB] rounded-xl px-3 py-2 mt-4">Voice isn’t available in this browser. Use Chrome, Edge or Safari for voice, or type your question below.</p>}
                </div>
              )}

              {phase === "error" && (
                <div className="pt-4 text-center">
                  <Orb phase="ready" />
                  <p className="text-sm text-[#B91C1C] bg-[#FEF2F2] border border-[#FECACA] rounded-xl px-4 py-3 mt-5" role="alert">{error}</p>
                </div>
              )}
              {phase !== "error" && error && <p className="text-sm text-[#92400E] bg-[#FFFBEB] rounded-xl px-4 py-2.5 mt-3 text-center" role="status">{error}</p>}

              {reply && (
                <div className="pt-3 space-y-4">
                  <div className="flex justify-end"><p className="bg-[#2563EB] text-white rounded-2xl rounded-br-md px-4 py-2.5 max-w-[85%] text-[15px]">{question}</p></div>
                  <AssistantMessage m={reply} navigate={(s) => { close(); navigate(s); }} onUpdate={setReply} onError={(e) => setError(e)} />
                </div>
              )}
            </div>

            <div className="border-t border-[#F1F5F9] px-4 pt-3 pb-[calc(12px+env(safe-area-inset-bottom))] space-y-3">
              <form className="flex items-center gap-2" onSubmit={(e) => { e.preventDefault(); void ask.current(typed); }}>
                <button type="button" onClick={phase === "listening" ? () => { stopRec(); setPhase("ready"); } : listenNow} disabled={!supported || phase === "thinking"}
                  aria-label={phase === "listening" ? "Stop listening" : "Speak"}
                  className={`w-11 h-11 shrink-0 rounded-full flex items-center justify-center text-white transition-colors disabled:opacity-40 ${phase === "listening" ? "bg-[#DB2777]" : "bg-gradient-to-br from-[#2563EB] to-[#7C3AED]"}`}>
                  <MicIcon size={20} />
                </button>
                <input value={typed} onChange={(e) => setTyped(e.target.value)} placeholder="Or type a question…" aria-label="Type a question"
                  className="flex-1 min-w-0 border border-[#E2E8F0] rounded-full px-4 py-2.5 text-sm outline-none focus:border-[#2563EB]" />
                <button type="submit" disabled={!typed.trim() || phase === "thinking"} className="text-sm font-semibold text-[#2563EB] disabled:text-[#94A3B8] px-2">Ask</button>
              </form>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-4 text-xs text-[#475569]">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input type="checkbox" checked={wakeOn} disabled={!supported} onChange={(e) => toggleWake(e.target.checked)} className="accent-[#2563EB]" />
                    Listen for “Hey Smartie”
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input type="checkbox" checked={speakOn} onChange={(e) => setSpeakReplies(e.target.checked)} className="accent-[#2563EB]" />
                    Read replies aloud
                  </label>
                </div>
                {(reply || question) && <button type="button" onClick={openInChat} className="text-xs font-semibold text-[#2563EB] hover:underline">Open in chat →</button>}
              </div>
              {micBlocked && <p className="text-[11px] text-[#B91C1C]">Microphone blocked. Allow it from the icon in your browser’s address bar.</p>}
              <p className="text-[10px] text-[#94A3B8] leading-relaxed">
                Only listens while this tab is open, and only when you switch it on. Your browser turns speech into text (Chrome sends audio to Google to do this). Not financial advice.
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
