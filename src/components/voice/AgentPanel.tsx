"use client";

// Spec 0004: the native AI front desk, text or voice. The server owns every
// limit; this panel only starts, chats, and ends the session.
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Button } from "../ui/button";
import { Card } from "../ui/card";
import { type Limits, textOf, useVoiceLoop } from "./useVoiceLoop";

type Lang = "EN" | "HI";
type Mode = "VOICE" | "TEXT";

const T = {
  EN: {
    title: "AI Front Desk",
    notice:
      "An AI service (Groq) processes what you type to answer you. Nothing is recorded or stored.",
    start: "Start chat",
    starting: "Starting...",
    placeholder: "Type your message",
    send: "Send",
    end: "End chat",
    ended: "This chat has ended.",
    again: "Start a new chat",
    form: "Use the booking form",
    limit: "You have used today's chats. Try again after",
    unavailable: "This clinic is not taking chats right now.",
    failed: "Could not start the chat. Please try again.",
    error: "Something went wrong. You can use the booking form.",
    voice: "Voice",
    text: "Text",
    voiceNotice:
      "An AI service (Groq) processes what you say to answer you. Nothing is recorded or stored.",
    noMic: "We could not use your microphone.",
    continueText: "Continue in text",
    loading: "Getting the mic ready...",
    listening: "Listening. Speak when you are ready.",
    thinking: "Thinking...",
    speaking: "Speaking...",
    off: "The mic is off. You can keep typing.",
    warn: "About one minute left in this voice chat.",
    noVoice:
      "Your browser has no voice for this language. Read the replies below.",
    voiceUnavailable: "Voice is not available right now. You can keep typing.",
    uploads: "This chat has reached its voice limit. You can keep typing.",
    heard: "Sorry, I could not hear that. Please try again.",
  },
  HI: {
    title: "AI फ्रंट डेस्क",
    notice:
      "आपको जवाब देने के लिए आपका लिखा हुआ एक AI सेवा (Groq) प्रोसेस करती है। कुछ भी रिकॉर्ड या सेव नहीं किया जाता।",
    start: "चैट शुरू करें",
    starting: "शुरू हो रहा है...",
    placeholder: "अपना संदेश लिखें",
    send: "भेजें",
    end: "चैट खत्म करें",
    ended: "यह चैट खत्म हो गई है।",
    again: "नई चैट शुरू करें",
    form: "बुकिंग फ़ॉर्म इस्तेमाल करें",
    limit: "आज की चैट पूरी हो गईं। फिर से कोशिश करें",
    unavailable: "यह क्लिनिक अभी चैट नहीं ले रहा है।",
    failed: "चैट शुरू नहीं हो सकी। फिर से कोशिश करें।",
    error: "कुछ गड़बड़ हो गई। आप बुकिंग फ़ॉर्म इस्तेमाल कर सकते हैं।",
    voice: "आवाज़",
    text: "लिखकर",
    voiceNotice:
      "आपको जवाब देने के लिए आपकी आवाज़ एक AI सेवा (Groq) प्रोसेस करती है। कुछ भी रिकॉर्ड या सेव नहीं किया जाता।",
    noMic: "आपका माइक्रोफ़ोन इस्तेमाल नहीं हो सका।",
    continueText: "लिखकर जारी रखें",
    loading: "माइक तैयार हो रहा है...",
    listening: "सुन रहे हैं। जब तैयार हों, बोलें।",
    thinking: "सोच रहे हैं...",
    speaking: "बोल रहे हैं...",
    off: "माइक बंद है। आप लिखकर जारी रख सकते हैं।",
    warn: "इस वॉइस चैट में लगभग एक मिनट बचा है।",
    noVoice: "आपके ब्राउज़र में इस भाषा की आवाज़ नहीं है। जवाब नीचे पढ़ें।",
    voiceUnavailable: "आवाज़ अभी उपलब्ध नहीं है। आप लिखकर जारी रख सकते हैं।",
    uploads: "इस चैट की आवाज़ सीमा पूरी हो गई। आप लिखकर जारी रख सकते हैं।",
    heard: "माफ़ कीजिए, सुनाई नहीं दिया। फिर से बोलें।",
  },
} as const;

const NO_LIMITS: Limits = { voiceSeconds: 0, warnAtSeconds: 0 };

let pendingLeave: number | undefined;

function endBeacon(sessionId: string) {
  navigator.sendBeacon(
    "/api/agent/session/end",
    JSON.stringify({ sessionId, reason: "ABANDONED" }),
  );
}

function LangPicker({
  lang,
  onChange,
}: {
  lang: Lang;
  onChange: (l: Lang) => void;
}) {
  return (
    <div className="flex gap-1" role="group" aria-label="Language">
      {(["EN", "HI"] as const).map((l) => (
        <Button
          key={l}
          size="sm"
          variant={lang === l ? "default" : "outline"}
          aria-pressed={lang === l}
          onClick={() => onChange(l)}
        >
          {l === "EN" ? "English" : "हिन्दी"}
        </Button>
      ))}
    </div>
  );
}

function Chat({
  sessionId,
  lang,
  setLang,
  voice,
  onEnded,
}: {
  sessionId: string;
  lang: Lang;
  setLang: (l: Lang) => void;
  voice: Limits | null;
  onEnded: () => void;
}) {
  const t = T[lang];
  const langRef = useRef(lang);
  langRef.current = lang;
  const [input, setInput] = useState("");
  const box = useRef<HTMLDivElement>(null);
  const form = useRef<HTMLFormElement>(null);

  const [transport] = useState(
    () =>
      new DefaultChatTransport({
        api: "/api/agent/chat",
        body: () => ({ sessionId, language: langRef.current }),
      }),
  );
  const { messages, sendMessage, status, error } = useChat({
    id: sessionId,
    transport,
  });

  // A 409 means the server ended the session (limit or provider error).
  useEffect(() => {
    if (error?.message.includes("endReason")) onEnded();
  }, [error, onEnded]);

  // Bring the input into view once, then keep the newest message visible
  // inside the box without moving the page.
  useEffect(() => {
    form.current?.scrollIntoView({ block: "end", behavior: "smooth" });
  }, []);
  useEffect(() => {
    const el = box.current;
    if (el && messages.length) el.scrollTop = el.scrollHeight;
  }, [messages]);

  // Leaving the page or the route ends the session as ABANDONED. An ended
  // session ignores it. The unmount beacon waits a tick so StrictMode's
  // test remount in dev cancels it.
  useEffect(() => {
    clearTimeout(pendingLeave);
    const leave = () => endBeacon(sessionId);
    window.addEventListener("pagehide", leave);
    return () => {
      window.removeEventListener("pagehide", leave);
      pendingLeave = window.setTimeout(leave, 0);
    };
  }, [sessionId]);

  const busy = status === "submitted" || status === "streaming";

  // Past the voice cap the end route records TIME_LIMIT, not COMPLETED.
  async function end() {
    await fetch("/api/agent/session/end", {
      method: "POST",
      body: JSON.stringify({ sessionId, reason: "COMPLETED" }),
    }).catch(() => {});
    onEnded();
  }

  const v = useVoiceLoop({
    on: voice !== null,
    sessionId,
    lang,
    limits: voice ?? NO_LIMITS,
    messages,
    status,
    send: (text) => sendMessage({ text }),
    onEnded,
    onTimeUp: end,
  });

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <LangPicker lang={lang} onChange={setLang} />
        <Button variant="outline" size="sm" onClick={end}>
          {t.end}
        </Button>
      </div>

      {v.phase && (
        <div className="space-y-1 text-sm" aria-live="polite">
          <p className="font-medium">{t[v.phase]}</p>
          {v.warn && <p className="text-amber-600">{t.warn}</p>}
          {v.note && <p className="text-muted-foreground">{t[v.note]}</p>}
        </div>
      )}

      <div
        ref={box}
        className="h-[45vh] min-h-48 overflow-y-auto rounded-md border p-3 space-y-2"
        aria-live="polite"
      >
        {messages.map((m) => (
          <div
            key={m.id}
            className={`max-w-[85%] w-fit rounded-lg px-3 py-2 text-sm whitespace-pre-wrap ${
              m.role === "user"
                ? "ml-auto bg-primary text-primary-foreground"
                : "bg-muted"
            }`}
          >
            {textOf(m)}
          </div>
        ))}
        {status === "submitted" && (
          <div className="bg-muted w-fit rounded-lg px-3 py-2 text-sm">...</div>
        )}
        {error && !error.message.includes("endReason") && (
          <p className="text-sm text-destructive">
            {t.error} <Link href="/appointments">/appointments</Link>
          </p>
        )}
      </div>

      <form
        ref={form}
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          const text = input.trim();
          if (!text || busy) return;
          sendMessage({ text });
          setInput("");
        }}
      >
        <input
          className="flex-1 rounded-md border bg-background px-3 py-2 text-sm"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={t.placeholder}
          maxLength={1000}
          aria-label={t.placeholder}
        />
        <Button type="submit" disabled={busy || !input.trim()}>
          {t.send}
        </Button>
      </form>
    </div>
  );
}

export default function AgentPanel({ clinicSlug }: { clinicSlug: string }) {
  const [lang, setLang] = useState<Lang>("EN");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [ended, setEnded] = useState(false);
  const [starting, setStarting] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>("VOICE");
  const [noMic, setNoMic] = useState(false);
  const [voice, setVoice] = useState<Limits | null>(null);
  const t = T[lang];

  useEffect(() => {
    if (navigator.language.toLowerCase().startsWith("hi")) setLang("HI");
  }, []);

  async function start() {
    setStarting(true);
    setProblem(null);
    setNoMic(false);
    try {
      // AC-12: check the mic before creating a session, so a denied mic
      // costs no chat from today's allowance.
      if (mode === "VOICE") {
        const stream = await navigator.mediaDevices
          ?.getUserMedia({ audio: true })
          .catch(() => null);
        if (!stream) return setNoMic(true);
        for (const track of stream.getTracks()) track.stop();
      }
      const res = await fetch("/api/agent/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clinicSlug, channel: mode, language: lang }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setSessionId(data.sessionId);
        setVoice(mode === "VOICE" ? data.limits : null);
        setEnded(false);
      } else if (res.status === 429)
        setProblem(`${t.limit} ${new Date(data.resetsAt).toLocaleString()}`);
      else if (res.status === 404) setProblem(t.unavailable);
      else setProblem(t.failed);
    } catch {
      setProblem(t.failed);
    } finally {
      setStarting(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-4 pb-16">
      <Card className="p-4 sm:p-6 gap-4">
        <h2 className="text-xl font-bold">{t.title}</h2>

        {sessionId && !ended ? (
          <Chat
            sessionId={sessionId}
            lang={lang}
            setLang={setLang}
            voice={voice}
            onEnded={() => setEnded(true)}
          />
        ) : (
          <div className="flex flex-col gap-3">
            {ended && <p className="text-sm">{t.ended}</p>}
            <div className="flex flex-wrap gap-3">
              <LangPicker lang={lang} onChange={setLang} />
              <div className="flex gap-1" role="group" aria-label="Mode">
                {(["VOICE", "TEXT"] as const).map((m) => (
                  <Button
                    key={m}
                    size="sm"
                    variant={mode === m ? "default" : "outline"}
                    aria-pressed={mode === m}
                    onClick={() => setMode(m)}
                  >
                    {m === "VOICE" ? t.voice : t.text}
                  </Button>
                ))}
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              {mode === "VOICE" ? t.voiceNotice : t.notice}
            </p>
            {problem && (
              <p className="text-sm text-destructive" role="alert">
                {problem}
              </p>
            )}
            {noMic && (
              <div className="flex flex-wrap items-center gap-2" role="alert">
                <p className="text-sm text-destructive">{t.noMic}</p>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setMode("TEXT");
                    setNoMic(false);
                  }}
                >
                  {t.continueText}
                </Button>
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              <Button onClick={start} disabled={starting}>
                {starting ? t.starting : ended ? t.again : t.start}
              </Button>
              <Button variant="outline" asChild>
                <Link href="/appointments">{t.form}</Link>
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
