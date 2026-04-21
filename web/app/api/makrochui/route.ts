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

// ═══ GET ═══
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
    // financeiro e gerente só veem seus próprios chamados
    if (u.role !== "admin") q.eq("user_id", u.id);
    const { data, error } = await q;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data || []);
  }

  if (action === "ticket_logs") {
    const u = getSession();
    if (!u) return NextResponse.json({ error: "Nao autenticado" }, { status: 401 });
    const ticketId = req.nextUrl.searchParams.get("ticket_id");
    const q = supabase.from("makrochui_ticket_logs").select("*").order("created_at", { ascending: false });
    if (ticketId) q.eq("ticket_id", parseInt(ticketId));
    const { data, error } = await q;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data || []);
  }

  if (action === "users") {
    const u = getSession();
    if (!u || u.role !== "admin") return NextResponse.json({ error: "Sem permissao" }, { status: 403 });
    const { data } = await supabase.from("makrochui_users").select("id,name,department,username,email,role,loja,active,created_at").order("name");
    return NextResponse.json(data || []);
  }

  if (action === "all_tickets") {
    const u = getSession();
    if (!u || u.role !== "admin") return NextResponse.json({ error: "Sem permissao" }, { status: 403 });
    const { data } = await supabase.from("makrochui_tickets").select("*, makrochui_users(name,department)").order("created_at", { ascending: false });
    return NextResponse.json(data || []);
  }

  // ═══ PREMIAÇÕES GET ═══
  if (action === "prem_periodos") {
    const u = getSession();
    if (!u) return NextResponse.json({ error: "Nao autenticado" }, { status: 401 });
    const { data } = await supabase.from("makrochui_prem_periodos").select("*").order("ano", { ascending: false }).order("id", { ascending: false });
    return NextResponse.json(data || []);
  }

  if (action === "prem_colaboradores") {
    const u = getSession();
    if (!u) return NextResponse.json({ error: "Nao autenticado" }, { status: 401 });
    const { data } = await supabase.from("makrochui_prem_colaboradores").select("*").eq("ativo", true).order("nome");
    return NextResponse.json(data || []);
  }

  if (action === "prem_avaliacoes") {
    const u = getSession();
    if (!u) return NextResponse.json({ error: "Nao autenticado" }, { status: 401 });
    const periodoId = req.nextUrl.searchParams.get("periodo_id");
    const q = supabase.from("makrochui_prem_avaliacoes").select("*, makrochui_prem_colaboradores(nome,cargo,loja)").order("nota_final", { ascending: false });
    if (periodoId) q.eq("periodo_id", parseInt(periodoId));
    const { data } = await q;
    return NextResponse.json(data || []);
  }

  if (action === "prem_criterios") {
    const u = getSession();
    if (!u) return NextResponse.json({ error: "Nao autenticado" }, { status: 401 });
    const { data } = await supabase.from("makrochui_prem_criterios").select("*").eq("ativo", true).order("id");
    return NextResponse.json(data || []);
  }

  if (action === "prem_config") {
    const u = getSession();
    if (!u) return NextResponse.json({ error: "Nao autenticado" }, { status: 401 });
    const { data } = await supabase.from("makrochui_prem_config").select("*").order("nota_min");
    return NextResponse.json(data || []);
  }

  // ═══ REUNIÕES GET ═══
  if (action === "reunioes") {
    const u = getSession();
    if (!u) return NextResponse.json({ error: "Nao autenticado" }, { status: 401 });
    const { data } = await supabase.from("makrochui_reunioes").select("*").order("data_reuniao", { ascending: false });
    return NextResponse.json(data || []);
  }

  // ═══ DOCUMENTOS GET ═══
  if (action === "documentos") {
    const u = getSession();
    if (!u) return NextResponse.json({ error: "Nao autenticado" }, { status: 401 });
    const categoria = req.nextUrl.searchParams.get("categoria");
    const q = supabase.from("makrochui_documentos").select("*").order("created_at", { ascending: false });
    if (categoria) q.eq("categoria", categoria);
    const { data } = await q;
    return NextResponse.json(data || []);
  }

  return NextResponse.json({ error: "Acao invalida" }, { status: 400 });
}

// ═══ POST ═══
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { action } = body;

  // ═══ AUTH ═══
  if (action === "login") {
    const { username, password } = body;
    if (!username || !password) return NextResponse.json({ error: "Preencha usuario e senha" }, { status: 400 });
    // Support login by email or username
    const emailLogin = username.includes("@");
    const q = supabase.from("makrochui_users").select("*").eq("active", true);
    if (emailLogin) q.eq("email", username.toLowerCase());
    else q.eq("username", username);
    const { data: user, error } = await q.maybeSingle();
    if (error || !user || user.password !== password)
      return NextResponse.json({ error: "Usuario ou senha incorretos" }, { status: 401 });
    const sessionData = { id: user.id, name: user.name, department: user.department, role: user.role, email: user.email, loja: user.loja };
    const session = Buffer.from(JSON.stringify(sessionData)).toString("base64");
    const res = NextResponse.json(sessionData);
    res.cookies.set("makrochui_session", session, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", maxAge: 60 * 60 * 8, path: "/" });
    return res;
  }

  if (action === "logout") {
    const res = NextResponse.json({ ok: true });
    res.cookies.delete("makrochui_session");
    return res;
  }

  // ═══ TICKETS ═══
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

  if (action === "update_ticket_status") {
    const u = getSession();
    if (!u) return NextResponse.json({ error: "Nao autenticado" }, { status: 401 });
    const { ticket_id, status, motivo } = body;
    if (!ticket_id || !status || !motivo) return NextResponse.json({ error: "Preencha ticket_id, status e motivo" }, { status: 400 });

    // Get current ticket for log
    const { data: ticket } = await supabase.from("makrochui_tickets").select("status").eq("id", ticket_id).single();
    if (!ticket) return NextResponse.json({ error: "Ticket nao encontrado" }, { status: 404 });

    // Update ticket status
    const { data, error } = await supabase.from("makrochui_tickets")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", ticket_id).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Create log entry
    await supabase.from("makrochui_ticket_logs").insert({
      ticket_id, user_id: u.id, user_name: u.name,
      status_anterior: ticket.status, status_novo: status, motivo
    });

    return NextResponse.json(data);
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

  // ═══ USERS ═══
  if (action === "create_user") {
    const u = getSession();
    if (!u || u.role !== "admin") return NextResponse.json({ error: "Sem permissao" }, { status: 403 });
    const { name, department, username, password, role, email, loja } = body;
    if (!name || !username || !password) return NextResponse.json({ error: "Preencha campos obrigatorios" }, { status: 400 });
    const { data, error } = await supabase.from("makrochui_users")
      .insert({ name, department: department || null, username, password, role: role || "colaborador", email: email || null, loja: loja || null })
      .select().single();
    if (error) return NextResponse.json({ error: error.message.includes("unique") ? "Usuario ja existe" : error.message }, { status: 500 });
    return NextResponse.json(data, { status: 201 });
  }

  // ═══ PREMIAÇÕES POST ═══
  if (action === "create_prem_periodo") {
    const u = getSession();
    if (!u || u.role !== "admin") return NextResponse.json({ error: "Sem permissao" }, { status: 403 });
    const { mes, ano, total_colaboradores } = body;
    if (!mes || !ano) return NextResponse.json({ error: "Preencha mes e ano" }, { status: 400 });
    const { data, error } = await supabase.from("makrochui_prem_periodos")
      .insert({ mes, ano, total_colaboradores: total_colaboradores || 0 }).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data, { status: 201 });
  }

  if (action === "create_prem_colaborador") {
    const u = getSession();
    if (!u || u.role !== "admin") return NextResponse.json({ error: "Sem permissao" }, { status: 403 });
    const { nome, cargo, setor, loja, salario, admissao } = body;
    if (!nome) return NextResponse.json({ error: "Nome obrigatorio" }, { status: 400 });
    const { data, error } = await supabase.from("makrochui_prem_colaboradores")
      .insert({ nome, cargo, setor, loja, salario: salario || 0, admissao }).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data, { status: 201 });
  }

  if (action === "bulk_create_prem_colaboradores") {
    const u = getSession();
    if (!u || u.role !== "admin") return NextResponse.json({ error: "Sem permissao" }, { status: 403 });
    const { colaboradores } = body;
    if (!colaboradores || !Array.isArray(colaboradores)) return NextResponse.json({ error: "Envie array de colaboradores" }, { status: 400 });
    const { data, error } = await supabase.from("makrochui_prem_colaboradores").insert(colaboradores).select();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data, { status: 201 });
  }

  if (action === "create_prem_avaliacao") {
    const u = getSession();
    if (!u) return NextResponse.json({ error: "Nao autenticado" }, { status: 401 });
    const { periodo_id, colaborador_id, notas, nota_final, pct_bonus, valor_bonus } = body;
    if (!periodo_id || !colaborador_id) return NextResponse.json({ error: "Preencha periodo e colaborador" }, { status: 400 });
    const { data, error } = await supabase.from("makrochui_prem_avaliacoes")
      .upsert({ periodo_id, colaborador_id, avaliador_id: u.id, notas: notas || {}, nota_final, pct_bonus, valor_bonus, status: "enviada" },
        { onConflict: "periodo_id,colaborador_id" }).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data, { status: 201 });
  }

  if (action === "update_prem_config") {
    const u = getSession();
    if (!u || u.role !== "admin") return NextResponse.json({ error: "Sem permissao" }, { status: 403 });
    const { config } = body;
    if (!config || !Array.isArray(config)) return NextResponse.json({ error: "Envie array de config" }, { status: 400 });
    // Delete and re-insert
    await supabase.from("makrochui_prem_config").delete().gte("id", 0);
    const { data, error } = await supabase.from("makrochui_prem_config").insert(config).select();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  }

  // ═══ REUNIÕES POST ═══
  if (action === "create_reuniao") {
    const u = getSession();
    if (!u) return NextResponse.json({ error: "Nao autenticado" }, { status: 401 });
    const { titulo, data_reuniao, hora, loja, participantes, pauta } = body;
    if (!titulo || !data_reuniao) return NextResponse.json({ error: "Preencha titulo e data" }, { status: 400 });
    const { data, error } = await supabase.from("makrochui_reunioes")
      .insert({ titulo, data_reuniao, hora, loja, participantes: participantes || [], pauta, created_by: u.id }).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data, { status: 201 });
  }

  if (action === "update_reuniao") {
    const u = getSession();
    if (!u) return NextResponse.json({ error: "Nao autenticado" }, { status: 401 });
    const { id, ...updates } = body;
    if (!id) return NextResponse.json({ error: "ID obrigatorio" }, { status: 400 });
    delete updates.action;
    const { data, error } = await supabase.from("makrochui_reunioes").update(updates).eq("id", id).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  }

  return NextResponse.json({ error: "Acao invalida" }, { status: 400 });
}
