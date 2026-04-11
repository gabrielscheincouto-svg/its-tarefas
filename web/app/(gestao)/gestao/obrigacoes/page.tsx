"use client";

import { createClient } from "@/lib/supabase-browser";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";

interface Obrigacao {
  id: string;
  empresa_id: string;
  nome: string;
  descricao: string | null;
  dia_vencimento: number;
  recorrencia: string;
  ativo: boolean;
}

interface Entrega {
  id: string;
  obrigacao_id: string;
  competencia: string;
  status: string;
  data_vencimento: string;
  data_entrega: string | null;
  arquivo_nome: string | null;
  arquivo_url: string | null;
  observacao: string | null;
  obrigacoes: { nome: string };
}

interface Empresa {
  id: string;
  razao_social: string;
  nome_fantasia: string | null;
}

interface SummaryCard {
  label: string;
  value: number;
  color: string;
}

const STATUS_COLORS: Record<string, string> = {
  pendente: "bg-yellow-600/20 text-yellow-400",
  em_andamento: "bg-blue-600/20 text-blue-400",
  concluido: "bg-green-600/20 text-green-400",
  atrasado: "bg-red-600/20 text-red-400",
};

const STATUS_LABELS: Record<string, string> = {
  pendente: "Pendente",
  em_andamento: "Em andamento",
  concluido: "Conclu\u00eddo",
  atrasado: "Atrasado",
};

export default function ObrigacoesPage() {
  const supabase = createClient();
  const router = useRouter();
  const [obrigacoes, setObrigacoes] = useState<Obrigacao[]>([]);
  const [entregas, setEntregas] = useState<Entrega[]>([]);
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEmpresa, setSelectedEmpresa] = useState<string>("");
  const [selectedCompetencia, setSelectedCompetencia] = useState<string>("");
  const [showNewForm, setShowNewForm] = useState(false);
  const [summaryCards, setSummaryCards] = useState<SummaryCard[]>([]);

  // Form state
  const [newNome, setNewNome] = useState("");
  const [newDescricao, setNewDescricao] = useState("");
  const [newDiaVencimento, setNewDiaVencimento] = useState("15");
  const [newRecorrencia, setNewRecorrencia] = useState("mensal");
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [togglingAtivo, setTogglingAtivo] = useState<string | null>(null);
  const [gerando, setGerando] = useState(false);

  // Initialize
  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }

      const { data: p } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();

      if (!p || !["admin", "internal"].includes(p.role)) {
        router.push("/cliente");
        return;
      }

      await loadEmpresas();
      setLoading(false);
    }
    init();
  }, []);

  // Load quando empresa muda
  useEffect(() => {
    if (selectedEmpresa) {
      loadObrigacoes();
      loadSummaryCards();
    }
  }, [selectedEmpresa]);

  // Load quando competencia muda
  useEffect(() => {
    if (selectedEmpresa && selectedCompetencia) {
      loadEntregas();
    }
  }, [selectedEmpresa, selectedCompetencia]);

  async function loadEmpresas() {
    const { data } = await supabase
      .from("empresas")
      .select("id, razao_social, nome_fantasia")
      .eq("ativo", true)
      .order("razao_social");

    setEmpresas(data || []);
    if (data && data.length > 0) {
      setSelectedEmpresa(data[0].id);
      // Set competencia to current month
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, "0");
      setSelectedCompetencia(`${year}-${month}`);
    }
  }

  async function loadObrigacoes() {
    const { data } = await supabase
      .from("obrigacoes")
      .select("*")
      .eq("empresa_id", selectedEmpresa)
      .order("nome");

    setObrigacoes(data || []);
  }

  async function loadSummaryCards() {
    const today = new Date().toISOString().split("T")[0];
    const currentMonth = new Date().toISOString().slice(0, 7);

    // Total ativas
    const { count: totalAtivas } = await supabase
      .from("obrigacoes")
      .select("id", { count: "exact", head: true })
      .eq("empresa_id", selectedEmpresa)
      .eq("ativo", true);

    // Entregas pendentes este m\u00eas
    const { count: pendentesEsteMs } = await supabase
      .from("entregas")
      .select("id", { count: "exact", head: true })
      .eq("empresa_id", selectedEmpresa)
      .eq("competencia", currentMonth)
      .eq("status", "pendente");

    // Entregas conclu\u00eddas este m\u00eas
    const { count: concluidasEsteMs } = await supabase
      .from("entregas")
      .select("id", { count: "exact", head: true })
      .eq("empresa_id", selectedEmpresa)
      .eq("competencia", currentMonth)
      .eq("status", "concluido");

    // Entregas atrasadas
    const { data: atrasadas } = await supabase
      .from("entregas")
      .select("id")
      .eq("empresa_id", selectedEmpresa)
      .lt("data_vencimento", today)
      .neq("status", "concluido");

    setSummaryCards([
      { label: "Obriga\u00e7\u00f5es Ativas", value: totalAtivas || 0, color: "bg-blue-600/20 text-blue-400" },
      { label: "Entregas Pendentes", value: pendentesEsteMs || 0, color: "bg-yellow-600/20 text-yellow-400" },
      { label: "Entregas Conclu\u00eddas", value: concluidasEsteMs || 0, color: "bg-green-600/20 text-green-400" },
      { label: "Entregas Atrasadas", value: atrasadas?.length || 0, color: "bg-red-600/20 text-red-400" },
    ]);
  }

  async function loadEntregas() {
    const { data } = await supabase
      .from("entregas")
      .select("*, obrigacoes(nome)")
      .eq("empresa_id", selectedEmpresa)
      .eq("competencia", selectedCompetencia)
      .order("data_vencimento");

    setEntregas(data || []);
  }

  async function criarObrigacao() {
    if (!newNome.trim() || !selectedEmpresa) return;

    setCreating(true);
    try {
      const res = await fetch("/api/obrigacoes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          empresa_id: selectedEmpresa,
          nome: newNome,
          descricao: newDescricao || null,
          dia_vencimento: parseInt(newDiaVencimento),
          recorrencia: newRecorrencia,
        }),
      });

      if (res.ok) {
        setNewNome("");
        setNewDescricao("");
        setNewDiaVencimento("15");
        setNewRecorrencia("mensal");
        setShowNewForm(false);
        await loadObrigacoes();
      }
    } finally {
      setCreating(false);
    }
  }

  async function toggleAtivo(id: string, currentAtivo: boolean) {
    setTogglingAtivo(id);
    try {
      const res = await fetch(`/api/obrigacoes/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ativo: !currentAtivo }),
      });

      if (res.ok) {
        await loadObrigacoes();
        await loadSummaryCards();
      }
    } finally {
      setTogglingAtivo(null);
    }
  }

  async function deleteObrigacao(id: string) {
    if (!confirm("Tem certeza que deseja excluir esta obriga\u00e7\u00e3o?")) return;

    setDeleting(id);
    try {
      const res = await fetch(`/api/obrigacoes/${id}`, {
        method: "DELETE",
      });

      if (res.ok) {
        await loadObrigacoes();
        await loadSummaryCards();
      }
    } finally {
      setDeleting(null);
    }
  }

  async function gerarEntregas() {
    if (!selectedEmpresa || !selectedCompetencia) return;

    setGerando(true);
    try {
      const res = await fetch("/api/obrigacoes/gerar-entregas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          empresa_id: selectedEmpresa,
          competencia: selectedCompetencia,
        }),
      });

      if (res.ok) {
        await loadEntregas();
      }
    } finally {
      setGerando(false);
    }
  }

  function getCompetenciaLabel(competencia: string): string {
    const [year, month] = competencia.split("-");
    const date = new Date(parseInt(year), parseInt(month) - 1, 1);
    return date.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-[#0a0a0a] text-white flex items-center justify-center">
        <div className="text-gray-400">Carregando...</div>
      </main>
    );
  }

  if (empresas.length === 0) {
    return (
      <main className="min-h-screen bg-[#0a0a0a] text-white">
        <header className="bg-[#0d0d0d] border-b border-[#1f1f1f] p-4 sticky top-0 z-10">
          <div className="max-w-6xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-[#00E676]" style={{ clipPath: "polygon(0 50%, 50% 0, 100% 50%, 50% 100%)" }} />
              <div>
                <div className="text-[10px] text-[#00E676]">ITS Tax and Corporate</div>
                <div className="font-bold">Gest\u00e3o de Obriga\u00e7\u00f5es</div>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <Link href="/gestao" className="text-xs text-gray-400 hover:text-[#00E676]">{"\u2190"} Gest\u00e3o</Link>
              <form action="/api/auth/signout" method="post">
                <button className="text-xs text-gray-400 hover:text-[#00E676]">Sair</button>
              </form>
            </div>
          </div>
        </header>
        <section className="max-w-6xl mx-auto p-6">
          <div className="bg-[#141414] border border-[#1f1f1f] rounded-xl p-12 text-center text-gray-500">
            Nenhuma empresa cadastrada. Acesse a \u00e1rea de clientes para adicionar empresas.
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#0a0a0a] text-white">
      <header className="bg-[#0d0d0d] border-b border-[#1f1f1f] p-4 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-[#00E676]" style={{ clipPath: "polygon(0 50%, 50% 0, 100% 50%, 50% 100%)" }} />
            <div>
              <div className="text-[10px] text-[#00E676]">ITS Tax and Corporate</div>
              <div className="font-bold">Gest\u00e3o de Obriga\u00e7\u00f5es</div>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/gestao" className="text-xs text-gray-400 hover:text-[#00E676]">{"\u2190"} Gest\u00e3o</Link>
            <form action="/api/auth/signout" method="post">
              <button className="text-xs text-gray-400 hover:text-[#00E676]">Sair</button>
            </form>
          </div>
        </div>
      </header>

      <section className="max-w-6xl mx-auto p-6">
        {/* Empresa Selector */}
        <div className="mb-8">
          <label className="block text-xs text-gray-400 mb-2 font-semibold">EMPRESA</label>
          <select
            value={selectedEmpresa}
            onChange={(e) => setSelectedEmpresa(e.target.value)}
            className="w-full bg-[#141414] border border-[#1f1f1f] rounded-lg px-4 py-3 text-white focus:border-[#00E676] focus:outline-none"
          >
            {empresas.map((emp) => (
              <option key={emp.id} value={emp.id}>
                {emp.nome_fantasia || emp.razao_social}
              </option>
            ))}
          </select>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          {summaryCards.map((card, idx) => (
            <div key={idx} className="bg-[#141414] border border-[#1f1f1f] rounded-lg p-4">
              <div className="text-xs text-gray-400 mb-2">{card.label}</div>
              <div className={`text-3xl font-bold ${card.color}`}>{card.value}</div>
            </div>
          ))}
        </div>

        {/* Nova Obriga\u00e7\u00e3o Form */}
        <div className="mb-8">
          <button
            onClick={() => setShowNewForm(!showNewForm)}
            className="bg-[#00E676] text-black font-bold py-2 px-6 rounded-lg hover:bg-[#00c864] transition text-sm mb-4"
          >
            + Nova Obriga\u00e7\u00e3o
          </button>

          {showNewForm && (
            <div className="bg-[#141414] border border-[#1f1f1f] rounded-lg p-6">
              <h3 className="text-lg font-bold mb-4">Criar nova obriga\u00e7\u00e3o</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs text-gray-400 mb-2">Nome</label>
                  <input
                    type="text"
                    value={newNome}
                    onChange={(e) => setNewNome(e.target.value)}
                    placeholder="Ex: Declara\u00e7\u00e3o de IR"
                    className="w-full bg-[#0a0a0a] border border-[#1f1f1f] rounded-lg px-4 py-3 text-white focus:border-[#00E676] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs text-gray-400 mb-2">Descri\u00e7\u00e3o</label>
                  <textarea
                    value={newDescricao}
                    onChange={(e) => setNewDescricao(e.target.value)}
                    placeholder="Detalhes opcionais..."
                    className="w-full bg-[#0a0a0a] border border-[#1f1f1f] rounded-lg px-4 py-3 text-white focus:border-[#00E676] focus:outline-none resize-none"
                    rows={3}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-gray-400 mb-2">Dia do Vencimento (1-31)</label>
                    <input
                      type="number"
                      min="1"
                      max="31"
                      value={newDiaVencimento}
                      onChange={(e) => setNewDiaVencimento(e.target.value)}
                      className="w-full bg-[#0a0a0a] border border-[#1f1f1f] rounded-lg px-4 py-3 text-white focus:border-[#00E676] focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-2">Recorr\u00eancia</label>
                    <select
                      value={newRecorrencia}
                      onChange={(e) => setNewRecorrencia(e.target.value)}
                      className="w-full bg-[#0a0a0a] border border-[#1f1f1f] rounded-lg px-4 py-3 text-white focus:border-[#00E676] focus:outline-none"
                    >
                      <option value="mensal">Mensal</option>
                      <option value="trimestral">Trimestral</option>
                      <option value="anual">Anual</option>
                    </select>
                  </div>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={criarObrigacao}
                    disabled={creating || !newNome.trim()}
                    className="bg-[#00E676] text-black font-bold py-2 px-6 rounded-lg hover:bg-[#00c864] disabled:opacity-50 transition text-sm"
                  >
                    {creating ? "Criando..." : "Criar"}
                  </button>
                  <button
                    onClick={() => setShowNewForm(false)}
                    className="text-gray-400 text-sm hover:text-white"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Lista de Obriga\u00e7\u00f5es */}
        <div className="mb-12">
          <h2 className="text-2xl font-bold mb-4">Obriga\u00e7\u00f5es Cadastradas</h2>

          {obrigacoes.length === 0 ? (
            <div className="bg-[#141414] border border-[#1f1f1f] rounded-lg p-8 text-center text-gray-500">
              Nenhuma obriga\u00e7\u00e3o cadastrada. Clique em "Nova Obriga\u00e7\u00e3o" para come\u00e7ar.
            </div>
          ) : (
            <div className="space-y-3">
              {obrigacoes.map((obr) => (
                <div
                  key={obr.id}
                  className="bg-[#141414] border border-[#1f1f1f] rounded-lg p-4 flex items-start justify-between hover:border-[#00E676]/50 transition"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-1">
                      <div className="font-bold text-lg">{obr.nome}</div>
                      <span className={`text-[10px] font-bold tracking-wider px-2 py-0.5 rounded ${
                        obr.ativo ? "bg-[#00E676]/20 text-[#00E676]" : "bg-gray-700 text-gray-400"
                      }`}>
                        {obr.ativo ? "ATIVO" : "INATIVO"}
                      </span>
                    </div>
                    {obr.descricao && (
                      <div className="text-sm text-gray-400 mb-2">{obr.descricao}</div>
                    )}
                    <div className="flex gap-4 text-xs text-gray-500">
                      <span>Vencimento: dia {obr.dia_vencimento}</span>
                      <span>Recorr\u00eancia: {obr.recorrencia}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 ml-4">
                    <button
                      onClick={() => toggleAtivo(obr.id, obr.ativo)}
                      disabled={togglingAtivo === obr.id}
                      className="text-xs text-gray-400 hover:text-[#00E676] disabled:opacity-50 transition"
                    >
                      {obr.ativo ? "Desativar" : "Ativar"}
                    </button>
                    <button
                      onClick={() => deleteObrigacao(obr.id)}
                      disabled={deleting === obr.id}
                      className="text-xs text-red-400 hover:text-red-300 disabled:opacity-50 transition"
                    >
                      {deleting === obr.id ? "Excluindo..." : "Excluir"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Competencia Selector */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold mb-4">Entregas</h2>
          <div className="flex items-end gap-4 mb-6">
            <div className="flex-1 max-w-xs">
              <label className="block text-xs text-gray-400 mb-2 font-semibold">M\u00eas/Ano</label>
              <input
                type="month"
                value={selectedCompetencia}
                onChange={(e) => setSelectedCompetencia(e.target.value)}
                className="w-full bg-[#141414] border border-[#1f1f1f] rounded-lg px-4 py-3 text-white focus:border-[#00E676] focus:outline-none"
              />
            </div>
            <button
              onClick={gerarEntregas}
              disabled={gerando}
              className="bg-[#00E676] text-black font-bold py-3 px-6 rounded-lg hover:bg-[#00c864] disabled:opacity-50 transition text-sm"
            >
              {gerando ? "Gerando..." : "Gerar Entregas"}
            </button>
          </div>

          {/* Entregas Table */}
          {entregas.length === 0 ? (
            <div className="bg-[#141414] border border-[#1f1f1f] rounded-lg p-8 text-center text-gray-500">
              Nenhuma entrega para este per\u00edodo. Clique em "Gerar Entregas" para criar.
            </div>
          ) : (
            <div className="bg-[#141414] border border-[#1f1f1f] rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-[#0a0a0a] text-gray-400 text-xs uppercase">
                  <tr>
                    <th className="text-left px-4 py-3">Obriga\u00e7\u00e3o</th>
                    <th className="text-left px-4 py-3">Status</th>
                    <th className="text-left px-4 py-3">Vencimento</th>
                    <th className="text-left px-4 py-3">Entrega</th>
                    <th className="text-left px-4 py-3">Arquivo</th>
                    <th className="text-left px-4 py-3">Observa\u00e7\u00e3o</th>
                  </tr>
                </thead>
                <tbody>
                  {entregas.map((entrega) => (
                    <tr key={entrega.id} className="border-t border-[#1f1f1f] hover:bg-[#0a0a0a]/50">
                      <td className="px-4 py-3 font-medium">{entrega.obrigacoes?.nome}</td>
                      <td className="px-4 py-3">
                        <span className={`text-[10px] font-bold tracking-wider px-2 py-1 rounded ${
                          STATUS_COLORS[entrega.status] || STATUS_COLORS.pendente
                        }`}>
                          {STATUS_LABELS[entrega.status] || entrega.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-400 text-xs">
                        {new Date(entrega.data_vencimento + "T00:00:00").toLocaleDateString("pt-BR")}
                      </td>
                      <td className="px-4 py-3 text-gray-400 text-xs">
                        {entrega.data_entrega
                          ? new Date(entrega.data_entrega + "T00:00:00").toLocaleDateString("pt-BR")
                          : "\u2014"}
                      </td>
                      <td className="px-4 py-3 text-xs">
                        {entrega.arquivo_nome ? (
                          entrega.arquivo_url ? (
                            <a
                              href={entrega.arquivo_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[#00E676] hover:underline"
                            >
                              {entrega.arquivo_nome}
                            </a>
                          ) : (
                            <span className="text-gray-500">{entrega.arquivo_nome}</span>
                          )
                        ) : (
                          <span className="text-gray-500">\u2014</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-400 text-xs max-w-xs truncate">
                        {entrega.observacao || "\u2014"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Hist\u00f3rico Section */}
        <div className="mt-12">
          <h2 className="text-2xl font-bold mb-4">Hist\u00f3rico de Entregas</h2>
          <div className="bg-[#141414] border border-[#1f1f1f] rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-[#0a0a0a] text-gray-400 text-xs uppercase">
                <tr>
                  <th className="text-left px-4 py-3">Per\u00edodo</th>
                  <th className="text-right px-4 py-3">Total</th>
                  <th className="text-right px-4 py-3">Conclu\u00eddas</th>
                  <th className="text-right px-4 py-3">Pendentes</th>
                  <th className="text-right px-4 py-3">Atrasadas</th>
                </tr>
              </thead>
              <tbody>
                {/* This would be populated with historical data from API */}
                <tr className="border-t border-[#1f1f1f] hover:bg-[#0a0a0a]/50">
                  <td colSpan={5} className="text-center text-gray-500 py-8 text-xs">
                    Hist\u00f3rico ser\u00e1 preenchido conforme entregas s\u00e3o geradas.
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </main>
  );
}
