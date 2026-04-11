import { createClient } from "@/lib/supabase-server";
import { NextResponse } from "next/server";

// POST /api/processos/[id]/publicar
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

  const { data, error } = await supabase
    .from("processos_mensais")
    .update({
      status: "publicado",
      publicado_em: new Date().toISOString(),
    })
    .eq("id", params.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
