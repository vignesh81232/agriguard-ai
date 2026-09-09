import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Browser-native speech recognition (Web Speech API). Chrome/Edge only —
 * Firefox/Safari return `supported === false` and the UI must hide the mic.
 */

interface SpeechRecognitionLike {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  continuous: boolean;
  onresult: ((e: SpeechRecognitionEventLike) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error?: string }) => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}

interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: ArrayLike<{
    isFinal: boolean;
    0: { transcript: string };
  }>;
}

type RecognitionConstructor = new () => SpeechRecognitionLike;

function getRecognitionCtor(): RecognitionConstructor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    webkitSpeechRecognition?: RecognitionConstructor;
    SpeechRecognition?: RecognitionConstructor;
  };
  return w.webkitSpeechRecognition ?? w.SpeechRecognition ?? null;
}

export function isSpeechSupported(): boolean {
  return getRecognitionCtor() !== null;
}

export interface SpeechRecognitionState {
  supported: boolean;
  listening: boolean;
  transcript: string;
  error: string | null;
  start: () => void;
  stop: () => void;
}

export function useSpeechRecognition(lang: string, onFinal?: (transcript: string) => void) {
  const [supported] = useState<boolean>(isSpeechSupported());
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [error, setError] = useState<string | null>(null);
  const recRef = useRef<SpeechRecognitionLike | null>(null);
  const onFinalRef = useRef(onFinal);
  onFinalRef.current = onFinal;

  const stop = useCallback(() => {
    recRef.current?.stop();
    setListening(false);
  }, []);

  const start = useCallback(() => {
    if (!supported) return;
    try {
      const ctor = getRecognitionCtor();
      if (!ctor) return;
      const rec = new ctor();
      rec.lang = lang;
      rec.interimResults = true;
      rec.continuous = false;
      rec.maxAlternatives = 1;

      rec.onresult = (e) => {
        let interim = "";
        let final = "";
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const r = e.results[i];
          const txt = r[0]?.transcript ?? "";
          if (r.isFinal) final += txt;
          else interim += txt;
        }
        setTranscript(final || interim);
        if (final) onFinalRef.current?.(final);
      };

      rec.onend = () => setListening(false);
      rec.onerror = (err) => {
        if (err.error === "aborted" || err.error === "no-speech") {
          setError(null);
        } else {
          setError(err.error ?? "speech-error");
        }
        setListening(false);
      };

      recRef.current = rec;
      setTranscript("");
      setError(null);
      setListening(true);
      rec.start();
    } catch {
      setError("start-error");
      setListening(false);
    }
  }, [supported, lang]);

  useEffect(() => {
    return () => {
      recRef.current?.abort();
    };
  }, []);

  return { supported, listening, transcript, error, start, stop };
}