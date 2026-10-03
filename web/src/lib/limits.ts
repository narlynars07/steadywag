import { Redis } from "@upstash/redis";

// Public chat spends real API credit, so every question passes two daily caps before the model is called:
// one per visitor (IP address) and one for the whole site. Counters live in Upstash Redis so they hold
// across Vercel instances. Both caps reset at midnight UTC.
const PER_VISITOR_PER_DAY = Number(process.env.CHAT_LIMIT_PER_VISITOR ?? 40);
const SITE_PER_DAY = Number(process.env.CHAT_LIMIT_PER_DAY ?? 500);
const DAY_SECONDS = 60 * 60 * 24;

export type LimitResult = { ok: true } | { ok: false; status: 429 | 503; error: string };

const url = process.env.KV_REST_API_URL;
const token = process.env.KV_REST_API_TOKEN;
const redis = url && token ? new Redis({ url, token }) : null;

// Local development without Redis falls back to a per-process counter. Production never uses it:
// if Redis is configured but unreachable, the request is refused instead of going unmetered.
const local = new Map<string, number>();
function bump(key: string): number {
  const n = (local.get(key) ?? 0) + 1;
  local.set(key, n);
  return n;
}

async function count(key: string): Promise<number> {
  if (!redis) return bump(key);
  const n = await redis.incr(key);
  if (n === 1) await redis.expire(key, DAY_SECONDS);
  return n;
}

export async function checkLimits(visitor: string): Promise<LimitResult> {
  const day = new Date().toISOString().slice(0, 10);
  try {
    const mine = await count(`steadywag:visitor:${day}:${visitor}`);
    if (mine > PER_VISITOR_PER_DAY) {
      return { ok: false, status: 429, error: `You've reached today's limit of ${PER_VISITOR_PER_DAY} questions. It resets tomorrow.` };
    }
    const site = await count(`steadywag:site:${day}`);
    if (site > SITE_PER_DAY) {
      return { ok: false, status: 429, error: "The assistant has reached its daily limit for everyone. It resets tomorrow. The rest of the site, including labs, medications and visit prep, is still fully usable." };
    }
    return { ok: true };
  } catch {
    return { ok: false, status: 503, error: "The assistant is paused right now. Please try again later." };
  }
}
