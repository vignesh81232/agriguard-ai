import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ButtonHTMLAttributes,
  type HTMLAttributes,
  type ReactNode,
} from "react";
import { en, hi, es, LANGUAGES, type Lang, type TranslationKey } from "./translations";

type Dict = Record<TranslationKey, string>;

const DICTS: Record<Lang, Dict> = { en, hi, es };

export interface I18n {
  lang: Lang;
  setLang: (lang: Lang) => void;
  /** Translate a key to the active language; falls back to English. */
  t: (key: TranslationKey, vars?: Record<string, string | number>) => string;
  /** Speech-recognition language tag for the active UI language. */
  speechLang: string;
}

const I18nContext = createContext<I18n | null>(null);

const STORAGE_KEY = "agriguard:lang";

function detectInitialLang(): Lang {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "en" || stored === "hi" || stored === "es") return stored;
  } catch {
    /* storage unavailable */
  }
  const nav = typeof navigator !== "undefined" ? navigator.language : "";
  if (nav.toLowerCase().startsWith("hi")) return "hi";
  if (nav.toLowerCase().startsWith("es")) return "es";
  return "en";
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(detectInitialLang);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch {
      /* storage unavailable */
    }
    document.documentElement.lang = lang;
  }, [lang]);

  const setLang = useCallback((next: Lang) => setLangState(next), []);

  const t = useCallback<I18n["t"]>(
    (key, vars) => {
      const template = DICTS[lang][key] ?? en[key] ?? key;
      if (!vars) return template;
      return template.replace(/\{(\w+)\}/g, (m, k: string) =>
        k in vars ? String(vars[k]) : m,
      );
    },
    [lang],
  );

  const value = useMemo<I18n>(
    () => ({ lang, setLang, t, speechLang: LANGUAGES.find((l) => l.code === lang)!.speechLang }),
    [lang, setLang, t],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18n {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used inside <LanguageProvider>");
  return ctx;
}

/* ---------- Shared UI primitives (buttons, cards, badges) ---------- */

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "outline";
  size?: "sm" | "md" | "lg";
};

const BTN_STYLES: Record<NonNullable<ButtonProps["variant"]>, string> = {
  primary: "bg-primary text-on-primary hover:bg-primary-700 active:scale-[0.97]",
  secondary: "bg-primary-700 text-on-primary hover:bg-primary-600 active:scale-[0.97]",
  outline: "border-2 border-primary text-primary hover:bg-primary-200/40 active:scale-[0.97]",
  ghost: "text-primary hover:bg-primary-200/40 active:scale-[0.97]",
};

const BTN_SIZES: Record<NonNullable<ButtonProps["size"]>, string> = {
  sm: "px-3 py-2 text-sm",
  md: "px-4 py-3 text-base",
  lg: "px-6 py-4 text-lg w-full",
};

export function Button({
  variant = "primary",
  size = "md",
  className = "",
  ...props
}: ButtonProps) {
  return (
    <button
      type="button"
      className={`inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-all duration-150 ease-out cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-50 min-h-12 ${BTN_STYLES[variant]} ${BTN_SIZES[size]} ${className}`}
      {...props}
    />
  );
}

export function Card({
  className = "",
  children,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`rounded-2xl bg-white border border-border shadow-sm p-5 ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}

export function Pill({
  tone = "mild",
  children,
  className = "",
}: {
  tone?: "mild" | "moderate" | "critical" | "neutral" | "primary";
  children: ReactNode;
  className?: string;
}) {
  const tones = {
    mild: "bg-severity-mild/15 text-severity-mild border-severity-mild/40",
    moderate: "bg-severity-moderate/20 text-severity-moderate border-severity-moderate/50",
    critical: "bg-severity-critical/15 text-severity-critical border-severity-critical/40",
    neutral: "bg-muted text-foreground border-border",
    primary: "bg-primary-200/50 text-primary-800 border-primary-300",
  } as const;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-wide ${tones[tone]} ${className}`}
    >
      {children}
    </span>
  );
}

export function SectionHeading({
  icon,
  title,
  hint,
}: {
  icon?: ReactNode;
  title: string;
  hint?: string;
}) {
  return (
    <div className="mb-4 flex items-start gap-3">
      {icon ? (
        <span className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary-200/60 text-primary-700">
          {icon}
        </span>
      ) : null}
      <div>
        <h2 className="font-heading text-xl text-foreground">{title}</h2>
        {hint ? <p className="mt-0.5 text-sm text-foreground/60">{hint}</p> : null}
      </div>
    </div>
  );
}