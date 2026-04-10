import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";

const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const rawKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

// Auto-detect swapped env vars
const supabaseUrl = rawUrl.startsWith("http") ? rawUrl : rawKey.startsWith("http") ? rawKey : rawUrl;
const supabaseAnonKey = rawKey.startsWith("eyJ") ? rawKey : rawUrl.startsWith("eyJ") ? rawUrl : rawKey;

export const createClient = () => {
    const cookieStore = cookies();
    return createServerClient(
          supabaseUrl,
          supabaseAnonKey,
      {
              cookies: {
                        get: (name: string) => cookieStore.get(name)?.value,
                        set: (name: string, value: string, options: CookieOptions) => {
                                    try { cookieStore.set({ name, value, ...options }); } catch {}
                        },
                        remove: (name: string, options: CookieOptions) => {
                                    try { cookieStore.set({ name, value: "", ...options }); } catch {}
                        },
              },
      }
        );
};
