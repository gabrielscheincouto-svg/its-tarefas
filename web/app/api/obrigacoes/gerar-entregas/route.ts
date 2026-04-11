import { createClient } from "@/lib/supabase-server";
import { NextResponse } from "next/server";

// POST /api/obrigacoes/gerar-entregas — gerar entregas para um mês
export async function POST(req: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  // Verificar role (admin, internal only)
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile || !["admin", "internal"].includes(profile.role)) {
    return NextResponse.json({ error: "Sem permissão para gerar entregas" }, { status: 403 });
  }

  const body = await req.json();
  const { competencia } = body;

  if (!competencia || !/^\d{4}-\d{2}$/.test(competencia)) {
    return NextResponse.json({ error: "competencia deve estar no formato YYYY-MM" }, { status: 400 });
  }

  // Buscar todas as obrigacoes ativas
  const { data: obrigacoes, error: fetchError } = await supabase
    .from("obrigacoes")
    .select("id, empresa_id, dia_vencimento")
    .eq("ativo", true);

  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 500 });
  }

  if (!obrigacoes || obrigacoes.length === 0) {
    return NextResponse.json({ created: 0, message: "Nenhuma obrigação ativa encontrada" });
  }

  // Para cada obrigacao, verificar se já existe entrega para essa competencia
  const entregasToCreate = [];

  for (const obrigacao of obrigacoes) {
    const { data: existingEntrega } = await supabase
      .from("obrigacao_entregas")
      .select("id")
      .eq("obrigacao_id", obrigacao.id)
      .eq("competencia", competencia)
      .single();

    // Se não existe, criar
    if (!existingEntrega) {
      const [year, month] = competencia.split("-");
      const dataVencimento = new Date(
        parseInt(year),
        parseInt(month) - 1,
        obrigacao.dia_vencimento
      );

      entregasToCreate.push({
        obrigacao_id: obrigacao.id,
        empresa_id: obrigacao.empresa_id,
        competencia,
        status: "pendente",
        data_vencimento: dataVencimento.toISOString().split("T")[0],
        entregue_por: null,
      });
    }
  }

  // Inserir entregas
  let created = 0;
  if (entregasToCreate.length > 0) {
    const { error: insertError } = await supabase
      .from("obrigacao_entregas")
      .insert(entregasToCreate);

    if (insertError) {
      return NextResponse.json({ error: "Erro ao gerar entregas: " + insertError.message }, { status: 500 });
    }

    created = entregasToCreate.length;
  }

  return NextResponse.json({
    created,
    message: `${created} entrega(s) gerada(s) para ${competencia}`,
  });
}
