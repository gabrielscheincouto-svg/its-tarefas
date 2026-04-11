import { createClient } from "@/lib/supabase-server";
import { createClient as createAdmin } from "@/lib/supabase-admin";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Nao autenticado" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const empresaId = searchParams.get("empresa_id");
  const processoId = searchParams.get("processo_id");

  let query = supabase.from("documentos").select("*").order("created_at", { ascending: false });
  if (empresaId) query = query.eq("empresa_id", empresaId);
  if (processoId) query = query.eq("processo_id", processoId);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(req: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Nao autenticado" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile || !["contador", "admin", "internal"].includes(profile.role)) {
    return NextResponse.json({ error: "Sem permissao" }, { status: 403 });
  }

  const formData = await req.formData();
  const file = formData.get("file") as File;
  const empresaId = formData.get("empresa_id") as string;
  const tipo = formData.get("tipo") as string;
  const competencia = formData.get("competencia") as string;

  if (!file || !empresaId || !tipo) {
    return NextResponse.json({ error: "file, empresa_id e tipo sao obrigatorios" }, { status: 400 });
  }

  const admin = createAdmin();
  const filePath = `${empresaId}/${Date.now()}_${file.name}`;
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  const { error: uploadError } = await admin.storage
    .from("documentos")
    .upload(filePath, buffer, { contentType: file.type });

  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 });

  const { data: doc, error: dbError } = await supabase
    .from("documentos")
    .insert({
      empresa_id: empresaId,
      tipo,
      competencia: competencia || null,
      nome_arquivo: file.name,
      storage_path: filePath,
      uploaded_by: user.id,
    })
    .select()
    .single();

  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 });
  return NextResponse.json(doc, { status: 201 });
}
