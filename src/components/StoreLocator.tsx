import { SectionHeading } from "../i18n";
import { useI18n } from "../i18n";
import { getStoresForCrop } from "../data/stores";
import type { Crop } from "../i18n/translations";
import { interpolate } from "../i18n/translations";
import { NavigationIcon, PhoneIcon, StoreIcon } from "./icons";

/**
 * Mock store locator — in-app "where to buy" list for the diagnosed crop.
 * No backend: a static dataset keyed by crop, with Maps directions links.
 */
export default function StoreLocator({ crop }: { crop: Crop | null }) {
  const { t } = useI18n();
  const stores = getStoresForCrop(crop);

  return (
    <section className="mt-10" aria-label={t("storeTitle")}>
      <SectionHeading icon={<StoreIcon size={20} />} title={t("storeTitle")} hint={t("storeSubtitle")} />
      {stores.length === 0 ? (
        <div className="rounded-2xl border border-border bg-white p-6 text-center">
          <p className="text-sm text-foreground/60">{t("storeEmpty")}</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {stores.map((s) => {
            const mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${s.coords[0]},${s.coords[1]}`;
            return (
              <li
                key={s.id}
                className="flex items-center gap-4 rounded-2xl border border-border bg-white p-4 shadow-sm transition-shadow hover:shadow-md"
              >
                <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary-200/60 text-primary-700">
                  <StoreIcon size={22} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-heading text-[15px] leading-snug text-foreground">{s.name}</p>
                  <p className="mt-0.5 text-xs text-foreground/60">
                    {interpolate(t("storeDistance"), { km: s.distanceKm })} · {s.open}
                  </p>
                  <p className="mt-0.5 text-sm font-semibold text-primary-700">
                    {s.price} <span className="font-normal text-foreground/45">{t("storePerPacket")}</span>
                  </p>
                </div>
                <div className="flex shrink-0 flex-col gap-2">
                  <a
                    href={`tel:${s.phone.replace(/\s/g, "")}`}
                    aria-label={`${s.name} — ${s.phone}`}
                    className="inline-flex size-9 cursor-pointer items-center justify-center rounded-lg bg-primary text-on-primary transition-all hover:bg-primary-700 active:scale-95"
                  >
                    <PhoneIcon size={16} />
                  </a>
                  <a
                    href={mapsUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex size-9 cursor-pointer items-center justify-center rounded-lg border-2 border-primary text-primary transition-all hover:bg-primary-200/40 active:scale-95"
                    aria-label={`${s.name} — ${t("storeDirections")}`}
                  >
                    <NavigationIcon size={16} />
                  </a>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}