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
}
