import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useI18n } from "../i18n";
import { LANGUAGES, type TranslationKey } from "../i18n/translations";
import { getDisease, getLocalized } from "../data/diseases";
import { useSpeechRecognition } from "../hooks/useSpeechRecognition";
import {
  askAgronomist,
  type ChatDiagnosisContext,
  type ChatErrorKind,
  type ChatMessageDto,
} from "../lib/supabase";
import type { Diagnosis } from "../lib/diagnose";
import {
  AlertTriangleIcon,
  BotIcon,
  CheckCircleIcon,
  InfoIcon,
  MicIcon,
  SendIcon,
  XIcon,
} from "./icons";

/**
 * "Ask AI Agronomist" — right slide-over (desktop) / bottom sheet (mobile).
 * Full conversation history lives in React state only (nothing persisted).
 * Sends complete history to the Edge Function on every turn.
 */

interface Props {
  open: boolean;
  onClose: () => void;
  diagnosis: Diagnosis | null;
}

interface Msg {
  id: number;
  role: "user" | "assistant";
  content: string;
}

const ERROR_KEY: Record<ChatErrorKind, TranslationKey> = {
  offline: "chatErrorOffline",
  auth: "chatErrorAuth",
  rate: "chatErrorRate",
  server: "chatErrorServer",
  "anon-disabled": "chatErrorAuth",
  "not-configured": "chatErrorServer",
};

const FOCUSABLE =
  'button:not([disabled]), input:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export default function ChatDrawer({ open, onClose, diagnosis }: Props) {
  const { lang, t } = useI18n();

  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [waiting, setWaiting] = useState(false);
  const [error, setError] = useState<ChatErrorKind | null>(null);
  const [attachContext, setAttachContext] = useState(true);
  const [anonHint, setAnonHint] = useState(false);

  const idRef = useRef(0);
  const panelRef = useRef<HTMLElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const nextId = () => ++idRef.current;

  const speechLang = useMemo(
    () => LANGUAGES.find((l) => l.code === lang)?.speechLang ?? "en-US",
    [lang],
  );

  const speech = useSpeechRecognition(speechLang, (final) => {
    setInput((prev) => (prev ? `${prev} ${final}` : final));
  });

  // Context chip: localized disease name from the current diagnosis.
  const contextChip = useMemo(() => {
    if (!diagnosis) return null;
    const disease = getDisease(diagnosis.diseaseId);
    const localized = getLocalized(disease, lang);
    return { diseaseName: localized.name, crop: diagnosis.crop };
  }, [diagnosis, lang]);

  const diagnosisContext = useMemo<ChatDiagnosisContext | null>(() => {
    if (!attachContext || !diagnosis) return null;
    const disease = getDisease(diagnosis.diseaseId);
    return {
      crop: diagnosis.crop,
      diseaseId: diagnosis.diseaseId,
      diseaseName: getLocalized(disease, lang).name,
      family: disease.family,
      severity: diagnosis.severity,
      confidence: diagnosis.confidence,
    };
  }, [attachContext, diagnosis, lang]);

  /* ---------- focus + escape + scroll lock ---------- */
  useEffect(() => {
    if (!open) return;

    const panel = panelRef.current;
    inputRef.current?.focus({ preventScroll: true });
    document.body.style.overflow = "hidden";

    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "Tab" && panel) {
        const focusables = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
          (el) => el.offsetParent !== null,
        );
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  /* ---------- scroll to latest ---------- */
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, waiting, open]);

  const send = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || waiting) return;
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      setError("offline");
      return;
    }

    // Full memory-only history, including this new message — sent on every turn.
    const history: ChatMessageDto[] = messages.map((m) => ({
      role: m.role,
      content: m.content,
    }));
    const nextHistory: ChatMessageDto[] = [...history, { role: "user", content: trimmed }];

    setMessages((m) => [...m, { id: nextId(), role: "user", content: trimmed }]);
    setInput("");
    setError(null);
    setWaiting(true);

    const result = await askAgronomist(nextHistory, diagnosisContext);
    setWaiting(false);

    if (result.ok) {
      setMessages((m) => [...m, { id: nextId(), role: "assistant", content: result.reply }]);
    } else {
      setError(result.kind);
      if (result.kind === "anon-disabled") setAnonHint(true);
    }
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    void send(input);
  };

  /* ---------- render ---------- */
  return (
    <div className={open ? "pointer-events-none fixed inset-0 z-50" : "pointer-events-none fixed inset-0 z-50 hidden"} aria-hidden={!open}>
      {/* Backdrop */}
      <div
        onClick={onClose}
        role="presentation"
        className={`absolute inset-0 bg-black/45 backdrop-blur-[2px] transition-opacity duration-300 ease-out motion-reduce:transition-none ${
          open ? "opacity-100" : "opacity-0"
        }`}
      />
      {/* Panel */}
      <section
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="agrichat-title"
        tabIndex={-1}
        className={`absolute inset-x-0 bottom-0 flex h-[85dvh] flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl ring-1 ring-border transition-transform duration-300 ease-out motion-reduce:transition-none md:inset-y-0 md:right-0 md:h-auto md:w-[26rem] md:max-w-[94vw] md:rounded-l-2xl md:rounded-tr-none ${
          open
            ? "translate-y-0 md:translate-x-0"
            : "translate-y-full md:translate-y-0 md:translate-x-full"
        }`}
      >
        {/* Header */}
        <header className="flex items-start justify-between gap-3 border-b border-border px-4 py-3.5">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary-100 text-primary-700">
              <BotIcon size={20} />
            </span>
            <div className="min-w-0">
              <h2 id="agrichat-title" className="truncate font-heading text-base text-foreground">
                {t("chatTitle")}
              </h2>
              <p className="truncate text-xs text-foreground/55">{t("chatSubtitle")}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("chatClose")}
            className="flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-full text-foreground/60 transition-colors duration-200 hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600"
          >
            <XIcon size={18} />
          </button>
        </header>

        {/* Diagnosis context chip */}
        <div className="flex items-center gap-2 border-b border-border px-4 py-2.5">
          {contextChip ? (
            <button
              type="button"
              onClick={() => setAttachContext((v) => !v)}
              aria-pressed={attachContext}
              className={`inline-flex max-w-full cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600 ${
                attachContext
                  ? "border-primary-300 bg-primary-200/50 text-primary-800"
                  : "border-dashed border-foreground/25 bg-transparent text-foreground/55 hover:border-foreground/40 hover:text-foreground/75"
              }`}
            >
              {attachContext ? <CheckCircleIcon size={14} /> : <InfoIcon size={14} />}
              <span className="truncate">
                {attachContext
                  ? t("chatAttached", { disease: contextChip.diseaseName })
                  : t("chatDetach")}
              </span>
            </button>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted px-3 py-1.5 text-xs font-medium text-foreground/45">
              <InfoIcon size={14} />
              {t("chatContextNone")}
            </span>
          )}
        </div>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
          {messages.length === 0 ? (
            <div className="flex items-start gap-2.5">
              <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary-100 text-primary-700">
                <BotIcon size={16} />
              </span>
              <div className="max-w-[85%] whitespace-pre-wrap break-words rounded-2xl rounded-tl-sm bg-muted px-3.5 py-2.5 text-sm text-foreground">
                {t("chatGreeting")}
                {!diagnosis ? (
                  <span className="mt-1.5 block text-xs text-foreground/55">{t("chatEmpty")}</span>
                ) : null}
              </div>
            </div>
          ) : (
            messages.map((m) =>
              m.role === "user" ? (
                <div key={m.id} className="flex justify-end">
                  <div className="max-w-[85%] whitespace-pre-line break-words rounded-2xl rounded-br-sm bg-primary-600 px-3.5 py-2.5 text-sm text-on-primary">
                    {m.content}
                  </div>
                </div>
              ) : (
                <div key={m.id} className="flex items-start gap-2.5">
                  <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary-100 text-primary-700">
                    <BotIcon size={16} />
                  </span>
                  <div className="max-w-[85%] whitespace-pre-line break-words rounded-2xl rounded-tl-sm bg-muted px-3.5 py-2.5 text-sm text-foreground">
                    {m.content}
                  </div>
                </div>
              ),
            )
          )}

          {waiting ? (
            <div className="flex items-start gap-2.5" role="status" aria-live="polite">
              <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary-100 text-primary-700">
                <BotIcon size={16} />
              </span>
              <div className="flex items-center gap-1.5 rounded-2xl rounded-tl-sm bg-muted px-4 py-3">
                <span className="sr-only">{t("chatThinking")}</span>
                {[0, 1, 2].map((i) => (
                  <span
                    key={i}
                    className="size-1.5 animate-bounce rounded-full bg-foreground/50"
                    style={{ animationDelay: `${i * 120}ms` }}
                  />
                ))}
              </div>
            </div>
          ) : null}
        </div>

        {/* Error banner */}
        {error ? (
          <div role="alert" className="flex items-start gap-2.5 border-t border-border bg-severity-moderate/10 px-4 py-2.5 text-sm text-foreground">
            <AlertTriangleIcon size={16} className="mt-0.5 shrink-0 text-severity-moderate" />
            <div>
              <p>{t(ERROR_KEY[error])}</p>
              {anonHint ? (
                <p className="mt-1 text-xs text-foreground/60">{t("chatAnonHint")}</p>
              ) : null}
            </div>
          </div>
        ) : null}

        {/* Input */}
        <form onSubmit={onSubmit} className="flex items-end gap-2 border-t border-border px-4 py-3">
          {speech.supported ? (
            <button
              type="button"
              onClick={() => (speech.listening ? speech.stop() : speech.start())}
              aria-label={speech.listening ? t("micStop") : t("micSpeak")}
              className={`flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-full transition-all duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600 active:scale-95 ${
                speech.listening
                  ? "bg-severity-moderate text-white"
                  : "bg-muted text-foreground/70 hover:bg-primary-200/60 hover:text-primary-800"
              }`}
            >
              <MicIcon size={20} />
            </button>
          ) : null}

          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={t("chatInput")}
            aria-label={t("chatInput")}
            autoComplete="off"
            className="min-w-0 flex-1 rounded-2xl border border-border bg-muted px-4 py-2.5 text-sm text-foreground placeholder:text-foreground/40 focus:border-primary-400 focus:outline-none"
          />

          <button
            type="submit"
            disabled={!input.trim() || waiting}
            aria-label={t("chatSend")}
            className="flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-full bg-primary-600 text-on-primary shadow-sm transition-all duration-200 hover:bg-primary-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <SendIcon size={20} />
          </button>
        </form>
      </section>
    </div>
  );
}