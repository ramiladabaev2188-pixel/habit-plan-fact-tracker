"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/types/database";
import { getSupabaseEnv } from "./env";

export function createClient() {
  const env = getSupabaseEnv();

  if (!env) {
    throw new Error("Supabase не настроен. Заполните .env.local.");
  }

  return createBrowserClient<Database, "public">(env.url, env.anonKey);
}
