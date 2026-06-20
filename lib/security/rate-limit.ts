import { createHash } from "node:crypto";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";

type RateLimitOptions = {
  scope: "auth-signin" | "auth-signup" | "team-invite" | "data-import" | "data-export";
  identifier: string;
  maxRequests: number;
  windowSeconds: number;
};

export type RateLimitDecision =
  | { allowed: true }
  | { allowed: false; retryAfter: number };

export async function consumeRateLimit({
  scope,
  identifier,
  maxRequests,
  windowSeconds
}: RateLimitOptions): Promise<RateLimitDecision> {
  const requestHeaders = await headers();
  const forwardedFor = requestHeaders.get("x-forwarded-for");
  const clientIp = forwardedFor?.split(",")[0]?.trim() || requestHeaders.get("x-real-ip") || "unknown";
  const normalizedIdentifier = identifier.trim().toLowerCase().slice(0, 320);
  const fingerprint = createHash("sha256")
    .update(`${scope}:${clientIp}:${normalizedIdentifier}`)
    .digest("hex");
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("consume_rate_limit", {
    checked_key: `${scope}:${fingerprint}`,
    max_requests: maxRequests,
    window_seconds: windowSeconds
  });

  // Availability wins over a best-effort abuse control when the shared limiter is unavailable.
  if (error || !data?.[0]) {
    return { allowed: true };
  }

  return data[0].allowed
    ? { allowed: true }
    : { allowed: false, retryAfter: Math.max(1, Number(data[0].retry_after) || windowSeconds) };
}
