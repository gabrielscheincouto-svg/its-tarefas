import { createBrowserClient } from "@supabase/ssr";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

console.log("[supabase-browser] URL length:", supabaseUrl.length, "starts with https:", supabaseUrl.startsWith("https://"));
console.log("[supabase-browser] Key length:", supabaseAnonKey.length, "starts with eyJ:", supabaseAnonKey.startsWith("eyJ"));

export const createClient = () =>
      createBrowserClient(supabaseUrl, supabaseAnonKey);
