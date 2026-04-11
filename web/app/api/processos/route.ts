import { createClient } from "@/lib/supabase-server";
import { NextResponse } from "next/server";

// GET /api/processos?empresa_id=xxx
export async function GET(req: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Nao autenticado" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const empresaId = searchParams.get("empresa_id");

  let query = supabase
    .from("processos_mensais")
    .select("*, empresas(razao_social, nome_fantasia)")
    .order("competencia", { ascending: false });

  if (empresaId) query = query.eq("empresa_id", empresaId);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// POST /api/processos
export async function POST(req: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Nao autenticado" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile || !["admin", "internal"].includes(profile.role)) {
    return NextResponse.json({ error: "Sem permissao" }, { status: 403 });
  }

  const body = await req.json();
  const { empresa_id, competencia } = body;

  if (!empresa_id || !competencia) {
    return NextResponse.json({ error: "empresa_id e competencia sao obrigatorios" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("processos_mensais")
    .insert({ empresa_id, competencia, status: "pendente" })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
