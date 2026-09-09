import { useCallback, useRef, useState, type DragEvent } from "react";
import { Card } from "../i18n";
import { useI18n } from "../i18n";
import { CROPS, type Crop, type TranslationKey } from "../i18n/translations";
import { CameraIcon, ImagePlusIcon, MicIcon, SpinnerIcon, XIcon } from "./icons";
import { useSpeechRecognition } from "../hooks/useSpeechRecognition";
import { cacheDiagnosis, diagnoseLeaf, fileToImageData, type Diagnosis } from "../lib/diagnose";

const CROP_KEYS: Record<Crop, TranslationKey> = {
  tomato: "cropTomato",
  corn: "cropCorn",
  potato: "cropPotato",
  rice: "cropRice",
};

interface CaptureCardProps {
  busy?: boolean;
  onDiagnose: (result: Diagnosis) => void;
}

/**
 * Photo capture + diagnosis trigger. Fully offline: the photo is read,
 * downscaled and held in memory, the engine runs locally, and the result is
 * cached to localStorage so the field visit survives a reload.
 */
export default function CaptureCard({ busy = false, onDiagnose }: CaptureCardProps) {
  const { t, speechLang } = useI18n();
  const inputRef = useRef<HTMLInputElement>(null);

  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const [imageName, setImageName] = useState<string>("");
  const [crop, setCrop] = useState<Crop | "">("");
  const [issue, setIssue] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);

  const mic = useSpeechRecognition(speechLang, (finalText) => setIssue(finalText));

  const handleFile = useCallback(async (file: File) => {
    setFileError(null);
    if (!file.type.startsWith("image/")) {
      setFileError(t("fileError"));
      return;
    }
    try {
      const dataUrl = await fileToImageData(file);
      setImageDataUrl(dataUrl);
      setImageName(file.name || "leaf.jpg");
    } catch {
      setFileError(t("fileError"));
    }
  }, [t]);

  const onDrop = useCallback(
    (e: DragEvent<HTMLButtonElement>) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files?.[0];
      if (file) void handleFile(file);
    },
    [handleFile],
  );

  const handleDiagnose = useCallback(async () => {
    if (!imageDataUrl || analyzing) return;
    setAnalyzing(true);
    // Small artificial pause so the "scanning" moment feels real.
    await new Promise((r) => setTimeout(r, 1100));
    const result = diagnoseLeaf({ imageName, crop: crop || null }, imageDataUrl);
    cacheDiagnosis(result);
    setAnalyzing(false);
    onDiagnose(result);
  }, [imageDataUrl, imageName, crop, analyzing, onDiagnose]);

  return (
    <Card className="!p-0 overflow-hidden">
      {/* ---- Photo zone ---- */}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        aria-label={t("uploadTitle")}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleFile(file);
          e.target.value = "";
        }}
      />

      {imageDataUrl ? (
        <div className="relative">
          <img
            src={imageDataUrl}
            alt={imageName}
            className="max-h-72 w-full object-cover"
          />
          <div className="absolute right-3 top-3 flex gap-2">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-full bg-black/55 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur transition-colors hover:bg-black/75 active:scale-95"
            >
              <ImagePlusIcon size={14} />
              {t("changePhoto")}
            </button>
            <button
              type="button"
              aria-label={t("removePhoto")}
              onClick={() => {
                setImageDataUrl(null);
                setImageName("");
              }}
              className="flex size-8 cursor-pointer items-center justify-center rounded-lg bg-black/55 text-white backdrop-blur transition-colors hover:bg-black/75 active:scale-95"
            >
              <XIcon size={14} />
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          className={`flex min-h-56 w-full cursor-pointer flex-col items-center justify-center gap-2 border-2 border-dashed px-6 py-12 text-center transition-colors ${
            dragOver
              ? "border-primary bg-primary-200/50"
              : "border-primary-300 bg-primary-200/25 hover:bg-primary-200/40"
          }`}
        >
          <span className="flex size-16 items-center justify-center rounded-full bg-primary-600 text-on-primary shadow-md transition-transform active:scale-95">
            {analyzing ? <SpinnerIcon size={32} /> : <CameraIcon size={32} />}
          </span>
          <p className="mt-2 font-heading text-lg text-foreground">{t("uploadTitle")}</p>
          <p className="text-sm text-foreground/60">
            {t("uploadHint")} · {t("uploadFormats")}
          </p>
        </button>
      )}

      {fileError ? (
        <p className="border-t border-border bg-severity-critical/10 px-5 py-3 text-sm font-medium text-severity-critical">
          {fileError}
        </p>
      ) : null}

      {/* ---- Options + CTA ---- */}
      <div className="space-y-3 p-5">
        <label className="block">
          <span className="mb-1.5 block text-sm font-semibold text-foreground">
            {t("cropLabel")}
          </span>
          <select
            aria-label={t("cropLabel")}
            value={crop}
            onChange={(e) => setCrop(e.target.value as Crop | "")}
            className="w-full cursor-pointer rounded-xl border border-border bg-white px-4 py-3 text-base text-foreground"
          >
            <option value="">{t("cropPlaceholder")}</option>
            {CROPS.map((c) => (
              <option key={c} value={c}>
                {t(CROP_KEYS[c])}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="mb-1.5 block text-sm font-semibold text-foreground">
            {t("issueLabel")}
          </span>
          <div className="relative">
            <textarea
              value={issue}
              onChange={(e) => setIssue(e.target.value)}
              rows={2}
              placeholder={t("issuePlaceholder")}
              className="w-full resize-none rounded-xl border border-border bg-white px-4 py-3 pr-12 text-base text-foreground placeholder:text-foreground/40"
            />
            {mic.supported ? (
              <button
                type="button"
                aria-label={mic.listening ? t("micStop") : t("micSpeak")}
                onClick={mic.listening ? mic.stop : mic.start}
                className={`absolute right-2 top-2 inline-flex size-9 cursor-pointer items-center justify-center rounded-full transition-all active:scale-95 ${
                  mic.listening
                    ? "bg-severity-critical text-white shadow-md"
                    : "bg-primary-200/60 text-primary-700 hover:bg-primary-200"
                }`}
              >
                <MicIcon size={18} />
              </button>
            ) : null}
          </div>
          {mic.listening ? (
            <p className="mt-1 animate-pulse text-xs font-medium text-primary-700">
              {mic.transcript ? `“${mic.transcript}”` : t("micListening")}
            </p>
          ) : null}
        </label>

        <button
          type="button"
          onClick={handleDiagnose}
          disabled={!imageDataUrl || analyzing || busy}
          className="inline-flex min-h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-primary px-6 py-4 text-lg font-semibold text-on-primary transition-all duration-150 ease-out hover:bg-primary-700 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {analyzing ? (
            <>
              <SpinnerIcon size={20} />
              {t("analyzing")}
            </>
          ) : (
            <>
              <ImagePlusIcon size={20} />
              {t("diagnoseBtn")}
            </>
          )}
        </button>
        <p className="text-center text-xs text-foreground/50">
          {analyzing
            ? t("analyzingSub")
            : imageDataUrl
              ? `${imageName} · ${t("worksOffline")}`
              : t("diagnoseBtnDisabledHint")}
        </p>
      </div>
    </Card>
  );
}