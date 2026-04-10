import { createBrowserClient } from "@supabase/ssr";

const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const rawKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

// Auto-detect swapped env vars
const supabaseUrl = rawUrl.startsWith("http") ? rawUrl : rawKey.startsWith("http") ? rawKey : rawUrl;
const supabaseAnonKey = rawKey.startsWith("eyJ") ? rawKey : rawUrl.startsWith("eyJ") ? rawUrl : rawKey;

export const createClient = () =>
          createBrowserClient(supabaseUrl, supabaseAnonKey);
