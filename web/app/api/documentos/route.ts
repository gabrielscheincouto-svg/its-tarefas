import { createClient } from "@/lib/supabase-server";
import { NextResponse } from "next/server";

// GET /api/documentos?empresa_id=xxx&processo_id=xxx — lista documentos
export async function GET(req: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Nao autenticado" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const empresaId = searchParams.get("empresa_id");
  const processoId = searchParams.get("processo_id");

  let query = supabase
    .from("documentos")
    .select("*, profiles!enviado_por(nome)")
    .order("enviado_em", { ascending: false });

  if (empresaId) query = query.eq("empresa_id", empresaId);
  if (processoId) query = query.eq("processo_id", processoId);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// POST /api/documentos — upload de documento (recebe FormData)
export async function POST(req: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Nao autenticado" }, { status: 401 });

  // Verificar role (contador, admin, internal)
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile || !["contador", "admin", "internal"].includes(profile.role)) {
    return NextResponse.json({ error: "Sem permissao para enviar documentos" }, { status: 403 });
  }

  const formData = await req.formData();
  const file = formData.get("file") as File;
  const empresaId = formData.get("empresa_id") as string;
  const processoId = formData.get("processo_id") as string | null;
  const codigo = formData.get("codigo") as string;

  if (!file || !empresaId || !codigo) {
    return NextResponse.json({ error: "file, empresa_id e codigo sao obrigatorios" }, { status: 400 });
  }

  // Upload para Supabase Storage
  const storagePath = `${empresaId}/${Date.now()}_${file.name}`;
  const { error: uploadError } = await supabase.storage
    .from("documentos")
    .upload(storagePath, file);

  if (uploadError) {
    return NextResponse.json({ error: "Erro no upload: " + uploadError.message }, { status: 500 });
  }

  // Registrar no banco
  const { data, error } = await supabase
    .from("documentos")
    .insert({
      empresa_id: empresaId,
      processo_id: processoId || null,
      codigo,
      nome_arquivo: file.name,
      storage_path: storagePath,
      tamanho: file.size,
      enviado_por: user.id,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
