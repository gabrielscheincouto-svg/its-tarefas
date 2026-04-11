"use client";

import { createClient } from "@/lib/supabase-browser";
import { useRouter, useParams } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";

interface AuditItem {
  id: string;
  item: string;
  valor_contador: number;
  valor_its: number;
  impacto: number;
  observacao: string | null;
}

interface Indicadores {
  margem_bruta: number | null;
  margem_liquida: number | null;
  liquidez_corrente: number | null;
  roe: number | null;
  roa: number | null;
  health_score: number | null;
}

interface Documento {
  id: string;
  codigo: string;
  nome_arquivo: string;
  tamanho: number;
  enviado_em: string;
}

export default function ProcessoDetailPage() {
  const supabase = createClient();
  const router = useRouter();
  const params = useParams();
  const processoId = params.id as string;

  const [processo, setProcesso] = useState<any>(null);
  const [auditoria, setAuditoria] = useState<AuditItem[]>([]);
  const [indicadores, setIndicadores] = useState<Indicadores>({
    margem_bruta: null, margem_liquida: null, liquidez_corrente: null,
    roe: null, roa: null, health_score: null,
  });
  const [documentos, setDocumentos] = useState<Documento[]>([]);
  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState(false);
  const [savingInd, setSavingInd] = useState(false);
  const [economia, setEconomia] = useState("0");

  const [newItem, setNewItem] = useState("");
  const [newVC, setNewVC] = useState("");
  const [newVI, setNewVI] = useState("");
  const [newObs, setNewObs] = useState("");
  const [addingAudit, setAddingAudit] = useState(false);

  useEffect(() => {
    loadAll();
  }, [processoId]);

  async function loadAll() {
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

    const { data: proc } = await supabase
      .from("processos_mensais")
      .select("*, empresas(id, razao_social, nome_fantasia, cnpj)")
      .eq("id", processoId)
      .single();

    if (!proc) { router.push("/gestao/processos"); return; }
    setProcesso(proc);
    setEconomia(String(proc.economia_gerada || 0));

    const { data: audits } = await supabase
      .from("auditoria_diffs")
      .select("*")
      .eq("processo_id", processoId)
      .order("created_at");
    setAuditoria(audits || []);

    const { data: ind } = await supabase
      .from("indicadores")
      .select("*")
      .eq("processo_id", processoId)
      .maybeSingle();
    if (ind) setIndicadores(ind);

    const { data: docs } = await supabase
      .from("documentos")
      .select("id, codigo, nome_arquivo, tamanho, enviado_em")
      .eq("empresa_id", proc.empresas.id)
      .order("enviado_em", { ascending: false })
      .limit(20);
    setDocumentos(docs || []);

    setLoading(false);
  }

  async function addAuditItem() {
    if (!newItem || !newVC || !newVI) return;
    setAddingAudit(true);
    const res = await fetch(`/api/processos/${processoId}/auditoria`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        item: newItem,
        valor_contador: parseFloat(newVC),
        valor_its: parseFloat(newVI),
        observacao: newObs || null,
      }),
    });
    if (res.ok) {
      setNewItem(""); setNewVC(""); setNewVI(""); setNewObs("");
      const data = await res.json();
      setAuditoria([...auditoria, data]);
    }
    setAddingAudit(false);
  }

  async function saveIndicadores() {
    setSavingInd(true);
    await fetch(`/api/processos/${processoId}/indicadores`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(indicadores),
    });
    setSavingInd(false);
  }

  async function saveEconomia() {
    await supabase
      .from("processos_mensais")
      .update({ economia_gerada: parseFloat(economia) || 0 })
      .eq("id", processoId);
  }

  async function updateStatus(status: string) {
    await supabase
      .from("processos_mensais")
      .update({ status })
      .eq("id", processoId);
    setProcesso({ ...processo, status });
  }

  async function publicar() {
    setPublishing(true);
    await saveEconomia();
    await saveIndicadores();
    const res = await fetch(`/api/processos/${processoId}/publicar`, { method: "POST" });
    if (res.ok) {
      const data = await res.json();
      setProcesso({ ...processo, ...data });
    }
    setPublishing(false);
  }

  function formatBRL(n: number) {
    return "R$ " + Number(n).toLocaleString("pt-BR", { minimumFractionDigits: 2 });
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

  const totalImpacto = auditoria.reduce((sum, a) => sum + (a.impacto || 0), 0);
  const isPublished = processo?.status === "publicado";

  return (
    <main className="min-h-screen bg-[#0a0a0a] text-white">
      <header className="bg-[#0d0d0d] border-b border-[#1f1f1f] p-4 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/gestao/processos" className="text-xs text-gray-400 hover:text-[#00E676]">
              <- Processos
            </Link>
            <div className="h-4 w-px bg-[#1f1f1f]" />
            <div>
              <div className="text-[10px] text-[#00E676]">
                {processo?.empresas?.nome_fantasia || processo?.empresas?.razao_social}
              </div>
              <div className="font-bold">{formatDate(processo?.competencia)}</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {!isPublished && (
              <>
                <select
                  value={processo?.status}
                  onChange={(e) => updateStatus(e.target.value)}
                  className="bg-[#141414] border border-[#1f1f1f] rounded-lg px-3 py-1.5 text-xs text-white"
                >
                  <option value="pendente">Pendente</option>
                  <option value="em_andamento">Em andamento</option>
                  <option value="concluido">Concluido</option>
                </select>
                <button
                  onClick={publicar}
                  disabled={publishing}
                  className="bg-[#00E676] text-black font-bold py-1.5 px-5 rounded-xl hover:bg-[#00c864] disabled:opacity-50 transition text-sm"
                >
                  {publishing ? "Publicando..." : "Publicar para o cliente"}
                </button>
              </>
            )}
            {isPublished && (
              <span className="text-[10px] font-bold tracking-wider px-3 py-1 rounded-full bg-[#00E676] text-black">
                PUBLICADO
              </span>
            )}
          </div>
        </div>
      </header>

      <section className="max-w-6xl mx-auto p-6 space-y-8">
        <div className="bg-[#141414] border border-[#1f1f1f] rounded-xl p-6">
          <h2 className="text-lg font-bold mb-4">Documentos recebidos do contador</h2>
          {documentos.length === 0 ? (
            <p className="text-gray-500 text-center py-4">Nenhum documento recebido.</p>
          ) : (
            <div className="grid md:grid-cols-2 gap-2">
              {documentos.map((doc) => (
                <div key={doc.id} className="flex items-center gap-3 bg-[#0a0a0a] border border-[#1f1f1f] rounded-lg px-4 py-3">
                  <span className="text-lg">{doc.nome_arquivo.endsWith(".pdf") ? "PDF" : doc.nome_arquivo.endsWith(".xlsx") ? "XLS" : "FILE"}</span>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm truncate">{doc.nome_arquivo}</div>
                    <div className="text-xs text-gray-500">{doc.codigo} - {new Date(doc.enviado_em).toLocaleDateString("pt-BR")}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-[#141414] border border-[#00E676]/30 rounded-xl p-6">
          <h2 className="text-lg font-bold mb-4">Economia gerada pela ITS</h2>
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <label className="block text-xs text-gray-400 mb-1">Valor (R$)</label>
              <input
                type="number"
                value={economia}
                onChange={(e) => setEconomia(e.target.value)}
                onBlur={saveEconomia}
                disabled={isPublished}
                step="0.01"
                className="w-full bg-[#0a0a0a] border border-[#1f1f1f] rounded-lg px-4 py-3 text-2xl font-bold text-[#00E676] focus:border-[#00E676] focus:outline-none disabled:opacity-60"
              />
            </div>
            {totalImpacto > 0 && (
              <div className="text-right">
                <div className="text-xs text-gray-500">Total auditoria</div>
                <div className="text-lg font-bold text-[#00E676]">{formatBRL(totalImpacto)}</div>
                <button
                  onClick={() => { setEconomia(String(totalImpacto)); }}
                  className="text-[10px] text-[#00E676] hover:underline mt-1"
                  disabled={isPublished}
                >
                  Usar este valor
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="bg-[#141414] border border-[#1f1f1f] rounded-xl p-6">
          <h2 className="text-lg font-bold mb-4">Ajustes da Auditoria</h2>
          {auditoria.length > 0 && (
            <div className="overflow-x-auto mb-6">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-gray-500 uppercase">
                    <th className="text-left pb-3">Item</th>
                    <th className="text-right pb-3">Valor Contador</th>
                    <th className="text-right pb-3">Valor ITS</th>
                    <th className="text-right pb-3">Impacto</th>
                    <th className="text-left pb-3 pl-4">Obs</th>
                  </tr>
                </thead>
                <tbody>
                  {auditoria.map((a) => (
                    <tr key={a.id} className="border-t border-[#1f1f1f]">
                      <td className="py-3 font-medium">{a.item}</td>
                      <td className="py-3 text-right text-gray-400">{formatBRL(a.valor_contador)}</td>
                      <td className="py-3 text-right">{formatBRL(a.valor_its)}</td>
                      <td className="py-3 text-right text-[#00E676] font-bold">{formatBRL(a.impacto)}</td>
                      <td className="py-3 pl-4 text-gray-500 text-xs">{a.observacao || "-"}</td>
                    </tr>
                  ))}
                  <tr className="border-t-2 border-[#00E676]/30">
                    <td className="py-3 font-bold" colSpan={3}>Total</td>
                    <td className="py-3 text-right text-[#00E676] font-bold text-lg">{formatBRL(totalImpacto)}</td>
                    <td></td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
          {!isPublished && (
            <div className="border-t border-[#1f1f1f] pt-4">
              <h3 className="text-sm font-bold mb-3">Adicionar item</h3>
              <div className="grid md:grid-cols-4 gap-3">
                <input placeholder="Item (ex: PIS/COFINS)" value={newItem} onChange={(e) => setNewItem(e.target.value)} className="bg-[#0a0a0a] border border-[#1f1f1f] rounded-lg px-3 py-2 text-sm text-white focus:border-[#00E676] focus:outline-none" />
                <input placeholder="Valor Contador" type="number" step="0.01" value={newVC} onChange={(e) => setNewVC(e.target.value)} className="bg-[#0a0a0a] border border-[#1f1f1f] rounded-lg px-3 py-2 text-sm text-white focus:border-[#00E676] focus:outline-none" />
                <input placeholder="Valor ITS" type="number" step="0.01" value={newVI} onChange={(e) => setNewVI(e.target.value)} className="bg-[#0a0a0a] border border-[#1f1f1f] rounded-lg px-3 py-2 text-sm text-white focus:border-[#00E676] focus:outline-none" />
                <input placeholder="Observacao (opcional)" value={newObs} onChange={(e) => setNewObs(e.target.value)} className="bg-[#0a0a0a] border border-[#1f1f1f] rounded-lg px-3 py-2 text-sm text-white focus:border-[#00E676] focus:outline-none" />
              </div>
              <button onClick={addAuditItem} disabled={addingAudit || !newItem || !newVC || !newVI} className="mt-3 bg-[#1f1f1f] text-white font-bold py-2 px-6 rounded-xl hover:bg-[#2a2a2a] disabled:opacity-50 transition text-sm">
                {addingAudit ? "Adicionando..." : "+ Adicionar"}
              </button>
            </div>
          )}
        </div>

        <div className="bg-[#141414] border border-[#1f1f1f] rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold">Indicadores Financeiros</h2>
            {!isPublished && (
              <button onClick={saveIndicadores} disabled={savingInd} className="text-sm bg-[#1f1f1f] text-white font-bold py-1.5 px-4 rounded-lg hover:bg-[#2a2a2a] disabled:opacity-50 transition">
                {savingInd ? "Salvando..." : "Salvar indicadores"}
              </button>
            )}
          </div>
          <div className="grid md:grid-cols-3 gap-4">
            {[
              { key: "margem_bruta", label: "Margem Bruta (%)" },
              { key: "margem_liquida", label: "Margem Liquida (%)" },
              { key: "liquidez_corrente", label: "Liquidez Corrente" },
              { key: "roe", label: "ROE (%)" },
              { key: "roa", label: "ROA (%)" },
              { key: "health_score", label: "Health Score (0-100)" },
            ].map((field) => (
              <div key={field.key}>
                <label className="block text-xs text-gray-400 mb-1">{field.label}</label>
                <input
                  type="number"
                  step="0.01"
                  value={(indicadores as any)[field.key] ?? ""}
                  onChange={(e) =>
                    setIndicadores({
                      ...indicadores,
                      [field.key]: e.target.value ? parseFloat(e.target.value) : null,
                    })
                  }
                  disabled={isPublished}
                  className="w-full bg-[#0a0a0a] border border-[#1f1f1f] rounded-lg px-3 py-2 text-sm text-white focus:border-[#00E676] focus:outline-none disabled:opacity-60"
                />
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
      }
