import { createClient } from "@/lib/supabase-server";
import { NextResponse } from "next/server";

// GET /api/processos/[id]/indicadores — busca indicadores do processo
export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Nao autenticado" }, { status: 401 });

  const { data, error } = await supabase
    .from("indicadores")
    .select("*")
    .eq("processo_id", params.id)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// POST /api/processos/[id]/indicadores — salva indicadores
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

  // Upsert: se ja existe, atualiza
  const { data: existing } = await supabase
    .from("indicadores")
    .select("id")
    .eq("processo_id", params.id)
    .maybeSingle();

  let result;
  if (existing) {
    result = await supabase
      .from("indicadores")
      .update({
        margem_bruta: body.margem_bruta,
        margem_liquida: body.margem_liquida,
        liquidez_corrente: body.liquidez_corrente,
        roe: body.roe,
        roa: body.roa,
        endividamento: body.endividamento,
        health_score: body.health_score,
      })
      .eq("id", existing.id)
      .select()
      .single();
  } else {
    result = await supabase
      .from("indicadores")
      .insert({
        processo_id: params.id,
        margem_bruta: body.margem_bruta,
        margem_liquida: body.margem_liquida,
        liquidez_corrente: body.liquidez_corrente,
        roe: body.roe,
        roa: body.roa,
        endividamento: body.endividamento,
        health_score: body.health_score,
      })
      .select()
      .single();
  }

  if (result.error) return NextResponse.json({ error: result.error.message }, { status: 500 });
  return NextResponse.json(result.data);
}
