import { createClient } from "@supabase/supabase-js";

// Client com service role — bypass RLS. USAR APENAS EM SERVER ACTIONS
// protegidas por guarda de role admin/internal.
export const createAdminClient = () =>
  createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
