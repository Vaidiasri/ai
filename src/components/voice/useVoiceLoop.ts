"use client";

// Spec 0004 voice mode: end of speech in the browser (Silero VAD), upload to
// /api/agent/transcribe, send the text as a chat turn, then speak the reply
// sentence by sentence. The mic listens only when nothing else is happening,
// so the agent never hears itself. The server stays authoritative on limits.
import type { MicVAD } from "@ricky0123/vad-web";
import type { ChatStatus, UIMessage } from "ai";
import { useEffect, useRef, useState } from "react";
import { takeSentences } from "@/lib/agent/sentences";

// Pinned to the installed versions; keeps ~10 MB of model and wasm out of the
// repo. Only static files come from the CDN, never patient audio.
const VAD_ASSETS =
  "https://cdn.jsdelivr.net/npm/@ricky0123/vad-web@0.0.31/dist/";
const ORT_ASSETS = "https://cdn.jsdelivr.net/npm/onnxruntime-web@1.30.0/dist/";

type Lang = "EN" | "HI";
export type VoiceNote = "noVoice" | "voiceUnavailable" | "uploads" | "heard";
export type Limits = { voiceSeconds: number; warnAtSeconds: number };

function pickVoice(lang: Lang) {
  const voices = speechSynthesis.getVoices();
  if (lang === "HI")
    return voices.find((v) => v.lang.toLowerCase().startsWith("hi")) ?? null;
  return (
    voices.find((v) => v.lang.replace("_", "-") === "en-IN") ??
    voices.find((v) => v.lang.toLowerCase().startsWith("en")) ??
    null
  );
}

// destroy() rejects on a VAD whose mic stream never started.
function destroy(v: MicVAD | null) {
  v?.destroy().catch(() => {});
}

// A reply with a tool call in the middle has one text part per step; a newline
// keeps the steps from running together on screen and in speech.
export const textOf = (m: UIMessage) =>
  m.parts.flatMap((p) => (p.type === "text" ? [p.text] : [])).join("\n");

export function useVoiceLoop(opts: {
  on: boolean;
  sessionId: string;
  lang: Lang;
  limits: Limits;
  messages: UIMessage[];
  status: ChatStatus;
  send: (text: string) => void;
  onEnded: () => void;
  onTimeUp: () => void;
}) {
  const { on, messages, status, limits } = opts;
  const latest = useRef(opts);
  latest.current = opts;

  const vad = useRef<MicVAD | null>(null);
  const [ready, setReady] = useState(false);
  const [stopped, setStopped] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [pending, setPending] = useState(0);
  const [warn, setWarn] = useState(false);
  const [note, setNote] = useState<VoiceNote | null>(null);
  const spoken = useRef({ id: "", upto: 0 });

  // Load the VAD once. Its callbacks read the latest props through the ref.
  useEffect(() => {
    if (!on) return;
    let cancelled = false;
    speechSynthesis.getVoices();
    (async () => {
      try {
        const { MicVAD, utils } = await import("@ricky0123/vad-web");
        const created = await MicVAD.new({
          model: "v5",
          baseAssetPath: VAD_ASSETS,
          onnxWASMBasePath: ORT_ASSETS,
          startOnLoad: false,
          onSpeechEnd: async (audio) => {
            setTranscribing(true);
            const { sessionId, lang, send, onEnded } = latest.current;
            const form = new FormData();
            form.append(
              "audio",
              new Blob([utils.encodeWAV(audio, 1, 16000, 1, 16)], {
                type: "audio/wav",
              }),
              "turn.wav",
            );
            form.append("sessionId", sessionId);
            form.append("language", lang);
            const res = await fetch("/api/agent/transcribe", {
              method: "POST",
              body: form,
            }).catch(() => null);
            const data = await res?.json().catch(() => ({}));
            if (res?.ok && data.text) send(data.text);
            else if (res?.status === 409 && data.endReason) onEnded();
            else if (res?.status === 409) {
              setNote("uploads");
              setStopped(true);
            } else if (!res?.ok) setNote("heard");
            setTranscribing(false);
          },
        });
        if (cancelled) return destroy(created);
        vad.current = created;
        setReady(true);
      } catch {
        if (!cancelled) {
          setNote("voiceUnavailable");
          setStopped(true);
        }
      }
    })();
    return () => {
      cancelled = true;
      destroy(vad.current);
      vad.current = null;
      setReady(false);
      speechSynthesis.cancel();
    };
  }, [on]);

  // Listen only when idle: not uploading, not waiting on a reply, not speaking.
  useEffect(() => {
    const v = vad.current;
    if (!v || !ready) return;
    const want =
      !stopped &&
      !transcribing &&
      pending === 0 &&
      status !== "submitted" &&
      status !== "streaming";
    // start() asks for the mic again, which fails if it was unplugged.
    if (want && !v.listening)
      v.start().catch(() => {
        setNote("voiceUnavailable");
        setStopped(true);
      });
    if (!want && v.listening) v.pause().catch(() => {});
  }, [ready, stopped, transcribing, pending, status]);

  // Speak each finished sentence of the newest reply as it streams in.
  useEffect(() => {
    if (!on) return;
    const last = messages.at(-1);
    if (last?.role !== "assistant") return;
    if (last.id !== spoken.current.id)
      spoken.current = { id: last.id, upto: 0 };
    const text = textOf(last);
    const done = status !== "streaming";
    const { sentences, rest } = takeSentences(text.slice(spoken.current.upto));
    if (done && rest.trim()) sentences.push(rest.trim());
    spoken.current.upto = done ? text.length : text.length - rest.length;
    if (!sentences.length) return;

    const voice = pickVoice(latest.current.lang);
    if (!voice) return setNote("noVoice");
    for (const s of sentences) {
      const u = new SpeechSynthesisUtterance(s.replace(/[*_#`]/g, ""));
      u.voice = voice;
      u.lang = voice.lang;
      u.onend = u.onerror = () => setPending((n) => Math.max(0, n - 1));
      setPending((n) => n + 1);
      speechSynthesis.speak(u);
    }
  }, [on, messages, status]);

  // Warn banner, then stop the mic at the cap. The server records TIME_LIMIT.
  useEffect(() => {
    if (!on) return;
    const warnAt = setTimeout(() => setWarn(true), limits.warnAtSeconds * 1000);
    const stopAt = setTimeout(() => {
      setStopped(true);
      speechSynthesis.cancel();
      latest.current.onTimeUp();
    }, limits.voiceSeconds * 1000);
    return () => {
      clearTimeout(warnAt);
      clearTimeout(stopAt);
    };
  }, [on, limits]);

  const phase = !on
    ? null
    : stopped
      ? "off"
      : !ready
        ? "loading"
        : transcribing || status === "submitted"
          ? "thinking"
          : pending > 0 || status === "streaming"
            ? "speaking"
            : "listening";
  return { phase, warn, note } as const;
}
