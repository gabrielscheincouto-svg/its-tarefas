import { createClient } from "@/lib/supabase-server";
import { NextResponse } from "next/server";

// GET /api/processos/[id]/auditoria — lista diffs de auditoria
export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Nao autenticado" }, { status: 401 });

  const { data, error } = await supabase
    .from("auditoria_diffs")
    .select("*")
    .eq("processo_id", params.id)
    .order("created_at");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// POST /api/processos/[id]/auditoria — adiciona item de auditoria
export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
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
  const { item, valor_contador, valor_its, observacao } = body;

  const impacto = Math.abs((valor_its || 0) - (valor_contador || 0));

  const { data, error } = await supabase
    .from("auditoria_diffs")
    .insert({
      processo_id: params.id,
      item,
      valor_contador,
      valor_its,
      impacto,
      observacao,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
