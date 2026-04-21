import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";

const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const rawKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const url = rawUrl.startsWith("http") ? rawUrl : rawKey.startsWith("http") ? rawKey : rawUrl;
const key = rawKey.startsWith("eyJ") ? rawKey : rawUrl.startsWith("eyJ") ? rawUrl : rawKey;
const supabase = createClient(url, key);

function getSession() {
  const cookieStore = cookies();
  const val = cookieStore.get("makrochui_session")?.value;
  if (!val) return null;
  try { return JSON.parse(Buffer.from(val, "base64").toString("utf-8")); }
  catch { return null; }
}

export async function GET(req: NextRequest) {
  const action = req.nextUrl.searchParams.get("action");

  if (action === "me") {
    const u = getSession();
    if (!u) return NextResponse.json({ error: "Nao autenticado" }, { status: 401 });
    return NextResponse.json(u);
  }

  if (action === "tickets") {
    const u = getSession();
    if (!u) return NextResponse.json({ error: "Nao autenticado" }, { status: 401 });
    const q = supabase.from("makrochui_tickets").select("*").order("created_at", { ascending: false });
    if (u.role !== "admin" && u.role !== "gerente") q.eq("user_id", u.id);
    const { data, error } = await q;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data || []);
  }

  if (action === "users") {
    const u = getSession();
    if (!u || u.role !== "admin") return NextResponse.json({ error: "Sem permissao" }, { status: 403 });
    const { data } = await supabase.from("makrochui_users").select("id,name,department,username,role,active,created_at").order("name");
    return NextResponse.json(data || []);
  }

  if (action === "all_tickets") {
    const u = getSession();
    if (!u || u.role !== "admin") return NextResponse.json({ error: "Sem permissao" }, { status: 403 });
    const { data } = await supabase.from("makrochui_tickets").select("*, makrochui_users(name,department)").order("created_at", { ascending: false });
    return NextResponse.json(data || []);
  }

  return NextResponse.json({ error: "Acao invalida" }, { status: 400 });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { action } = body;

  if (action === "login") {
    const { username, password } = body;
    if (!username || !password) return NextResponse.json({ error: "Preencha usuario e senha" }, { status: 400 });
    const { data: user, error } = await supabase
      .from("makrochui_users").select("*").eq("username", username).eq("active", true).maybeSingle();
    if (error || !user || user.password !== password)
      return NextResponse.json({ error: "Usuario ou senha incorretos" }, { status: 401 });
    const session = Buffer.from(JSON.stringify({ id: user.id, name: user.name, department: user.department, role: user.role })).toString("base64");
    const res = NextResponse.json({ id: user.id, name: user.name, department: user.department, role: user.role });
    res.cookies.set("makrochui_session", session, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", maxAge: 60 * 60 * 8, path: "/" });
    return res;
  }

  if (action === "logout") {
    const res = NextResponse.json({ ok: true });
    res.cookies.delete("makrochui_session");
    return res;
  }

  if (action === "create_ticket") {
    const u = getSession();
    if (!u) return NextResponse.json({ error: "Nao autenticado" }, { status: 401 });
    const { subject, description, department, category, priority } = body;
    if (!subject || !description || !department) return NextResponse.json({ error: "Preencha campos obrigatorios" }, { status: 400 });
    const { data, error } = await supabase.from("makrochui_tickets")
      .insert({ user_id: u.id, subject, description, department, category: category || null, priority: priority || "normal", status: "aberto" })
      .select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data, { status: 201 });
  }

  if (action === "respond_ticket") {
    const u = getSession();
    if (!u || u.role !== "admin") return NextResponse.json({ error: "Sem permissao" }, { status: 403 });
    const { ticket_id, response, status } = body;
    if (!ticket_id) return NextResponse.json({ error: "ID obrigatorio" }, { status: 400 });
    const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (response) { update.response = response; update.responded_by = u.name; update.responded_at = new Date().toISOString(); }
    if (status) update.status = status;
    const { data, error } = await supabase.from("makrochui_tickets").update(update).eq("id", ticket_id).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  }

  if (action === "create_user") {
    const u = getSession();
    if (!u || u.role !== "admin") return NextResponse.json({ error: "Sem permissao" }, { status: 403 });
    const { name, department, username, password, role } = body;
    if (!name || !username || !password) return NextResponse.json({ error: "Preencha campos obrigatorios" }, { status: 400 });
    const { data, error } = await supabase.from("makrochui_users")
      .insert({ name, department: department || null, username, password, role: role || "colaborador" })
      .select().single();
    if (error) return NextResponse.json({ error: error.message.includes("unique") ? "Usuario ja existe" : error.message }, { status: 500 });
    return NextResponse.json(data, { status: 201 });
  }

  return NextResponse.json({ error: "Acao invalida" }, { status: 400 });
}
