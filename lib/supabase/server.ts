import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import type { Database } from "@/types/database";
import { getSupabaseEnv } from "./env";

type CookieToSet = {
  name: string;
  value: string;
  options: Record<string, unknown>;
};

export async function createClient() {
  const env = getSupabaseEnv();

  if (!env) {
    throw new Error("Supabase не настроен. Заполните .env.local.");
  }

  const cookieStore = await cookies();

  return createServerClient<Database, "public">(env.url, env.anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet: CookieToSet[]) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Server Components cannot set cookies; middleware refreshes the session.
        }
      }
    }
  });
}
