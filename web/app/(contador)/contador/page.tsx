"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase-browser";
import { useRouter } from "next/navigation";

interface Profile {
  nome: string;
  email: string;
}

interface Empresa {
  id: string;
  razao_social: string;
  nome_fantasia: string | null;
  cnpj: string;
  regime: string;
}

interface Obrigacao {
  id: string;
  nome: string;
  descricao: string;
}

interface EntregaRecord {
  id: string;
  empresa_id: string;
  obrigacao_id: string;
  competencia: string;
  data_vencimento: string;
  status: "pendente" | "em_andamento" | "concluido" | "atrasado";
  arquivo_nome: string | null;
  arquivo_url: string | null;
  observacao: string | null;
  obrigacoes: Obrigacao;
}

interface Documento {
  id: string;
  codigo: string;
  nome_arquivo: string;
  tamanho: number;
  enviado_em: string;
}

const DOC_TIPOS = [
  { codigo: "SPED_FISCAL", nome: "SPED Fiscal" },
  { codigo: "SPED_CONTRIB", nome: "SPED Contribui\u00e7\u00f5es" },
  { codigo: "BALANCETE", nome: "Balancete" },
  { codigo: "DCTFWEB", nome: "DCTFWeb" },
  { codigo: "EFD_REINF", nome: "EFD-Reinf" },
  { codigo: "ESOCIAL", nome: "eSocial" },
  { codigo: "OUTRO", nome: "Outro documento" },
];

export default function ContadorPage() {
  const supabase = createClient();
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [selectedEmpresa, setSelectedEmpresa] = useState<string>("");
  const [selectedCompetencia, setSelectedCompetencia] = useState<string>("");
  const [entregas, setEntregas] = useState<EntregaRecord[]>([]);
  const [documentos, setDocumentos] = useState<Documento[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"obrigacoes" | "documentos">("obrigacoes");
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [editingObservacoes, setEditingObservacoes] = useState<Record<string, string>>({});
  const [editingStatus, setEditingStatus] = useState<Record<string, string>>({});
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState("");
  const [selectedCodigo, setSelectedCodigo] = useState("BALANCETE");

  // Initialize
  useEffect(() => {
    const initializePage = async () => {
      setLoading(true);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          router.push("/login");
          return;
        }
        setUser(user);

        const { data: p } = await supabase
          .from("profiles")
          .select("role, nome")
          .eq("id", user.id)
          .maybeSingle();

        if (!p || !["contador", "admin", "internal"].includes(p.role)) {
          router.push("/cliente");
          return;
        }
        setProfile(p);

        // Buscar empresas acess\u00edveis
        const { data: emps } = await supabase
          .from("empresas")
          .select("id, razao_social, nome_fantasia, cnpj, regime")
          .eq("ativo", true)
          .order("razao_social");

        setEmpresas(emps || []);
        if (emps && emps.length > 0) {
          setSelectedEmpresa(emps[0].id);
        }

        // Set default competencia to current month
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, "0");
        setSelectedCompetencia(`${year}-${month}`);

        setLoading(false);
      } catch (error) {
        console.error("Error initializing page:", error);
        setErrorMessage("Erro ao carregar dados");
      }
    };

    initializePage();
  }, [supabase, router]);

  // Load entregas when empresa or competencia changes
  useEffect(() => {
    if (!selectedEmpresa || !selectedCompetencia) return;

    const loadEntregas = async () => {
      try {
        const { data } = await supabase
          .from("obrigacao_entregas")
          .select("*, obrigacoes(id, nome, descricao)")
          .eq("empresa_id", selectedEmpresa)
          .eq("competencia", selectedCompetencia)
          .order("data_vencimento", { ascending: true });

        if (data) {
          setEntregas(data as EntregaRecord[]);
          // Initialize edit states
          const observacoes: Record<string, string> = {};
          const statuses: Record<string, string> = {};
          data.forEach((e) => {
            observacoes[e.id] = e.observacao || "";
            statuses[e.id] = e.status;
          });
          setEditingObservacoes(observacoes);
          setEditingStatus(statuses);
        }
      } catch (error) {
        console.error("Error loading entregas:", error);
        setErrorMessage("Erro ao carregar obriga\u00e7\u00f5es");
      }
    };

    loadEntregas();
  }, [selectedEmpresa, selectedCompetencia, supabase]);

  // Load documentos
  useEffect(() => {
    if (selectedEmpresa) loadDocumentos();
  }, [selectedEmpresa]);

  const loadDocumentos = async () => {
    const { data } = await supabase
      .from("documentos")
      .select("id, codigo, nome_arquivo, tamanho, enviado_em")
      .eq("empresa_id", selectedEmpresa)
      .order("enviado_em", { ascending: false })
      .limit(20);
    setDocumentos(data || []);
  };

  const handleFileUpload = async (entregaId: string, file: File) => {
    if (!file) return;

    setUploadingId(entregaId);
    setSuccessMessage("");
    setErrorMessage("");

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("status", "concluido");

      const response = await fetch(`/api/obrigacoes/entregas/${entregaId}`, {
        method: "PUT",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Upload failed");
      }

      setSuccessMessage("Arquivo enviado com sucesso!");
      setTimeout(() => setSuccessMessage(""), 3000);

      // Refresh entregas
      const { data } = await supabase
        .from("obrigacao_entregas")
        .select("*, obrigacoes(id, nome, descricao)")
        .eq("empresa_id", selectedEmpresa)
        .eq("competencia", selectedCompetencia)
        .order("data_vencimento", { ascending: true });

      if (data) {
        setEntregas(data as EntregaRecord[]);
      }
    } catch (error) {
      console.error("Error uploading file:", error);
      setErrorMessage("Erro ao enviar arquivo");
    } finally {
      setUploadingId(null);
    }
  };

  const handleSaveObservacao = async (entregaId: string) => {
    try {
      const { error } = await supabase
        .from("obrigacao_entregas")
        .update({
          observacao: editingObservacoes[entregaId],
          status: editingStatus[entregaId],
        })
        .eq("id", entregaId);

      if (error) throw error;

      setSuccessMessage("Observa\u00e7\u00e3o salva com sucesso!");
      setTimeout(() => setSuccessMessage(""), 3000);

      // Refresh entregas
      const { data } = await supabase
        .from("obrigacao_entregas")
        .select("*, obrigacoes(id, nome, descricao)")
        .eq("empresa_id", selectedEmpresa)
        .eq("competencia", selectedCompetencia)
        .order("data_vencimento", { ascending: true });

      if (data) {
        setEntregas(data as EntregaRecord[]);
      }
    } catch (error) {
      console.error("Error saving observacao:", error);
      setErrorMessage("Erro ao salvar observa\u00e7\u00e3o");
    }
  };

  const handleUpload = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const fileInput = form.querySelector('input[type="file"]') as HTMLInputElement;
    const file = fileInput?.files?.[0];

    if (!file || !selectedEmpresa) return;

    setUploading(true);
    setUploadMsg("");

    const formData = new FormData();
    formData.append("file", file);
    formData.append("empresa_id", selectedEmpresa);
    formData.append("codigo", selectedCodigo);

    try {
      const res = await fetch("/api/documentos", { method: "POST", body: formData });
      const data = await res.json();

      if (!res.ok) {
        setUploadMsg("Erro: " + (data.error || "Falha no upload"));
      } else {
        setUploadMsg("Documento enviado com sucesso!");
        form.reset();
        loadDocumentos();
      }
    } catch {
      setUploadMsg("Erro de conex\u00e3o");
    }
    setUploading(false);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "concluido":
        return "\u2713"; // checkmark
      case "pendente":
        return "\u26a0"; // warning
      case "em_andamento":
        return "\u23f3"; // hourglass
      case "atrasado":
        return "\u26a0"; // alert
      default:
        return "\u2022"; // bullet
    }
  };

  const getStatusColor = (status: string): string => {
    switch (status) {
      case "concluido":
        return "#00E676";
      case "pendente":
        return "#FDD835";
      case "em_andamento":
        return "#29B6F6";
      case "atrasado":
        return "#EF5350";
      default:
        return "#9E9E9E";
    }
  };

  const getStatusLabel = (status: string): string => {
    switch (status) {
      case "concluido":
        return "Conclu\u00eddo";
      case "pendente":
        return "Pendente";
      case "em_andamento":
        return "Em andamento";
      case "atrasado":
        return "Atrasado";
      default:
        return status;
    }
  };

  const formatDatePtBr = (dateStr: string): string => {
    const date = new Date(dateStr + "T00:00:00");
    return date.toLocaleDateString("pt-BR");
  };

  const calculateStats = () => {
    const now = new Date().toISOString().split("T")[0];
    const stats = {
      pendentes: 0,
      em_andamento: 0,
      concluidas: 0,
      atrasadas: 0,
    };

    entregas.forEach((e) => {
      if (e.status === "concluido") {
        stats.concluidas++;
      } else if (e.status === "em_andamento") {
        stats.em_andamento++;
      } else if (e.data_vencimento < now && e.status !== "concluido") {
        stats.atrasadas++;
      } else if (e.status === "pendente") {
        stats.pendentes++;
      }
    });

    return stats;
  };

  function formatSize(bytes: number) {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-[#0a0a0a] text-white flex items-center justify-center">
        <div className="text-gray-400">Carregando...</div>
      </main>
    );
  }

  const stats = calculateStats();
  const progressPercent = entregas.length > 0 ? Math.round((stats.concluidas / entregas.length) * 100) : 0;

  return (
    <main className="min-h-screen bg-[#0a0a0a] text-white">
      {/* Header */}
      <header className="bg-[#0d0d0d] border-b border-[#1f1f1f] p-4 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className="w-8 h-8 bg-[#00E676]"
              style={{ clipPath: "polygon(0 50%, 50% 0, 100% 50%, 50% 100%)" }}
            />
            <div>
              <div className="text-[10px] text-[#00E676]">\u00c1rea do Contador</div>
              <div className="font-bold">{profile?.nome || "Contador"}</div>
            </div>
          </div>
          <form action="/api/auth/signout" method="post">
            <button className="text-xs text-gray-400 hover:text-[#00E676]">Sair</button>
          </form>
        </div>
      </header>

      {/* Success/Error Messages */}
      {successMessage && (
        <div className="bg-[#0d0d0d] border-b border-[#00E676] p-3 text-center text-[#00E676] text-sm">
          {successMessage}
        </div>
      )}
      {errorMessage && (
        <div className="bg-[#0d0d0d] border-b border-red-500 p-3 text-center text-red-400 text-sm">
          {errorMessage}
        </div>
      )}

      {/* Tab Navigation */}
      <div className="bg-[#0d0d0d] border-b border-[#1f1f1f] sticky top-[73px] z-9">
        <div className="max-w-5xl mx-auto flex">
          <button
            onClick={() => setActiveTab("obrigacoes")}
            className={`flex-1 py-4 text-sm font-medium border-b-2 transition ${
              activeTab === "obrigacoes"
                ? "border-[#00E676] text-[#00E676] bg-[#141414]"
                : "border-transparent text-gray-500 hover:text-gray-400"
            }`}
          >
            Obriga\u00e7\u00f5es
          </button>
          <button
            onClick={() => setActiveTab("documentos")}
            className={`flex-1 py-4 text-sm font-medium border-b-2 transition ${
              activeTab === "documentos"
                ? "border-[#00E676] text-[#00E676] bg-[#141414]"
                : "border-transparent text-gray-500 hover:text-gray-400"
            }`}
          >
            Documentos
          </button>
        </div>
      </div>

      {/* Main Content */}
      <section className="max-w-5xl mx-auto p-6">
        {activeTab === "obrigacoes" ? (
          <div>
            {/* Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              <div className="bg-[#141414] border border-[#1f1f1f] p-6 rounded-lg">
                <div className="text-xs text-gray-400 mb-2">Pendentes</div>
                <div className="text-3xl font-bold text-yellow-400">{stats.pendentes}</div>
              </div>
              <div className="bg-[#141414] border border-[#1f1f1f] p-6 rounded-lg">
                <div className="text-xs text-gray-400 mb-2">Em andamento</div>
                <div className="text-3xl font-bold text-blue-400">{stats.em_andamento}</div>
              </div>
              <div className="bg-[#141414] border border-[#1f1f1f] p-6 rounded-lg">
                <div className="text-xs text-gray-400 mb-2">Conclu\u00eddas</div>
                <div className="text-3xl font-bold text-[#00E676]">{stats.concluidas}</div>
              </div>
              <div className="bg-[#141414] border border-[#1f1f1f] p-6 rounded-lg">
                <div className="text-xs text-gray-400 mb-2">Atrasadas</div>
                <div className="text-3xl font-bold text-red-500">{stats.atrasadas}</div>
              </div>
            </div>

            {/* Selectors */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
              <div>
                <label className="block text-xs text-gray-400 mb-2">Empresa</label>
                <select
                  value={selectedEmpresa}
                  onChange={(e) => setSelectedEmpresa(e.target.value)}
                  className="w-full bg-[#141414] border border-[#1f1f1f] rounded-lg px-4 py-3 text-white focus:border-[#00E676] focus:outline-none text-sm"
                >
                  {empresas.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.nome_fantasia || emp.razao_social} \u2014 CNPJ: {emp.cnpj}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-2">Comp\u00e9tencia (M\u00eas)</label>
                <input
                  type="month"
                  value={selectedCompetencia}
                  onChange={(e) => setSelectedCompetencia(e.target.value)}
                  className="w-full bg-[#141414] border border-[#1f1f1f] rounded-lg px-4 py-3 text-white focus:border-[#00E676] focus:outline-none text-sm"
                />
              </div>
            </div>

            {/* Progress Bar */}
            <div className="mb-8">
              <div className="flex justify-between mb-2">
                <span className="text-xs text-gray-400">Progresso</span>
                <span className="text-xs text-gray-400">
                  {stats.concluidas} de {entregas.length}
                </span>
              </div>
              <div className="w-full h-2 bg-[#141414] rounded border border-[#1f1f1f] overflow-hidden">
                <div
                  className="h-full bg-[#00E676] transition-all duration-300"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>

            {/* Entregas Checklist */}
            <div className="space-y-4">
              {entregas.length === 0 ? (
                <div className="bg-[#141414] border border-[#1f1f1f] p-8 rounded-lg text-center text-gray-500">
                  Nenhuma obriga\u00e7\u00e3o para este per\u00edodo
                </div>
              ) : (
                entregas.map((entrega) => (
                  <div
                    key={entrega.id}
                    className="bg-[#141414] border border-[#1f1f1f] p-6 rounded-lg grid grid-cols-[auto_1fr_auto] gap-4 items-start"
                  >
                    {/* Left: Status Icon */}
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center bg-[#0d0d0d] flex-shrink-0 text-lg"
                      style={{ color: getStatusColor(editingStatus[entrega.id]) }}
                    >
                      {getStatusIcon(editingStatus[entrega.id])}
                    </div>

                    {/* Middle: Details */}
                    <div>
                      <div className="font-semibold mb-2">{entrega.obrigacoes.nome}</div>
                      <div className="text-xs text-gray-400 mb-3">
                        Vencimento: {formatDatePtBr(entrega.data_vencimento)}
                      </div>
                      <div className="flex items-center gap-2 mb-4">
                        <span
                          className="inline-block px-3 py-1 rounded text-xs font-semibold"
                          style={{
                            backgroundColor: getStatusColor(editingStatus[entrega.id]),
                            color: "#0a0a0a",
                          }}
                        >
                          {getStatusLabel(editingStatus[entrega.id])}
                        </span>
                        {entrega.arquivo_nome && (
                          <span className="text-xs text-[#00E676] flex items-center gap-1">
                            \u2713 {entrega.arquivo_nome}
                          </span>
                        )}
                      </div>

                      {/* Observacao Input */}
                      <div className="mb-4">
                        <input
                          type="text"
                          placeholder="Observa\u00e7\u00e3o..."
                          value={editingObservacoes[entrega.id] || ""}
                          onChange={(e) =>
                            setEditingObservacoes({
                              ...editingObservacoes,
                              [entrega.id]: e.target.value,
                            })
                          }
                          className="w-full px-3 py-2 bg-[#0d0d0d] border border-[#1f1f1f] rounded text-white text-sm focus:border-[#00E676] focus:outline-none"
                        />
                      </div>

                      {/* Status Selector */}
                      <div className="mb-4">
                        <select
                          value={editingStatus[entrega.id] || "pendente"}
                          onChange={(e) =>
                            setEditingStatus({
                              ...editingStatus,
                              [entrega.id]: e.target.value,
                            })
                          }
                          className="px-3 py-2 bg-[#0d0d0d] border border-[#1f1f1f] rounded text-white text-sm focus:border-[#00E676] focus:outline-none"
                        >
                          <option value="pendente">Pendente</option>
                          <option value="em_andamento">Em andamento</option>
                          <option value="concluido">Conclu\u00eddo</option>
                        </select>
                      </div>
                    </div>

                    {/* Right: Actions */}
                    <div className="flex flex-col gap-2 w-32 flex-shrink-0">
                      {/* File Upload */}
                      <label className="block px-4 py-2 bg-[#00E676] text-black rounded font-semibold text-xs text-center cursor-pointer hover:bg-[#00c864] transition disabled:opacity-50">
                        {uploadingId === entrega.id ? "Enviando..." : "Enviar arquivo"}
                        <input
                          type="file"
                          onChange={(e) => {
                            if (e.target.files?.[0]) {
                              handleFileUpload(entrega.id, e.target.files[0]);
                            }
                          }}
                          disabled={uploadingId === entrega.id}
                          className="hidden"
                        />
                      </label>

                      {/* Save Button */}
                      <button
                        onClick={() => handleSaveObservacao(entrega.id)}
                        className="px-4 py-2 bg-transparent border border-[#00E676] text-[#00E676] rounded font-semibold text-xs text-center hover:bg-[#00E676] hover:text-black transition"
                      >
                        Salvar
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        ) : (
          // Documentos Tab
          <div>
            <h1 className="text-3xl font-bold mb-2">Envio de Documentos</h1>
            <p className="text-gray-400 mb-8">
              Selecione a empresa e envie os documentos cont\u00e1beis para an\u00e1lise da ITS.
            </p>

            {/* Formul\u00e1rio de upload */}
            <div className="bg-[#141414] border border-[#1f1f1f] rounded-xl p-6 mb-8">
              <h2 className="text-lg font-bold mb-4">Novo envio</h2>
              <form onSubmit={handleUpload} className="space-y-4">
                <div>
                  <label className="block text-xs text-gray-400 mb-2">Tipo do documento</label>
                  <select
                    value={selectedCodigo}
                    onChange={(e) => setSelectedCodigo(e.target.value)}
                    className="w-full bg-[#0a0a0a] border border-[#1f1f1f] rounded-lg px-4 py-3 text-white focus:border-[#00E676] focus:outline-none"
                  >
                    {DOC_TIPOS.map((t) => (
                      <option key={t.codigo} value={t.codigo}>
                        {t.nome}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs text-gray-400 mb-2">Arquivo</label>
                  <input
                    type="file"
                    accept=".pdf,.xlsx,.xls,.csv,.txt,.xml,.zip"
                    required
                    className="w-full bg-[#0a0a0a] border border-[#1f1f1f] rounded-lg px-4 py-3 text-white file:mr-4 file:py-1 file:px-4 file:rounded-full file:border-0 file:text-sm file:bg-[#00E676] file:text-black file:font-bold hover:file:bg-[#00c864]"
                  />
                </div>

                <button
                  type="submit"
                  disabled={uploading}
                  className="w-full bg-[#00E676] text-black font-bold py-3 px-6 rounded-xl hover:bg-[#00c864] disabled:opacity-50 transition"
                >
                  {uploading ? "Enviando..." : "Enviar documento"}
                </button>

                {uploadMsg && (
                  <div
                    className={`text-sm text-center mt-2 ${
                      uploadMsg.includes("sucesso") ? "text-[#00E676]" : "text-red-400"
                    }`}
                  >
                    {uploadMsg}
                  </div>
                )}
              </form>
            </div>

            {/* Lista de documentos enviados */}
            <div className="bg-[#141414] border border-[#1f1f1f] rounded-xl p-6">
              <h2 className="text-lg font-bold mb-4">Documentos enviados</h2>
              {documentos.length === 0 ? (
                <p className="text-gray-500 text-center py-8">Nenhum documento enviado para esta empresa.</p>
              ) : (
                <div className="space-y-2">
                  {documentos.map((doc) => (
                    <div
                      key={doc.id}
                      className="flex items-center justify-between bg-[#0a0a0a] border border-[#1f1f1f] rounded-lg px-4 py-3"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-lg">
                          {doc.nome_arquivo.endsWith(".pdf")
                            ? "\ud83d\udcc4"
                            : doc.nome_arquivo.endsWith(".xlsx") || doc.nome_arquivo.endsWith(".xls")
                            ? "\ud83d\udcc8"
                            : doc.nome_arquivo.endsWith(".xml")
                            ? "\ud83d\udccb"
                            : "\ud83d\udcc7"}
                        </span>
                        <div>
                          <div className="font-medium text-sm">{doc.nome_arquivo}</div>
                          <div className="text-xs text-gray-500">
                            {DOC_TIPOS.find((t) => t.codigo === doc.codigo)?.nome || doc.codigo}
                            {" \u00b7 "}
                            {formatSize(doc.tamanho || 0)}
                          </div>
                        </div>
                      </div>
                      <div className="text-xs text-gray-500">
                        {new Date(doc.enviado_em).toLocaleDateString("pt-BR")}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </section>

      <footer className="border-t border-[#1f1f1f] p-6 text-xs text-gray-500 text-center mt-12">
        ITS Tax and Corporate \u00b7 \u00c1rea do Contador
      </footer>
    </main>
  );
}
