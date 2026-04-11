import { createClient } from "@/lib/supabase-server";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Nao autenticado" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const empresaId = searchParams.get("empresa_id");
  if (!empresaId) return NextResponse.json({ error: "empresa_id obrigatorio" }, { status: 400 });

  // Buscar ultimo processo publicado
  const { data: processo } = await supabase
    .from("processos_mensais")
    .select("*")
    .eq("empresa_id", empresaId)
    .eq("status", "publicado")
    .order("publicado_em", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!processo) {
    return NextResponse.json({ processo: null, economia: null, indicadores: null, auditoria: [] });
  }

  // Buscar indicadores
  const { data: indicadores } = await supabase
    .from("indicadores")
    .select("*")
    .eq("processo_id", processo.id)
    .maybeSingle();

  // Buscar auditoria
  const { data: auditoria } = await supabase
    .from("auditoria_diffs")
    .select("*")
    .eq("processo_id", processo.id)
    .order("created_at");

  // Calcular economia total da auditoria
  const economiaTotal = (auditoria || []).reduce((sum: number, item: any) => sum + (item.impacto || 0), 0);
  const economia = processo.economia_gerada || economiaTotal;

  return NextResponse.json({
    processo,
    economia,
    indicadores,
    auditoria: auditoria || [],
  });
}
