import {
  createClient,
  FunctionsFetchError,
  FunctionsHttpError,
  FunctionsRelayError,
  type FunctionsError,
} from "@supabase/supabase-js";

/**
 * Supabase client + the "Ask AI Agronomist" gateway.
 *
 * Public values only: the URL and the publishable anon key come from
 * VITE_* environment variables (safe to ship to the browser). The OpenAI key
 * is a server-side secret and never enters this file or any client bundle.
 */

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in environment settings.");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
});

export interface ChatMessageDto {
  role: "user" | "assistant";
  content: string;
}

export interface ChatDiagnosisContext {
  crop: string | null;
  diseaseId: string;
  diseaseName: string;
  family: string;
  severity: string;
  confidence: number;
}

export type ChatErrorKind =
  | "offline" // no network
  | "auth" // invalid/missing session (JWT)
  | "rate" // 429 — both our bucket and OpenAI's
  | "server" // upstream/timeout/generic
  | "anon-disabled" // project-level anonymous sign-in is off
  | "not-configured"; // function lacks its secret

export type AskResult =
  | { ok: true; reply: string }
  | { ok: false; kind: ChatErrorKind };

let ensuring: Promise<void> | null = null;

/** Lazy anonymous sign-in (no-sign-up MVP). Re-entrant-safe. */
async function ensureSession(): Promise<void> {
  if (!ensuring) {
    ensuring = (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session) return;
      const { error } = await supabase.auth.signInAnonymously();
      if (error) throw error;
    })().finally(() => {
      ensuring = null;
    });
  }
  return ensuring;
}

function classify(e: unknown): ChatErrorKind {
  const message = e instanceof Error ? e.message : String(e);
  const lower = message.toLowerCase();
  if (lower.includes("anonymous") && lower.includes("disabled")) {
    return "anon-disabled";
  }
  return "auth";
}

/** Map an invoke() error to a friendly, localizable kind. */
function mapInvokeError(error: FunctionsError | Error): ChatErrorKind {
  if (error instanceof FunctionsHttpError) {
    const status =
      (error as unknown as { context?: { status?: number } }).context?.status ??
      (error as unknown as { status?: number }).status ??
      0;
    if (status === 401 || status === 403) return "auth";
    if (status === 429) return "rate";
    if (status === 503) return "not-configured";
    return "server";
  }
  if (error instanceof FunctionsFetchError) {
    return "offline"; // failed to reach the function (no connection / DNS)
  }
  if (error instanceof FunctionsRelayError) {
    return "server";
  }
  if (error instanceof Error && error.message?.toLowerCase().includes("anonymous")) {
    return "anon-disabled";
  }
  return "server";
}

/**
 * Send the full conversation to the `agronomist-chat` Edge Function.
 * Chat history is kept in memory only — the client sends complete history on
 * every request, and the function keeps no state.
 */
export async function askAgronomist(
  messages: ChatMessageDto[],
  diagnosisContext: ChatDiagnosisContext | null,
): Promise<AskResult> {
  // Anonymous session → valid JWT for the Edge Function.
  try {
    await ensureSession();
  } catch (e) {
    return { ok: false, kind: classify(e) };
  }

  try {
    const { data, error } = await supabase.functions.invoke("agronomist-chat", {
      body: { messages, diagnosisContext },
      timeout: 40_000, // ~40s cap on the whole request
    });

    if (error) {
      return { ok: false, kind: mapInvokeError(error) };
    }
    const reply =
      typeof (data as { reply?: unknown } | null)?.reply === "string"
        ? ((data as { reply: string }).reply as string)
        : "";
    if (!reply.trim()) return { ok: false, kind: "server" };
    return { ok: true, reply };
  } catch (e) {
    const name = e instanceof Error ? e.name : "";
    const message = e instanceof Error ? e.message : "";
    // Abort from the 40s timeout → treat as a slow server, not offline.
    if (name === "TimeoutError" || name === "AbortError" || /abort|timeout/i.test(message)) {
      return { ok: false, kind: "server" };
    }
    return { ok: false, kind: mapInvokeError(e as FunctionsError) };
  }
}