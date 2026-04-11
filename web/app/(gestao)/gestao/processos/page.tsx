"use client";

import { createClient } from "@/lib/supabase-browser";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";

interface Processo {
  id: string;
  competencia: string;
  status: string;
  economia_gerada: number;
  publicado_em: string | null;
  empresas: { razao_social: string; nome_fantasia: string | null };
}

interface Empresa {
  id: string;
  razao_social: string;
  nome_fantasia: string | null;
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  pendente: { label: "Pendente", color: "bg-gray-600" },
  em_andamento: { label: "Em andamento", color: "bg-yellow-600" },
  concluido: { label: "Concluido", color: "bg-blue-600" },
  publicado: { label: "Publicado", color: 'bg-[#00E676] text-black' },
};

export default function ProcessosPage() {
  const supabase = createClient();
  const router = useRouter();
  const [processos, setProcessos] = useState<Processo[]>([]);
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [newEmpresa, setNewEmpresa] = useState("");
  const [newCompetencia, setNewCompetencia] = useState("");
  const [creating, setCreating] = useState(false);

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

      await loadData();
      setLoading(false);
    }
    init();
  }, []);

  async function loadData() {
    const [procRes, empRes] = await Promise.all([
      supabase
        .from("processos_mensais")
        .select("*, empresas(razao_social, nome_fantasia)")
        .order("competencia", { ascending: false }),
      supabase
        .from("empresas")
        .select("id, razao_social, nome_fantasia")
        .eq("ativo", true)
        .order("razao_social"),
    ]);
    setProcessos(procRes.data || []);
    setEmpresas(empRes.data || []);
    if (empRes.data && empRes.data.length > 0 && !newEmpresa) {
      setNewEmpresa(empRes.data[0].id);
    }
  }

  async function criarProcesso() {
    if (!newEmpresa || !newCompetencia) return;
    setCreating(true);

    const res = await fetch("/api/processos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        empresa_id: newEmpresa,
        competencia: newCompetencia + "-01",
      }),
    });

    if (res.ok) {
      setShowNew(false);
      setNewCompetencia("");
      await loadData();
    }
    setCreating(false);
  }

  function formatDate(d: string) {
    const date = new Date(d + "T00:00:00");
    return date.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-[#0a0a0a] text-white flex items-center justify-center">
        <div className="text-gray-400">Carregando...</div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#0a0a0a] text-white">
      <header className="bg-[#0d0d0d] border-b border-[#1f1f1f] p-4 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/gestao" className="text-xs text-gray-400 hover:text-[#00E676]">
              {"\u2190"} Gestao
            </Link>
            <div className="h-4 w-px bg-[#1f1f1f]" />
            <div>
              <div className="text-[10px] text-[#00E676]">Processos Mensais</div>
              <div className="font-bold">Analise e Auditoria</div>
            </div>
          </div>
          <form action="/api/auth/signout" method="post">
            <button className="text-xs text-gray-400 hover:text-[#00E676]">Sair</button>
          </form>
        </div>
      </header>

      <section className="max-w-6xl mx-auto p-6">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold">Processos Mensais</h1>
            <p className="text-gray-400 mt-1">Gerencie a analise e publique resultados para os clientes.</p>
          </div>
          <button
            onClick={() => setShowNew(!showNew)}
            className="bg-[#00E676] text-black font-bold py-2 px-6 rounded-xl hover:bg-[#00c864] transition text-sm"
          >
            + Novo processo
          </button>
        </div>

        {showNew && (
          <div className="bg-[#141414] border border-[#1f1f1f] rounded-xl p-6 mb-8">
            <h2 className="text-lg font-bold mb-4">Criar processo mensal</h2>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-gray-400 mb-2">Empresa</label>
                <select
                  value={newEmpresa}
                  onChange={(e) => setNewEmpresa(e.target.value)}
                  className="w-full bg-[#0a0a0a] border border-[#1f1f1f] rounded-lg px-4 py-3 text-white focus:border-[#00E676] focus:outline-none"
                >
                  {empresas.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.nome_fantasia || emp.razao_social}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-2">Competencia (mes/ano)</label>
                <input
                  type="month"
                  value={newCompetencia}
                  onChange={(e) => setNewCompetencia(e.target.value)}
                  className="w-full bg-[#0a0a0a] border border-[#1f1f1f] rounded-lg px-4 py-3 text-white focus:border-[#00E676] focus:outline-none"
                />
              </div>
            </div>
            <div className="flex gap-3 mt-4">
              <button
                onClick={criarProcesso}
                disabled={creating || !newCompetencia}
                className="bg-[#00E676] text-black font-bold py-2 px-6 rounded-xl hover:bg-[#00c864] disabled:opacity-50 transition text-sm"
              >
                {creating ? "Criando..." : "Criar"}
              </button>
              <button
                onClick={() => setShowNew(false)}
                className="text-gray-400 text-sm hover:text-white"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}

        {processos.length === 0 ? (
          <div className="bg-[#141414] border border-[#1f1f1f] rounded-xl p-12 text-center text-gray-500">
            Nenhum processo criado ainda. Clique em &quot;Novo processo&quot; para comecar.
          </div>
        ) : (
          <div className="space-y-3">
            {processos.map((proc) => {
              const st = STATUS_LABELS[proc.status] || STATUS_LABELS.pendente;
              return (
                <Link
                  key={proc.id}
                  href={`/gestao/processos/${proc.id}`}
                  className="block bg-[#141414] border border-[#1f1f1f] rounded-xl p-5 hover:border-[#00E676] transition group"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div>
                        <div className="font-bold text-lg group-hover:text-[#00E676] transition">
                          {proc.empresas?.nome_fantasia || proc.empresas?.razao_social}
                        </div>
                        <div className="text-sm text-gray-400 mt-0.5">
                          {formatDate(proc.competencia)}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      {proc.economia_gerada > 0 && (
                        <div className="text-right">
                          <div className="text-xs text-gray-500">Economia</div>
                          <div className="text-[#00E676] font-bold">
                            R$ {Number(proc.economia_gerada).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                          </div>
                        </div>
                      )}
                      <span className={`text-[10px] font-bold tracking-wider px-3 py-1 rounded-full ${st.color}`}>
                        {st.label}
                      </span>
                    </div>
                  </div>
                  {proc.publicado_em && (
                    <div className="text-xs text-gray-500 mt-2">
                      Publicado em {new Date(proc.publicado_em).toLocaleDateString("pt-BR")}
                    </div>
                  )}
                </Link>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
