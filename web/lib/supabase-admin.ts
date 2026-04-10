import { createClient } from "@supabase/supabase-js";

const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const rawKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

// Auto-detect swapped env vars
const supabaseUrl = rawUrl.startsWith("http") ? rawUrl : rawKey.startsWith("http") ? rawKey : rawUrl;

// Client com service role — bypass RLS. USAR APENAS EM SERVER ACTIONS
// protegidas por guarda de role admin/internal.
export const createAdminClient = () =>
  createClient(
    supabaseUrl,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
