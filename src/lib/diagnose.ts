import { DISEASES, DISEASE_IDS, type DiseaseId, type Severity } from "../data/diseases";
import type { Crop } from "../i18n/translations";

/**
 * Diagnosis engine — SIMULATED for the hackathon MVP.
 * No vision model: a deterministic PRNG seeded from the image file name +
 * crop + timestamp picks one of the 5 bundled diseases and a confidence
 * within the disease's range. Same inputs (minus time) give stable-ish
 * results, which keeps the demo predictable yet varied.
 */

export interface DiagnosisInput {
  imageName: string;
  crop?: Crop | null;
  /** Millis epoch. */
  takenAt?: number;
}

export interface Diagnosis {
  diseaseId: DiseaseId;
  confidence: number; // 0–100
  severity: Severity;
  imageDataUrl: string;
  imageName: string;
  crop: Crop | null;
  createdAt: number;
  /** True when restored from the offline cache rather than freshly computed. */
  fromCache?: boolean;
}

/** Deterministic 32-bit string hash (FNV-1a), used as PRNG seed. */
function hashString(str: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Mulberry32 PRNG — fast, tiny, seeded. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Simulate a diagnosis. Confidence is drawn within the disease's own range,
 * plus a small jitter, so the demo stays predictable yet varied.
 */
export function diagnoseLeaf(input: DiagnosisInput, imageDataUrl: string): Diagnosis {
  const seed = hashString(`${input.imageName}|${input.crop ?? "any"}|${input.takenAt ?? Date.now()}`);
  const rand = mulberry32(seed);

  const ids = DISEASE_IDS as DiseaseId[];
  const idx = Math.floor(rand() * ids.length);
  const disease = DISEASES[ids[idx]];

  const [lo, hi] = disease.confidenceRange;
  const confidence = Math.round(lo + rand() * (hi - lo));

  return {
    diseaseId: disease.id,
    confidence,
    severity: disease.defaultSeverity,
    imageDataUrl,
    imageName: input.imageName,
    crop: input.crop ?? null,
    createdAt: Date.now(),
  };
}

/* ---------------- offline cache ---------------- */

const CACHE_KEY = "agriguard:last-diagnosis";

export function cacheDiagnosis(d: Diagnosis): void {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(d));
  } catch {
    /* storage full / unavailable — non-fatal */
  }
}

export function loadCachedDiagnosis(): Diagnosis | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Diagnosis;
    if (!parsed || !parsed.diseaseId || typeof parsed.imageDataUrl !== "string") return null;
    return { ...parsed, imageName: parsed.imageName ?? "cached.jpg", fromCache: true };
  } catch {
    return null;
  }
}

const MAX_EDGE = 960; // px — keep cached images small enough for localStorage

/**
 * Read a File and return a downscaled JPEG dataURL (max 960px on the long
 * edge). Downscaling keeps the offline cache small enough to save reliably
 * even for phone-camera photos.
 */
export function fileToImageData(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const url = String(reader.result);
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, MAX_EDGE / Math.max(img.width, img.height));
        if (scale === 1 && !file.type.startsWith("image/")) {
          reject(new Error("not-an-image"));
          return;
        }
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(url); // canvas unavailable — fall back to the raw dataURL
          return;
        }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.82));
      };
      img.onerror = () => reject(new Error("not-an-image"));
      img.src = url;
    };
    reader.onerror = () => reject(new Error("read-failed"));
    reader.readAsDataURL(file);
  });
}