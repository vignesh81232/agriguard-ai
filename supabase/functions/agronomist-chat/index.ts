import { createClient } from "npm:@supabase/supabase-js@2";

/**
 * AgriGuard AI — "Ask AI Agronomist" Edge Function.
 *
 * The ONLY network-backed feature of the app. The OpenAI key lives here as a
 * Supabase secret (OPENAI_API_KEY) and is read via Deno.env.get() — it never
 * reaches the browser. The client is prohibited from calling api.openai.com
 * directly; it only ever POSTs here with a valid Supabase JWT.
 *
 * Auth: a valid Supabase JWT (Bearer header) is required and verified
 * server-side via supabase.auth.getUser(). Anonymous sign-in on the Supabase
 * project provides the session for the no-sign-up MVP.
 *
 * Rate limiting: simple in-process token bucket (10 requests / 60 s per user).
 */

const OPENAI_URL = "https://api.openai.com/v1/chat/completions";
const MODEL = Deno.env.get("OPENAI_MODEL") ?? "gpt-4o-mini";
const RATE_LIMIT_MAX = 10; // requests
const RATE_LIMIT_WINDOW_SEC = 60; // seconds
const MAX_HISTORY = 20; // messages sent to OpenAI
const MAX_CONTENT_CHARS = 4000; // per message
const MAX_CONTEXT_CHARS = 1200; // diagnosis context blob

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, x-client-info, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type Role = "system" | "user" | "assistant";
interface ChatMessage {
  role: Role;
  content: string;
}
interface DiagnosisContext {
  crop?: string | null;
  diseaseId?: string;
  diseaseName?: string;
  family?: string;
  severity?: string;
  confidence?: number;
}

/** In-process token bucket, keyed by JWT subject (user id). */
const buckets = new Map<string, { tokens: number; last: number }>();

function takeToken(key: string): { allowed: boolean; retryAfterSec: number } {
  const now = Date.now() / 1000;
  const bucket = buckets.get(key) ?? { tokens: RATE_LIMIT_MAX, last: now };
  const refill = ((now - bucket.last) / RATE_LIMIT_WINDOW_SEC) * RATE_LIMIT_MAX;
  bucket.tokens = Math.min(RATE_LIMIT_MAX, bucket.tokens + refill);
  bucket.last = now;

  if (bucket.tokens < 1) {
    buckets.set(key, bucket);
    const perSec = RATE_LIMIT_MAX / RATE_LIMIT_WINDOW_SEC;
    return { allowed: false, retryAfterSec: Math.max(1, Math.ceil((1 - bucket.tokens) / perSec)) };
  }
  bucket.tokens -= 1;
  buckets.set(key, bucket);
  return { allowed: true, retryAfterSec: 0 };
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/** Validate + normalize the incoming message history. */
function sanitizeMessages(raw: unknown): ChatMessage[] {
  if (!Array.isArray(raw)) return [];
  const out: ChatMessage[] = [];
  for (const m of raw) {
    if (!m || typeof m !== "object") continue;
    const role = (m as { role?: unknown }).role;
    if (role !== "user" && role !== "assistant") continue;
    const content = String((m as { content?: unknown }).content ?? "").trim();
    if (!content) continue;
    out.push({ role, content: content.slice(0, MAX_CONTENT_CHARS) });
  }
  return out.slice(-MAX_HISTORY);
}

function buildSystemPrompt(context: unknown): string {
  const base =
    'You are "AgriGuard AI", a friendly, practical agronomist embedded in a farmer\'s leaf-diagnosis app. ' +
    "Follow these rules:\n" +
    "1. Answer in the same language the farmer used (English, हिंदी or Español).\n" +
    "2. Keep answers concise and actionable — short paragraphs or bullet lists, under ~180 words unless asked for more detail.\n" +
    '3. When a diagnosis context is provided, treat it as the app\'s analysis of their leaf and answer with it in mind: acknowledge it briefly, then answer the question.\n' +
    "4. For chemical treatments, give practical guidance only, never invent brand claims — always tell the farmer to read the product label and consult a local agronomist for exact doses.\n" +
    "5. If the question is outside your knowledge, say so honestly instead of guessing.\n" +
    "6. Do not claim to be able to see photos other than the attached diagnosis context.";
  let contextBlob = "";
  if (context && typeof context === "object") {
    try {
      contextBlob = JSON.stringify(context).slice(0, MAX_CONTEXT_CHARS);
    } catch {
      contextBlob = "";
    }
  }
  if (contextBlob) {
    return `${base}\n\nCurrent diagnosis context (JSON; crop, disease, severity, confidence):\n${contextBlob}`;
  }
  return `${base}\n\n(No diagnosis attached — the farmer may still ask general agronomy questions.)`;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    // 204 must carry a null body — `new Response("ok", {status: 204})` throws.
    return new Response(null, { status: 204, headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json({ error: "method_not_allowed" }, 405);
  }

  // ---- 1. Require + verify a valid Supabase JWT ----
  const auth = req.headers.get("Authorization") ?? "";
  const jwt = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  if (!jwt) return json({ error: "auth", message: "missing JWT" }, 401);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!supabaseUrl || !anonKey) return json({ error: "auth", message: "auth not configured" }, 401);

  const sb = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${jwt}` } },
  });
  const {
    data: { user },
    error: userError,
  } = await sb.auth.getUser();
  if (userError || !user) return json({ error: "unauthorized", message: "invalid JWT" }, 401);
  const userId = user.id;

  // ---- 2. Rate limit (token bucket per user) ----
  const rl = takeToken(userId);
  if (!rl.allowed) {
    return json({ error: "rate_limit", retryAfterSec: rl.retryAfterSec }, 429);
  }

  // ---- 3. Parse + sanitize body ----
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json({ error: "bad_request", message: "invalid JSON body" }, 400);
  }
  const { messages, diagnosisContext } = (body ?? {}) as {
    messages?: unknown;
    diagnosisContext?: unknown;
  };
  const history = sanitizeMessages(messages);
  if (history.length === 0) {
    return json({ error: "bad_request", message: "messages array is empty" }, 400);
  }

  const system = buildSystemPrompt(diagnosisContext);
  const openAiMessages: ChatMessage[] = [{ role: "system", content: system }, ...history];

  // ---- 4. Call OpenAI (server-side only) ----
  const apiKey = Deno.env.get("OPENAI_API_KEY");
  if (!apiKey) {
    return json({ error: "not_configured", message: "server chat is not configured" }, 503);
  }

  let upstream: Response;
  try {
    upstream = await fetch(OPENAI_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: MODEL,
        messages: openAiMessages,
        temperature: 0.3,
        max_tokens: 700,
        stream: false,
      }),
      signal: AbortSignal.timeout(30_000),
    });
  } catch (err) {
    if (err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError")) {
      return json({ error: "timeout", message: "upstream timed out" }, 504);
    }
    return json({ error: "upstream_error", message: "could not reach the language model" }, 502);
  }

  if (!upstream.ok) {
    // Never forward the key or upstream body — keep the client payload minimal.
    if (upstream.status === 429) {
      return json({ error: "upstream_rate_limit" }, 502);
    }
    return json({ error: "upstream_error" }, 502);
  }

  try {
    const data = (await upstream.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const reply = (data.choices?.[0]?.message?.content ?? "").trim();
    if (!reply) return json({ error: "upstream_error", message: "empty reply" }, 502);
    return json({ reply });
  } catch {
    return json({ error: "upstream_error", message: "unparseable reply" }, 502);
  }
});