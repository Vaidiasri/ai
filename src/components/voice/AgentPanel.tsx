"use client";

// Spec 0004: the native AI front desk, text mode. The server owns every limit;
// this panel only starts, chats, and ends the session.
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Button } from "../ui/button";
import { Card } from "../ui/card";

type Lang = "EN" | "HI";

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
  },
} as const;

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
  onEnded,
}: {
  sessionId: string;
  lang: Lang;
  setLang: (l: Lang) => void;
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

  async function end() {
    await fetch("/api/agent/session/end", {
      method: "POST",
      body: JSON.stringify({ sessionId, reason: "COMPLETED" }),
    }).catch(() => {});
    onEnded();
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <LangPicker lang={lang} onChange={setLang} />
        <Button variant="outline" size="sm" onClick={end}>
          {t.end}
        </Button>
      </div>

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
            {m.parts.map((p) => (p.type === "text" ? p.text : "")).join("")}
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
  const t = T[lang];

  useEffect(() => {
    if (navigator.language.toLowerCase().startsWith("hi")) setLang("HI");
  }, []);

  async function start() {
    setStarting(true);
    setProblem(null);
    try {
      const res = await fetch("/api/agent/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clinicSlug, channel: "TEXT", language: lang }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setSessionId(data.sessionId);
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
            onEnded={() => setEnded(true)}
          />
        ) : (
          <div className="flex flex-col gap-3">
            {ended && <p className="text-sm">{t.ended}</p>}
            <LangPicker lang={lang} onChange={setLang} />
            <p className="text-sm text-muted-foreground">{t.notice}</p>
            {problem && (
              <p className="text-sm text-destructive" role="alert">
                {problem}
              </p>
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
