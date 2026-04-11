import { createClient } from "@/lib/supabase-server";
import { redirect } from "next/navigation";
import Link from "next/link";
import fs from "fs";
import path from "path";

const SISTEMAS_META: Record<string, { titulo: string; descricao: string; icone: string }> = {
  "dashboard": { titulo: "Dashboard Financeiro", descricao: "Economia gerada, indicadores e auditoria mensal.", icone: "📊" },
  "controle-fiscal": { titulo: "Controle Fiscal", descricao: "Obrigações mensais, checklist e calendário fiscal.", icone: "✅" },
  "planejamento": { titulo: "Planejamento Tributário", descricao: "Simulação Simples × Presumido × Real.", icone: "💰" },
  "documentos": { titulo: "Documentos", descricao: "Envio e consulta de documentos contábeis.", icone: "📁" },
  "relatorios": { titulo: "Relatórios", descricao: "Relatórios de auditoria e análises periódicas.", icone: "📋" },
};

function getDefaultMeta(slug: string) {
  return {
    titulo: slug.replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase()),
    descricao: "Sistema disponível para sua empresa.",
    icone: "⚙️",
  };
}

function detectSistemas(empresaSlug: string) {
  try {
    const dir = path.join(process.cwd(), "public", "sistemas", empresaSlug);
    if (!fs.existsSync(dir)) return [];
    const files = fs.readdirSync(dir).filter(f => f.endsWith(".html"));
    return files.map(f => {
      const slug = f.replace(".html", "");
      const meta = SISTEMAS_META[slug] || getDefaultMeta(slug);
      return { slug, file: f, ...meta };
    });
  } catch { return []; }
}

function slugify(text: string): string {
  return text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export default async function ClientePage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?area=cliente");

  const { data: empresas } = await supabase
    .from("empresas")
    .select("id, razao_social, nome_fantasia, cnpj, regime")
    .eq("ativo", true);

  const empresa = empresas?.[0];
  const empresaSlug = empresa ? slugify(empresa.nome_fantasia || empresa.razao_social) : "";
  const sistemas = empresa ? detectSistemas(empresaSlug) : [];

  return (
    <main className="min-h-screen bg-its-dark text-white">
      <header className="bg-its-darker border-b border-its-gray p-4 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-its-green" style={{ clipPath: "polygon(0 50%, 50% 0, 100% 50%, 50% 100%)" }} />
            <div>
              <div className="text-[10px] text-its-green">Área do Cliente</div>
              <div className="font-bold">{empresa?.nome_fantasia || empresa?.razao_social || "—"}</div>
            </div>
          </div>
          <form action="/api/auth/signout" method="post">
            <button className="text-xs text-gray-400 hover:text-its-green">Sair</button>
          </form>
        </div>
      </header>

      <section className="max-w-5xl mx-auto p-6">
        <h1 className="text-3xl font-bold">Seus Sistemas</h1>
        <p className="text-gray-400 mt-2">
          {sistemas.length > 0
            ? `${sistemas.length} sistema${sistemas.length > 1 ? "s" : ""} disponível${sistemas.length > 1 ? "eis" : ""} para sua empresa.`
            : "Nenhum sistema disponível no momento."}
        </p>

        {sistemas.length > 0 ? (
          <div className="mt-8 grid md:grid-cols-2 gap-4">
            {sistemas.map((s) => (
              <Link key={s.slug} href={`/cliente/sistema/${empresaSlug}/${s.slug}`} className="card p-6 block hover:border-its-green transition group">
                <div className="flex items-start justify-between">
                  <div className="text-4xl">{s.icone}</div>
                  <span className="text-[10px] font-bold tracking-wider px-2 py-1 rounded bg-its-green text-black">ATIVO</span>
                </div>
                <div className="mt-4 text-xl font-bold">{s.titulo}</div>
                <div className="mt-2 text-sm text-gray-400">{s.descricao}</div>
                <div className="mt-4 text-its-green text-sm font-bold group-hover:translate-x-1 transition-transform">Abrir →</div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="card p-12 text-center text-gray-500 mt-8">
            {empresa ? "Nenhum sistema configurado ainda. A equipe ITS está preparando o seu acesso." : "Nenhuma empresa vinculada à sua conta."}
          </div>
        )}
      </section>

      <footer className="border-t border-its-gray p-6 text-xs text-gray-500 text-center mt-12">
        ITS Tax and Corporate · Área do Cliente
      </footer>
    </main>
  );
}import { createClient } from "@/lib/supabase-server";
import { redirect } from "next/navigation";
import Link from "next/link";

export default async function ClientePage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?area=cliente");

  const { data: empresas } = await supabase
    .from("empresas")
    .select("id, razao_social, nome_fantasia, cnpj, regime")
    .eq("ativo", true);

  const empresa = empresas?.[0];
  let processo = null, indicadores = null, auditoria = null;
  if (empresa) {
    const { data: p } = await supabase
      .from("processos_mensais")
      .select("*")
      .eq("empresa_id", empresa.id)
      .order("competencia", { ascending: false })
      .limit(1)
      .maybeSingle();
    processo = p;
    if (processo) {
      const { data: i } = await supabase.from("indicadores").select("*").eq("processo_id", processo.id).maybeSingle();
      const { data: a } = await supabase.from("auditoria_diffs").select("*").eq("processo_id", processo.id);
      indicadores = i; auditoria = a;
    }
  }

  return (
    <main className="min-h-screen bg-its-dark text-white pb-24">
      <header className="bg-its-darker border-b border-its-gray p-4 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div>
            <div className="text-[10px] text-its-green">Área do Cliente</div>
            <div className="font-bold">{empresa?.nome_fantasia || empresa?.razao_social || "—"}</div>
          </div>
          <form action="/api/auth/signout" method="post">
            <button className="text-xs text-gray-400 hover:text-its-green">Sair</button>
          </form>
        </div>
      </header>

      <div className="max-w-5xl mx-auto p-4 space-y-4">
        {processo && (
          <div className="card p-6 bg-gradient-to-br from-its-gray to-its-darker border-its-green">
            <div className="text-xs text-gray-400">ECONOMIA GERADA PELA ITS</div>
            <div className="text-4xl font-bold text-its-green mt-1">
              R$ {Number(processo.economia_gerada || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
            </div>
            <div className="text-xs text-gray-400 mt-1">Competência {new Date(processo.competencia).toLocaleDateString("pt-BR")}</div>
          </div>
        )}

        {indicadores && (
          <div className="card p-6">
            <div className="font-bold mb-4">Indicadores</div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <Ind label="Margem bruta" value={indicadores.margem_bruta + "%"} />
              <Ind label="Margem líquida" value={indicadores.margem_liquida + "%"} />
              <Ind label="Liquidez corrente" value={indicadores.liquidez_corrente} />
              <Ind label="Health Score" value={indicadores.health_score + "/100"} />
            </div>
          </div>
        )}

        {auditoria && auditoria.length > 0 && (
          <div className="card p-6">
            <div className="font-bold mb-4">Ajustes da auditoria ITS</div>
            <table className="w-full text-sm">
              <thead className="text-left text-gray-400 text-xs">
                <tr><th className="py-2">Item</th><th>Contador</th><th>ITS</th><th className="text-right">Impacto</th></tr>
              </thead>
              <tbody>
                {auditoria.map((d: any) => (
                  <tr key={d.id} className="border-t border-its-gray">
                    <td className="py-2">{d.item}</td>
                    <td>R$ {Number(d.valor_contador).toLocaleString("pt-BR")}</td>
                    <td>R$ {Number(d.valor_its).toLocaleString("pt-BR")}</td>
                    <td className="text-right text-its-green font-bold">
                      R$ {Number(d.impacto).toLocaleString("pt-BR")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!empresa && (
          <div className="card p-6 text-gray-400">Nenhuma empresa vinculada ainda.</div>
        )}
      </div>

      <nav className="fixed bottom-0 left-0 right-0 bg-its-darker border-t border-its-gray flex justify-around text-[10px] text-gray-500 z-10">
        <Link href="/cliente" className="flex-1 py-3 text-center text-its-green">🏠<div>Início</div></Link>
        <Link href="/cliente/indices" className="flex-1 py-3 text-center">📊<div>Índices</div></Link>
        <Link href="/cliente/tributos" className="flex-1 py-3 text-center">💰<div>Tributos</div></Link>
        <Link href="/cliente/docs" className="flex-1 py-3 text-center">📁<div>Docs</div></Link>
        <Link href="/cliente/chamados" className="flex-1 py-3 text-center">💬<div>Chamados</div></Link>
      </nav>
    </main>
  );
}

function Ind({ label, value }: { label: string; value: any }) {
  return (
    <div>
      <div className="text-xs text-gray-400">{label}</div>
      <div className="text-2xl font-bold text-its-green">{value}</div>
    </div>
  );
}
