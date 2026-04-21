"use client";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";

interface Ticket {
  id: number;
  user_id: number;
  subject: string;
  description: string;
  department: string;
  category: string | null;
  priority: string;
  status: string;
  response: string | null;
  responded_by: string | null;
  created_at: string;
  updated_at: string;
}

interface User {
  id: number;
  name: string;
  department: string;
  role: string;
}

const DEPARTMENTS = [
  { value: "estoque", label: "Estoque / Almoxarifado", icon: "📦" },
  { value: "acougue", label: "Açougue / Carnes", icon: "🥩" },
  { value: "padaria", label: "Padaria / Confeitaria", icon: "🍞" },
  { value: "hortifruti", label: "Hortifruti / FLV", icon: "🥬" },
  { value: "frente", label: "Frente de Loja / Caixa", icon: "🛒" },
  { value: "rh", label: "RH / Pessoal", icon: "👥" },
  { value: "manutencao", label: "Manutenção", icon: "🔧" },
  { value: "ti", label: "TI / Sistemas", icon: "💻" },
  { value: "financeiro", label: "Financeiro / Compras", icon: "💰" },
  { value: "gerencia", label: "Gerência / Diretoria", icon: "📋" },
  { value: "limpeza", label: "Limpeza / Higienização", icon: "🧹" },
  { value: "seguranca", label: "Segurança", icon: "🔒" },
];

const CATEGORIES = [
  { value: "reposicao", label: "Reposição de produto" },
  { value: "equipamento", label: "Manutenção de equipamento" },
  { value: "sistema", label: "Problema no sistema / PDV" },
  { value: "material", label: "Solicitação de material" },
  { value: "reclamacao", label: "Reclamação de cliente" },
  { value: "escala", label: "Escala / Folga / Férias" },
  { value: "limpeza", label: "Limpeza / Higienização" },
  { value: "seguranca", label: "Segurança" },
  { value: "entrega", label: "Entrega / Fornecedor" },
  { value: "outro", label: "Outro" },
];

const ST: Record<string, { label: string; color: string; bg: string }> = {
  aberto: { label: "Aberto", color: "#F59E0B", bg: "rgba(245,158,11,0.1)" },
  em_andamento: { label: "Em Andamento", color: "#6366F1", bg: "rgba(99,102,241,0.1)" },
  resolvido: { label: "Resolvido", color: "#10B981", bg: "rgba(16,185,129,0.1)" },
  fechado: { label: "Fechado", color: "#9CA3AF", bg: "rgba(156,163,175,0.08)" },
};

export default function MakrochuiPainel() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [filter, setFilter] = useState("todos");
  const [tab, setTab] = useState<"chamados" | "admin">("chamados");

  // Form
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [department, setDepartment] = useState("");
  const [category, setCategory] = useState("");
  const [priority, setPriority] = useState("normal");
  const [sending, setSending] = useState(false);

  // Admin: respond
  const [respondId, setRespondId] = useState<number | null>(null);
  const [respText, setRespText] = useState("");
  const [respStatus, setRespStatus] = useState("");

  // Admin: new user
  const [showNewUser, setShowNewUser] = useState(false);
  const [nuName, setNuName] = useState("");
  const [nuDept, setNuDept] = useState("");
  const [nuUser, setNuUser] = useState("");
  const [nuPass, setNuPass] = useState("");
  const [nuRole, setNuRole] = useState("colaborador");
  const [allTickets, setAllTickets] = useState<(Ticket & { makrochui_users?: { name: string; department: string } })[]>([]);
  const [users, setUsers] = useState<{ id: number; name: string; department: string; username: string; role: string; active: boolean }[]>([]);

  const loadData = useCallback(async () => {
    try {
      const [meRes, tkRes] = await Promise.all([
        fetch("/api/makrochui?action=me"),
        fetch("/api/makrochui?action=tickets"),
      ]);
      if (!meRes.ok) { router.push("/makrochui"); return; }
      const me = await meRes.json();
      setUser(me);
      setTickets(await tkRes.json());
      if (me.role === "admin") {
        const [atRes, uRes] = await Promise.all([
          fetch("/api/makrochui?action=all_tickets"),
          fetch("/api/makrochui?action=users"),
        ]);
        if (atRes.ok) setAllTickets(await atRes.json());
        if (uRes.ok) setUsers(await uRes.json());
      }
    } catch { router.push("/makrochui"); }
    finally { setLoading(false); }
  }, [router]);

  useEffect(() => { loadData(); }, [loadData]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!subject.trim() || !description.trim() || !department) return;
    setSending(true);
    try {
      const res = await fetch("/api/makrochui", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "create_ticket", subject: subject.trim(), description: description.trim(), department, category: category || null, priority }),
      });
      if (res.ok) {
        setSubject(""); setDescription(""); setDepartment(""); setCategory(""); setPriority("normal"); setShowForm(false);
        loadData();
      }
    } catch {} finally { setSending(false); }
  }

  async function handleRespond(ticketId: number) {
    if (!respText.trim() && !respStatus) return;
    try {
      await fetch("/api/makrochui", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "respond_ticket", ticket_id: ticketId, response: respText.trim() || undefined, status: respStatus || undefined }),
      });
      setRespondId(null); setRespText(""); setRespStatus("");
      loadData();
    } catch {}
  }

  async function handleCreateUser(e: React.FormEvent) {
    e.preventDefault();
    if (!nuName || !nuUser || !nuPass) return;
    const res = await fetch("/api/makrochui", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "create_user", name: nuName, department: nuDept || null, username: nuUser, password: nuPass, role: nuRole }),
    });
    if (res.ok) {
      setNuName(""); setNuDept(""); setNuUser(""); setNuPass(""); setNuRole("colaborador"); setShowNewUser(false);
      loadData();
    } else { const d = await res.json(); alert(d.error || "Erro ao criar usuario"); }
  }

  async function handleLogout() {
    await fetch("/api/makrochui", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "logout" }) });
    router.push("/makrochui");
  }

  if (loading) return (
    <main className="min-h-screen flex items-center justify-center" style={{ background: "#0A0A0A" }}>
      <div className="text-white text-sm animate-pulse">Carregando...</div>
    </main>
  );

  const filtered = filter === "todos" ? tickets : tickets.filter(t => t.status === filter);
  const stats = {
    aberto: tickets.filter(t => t.status === "aberto").length,
    em_andamento: tickets.filter(t => t.status === "em_andamento").length,
    resolvido: tickets.filter(t => t.status === "resolvido" || t.status === "fechado").length,
    total: tickets.length,
  };
  const deptLabel = (v: string) => DEPARTMENTS.find(d => d.value === v)?.label || v;
  const deptIcon = (v: string) => DEPARTMENTS.find(d => d.value === v)?.icon || "📌";
  const catLabel = (v: string) => CATEGORIES.find(c => c.value === v)?.label || v;
  const isAdmin = user?.role === "admin";

  const inputStyle = { background: "#0D0D0D", border: "1.5px solid #2A2A2A" };

  return (
    <main className="min-h-screen" style={{ background: "#0A0A0A", color: "#F7F7F7" }}>
      {/* Header */}
      <header className="flex items-center justify-between px-4 sm:px-6 py-3" style={{ background: "#111", borderBottom: "1px solid #1E1E1E" }}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-black text-[10px]"
            style={{ background: "linear-gradient(135deg, #DC2626, #991B1B)" }}>MK</div>
          <div className="hidden sm:block">
            <div className="font-bold text-sm">Makrochui</div>
            <div className="text-[9px] font-bold uppercase" style={{ color: "#DC2626", letterSpacing: "1px" }}>Gestão Interna</div>
          </div>
        </div>
        {isAdmin && (
          <div className="flex gap-1">
            <button onClick={() => setTab("chamados")}
              className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
              style={{ background: tab === "chamados" ? "#DC2626" : "transparent", color: tab === "chamados" ? "white" : "#888" }}>
              Chamados
            </button>
            <button onClick={() => setTab("admin")}
              className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
              style={{ background: tab === "admin" ? "#DC2626" : "transparent", color: tab === "admin" ? "white" : "#888" }}>
              Admin
            </button>
          </div>
        )}
        <div className="flex items-center gap-3">
          <div className="text-right hidden sm:block">
            <div className="text-xs font-semibold">{user?.name}</div>
            <div className="text-[10px]" style={{ color: "#666" }}>{user?.department}</div>
          </div>
          <div className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-[10px]"
            style={{ background: "linear-gradient(135deg, #DC2626, #991B1B)" }}>
            {user?.name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase()}
          </div>
          <button onClick={handleLogout} className="text-[10px] px-2.5 py-1.5 rounded-lg font-semibold"
            style={{ background: "#1A1A1A", border: "1px solid #2A2A2A", color: "#888" }}>Sair</button>
        </div>
      </header>

      {tab === "chamados" ? (
        <div className="max-w-3xl mx-auto px-4 py-6 space-y-5">
          {/* Stats */}
          <div className="grid grid-cols-4 gap-2 sm:gap-3">
            {[
              { label: "Abertos", value: stats.aberto, color: "#F59E0B" },
              { label: "Andamento", value: stats.em_andamento, color: "#6366F1" },
              { label: "Resolvidos", value: stats.resolvido, color: "#10B981" },
              { label: "Total", value: stats.total, color: "#DC2626" },
            ].map(s => (
              <div key={s.label} className="rounded-xl p-3 text-center" style={{ background: "#131313", border: "1px solid #1E1E1E" }}>
                <div className="text-2xl sm:text-3xl font-extrabold" style={{ color: s.color }}>{s.value}</div>
                <div className="text-[8px] sm:text-[10px] font-bold uppercase mt-0.5" style={{ color: "#666", letterSpacing: "0.5px" }}>{s.label}</div>
              </div>
            ))}
          </div>

          {/* New Ticket */}
          <button onClick={() => setShowForm(!showForm)}
            className="w-full py-3 rounded-xl text-sm font-bold transition-all"
            style={{
              background: showForm ? "#141414" : "linear-gradient(135deg, #DC2626, #B91C1C)",
              color: showForm ? "#DC2626" : "white",
              border: showForm ? "1px solid rgba(220,38,38,0.3)" : "none",
              boxShadow: showForm ? "none" : "0 4px 16px rgba(220,38,38,0.3)",
            }}>
            {showForm ? "✕ Cancelar" : "+ Novo Chamado"}
          </button>

          {showForm && (
            <form onSubmit={handleSubmit} className="rounded-xl p-5 space-y-4" style={{ background: "#131313", border: "1px solid rgba(220,38,38,0.15)" }}>
              <h2 className="text-base font-bold">Abrir Novo Chamado</h2>
              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold uppercase mb-1.5" style={{ color: "#888", letterSpacing: "1px" }}>Setor *</label>
                  <select value={department} onChange={e => setDepartment(e.target.value)} required
                    className="w-full px-3 py-2.5 rounded-lg text-sm text-white outline-none" style={inputStyle}>
                    <option value="">Selecione...</option>
                    {DEPARTMENTS.map(d => <option key={d.value} value={d.value}>{d.icon} {d.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase mb-1.5" style={{ color: "#888", letterSpacing: "1px" }}>Categoria</label>
                  <select value={category} onChange={e => setCategory(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-lg text-sm text-white outline-none" style={inputStyle}>
                    <option value="">Selecione...</option>
                    {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase mb-1.5" style={{ color: "#888", letterSpacing: "1px" }}>Assunto *</label>
                <input type="text" value={subject} onChange={e => setSubject(e.target.value)} required
                  placeholder="Ex: Balança do açougue com defeito"
                  className="w-full px-3 py-2.5 rounded-lg text-sm text-white outline-none" style={inputStyle} />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase mb-1.5" style={{ color: "#888", letterSpacing: "1px" }}>Prioridade</label>
                <div className="flex gap-2">
                  {(["normal", "alta", "urgente"] as const).map(p => (
                    <button key={p} type="button" onClick={() => setPriority(p)}
                      className="px-4 py-2 rounded-lg text-xs font-bold uppercase transition-all"
                      style={{
                        background: priority === p ? (p === "urgente" ? "#DC2626" : p === "alta" ? "#F59E0B" : "#333") : "#141414",
                        color: priority === p ? "white" : "#666",
                        border: `1px solid ${priority === p ? "transparent" : "#2A2A2A"}`,
                      }}>{p}</button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase mb-1.5" style={{ color: "#888", letterSpacing: "1px" }}>Descrição *</label>
                <textarea value={description} onChange={e => setDescription(e.target.value)} required rows={4}
                  placeholder="Descreva o problema ou solicitação com detalhes..."
                  className="w-full px-3 py-2.5 rounded-lg text-sm text-white outline-none resize-y" style={inputStyle} />
              </div>
              <button disabled={sending} type="submit" className="w-full py-3 rounded-lg text-sm font-bold text-white"
                style={{ background: sending ? "#444" : "linear-gradient(135deg, #DC2626, #B91C1C)", cursor: sending ? "not-allowed" : "pointer", boxShadow: "0 4px 16px rgba(220,38,38,0.3)" }}>
                {sending ? "Enviando..." : "Enviar Chamado"}
              </button>
            </form>
          )}

          {/* Filters */}
          <div className="flex gap-1.5 flex-wrap">
            {[{ value: "todos", label: "Todos" }, { value: "aberto", label: "Abertos" }, { value: "em_andamento", label: "Andamento" }, { value: "resolvido", label: "Resolvidos" }].map(f => (
              <button key={f.value} onClick={() => setFilter(f.value)}
                className="px-3 py-1 rounded-full text-[10px] font-bold transition-all"
                style={{ background: filter === f.value ? "#DC2626" : "#131313", color: filter === f.value ? "white" : "#666", border: `1px solid ${filter === f.value ? "#DC2626" : "#2A2A2A"}` }}>
                {f.label}
              </button>
            ))}
          </div>

          {/* Ticket List */}
          <div className="space-y-3">
            {filtered.length === 0 ? (
              <div className="text-center py-12 rounded-xl text-sm" style={{ background: "#131313", color: "#555" }}>
                {tickets.length === 0 ? "Nenhum chamado ainda. Clique em '+ Novo Chamado' acima." : "Nenhum chamado com este filtro."}
              </div>
            ) : filtered.map(t => {
              const st = ST[t.status] || ST.aberto;
              const prioC: Record<string, string> = { urgente: "#DC2626", alta: "#F59E0B", normal: "#555" };
              return (
                <div key={t.id} className="rounded-xl p-4 transition-all" style={{ background: "#131313", border: "1px solid #1E1E1E", borderLeft: `4px solid ${st.color}` }}>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="font-bold text-sm">{t.subject}</div>
                    <span className="text-[9px] font-bold px-2.5 py-0.5 rounded-full whitespace-nowrap uppercase" style={{ background: st.bg, color: st.color, letterSpacing: "0.4px" }}>{st.label}</span>
                  </div>
                  <div className="flex gap-1.5 mb-2 flex-wrap">
                    <span className="text-[9px] font-bold px-2 py-0.5 rounded" style={{ background: "rgba(220,38,38,0.08)", color: "#DC2626" }}>
                      {deptIcon(t.department)} {deptLabel(t.department)}
                    </span>
                    {t.category && <span className="text-[9px] font-bold px-2 py-0.5 rounded" style={{ background: "#1A1A1A", color: "#888" }}>{catLabel(t.category)}</span>}
                    <span className="text-[9px] font-bold uppercase" style={{ color: prioC[t.priority] || "#555" }}>● {t.priority}</span>
                  </div>
                  <p className="text-xs leading-relaxed mb-2" style={{ color: "#999" }}>{t.description}</p>
                  {t.response && (
                    <div className="mt-2 p-3 rounded-lg text-xs" style={{ background: "rgba(16,185,129,0.04)", border: "1px solid rgba(16,185,129,0.15)", color: "#BBB" }}>
                      <strong className="block text-[9px] font-bold uppercase mb-1" style={{ color: "#10B981", letterSpacing: "0.8px" }}>Resposta{t.responded_by ? ` · ${t.responded_by}` : ""}:</strong>
                      {t.response}
                    </div>
                  )}
                  <div className="text-[10px] mt-2" style={{ color: "#444" }}>#{t.id} · {new Date(t.created_at).toLocaleString("pt-BR")}</div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* Admin Tab */
        <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold">Painel Admin</h2>
            <button onClick={() => setShowNewUser(!showNewUser)} className="text-xs font-bold px-3 py-1.5 rounded-lg"
              style={{ background: showNewUser ? "#1A1A1A" : "#DC2626", color: "white", border: showNewUser ? "1px solid #DC2626" : "none" }}>
              {showNewUser ? "✕ Cancelar" : "+ Novo Usuário"}
            </button>
          </div>

          {showNewUser && (
            <form onSubmit={handleCreateUser} className="rounded-xl p-5 space-y-3" style={{ background: "#131313", border: "1px solid rgba(220,38,38,0.15)" }}>
              <h3 className="text-sm font-bold">Cadastrar Novo Usuário</h3>
              <div className="grid sm:grid-cols-2 gap-3">
                <input type="text" value={nuName} onChange={e => setNuName(e.target.value)} required placeholder="Nome completo"
                  className="w-full px-3 py-2.5 rounded-lg text-sm text-white outline-none" style={inputStyle} />
                <select value={nuDept} onChange={e => setNuDept(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-lg text-sm text-white outline-none" style={inputStyle}>
                  <option value="">Setor...</option>
                  {DEPARTMENTS.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
                </select>
                <input type="text" value={nuUser} onChange={e => setNuUser(e.target.value)} required placeholder="Usuário (login)"
                  className="w-full px-3 py-2.5 rounded-lg text-sm text-white outline-none" style={inputStyle} />
                <input type="text" value={nuPass} onChange={e => setNuPass(e.target.value)} required placeholder="Senha"
                  className="w-full px-3 py-2.5 rounded-lg text-sm text-white outline-none" style={inputStyle} />
              </div>
              <select value={nuRole} onChange={e => setNuRole(e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg text-sm text-white outline-none" style={inputStyle}>
                <option value="colaborador">Colaborador</option>
                <option value="gerente">Gerente</option>
                <option value="admin">Admin</option>
              </select>
              <button type="submit" className="w-full py-2.5 rounded-lg text-sm font-bold text-white"
                style={{ background: "linear-gradient(135deg, #DC2626, #B91C1C)" }}>Cadastrar</button>
            </form>
          )}

          {/* Users Table */}
          <div className="rounded-xl overflow-hidden" style={{ background: "#131313", border: "1px solid #1E1E1E" }}>
            <div className="px-4 py-3 font-bold text-sm" style={{ borderBottom: "1px solid #1E1E1E" }}>👥 Usuários ({users.length})</div>
            <div className="divide-y" style={{ borderColor: "#1A1A1A" }}>
              {users.map(u => (
                <div key={u.id} className="px-4 py-3 flex items-center justify-between">
                  <div>
                    <div className="text-sm font-semibold">{u.name}</div>
                    <div className="text-[10px]" style={{ color: "#666" }}>{u.department || "—"} · @{u.username}</div>
                  </div>
                  <span className="text-[9px] font-bold px-2 py-0.5 rounded-full uppercase"
                    style={{ background: u.role === "admin" ? "rgba(220,38,38,0.1)" : "#1A1A1A", color: u.role === "admin" ? "#DC2626" : "#888" }}>
                    {u.role}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* All Tickets */}
          <div className="rounded-xl overflow-hidden" style={{ background: "#131313", border: "1px solid #1E1E1E" }}>
            <div className="px-4 py-3 font-bold text-sm" style={{ borderBottom: "1px solid #1E1E1E" }}>📋 Todos os Chamados ({allTickets.length})</div>
            <div className="divide-y" style={{ borderColor: "#1A1A1A" }}>
              {allTickets.length === 0 ? (
                <div className="px-4 py-8 text-center text-sm" style={{ color: "#555" }}>Nenhum chamado</div>
              ) : allTickets.map(t => {
                const st = ST[t.status] || ST.aberto;
                return (
                  <div key={t.id} className="px-4 py-3">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <div>
                        <div className="text-sm font-semibold">{t.subject}</div>
                        <div className="text-[10px]" style={{ color: "#666" }}>
                          {t.makrochui_users?.name || "?"} · {deptIcon(t.department)} {deptLabel(t.department)} · #{t.id}
                        </div>
                      </div>
                      <span className="text-[9px] font-bold px-2 py-0.5 rounded-full uppercase whitespace-nowrap" style={{ background: st.bg, color: st.color }}>{st.label}</span>
                    </div>
                    <p className="text-xs mb-2" style={{ color: "#888" }}>{t.description}</p>
                    {t.response && <div className="text-xs p-2 rounded mb-2" style={{ background: "rgba(16,185,129,0.04)", color: "#AAA" }}>✅ {t.response}</div>}
                    {respondId === t.id ? (
                      <div className="space-y-2 mt-2">
                        <textarea value={respText} onChange={e => setRespText(e.target.value)} rows={2} placeholder="Resposta..."
                          className="w-full px-3 py-2 rounded-lg text-xs text-white outline-none" style={inputStyle} />
                        <div className="flex gap-2">
                          <select value={respStatus} onChange={e => setRespStatus(e.target.value)}
                            className="px-2 py-1.5 rounded-lg text-xs text-white outline-none" style={inputStyle}>
                            <option value="">Manter status</option>
                            <option value="em_andamento">Em Andamento</option>
                            <option value="resolvido">Resolvido</option>
                            <option value="fechado">Fechado</option>
                          </select>
                          <button onClick={() => handleRespond(t.id)} className="px-3 py-1.5 rounded-lg text-xs font-bold text-white" style={{ background: "#DC2626" }}>Enviar</button>
                          <button onClick={() => { setRespondId(null); setRespText(""); setRespStatus(""); }} className="px-3 py-1.5 rounded-lg text-xs font-bold" style={{ color: "#888" }}>Cancelar</button>
                        </div>
                      </div>
                    ) : (
                      <button onClick={() => setRespondId(t.id)} className="text-[10px] font-bold" style={{ color: "#DC2626" }}>Responder →</button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
