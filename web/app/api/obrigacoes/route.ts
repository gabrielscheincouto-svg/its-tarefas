import { createClient } from "@/lib/supabase-server";
import { NextResponse } from "next/server";

// GET /api/obrigacoes?empresa_id=xxx â lista obrigacoes
export async function GET(req: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "NÃ£o autenticado" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const empresaId = searchParams.get("empresa_id");

  let query = supabase
    .from("obrigacoes")
    .select("*, empresas(id, nome, cnpj)")
    .order("nome", { ascending: true });

  if (empresaId) query = query.eq("empresa_id", empresaId);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// POST /api/obrigacoes â criar nova obrigacao
export async function POST(req: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "NÃ£o autenticado" }, { status: 401 });

  // Verificar role (admin, internal only)
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile || !["admin", "internal"].includes(profile.role)) {
    return NextResponse.json({ error: "Sem permissÃ£o para criar obrigaÃ§Ãµes" }, { status: 403 });
  }

  const body = await req.json();
  const { empresa_id, nome, descricao, recorrencia, dia_vencimento } = body;

  if (!empresa_id || !nome) {
    return NextResponse.json({ error: "empresa_id e nome sÃ£o obrigatÃ³rios" }, { status: 400 });
  }

  // Criar obrigacao
  const { data: obrigacao, error: createError } = await supabase
    .from("obrigacoes")
    .insert({
      empresa_id,
      nome,
      descricao: descricao || null,
      recorrencia: recorrencia || "mensal",
      dia_vencimento: dia_vencimento || 15,
      criado_por: user.id,
      ativo: true,
    })
    .select()
    .single();

  if (createError) return NextResponse.json({ error: createError.message }, { status: 500 });

  // Auto-gerar entregas para current month + next 2 months
  const today = new Date();
  const competencias: string[] = [];

  for (let i = 0; i < 3; i++) {
    const date = new Date(today.getFullYear(), today.getMonth() + i, 1);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    competencias.push(`${year}-${month}`);
  }

  const entregas = competencias.map((competencia) => {
    const [year, month] = competencia.split("-");
    const dataVencimento = new Date(
      parseInt(year),
      parseInt(month) - 1,
      obrigacao.dia_vencimento
    );

    return {
      obrigacao_id: obrigacao.id,
      empresa_id,
      competencia,
      status: "pendente",
      data_vencimento: dataVencimento.toISOString().split("T")[0],
      entregue_por: null,
    };
  });

  const { error: entregasError } = await supabase
    .from("obrigacao_entregas")
    .insert(entregas);

  if (entregasError) {
    return NextResponse.json({ error: "Erro ao gerar entregas: " + entregasError.message }, { status: 500 });
  }

  return NextResponse.json(obrigacao, { status: 201 });
}
