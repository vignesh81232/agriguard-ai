import { GlobeIcon, LeafIcon } from "./icons";
import { LANGUAGES } from "../i18n/translations";
import { useI18n } from "../i18n";

/** Sticky top bar: brand + trilingual language switcher. */
export default function TopBar() {
  const { lang, setLang, t } = useI18n();

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-white/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 w-full max-w-2xl items-center justify-between gap-3 px-4">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary-600 text-on-primary shadow-sm">
            <LeafIcon size={20} />
          </span>
          <div className="min-w-0 leading-tight">
            <p className="truncate font-heading text-lg text-foreground">
              {t("brand")}
            </p>
            <p className="hidden truncate text-xs text-foreground/55 sm:block">
              {t("tagline")}
            </p>
          </div>
        </div>

        <label className="flex items-center gap-2 rounded-full border border-border bg-muted px-3 py-2 text-sm font-semibold text-foreground">
          <GlobeIcon size={16} className="text-primary-600" />
          <span className="sr-only">{t("language")}</span>
          <select
            aria-label={t("language")}
            value={lang}
            onChange={(e) => setLang(e.target.value as typeof lang)}
            className="cursor-pointer appearance-none bg-transparent text-sm font-semibold text-foreground focus-visible:outline-none"
          >
            {LANGUAGES.map((l) => (
              <option key={l.code} value={l.code}>
                {l.label}
              </option>
            ))}
          </select>
        </label>
      </div>
    </header>
  );
}