import { createClient } from "@/lib/supabase-server";
import { NextResponse } from "next/server";

// PUT /api/obrigacoes/entregas/[id] — atualizar entrega
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

  if (!profile || !["contador", "admin", "internal"].includes(profile.role)) {
    return NextResponse.json({ error: "Sem permissão para atualizar entregas" }, { status: 403 });
  }

  const { id } = params;
  const isAdmin = profile.role === "admin" || profile.role === "internal";

  // Parse FormData or JSON
  const contentType = req.headers.get("content-type") || "";
  let updates: Record<string, any> = {};
  let file: File | null = null;
  let empresaId: string | null = null;

  if (contentType.includes("multipart/form-data")) {
    const formData = await req.formData();
    file = formData.get("file") as File | null;
    const status = formData.get("status") as string | null;
    const observacao = formData.get("observacao") as string | null;

    if (status) updates.status = status;
    if (observacao) updates.observacao = observacao;
  } else {
    const body = await req.json();
    const { status, observacao, nome, descricao, recorrencia, dia_vencimento, ativo } = body;

    if (status) updates.status = status;
    if (observacao !== undefined) updates.observacao = observacao;

    // Admin pode atualizar outros campos
    if (isAdmin) {
      if (nome !== undefined) updates.nome = nome;
      if (descricao !== undefined) updates.descricao = descricao;
      if (recorrencia !== undefined) updates.recorrencia = recorrencia;
      if (dia_vencimento !== undefined) updates.dia_vencimento = dia_vencimento;
      if (ativo !== undefined) updates.ativo = ativo;
    }
  }

  // Buscar entrega para pegar empresa_id
  const { data: entrega, error: fetchError } = await supabase
    .from("obrigacao_entregas")
    .select("empresa_id, arquivo_path")
    .eq("id", id)
    .single();

  if (fetchError || !entrega) {
    return NextResponse.json({ error: "Entrega não encontrada" }, { status: 404 });
  }

  empresaId = entrega.empresa_id;

  // Se houver arquivo, fazer upload
  if (file) {
    const storagePath = `obrigacoes/${empresaId}/${id}_${file.name}`;

    // Se existe arquivo anterior, deletar
    if (entrega.arquivo_path) {
      await supabase.storage
        .from("documentos")
        .remove([entrega.arquivo_path]);
    }

    const { error: uploadError } = await supabase.storage
      .from("documentos")
      .upload(storagePath, file);

    if (uploadError) {
      return NextResponse.json({ error: "Erro no upload: " + uploadError.message }, { status: 500 });
    }

    updates.arquivo_path = storagePath;
    updates.arquivo_nome = file.name;
    updates.arquivo_tamanho = file.size;
    updates.status = "concluido";
    updates.data_entrega = new Date().toISOString();
    updates.entregue_por = user.id;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "Nenhum campo para atualizar" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("obrigacao_entregas")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(data);
}
