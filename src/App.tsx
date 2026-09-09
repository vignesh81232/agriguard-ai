import { useEffect, useState } from "react";
import TopBar from "./components/TopBar";
import CaptureCard from "./components/CaptureCard";
import ResultsSummary from "./components/ResultsSummary";
import ResultsDashboard from "./components/ResultsDashboard";
import StoreLocator from "./components/StoreLocator";
import ChatDrawer from "./components/ChatDrawer";
import { loadCachedDiagnosis, type Diagnosis } from "./lib/diagnose";
import { useI18n } from "./i18n";
import { WifiOffIcon, ArrowDownIcon, LeafIcon, BotIcon } from "./components/icons";

/**
 * AgriGuard AI — mobile-first leaf disease diagnoser (hackathon MVP).
 * Diagnose path: capture → simulated engine → summary → dashboard → remedies
 * store locator. Everything but the optional AI chat works fully offline.
 */
export default function App() {
  const { t } = useI18n();
  const [diagnosis, setDiagnosis] = useState<Diagnosis | null>(() => loadCachedDiagnosis());
  const [offline, setOffline] = useState<boolean>(() => !navigator.onLine);
  const [chatOpen, setChatOpen] = useState(false);

  useEffect(() => {
    const on = () => setOffline(false);
    const off = () => setOffline(true);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  return (
    <div className="bg-canvas min-h-screen">
      <TopBar />

      <main className="mx-auto w-full max-w-2xl px-4 pb-16 pt-6">
        {/* Offline-aware banner + brand pitch */}
        <section className="mb-6 text-center">
          <p className="mx-auto mb-3 inline-flex items-center gap-1.5 rounded-full border border-primary-300 bg-primary-200/50 px-3 py-1 text-xs font-bold uppercase tracking-wide text-primary-800">
            <LeafIcon size={14} />
            {t("heroBadge")}
          </p>
          <h1 className="font-heading text-3xl leading-tight text-foreground">{t("heroTitle")}</h1>
          <p className="mx-auto mt-2 max-w-md text-base text-foreground/70">{t("heroSubtitle")}</p>
        </section>

        {offline && diagnosis ? (
          <div
            role="status"
            className="mb-5 flex items-start gap-3 rounded-2xl border border-severity-moderate/40 bg-severity-moderate/10 px-4 py-3 text-sm text-foreground"
          >
            <WifiOffIcon size={18} className="mt-0.5 shrink-0 text-severity-moderate" />
            <p>
              <strong className="font-semibold">{t("offlineTitle")}.</strong>{" "}
              {t("offlineBody")}
            </p>
          </div>
        ) : null}

        {/* Capture → result summary → full dashboard */}
        <CaptureCard
          busy={!!offline}
          onDiagnose={(d) => {
            setDiagnosis(d);
            setOffline(false);
          }}
        />

        {diagnosis ? (
          <div className="mt-8">
            <ResultsSummary diagnosis={diagnosis} />
            <ResultsDashboard diagnosis={diagnosis} />
            <StoreLocator crop={diagnosis.crop} />
          </div>
        ) : (
          <section className="mt-8">
            <div className="mb-4 flex items-center gap-2 text-foreground/45">
              <ArrowDownIcon size={16} />
              <h2 className="font-heading text-sm uppercase tracking-widest">{t("resultsTitle")}</h2>
            </div>
            <div className="rounded-2xl border border-border bg-white p-10 text-center shadow-sm">
              <span className="mx-auto mb-3 flex size-12 items-center justify-center rounded-2xl bg-primary-200/50 text-primary-700">
                <LeafIcon size={24} />
              </span>
              <h3 className="font-heading text-lg text-foreground">{t("emptyTitle")}</h3>
              <p className="mx-auto mt-1 max-w-sm text-sm text-foreground/60">{t("emptyBody")}</p>
            </div>
          </section>
        )}

        {/* Footer */}
        <footer className="mt-12 border-t border-border pt-6 text-center text-xs text-foreground/55">
          <p className="font-semibold">{t("footerNote")}</p>
          <p className="mx-auto mt-1 max-w-md">{t("footerDisclaimer")}</p>
          <p className="mt-2 inline-flex items-center gap-1 text-primary-600">
            <WifiOffIcon size={14} />
            {t("worksOffline")}
          </p>
        </footer>
      </main>

      {/* Ask AI Agronomist — the only online feature */}
      <button
        type="button"
        onClick={() => setChatOpen(true)}
        aria-haspopup="dialog"
        className="fixed bottom-5 right-5 z-40 flex h-14 cursor-pointer items-center gap-2 rounded-full bg-primary-600 pl-4 pr-5 text-sm font-bold text-on-primary shadow-lg shadow-primary-900/20 transition-all duration-200 ease-out hover:bg-primary-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600 active:scale-95"
      >
        <BotIcon size={22} />
        <span className="hidden sm:inline">{t("chatOpen")}</span>
        <span className="sr-only">{t("chatOpenHint")}</span>
        {diagnosis ? (
          <span className="absolute -right-0.5 -top-0.5 size-3 rounded-full border-2 border-white bg-primary-300" aria-hidden="true" />
        ) : null}
      </button>

      <ChatDrawer open={chatOpen} onClose={() => setChatOpen(false)} diagnosis={diagnosis} />
    </div>
  );
}