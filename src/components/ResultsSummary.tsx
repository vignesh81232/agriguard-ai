import { useI18n } from "../i18n";
import { Pill } from "../i18n";
import { getDisease, getLocalized } from "../data/diseases";
import type { Diagnosis } from "../lib/diagnose";
import { AlertTriangleIcon, CheckCircleIcon, ClockIcon } from "./icons";

/**
 * Compact summary of a finished diagnosis: disease name, type, confidence,
 * severity and a one-line healthy note. The full dashboard renders below it.
 */
export default function ResultsSummary({ diagnosis }: { diagnosis: Diagnosis }) {
  const { t, lang } = useI18n();
  const disease = getDisease(diagnosis.diseaseId);
  const block = getLocalized(disease, lang);
  const healthy = diagnosis.severity === "healthy";

  const familyKey =
    disease.family === "fungal"
      ? t("familyFungal")
      : disease.family === "bacterial"
        ? t("familyBacterial")
        : disease.family === "viral"
          ? t("familyViral")
          : disease.family === "pest"
            ? t("familyPest")
            : t("familyNone");

  const severityTone =
    diagnosis.severity === "critical"
      ? ("critical" as const)
      : diagnosis.severity === "moderate"
        ? ("moderate" as const)
        : diagnosis.severity === "mild"
          ? ("mild" as const)
          : ("neutral" as const);

  const severityLabel =
    diagnosis.severity === "healthy"
      ? t("severityHealthy")
      : diagnosis.severity === "mild"
        ? t("severityMild")
        : diagnosis.severity === "moderate"
          ? t("severityModerate")
          : t("severityCritical");

  return (
    <section aria-label={t("resultsTitle")}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="font-heading text-xl text-foreground">{t("resultsTitle")}</h2>
        <div className="flex items-center gap-2">
          {diagnosis.fromCache ? (
            <Pill tone="primary">
              <ClockIcon size={13} />
              {t("cachedBadge")}
            </Pill>
          ) : null}
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-white shadow-sm">
        <div
          className={`flex items-start gap-4 p-5 ${
            healthy
              ? "bg-severity-mild/10"
              : diagnosis.severity === "critical"
                ? "bg-severity-critical/10"
                : diagnosis.severity === "moderate"
                  ? "bg-severity-moderate/15"
                  : "bg-primary-200/30"
          }`}
        >
          <span
            className={`flex size-12 shrink-0 items-center justify-center rounded-2xl ${
              healthy ? "bg-severity-mild/20 text-severity-mild" : "bg-white/80 text-primary-700"
            }`}
          >
            {healthy ? <CheckCircleIcon size={26} /> : <AlertTriangleIcon size={26} />}
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-heading text-xl leading-tight text-foreground">{block.name}</h3>
              <Pill tone={severityTone}>{severityLabel}</Pill>
            </div>
            <p className="mt-0.5 text-sm font-medium text-foreground/70">
              {t("familyLabel")}: {familyKey}
            </p>
          </div>
        </div>

        <p className="px-5 pt-4 text-[15px] leading-relaxed text-foreground/80">
          {block.description}
        </p>

        {healthy ? (
          <p className="px-5 pt-2 text-sm font-medium text-severity-mild">{t("healthyNote")}</p>
        ) : null}

        <div className="mt-4 flex items-center gap-3 border-t border-border px-5 py-4">
          <div className="text-sm font-semibold text-foreground/60">{t("confidenceLabel")}</div>
          <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-muted">
            <div
              role="progressbar"
              aria-valuenow={diagnosis.confidence}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={t("confidenceLabel")}
              className={`h-full rounded-full transition-all duration-700 ease-out ${
                healthy ? "bg-severity-mild" : "bg-primary"
              }`}
              style={{ width: `${diagnosis.confidence}%` }}
            />
          </div>
          <div className="font-heading text-lg font-bold text-foreground">
            {t("confidenceMatch", { confidence: diagnosis.confidence })}
          </div>
        </div>
      </div>
    </section>
  );
}