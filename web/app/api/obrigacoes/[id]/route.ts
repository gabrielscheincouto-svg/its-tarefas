import { createClient } from "@/lib/supabase-server";
import { NextResponse } from "next/server";

// GET /api/obrigacoes/[id] — obter obrigacao com suas entregas
export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { id } = params;

  const { data: obrigacao, error } = await supabase
    .from("obrigacoes")
    .select("*, obrigacao_entregas(*), empresas(id, nome, cnpj)")
    .eq("id", id)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!obrigacao) return NextResponse.json({ error: "Obrigação não encontrada" }, { status: 404 });

  return NextResponse.json(obrigacao);
}

// PUT /api/obrigacoes/[id] — atualizar obrigacao (admin/internal only)
export async function PUT(
  req: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  // Verificar role
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile || !["admin", "internal"].includes(profile.role)) {
    return NextResponse.json({ error: "Sem permissão para atualizar obrigações" }, { status: 403 });
  }

  const { id } = params;
  const body = await req.json();
  const { nome, descricao, recorrencia, dia_vencimento, ativo } = body;

  // Construir update dinâmico
  const updates: Record<string, any> = {};
  if (nome !== undefined) updates.nome = nome;
  if (descricao !== undefined) updates.descricao = descricao;
  if (recorrencia !== undefined) updates.recorrencia = recorrencia;
  if (dia_vencimento !== undefined) updates.dia_vencimento = dia_vencimento;
  if (ativo !== undefined) updates.ativo = ativo;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "Nenhum campo para atualizar" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("obrigacoes")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Obrigação não encontrada" }, { status: 404 });

  return NextResponse.json(data);
}

// DELETE /api/obrigacoes/[id] — deletar obrigacao (admin/internal only)
export async function DELETE(
  req: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  // Verificar role
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile || !["admin", "internal"].includes(profile.role)) {
    return NextResponse.json({ error: "Sem permissão para deletar obrigações" }, { status: 403 });
  }

  const { id } = params;

  // Delete cascata: primeiro as entregas, depois a obrigacao
  await supabase
    .from("obrigacao_entregas")
    .delete()
    .eq("obrigacao_id", id);

  const { error } = await supabase
    .from("obrigacoes")
    .delete()
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ message: "Obrigação deletada com sucesso" });
}
